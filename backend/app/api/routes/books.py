import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, status
from app.models.schemas import BookUploadResponse, BookStatusResponse, ProcessingStatus
from app.services.rag_service import process_uploaded_book
from app.core.database import get_supabase

router = APIRouter(prefix="/books", tags=["Books & RAG"])

# Constants for file validation
MAX_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_MIME_TYPES = ["application/pdf"]

@router.post("/upload", response_model=BookUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_book(
    background_tasks: BackgroundTasks,
    user_id: str = Form(...),
    skill_tag: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Receives a PDF, validates its integrity, and queues it for RAG processing.
    Processing occurs in a non-blocking background task.
    """
    # 1. Validation
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid file type. Only PDFs are supported.")

    # Read bytes for size validation and processing
    file_bytes = await file.read()
    file_size = len(file_bytes)

    if file_size > MAX_SIZE:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File exceeds 50MB limit.")
    if file_size < 1024:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File is too small or corrupted.")

    # 2. Database Record Initialization
    supabase = await get_supabase()
    book_id = str(uuid.uuid4())
    clean_skill = skill_tag.lower().strip()

    # We store the initial pending state
    await supabase.table("user_books").insert({
        "id": book_id,
        "user_id": user_id,
        "file_name": file.filename,
        "skill_tag": clean_skill,
        "processing_status": ProcessingStatus.PENDING.value,
        "file_size_bytes": file_size,
    }).execute()

    # 3. Queue RAG Service
    # Note: We pass the bytes directly to the background task
    background_tasks.add_task(
        process_uploaded_book,
        book_id=book_id,
        user_id=user_id,
        file_bytes=file_bytes,
        file_name=file.filename,
        skill_tag=clean_skill,
    )

    return BookUploadResponse(
        book_id=book_id,
        file_name=file.filename or "unknown",
        status=ProcessingStatus.PENDING,
        message="Upload successful. Your mentor is now reading the material."
    )

@router.get("/{book_id}/status", response_model=BookStatusResponse)
async def get_book_status(book_id: str):
    """Checks the current progress of PDF embedding and topic detection."""
    supabase = await get_supabase()
    
    result = await supabase.table("user_books").select("*").eq("id", book_id).single().execute()
    
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Book record not found.")
        
    book = result.data
    return BookStatusResponse(
        book_id=book["id"],
        file_name=book["file_name"],
        status=book["processing_status"],
        total_chunks=book.get("total_chunks"),
        topics_detected=book.get("topics_detected"),
        error_message=book.get("error_message")
    )

@router.delete("/{book_id}")
async def delete_book(book_id: str, user_id: str):
    """
    Deletes the book record and cascaded vector chunks.
    Ensures the requesting user owns the document.
    """
    supabase = await get_supabase()
    
    # Ownership verification
    ownership_check = await supabase.table("user_books").select("user_id").eq("id", book_id).single().execute()
    
    if not ownership_check.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Book not found.")
    if ownership_check.data["user_id"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to delete this document.")

    # Atomic deletion
    # Ensure your Supabase schema has 'ON DELETE CASCADE' for book_chunks
    await supabase.table("user_books").delete().eq("id", book_id).execute()
    
    return {"message": "Knowledge base updated. Book and chunks removed."}
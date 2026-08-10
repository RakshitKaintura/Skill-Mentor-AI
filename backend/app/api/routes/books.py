from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, status, Depends
from supabase import Client

from app.models.schemas import BookUploadResponse, BookStatusResponse, ProcessingStatus
from app.core.database import get_supabase
from app.services.books_service import BooksService

router = APIRouter(prefix="/books", tags=["Books & RAG"])

# Constants for file validation
MAX_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_MIME_TYPES = ["application/pdf"]

def get_books_service(supabase: Client = Depends(get_supabase)) -> BooksService:
    return BooksService(supabase)

@router.post("/upload", response_model=BookUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_book(
    background_tasks: BackgroundTasks,
    user_id: str = Form(...),
    skill_tag: str = Form(...),
    file: UploadFile = File(...),
    service: BooksService = Depends(get_books_service)
):
    """
    Receives a PDF, validates its integrity, and queues it for RAG processing.
    Processing occurs in a non-blocking background task.
    """
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid file type. Only PDFs are supported.")

    file_bytes = await file.read()
    file_size = len(file_bytes)

    if file_size > MAX_SIZE:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File exceeds 50MB limit.")
    if file_size < 1024:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File is too small or corrupted.")

    book_id = service.initialize_upload(
        user_id=user_id,
        file_name=file.filename or "unknown",
        skill_tag=skill_tag,
        file_size=file_size,
        file_bytes=file_bytes,
        background_tasks=background_tasks
    )

    return BookUploadResponse(
        book_id=book_id,
        file_name=file.filename or "unknown",
        status=ProcessingStatus.pending,
        message="Upload successful. Your mentor is now reading the material."
    )

@router.get("/{book_id}/status", response_model=BookStatusResponse)
async def get_book_status(
    book_id: str,
    service: BooksService = Depends(get_books_service)
):
    """Checks the current progress of PDF embedding and topic detection."""
    book = service.get_status(book_id)
    return BookStatusResponse(
        book_id=book["id"],
        file_name=book["file_name"],
        status=book["processing_status"],
        total_chunks=book.get("total_chunks"),
        topics_detected=book.get("topics_detected"),
        error_message=book.get("error_message")
    )

@router.delete("/{book_id}")
async def delete_book(
    book_id: str, 
    user_id: str,
    service: BooksService = Depends(get_books_service)
):
    """
    Deletes the book record and cascaded vector chunks.
    Ensures the requesting user owns the document.
    """
    service.delete_book(book_id, user_id)
    return {"message": "Knowledge base updated. Book and chunks removed."}
import uuid
from typing import Optional, Dict, Any
from fastapi import BackgroundTasks, HTTPException, status
from supabase import Client

from app.models.schemas import ProcessingStatus
from app.services.rag_service import process_uploaded_book

class BooksService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    def initialize_upload(self, user_id: str, file_name: str, skill_tag: str, file_size: int, file_bytes: bytes, background_tasks: BackgroundTasks) -> str:
        book_id = str(uuid.uuid4())
        clean_skill = skill_tag.lower().strip()

        self.supabase.table("user_books").insert({
            "id": book_id,
            "user_id": user_id,
            "file_name": file_name,
            "skill_tag": clean_skill,
            "processing_status": ProcessingStatus.PENDING.value,
            "file_size_bytes": file_size,
        }).execute()

        background_tasks.add_task(
            process_uploaded_book,
            book_id=book_id,
            user_id=user_id,
            file_bytes=file_bytes,
            file_name=file_name,
            skill_tag=clean_skill,
        )

        return book_id

    def get_status(self, book_id: str) -> dict:
        result = self.supabase.table("user_books").select("*").eq("id", book_id).single().execute()
        if not result.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Book record not found.")
        return result.data

    def delete_book(self, book_id: str, user_id: str) -> None:
        ownership_check = self.supabase.table("user_books").select("user_id").eq("id", book_id).single().execute()
        
        if not ownership_check.data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Book not found.")
        if ownership_check.data["user_id"] != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to delete this document.")

        self.supabase.table("user_books").delete().eq("id", book_id).execute()

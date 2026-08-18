import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from supabase import Client

from app.core.auth import get_current_user
from app.core.database import get_supabase
from app.services.user_notes_service import UserNotesService

router = APIRouter(prefix="/notes", tags=["Notes"])
logger = logging.getLogger(__name__)

# ── Pydantic schemas ──────────────────────────────────────────

class NoteCreate(BaseModel):
    user_id:    str
    lesson_id:  str | None = None
    roadmap_id: str | None = None
    skill:      str
    topic:      str
    step_index: int | None  = None
    step_title: str | None  = None
    content:    str            = Field(..., min_length=1, max_length=10_000)
    tags:       list[str]      = []

class NoteUpdate(BaseModel):
    content: str | None      = Field(None, max_length=10_000)
    tags:    list[str] | None = None

class SummarizeRequest(BaseModel):
    user_id:  str
    note_ids: list[str] = Field(..., min_length=1, max_length=20)


def get_user_notes_service(supabase: Client = Depends(get_supabase)) -> UserNotesService:
    return UserNotesService(supabase)


# ── GET /api/notes ────────────────────────────────────────────

@router.get("")
async def list_notes(
    user_id:   str             = Query(...),
    lesson_id: str | None  = Query(None),
    skill:     str | None  = Query(None),
    search:    str | None  = Query(None),
    limit:     int             = Query(50, ge=1, le=200),
    auth_user_id: str = Depends(get_current_user),
    service: UserNotesService = Depends(get_user_notes_service)
):
    """Return user's notes, optionally filtered."""
    try:
        return service.list_notes(user_id, lesson_id, skill, search, limit)
    except Exception as e:
        logger.error("list_notes error: %s", e)
        raise HTTPException(500, detail="Failed to fetch notes")


# ── POST /api/notes ───────────────────────────────────────────

@router.post("", status_code=201)
async def create_note(
    req: NoteCreate,
    auth_user_id: str = Depends(get_current_user),
    service: UserNotesService = Depends(get_user_notes_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """Create a new note anchored to a lesson step."""
    try:
        return service.create_note(
            user_id=req.user_id,
            lesson_id=req.lesson_id,
            roadmap_id=req.roadmap_id,
            skill=req.skill,
            topic=req.topic,
            step_index=req.step_index,
            step_title=req.step_title,
            content=req.content,
            tags=req.tags,
        )
    except Exception as e:
        logger.error("create_note error: %s", e)
        raise HTTPException(500, detail="Failed to create note")


# ── PATCH /api/notes/{note_id} ────────────────────────────────

@router.patch("/{note_id}")
async def update_note(
    note_id: str,
    req:     NoteUpdate,
    user_id: str = Query(...),
    auth_user_id: str = Depends(get_current_user),
    service: UserNotesService = Depends(get_user_notes_service)
):
    if user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """Update note content and/or tags. User must own the note."""
    try:
        return service.update_note(note_id, user_id, req.content, req.tags)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_note error: %s", e)
        raise HTTPException(500, detail="Failed to update note")


# ── DELETE /api/notes/{note_id} ───────────────────────────────

@router.delete("/{note_id}", status_code=204)
async def delete_note(
    note_id: str,
    user_id: str = Query(...),
    auth_user_id: str = Depends(get_current_user),
    service: UserNotesService = Depends(get_user_notes_service)
):
    if user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """Delete a note. User must own the note."""
    try:
        service.delete_note(note_id, user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_note error: %s", e)
        raise HTTPException(500, detail="Failed to delete note")


# ── POST /api/notes/summarize ─────────────────────────────────

@router.post("/summarize")
async def summarize_notes(
    req: SummarizeRequest,
    auth_user_id: str = Depends(get_current_user),
    service: UserNotesService = Depends(get_user_notes_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """
    AI-summarize a list of notes into bullet points using Gemini.
    Writes the summary back to each note's ai_summary column.
    """
    try:
        return await service.summarize_notes(req.user_id, req.note_ids)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("summarize_notes error: %s", e)
        raise HTTPException(500, detail=f"Summarization failed: {e!s}")

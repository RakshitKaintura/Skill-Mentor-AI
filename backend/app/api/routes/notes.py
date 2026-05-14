"""
Notes API Routes — Smart Notes System with AI Summarization
Endpoints:
  GET    /api/notes              — list notes (filterable by lesson_id, skill, search)
  POST   /api/notes              — create a note
  PATCH  /api/notes/{note_id}   — update content/tags
  DELETE /api/notes/{note_id}   — delete a note
  POST   /api/notes/summarize   — AI-summarize a list of notes
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.database import get_supabase
from app.core.gemini import get_gemini_client

router = APIRouter(prefix="/notes", tags=["Notes"])
logger = logging.getLogger(__name__)

# ── Pydantic schemas ──────────────────────────────────────────

class NoteCreate(BaseModel):
    user_id:    str
    lesson_id:  Optional[str] = None
    roadmap_id: Optional[str] = None
    skill:      str
    topic:      str
    step_index: Optional[int]  = None
    step_title: Optional[str]  = None
    content:    str            = Field(..., min_length=1, max_length=10_000)
    tags:       list[str]      = []

class NoteUpdate(BaseModel):
    content: Optional[str]      = Field(None, max_length=10_000)
    tags:    Optional[list[str]] = None

class SummarizeRequest(BaseModel):
    user_id:  str
    note_ids: list[str] = Field(..., min_length=1, max_length=20)


# ── GET /api/notes ────────────────────────────────────────────

@router.get("")
async def list_notes(
    user_id:   str             = Query(...),
    lesson_id: Optional[str]  = Query(None),
    skill:     Optional[str]  = Query(None),
    search:    Optional[str]  = Query(None),
    limit:     int             = Query(50, ge=1, le=200),
):
    """Return user's notes, optionally filtered."""
    supabase = get_supabase()
    try:
        q = supabase.table("user_notes") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(limit)

        if lesson_id:
            q = q.eq("lesson_id", lesson_id)
        if skill:
            q = q.eq("skill", skill)
        if search:
            # ilike on content + topic
            q = q.or_(f"content.ilike.%{search}%,topic.ilike.%{search}%")

        result = q.execute()
        return {"notes": result.data or [], "count": len(result.data or [])}
    except Exception as e:
        logger.error("list_notes error: %s", e)
        raise HTTPException(500, detail="Failed to fetch notes")


# ── POST /api/notes ───────────────────────────────────────────

@router.post("", status_code=201)
async def create_note(req: NoteCreate):
    """Create a new note anchored to a lesson step."""
    supabase = get_supabase()
    try:
        row = {
            "user_id":    req.user_id,
            "lesson_id":  req.lesson_id,
            "roadmap_id": req.roadmap_id,
            "skill":      req.skill,
            "topic":      req.topic,
            "step_index": req.step_index,
            "step_title": req.step_title,
            "content":    req.content.strip(),
            "tags":       req.tags,
        }
        result = supabase.table("user_notes").insert(row).execute()
        if not result.data:
            raise RuntimeError("Insert returned no data")
        return result.data[0]
    except Exception as e:
        logger.error("create_note error: %s", e)
        raise HTTPException(500, detail="Failed to create note")


# ── PATCH /api/notes/{note_id} ────────────────────────────────

@router.patch("/{note_id}")
async def update_note(
    note_id: str,
    req:     NoteUpdate,
    user_id: str = Query(...),
):
    """Update note content and/or tags. User must own the note."""
    supabase = get_supabase()
    try:
        # Ownership check
        existing = supabase.table("user_notes") \
            .select("id, user_id") \
            .eq("id", note_id) \
            .eq("user_id", user_id) \
            .single().execute()
        if not existing.data:
            raise HTTPException(404, detail="Note not found")

        updates: dict = {}
        if req.content is not None:
            updates["content"] = req.content.strip()
        if req.tags is not None:
            updates["tags"] = req.tags
        if not updates:
            raise HTTPException(400, detail="Nothing to update")

        result = supabase.table("user_notes") \
            .update(updates) \
            .eq("id", note_id) \
            .execute()
        return result.data[0] if result.data else {"id": note_id, **updates}
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
):
    """Delete a note. User must own the note."""
    supabase = get_supabase()
    try:
        result = supabase.table("user_notes") \
            .delete() \
            .eq("id", note_id) \
            .eq("user_id", user_id) \
            .execute()
        if not result.data:
            raise HTTPException(404, detail="Note not found or already deleted")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_note error: %s", e)
        raise HTTPException(500, detail="Failed to delete note")


# ── POST /api/notes/summarize ─────────────────────────────────

@router.post("/summarize")
async def summarize_notes(req: SummarizeRequest):
    """
    AI-summarize a list of notes into bullet points using Gemini.
    Writes the summary back to each note's ai_summary column.
    """
    supabase = get_supabase()
    client   = get_gemini_client()

    try:
        # Fetch and validate ownership
        result = supabase.table("user_notes") \
            .select("id, topic, step_title, content") \
            .in_("id", req.note_ids) \
            .eq("user_id", req.user_id) \
            .execute()

        notes = result.data or []
        if not notes:
            raise HTTPException(404, detail="No accessible notes found for the given IDs")

        # Build prompt context
        note_blocks = []
        for n in notes:
            ctx = f"Step: {n.get('step_title') or 'General'}\n{n['content']}"
            note_blocks.append(ctx)

        prompt = (
            "You are a study assistant helping a student review their notes.\n"
            "Summarize the following study notes into 5–7 clear, concise bullet points.\n"
            "Focus on key concepts, definitions, patterns, and anything worth memorizing.\n"
            "Format each bullet starting with '• '.\n\n"
            "Topic: " + (notes[0].get("topic") or "Unknown") + "\n\n"
            "Notes:\n" + "\n\n---\n\n".join(note_blocks)
        )

        response = client.models.generate_content(
            model="gemini-2.0-flash-lite",
            contents=prompt,
        )
        summary = response.text.strip()

        # Persist summary back to each note
        supabase.table("user_notes") \
            .update({"ai_summary": summary}) \
            .in_("id", [n["id"] for n in notes]) \
            .execute()

        return {
            "summary":  summary,
            "note_ids": [n["id"] for n in notes],
            "count":    len(notes),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("summarize_notes error: %s", e)
        raise HTTPException(500, detail=f"Summarization failed: {str(e)}")

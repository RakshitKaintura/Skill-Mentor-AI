
import logging
from typing import Any, cast

from fastapi import HTTPException
from supabase import Client

from app.core.gemini import get_gemini_client

logger = logging.getLogger(__name__)

class UserNotesService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    def list_notes(self, user_id: str, lesson_id: str | None, skill: str | None, search: str | None, limit: int) -> dict:
        q = self.supabase.table("user_notes") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(limit)

        if lesson_id:
            q = q.eq("lesson_id", lesson_id)
        if skill:
            q = q.eq("skill", skill)
        if search:
            q = q.or_(f"content.ilike.%{search}%,topic.ilike.%{search}%")

        result = q.execute()
        return {"notes": result.data or [], "count": len(result.data or [])}

    def create_note(self, user_id: str, lesson_id: str | None, roadmap_id: str | None, skill: str, topic: str, step_index: int | None, step_title: str | None, content: str, tags: list[str]) -> dict:
        row = {
            "user_id":    user_id,
            "lesson_id":  lesson_id,
            "roadmap_id": roadmap_id,
            "skill":      skill,
            "topic":      topic,
            "step_index": step_index,
            "step_title": step_title,
            "content":    content.strip(),
            "tags":       tags,
        }
        result = self.supabase.table("user_notes").insert(row).execute()
        if not result.data:
            raise RuntimeError("Insert returned no data")
        return cast(dict[str, Any], result.data[0])

    def update_note(self, note_id: str, user_id: str, content: str | None, tags: list[str] | None) -> dict:
        existing = self.supabase.table("user_notes") \
            .select("id, user_id") \
            .eq("id", note_id) \
            .eq("user_id", user_id) \
            .single().execute()
        
        if not existing.data:
            raise HTTPException(404, detail="Note not found")

        updates: dict = {}
        if content is not None:
            updates["content"] = content.strip()
        if tags is not None:
            updates["tags"] = tags
            
        if not updates:
            raise HTTPException(400, detail="Nothing to update")

        result = self.supabase.table("user_notes") \
            .update(updates) \
            .eq("id", note_id) \
            .execute()
            
        return cast(dict[str, Any], result.data[0]) if result.data else {"id": note_id, **updates}

    def delete_note(self, note_id: str, user_id: str) -> None:
        result = self.supabase.table("user_notes") \
            .delete() \
            .eq("id", note_id) \
            .eq("user_id", user_id) \
            .execute()
            
        if not result.data:
            raise HTTPException(404, detail="Note not found or already deleted")

    async def summarize_notes(self, user_id: str, note_ids: list[str]) -> dict:
        client = get_gemini_client()

        result = self.supabase.table("user_notes") \
            .select("id, topic, step_title, content") \
            .in_("id", note_ids) \
            .eq("user_id", user_id) \
            .execute()

        from typing import cast
        notes = cast(list[dict[str, Any]], result.data or [])
        if not notes:
            raise HTTPException(404, detail="No accessible notes found for the given IDs")

        note_blocks = []
        for n in notes:
            ctx = f"Step: {n.get('step_title') or 'General'!s}\n{n.get('content', '')!s}"
            note_blocks.append(ctx)

        prompt = (
            "You are a study assistant helping a student review their notes.\n"
            "Summarize the following study notes into 5–7 clear, concise bullet points.\n"
            "Focus on key concepts, definitions, patterns, and anything worth memorizing.\n"
            "Format each bullet starting with '• '.\n\n"
            "Topic: " + str(notes[0].get("topic") or "Unknown") + "\n\n"
            "Notes:\n" + "\n\n---\n\n".join(note_blocks)
        )

        response = client.models.generate_content(
            model="gemini-2.0-flash-lite",
            contents=prompt,
        )
        summary = (response.text or "").strip()

        self.supabase.table("user_notes") \
            .update({"ai_summary": summary}) \
            .in_("id", [n["id"] for n in notes]) \
            .execute()

        return {
            "summary":  summary,
            "note_ids": [n["id"] for n in notes],
            "count":    len(notes),
        }

import json
from collections.abc import AsyncGenerator

from supabase import Client

from app.agents.doubt_agent import solve_doubt
from app.agents.lesson_agent import complete_lesson, generate_lesson
from app.core.config import get_settings
from app.core.gemini import get_gemini_client
from app.services.notes_service import generate_lesson_pdf
from app.services.rag_service import format_rag_context, retrieve_chunks


class LessonsService:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.settings = get_settings()

    async def generate_lesson(self, req) -> dict:
        result = await generate_lesson(req)
        return {
            "lesson_id": result["lesson_id"],
            "topic": result["topic"],
            "steps_count": len(result["steps"]),
            "message": result["message"],
        }

    async def ask_doubt(self, req) -> dict:
        return await solve_doubt(req)

    def cleanup_user_lessons(self, user_id: str) -> None:
        self.supabase.table("lessons").delete().eq("user_id", user_id).execute()

    def list_lessons(self, user_id: str, limit: int) -> list:
        result = (
            self.supabase.table("lessons")
            .select("id, topic, week_number, completed, completed_at, created_at, sources_used, key_takeaway")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []

    def get_lesson(self, lesson_id: str) -> dict | None:
        result = self.supabase.table("lessons").select("*").eq("id", lesson_id).single().execute()
        return result.data if result.data else None

    async def mark_complete(self, lesson_id: str, user_id: str, time_spent_minutes: int) -> dict:
        return await complete_lesson(user_id, lesson_id, time_spent_minutes)

    async def generate_notes(self, lesson_id: str, user_id: str) -> str:
        return await generate_lesson_pdf(lesson_id, user_id)

    async def stream_lesson_intro_generator(self, roadmap_id: str, topic: str, user_id: str, skill: str, level: str) -> AsyncGenerator[str, None]:
        rag_chunks = await retrieve_chunks(
            query=f"{topic} {skill}", 
            user_id=user_id,
            skill_tag=skill.lower(), 
            top_k=3, 
            include_curated=True,
        )
        rag_context = format_rag_context(rag_chunks)

        prompt = f"""
        You are teaching {skill} to a {level} learner. 
        Topic: {topic}.
        
        [CONTEXT]
        {rag_context}
        
        TASK: Write a 3-paragraph introduction explaining:
        1. What it is.
        2. Why it is critical to master.
        3. A brief 'hook' using an analogy.
        
        Tone: Warm, authoritative, and direct (use "you").
        """

        try:
            client = get_gemini_client()
            response = client.models.generate_content(
                model=self.settings.gemini_model,
                contents=prompt,
                config={'stream': True}
            )
            
            for chunk in response:
                if chunk.text:
                    yield f"data: {json.dumps({'text': chunk.text})}\n\n"
            
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

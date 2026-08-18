import logging

from supabase import Client

from app.agents.code_coach_agent import (
    evaluate_submission,
    explain_error,
    generate_challenge,
    get_personalized_hint,
)
from app.services.judge0_service import execute_code

logger = logging.getLogger(__name__)

class PlaygroundService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    async def generate_challenge(self, user_id: str, roadmap_id: str, lesson_id: str, topic: str, skill: str, difficulty: str, language: str) -> dict:
        return await generate_challenge(
            user_id=user_id, 
            roadmap_id=roadmap_id,
            lesson_id=lesson_id, 
            topic=topic, 
            skill=skill,
            difficulty=difficulty, 
            language=language
        )

    async def get_hint(self, challenge_id: str, user_code: str, hint_level: int, error_message: str | None, user_id: str) -> dict:
        return await get_personalized_hint(
            challenge_id=challenge_id, 
            user_code=user_code, 
            hint_level=hint_level,
            error_message=error_message,
            user_id=user_id
        )

    async def evaluate_code(self, challenge_id: str, user_id: str, user_code: str, hints_used: int) -> dict:
        return await evaluate_submission(
            challenge_id=challenge_id, 
            user_id=user_id,
            user_code=user_code, 
            hints_used=hints_used
        )

    async def explain_error(self, error_message: str, code: str, language: str, topic: str) -> dict:
        return await explain_error(
            error_message=error_message, 
            code=code,
            language=language, 
            topic=topic
        )

    async def execute_code(self, source_code: str, language: str, stdin: str) -> dict:
        result = await execute_code(
            source_code=source_code,
            language=language,
            stdin=stdin,
        )
        return {
            "accepted": result.accepted,
            "stdout": result.stdout,
            "stderr": result.error_output,
            "status": result.status_desc,
            "time": result.time,
            "memory": result.memory,
        }

    def get_user_challenges(self, user_id: str, roadmap_id: str | None) -> list:
        query = self.supabase.table("code_challenges").select("*").eq("user_id", user_id)
        if roadmap_id:
            query = query.eq("roadmap_id", roadmap_id)
            
        result = query.order("created_at", desc=True).limit(20).execute()
        return result.data or []

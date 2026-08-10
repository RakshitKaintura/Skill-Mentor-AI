import logging
from typing import Optional, List, Dict, Any
from fastapi import BackgroundTasks
from supabase import Client

from app.agents.quiz_agent import generate_quiz, evaluate_quiz
from app.agents.progress_agent import update_topic_mastery

logger = logging.getLogger(__name__)

class QuizService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    async def generate_quiz(self, user_id: str, roadmap_id: str, topic: str, skill: str, week_number: int, lesson_id: Optional[str], difficulty: str, num_questions: int) -> dict:
        return await generate_quiz(
            user_id=user_id,
            roadmap_id=roadmap_id,
            topic=topic,
            skill=skill,
            week_number=week_number,
            lesson_id=lesson_id,
            difficulty=difficulty,
            num_questions=num_questions
        )

    async def submit_quiz(self, quiz_id: str, user_id: str, user_answers: List[Dict[str, Any]], time_taken: int, background_tasks: BackgroundTasks) -> dict:
        result = await evaluate_quiz(
            quiz_id=quiz_id,
            user_id=user_id,
            user_answers=user_answers,
            time_taken=time_taken
        )

        quiz_meta = self.supabase.table("quizzes").select("topic, skill") \
            .eq("id", quiz_id).single().execute()
        
        if quiz_meta.data:
            background_tasks.add_task(
                update_topic_mastery,
                user_id=user_id,
                topic=quiz_meta.data["topic"],
                skill=quiz_meta.data["skill"],
                score_pct=result["percentage"]
            )

        return result

    def get_user_quizzes(self, user_id: str, roadmap_id: Optional[str], limit: int) -> list:
        query = self.supabase.table("quizzes").select("*").eq("user_id", user_id)
        if roadmap_id:
            query = query.eq("roadmap_id", roadmap_id)
        result = query.order("created_at", desc=True).limit(limit).execute()
        return result.data or []

    def get_quiz(self, quiz_id: str) -> Optional[dict]:
        result = self.supabase.table("quizzes").select("*").eq("id", quiz_id).single().execute()
        return result.data if result.data else None

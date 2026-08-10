import logging
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
from supabase import Client

from app.agents.progress_agent import (
    generate_report_card, 
    get_due_reviews
)

logger = logging.getLogger(__name__)

class ProgressService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    def _normalize_report_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Map report_cards rows to a stable API shape consumed by frontend."""
        avg_score_raw = row.get("avg_quiz_score", 0)
        try:
            avg_score = float(avg_score_raw or 0)
        except Exception:
            avg_score = 0.0

        return {
            "id": row.get("id"),
            "user_id": row.get("user_id"),
            "roadmap_id": row.get("roadmap_id"),
            "week_number": int(row.get("week_number") or 1),
            "skill": row.get("skill") or "General",
            "overall_grade": row.get("overall_grade") or "C",
            "grade_reasoning": row.get("grade_reasoning") or "No grade reasoning available yet.",
            "summary": row.get("summary") or "No summary available yet.",
            "strengths": row.get("strengths") if isinstance(row.get("strengths"), list) else [],
            "weaknesses": row.get("weaknesses") if isinstance(row.get("weaknesses"), list) else [],
            "recommendations": row.get("recommendations") if isinstance(row.get("recommendations"), list) else [],
            "lessons_done": int(row.get("lessons_completed", 0) or 0),
            "quizzes_done": int(row.get("quizzes_completed", 0) or 0),
            "challenges_done": int(row.get("challenges_completed", 0) or 0),
            "avg_score": round(max(0.0, min(avg_score, 100.0)), 1),
            "streak": int(row.get("streak_days", 0) or 0),
            "xp_total": int(row.get("xp_earned", 0) or 0),
            "motivational_message": row.get("motivational_message") or "Keep going, you are making steady progress.",
            "next_week_focus": row.get("next_week_focus") or "Continue practicing core topics from this week.",
            "pdf_url": row.get("pdf_url"),
            "created_at": row.get("created_at"),
        }

    async def generate_report_card(self, user_id: str, roadmap_id: str, week_number: int) -> dict:
        return await generate_report_card(
            user_id=user_id,
            roadmap_id=roadmap_id,
            week_number=week_number,
        )

    def get_report_cards(self, user_id: str, roadmap_id: str) -> list:
        result = self.supabase.table("report_cards").select("*") \
            .eq("user_id", user_id) \
            .eq("roadmap_id", roadmap_id) \
            .order("week_number", desc=True) \
            .execute()

        return [self._normalize_report_row(r) for r in (result.data or [])]

    async def get_due_reviews(self, user_id: str) -> list:
        return await get_due_reviews(user_id)

    def get_leaderboard(self, limit: int) -> list:
        result = self.supabase.table("leaderboard").select("*").limit(limit).execute()
        return result.data or []

    def get_user_stats(self, user_id: str) -> dict:
        progress = self.supabase.table("user_progress").select("*").eq("user_id", user_id).single().execute()
        
        if not progress.data:
            raise HTTPException(status_code=404, detail="Student progress record not found.")
            
        return progress.data

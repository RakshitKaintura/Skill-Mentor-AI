"""
Progress Tracker API Routes — Agent 6
Handles weekly report card generation, spaced repetition tracking, and leaderboard stats.
"""
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.agents.progress_agent import (
    generate_report_card, 
    get_due_reviews
)
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/progress", tags=["Analytics & Progress"])


def _normalize_report_row(row: Dict[str, Any]) -> Dict[str, Any]:
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

# --- Request Schemas ---

class ReportCardRequest(BaseModel):
    user_id: str
    roadmap_id: str
    week_number: int

# --- API Endpoints ---

@router.post("/report-card")
async def generate_report_card_endpoint(req: ReportCardRequest):
    """
    Triggers Agent 6 to synthesize weekly data into a branded AI report card.
    Generates a PDF asset and updates topic mastery trends.
    """
    try:
        report = await generate_report_card(
            user_id=req.user_id,
            roadmap_id=req.roadmap_id,
            week_number=req.week_number,
        )
        return {"success": True, "report": report}
    except Exception as e:
        logger.error(f"Report card generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to synthesize weekly report.")

@router.get("/report-card/{user_id}")
async def get_report_cards(user_id: str, roadmap_id: str):
    """Retrieves all historical report cards for a specific roadmap."""
    supabase = get_supabase()
    result = supabase.table("report_cards").select("*") \
        .eq("user_id", user_id) \
        .eq("roadmap_id", roadmap_id) \
        .order("week_number", desc=True) \
        .execute()

    reports = [_normalize_report_row(r) for r in (result.data or [])]
    return {"reports": reports}

@router.get("/due-reviews/{user_id}")
async def due_reviews_endpoint(user_id: str):
    """
    Fetches topics flagged for review by the Spaced Repetition algorithm.
    Essential for long-term retention of technical concepts.
    """
    try:
        reviews = await get_due_reviews(user_id)
        return {"due_reviews": reviews, "count": len(reviews)}
    except Exception as e:
        logger.error(f"Failed to fetch due reviews: {e}")
        raise HTTPException(status_code=500, detail="Spaced repetition service error.")

@router.get("/leaderboard")
async def get_leaderboard(limit: int = Query(20, le=100)):
    """Retrieves the global XP leaderboard to foster healthy competition."""
    supabase = get_supabase()
    # Assuming a view or table named 'leaderboard' exists in your schema
    result = supabase.table("leaderboard").select("*").limit(limit).execute()
    return {"leaderboard": result.data or []}

@router.get("/stats/{user_id}")
async def get_user_stats(user_id: str):
    """
    Returns comprehensive learning statistics including XP, streaks, 
    and topic mastery distributions.
    """
    supabase = get_supabase()
    progress = supabase.table("user_progress").select("*").eq("user_id", user_id).single().execute()
    
    if not progress.data:
        raise HTTPException(status_code=404, detail="Student progress record not found.")
        
    return {"stats": progress.data}
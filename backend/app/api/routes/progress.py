import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from supabase import Client

from app.core.database import get_supabase
from app.services.progress_service import ProgressService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/progress", tags=["Analytics & Progress"])


def get_progress_service(supabase: Client = Depends(get_supabase)) -> ProgressService:
    return ProgressService(supabase)

# --- Request Schemas ---

class ReportCardRequest(BaseModel):
    user_id: str
    roadmap_id: str
    week_number: int

# --- API Endpoints ---

@router.post("/report-card")
async def generate_report_card_endpoint(
    req: ReportCardRequest,
    service: ProgressService = Depends(get_progress_service)
):
    """
    Triggers Agent 6 to synthesize weekly data into a branded AI report card.
    Generates a PDF asset and updates topic mastery trends.
    """
    try:
        report = await service.generate_report_card(
            user_id=req.user_id,
            roadmap_id=req.roadmap_id,
            week_number=req.week_number,
        )
        return {"success": True, "report": report}
    except Exception as e:
        logger.error(f"Report card generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to synthesize weekly report.")

@router.get("/report-card/{user_id}")
async def get_report_cards(
    user_id: str, 
    roadmap_id: str,
    service: ProgressService = Depends(get_progress_service)
):
    """Retrieves all historical report cards for a specific roadmap."""
    reports = service.get_report_cards(user_id, roadmap_id)
    return {"reports": reports}

@router.get("/due-reviews/{user_id}")
async def due_reviews_endpoint(
    user_id: str,
    service: ProgressService = Depends(get_progress_service)
):
    """
    Fetches topics flagged for review by the Spaced Repetition algorithm.
    Essential for long-term retention of technical concepts.
    """
    try:
        reviews = await service.get_due_reviews(user_id)
        return {"due_reviews": reviews, "count": len(reviews)}
    except Exception as e:
        logger.error(f"Failed to fetch due reviews: {e}")
        raise HTTPException(status_code=500, detail="Spaced repetition service error.")

@router.get("/leaderboard")
async def get_leaderboard(
    limit: int = Query(20, le=100),
    service: ProgressService = Depends(get_progress_service)
):
    """Retrieves the global XP leaderboard to foster healthy competition."""
    leaderboard = service.get_leaderboard(limit)
    return {"leaderboard": leaderboard}

@router.get("/stats/{user_id}")
async def get_user_stats(
    user_id: str,
    service: ProgressService = Depends(get_progress_service)
):
    """
    Returns comprehensive learning statistics including XP, streaks, 
    and topic mastery distributions.
    """
    stats = service.get_user_stats(user_id)
    return {"stats": stats}
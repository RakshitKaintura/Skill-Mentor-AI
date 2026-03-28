"""Daily challenges and notifications routes."""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.daily_challenge_agent import (
    get_or_generate_daily_challenge, complete_daily_challenge
)
from app.services.notification_service import (
    get_notifications, get_unread_count, mark_notifications_read
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/daily", tags=["daily"])


class DailyChallengeRequest(BaseModel):
    user_id:    str
    roadmap_id: str
    skill:      str


class CompleteRequest(BaseModel):
    challenge_id: str
    user_id:      str


class MarkReadRequest(BaseModel):
    user_id:          str
    notification_ids: list[str] | None = None


@router.post("/challenge")
async def get_daily_challenge(req: DailyChallengeRequest):
    try:
        challenge = await get_or_generate_daily_challenge(req.user_id, req.roadmap_id, req.skill)
        return {"success": True, "challenge": challenge}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/challenge/complete")
async def complete_challenge_endpoint(req: CompleteRequest):
    try:
        result = await complete_daily_challenge(req.challenge_id, req.user_id)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/challenge/{user_id}")
async def get_todays_challenge(user_id: str, roadmap_id: str, skill: str):
    try:
        challenge = await get_or_generate_daily_challenge(user_id, roadmap_id, skill)
        return {"success": True, "challenge": challenge}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/notifications/{user_id}")
async def notifications(user_id: str):
    try:
        notifs = await get_notifications(user_id)
        unread = await get_unread_count(user_id)
        return {"notifications": notifs, "count": unread}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/notifications/read")
async def mark_read(req: MarkReadRequest):
    try:
        count = await mark_notifications_read(req.user_id, req.notification_ids)
        return {"success": True, "marked_read": count}
    except Exception as e:
        raise HTTPException(500, str(e))
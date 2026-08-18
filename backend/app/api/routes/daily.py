from app.core.auth import get_current_user

"""Daily challenges and notifications routes."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.services.daily_service import DailyService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/daily", tags=["daily"])

class DailyChallengeRequest(BaseModel):
    user_id:    str
    roadmap_id: str
    skill:      str


class CompleteRequest(BaseModel):
    challenge_id: str
    user_id:      str
    answers:      dict[str, str] | None = None
    code:         str | None = None
    theory:       str | None = None


class MarkReadRequest(BaseModel):
    user_id:          str
    notification_ids: list[str] | None = None

def get_daily_service() -> DailyService:
    return DailyService()

@router.post("/challenge")
async def get_daily_challenge(
    req: DailyChallengeRequest,
    auth_user_id: str = Depends(get_current_user),
    service: DailyService = Depends(get_daily_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    try:
        challenge = await service.get_or_generate_daily_challenge(req.user_id, req.roadmap_id, req.skill)
        return {"success": True, "challenge": challenge}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/challenge/complete")
async def complete_challenge_endpoint(
    req: CompleteRequest,
    auth_user_id: str = Depends(get_current_user),
    service: DailyService = Depends(get_daily_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    try:
        result = await service.complete_challenge(
            challenge_id=req.challenge_id, 
            user_id=req.user_id,
            answers=req.answers,
            code=req.code,
            theory=req.theory
        )
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/challenge/{user_id}")
async def get_todays_challenge(
    user_id: str, 
    roadmap_id: str, 
    skill: str,
    auth_user_id: str = Depends(get_current_user),
    service: DailyService = Depends(get_daily_service)
):
    if user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    try:
        challenge = await service.get_or_generate_daily_challenge(user_id, roadmap_id, skill)
        return {"success": True, "challenge": challenge}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/notifications/{user_id}")
async def notifications(
    user_id: str,
    auth_user_id: str = Depends(get_current_user),
    service: DailyService = Depends(get_daily_service)
):
    if user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    try:
        notifs = await service.get_notifications(user_id)
        unread = await service.get_unread_count(user_id)
        return {"notifications": notifs, "count": unread}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/notifications/read")
async def mark_read(
    req: MarkReadRequest,
    auth_user_id: str = Depends(get_current_user),
    service: DailyService = Depends(get_daily_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    try:
        count = await service.mark_read(req.user_id, req.notification_ids)
        return {"success": True, "marked_read": count}
    except Exception as e:
        raise HTTPException(500, str(e))
"""Client-side event tracking route."""
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.core.auth import get_current_user
from app.core.database import get_supabase
from app.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])


class TrackRequest(BaseModel):
    event_type: str
    user_id:    str | None = None
    event_data: dict | None = None
    page:       str | None = None
    session_id: str | None = None

def get_analytics_service(supabase: Client = Depends(get_supabase)) -> AnalyticsService:
    return AnalyticsService(supabase)

@router.post("/track")
async def track(
    req: TrackRequest, 
    bg: BackgroundTasks,
    auth_user_id: str = Depends(get_current_user),
    service: AnalyticsService = Depends(get_analytics_service)
):
    if getattr(req, 'user_id', None) and req.user_id != auth_user_id: raise HTTPException(status_code=403, detail="Not authorized")
    """Fire-and-forget — always returns immediately, never blocks client."""
    bg.add_task(
        service.track_event,
        req.event_type,
        req.user_id,
        req.event_data,
        req.page,
        req.session_id,
    )
    return {"ok": True}
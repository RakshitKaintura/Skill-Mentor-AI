"""Client-side event tracking route."""
import logging
from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional
from supabase import Client

from app.core.database import get_supabase
from app.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])


class TrackRequest(BaseModel):
    event_type: str
    user_id:    Optional[str] = None
    event_data: Optional[dict] = None
    page:       Optional[str] = None
    session_id: Optional[str] = None

def get_analytics_service(supabase: Client = Depends(get_supabase)) -> AnalyticsService:
    return AnalyticsService(supabase)

@router.post("/track")
async def track(
    req: TrackRequest, 
    bg: BackgroundTasks,
    service: AnalyticsService = Depends(get_analytics_service)
):
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
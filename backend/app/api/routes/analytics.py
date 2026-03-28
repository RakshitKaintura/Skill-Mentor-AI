"""Client-side event tracking route."""
import logging
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

from app.services.analytics_service import track_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])


class TrackRequest(BaseModel):
    event_type: str
    user_id:    Optional[str] = None
    event_data: Optional[dict] = None
    page:       Optional[str] = None
    session_id: Optional[str] = None


@router.post("/track")
async def track(req: TrackRequest, bg: BackgroundTasks):
    """Fire-and-forget — always returns immediately, never blocks client."""
    bg.add_task(
        track_event,
        req.event_type,
        req.user_id,
        req.event_data,
        req.page,
        req.session_id,
    )
    return {"ok": True}
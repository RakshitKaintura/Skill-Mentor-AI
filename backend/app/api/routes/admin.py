"""Admin analytics routes — platform insights."""
import logging
from fastapi import APIRouter, HTTPException, Header
from typing import Optional

from app.core.config import get_settings
from app.services.analytics_service import (
    get_platform_stats,
    get_daily_active_users,
    get_skill_distribution,
    get_completion_funnel,
    get_top_events,
    get_revenue_proxy,
)

logger   = logging.getLogger(__name__)
router   = APIRouter(prefix="/admin", tags=["admin"])
settings = get_settings()
ADMIN_KEY = settings.admin_api_key


def _auth(key: Optional[str]) -> None:
    if key != ADMIN_KEY:
        raise HTTPException(401, "Unauthorized — invalid admin key")


@router.get("/stats")
async def all_stats(x_admin_key: Optional[str] = Header(default=None)):
    _auth(x_admin_key)
    stats      = await get_platform_stats()
    funnel     = await get_completion_funnel()
    skills     = await get_skill_distribution()
    engagement = await get_daily_active_users(days=7)
    top_events = await get_top_events()
    xp_proxy   = await get_revenue_proxy()
    return {
        "stats":      stats,
        "funnel":     funnel,
        "skills":     skills,
        "engagement": engagement,
        "top_events": top_events,
        "xp_proxy":   xp_proxy,
    }


@router.get("/engagement")
async def engagement(days: int = 7, x_admin_key: Optional[str] = Header(default=None)):
    _auth(x_admin_key)
    return {"engagement": await get_daily_active_users(days)}


@router.get("/funnel")
async def funnel(x_admin_key: Optional[str] = Header(default=None)):
    _auth(x_admin_key)
    return {"funnel": await get_completion_funnel()}


@router.get("/skills")
async def skills(x_admin_key: Optional[str] = Header(default=None)):
    _auth(x_admin_key)
    return {"skills": await get_skill_distribution()}
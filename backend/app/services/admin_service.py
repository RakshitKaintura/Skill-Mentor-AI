import logging
from typing import Optional
from fastapi import HTTPException
from supabase import Client

from app.core.config import get_settings
from app.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

class AdminService:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.analytics = AnalyticsService(supabase)
        self.admin_key = get_settings().admin_api_key

    def verify_admin(self, key: Optional[str]) -> None:
        if key != self.admin_key:
            raise HTTPException(401, "Unauthorized — invalid admin key")

    async def get_all_stats(self) -> dict:
        return {
            "stats":      await self.analytics.get_platform_stats(),
            "funnel":     await self.analytics.get_completion_funnel(),
            "skills":     await self.analytics.get_skill_distribution(),
            "engagement": await self.analytics.get_daily_active_users(days=7),
            "top_events": await self.analytics.get_top_events(),
            "xp_proxy":   await self.analytics.get_revenue_proxy(),
        }

    async def get_engagement(self, days: int) -> list:
        return await self.analytics.get_daily_active_users(days)

    async def get_funnel(self) -> dict:
        return await self.analytics.get_completion_funnel()

    async def get_skills(self) -> list:
        return await self.analytics.get_skill_distribution()

import logging

from app.agents.daily_challenge_agent import (
    complete_daily_challenge,
    get_or_generate_daily_challenge,
)
from app.services.notification_service import (
    get_notifications,
    get_unread_count,
    mark_notifications_read,
)

logger = logging.getLogger(__name__)

class DailyService:
    async def get_or_generate_daily_challenge(self, user_id: str, roadmap_id: str, skill: str) -> dict:
        return await get_or_generate_daily_challenge(user_id, roadmap_id, skill)

    async def complete_challenge(self, challenge_id: str, user_id: str, answers: dict | None, code: str | None, theory: str | None) -> dict:
        return await complete_daily_challenge(
            challenge_id, 
            user_id,
            submission={"answers": answers, "code": code, "theory": theory}
        )

    async def get_notifications(self, user_id: str) -> list:
        return await get_notifications(user_id)
        
    async def get_unread_count(self, user_id: str) -> int:
        return await get_unread_count(user_id)
        
    async def mark_read(self, user_id: str, notification_ids: list[str] | None) -> int:
        return await mark_notifications_read(user_id, notification_ids)

"""
Analytics Service — tracks platform events and generates
admin-level insights on user engagement and learning outcomes.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from collections import defaultdict, Counter

from supabase import Client
from postgrest.types import CountMethod

logger = logging.getLogger(__name__)

class AnalyticsService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    async def track_event(
        self,
        event_type:  str,
        user_id:     Optional[str] = None,
        event_data:  Optional[dict] = None,
        page:        Optional[str] = None,
        session_id:  Optional[str] = None,
    ) -> None:
        """Log a platform event. Fire-and-forget — never blocks the main flow."""
        try:
            self.supabase.table("analytics_events").insert({
                "user_id":    user_id,
                "event_type": event_type,
                "event_data": event_data or {},
                "page":       page,
                "session_id": session_id,
            }).execute()
        except Exception as e:
            logger.debug(f"Analytics track failed (non-critical): {e}")

    async def get_platform_stats(self) -> dict:
        """Return platform-wide aggregate stats from the view."""
        try:
            result = self.supabase.table("platform_stats").select("*").single().execute()
            return result.data or {} # type: ignore
        except Exception as e:
            logger.error(f"Platform stats error: {e}")
            return {}

    async def get_daily_active_users(self, days: int = 7) -> list:
        """Daily active users for the last N days."""
        try:
            since  = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            result = self.supabase.table("analytics_events") \
                .select("user_id, created_at") \
                .gte("created_at", since).execute()

            daily: dict = defaultdict(set)
            data: list[dict] = result.data or [] # type: ignore
            for event in data:
                day = event["created_at"][:10]
                if event["user_id"]:
                    daily[day].add(event["user_id"])

            return [
                {"date": d, "active_users": len(users)}
                for d, users in sorted(daily.items())
            ]
        except Exception as e:
            logger.error(f"DAU error: {e}")
            return []

    async def get_skill_distribution(self) -> list:
        """How many users are learning each skill."""
        try:
            result = self.supabase.table("roadmaps").select("skill").execute()
            data: list[dict] = result.data or [] # type: ignore
            counts = Counter(r["skill"] for r in data)
            return [{"skill": k, "count": v} for k, v in counts.most_common(10)]
        except Exception as e:
            logger.error(f"Skill dist error: {e}")
            return []

    async def get_completion_funnel(self) -> dict:
        """Funnel: registered → onboarded → lesson → quiz → project → certificate."""
        try:
            sb = self.supabase
            total    = sb.table("profiles").select("id", count=CountMethod.exact).execute().count or 0
            onboard  = sb.table("profiles").select("id", count=CountMethod.exact) \
                .eq("onboarding_completed", True).execute().count or 0
            lesson1  = sb.table("user_progress").select("user_id", count=CountMethod.exact) \
                .gte("lessons_completed", 1).execute().count or 0
            quiz1    = sb.table("user_progress").select("user_id", count=CountMethod.exact) \
                .gte("quizzes_completed", 1).execute().count or 0
            project1 = sb.table("projects").select("id", count=CountMethod.exact) \
                .eq("status", "reviewed").execute().count or 0
            certs    = sb.table("certificates").select("id", count=CountMethod.exact).execute().count or 0

            return {
                "registered":   total,
                "onboarded":    onboard,
                "lesson_done":  lesson1,
                "quiz_done":    quiz1,
                "project_done": project1,
                "certified":    certs,
            }
        except Exception as e:
            logger.error(f"Funnel error: {e}")
            return {}

    async def get_top_events(self, limit: int = 10) -> list:
        """Most frequent event types."""
        try:
            result = self.supabase.table("analytics_events").select("event_type").execute()
            data: list[dict] = result.data or [] # type: ignore
            counts = Counter(r["event_type"] for r in data)
            return [{"event": k, "count": v} for k, v in counts.most_common(limit)]
        except Exception as e:
            logger.error(f"Top events error: {e}")
            return []

    async def get_revenue_proxy(self) -> dict:
        """Proxy metrics: XP earned per day as engagement proxy."""
        try:
            since  = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            result = self.supabase.table("analytics_events") \
                .select("event_data, created_at") \
                .eq("event_type", "xp_earned") \
                .gte("created_at", since).execute()

            daily: dict = defaultdict(int)
            data: list[dict] = result.data or [] # type: ignore
            for ev in data:
                day = ev["created_at"][:10]
                daily[day] += (ev.get("event_data") or {}).get("xp", 0)

            return {"daily_xp": [{"date": d, "xp": v} for d, v in sorted(daily.items())]}
        except Exception as e:
            logger.error(f"Revenue proxy error: {e}")
            return {}
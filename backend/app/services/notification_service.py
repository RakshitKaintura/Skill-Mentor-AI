"""
Notification Service — creates in-app notifications for streaks,
achievements, reminders, and study buddy events.
"""
import logging
from datetime import datetime, timezone, timedelta
from app.core.database import get_supabase

logger = logging.getLogger(__name__)


async def create_notification(
    user_id: str,
    notif_type: str,
    title: str,
    message: str,
    action_url: str = "/dashboard",
) -> dict:
    supabase = get_supabase()
    row = supabase.table("notifications").insert({
        "user_id":    user_id,
        "type":       notif_type,
        "title":      title,
        "message":    message,
        "action_url": action_url,
    }).execute()
    return row.data[0] if row.data else {}


async def get_unread_notifications(user_id: str, limit: int = 20) -> list:
    supabase = get_supabase()
    result = supabase.table("notifications").select("*") \
        .eq("user_id", user_id).eq("read", False) \
        .order("created_at", desc=True).limit(limit).execute()
    return result.data or []


async def get_notifications(user_id: str, limit: int = 20) -> list:
    supabase = get_supabase()
    result = supabase.table("notifications").select("*") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True).limit(limit).execute()
    return result.data or []


async def get_unread_count(user_id: str) -> int:
    supabase = get_supabase()
    result = supabase.table("notifications").select("id") \
        .eq("user_id", user_id).eq("read", False) \
        .limit(200).execute()
    return len(result.data or [])


async def mark_notifications_read(user_id: str, notification_ids: list[str] | None = None) -> int:
    supabase = get_supabase()
    q = supabase.table("notifications").update({"read": True}).eq("user_id", user_id)
    if notification_ids:
        q = q.in_("id", notification_ids)
    result = q.execute()
    return len(result.data or [])


async def send_streak_reminder(user_id: str, streak: int) -> None:
    """Remind user to maintain streak if they haven't studied today."""
    supabase = get_supabase()
    # Check last activity
    prog = supabase.table("user_progress").select("last_active_date") \
        .eq("user_id", user_id).single().execute()
    if not prog.data:
        return
    last = prog.data.get("last_active_date")
    if not last:
        return
    # If last active was yesterday, send reminder
    last_date = datetime.fromisoformat(last).date() if isinstance(last, str) else last
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date()
    if last_date == yesterday:
        await create_notification(
            user_id, "reminder",
            f"Keep your {streak}🔥 streak alive!",
            "You haven't studied today yet. Just 15 minutes keeps your streak going!",
            "/lesson/current",
        )


async def send_achievement_notification(
    user_id: str,
    achievement_name: str,
    xp_awarded: int,
) -> None:
    await create_notification(
        user_id, "achievement",
        f"Achievement Unlocked: {achievement_name} 🏆",
        f"You earned the '{achievement_name}' badge and +{xp_awarded} XP!",
        "/achievements",
    )
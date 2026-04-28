"""
Notification Service — extended with:
  - Streak-protection reminders (triggered when last_active was yesterday)
  - Focus session completion XP notifications
  - Optimal study time nudges based on historical lesson timestamps
"""
import logging
from datetime import datetime, timezone, timedelta
from collections import Counter
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
    prog = supabase.table("user_progress").select("last_active_date") \
        .eq("user_id", user_id).single().execute()
    if not prog.data:
        return
    last = prog.data.get("last_active_date")
    if not last:
        return
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


# ── NEW: Streak-protection reminder ──────────────────────────

async def send_streak_protection_reminder(user_id: str) -> None:
    """
    Send an urgent streak-protection notification when the user has a
    streak ≥ 3 days and hasn't studied today.
    Called by a background scheduler or the /api/daily endpoint.
    """
    supabase = get_supabase()
    try:
        prog = supabase.table("user_progress") \
            .select("streak_days, last_active_date, xp_points") \
            .eq("user_id", user_id).single().execute()
        if not prog.data:
            return

        streak   = prog.data.get("streak_days", 0)
        last_raw = prog.data.get("last_active_date")
        if not last_raw or streak < 3:
            return

        last_date = datetime.fromisoformat(str(last_raw)).date()
        today     = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)

        # Only fire if last active was yesterday (not today, not earlier)
        if last_date != yesterday:
            return

        # Avoid duplicate: don't send if a reminder was sent in the last 12 hours
        recent = supabase.table("notifications") \
            .select("id") \
            .eq("user_id", user_id) \
            .eq("type", "streak") \
            .gte("created_at", (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat()) \
            .execute()
        if recent.data:
            return

        urgency = "⚠️" if streak >= 7 else "🔥"
        await create_notification(
            user_id,
            "streak",
            f"{urgency} Don't lose your {streak}-day streak!",
            (
                f"You're just one study session away from extending your "
                f"{streak}-day streak. Open a lesson now — even 10 minutes counts!"
            ),
            "/lesson/current",
        )
        logger.info("Streak-protection reminder sent to user %s (streak=%d)", user_id, streak)

    except Exception as exc:
        logger.error("send_streak_protection_reminder failed for %s: %s", user_id, exc)


# ── NEW: Focus session XP notification ───────────────────────

async def send_focus_session_xp(user_id: str, session_number: int, xp_earned: int) -> None:
    """
    In-app notification fired after each Pomodoro focus session completes.
    The frontend calls POST /api/notifications/focus-complete to trigger this.
    """
    try:
        is_milestone = session_number % 4 == 0  # every 4 sessions
        title = (
            f"🏅 {session_number} focus sessions today!"
            if is_milestone
            else f"🎯 Focus session #{session_number} complete!"
        )
        message = (
            f"Incredible focus! {session_number} sessions done today — +{xp_earned} XP total. "
            f"You're in the top 10% of learners!"
            if is_milestone
            else f"+{xp_earned} XP earned. Take a short break, then keep going!"
        )
        await create_notification(
            user_id, "achievement",
            title, message,
            "/progress",
        )
    except Exception as exc:
        logger.error("send_focus_session_xp failed for %s: %s", user_id, exc)


# ── NEW: Optimal study time nudge ────────────────────────────

async def send_optimal_study_time_nudge(user_id: str) -> None:
    """
    Analyses the user's lesson history to find their most productive hour
    and sends a nudge notification at that time.

    Best called once/day from a scheduler when the user's optimal hour arrives.
    """
    supabase = get_supabase()
    try:
        # Pull last 30 lesson timestamps
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        lessons = supabase.table("lessons") \
            .select("created_at") \
            .eq("user_id", user_id) \
            .eq("completed", True) \
            .gte("created_at", thirty_days_ago) \
            .execute()

        rows = lessons.data or []
        if len(rows) < 5:
            return  # Not enough data

        # Count completed lessons per hour-of-day
        hour_counts: Counter = Counter()
        for row in rows:
            try:
                dt = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
                hour_counts[dt.hour] += 1
            except Exception:
                continue

        if not hour_counts:
            return

        peak_hour, peak_count = hour_counts.most_common(1)[0]
        now_hour = datetime.now(timezone.utc).hour

        # Only send if we're within 1 hour of the user's peak
        if abs(now_hour - peak_hour) > 1:
            return

        # Format hour label
        am_pm  = "AM" if peak_hour < 12 else "PM"
        hour12 = peak_hour % 12 or 12
        label  = f"{hour12}:00 {am_pm}"

        await create_notification(
            user_id,
            "reminder",
            f"⏰ Your peak study time is now! ({label})",
            (
                f"Based on your history, {label} is when you do your best work. "
                f"You've completed {peak_count} lessons at this time. Open a lesson now!"
            ),
            "/lesson/current",
        )
        logger.info(
            "Optimal-time nudge sent to user %s (peak_hour=%d, count=%d)",
            user_id, peak_hour, peak_count,
        )

    except Exception as exc:
        logger.error("send_optimal_study_time_nudge failed for %s: %s", user_id, exc)
"""
Daily Challenge Agent — generates a fresh personalized daily challenge
based on student's current topic, weak areas, and learning streak.
"""
import json
import logging
from datetime import date
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.gemini   import get_gemini_model
from app.core.database import get_supabase

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a daily challenge generator for SkillMentor AI.
Create short, focused challenges that take 5-15 minutes.
Rotate types: quiz, code snippet, theory explanation, concept review.
Always output valid JSON only."""


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=4))
async def get_or_generate_daily_challenge(
    user_id: str,
    roadmap_id: str,
    skill: str,
) -> dict:
    """Return today's challenge, generating it if not yet created."""
    supabase = get_supabase()
    today    = date.today().isoformat()

    # Check if already generated today
    existing = supabase.table("daily_challenges").select("*") \
        .eq("user_id", user_id).eq("challenge_date", today).execute()
    if existing.data and existing.data[0].get("title") != "Generating...":
        challenge = dict(existing.data[0])
        challenge["challenge_id"] = challenge.get("id")
        return challenge

    # Gather context
    roadmap  = supabase.table("roadmaps").select("current_topic, level, current_week") \
        .eq("id", roadmap_id).single().execute()
    progress = supabase.table("user_progress").select("weak_topics, streak_days, xp_points") \
        .eq("user_id", user_id).single().execute()

    topic   = roadmap.data.get("current_topic", skill) if roadmap.data else skill
    level   = roadmap.data.get("level", "beginner")    if roadmap.data else "beginner"
    week    = roadmap.data.get("current_week", 1)      if roadmap.data else 1
    weak    = (progress.data or {}).get("weak_topics", [])
    streak  = (progress.data or {}).get("streak_days", 0)

    # Pick challenge type based on day of week (variety)
    day_num = date.today().weekday()  # 0=Mon … 6=Sun
    types   = ["quiz", "code", "theory", "review", "quiz", "code", "theory"]
    ch_type = types[day_num]

    model = get_gemini_model(SYSTEM_PROMPT)

    prompt = f"""Generate a daily {ch_type} challenge for a {level} student.

Skill: {skill}
Current topic: {topic}
Week: {week}
Streak: {streak} days
Weak topics (focus here if possible): {weak or ['none identified']}
Challenge type today: {ch_type}

Challenge requirements:
- Title: Short, motivating (e.g. "Daily Quiz: Closures ⚡")
- Completion time: 5-15 minutes
- Difficulty: appropriate for {level} level
- XP reward: 25-75 based on difficulty

For type "quiz":
  content has: questions (3 MCQs same format as quiz agent)

For type "code":
  content has: title, task_description, starter_code, expected_output, hint

For type "theory":
  content has: topic, explain_prompt (ask student to explain a concept in their own words), rubric

For type "review":
  content has: topics_to_review (list), questions (3 short review questions)

Return ONLY this JSON:
{{
  "title": "Daily Challenge: {topic} ⚡",
  "description": "Short motivating description of what they'll practice today",
  "type": "{ch_type}",
  "xp_reward": 50,
  "estimated_minutes": 10,
  "content": {{}}
}}"""

    resp = model.generate_content(prompt)
    raw = resp.text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    challenge_data = json.loads(raw.strip())

    # Upsert into DB
    upsert_data = {
        "user_id":    user_id,
        "roadmap_id": roadmap_id,
        "skill":      skill,
        "challenge_date": today,
        "title":      challenge_data["title"],
        "description": challenge_data["description"],
        "type":       challenge_data["type"],
        "content":    challenge_data["content"],
        "xp_awarded": 0,
    }

    if existing.data:
        supabase.table("daily_challenges").update(upsert_data).eq("id", existing.data[0]["id"]).execute()
        challenge_data["challenge_id"] = existing.data[0]["id"]
    else:
        row = supabase.table("daily_challenges").insert(upsert_data).execute()
        challenge_data["challenge_id"] = row.data[0]["id"]

    return challenge_data


async def complete_daily_challenge(
    challenge_id: str,
    user_id: str,
) -> dict:
    """Mark daily challenge as complete and award XP."""
    supabase = get_supabase()
    ch = supabase.table("daily_challenges").select("xp_awarded, completed") \
        .eq("id", challenge_id).single().execute()
    if not ch.data or ch.data.get("completed"):
        return {"already_completed": True}

    # Award XP
    xp = ch.data.get("xp_awarded", 50) or 50
    # Get the challenge content to determine XP
    full_ch = supabase.table("daily_challenges").select("content").eq("id", challenge_id).single().execute()
    if full_ch.data:
        xp_reward = full_ch.data.get("content", {}).get("xp_reward", 50) if isinstance(full_ch.data.get("content"), dict) else 50
        xp = xp_reward

    from datetime import datetime, timezone
    supabase.table("daily_challenges").update({
        "completed":    True,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "xp_awarded":   xp,
    }).eq("id", challenge_id).execute()

    supabase.rpc("increment_xp", {"p_user_id": user_id, "p_amount": xp}).execute()

    # Create notification
    supabase.table("notifications").insert({
        "user_id": user_id,
        "type":    "challenge",
        "title":   "Daily Challenge Complete! 🎯",
        "message": f"You earned {xp} XP for today's challenge. Keep the streak alive!",
        "action_url": "/dashboard",
    }).execute()

    return {"completed": True, "xp_awarded": xp}

import json
import logging
from datetime import date

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.database import get_supabase
from app.core.gemini import get_gemini_model

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
    
    existing_data = existing.data
    if existing_data and isinstance(existing_data, list) and len(existing_data) > 0 and isinstance(existing_data[0], dict):
        if existing_data[0].get("title") != "Generating...":
            challenge = dict(existing_data[0])
            challenge["challenge_id"] = challenge.get("id")
            return challenge

    # Gather context
    roadmap  = supabase.table("roadmaps").select("current_topic, level, current_week") \
        .eq("id", roadmap_id).single().execute()
    progress = supabase.table("user_progress").select("weak_topics, streak_days, xp_points") \
        .eq("user_id", user_id).single().execute()

    r_data = roadmap.data if isinstance(roadmap.data, dict) else {}
    p_data = progress.data if isinstance(progress.data, dict) else {}

    topic   = r_data.get("current_topic", skill) if r_data else skill
    level   = r_data.get("level", "beginner")    if r_data else "beginner"
    week    = r_data.get("current_week", 1)      if r_data else 1
    weak    = p_data.get("weak_topics", [])
    streak  = p_data.get("streak_days", 0)

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
    raw = (resp.text or "").strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        raw = raw.removeprefix("json")
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

    if existing_data and isinstance(existing_data, list) and len(existing_data) > 0 and isinstance(existing_data[0], dict):
        challenge_id = str(existing_data[0].get("id", ""))
        supabase.table("daily_challenges").update(upsert_data).eq("id", challenge_id).execute()
        challenge_data["challenge_id"] = challenge_id
    else:
        row = supabase.table("daily_challenges").insert(upsert_data).execute()
        row_data = row.data
        if row_data and isinstance(row_data, list) and len(row_data) > 0 and isinstance(row_data[0], dict):
            challenge_data["challenge_id"] = str(row_data[0].get("id", ""))

    return challenge_data


async def complete_daily_challenge(
    challenge_id: str,
    user_id: str,
    submission: dict | None = None
) -> dict:
    """Mark daily challenge as complete and award XP, after validating submission."""
    supabase = get_supabase()
    ch = supabase.table("daily_challenges").select("xp_awarded, completed, type, content") \
        .eq("id", challenge_id).eq("user_id", user_id).single().execute()
    
    ch_data = ch.data if isinstance(ch.data, dict) else {}
    if not ch_data or ch_data.get("completed"):
        return {"already_completed": True}

    challenge_type = ch_data.get("type")
    content = ch_data.get("content", {})
    xp = ch_data.get("xp_awarded", 50) or 50
    if isinstance(content, dict):
        xp = content.get("xp_reward", 50)

    # Validation Logic
    if submission:
        is_valid = True
        feedback = ""

        if challenge_type == "quiz":
            # For quiz, we check if all questions have an answer (basic validation)
            # A strict validation would check against the correct answer, but our DB schema 
            # currently doesn't store the correct answer explicitly in 'content.questions'. 
            # We will use Gemini to grade it based on the questions.
            model = get_gemini_model("You are a helpful tutor grading a quiz. Grade with MEDIUM strictness. Return JSON with 'pass' (boolean) and 'feedback' (string).")
            prompt = f"Quiz Questions: {json.dumps(content.get('questions', []))}\nUser Answers: {json.dumps(submission.get('answers', {}))}\nGrade this submission."
            resp = model.generate_content(prompt)
            try:
                raw = (resp.text or "").strip()
                if raw.startswith("```"): raw = raw.split("```")[1]
                raw = raw.removeprefix("json")
                res = json.loads(raw.strip())
                is_valid = res.get("pass", False)
                feedback = res.get("feedback", "Your answer was incorrect.")
            except Exception as e:
                logger.error(f"Failed to grade quiz: {e}")
                is_valid = False
                feedback = "Could not validate your quiz answers."

        elif challenge_type == "code":
            user_code = submission.get("code", "")
            if not user_code or len(user_code.strip()) < 5:
                is_valid = False
                feedback = "Please write a valid code solution."
            else:
                model = get_gemini_model("You are a senior developer grading a coding challenge. Grade with MEDIUM strictness. The code should generally solve the problem, even if it's not perfect. Check for glaring errors. Return JSON with 'pass' (boolean) and 'feedback' (string).")
                prompt = f"Task: {content.get('task_description')}\nUser Code:\n{user_code}\nDoes this code adequately solve the task?"
                resp = model.generate_content(prompt)
                try:
                    raw = (resp.text or "").strip()
                    if raw.startswith("```"): raw = raw.split("```")[1]
                    raw = raw.removeprefix("json")
                    res = json.loads(raw.strip())
                    is_valid = res.get("pass", False)
                    feedback = res.get("feedback", "Your code solution was incorrect.")
                except Exception as e:
                    logger.error(f"Failed to grade code: {e}")
                    is_valid = False
                    feedback = "Could not validate your code."

        elif challenge_type == "theory" or challenge_type == "review":
            user_text = submission.get("theory") or json.dumps(submission.get("answers", {}))
            if not user_text or len(user_text.strip()) < 10:
                is_valid = False
                feedback = "Please provide a more detailed explanation."
            else:
                model = get_gemini_model("You are a strict but fair tutor grading a theory explanation. Grade with MEDIUM strictness. The student should show basic understanding. Return JSON with 'pass' (boolean) and 'feedback' (string).")
                prompt = f"Topic/Prompt: {content.get('explain_prompt') or content.get('topics_to_review')}\nUser Explanation:\n{user_text}\nIs this explanation acceptable?"
                resp = model.generate_content(prompt)
                try:
                    raw = (resp.text or "").strip()
                    if raw.startswith("```"): raw = raw.split("```")[1]
                    raw = raw.removeprefix("json")
                    res = json.loads(raw.strip())
                    is_valid = res.get("pass", False)
                    feedback = res.get("feedback", "Your explanation was inadequate.")
                except Exception as e:
                    logger.error(f"Failed to grade theory: {e}")
                    is_valid = False
                    feedback = "Could not validate your explanation."

        if not is_valid:
            return {"completed": False, "feedback": feedback}

    from datetime import datetime, timezone
    supabase.table("daily_challenges").update({
        "completed":    True,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "xp_awarded":   xp,
    }).eq("id", challenge_id).eq("user_id", user_id).execute()

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
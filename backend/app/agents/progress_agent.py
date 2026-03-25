"""
Agent 6 — Progress Tracker
Analyzes multi-dimensional student performance and generates weekly AI report cards.
"""
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

from tenacity import retry, stop_after_attempt, wait_exponential
from google.genai import types

from app.core.gemini import get_gemini_client  # Standardized Client pattern
from app.core.config import get_settings
from app.core.database import get_supabase
from app.services.notes_service import generate_report_pdf

logger = logging.getLogger(__name__)
settings = get_settings()

SYSTEM_PROMPT = """You are the Senior Academic Advisor for SkillMentor AI.
Your goal is to provide data-driven, actionable feedback that balances 
academic rigor with psychological encouragement.

CORE DIRECTIVES:
1. OUTPUT: Return ONLY a valid JSON object. Do not include markdown or explanations.
2. TONE: Use an 'Honest Coach' persona—celebrate wins, but don't shy away from identifying gaps.
3. SPECIFICITY: Every recommendation must be a concrete task based on the student's actual performance data."""


def update_topic_mastery(user_id: str, topic: str, skill: str, score_pct: float) -> None:
    """
    Background updater for user topic mastery after quiz submission.
    Keeps `user_progress.topic_mastery`, `weak_topics`, and `strong_topics` in sync.
    """
    try:
        supabase = get_supabase()

        score = max(0.0, min(100.0, float(score_pct)))
        progress_res = (
            supabase.table("user_progress")
            .select("topic_mastery, quizzes_completed")
            .eq("user_id", user_id)
            .single()
            .execute()
        )

        progress_row = progress_res.data or {}
        mastery = progress_row.get("topic_mastery") or {}
        if not isinstance(mastery, dict):
            mastery = {}

        prev_score_raw = mastery.get(topic)
        prev_score = float(prev_score_raw) if isinstance(prev_score_raw, (int, float)) else None

        # Exponential smoothing to avoid large mastery swings from one attempt.
        blended = score if prev_score is None else ((prev_score * 0.7) + (score * 0.3))
        mastery[topic] = round(blended, 1)

        weak_topics = [k for k, v in mastery.items() if isinstance(v, (int, float)) and v < 65]
        strong_topics = [k for k, v in mastery.items() if isinstance(v, (int, float)) and v >= 85]

        quizzes_completed = int(progress_row.get("quizzes_completed") or 0) + 1

        payload = {
            "topic_mastery": mastery,
            "weak_topics": weak_topics,
            "strong_topics": strong_topics,
            "quizzes_completed": quizzes_completed,
        }

        if progress_res.data:
            supabase.table("user_progress").update(payload).eq("user_id", user_id).execute()
        else:
            payload.update({"user_id": user_id})
            supabase.table("user_progress").insert(payload).execute()

    except Exception as e:
        logger.warning("Failed to update topic mastery for user %s (%s/%s): %s", user_id, topic, skill, e)


async def get_due_reviews(user_id: str) -> List[Dict[str, Any]]:
    """
    Fetch topics due for spaced repetition review.
    Uses DB RPC when available, with a table-query fallback.
    """
    supabase = get_supabase()

    try:
        rpc_res = supabase.rpc("get_due_reviews", {"p_user_id": user_id}).execute()
        if rpc_res.data is not None:
            return rpc_res.data
    except Exception as rpc_err:
        logger.info("get_due_reviews RPC unavailable; falling back to table query: %s", rpc_err)

    fallback = (
        supabase.table("spaced_repetition")
        .select("topic, skill, interval_days, repetitions")
        .eq("user_id", user_id)
        .lte("next_review_at", datetime.now(timezone.utc).isoformat())
        .order("next_review_at")
        .limit(10)
        .execute()
    )

    return fallback.data or []

@retry(
    stop=stop_after_attempt(3), 
    wait=wait_exponential(min=1, max=4),
    reraise=True
)
async def generate_report_card(
    user_id: str,
    roadmap_id: str,
    week_number: int,
) -> Dict[str, Any]:
    """
    Analyzes weekly performance metrics and generates a personalized AI report card.
    """
    supabase = get_supabase()
    client = get_gemini_client()
    
    # Calculate the lookback window (Last 7 days)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    # 1. Data Aggregation (Multi-source Fetching)
    roadmap = supabase.table("roadmaps").select("skill, current_topic") \
        .eq("id", roadmap_id).single().execute()

    # Fetch weekly engagement across all learning activities
    lessons = supabase.table("lessons").select("completed") \
        .eq("user_id", user_id).eq("roadmap_id", roadmap_id) \
        .gte("created_at", week_ago).execute()

    quizzes = supabase.table("quizzes").select("*") \
        .eq("user_id", user_id).eq("roadmap_id", roadmap_id) \
        .eq("completed", True).gte("created_at", week_ago).execute()

    challenges = supabase.table("code_challenges").select("passed") \
        .eq("user_id", user_id).eq("roadmap_id", roadmap_id) \
        .gte("created_at", week_ago).execute()

    progress = supabase.table("user_progress").select("*") \
        .eq("user_id", user_id).single().execute()

    # 2. Metric Calculation Logic
    lessons_done = sum(1 for l in (lessons.data or []) if l.get("completed"))
    quizzes_done = len(quizzes.data or [])
    challenges_done = sum(1 for c in (challenges.data or []) if c.get("passed"))
    
    avg_score = 0.0
    if quizzes.data:
        def _quiz_denominator(row: Dict[str, Any]) -> int:
            if isinstance(row.get("total_points"), int):
                return max(row["total_points"], 1)
            if isinstance(row.get("total_questions"), int):
                return max(row["total_questions"], 1)
            questions = row.get("questions")
            if isinstance(questions, list):
                points_from_questions = sum(
                    q.get("points", 10)
                    for q in questions
                    if isinstance(q, dict)
                )
                if points_from_questions > 0:
                    return points_from_questions
                return max(len(questions), 1)
            return 1

        def _quiz_percentage(row: Dict[str, Any]) -> float:
            try:
                score = float(row.get("score") or 0)
            except Exception:
                score = 0.0
            pct = (score / _quiz_denominator(row)) * 100
            return max(0.0, min(pct, 100.0))

        avg_score = sum(_quiz_percentage(q) for q in quizzes.data) / quizzes_done

    # Extract behavioral metrics
    streak = progress.data.get("streak_days", 0) if progress.data else 0
    xp_total = progress.data.get("xp_points", 0) if progress.data else 0
    topic_mastery = progress.data.get("topic_mastery", {}) if progress.data else {}
    skill = roadmap.data.get("skill", "General") if roadmap.data else "General"

    # Identify mastery trends
    weak_topics = [t for t, v in topic_mastery.items() if isinstance(v, (int, float)) and v < 65]
    strong_topics = [t for t, v in topic_mastery.items() if isinstance(v, (int, float)) and v >= 85]

    # 3. LLM Synthesis with Gemini 2.0 Flash
    prompt = f"""
    Analyze the following weekly performance data for the skill: {skill}
    
    METRICS (Week {week_number}):
    - Lessons Completed: {lessons_done}
    - Quizzes Attempted: {quizzes_done} (Avg Score: {avg_score:.1f}%)
    - Coding Challenges Passed: {challenges_done}
    - Learning Streak: {streak} days
    - Identified Weak Areas: {weak_topics or 'No significant gaps'}
    - Identified Strengths: {strong_topics or 'Developing foundations'}

    TASK: Generate a comprehensive weekly summary in the following JSON format:
    {{
      "overall_grade": "A/B/C/D/F",
      "grade_reasoning": "Data-driven justification for the grade",
      "summary": "2-3 sentence performance narrative",
      "strengths": ["Achievement 1", "Achievement 2"],
      "weaknesses": ["Gap 1", "Gap 2"],
      "recommendations": ["Task 1", "Task 2", "Task 3"],
      "motivational_message": "A supportive closing sentence",
      "next_week_focus": "The #1 priority for the upcoming week"
    }}
    """

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type='application/json'
        )
    )

    try:
        report_data = json.loads(response.text)
    except Exception as e:
        logger.error(f"Report Generation Error: {e}")
        raise ValueError("AI failed to generate a valid report card structure.")

    # 4. PDF Generation & Cloud Persistence
    pdf_url = await generate_report_pdf(
        user_id=user_id,
        week_number=week_number,
        skill=skill,
        report=report_data,
        stats={
            "lessons_done": lessons_done,
            "quizzes_done": quizzes_done,
            "challenges_done": challenges_done,
            "avg_score": avg_score,
            "streak": streak,
            "xp_total": xp_total
        }
    )

    # 5. Database Synchronization
    # Updates report cards table and summarizes weak/strong topics for the UI
    supabase.table("report_cards").upsert({
        "user_id": user_id,
        "roadmap_id": roadmap_id,
        "week_number": week_number,
        "skill": skill,
        "summary": report_data["summary"],
        "strengths": report_data["strengths"],
        "weaknesses": report_data["weaknesses"],
        "recommendations": report_data["recommendations"],
        "lessons_completed": lessons_done,
        "quizzes_completed": quizzes_done,
        "challenges_completed": challenges_done,
        "avg_quiz_score": avg_score,
        "xp_earned": xp_total,
        "streak_days": streak,
        "overall_grade": report_data["overall_grade"],
        "pdf_url": pdf_url,
    }, on_conflict="user_id,roadmap_id,week_number").execute()

    supabase.table("user_progress").update({
        "weak_topics": weak_topics,
        "strong_topics": strong_topics
    }).eq("user_id", user_id).execute()

    # Append additional runtime metadata for the API response
    report_data.update({
        "week_number": week_number,
        "pdf_url": pdf_url,
        "lessons_done": lessons_done,
        "avg_score": round(avg_score, 1)
    })
    
    return report_data
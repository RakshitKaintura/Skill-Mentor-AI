"""
Agent 4 — Quiz & Examiner
Generates adaptive quizzes, evaluates answers, and provides pedagogical feedback.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from tenacity import retry, stop_after_attempt, wait_exponential
from google.genai import types

from app.core.gemini import get_gemini_client  # Standardized Client pattern
from app.core.config import get_settings
from app.core.database import get_supabase
from app.services.rag_service import retrieve_chunks, format_rag_context

logger = logging.getLogger(__name__)
settings = get_settings()


def _generate_with_model_failover(client, prompt: str, config):
    """Try configured model first, then fallback models on temporary provider failures."""
    models = [
        settings.gemini_model,
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
    ]

    last_err: Exception | None = None
    for model_name in models:
        try:
            return client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
        except Exception as e:
            last_err = e
            msg = str(e).lower()
            if any(token in msg for token in ["503", "unavailable", "high demand", "overloaded", "resource exhausted"]):
                logger.warning("Model %s unavailable, trying fallback model", model_name)
                continue
            raise

    raise RuntimeError(f"All quiz generation models unavailable: {last_err}")


SYSTEM_PROMPT = """You are the Senior Examiner for SkillMentor AI.
Your goal is to create high-fidelity, adaptive assessments that measure conceptual 
depth rather than rote memorization. 

INSTRUCTIONS:
1. OUTPUT: Return ONLY a valid JSON object. Do not include markdown or explanations.
2. TYPES: Mix Multiple Choice (MCQ), True/False, and Code Output Analysis.
3. ADAPTIVITY: Adjust question complexity based on the student's historical performance.
4. FEEDBACK: Each question must include a 'pedagogical_explanation' that clarifies 
   the logic behind the correct answer and why distractors are incorrect."""

@retry(
    stop=stop_after_attempt(3), 
    wait=wait_exponential(min=1, max=4),
    reraise=True
)
async def generate_quiz(
    user_id: str,
    roadmap_id: str,
    topic: str,
    skill: str,
    week_number: int,
    lesson_id: Optional[str] = None,
    difficulty: str = "beginner",
    num_questions: int = 5,
) -> Dict[str, Any]:
    """
    Generates a context-aware, adaptive quiz using RAG and student history.
    """
    supabase = get_supabase()
    client = get_gemini_client()

    # 1. Fetch RAG Context (Project specific materials)
    rag_chunks = await retrieve_chunks(
        query=f"Core concepts of {topic} in {skill}", 
        user_id=user_id,
        skill_tag=skill.lower(),
        top_k=4
    )
    rag_context = format_rag_context(rag_chunks)

    # 2. Adaptive Difficulty Logic
    # Fetches recent scores to determine if we should "level up" the student
    prev_results = supabase.table("quizzes") \
        .select("*") \
        .eq("user_id", user_id).eq("topic", topic) \
        .order("created_at", desc=True).limit(3).execute()

    history_context = ""
    if prev_results.data:
        def _quiz_denominator(row: Dict[str, Any]) -> int:
            if isinstance(row.get("total_questions"), int):
                return max(row["total_questions"], 1)
            if isinstance(row.get("total_points"), int):
                return max(row["total_points"], 1)
            questions = row.get("questions")
            if isinstance(questions, list):
                return max(len(questions), 1)
            return 1

        def _score_value(row: Dict[str, Any]) -> float:
            score = row.get("score")
            if isinstance(score, (int, float)):
                return float(score)
            return 0.0

        avg_score = sum((_score_value(row) / _quiz_denominator(row)) for row in prev_results.data) / len(prev_results.data)
        if avg_score > 0.85:
            history_context = "The student is excelling. Increase difficulty to include complex application scenarios."
        elif avg_score < 0.50:
            history_context = "The student is struggling. Focus on foundational definitions and simple analogies."

    # 3. LLM Generation with Native JSON Mode
    prompt = f"""
    Create a {num_questions}-question quiz for {skill}.
    TOPIC: {topic}
    LEVEL: {difficulty}
    WEEK: {week_number}
    
    [ADAPTIVE DATA]
    {history_context}

    [DOCUMENTATION CONTEXT]
    {rag_context}

    JSON STRUCTURE REQUIRED:
    {{
      "topic": "{topic}",
      "difficulty": "{difficulty}",
      "questions": [
        {{
          "id": 1,
          "type": "mcq",
          "question": "Clear, concise question text",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_answer": "Option A",
          "explanation": "Why this is correct...",
          "difficulty": "medium",
          "points": 10
        }}
      ],
      "total_points": 50,
      "time_limit_secs": 300
    }}
    """

    response = _generate_with_model_failover(
        client,
        prompt,
        types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type='application/json'
        ),
    )

    try:
        quiz_data = json.loads(response.text)
    except Exception as e:
        logger.error(f"Quiz JSON Parse Error: {e}")
        raise ValueError("AI failed to generate a valid quiz structure.")

    # 4. Save to Database
    db_entry = {
        "user_id": user_id,
        "roadmap_id": roadmap_id,
        "lesson_id": lesson_id,
        "topic": topic,
        "skill": skill,
        "week_number": week_number,
        "difficulty": difficulty,
        "questions": quiz_data["questions"],
        "time_limit_secs": quiz_data.get("time_limit_secs", 300),
        "completed": False
    }
    
    row = supabase.table("quizzes").insert(db_entry).execute()
    
    if not row.data:
        raise RuntimeError("Failed to persist quiz to database.")

    quiz_data["quiz_id"] = row.data[0]["id"]
    return quiz_data

async def evaluate_quiz(
    quiz_id: str,
    user_id: str,
    user_answers: List[Dict[str, Any]],
    time_taken: int,
) -> Dict[str, Any]:
    """
    Evaluates submissions, calculates XP, and triggers spaced repetition updates.
    """
    supabase = get_supabase()

    # 1. Retrieve Quiz Metadata
    quiz_row = supabase.table("quizzes").select("*").eq("id", quiz_id).single().execute()
    if not quiz_row.data:
        raise ValueError("Assessment record not found.")

    quiz_topic = quiz_row.data.get("topic") or "General"
    quiz_skill = quiz_row.data.get("skill") or "General"
    questions = quiz_row.data["questions"]
    results = []
    total_score = 0
    
    # 2. Grading Logic
    for q in questions:
        # Find user's answer for this specific question ID
        user_ans = next((a["answer"] for a in user_answers if str(a["question_id"]) == str(q["id"])), None)
        is_correct = (user_ans == q["correct_answer"]) if user_ans else False
        
        points = q.get("points", 10)
        points_earned = points if is_correct else 0
        total_score += points_earned

        results.append({
            "question_id": q["id"],
            "is_correct": is_correct,
            "user_answer": user_ans,
            "correct_answer": q["correct_answer"],
            "explanation": q.get("explanation", ""),
            "points_earned": points_earned
        })

    total_points = sum(q.get("points", 10) for q in questions)
    percentage = (total_score / max(total_points, 1)) * 100
    passed = percentage >= 70

    # 3. Personalized AI Feedback
    feedback = await _generate_quiz_feedback(
        topic=quiz_topic,
        skill=quiz_skill,
        percentage=percentage,
        wrong_answers=[r for r in results if not r["is_correct"]]
    )

    # 4. XP and Spaced Repetition Updates
    xp_earned = int((percentage / 100) * 100) + (25 if passed else 0)
    
    # Batch update for performance
    supabase.table("quizzes").update({
        "score": total_score,
        "results": {"details": results, "feedback": feedback},
        "time_taken_secs": time_taken,
        "completed": True,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "xp_awarded": xp_earned
    }).eq("id", quiz_id).execute()

    # Award XP and update progress via database functions
    supabase.rpc("increment_xp", {"p_user_id": user_id, "p_amount": xp_earned}).execute()
    
    # Quality for Spaced Repetition (Scale 0-5)
    quality = 5 if percentage >= 90 else 4 if percentage >= 75 else 3 if percentage >= 60 else 1
    supabase.rpc("update_spaced_repetition", {
        "p_user_id": user_id,
        "p_topic": quiz_topic,
        "p_skill": quiz_skill,
        "p_quality": quality
    }).execute()

    return {
        "percentage": round(percentage, 1),
        "passed": passed,
        "xp_earned": xp_earned,
        "feedback": feedback,
        "results": results
    }

async def _generate_quiz_feedback(topic: str, skill: str, percentage: float, wrong_answers: List) -> str:
    """Generates pedagogical encouragement using Gemini."""
    if percentage >= 95:
        return f"Exceptional mastery of {topic}! You've demonstrated a deep understanding of {skill} principles."

    client = get_gemini_client()
    wrong_summary = "\n".join([f"- {w['user_answer']} vs {w['correct_answer']}" for w in wrong_answers[:2]])

    prompt = f"""
    The student scored {percentage:.0f}% on {topic} ({skill}).
    Significant errors occurred in these areas:
    {wrong_summary}

    Provide a 2-sentence encouraging feedback note. 
    Focus on one specific area for improvement. Keep it professional and warm.
    """

    resp = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.7)
    )
    return resp.text.strip()
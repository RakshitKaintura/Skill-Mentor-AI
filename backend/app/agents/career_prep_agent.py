"""
Agent 8 — Career Prep Agent
Mock interviews, Resume/ATS optimization, and multi-metric Job Readiness Assessment.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from tenacity import retry, stop_after_attempt, wait_exponential
from google.genai import types

from app.core.gemini import get_gemini_client
from app.core.config import get_settings
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
settings = get_settings()

# Standard production thresholds.
PROJECT_BENCHMARK_THRESHOLD = 70
INTERVIEW_READINESS_THRESHOLD = 70
JOB_READY_THRESHOLD = 75

SYSTEM_PROMPT = """You are the Lead Career Coach at SkillMentor AI. 
Your goal is to bridge the gap between 'learning' and 'hiring'. 
You evaluate candidates with the same rigor as a FAANG engineering manager.

DIRECTIVES:
1. OUTPUT: Return ONLY valid JSON. No markdown.
2. FEEDBACK: Be ruthlessly honest. If an answer is weak, explain exactly why and 
   how to fix it. Don't inflate scores.
3. ATS OPTIMIZATION: Prioritize impact metrics, keywords, and technical depth."""

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=4), reraise=True)
async def generate_mock_interview(
    user_id: str,
    skill: str,
    level: str,
    roadmap_id: Optional[str] = None,
    company_target: Optional[str] = None,
    interview_type: str = "technical",
    num_questions: int = 8,
) -> Dict[str, Any]:
    """Generates an adaptive mock interview based on skill level and target company."""
    supabase = get_supabase()
    client = get_gemini_client()

    # Pull student's weak topics to ensure the interview is a true test of growth
    prog = supabase.table("user_progress").select("weak_topics") \
        .eq("user_id", user_id).single().execute()
    weak = prog.data.get("weak_topics", []) if prog.data else []

    prompt = f"""
    Generate a {num_questions}-question mock interview for a {level} {skill} role.
    TYPE: {interview_type}
    TARGET COMPANY: {company_target or 'General Tech'}
    STUDENT WEAK AREAS: {weak}

    JSON STRUCTURE:
    {{
      "title": "{skill} {interview_type.title()} Interview",
      "questions": [
        {{
          "id": 1,
          "type": "concept/coding/practical",
          "question": "...",
          "expected_key_points": ["Point 1", "Point 2"],
          "difficulty": "medium",
          "time_limit_mins": 5
        }}
      ]
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

    data = json.loads(response.text)
    
    # Persist the session
    db_row = supabase.table("interview_sessions").insert({
        "user_id": user_id,
        "roadmap_id": roadmap_id,
        "skill": skill,
        "level": level,
        "interview_type": interview_type,
        "company_target": company_target,
        "questions": data["questions"],
        "status": "active"
    }).execute()

    data["session_id"] = db_row.data[0]["id"]
    return data


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=4), reraise=True)
async def evaluate_interview_answer(
    question_text: str,
    answer: str,
    key_points: List[str],
    skill: str,
    level: str,
    question_id: int,
) -> Dict[str, Any]:
    """Evaluates a single interview answer and returns structured coaching feedback."""
    client = get_gemini_client()

    prompt = f"""
    Evaluate this interview answer for a {level} {skill} candidate.

    QUESTION:
    {question_text}

    CANDIDATE ANSWER:
    {answer[:5000]}

    KEY POINTS EXPECTED:
    {json.dumps(key_points)}

    Return JSON only:
    {{
      "score": 0-100,
      "verdict": "Excellent|Good|Needs Work|Poor",
      "what_was_good": "...",
      "what_was_missing": "...",
      "ideal_answer_summary": "..."
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

    data = json.loads(response.text)
    data["question_id"] = question_id
    return data


async def complete_interview_session(
    session_id: str,
    user_id: str,
    answers: List[Dict[str, Any]],
    evaluations: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Completes an interview session, persists summary, and awards XP."""
    supabase = get_supabase()

    if not evaluations:
        raise ValueError("No evaluations provided to complete interview.")

    scores = [float(e.get("score", 0)) for e in evaluations]
    overall_score = int(round(sum(scores) / len(scores)))
    job_ready = overall_score >= 75

    strengths = [e.get("what_was_good") for e in evaluations if e.get("score", 0) >= 75 and e.get("what_was_good")]
    improvements = [
        {
            "area": f"Question {e.get('question_id', '?')}",
            "action": e.get("what_was_missing", "Review core concepts and provide more structured answers."),
        }
        for e in evaluations
        if e.get("score", 0) < 75
    ]

    study_plan = [
        "Practice concise STAR-formatted answers for behavioral prompts.",
        "Solve 2 timed technical questions daily and explain your reasoning aloud.",
        "Review weak areas and prepare one polished project story for interviews.",
    ]

    overall_feedback = (
        "Strong progress overall. Continue tightening answer structure and depth on weaker areas."
        if job_ready else
        "You are improving, but need more practice to reach interview-ready consistency."
    )

    encouragement = (
        "You are interview-ready. Keep momentum and start applying confidently."
        if job_ready else
        "Stay consistent. Your readiness will rise quickly with focused practice."
    )

    xp_awarded = max(40, min(200, overall_score * 2))

    supabase.table("interview_sessions").update({
        "answers": answers,
        "evaluations": evaluations,
        "overall_score": overall_score,
        "overall_feedback": overall_feedback,
        "strengths": strengths,
        "improvements": improvements,
        "job_ready": job_ready,
        "completed": True,
        "status": "completed",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "xp_awarded": xp_awarded,
    }).eq("id", session_id).eq("user_id", user_id).execute()

    supabase.rpc("increment_xp", {"p_user_id": user_id, "p_amount": xp_awarded}).execute()

    return {
        "session_id": session_id,
        "overall_score": overall_score,
        "job_ready": job_ready,
        "overall_feedback": overall_feedback,
        "strengths": strengths,
        "improvements": improvements,
        "study_plan": study_plan,
        "encouragement": encouragement,
        "xp_awarded": xp_awarded,
    }

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=4), reraise=True)
async def review_resume_ai(
    resume_text: str,
    target_role: str,
    skill_context: str
) -> Dict[str, Any]:
    """Evaluates a resume for ATS compatibility and technical impact."""
    client = get_gemini_client()

    prompt = f"""
    Perform a professional resume audit for a {skill_context} developer.
    TARGET ROLE: {target_role}
    
    [RESUME CONTENT]
    {resume_text[:4000]}

    Evaluate for: ATS parsing, impact-based bullet points, and skill density.
    Return JSON:
    {{
      "ats_score": 0-100,
      "verdict": "Ready / Needs Work / Major Revisions",
      "missing_keywords": ["keyword1", "keyword2"],
      "critique": [
        {{ "section": "...", "issue": "...", "fix": "..." }}
      ],
      "top_improvement": "The single most important change to make."
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

    return json.loads(response.text)

async def check_job_readiness_logic(user_id: str, roadmap_id: str) -> Dict[str, Any]:
    """
    Calculates the 'SkillMentor Readiness Score' using a weighted algorithm.
    This is the ultimate 'Proof of Competency' for the student.
    """
    supabase = get_supabase()

    # Aggregate cross-agent data
    progress = supabase.table("user_progress").select("*").eq("user_id", user_id).single().execute()
    projects = (
        supabase.table("projects")
        .select("score,status,created_at")
        .eq("user_id", user_id)
        .eq("roadmap_id", roadmap_id)
        .order("created_at", desc=True)
        .execute()
    )
    interviews = supabase.table("interview_sessions").select("overall_score").eq("user_id", user_id).execute()
    quizzes = supabase.table("quizzes").select("score, total_questions").eq("user_id", user_id).execute()

    # Helper to calculate averages safely
    def avg(lst):
        return sum(lst) / len(lst) if lst else 0.0

    reviewed_projects = [
        p for p in (projects.data or [])
        if p.get("score") is not None and p.get("status") == "reviewed"
    ]
    project_scores = [float(p.get("score")) for p in reviewed_projects]
    interview_scores = [
        float(i.get("overall_score"))
        for i in (interviews.data or [])
        if i.get("overall_score") is not None
    ]
    quiz_scores = []
    for q in (quizzes.data or []):
        score = q.get("score")
        total = q.get("total_questions")
        if score is None:
            continue

        score_f = float(score)
        total_f = float(total) if total not in (None, 0) else None

        # Some rows store score as raw correct answers, others already as a percentage.
        if total_f is None:
            pct = score_f
        elif score_f <= total_f:
            pct = (score_f / total_f) * 100.0
        else:
            pct = score_f

        pct = max(0.0, min(100.0, pct))
        quiz_scores.append(pct)

    # Reflect current project capability quickly: use latest reviewed score when present.
    latest_project_score = float(reviewed_projects[0].get("score")) if reviewed_projects else None
    proj_avg = latest_project_score if latest_project_score is not None else avg(project_scores)
    int_avg = avg(interview_scores)
    quiz_avg = avg(quiz_scores)
    xp_raw = progress.data.get("xp_points", 0) if progress.data else 0
    xp = int(xp_raw or 0)

    # Weighted Algorithm: 40% Projects, 30% Interviews, 20% Quizzes, 10% Engagement (XP)
    readiness = int((proj_avg * 0.40) + (int_avg * 0.30) + (quiz_avg * 0.20) + (min(xp/20, 100) * 0.10))
    
    is_job_ready = readiness >= JOB_READY_THRESHOLD

    return {
        "readiness_score": readiness,
        "job_ready": is_job_ready,
        "is_job_ready": is_job_ready,
        "avg_quiz": round(quiz_avg, 1),
        "avg_project": round(proj_avg, 1),
        "avg_interview": round(int_avg, 1),
        "lessons_done": progress.data.get("lessons_completed", 0) if progress.data else 0,
        "xp_total": xp,
        "message": "You are ready for job applications." if is_job_ready else "Keep practicing interviews and projects to reach readiness.",
        "metrics": {
            "project_mastery": round(proj_avg, 1),
            "interview_performance": round(int_avg, 1),
            "theoretical_knowledge": round(quiz_avg, 1),
            "platform_engagement_xp": xp
        },
        "checklist": [
            {"item": "Project Benchmarks", "done": proj_avg >= PROJECT_BENCHMARK_THRESHOLD, "value": f"{round(proj_avg,1)}%"},
            {"item": "Interview Readiness", "done": int_avg >= INTERVIEW_READINESS_THRESHOLD, "value": f"{round(int_avg,1)}%"},
            {"item": "XP Threshold (1000+)", "done": xp >= 1000, "value": xp}
        ]
    }
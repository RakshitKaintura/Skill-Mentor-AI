"""
Agent 7 — Project Mentor
Assigns industry-grade projects, conducts senior-level code reviews, 
and provides architectural guidance.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from tenacity import retry, stop_after_attempt, wait_exponential
from google.genai import types

from app.core.gemini import get_gemini_client  # Standardized Client pattern
from app.core.config import get_settings
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
settings = get_settings()


def _coerce_score(value: Any) -> int:
    """Normalizes AI score payloads to a safe integer 0..100."""
    if isinstance(value, (int, float)):
        return max(0, min(100, int(round(float(value)))))
    if isinstance(value, str):
        digits = ''.join(ch for ch in value if ch.isdigit())
        if digits:
            return max(0, min(100, int(digits)))
    return 0


def _extract_xp_earned(data: Any) -> int:
    """Handles dict/list/primitive RPC return shapes from Supabase."""
    if isinstance(data, dict):
        return int(data.get("xp_earned", 0) or 0)
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict):
            return int(first.get("xp_earned", 0) or 0)
    if isinstance(data, (int, float)):
        return int(data)
    return 0

SYSTEM_PROMPT = """You are the Principal Engineering Mentor for SkillMentor AI.
Your philosophy: Projects must be 'Production-Ready'. You review code for 
scalability, security, readability, and performance. 

DIRECTIVES:
1. OUTPUT: Return ONLY valid JSON. No markdown, no preamble.
2. FEEDBACK: Be pedantic about best practices (naming, DRY, SOLID, error handling).
3. ENCOURAGEMENT: Critique the code, not the person. Use a 'Senior to Junior' coaching tone."""

PROJECT_BANK = {
    "javascript": {
        "beginner": "Interactive Expense Tracker (Vanilla JS/LocalStorage)",
        "intermediate": "Weather Forecast Dashboard (Fetch API/Charts.js)",
        "advanced": "Real-time Task Orchestrator (Next.js/Supabase)",
        "expert": "Distributed Chat System (WebSockets/Redis)",
    },
    "python": {
        "beginner": "Cryptocurrency Price CLI Tool",
        "intermediate": "Automated Content Scraper & Summarizer",
        "advanced": "Secure RESTful API for E-commerce (FastAPI/PostgreSQL)",
        "expert": "Predictive Analytics Pipeline (Scikit-Learn/DVC)",
    },
    "default": {
        "beginner": "Foundational Implementation Project",
        "intermediate": "Applied System Design Project",
        "advanced": "Production-Grade Feature Build",
        "expert": "Scalable Infrastructure Project",
    }
}

ALLOWED_LEVELS = {"beginner", "intermediate", "advanced", "expert"}
LEVEL_ALIASES = {
    "some": "intermediate",
    "medium": "intermediate",
    "mid": "intermediate",
    "junior": "beginner",
    "senior": "advanced",
    "pro": "advanced",
}


def _normalize_level(level: str) -> str:
    raw = (level or "").strip().lower()
    normalized = LEVEL_ALIASES.get(raw, raw)
    return normalized if normalized in ALLOWED_LEVELS else "beginner"

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=4), reraise=True)
async def assign_project(
    user_id: str,
    roadmap_id: str,
    skill: str,
    level: str,
) -> Dict[str, Any]:
    """Generates a high-fidelity project specification tailored to student level."""
    supabase = get_supabase()
    client = get_gemini_client()
    normalized_level = _normalize_level(level)
    
    skill_key = skill.lower().replace(" ", "")
    bank = PROJECT_BANK.get(skill_key, PROJECT_BANK["default"])
    suggested_title = bank.get(normalized_level, bank.get("beginner"))

    prompt = f"""
    Assign a comprehensive {normalized_level}-level project for the skill: {skill}.
    SUGGESTED TITLE: {suggested_title}

    REQUIREMENTS:
    - Must be a 'portfolio-worthy' project.
    - List 6-8 testable technical requirements.
    - Include a modern tech stack (e.g., React 19, FastAPI, Tailwind 4).
    - Provide 3 'Mentor Secrets' (architectural hints).

    JSON STRUCTURE:
    {{
      "title": "{suggested_title}",
      "description": "Short problem statement and industry relevance.",
      "requirements": ["Requirement 1", "Requirement 2"],
      "tech_stack": ["Tech 1", "Tech 2"],
      "mentor_secrets": ["Hint 1", "Hint 2", "Hint 3"],
      "success_criteria": "What defines a finished product?",
      "estimated_hours": 15
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

    project_data = json.loads(response.text)

    # Persist the assignment
    db_row = supabase.table("projects").insert({
        "user_id": user_id,
        "roadmap_id": roadmap_id,
        "skill": skill,
        "level": normalized_level,
        "title": project_data["title"],
        "description": project_data["description"],
        "requirements": project_data["requirements"],
        "tech_stack": project_data["tech_stack"],
        "starter_hints": project_data["mentor_secrets"],
        "estimated_hours": project_data.get("estimated_hours", 15),
        "status": "assigned"
    }).execute()

    project_data["project_id"] = db_row.data[0]["id"]
    return project_data

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=4), reraise=True)
async def review_project(
    project_id: str,
    user_id: str,
    submitted_code: str,
    github_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Performs a senior-level code review and calculates XP rewards."""
    supabase = get_supabase()
    client = get_gemini_client()

    # 1. Fetch Project Definition
    proj_res = supabase.table("projects").select("*").eq("id", project_id).single().execute()
    if not proj_res.data:
        raise ValueError("Project record not found.")
    p = proj_res.data

    # 2. Conduct AI Review
    prompt = f"""
    CODE REVIEW REQUEST:
    Project: {p['title']} ({p['level']} {p['skill']})
    Requirements: {json.dumps(p['requirements'])}

    [STUDENT CODE]
    {submitted_code[:5000]} 

    INSTRUCTION: Provide a line-by-line critique. Evaluate for:
    - Correctness (against requirements)
    - Code Quality (naming, modularity)
    - Efficiency (complexity, resource usage)

    Return JSON:
    {{
      "score": 0-100,
      "grade": "A/B/C/D",
      "requirement_audit": [{{ "req": "...", "status": "met/partial/failed", "comment": "..." }}],
      "code_critique": [{{ "issue": "...", "location": "...", "suggestion": "..." }}],
      "top_strengths": ["...", "..."],
      "overall_verdict": "2-sentence mentor summary",
      "next_milestone": "What to learn next"
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

    review_data = json.loads(response.text)
    review_data["score"] = _coerce_score(review_data.get("score"))

    # 3. Update Database & Award XP
    # We use the RPC 'complete_project' to handle XP logic in SQL
    supabase.table("projects").update({
        "submitted_code": submitted_code,
        "github_url": github_url,
        "review": review_data,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "status": "submitted"
    }).eq("id", project_id).execute()

    xp_res = supabase.rpc("complete_project", {
        "p_project_id": project_id,
        "p_user_id": user_id,
        "p_score": review_data["score"]
    }).execute()

    review_data["xp_awarded"] = _extract_xp_earned(xp_res.data)
    review_data["project_id"] = project_id
    
    return review_data

async def get_mentor_guidance(
    project_id: str,
    question: str,
) -> Dict[str, Any]:
    """Provides non-spoiler architectural hints for a student stuck on a project."""
    supabase = get_supabase()
    client = get_gemini_client()
    
    proj = supabase.table("projects").select("*").eq("id", project_id).single().execute()
    p = proj.data

    prompt = f"""
    Student is building {p['title']} ({p['skill']}) and is stuck.
    QUESTION: "{question}"

    INSTRUCTION: Do not solve it for them. Give a high-level architectural hint 
    or point to a specific documentation concept.
    Return JSON: {{ "guidance": "...", "next_step": "...", "link": "..." }}
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
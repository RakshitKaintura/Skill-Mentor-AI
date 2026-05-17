import json
from datetime import date
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.core.database import get_supabase
from app.core.cache import cache_manager
from app.core.llm_router import llm_router
from app.models.schemas import (
    GenerateRoadmapRequest,
    GeneratedRoadmap,
    LearnerGoal,
)

# ── Configuration ──────────────────────────────────────────
SYSTEM_PROMPT = """You are the Roadmap Architect Agent for SkillMentor AI.
Your goal is to design a structured, 4-phase technical learning curriculum.
Focus on buildable milestones and specific, modern technical topics.
Ensure the roadmap is realistic for the student's daily hour commitment.
CRITICAL: Be ultra-concise. Max 5 words for descriptions. Max 3 items for lists. Return ONLY valid JSON."""

# Fixed: Accessing Enum members correctly based on your schema definitions
# Using .get() with the Enum member directly or the value string
GOAL_MAP = {
    LearnerGoal.get_job: "career-ready role",
    LearnerGoal.freelance: "client-ready service",
    LearnerGoal.build_project: "independent product",
    LearnerGoal.exam: "academic mastery",
    LearnerGoal.upskill: "professional advancement"
}


def _extract_json_payload(text: str) -> dict:
    """Extract a JSON object from plain JSON or markdown-fenced output."""
    cleaned = text.strip()

    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 3:
            cleaned = "\n".join(lines[1:-1]).strip()

    return json.loads(cleaned)


def _normalize_phase(raw_phase: dict, index: int) -> dict:
    phase_number = raw_phase.get("phase") or raw_phase.get("number") or (index + 1)
    phase_name = (
        raw_phase.get("name")
        or raw_phase.get("phase_name")
        or raw_phase.get("title")
        or f"Phase {phase_number}"
    )

    raw_weeks = raw_phase.get("weeks")
    if isinstance(raw_weeks, int):
        weeks = [raw_weeks]
    elif isinstance(raw_weeks, list) and all(isinstance(w, int) for w in raw_weeks):
        weeks = raw_weeks
    else:
        duration = raw_phase.get("duration_weeks")
        if isinstance(duration, int) and duration > 0:
            start_week = index * duration + 1
            weeks = list(range(start_week, start_week + duration))
        else:
            weeks = [index + 1]

    topics = raw_phase.get("topics")
    if not isinstance(topics, list) or not topics:
        topics = ["Core concepts"]

    project = raw_phase.get("project") or f"Build a mini project for {phase_name}"
    description = (
        raw_phase.get("description")
        or raw_phase.get("summary")
        or f"Focus on {phase_name.lower()} with practical implementation."
    )

    return {
        "phase": int(phase_number),
        "name": str(phase_name),
        "weeks": weeks,
        "topics": [str(t) for t in topics],
        "project": str(project),
        "description": str(description),
    }


def _normalize_roadmap_payload(raw: dict, hours_per_day: int) -> dict:
    phases_raw = raw.get("phases") if isinstance(raw.get("phases"), list) else []
    phases = [_normalize_phase(p, i) for i, p in enumerate(phases_raw) if isinstance(p, dict)]

    daily_schedule = f"Commit {hours_per_day} hour(s) daily: Focus on core concepts first, then practical implementation tasks."

    checklist = raw.get("job_readiness_checklist")
    if not isinstance(checklist, list):
        checklist = ["Ship a portfolio-ready capstone project with documentation."]

    total_weeks = raw.get("total_weeks")
    if not isinstance(total_weeks, int):
        total_weeks = sum(len(p["weeks"]) for p in phases) or 12

    return {
        "skill": str(raw.get("skill") or "Professional Skill Development"),
        "total_weeks": total_weeks,
        "phases": phases,
        "daily_schedule": daily_schedule,
        "final_project": str(
            raw.get("final_project") or "Build and deploy an end-to-end portfolio project."
        ),
        "job_readiness_checklist": [str(item) for item in checklist],
    }

# ── Agent Logic ────────────────────────────────────────────
@retry(stop=stop_after_attempt(4), wait=wait_exponential(min=1, max=5))
async def generate_roadmap(req: GenerateRoadmapRequest) -> dict:
    supabase = get_supabase()
    
    # Identify context for the prompt
    goal_context = GOAL_MAP.get(req.goal, "general mastery")
    
    # 1. Roadmap generation API call
    prompt = (
        f"Create a {req.skill} roadmap for a {req.level.value} level student aiming for a {goal_context}. "
        f"The student can commit {req.hours_per_day} hours per day. "
        "Return exactly one JSON object with fields: "
        "skill, total_weeks, phases, final_project, job_readiness_checklist (max 3 items). "
        "Each phase must include: phase (int), name (str), weeks (list[int]), topics (list[str] max 3 concise topics), project (str), description (max 5 words)."
    )

    async def _fetch_from_llm() -> dict:
        response_text = await llm_router.generate_json(
            prompt=prompt,
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=8192
        )
        return _extract_json_payload(response_text)

    # Cache key based on input parameters to avoid re-generating the same roadmap
    cache_key = f"roadmap_{req.skill}_{req.level.value}_{req.goal.value}".lower().replace(" ", "_")

    try:
        # Cache roadmaps for 7 days (604800 seconds) since they rarely change
        roadmap_json = await cache_manager.get_or_set(cache_key, _fetch_from_llm, ttl=604800)

        normalized = _normalize_roadmap_payload(roadmap_json, int(req.hours_per_day))
        roadmap = GeneratedRoadmap.model_validate(normalized)
    except Exception as e:
        raise ValueError(f"Gemini roadmap JSON parsing failed: {str(e)}")

    if not roadmap.phases:
        raise ValueError("AI failed to generate roadmap phases.")
        
    first_phase = roadmap.phases[0]

    # 3. Database Persistence
    # Using by_alias=True ensures the database gets 'total_weeks' vs 'total_duration' 
    # if you defined them with aliases in your Pydantic model.
    total_weeks = getattr(roadmap, 'total_weeks', None)
    record = {
        "user_id": req.user_id,
        "skill": roadmap.skill,
        "level": req.level.value,
        "goal": req.goal.value,
        "hours_per_day": req.hours_per_day,
        "total_weeks": total_weeks,
        "current_phase": first_phase.name,
        "current_topic": first_phase.topics[0] if first_phase.topics else "Introduction",
        "phases": [p.model_dump(by_alias=True) for p in roadmap.phases],
        "daily_schedule": roadmap.daily_schedule,
        "final_project": roadmap.final_project,
        "job_readiness_checklist": roadmap.job_readiness_checklist,
    }

    # Check if a roadmap already exists for this user/skill/level/goal
    existing = supabase.table("roadmaps").select("id").eq(
        "user_id", req.user_id
    ).eq("skill", roadmap.skill).eq("level", req.level.value).eq(
        "goal", req.goal.value
    ).limit(1).execute()

    if existing.data:
        # Update existing roadmap
        roadmap_id = existing.data[0]["id"]  # type: ignore[index]
        supabase.table("roadmaps").update(record).eq("id", roadmap_id).execute()
    else:
        # Insert new roadmap
        db_result = supabase.table("roadmaps").insert(record).execute()
        if not db_result.data:
            raise Exception("Failed to insert roadmap into database.")
        db_rows = db_result.data
        assert isinstance(db_rows, list), "Supabase insert returned non-list data"
        roadmap_id = db_rows[0]["id"]  # type: ignore[index]

    # 4. Initialize Progress Metrics (check-then-insert to avoid constraint errors)
    prog_existing = supabase.table("user_progress").select("user_id").eq(
        "user_id", req.user_id
    ).limit(1).execute()

    if not prog_existing.data:
        supabase.table("user_progress").insert({
            "user_id": req.user_id,
            "xp_points": 0,
            "streak_days": 1,
            "lessons_completed": 0,
            "total_study_minutes": 0,
            "badges_earned": [],
            "last_active_date": date.today().isoformat(),
        }).execute()

    return {
        "roadmap_id": roadmap_id,
        "total_weeks": total_weeks,
        "phases_count": len(roadmap.phases),
        "message": f"Successfully architected your {roadmap.skill} journey. 🚀"
    }
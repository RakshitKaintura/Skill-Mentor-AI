import json
import re
from typing import Dict, Any, List

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.core.database import get_supabase
from app.core.cache import cache_manager
from app.core.llm_router import llm_router
from app.services.rag_service import retrieve_chunks, format_rag_context
from app.services.memory_service import get_user_memory, append_memory, summarize_session
from app.models.schemas import GenerateLessonRequest, GeneratedLesson

SYSTEM_PROMPT = """You are the Lead Pedagogical Agent for SkillMentor AI.
Transform technical topics into concise, high-retention lessons using the Feynman Technique.
CRITICAL:
- Return ONLY a raw JSON object. No markdown, no explanations.
- Follow the schema exactly.
- Code snippets must be minimal, modern, and PEP8/StandardJS compliant.
- keep 'try_it' task specific with clear TODOs.
- 'mistakes' must contrast anti-pattern vs correct pattern briefly."""

settings = get_settings()

def _build_prompt(req: GenerateLessonRequest, rag_context: str) -> str:
    """Constructs the structured prompt for the LLM."""
    level_mapping = {
        "beginner": "absolute beginner with no prior exposure",
        "some": "learner with basic syntax knowledge looking for structure",
        "intermediate": "developer seeking deep conceptual understanding and best practices",
    }
    level_desc = level_mapping.get(req.level, "active learner")
    lang_key = req.skill.lower().replace(" ", "")

    return f"""
Generate a lesson on the topic below. Be concise; avoid padding.
SKILL: {req.skill} | TOPIC: {req.topic} | AUDIENCE: {level_desc} | PHASE: {req.phase_name}, Week {req.week_number}

[DOCUMENTATION CONTEXT]
{rag_context if rag_context else "Use internal knowledge base."}

[REQUIRED JSON SCHEMA]
{{"topic":"{req.topic}","skill":"{req.skill}","week_number":{req.week_number},"phase_name":"{req.phase_name}","key_takeaway":"<str>","next_topic":"<str>","steps":[{{"type":"intro","title":"<str>","content":"<str>"}},{{"type":"analogy","title":"<str>","content":"<str>"}},{{"type":"code_demo","title":"<str>","content":"<str>","code_snippet":"<str>","language":"{lang_key}"}},{{"type":"try_it","title":"<str>","content":"<str>","code_snippet":"<str>","language":"{lang_key}"}},{{"type":"mistakes","title":"<str>","content":"<str>","code_snippet":"<str>","language":"{lang_key}"}},{{"type":"summary","title":"<str>","content":"<str>"}}]}}
"""

@retry(
    stop=stop_after_attempt(3), 
    wait=wait_exponential(min=2, max=10),
    reraise=True
)
async def generate_lesson(req: GenerateLessonRequest) -> Dict[str, Any]:
    """
    Orchestrates the RAG pipeline and lesson generation.
    0. Check DB for existing lesson → return immediately if found (no LLM call).
    1. Retrieves context -> 2. Generates Content -> 3. Validates Schema -> 4. Persists Data.
    """
    supabase = get_supabase()

    # 0. Return existing lesson from DB if already generated for this topic
    existing = supabase.table("lessons").select("*") \
        .eq("user_id", req.user_id) \
        .eq("roadmap_id", req.roadmap_id) \
        .eq("topic", req.topic) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()

    if existing.data:
        row = existing.data[0]
        return {
            "lesson_id": row["id"],
            "topic": row["topic"],
            "skill": req.skill,
            "week_number": row.get("week_number", req.week_number),
            "phase_name": req.phase_name,
            "key_takeaway": row.get("key_takeaway", ""),
            "next_topic": row.get("next_topic", ""),
            "steps": row.get("steps", []),
            "sources_used": row.get("sources_used", []),
            "completed": row.get("completed", False),
            "pdf_notes_url": row.get("pdf_notes_url"),
        }

    # 1. Fetch User Memory for personalization
    user_memory = await get_user_memory(req.user_id)
    
    # Build system prompt with memory context
    system_prompt_with_memory = SYSTEM_PROMPT
    if user_memory:
        system_prompt_with_memory = f"{SYSTEM_PROMPT}\n\n{user_memory}"
    
    # 1. Context Retrieval (RAG)
    rag_chunks = await retrieve_chunks(
        query=f"{req.topic} {req.skill}",
        user_id=req.user_id,
        skill_tag=req.skill.lower(),
        top_k=3,
        include_curated=True
    )
    rag_context = format_rag_context(rag_chunks)

    # 2. LLM Generation using the multi-key router
    prompt = _build_prompt(req, rag_context)
    
    async def _fetch_from_llm() -> dict:
        raw_text = await llm_router.generate_json(
            prompt=prompt,
            system_instruction=system_prompt_with_memory,
            max_output_tokens=8192,
        )
        json_str = re.sub(r'```json|```', '', raw_text.strip()).strip()
        data = json.loads(json_str)
        if "sources_used" not in data:
            data["sources_used"] = []
        return data

    cache_key = f"lesson_{req.skill}_{req.topic}_{req.level}".lower().replace(" ", "_")

    # 3. Clean and Parse JSON
    try:
        data = await cache_manager.get_or_set(cache_key, _fetch_from_llm, ttl=86400)

        
        # Pydantic validation for internal consistency
        lesson_obj = GeneratedLesson(**data)
    except Exception as e:
        raise ValueError(f"Failed to generate valid lesson JSON: {str(e)}")

    # 4. Source Attribution
    sources = list({c["source_label"] for c in rag_chunks}) if rag_chunks \
              else ["SkillMentor Knowledge Engine", "Official Documentation"]

    # 5. Database Persistence
    try:
        phase_number = None
        phase_match = re.search(r"(\d+)", req.phase_name or "")
        if phase_match:
            phase_number = int(phase_match.group(1))

        insert_data = {
            "roadmap_id": req.roadmap_id,
            "user_id": req.user_id,
            "topic": lesson_obj.topic,
            "week_number": lesson_obj.week_number,
            "phase_number": phase_number,
            "steps": [step.model_dump() for step in lesson_obj.steps],
            "sources_used": sources,
            "completed": False
        }
        
        result = supabase.table("lessons").insert(insert_data).execute()
        
        if not result.data:
            raise RuntimeError("Database insertion failed.")
            
        lesson_id = result.data[0]["id"]  # type: ignore[index]

        # Update current progress in the roadmap
        supabase.table("roadmaps").update(
            {"current_topic": lesson_obj.next_topic}
        ).eq("id", req.roadmap_id).execute()

        return {
            "lesson_id": lesson_id,
            "topic": lesson_obj.topic,
            "steps": [step.model_dump() for step in lesson_obj.steps],
            "message": f"Successfully prepared your lesson on {lesson_obj.topic}!"
        }
    except Exception as e:
        # Log error here in production
        raise RuntimeError(f"Storage Error: {str(e)}")
    finally:
        # Save session to rolling memory buffer (fire-and-forget, non-blocking)
        try:
            summary = await summarize_session(
                topic=req.topic,
                skill=req.skill,
                key_takeaway=data.get("key_takeaway") if isinstance(data, dict) else None,
            )
            await append_memory(req.user_id, summary, topics=[req.topic])
        except Exception:
            pass  # Never block lesson delivery due to memory write failure

async def complete_lesson(user_id: str, lesson_id: str, time_spent: int = 0) -> Dict[str, str]:
    """Updates user statistics and awards XP upon lesson completion."""
    supabase = get_supabase()
    
    # Update lesson status
    supabase.table("lessons").update({
        "completed": True,
        "completed_at": "now()"
    }).eq("id", lesson_id).eq("user_id", user_id).execute()
    
    # Update user progress metrics
    prog_result = supabase.table("user_progress").select("*").eq("user_id", user_id).single().execute()
    
    if prog_result.data:
        prog_data = prog_result.data
        assert isinstance(prog_data, dict), "Expected dict from single() query"
        supabase.table("user_progress").update({
            "lessons_completed": prog_data["lessons_completed"] + 1,  # type: ignore[operator]
            "total_study_minutes": prog_data["total_study_minutes"] + max(time_spent, 0)  # type: ignore[operator]
        }).eq("user_id", user_id).execute()
    
    # Trigger database functions for gamification
    supabase.rpc("increment_xp", {"p_user_id": user_id, "p_amount": 100}).execute()
    supabase.rpc("update_streak", {"p_user_id": user_id}).execute()
    
    return {"message": "Great job! You've earned 100 XP.", "status": "success"}
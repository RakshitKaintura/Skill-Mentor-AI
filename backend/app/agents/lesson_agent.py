import json
import re
from typing import Dict, Any, List

from tenacity import retry, stop_after_attempt, wait_exponential
from google.genai import types

from app.core.gemini import get_gemini_client  # Updated to use Client
from app.core.config import get_settings
from app.core.database import get_supabase
from app.core.cache import cache_manager
from app.services.rag_service import retrieve_chunks, format_rag_context
from app.models.schemas import GenerateLessonRequest, GeneratedLesson

# System instructions optimized for March 2026 LLM reasoning
SYSTEM_PROMPT = """You are the Lead Pedagogical Agent for SkillMentor AI. 
Your goal is to transform technical documentation into an engaging, high-retention learning experience.

CRITICAL INSTRUCTIONS:
1. RESPONSE FORMAT: Return ONLY a raw JSON object. Do not include markdown blocks (```json) or explanations.
2. SCHEMA ADHERENCE: You must follow the provided JSON structure exactly.
3. PEDAGOGY: Use the 'Feynman Technique'—explain complex topics as if to a peer using simple analogies.
4. CODE QUALITY: Snippets must be modern, production-grade, and follow PEP8/StandardJS.
5. INTERACTIVITY: The 'try_it' section must be a specific, hands-on task with clear TODOs.
6. ERROR PREVENTION: The 'mistakes' section must provide high-contrast comparisons between anti-patterns and best practices."""

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
Generate a comprehensive, interactive lesson based on the following context:
- SKILL: {req.skill}
- TOPIC: {req.topic}
- TARGET AUDIENCE: {level_desc}
- CURRICULUM POSITION: Phase {req.phase_name}, Week {req.week_number}

[DOCUMENTATION CONTEXT]
{rag_context if rag_context else "No specific documentation provided. Use your internal knowledge base."}

[REQUIRED JSON STRUCTURE]
{{
  "topic": "{req.topic}",
  "skill": "{req.skill}",
  "week_number": {req.week_number},
  "phase_name": "{req.phase_name}",
  "key_takeaway": "Direct benefit of this lesson",
  "next_topic": "Logical next step",
  "steps": [
    {{ "type": "intro", "title": "The Big Picture", "content": "Context and purpose" }},
    {{ "type": "analogy", "title": "Real-world Concept", "content": "Non-technical analogy" }},
    {{ "type": "code_demo", "title": "Live Implementation", "content": "Step-by-step breakdown", "code_snippet": "Runnable code", "language": "{lang_key}" }},
    {{ "type": "try_it", "title": "Practical Challenge", "content": "The task", "code_snippet": "Starter code", "language": "{lang_key}" }},
    {{ "type": "mistakes", "title": "Pro Tips & Pitfalls", "content": "Common errors", "code_snippet": "// WRONG vs // CORRECT", "language": "{lang_key}" }},
    {{ "type": "summary", "title": "Wrap Up", "content": "Key points" }}
  ]
}}
"""

@retry(
    stop=stop_after_attempt(3), 
    wait=wait_exponential(min=2, max=10),
    reraise=True
)
async def generate_lesson(req: GenerateLessonRequest) -> Dict[str, Any]:
    """
    Orchestrates the RAG pipeline and lesson generation.
    1. Retrieves context -> 2. Generates Content -> 3. Validates Schema -> 4. Persists Data.
    """
    supabase = get_supabase()
    
    # 1. Context Retrieval (RAG)
    rag_chunks = await retrieve_chunks(
        query=f"{req.topic} {req.skill}",
        user_id=req.user_id,
        skill_tag=req.skill.lower(),
        top_k=5,
        include_curated=True
    )
    rag_context = format_rag_context(rag_chunks)

    # 2. LLM Generation using Google GenAI SDK v1.0+
    client = get_gemini_client()
    prompt = _build_prompt(req, rag_context)
    
    async def _fetch_from_llm() -> dict:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.7,
                response_mime_type='application/json' # Forces JSON output at the API level
            )
        )
        raw_text = response.text.strip()
        # Remove any markdown artifacts if present despite the config
        json_str = re.sub(r'```json|```', '', raw_text).strip()
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
            
        lesson_id = result.data[0]["id"]

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
        supabase.table("user_progress").update({
            "lessons_completed": prog_result.data["lessons_completed"] + 1,
            "total_study_minutes": prog_result.data["total_study_minutes"] + max(time_spent, 0)
        }).eq("user_id", user_id).execute()
    
    # Trigger database functions for gamification
    supabase.rpc("increment_xp", {"p_user_id": user_id, "p_amount": 100}).execute()
    supabase.rpc("update_streak", {"p_user_id": user_id}).execute()
    
    return {"message": "Great job! You've earned 100 XP.", "status": "success"}
import json
import re
import logging
from typing import Dict, Any, Optional

from google.genai import types
from app.core.gemini import get_gemini_client  # Updated to Client pattern
from app.core.config import get_settings
from app.core.database import get_supabase
from app.services.rag_service import retrieve_chunks, format_rag_context
from app.models.schemas import DoubtRequest, DoubtResponse

settings = get_settings()
logger = logging.getLogger(__name__)

# Refined System Prompt for a "Resume-Quality" Educational Agent
SYSTEM_PROMPT = """You are the Senior Doubt Solver for SkillMentor AI. 
Your primary directive is the Socratic Method: lead students to the answer through hints, analogies, and conceptual clarity.

CORE OPERATING PROCEDURES:
1. GUIDANCE OVER ANSWERS: Do not solve homework or provide direct copy-paste solutions. Provide the "why" and a "how-to-approach" guide.
2. THE ANALOGY BRIDGE: Every analogy must start with a non-technical scenario (e.g., a library, a kitchen, a post office) and explicitly transition back to the technical concept.
3. ADAPTIVE TONE: Be encouraging, patient, and use "we" to foster a collaborative learning environment.
4. CODE STANDARDS: Code examples must be minimal, PEP8/ESLint compliant, and focus solely on the student's point of confusion."""


def _extract_json_payload(raw_text: str) -> Dict[str, Any]:
    """Parse response text as JSON, with a resilient fallback for wrapped payloads."""
    text = (raw_text or "").strip()
    if not text:
        raise ValueError("Empty model response")

    # First try strict parsing.
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fallback: extract the first JSON object from mixed text.
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("No JSON object found in model response")

    return json.loads(match.group(0))


def _normalize_doubt_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize different model JSON shapes to DoubtResponse schema."""
    answer = (
        data.get("answer")
        or data.get("pedagogical_explanation")
        or data.get("explanation")
        or data.get("response")
        or ""
    )

    raw_analogy = data.get("analogy") or data.get("metaphor") or ""
    if isinstance(raw_analogy, dict):
        analogy_parts = [
            raw_analogy.get("scenario"),
            raw_analogy.get("parallel_approach"),
            raw_analogy.get("technical_transition"),
        ]
        analogy = " ".join(part.strip() for part in analogy_parts if isinstance(part, str) and part.strip())
        if not analogy:
            analogy = " ".join(str(value).strip() for value in raw_analogy.values() if isinstance(value, str) and value.strip())
    else:
        analogy = raw_analogy

    code_example = (
        data.get("code_example")
        or data.get("code")
        or data.get("example_code")
    )

    # Some model outputs provide a structured code comparison block.
    code_comparison = data.get("code_comparison")
    if not code_example and isinstance(code_comparison, dict):
        sequential = code_comparison.get("sequential")
        parallel = code_comparison.get("parallel")
        if sequential or parallel:
            parts = []
            if sequential:
                parts.append(f"// Sequential\n{sequential}")
            if parallel:
                parts.append(f"// Parallel\n{parallel}")
            code_example = "\n\n".join(parts)

    return {
        "answer": str(answer).strip(),
        "analogy": str(analogy).strip(),
        "code_example": str(code_example).strip() if code_example else None,
    }

async def solve_doubt(req: DoubtRequest) -> DoubtResponse:
    """
    Analyzes student queries using RAG context and generates a guided resolution.
    Utilizes Gemini 3.1 Flash Lite Preview with forced JSON schema for 100% parsing reliability.
    """
    supabase = get_supabase()
    client = get_gemini_client()

    # 1. Retrieval Augmented Generation (RAG)
    # Searches uploaded materials and curated books for relevant context
    rag_chunks = await retrieve_chunks(
        query=f"{req.question} {req.topic}",
        user_id=req.user_id,
        skill_tag=req.skill.lower(),
        top_k=3,
        include_curated=True
    )
    rag_context = format_rag_context(rag_chunks) if rag_chunks else "No specific context available."

    # 2. Modern Prompt Construction
    user_prompt = f"""
    STUDENT CONTEXT:
    - Learning: {req.skill}
    - Current Topic: {req.topic}
    - Question: {req.question}

    [RELEVANT DOCUMENTATION]
    {rag_context}

    Please provide a structured response including a clear pedagogical explanation, 
    a relatable analogy, and a focused code snippet if applicable.
    """

    # 3. LLM Generation with Native JSON Mode
    # Using the March 2026 SDK standard to eliminate Regex parsing
    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.6,
                response_mime_type='application/json'
            )
        )

        data = _extract_json_payload(response.text or "")
        normalized = _normalize_doubt_payload(data)
        result = DoubtResponse(**normalized)

        # Ensure required fields are meaningful even when provider omits one.
        if not result.answer:
            raise ValueError("Model response missing answer field")
        if not result.analogy:
            result = DoubtResponse(
                answer=result.answer,
                analogy=f"Think of {req.topic} like practicing a skill in steps: first understand the intent, then apply it in a small example.",
                code_example=result.code_example,
            )
        
    except Exception as e:
        logger.exception("Doubt generation failed for topic '%s': %s", req.topic, e)
        # Fallback mechanism for unexpected LLM behavior
        result = DoubtResponse(
            answer="I encountered a slight hiccup while processing that. Let's look at the core concept again: " + req.topic,
            analogy="Think of learning like debugging code—sometimes we just need to refresh the state and try again.",
            code_example=None
        )

    # 4. Persistence for Learning Analytics
    # Saves to 'doubts' table to track common student friction points
    try:
        profile_row = (
            supabase.table("profiles")
            .select("id")
            .eq("id", req.user_id)
            .limit(1)
            .execute()
        )

        if not getattr(profile_row, "data", None):
            logger.info(
                "Skipping doubts logging because profile does not exist for user_id=%s",
                req.user_id,
            )
            return result

        supabase.table("doubts").insert({
            "user_id": req.user_id,
            "lesson_id": req.lesson_id,
            "topic": req.topic,
            "skill": req.skill,
            "question": req.question,
            "answer": result.answer,
            "analogy": result.analogy,
            "code_example": result.code_example,
            "created_at": "now()"
        }).execute()
    except Exception as db_err:
        # Log error but don't block the student's answer
        logger.warning("Database logging error in solve_doubt: %s", db_err)

    return result
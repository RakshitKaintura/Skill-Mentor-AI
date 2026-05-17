"""
Doubt Solver Agent — with Rolling Context Window Memory

Pipeline per request:
  1. Fetch long-term user memory (cross-session personalization).
  2. Build a token-counted, compressed context window for this session.
  3. Fetch RAG chunks for grounding.
  4. Generate a guided Socratic response via the LLM router.
  5. Persist the new turn (user + assistant) to conversation history.
  6. Update long-term memory asynchronously (fire-and-forget).
"""
import json
import re
import logging
import uuid
from typing import Dict, Any, Optional

from app.core.database import get_supabase
from app.core.llm_router import llm_router
from app.services.rag_service import retrieve_chunks, format_rag_context
from app.services.memory_service import (
    get_user_memory,
    build_context_window,
    append_turn,
    append_memory,
    summarize_session,
)
from app.models.schemas import DoubtRequest, DoubtResponse

logger = logging.getLogger(__name__)

# ── System prompt ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the Senior Doubt Solver for SkillMentor AI.
Your primary directive is the Socratic Method: lead students to the answer through hints, analogies, and conceptual clarity.
Provide short, targeted answers. Avoid long preambles.

CORE OPERATING PROCEDURES:
1. GUIDANCE OVER ANSWERS: Do not solve homework or provide direct copy-paste solutions. Provide the "why" and a "how-to-approach" guide.
2. THE ANALOGY BRIDGE: Every analogy must start with a non-technical scenario (e.g., a library, a kitchen, a post office) and explicitly transition back to the technical concept.
3. ADAPTIVE TONE: Be encouraging, patient, and use "we" to foster a collaborative learning environment.
4. CONTINUITY: If conversation history is provided, reference the student's past questions and build on what was already explained — do not repeat yourself.
5. CODE STANDARDS: Code examples must be minimal, PEP8/ESLint compliant, and focus solely on the student's point of confusion.

Always respond with a valid JSON object containing:
- "answer": string — the pedagogical explanation
- "analogy": string — a relatable non-technical analogy
- "code_example": string or null — a focused code snippet if applicable"""


# ── JSON parsing helpers ───────────────────────────────────────────────────────

def _extract_json_payload(raw_text: str) -> Dict[str, Any]:
    text = (raw_text or "").strip()
    if not text:
        raise ValueError("Empty model response")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("No JSON object found in model response")
    return json.loads(match.group(0))


def _normalize_doubt_payload(data: Dict[str, Any]) -> Dict[str, Any]:
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
        analogy = " ".join(
            p.strip() for p in analogy_parts if isinstance(p, str) and p.strip()
        )
        if not analogy:
            analogy = " ".join(
                v.strip() for v in raw_analogy.values() if isinstance(v, str) and v.strip()
            )
    else:
        analogy = raw_analogy

    code_example = (
        data.get("code_example") or data.get("code") or data.get("example_code")
    )
    code_comparison = data.get("code_comparison")
    if not code_example and isinstance(code_comparison, dict):
        parts = []
        if code_comparison.get("sequential"):
            parts.append(f"// Sequential\n{code_comparison['sequential']}")
        if code_comparison.get("parallel"):
            parts.append(f"// Parallel\n{code_comparison['parallel']}")
        if parts:
            code_example = "\n\n".join(parts)

    return {
        "answer": str(answer).strip(),
        "analogy": str(analogy).strip(),
        "code_example": str(code_example).strip() if code_example else None,
    }


# ── Agent ──────────────────────────────────────────────────────────────────────

async def solve_doubt(req: DoubtRequest) -> DoubtResponse:
    """
    Analyzes a student question with full context windowing and RAG grounding.
    """
    supabase = get_supabase()

    # Ensure every request has a session_id (creates a new session if caller omits it)
    session_id = req.session_id or str(uuid.uuid4())

    # ── 1. Long-term memory (cross-day personalization) ────────────────────────
    user_memory = await get_user_memory(req.user_id)

    # ── 2. Session context window (rolling summary within this session) ────────
    context_window = await build_context_window(
        user_id=req.user_id,
        session_id=session_id,
        current_question=req.question,
    )

    # ── 3. Build system prompt with memory injected ────────────────────────────
    effective_system_prompt = SYSTEM_PROMPT
    if user_memory:
        effective_system_prompt += f"\n\n{user_memory}"

    # ── 4. RAG — retrieve relevant grounding context ───────────────────────────
    rag_chunks = await retrieve_chunks(
        query=f"{req.question} {req.topic}",
        user_id=req.user_id,
        skill_tag=req.skill.lower(),
        top_k=3,
        include_curated=True,
    )
    rag_context = format_rag_context(rag_chunks) if rag_chunks else "No specific context available."

    # ── 5. Construct user prompt (with conversation history inline) ────────────
    history_block = f"\n\n{context_window}" if context_window else ""
    user_prompt = f"""{history_block}

STUDENT CONTEXT:
- Learning: {req.skill}
- Current Topic: {req.topic}
- Question: {req.question}

[RELEVANT DOCUMENTATION]
{rag_context}

Please provide a structured JSON response with:
- "answer": pedagogical explanation using the Socratic method
- "analogy": a relatable non-technical analogy that bridges to the concept
- "code_example": a focused minimal code snippet, or null if not applicable
"""

    # ── 6. LLM generation via multi-key router with JSON mode ─────────────────
    try:
        raw_text = await llm_router.generate_json(
            prompt=user_prompt,
            system_instruction=effective_system_prompt,
            temperature=0.6,
            max_output_tokens=8192,
        )
        data = _extract_json_payload(raw_text)
        normalized = _normalize_doubt_payload(data)
        result = DoubtResponse(**normalized)

        if not result.answer:
            raise ValueError("Model response missing answer field")
        if not result.analogy:
            result = DoubtResponse(
                answer=result.answer,
                analogy=(
                    f"Think of {req.topic} like practicing a skill in steps: "
                    "first understand the intent, then apply it in a small example."
                ),
                code_example=result.code_example,
            )

    except Exception as e:
        logger.exception("Doubt generation failed for topic '%s': %s", req.topic, e)
        result = DoubtResponse(
            answer=(
                "I encountered a slight hiccup while processing that. "
                "Let's look at the core concept again: " + req.topic
            ),
            analogy="Think of learning like debugging code—sometimes we just need to refresh the state and try again.",
            code_example=None,
        )

    # ── 7. Persist new conversation turns ─────────────────────────────────────
    # Save user question + assistant answer to the rolling window (fire-and-forget)
    try:
        await append_turn(req.user_id, session_id, "user", req.question)
        await append_turn(req.user_id, session_id, "assistant", result.answer)
    except Exception:
        pass  # Never block the student response

    # ── 8. Persist to doubts table for analytics ───────────────────────────────
    try:
        profile_row = (
            supabase.table("profiles")
            .select("id")
            .eq("id", req.user_id)
            .limit(1)
            .execute()
        )
        if getattr(profile_row, "data", None):
            supabase.table("doubts").insert({
                "user_id": req.user_id,
                "lesson_id": req.lesson_id,
                "topic": req.topic,
                "skill": req.skill,
                "question": req.question,
                "answer": result.answer,
                "analogy": result.analogy,
                "code_example": result.code_example,
                "created_at": "now()",
            }).execute()
    except Exception as db_err:
        logger.warning("Database logging error in solve_doubt: %s", db_err)

    # ── 9. Update long-term memory (fire-and-forget) ───────────────────────────
    try:
        summary = await summarize_session(
            topic=req.topic,
            skill=req.skill,
            struggle_description=req.question[:150],
        )
        await append_memory(req.user_id, summary, topics=[req.topic])
    except Exception:
        pass

    return result
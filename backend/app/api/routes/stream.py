"""
Stream API Routes — SkillMentor AI
Exposes Server-Sent Events (SSE) endpoints that let the frontend
subscribe to real-time Gemini streaming including:
  - AI thought/reasoning chunks (ThinkingConfig output)
  - Final answer text chunks

This powers the "AI Thought Process" visualizer in the lesson UI.
"""
import json
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.core.gemini import stream_mentor_response
from app.services.rag_service import retrieve_chunks, format_rag_context

router = APIRouter(prefix="/stream", tags=["Streaming"])


# ── System prompts used per context ─────────────────────────

_LESSON_SYSTEM_PROMPT = (
    "You are the Lead Pedagogical Agent for SkillMentor AI. "
    "Transform technical documentation into an engaging, high-retention lesson. "
    "Use the Feynman Technique: explain complex topics using simple analogies. "
    "Be warm, direct, and mentor-like in tone."
)

_ROADMAP_SYSTEM_PROMPT = (
    "You are the Roadmap Architect Agent for SkillMentor AI. "
    "Design a structured, phased learning path for the user's skill goal. "
    "Focus on practical milestones and real-world applicability."
)

_DOUBT_SYSTEM_PROMPT = (
    "You are the Doubt Solver Agent for SkillMentor AI. "
    "Provide a clear, concise, and student-friendly explanation. "
    "Always end with a relatable analogy and a concrete example."
)


# ── SSE helpers ──────────────────────────────────────────────

def _sse_event(data: dict) -> str:
    """Formats a dict as a valid SSE `data:` line."""
    return f"data: {json.dumps(data)}\n\n"


def _sse_headers() -> dict:
    return {
        "Cache-Control": "no-cache",
        "Connection":    "keep-alive",
        # Prevents Nginx / Vercel from buffering the stream
        "X-Accel-Buffering": "no",
    }


# ── Endpoints ────────────────────────────────────────────────

@router.get("/think")
async def stream_ai_thinking(
    prompt:      str           = Query(..., description="The user-visible question or topic"),
    context:     str           = Query("lesson", description="Context label: lesson | roadmap | doubt"),
    topic:       str           = Query("", description="Current lesson/roadmap topic"),
    skill:       str           = Query("", description="Skill being learned"),
    level:       str           = Query("beginner"),
    user_id:     Optional[str] = Query(None),
    roadmap_id:  Optional[str] = Query(None),
):
    """
    SSE endpoint — streams Gemini thought + answer chunks.

    Each event has the shape:
        data: {"type": "thought"|"text"|"done"|"error", "text": "..."}

    The frontend `useStreamingAI` hook connects here and splits
    the stream into two buckets: `thoughts` and `content`.
    """

    # Select system prompt based on context
    system_prompt_map = {
        "lesson":  _LESSON_SYSTEM_PROMPT,
        "roadmap": _ROADMAP_SYSTEM_PROMPT,
        "doubt":   _DOUBT_SYSTEM_PROMPT,
    }
    system_prompt = system_prompt_map.get(context, _LESSON_SYSTEM_PROMPT)

    # Optionally enrich with RAG context when a user + skill are provided
    rag_context = ""
    if user_id and skill:
        try:
            chunks = await retrieve_chunks(
                query=f"{topic or prompt} {skill}",
                user_id=user_id,
                skill_tag=skill.lower(),
                top_k=3,
                include_curated=True,
            )
            rag_context = format_rag_context(chunks)
        except Exception:
            pass  # RAG failure is non-fatal; proceed with base knowledge

    # Build the full prompt sent to Gemini
    full_prompt = _build_prompt(
        context=context,
        user_prompt=prompt,
        topic=topic,
        skill=skill,
        level=level,
        rag_context=rag_context,
    )

    async def event_generator():
        async for chunk in stream_mentor_response(full_prompt, system_prompt):
            yield _sse_event(chunk)
            # `done` and `error` are terminal; stop iteration
            if chunk["type"] in ("done", "error"):
                return

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=_sse_headers(),
    )


def _build_prompt(
    context: str,
    user_prompt: str,
    topic: str,
    skill: str,
    level: str,
    rag_context: str,
) -> str:
    """Builds a context-appropriate prompt for the streaming endpoint."""

    rag_block = (
        f"\n\n[RELEVANT DOCUMENTATION]\n{rag_context}" if rag_context else ""
    )

    if context == "lesson":
        return (
            f"You are teaching {skill or 'a new skill'} to a {level} learner.\n"
            f"Current topic: {topic or user_prompt}.\n"
            f"{rag_block}\n\n"
            f"The learner asks or needs: {user_prompt}\n\n"
            "Provide a thorough explanation with an analogy and a code example if applicable."
        )

    if context == "roadmap":
        return (
            f"Design a learning roadmap for: {user_prompt}.\n"
            f"Skill: {skill or user_prompt}, Level: {level}.\n"
            f"{rag_block}\n\n"
            "Explain your reasoning for each phase selection."
        )

    # doubt (default)
    return (
        f"Solve this doubt about {topic or skill}: {user_prompt}\n"
        f"{rag_block}\n\n"
        "Provide a clear explanation, an analogy, and a code example."
    )

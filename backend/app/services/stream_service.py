import json
from typing import Optional, AsyncGenerator

from app.core.gemini import stream_mentor_response
from app.services.rag_service import retrieve_chunks, format_rag_context

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

class StreamService:
    def _build_prompt(
        self,
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

    def _sse_event(self, data: dict) -> str:
        """Formats a dict as a valid SSE `data:` line."""
        return f"data: {json.dumps(data)}\n\n"

    def get_sse_headers(self) -> dict:
        return {
            "Cache-Control": "no-cache",
            "Connection":    "keep-alive",
            # Prevents Nginx / Vercel from buffering the stream
            "X-Accel-Buffering": "no",
        }

    async def stream_ai_thinking(
        self,
        prompt: str,
        context: str,
        topic: str,
        skill: str,
        level: str,
        user_id: Optional[str],
        roadmap_id: Optional[str],
        enable_thinking: bool,
    ) -> AsyncGenerator[str, None]:
        
        system_prompt_map = {
            "lesson":  _LESSON_SYSTEM_PROMPT,
            "roadmap": _ROADMAP_SYSTEM_PROMPT,
            "doubt":   _DOUBT_SYSTEM_PROMPT,
        }
        system_prompt = system_prompt_map.get(context, _LESSON_SYSTEM_PROMPT)

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

        full_prompt = self._build_prompt(
            context=context,
            user_prompt=prompt,
            topic=topic,
            skill=skill,
            level=level,
            rag_context=rag_context,
        )

        async for chunk in stream_mentor_response(full_prompt, system_prompt, enable_thinking=enable_thinking):
            yield self._sse_event(chunk)
            if chunk["type"] in ("done", "error"):
                return

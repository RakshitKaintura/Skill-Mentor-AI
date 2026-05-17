"""
Agent Memory Service — Rolling Summary Buffer with Context Windowing

Architecture:
  - Conversations are stored turn-by-turn in the `conversation_history` Supabase table.
  - Before each LLM call the history is fetched, token-counted with tiktoken, and
    compressed if it exceeds TOKEN_HARD_LIMIT.
  - Compression: oldest messages are summarized into a single [Context Summary] block
    via the LLM router (one cheap, small call), then re-inserted at the head of
    the window. This "rolling summary" approach keeps context relevant indefinitely
    without blowing up the prompt token count.
  - The post-session summary block (user_memory table) is preserved as a separate,
    longer-lived store for personalization across different days/skills.

Supabase tables used:
  - conversation_history (user_id, session_id, role, content, token_count, created_at)
  - user_memory          (user_id, session_summary, topics, created_at)
"""
import logging
from typing import Optional
from datetime import datetime, timezone

from app.core.database import get_supabase

logger = logging.getLogger(__name__)

# ── Token budget constants ─────────────────────────────────────────────────────
#
# GPT-4o-mini / Gemini Flash both have 128k context windows, but we keep the
# injected history well below that for speed and cost efficiency.
TOKEN_HARD_LIMIT = 4000   # max tokens of chat history injected into a prompt
TOKEN_SOFT_LIMIT = 3000   # target size *after* compression
MAX_MEMORY_ENTRIES = 7    # max user_memory (long-term) rows per user

# ── Tokenizer ─────────────────────────────────────────────────────────────────

def _count_tokens(text: str) -> int:
    """Count tokens using tiktoken (cl100k_base — compatible with GPT-4 and Gemini)."""
    try:
        import tiktoken
        enc = tiktoken.get_encoding("cl100k_base")
        return len(enc.encode(text))
    except Exception:
        # Fallback: rough 4-chars-per-token estimate
        return len(text) // 4


# ── Conversation history helpers ──────────────────────────────────────────────

async def get_conversation_history(
    user_id: str,
    session_id: str,
    limit: int = 40,
) -> list[dict]:
    """
    Fetches recent turns for a session from Supabase.
    Returns a list of {role, content, token_count} dicts, oldest-first.
    """
    try:
        supabase = get_supabase()
        result = (
            supabase.table("conversation_history")
            .select("role, content, token_count, created_at")
            .eq("user_id", user_id)
            .eq("session_id", session_id)
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.warning("get_conversation_history failed: %s", e)
        return []


async def append_turn(
    user_id: str,
    session_id: str,
    role: str,
    content: str,
) -> None:
    """
    Saves a single conversation turn to the database.
    Computes the token count inline for future windowing decisions.
    """
    token_count = _count_tokens(content)
    try:
        supabase = get_supabase()
        supabase.table("conversation_history").insert({
            "user_id": user_id,
            "session_id": session_id,
            "role": role,                       # "user" | "assistant"
            "content": content.strip()[:4000],  # hard cap per turn
            "token_count": token_count,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning("append_turn failed: %s", e)


# ── Context windowing (the core algorithm) ────────────────────────────────────

async def build_context_window(
    user_id: str,
    session_id: str,
    current_question: str,
) -> str:
    """
    Constructs a context string to inject before the agent's main prompt.

    Algorithm:
      1. Fetch recent turns from the database.
      2. Count tokens. If under TOKEN_HARD_LIMIT → format and return.
      3. If OVER limit → isolate the oldest half, summarize them with the LLM,
         replace them with a single [Context Summary] block, and format the rest.

    Returns:
      A formatted string block ready to prepend to any system or user prompt.
      Empty string if no history exists.
    """
    turns = await get_conversation_history(user_id, session_id, limit=40)
    if not turns:
        return ""

    # Current question will also be added — include its tokens in the budget
    question_tokens = _count_tokens(current_question)
    total_tokens = sum(t.get("token_count", 0) for t in turns) + question_tokens

    if total_tokens <= TOKEN_HARD_LIMIT:
        return _format_history(turns)

    # --- Compression required ---
    logger.info(
        "Context window for user=%s session=%s exceeds %d tokens (%d). Compressing…",
        user_id, session_id, TOKEN_HARD_LIMIT, total_tokens
    )

    # Split: oldest half goes to summary, newest half stays verbatim
    split_idx = len(turns) // 2
    old_turns = turns[:split_idx]
    recent_turns = turns[split_idx:]

    summary_block = await _summarize_turns(old_turns)

    # Build compressed window
    compressed = [{"role": "system_summary", "content": summary_block}] + recent_turns
    return _format_history(compressed)


def _format_history(turns: list[dict]) -> str:
    """Converts a list of turn dicts into a readable history block for an agent prompt."""
    if not turns:
        return ""

    lines = []
    for turn in turns:
        role = turn.get("role", "unknown")
        content = turn.get("content", "").strip()
        if not content:
            continue

        if role == "system_summary":
            lines.append(f"[Context Summary]\n{content}")
        elif role == "user":
            lines.append(f"Student: {content}")
        elif role == "assistant":
            lines.append(f"Mentor: {content}")

    if not lines:
        return ""

    return (
        "[CONVERSATION HISTORY]\n"
        "The following is the ongoing conversation. Use it to provide continuity:\n\n"
        + "\n\n".join(lines)
        + "\n\n[END HISTORY]"
    )


async def _summarize_turns(turns: list[dict]) -> str:
    """
    Uses the LLM router to condense a list of old conversation turns into a
    compact summary block. Falls back to a simple text join if the LLM fails.
    """
    if not turns:
        return ""

    formatted = "\n".join(
        f"{t.get('role', 'unknown').capitalize()}: {t.get('content', '').strip()}"
        for t in turns
        if t.get("content")
    )

    try:
        # Import here to avoid circular dependency at module load time
        from app.core.llm_router import llm_router

        summary = await llm_router.generate(
            prompt=(
                "Summarize the following student-mentor conversation in 3–5 concise bullet points. "
                "Focus on what the student struggled with, what was clarified, and any code patterns discussed. "
                "Be dense and factual — this summary will be injected into a future AI prompt:\n\n"
                + formatted
            ),
            system_instruction=(
                "You are a precise educational summarizer. Output only a bulleted summary. "
                "No introductions, no closing remarks."
            ),
            temperature=0.3,
            max_output_tokens=300,
        )
        return summary.strip()

    except Exception as e:
        logger.warning("LLM summarization failed, falling back to raw truncation: %s", e)
        # Graceful fallback: return raw text truncated to soft limit chars
        raw = "\n".join(
            f"{t.get('role','?')}: {t.get('content','')[:200]}"
            for t in turns
        )
        return raw[:TOKEN_SOFT_LIMIT * 4]  # rough char estimate


# ── Long-term memory (cross-session personalization) ──────────────────────────

async def get_user_memory(user_id: str) -> str:
    """
    Fetches the rolling long-term memory block for a user.
    Returns a formatted string ready to inject into an agent's system prompt.
    """
    try:
        supabase = get_supabase()
        result = (
            supabase.table("user_memory")
            .select("session_summary, topics, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(MAX_MEMORY_ENTRIES)
            .execute()
        )

        rows = result.data or []
        if not rows:
            return ""

        memory_lines = []
        for row in reversed(rows):
            created = row.get("created_at", "")
            try:
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                date_str = dt.strftime("%b %d")
            except Exception:
                date_str = "Earlier"

            topics = row.get("topics") or []
            topics_str = f" (Topics: {', '.join(topics)})" if topics else ""
            summary = row.get("session_summary", "").strip()
            if summary:
                memory_lines.append(f"• [{date_str}]{topics_str}: {summary}")

        if not memory_lines:
            return ""

        memory_text = "\n".join(memory_lines)
        # Truncate at 3000 chars to prevent token overflow
        if len(memory_text) > 3000:
            memory_text = memory_text[-3000:]

        return (
            "[USER LEARNING HISTORY]\n"
            "Use this to personalize your response and build on prior knowledge:\n\n"
            + memory_text
            + "\n\n[END HISTORY]"
        )

    except Exception as e:
        logger.warning("get_user_memory failed for %s: %s", user_id, e)
        return ""


async def append_memory(
    user_id: str,
    session_summary: str,
    topics: Optional[list[str]] = None,
) -> None:
    """
    Appends a session summary to the user's long-term memory buffer.
    Evicts the oldest entry when the rolling window exceeds MAX_MEMORY_ENTRIES.
    """
    if not session_summary or not session_summary.strip():
        return

    try:
        supabase = get_supabase()
        supabase.table("user_memory").insert({
            "user_id": user_id,
            "session_summary": session_summary.strip()[:500],
            "topics": topics or [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

        all_entries = (
            supabase.table("user_memory")
            .select("id, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        rows = all_entries.data or []
        if len(rows) > MAX_MEMORY_ENTRIES:
            ids_to_delete = [r["id"] for r in rows[MAX_MEMORY_ENTRIES:]]
            supabase.table("user_memory").delete().in_("id", ids_to_delete).execute()
            logger.debug("Evicted %d old memory entries for user %s", len(ids_to_delete), user_id)

    except Exception as e:
        logger.warning("append_memory failed for user %s: %s", user_id, e)


async def summarize_session(
    topic: str,
    skill: str,
    key_takeaway: Optional[str] = None,
    struggle_description: Optional[str] = None,
) -> str:
    """Generates a compact session summary string stored in long-term memory."""
    parts = [f"Studied '{topic}' in {skill}."]
    if key_takeaway:
        parts.append(f"Key takeaway: {key_takeaway[:200]}")
    if struggle_description:
        parts.append(f"Struggled with: {struggle_description[:150]}")
    return " ".join(parts)

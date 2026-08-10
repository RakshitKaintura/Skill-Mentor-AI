import json
from typing import Optional

from fastapi import APIRouter, Query, Depends
from fastapi.responses import StreamingResponse

from app.services.stream_service import StreamService

router = APIRouter(prefix="/stream", tags=["Streaming"])

def get_stream_service() -> StreamService:
    return StreamService()

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
    enable_thinking: bool      = Query(False, description="Whether to include AI thought process"),
    service: StreamService     = Depends(get_stream_service)
):
    """
    SSE endpoint — streams Gemini thought + answer chunks.

    Each event has the shape:
        data: {"type": "thought"|"text"|"done"|"error", "text": "..."}

    The frontend `useStreamingAI` hook connects here and splits
    the stream into two buckets: `thoughts` and `content`.
    """

    event_generator = service.stream_ai_thinking(
        prompt=prompt,
        context=context,
        topic=topic,
        skill=skill,
        level=level,
        user_id=user_id,
        roadmap_id=roadmap_id,
        enable_thinking=enable_thinking,
    )

    return StreamingResponse(
        event_generator,
        media_type="text/event-stream",
        headers=service.get_sse_headers(),
    )

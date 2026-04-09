"""
Voice API Routes — Real-time Pedagogical Interaction
Orchestrates a stateful WebSocket session between the student and Gemini 3.1 Flash Lite Preview.
"""
import json
import asyncio
from typing import Dict, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from google.genai import types

from app.core.config import get_settings
from app.core.database import get_supabase
from app.core.gemini import get_gemini_client  # Standardized Client pattern

router = APIRouter(prefix="/voice", tags=["Voice"])
settings = get_settings()

# System instructions optimized for natural, low-latency voice delivery
VOICE_SYSTEM_PROMPT = """You are the Voice Mentor for SkillMentor AI. 
Your goal is to conduct an interactive, hands-free verbal lesson.

OPERATING GUIDELINES:
1. CONVERSATIONAL PACE: Use short, punchy sentences. Avoid long lists or complex technical jargon.
2. VERBAL CUES: Use phrases like "Does that make sense?" or "Imagine this..." to keep the student engaged.
3. INTERRUPTION HANDLING: If the student speaks, acknowledge their immediate thought before continuing.
4. ANALOGY FIRST: Always explain a concept with a 1-sentence real-world analogy before giving the technical definition.
5. ENCOURAGEMENT: Maintain a high-energy, supportive coaching persona."""

@router.websocket("/ws")
async def voice_websocket(
    websocket: WebSocket,
    topic: str = Query(...),
    skill: str = Query(...),
    level: str = Query("beginner"),
    user_id: str = Query(default=""),
    lesson_id: str = Query(default=""),
):
    """
    WebSocket entry point for real-time AI tutoring sessions.
    Handles session state, database logging, and error recovery.
    """
    await websocket.accept()
    start_time = asyncio.get_event_loop().time()
    
    # Context-aware instruction injection
    instruction = f"{VOICE_SYSTEM_PROMPT}\n\nCURRENT CONTEXT:\n- Skill: {skill}\n- Topic: {topic}\n- Student Level: {level}"

    try:
        # Initialize the stateful session
        await _handle_voice_lifecycle(websocket, instruction, topic, skill)
        
    except WebSocketDisconnect:
        # Calculate and log session metrics for user progress analytics
        duration = int(asyncio.get_event_loop().time() - start_time)
        if user_id:
            _log_session_stats(user_id, lesson_id, topic, skill, duration)
            
    except Exception as e:
        error_msg = {"type": "error", "message": f"Session Interrupted: {str(e)}"}
        await websocket.send_text(json.dumps(error_msg))
    finally:
        try:
            await websocket.close()
        except:
            pass

async def _handle_voice_lifecycle(websocket: WebSocket, instruction: str, topic: str, skill: str):
    """Manages the message loop and AI response generation."""
    client = get_gemini_client()
    teaching_started = False
    
    # 1. Initial Greeting
    greeting_prompt = f"Give a warm, 2-sentence welcome for a lesson on {topic}. Ask the student one question about their experience with it."
    
    try:
        initial_resp = await _generate_content_with_retry(client, greeting_prompt, instruction)
        greeting_text = (initial_resp.text or "").strip()
        if not greeting_text:
            greeting_text = (
                f"Welcome! We will cover {topic} step by step. "
                "Tell me your current comfort level so I can adapt the pace."
            )
    except Exception:
        greeting_text = (
            f"Welcome! I am ready to help with {topic}. "
            "The AI service is temporarily busy, so responses may be delayed for a few seconds."
        )

    await websocket.send_text(json.dumps({
        "type": "transcript_ai",
        "text": greeting_text
    }))

    # 2. Continuous Interaction Loop
    while True:
        # 5-minute timeout for inactive sessions
        try:
            raw_data = await asyncio.wait_for(websocket.receive_text(), timeout=300)
            msg = json.loads(raw_data)
        except asyncio.TimeoutError:
            await websocket.send_text(json.dumps({
                "type": "transcript_ai", 
                "text": "I'm still here if you have more questions! Otherwise, we can wrap up for today."
            }))
            continue

        msg_type = msg.get("type")

        if msg_type == "text":
            user_input = msg.get("content", "").strip()
            if not user_input: continue
            
            # Echo user input for UI feedback
            await websocket.send_text(json.dumps({"type": "transcript_user", "text": user_input}))
            
            # Generate adaptive response
            await _stream_voice_response(websocket, client, instruction, user_input)
            teaching_started = True

        elif msg_type == "audio":
            # Audio chunks arrive very frequently. Avoid replying to each chunk.
            # Start a guided lesson stream once and continue listening silently afterwards.
            if not teaching_started:
                teaching_started = True
                await _stream_voice_response(
                    websocket,
                    client,
                    instruction,
                    f"Start teaching {topic} for a {skill} learner in short spoken-friendly steps. "
                    "Give one analogy and one tiny practical checkpoint question.",
                )

        elif msg_type == "interrupt":
            # Visual feedback that the AI has 'stopped' to listen
            teaching_started = False
            await websocket.send_text(json.dumps({"type": "interrupted"}))

async def _stream_voice_response(websocket: WebSocket, client: Any, instruction: str, user_input: str):
    """Streams the AI response sentence-by-sentence to optimize for Text-to-Speech frontends."""
    try:
        response = await _generate_content_with_retry(client, user_input, instruction)

        text = (response.text or "").strip()
        if not text:
            await websocket.send_text(json.dumps({
                "type": "transcript_ai",
                "text": "I had trouble generating the next explanation. Please ask again in one short sentence.",
            }))
            return

        # Split by sentence-ending punctuation for smoother transcript updates.
        buffer = text
        while any(p in buffer for p in [".", "?", "!"]):
            nearest = [i for i in [buffer.find("."), buffer.find("?"), buffer.find("!")] if i != -1]
            idx = min(nearest) if nearest else -1
            if idx == -1:
                break
            sentence = buffer[:idx + 1].strip()
            buffer = buffer[idx + 1:].strip()
            if sentence:
                await websocket.send_text(json.dumps({
                    "type": "transcript_ai",
                    "text": sentence,
                }))

        if buffer:
            await websocket.send_text(json.dumps({"type": "transcript_ai", "text": buffer}))

    except Exception as e:
        print(f"Voice processing failed: {e}")
        await websocket.send_text(json.dumps({
            "type": "transcript_ai",
            "text": "I hit a temporary voice processing issue. Try speaking again or use a short text question.",
        }))

def _log_session_stats(user_id: str, lesson_id: str, topic: str, skill: str, duration: int):
    """Persists session metadata to Supabase for the user's learning dashboard."""
    try:
        get_supabase().table("voice_sessions").insert({
            "user_id": user_id,
            "lesson_id": lesson_id if lesson_id else None,
            "topic": topic,
            "skill": skill,
            "duration_seconds": duration,
            "status": "completed"
        }).execute()
    except Exception as e:
        print(f"Analytics Logging Failed: {e}")


def _is_transient_model_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return (
        "503" in message
        or "unavailable" in message
        or "resource_exhausted" in message
        or "rate limit" in message
        or "quota" in message
        or "temporarily" in message
    )


async def _generate_content_with_retry(client: Any, prompt: str, instruction: str, attempts: int = 3):
    last_exc: Exception | None = None

    for attempt in range(1, attempts + 1):
        try:
            return client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config=types.GenerateContentConfig(system_instruction=instruction),
            )
        except Exception as exc:
            last_exc = exc
            if not _is_transient_model_error(exc) or attempt == attempts:
                raise

            # Exponential backoff: 0.5s, 1.0s, 2.0s
            delay = 0.5 * (2 ** (attempt - 1))
            await asyncio.sleep(delay)

    raise RuntimeError(f"Model generation failed after retries: {last_exc}")
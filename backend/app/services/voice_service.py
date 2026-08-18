import asyncio
import json
import re
from typing import Any

import httpx
from fastapi import WebSocket
from google.genai import types
from google.genai.errors import APIError as GenAIError
from postgrest.exceptions import APIError
from supabase import Client

from app.core.config import get_settings
from app.core.gemini import get_gemini_client

VOICE_SYSTEM_PROMPT = """You are the Voice Mentor for SkillMentor AI. 
Your goal is to conduct an interactive, hands-free verbal lesson.

OPERATING GUIDELINES:
1. CONVERSATIONAL PACE: Use short, punchy sentences. Avoid long lists or complex technical jargon.
2. VERBAL CUES: Use phrases like "Does that make sense?" or "Imagine this..." to keep the student engaged.
3. INTERRUPTION HANDLING: If the student speaks, acknowledge their immediate thought before continuing.
4. ANALOGY FIRST: Always explain a concept with a 1-sentence real-world analogy before giving the technical definition.
5. ENCOURAGEMENT: Maintain a high-energy, supportive coaching persona.
6. EMOTIONAL AWARENESS: If the student expresses frustration, confusion, or says "this is too hard", immediately pause the current curriculum step. Offer validating, encouraging words and switch to a simpler, more relatable analogy before checking if they feel better.
7. WHITEBOARD VISUALS: If you need to show a visual, flowchart, or code block to aid your explanation, output it EXACTLY within these tags: [VISUAL: <markdown here>]. For example: [VISUAL: ```mermaid\ngraph TD;\nA-->B;\n```]. Do NOT verbally read the code out loud. Just say "Take a look at the visual I just shared" and include the [VISUAL: ...] block in your text.

LESSON STRUCTURE (MANDATORY FLOW):
1. INTRODUCTION: Welcome the user and define specific sub-topics you will cover today (decide how many sub-topics are needed based on the current lesson, usually 2 to 5).
2. TEACHING LOOP: Teach one sub-topic at a time. After explaining it, ask a tiny checkpoint question. Wait for the user to answer. 
   - If they are correct, praise them and move to the next sub-topic. 
   - If incorrect, gently correct them and re-test before moving on.
3. CONCLUSION: Once ALL sub-topics are covered, do NOT keep teaching new material. Explicitly ask: "We have covered everything for today! Is there anything you want to revise, or should we summarize and end the session?"
4. ENDING: If they say they want to end, give a 2-sentence summary and say "You can click the End Session button now. Great job today!"
"""


class VoiceService:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.settings = get_settings()
        self.client = get_gemini_client()

    def get_instruction(self, topic: str, skill: str, level: str, socratic: bool = False) -> str:
        prompt = f"{VOICE_SYSTEM_PROMPT}\n\nCURRENT CONTEXT:\n- Skill: {skill}\n- Topic: {topic}\n- Student Level: {level}"
        if socratic:
            prompt += "\n\nSOCRATIC MODE IS ENABLED: You must NEVER give the direct answer to the student's questions. Always respond with a leading question to guide them to the answer themselves."
        return prompt

    def log_session_stats(self, user_id: str, lesson_id: str, topic: str, skill: str, duration: int) -> None:
        """Persists session metadata to Supabase for the user's learning dashboard."""
        try:
            self.supabase.table("voice_sessions").insert({
                "user_id": user_id,
                "lesson_id": lesson_id if lesson_id else None,
                "topic": topic,
                "skill": skill,
                "duration_seconds": duration,
                "status": "completed"
            }).execute()
        except (APIError, httpx.RequestError) as e:
            print(f"Analytics Logging Failed: {e}")

    async def handle_voice_lifecycle(self, websocket: WebSocket, instruction: str, topic: str, skill: str) -> None:
        """Manages the message loop and AI response generation."""
        teaching_started = False
        
        # Initialize a stateful chat session
        chat = self.client.aio.chats.create(
            model=self.settings.gemini_model,
            config=types.GenerateContentConfig(system_instruction=instruction),
        )
        
        # 1. Initial Greeting
        greeting_prompt = f"Give a warm, 2-sentence welcome for a lesson on {topic}. Briefly list the sub-topics you will teach (decide based on the topic if it should be 2, 3, 4, or 5 topics), and ask if they are ready to begin."
        
        try:
            initial_resp = await self._send_message_with_retry(chat, greeting_prompt)
            greeting_text = (initial_resp.text or "").strip()
            if not greeting_text:
                greeting_text = (
                    f"Welcome! We will cover {topic} step by step. "
                    "Tell me your current comfort level so I can adapt the pace."
                )
        except (RuntimeError, GenAIError):
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
                await self._stream_voice_response(websocket, chat, user_input)
                teaching_started = True

            elif msg_type == "audio":
                # Audio chunks arrive very frequently. Avoid replying to each chunk.
                # Start a guided lesson stream once and continue listening silently afterwards.
                if not teaching_started:
                    teaching_started = True
                    await self._stream_voice_response(
                        websocket,
                        chat,
                        f"Start teaching the first sub-topic of {topic} for a {skill} learner. "
                        "Give one analogy and one tiny practical checkpoint question. Wait for my answer.",
                    )

            elif msg_type == "interrupt":
                # Visual feedback that the AI has 'stopped' to listen
                teaching_started = False
                await websocket.send_text(json.dumps({"type": "interrupted"}))

    async def _stream_voice_response(self, websocket: WebSocket, chat: Any, user_input: str) -> None:
        """Streams the AI response sentence-by-sentence to optimize for Text-to-Speech frontends."""
        try:
            response = await self._send_message_with_retry(chat, user_input)

            text = (response.text or "").strip()
            if not text:
                await websocket.send_text(json.dumps({
                    "type": "transcript_ai",
                    "text": "I had trouble generating the next explanation. Please ask again in one short sentence.",
                }))
                return

            # Extract any [VISUAL: ...] blocks before sending to TTS
            visuals = re.findall(r'\[VISUAL:\s*(.*?)\s*\]', text, flags=re.DOTALL)
            for visual in visuals:
                await websocket.send_text(json.dumps({
                    "type": "transcript_visual",
                    "content": visual.strip()
                }))
            
            # Remove the visual blocks from the text that will be spoken
            text = re.sub(r'\[VISUAL:\s*.*?\s*\]', '', text, flags=re.DOTALL).strip()

            # Split by sentence-ending punctuation followed by whitespace for smoother transcript updates.
            # This prevents splitting on numbers like 0.7 or inside code blocks.
            sentences = re.split(r'(?<=[.!?])\s+', text)
            for sentence in sentences:
                sentence = sentence.strip()
                if sentence:
                    await websocket.send_text(json.dumps({
                        "type": "transcript_ai",
                        "text": sentence,
                    }))

        except (RuntimeError, GenAIError) as e:
            print(f"Voice processing failed: {e}")
            await websocket.send_text(json.dumps({
                "type": "transcript_ai",
                "text": "I hit a temporary voice processing issue. Try speaking again or use a short text question.",
            }))

    def _is_transient_model_error(self, exc: Exception) -> bool:
        message = str(exc).lower()
        return (
            "503" in message
            or "unavailable" in message
            or "resource_exhausted" in message
            or "rate limit" in message
            or "quota" in message
            or "temporarily" in message
        )

    async def _send_message_with_retry(self, chat: Any, prompt: str, attempts: int = 3) -> Any:
        last_exc: Exception | None = None

        for attempt in range(1, attempts + 1):
            try:
                return await chat.send_message(prompt)
            except Exception as exc:
                last_exc = exc
                if not self._is_transient_model_error(exc) or attempt == attempts:
                    raise

                # Exponential backoff: 0.5s, 1.0s, 2.0s
                delay = 0.5 * (2 ** (attempt - 1))
                await asyncio.sleep(delay)

        raise RuntimeError(f"Model generation failed after retries: {last_exc}")

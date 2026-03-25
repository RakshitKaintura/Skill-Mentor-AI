"""
TTS Service — Text to Speech Orchestration
Prepares lesson content for browser-side Web Speech API or Cloud TTS engines.
Generates structured, time-stamped segments for synchronized audio-visual learning.
"""
import json
import logging
import re
from typing import List, Dict, Any

from google.genai import types
from app.core.gemini import get_gemini_client  # Standardized Client pattern

logger = logging.getLogger(__name__)

def prepare_tts_text(text: str) -> str:
    """
    Sanitizes lesson content for Text-to-Speech engines.
    Removes technical artifacts (markdown, code) that disrupt auditory flow.
    """
    if not text:
        return ""
    
    # Replace code blocks with descriptive auditory cues
    text = re.sub(r'```[\s\S]*?```', '[Refer to the code example shown on your screen]', text)
    # Remove inline code backticks but keep the text for context
    text = re.sub(r'`([^`]+)`', r'\1', text)
    
    # Strip markdown formatting (bold, italics, headers)
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'#+\s', '', text)
    
    # Normalize spacing for better natural pausing
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text.strip()

async def generate_tts_segments(lesson_text: str, topic: str) -> List[Dict[str, Any]]:
    """
    Deconstructs a lesson into speakable segments with estimated timing.
    Enables synchronized 'Karaoke-style' highlighting on the frontend.
    """
    client = get_gemini_client()
    clean_text = prepare_tts_text(lesson_text)

    # Professional System Instruction for March 2026 SDK
    system_instruction = (
        "You are a Pedagogical Audio Engineer. Your task is to split technical "
        "lesson text into natural, speakable segments for an AI tutor. "
        "Each segment must be grammatically complete and logically paced."
    )

    prompt = f"""
    Transform the following lesson on "{topic}" into a timed JSON array for TTS playback.

    [CONSTRAINTS]
    - Segment length: 1-3 sentences (approx. 10-25 seconds).
    - Speech Rate: Assume 140 words per minute.
    - Types: "intro", "concept", "analogy", "code_note", "summary".
    - Total segments: Max 10.

    [LESSON TEXT]
    {clean_text[:3500]}

    [JSON STRUCTURE]
    [
      {{
        "segment_id": 1,
        "type": "intro",
        "text": "The actual text to be spoken...",
        "estimated_secs": 12
      }}
    ]
    """

    # Native JSON Mode enforcement
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type='application/json'
        )
    )

    try:
        segments = json.loads(response.text)
        return segments
    except Exception as e:
        logger.error(f"TTS Segment Generation Failed: {e}")
        # Robust fallback for UI stability
        return [{
            "segment_id": 1,
            "type": "intro",
            "text": f"Welcome to our lesson on {topic}. Let's dive in.",
            "estimated_secs": 5
        }]

def get_tts_voice_config(skill: str) -> Dict[str, Any]:
    """
    Returns optimized voice parameters for the Web Speech API.
    Configures tone and speed based on the technical complexity of the skill.
    """
    return {
        "rate": 0.85,  # Slightly slower for better technical retention
        "pitch": 1.0,
        "volume": 1.0,
        "lang": "en-US",
        "preferred_voices": [
            "Google US English",  # High-quality neural-like voice
            "Microsoft Aria Online (Natural)",
            "Alex",
            "Samantha"
        ]
    }
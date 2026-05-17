"""
Agent 3 — Code Playground Coach
Generates coding challenges, provides real-time hints, and evaluates submissions.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from tenacity import retry, stop_after_attempt, wait_exponential
from google.genai import types

from app.core.gemini import get_gemini_client # Standardized Client pattern
from app.core.config import get_settings
from app.core.database import get_supabase
from app.services.rag_service import retrieve_chunks, format_rag_context
from app.services.judge0_service import run_test_cases

logger = logging.getLogger(__name__)
settings = get_settings()

SYSTEM_PROMPT = """You are the Lead Coding Coach for SkillMentor AI.
Your teaching philosophy follows the Socratic Method: guide students to solutions 
through progressive hints rather than giving direct answers. Be highly concise. Do not explain unless asked.

CORE DIRECTIVES:
1. RESPONSE FORMAT: Return ONLY valid JSON. No markdown, no preamble.
2. HINTING: Hints must move from Abstract (Logic) -> Concrete (Syntax) -> Near-Solution.
3. CODE QUALITY: Starter code must be clean, modern, and follow industry best practices.
4. FEEDBACK: When evaluating code, prioritize readability and efficiency alongside correctness."""

@retry(
    stop=stop_after_attempt(3), 
    wait=wait_exponential(min=1, max=4),
    reraise=True
)
async def generate_challenge(
    user_id: str,
    roadmap_id: str,
    lesson_id: str,
    topic: str,
    skill: str,
    difficulty: str = "beginner",
    language: str = "javascript",
) -> Dict[str, Any]:
    """Generates a contextual coding challenge based on lesson topic and RAG context."""
    supabase = get_supabase()
    client = get_gemini_client()

    # 1. Fetch RAG Context for topic-specific accuracy
    rag_chunks = await retrieve_chunks(
        query=f"{topic} implementation in {language}", 
        user_id=user_id, 
        skill_tag=skill.lower(),
        top_k=3
    )
    rag_context = format_rag_context(rag_chunks)

    # 2. Structured Prompt for Gemini 2.0 Flash
    prompt = f"""
    Create a coding challenge for a student learning {skill}.
    TOPIC: {topic}
    LANGUAGE: {language}
    DIFFICULTY: {difficulty}

    [RELEVANT DOCUMENTATION]
    {rag_context}

    JSON STRUCTURE REQUIRED:
    {{
      "title": "Concise challenge title",
      "description": "Problem statement, constraints, and 2 examples.",
      "starter_code": "Boilerplate code for the student",
      "solution_code": "Reference implementation",
      "test_cases": [
        {{ "input": "...", "expected_output": "...", "description": "Happy path" }},
        {{ "input": "...", "expected_output": "...", "description": "Edge case" }}
      ],
      "hints": [
        {{ "level": 1, "hint": "Conceptual/Logic hint" }},
        {{ "level": 2, "hint": "Syntax/Implementation hint" }},
        {{ "level": 3, "hint": "Near-solution code structure" }}
      ],
      "estimated_minutes": 15
    }}
    """

    # 3. LLM Generation with Native JSON Mode (2026 SDK Standard)
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type='application/json'
        )
    )

    try:
        challenge = json.loads(response.text)
    except Exception as e:
        logger.error(f"Failed to parse AI Challenge JSON: {e}")
        raise ValueError("AI failed to generate a valid challenge structure.")

    # 4. Persistence to Supabase
    db_result = supabase.table("code_challenges").insert({
        "user_id": user_id,
        "roadmap_id": roadmap_id,
        "lesson_id": lesson_id,
        "topic": topic,
        "skill": skill,
        "title": challenge["title"],
        "description": challenge["description"],
        "starter_code": challenge["starter_code"],
        "solution_code": challenge.get("solution_code", ""),
        "test_cases": challenge["test_cases"],
        "difficulty": difficulty,
        "language": language,
        "hints": challenge["hints"],
    }).execute()

    if not db_result.data:
        raise RuntimeError("Database storage failed for challenge.")

    challenge["challenge_id"] = db_result.data[0]["id"]
    return challenge

async def get_personalized_hint(
    challenge_id: str,
    user_code: str,
    hint_level: int,
    error_message: Optional[str] = None,
) -> Dict[str, Any]:
    """Analyzes user code and provides a personalized hint without solving the problem."""
    supabase = get_supabase()
    client = get_gemini_client()

    # Fetch original challenge context
    challenge_record = supabase.table("code_challenges").select("*").eq("id", challenge_id).single().execute()
    if not challenge_record.data:
        raise ValueError("Challenge context not found.")

    ch = challenge_record.data
    base_hints = ch.get("hints", [])
    static_hint = next((h["hint"] for h in base_hints if h["level"] == hint_level), "")

    prompt = f"""
    PERSONALIZED HINT REQUEST:
    Challenge: {ch['title']}
    Description: {ch['description']}
    
    Student's Current Code:
    {user_code or "(No code written yet)"}
    
    {f"Runtime Error: {error_message}" if error_message else ""}
    
    Level {hint_level} Objective: {static_hint}
    
    INSTRUCTION: Refine the objective based on the student's code. 
    Point out logical flaws or syntax errors without fixing them.
    Return JSON: {{ "hint": "...", "encouragement": "..." }}
    """

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type='application/json'
        )
    )

    hint_data = json.loads(response.text)
    
    # Track interaction
    supabase.table("code_challenges").update({
        "hints_used": hint_level,
        "last_user_code": user_code
    }).eq("id", challenge_id).execute()

    return hint_data

async def evaluate_submission(
    challenge_id: str,
    user_id: str,
    user_code: str,
    hints_used: int
) -> Dict[str, Any]:
    """Executes code against test cases via Judge0, then gets AI pedagogical feedback."""
    supabase = get_supabase()
    client = get_gemini_client()

    ch_record = supabase.table("code_challenges").select("*").eq("id", challenge_id).single().execute()
    ch = ch_record.data

    # ── Step 1: Real code execution via Judge0 ──────────────────────────────
    test_cases = ch.get("test_cases", [])
    language = ch.get("language", "javascript")
    
    real_results = await run_test_cases(user_code, language, test_cases)
    
    tests_passed = sum(1 for r in real_results if r["passed"])
    all_passed = tests_passed == len(real_results)

    # ── Step 2: AI pedagogical feedback based on REAL output ───────────────
    # Summarize actual execution results for the AI to analyze
    real_output_summary = json.dumps(real_results, indent=2)[:2000]  # Truncate for token safety

    prompt = f"""
    REVIEW CODE SUBMISSION:
    Language: {language}
    Test Cases Run: {len(real_results)} | Passed: {tests_passed}
    
    Student Code:
    {user_code}
    
    Real Execution Results (from sandbox):
    {real_output_summary}
    
    Reference Solution:
    {ch.get('solution_code', 'Not available')}
    
    INSTRUCTION: Based on the REAL execution output above:
    1. Evaluate code quality (readability, efficiency, naming).
    2. Provide specific pedagogical feedback mentioning the actual failing test cases.
    3. Do NOT re-simulate or guess — use the real results provided.
    
    Return JSON: {{"overall_feedback": "...", "code_quality": {{"score": 0-100, "comments": []}}, "feedback": {{"what_to_improve": "..."}}}}
    """

    result: Dict[str, Any] = {
        "passed": all_passed,
        "tests_passed": tests_passed,
        "tests_total": len(real_results),
        "test_results": real_results,
        "overall_feedback": "",
        "code_quality": {"score": 70, "comments": []},
        "feedback": {"what_to_improve": ""},
        "xp_awarded": 0,
    }

    try:
        ai_response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type='application/json'
            )
        )
        ai_data = json.loads(ai_response.text)
        result["overall_feedback"] = ai_data.get("overall_feedback", "")
        result["code_quality"] = ai_data.get("code_quality", {"score": 70, "comments": []})
        result["feedback"] = ai_data.get("feedback", {})
    except Exception as e:
        logger.warning(f"AI feedback generation failed, returning raw test results: {e}")
        result["overall_feedback"] = (
            f"Your code passed {tests_passed}/{len(real_results)} test cases."
        )

    # ── Step 3: Gamification ────────────────────────────────────────────────
    if all_passed:
        try:
            completion_data = supabase.rpc("complete_challenge", {
                "p_challenge_id": challenge_id,
                "p_user_id": user_id,
                "p_hints_used": hints_used,
                "p_quality_score": result["code_quality"].get("score", 80)
            }).execute()
            result["xp_awarded"] = (
                completion_data.data.get("xp_earned", 50)
                if completion_data.data else 50
            )
        except Exception as e:
            logger.warning(f"XP award RPC failed: {e}")
            result["xp_awarded"] = 50
    else:
        supabase.table("code_challenges").update({
            "attempts": (ch.get("attempts", 0) or 0) + 1
        }).eq("id", challenge_id).execute()

    return result


async def explain_error(
    error_message: str,
    code: str,
    language: str = "javascript",
    topic: str = "",
) -> Dict[str, Any]:
    """
    Converts raw runtime/compiler errors into a concise, learner-friendly explanation.
    """
    client = get_gemini_client()

    prompt = f"""
    You are helping a student debug code.
    Language: {language}
    Topic: {topic or 'General Programming'}

    ERROR MESSAGE:
    {error_message}

    STUDENT CODE:
    {code}

    Return JSON only with this exact structure:
    {{
      "root_cause": "short plain-English cause",
      "fix": "specific fix the student should apply",
      "why_it_happened": "1-2 sentence conceptual explanation",
      "next_check": "one quick verification step"
    }}
    """

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type='application/json'
        )
    )

    try:
        return json.loads(response.text)
    except Exception:
        return {
            "root_cause": "The error could not be parsed reliably.",
            "fix": "Check the exact line referenced in the error and verify syntax and variable names.",
            "why_it_happened": "Runtime and syntax errors usually happen when the code path uses missing values or invalid syntax.",
            "next_check": "Re-run after applying one small fix and verify the first error disappears.",
        }
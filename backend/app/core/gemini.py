from functools import lru_cache
from typing import AsyncGenerator

from google import genai
from google.genai import types

from app.core.config import get_settings


def get_ai_provider() -> str:
    """Return the active AI provider name."""
    return "gemini"


@lru_cache
def get_ai_client():
    """Returns a singleton Gemini client."""
    settings = get_settings()
    return genai.Client(api_key=settings.gemini_api_key)


def get_gemini_client():
    """Backward-compatible alias for legacy imports."""
    return get_ai_client()


def get_gemini_model(system_instruction: str):
    """Compatibility wrapper for older agent code expecting model.generate_content()."""
    settings = get_settings()
    client = get_ai_client()
    config = get_mentor_model_config(system_instruction)

    class _GeminiCompatModel:
        def generate_content(self, prompt: str):
            return client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config=config,
            )

    return _GeminiCompatModel()


def get_mentor_model_config(system_instruction: str):
    """Returns a standard config for the Skill Mentor agent."""
    return types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.7,
        top_p=0.95,
        candidate_count=1,
        max_output_tokens=8192,
        thinking_config=types.ThinkingConfig(include_thoughts=True)
    )


async def generate_mentor_response(prompt: str, role_description: str) -> str:
    """Generates a response using Gemini."""
    settings = get_settings()
    model_name = settings.gemini_model
    client = get_ai_client()
    config = get_mentor_model_config(role_description)
    response = await client.aio.models.generate_content(
        model=model_name,
        contents=prompt,
        config=config,
    )
    return response.text


async def stream_mentor_response(
    prompt: str,
    role_description: str,
) -> AsyncGenerator[dict, None]:
    """
    Async generator that streams Gemini responses chunk-by-chunk.

    Yields dicts with two possible shapes:
      - {"type": "thought", "text": "<AI reasoning chunk>"}
      - {"type": "text",    "text": "<AI answer chunk>"}
      - {"type": "done"}
      - {"type": "error",  "text": "<error message>"}

    Thought parts come from Gemini's ThinkingConfig and represent
    the model's internal reasoning chain before it produces its answer.
    These are surfaced to the user as the "AI Thought Process" panel.
    """
    settings = get_settings()
    client = get_ai_client()
    config = get_mentor_model_config(role_description)

    try:
        async for chunk in await client.aio.models.generate_content_stream(
            model=settings.gemini_model,
            contents=prompt,
            config=config,
        ):
            if not chunk.candidates:
                continue

            for candidate in chunk.candidates:
                if not candidate.content or not candidate.content.parts:
                    continue

                for part in candidate.content.parts:
                    # Gemini separates thought parts from answer parts
                    # via the `thought` boolean attribute on each Part.
                    part_text = getattr(part, "text", None)
                    is_thought = getattr(part, "thought", False)

                    if part_text:
                        if is_thought:
                            yield {"type": "thought", "text": part_text}
                        else:
                            yield {"type": "text", "text": part_text}

        yield {"type": "done"}

    except Exception as exc:
        yield {"type": "error", "text": str(exc)}


async def check_model_health() -> bool:
    """Performs a lightweight model call to verify availability."""
    settings = get_settings()
    model_name = settings.gemini_model
    try:
        client = get_ai_client()
        response = await client.aio.models.generate_content(model=model_name, contents="ping")
        return bool(response.text)
    except Exception:
        return False


async def validate_gemini_startup() -> None:
    """Fail fast on invalid Gemini configuration so startup errors are explicit."""
    settings = get_settings()

    if not settings.gemini_api_key:
        raise RuntimeError(
            "Missing GEMINI_API_KEY. Add a valid key to backend/.env and restart the backend."
        )

    try:
        client = get_ai_client()
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents="startup validation ping",
            config=types.GenerateContentConfig(max_output_tokens=8, temperature=0.0),
        )
        if not getattr(response, "text", None):
            raise RuntimeError("Gemini startup validation returned an empty response.")
    except Exception as exc:
        message = str(exc)
        if "API key was reported as leaked" in message:
            raise RuntimeError(
                "Gemini startup validation failed: this API key was reported as leaked and disabled. "
                "Create a new key in Google AI Studio, update GEMINI_API_KEY in backend/.env, and restart the backend."
            ) from exc
        if "PERMISSION_DENIED" in message or "403" in message:
            raise RuntimeError(
                "Gemini startup validation failed with PERMISSION_DENIED/403. "
                "Verify GEMINI_API_KEY and model access, then restart the backend."
            ) from exc
        if "UNAUTHENTICATED" in message or "401" in message:
            raise RuntimeError(
                "Gemini startup validation failed with UNAUTHENTICATED/401. "
                "GEMINI_API_KEY is invalid or expired. Replace it in backend/.env and restart."
            ) from exc
        raise RuntimeError(f"Gemini startup validation failed: {message}") from exc


async def embed_content(text: str, is_query: bool = False) -> list[float]:
    """Creates embeddings using Gemini."""
    settings = get_settings()
    client = get_ai_client()
    task_type = "retrieval_query" if is_query else "retrieval_document"
    models_to_try = [settings.gemini_embed_model, "gemini-embedding-001"]
    last_error: Exception | None = None

    for model_name in models_to_try:
        try:
            result = await client.aio.models.embed_content(
                model=model_name,
                contents=text,
                config=types.EmbedContentConfig(task_type=task_type),
            )
            return result.embeddings[0].values
        except Exception as exc:
            last_error = exc
            message = str(exc)
            # Retry with fallback model only when the model is unsupported/not found.
            if "NOT_FOUND" in message or "not found" in message or "not supported" in message:
                continue
            raise

    raise RuntimeError(f"Embedding generation failed: {last_error}")

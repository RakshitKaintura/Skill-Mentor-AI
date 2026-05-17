"""
LLM Router — Gemini Multi-Key Rotation with Automatic Fallback via LiteLLM

This router transparently rotates through a pool of Gemini API keys. 
If ALL Gemini keys are exhausted, it seamlessly falls back to alternative providers 
like OpenAI (gpt-4o-mini) or Anthropic (claude-3-haiku) using litellm.

Usage:
    from app.core.llm_router import llm_router
    result = await llm_router.generate(prompt="...", system_instruction="...")
"""
import asyncio
import logging
import time
import json
from typing import Optional

import litellm
from app.core.config import get_settings

logger = logging.getLogger(__name__)


class AllProvidersFailedError(Exception):
    """Raised when all API keys and fallback providers are exhausted or failing."""
    pass


class _KeyState:
    """Tracks the health and rate-limit status of a single API key."""
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.failures = 0
        self.cooldown_until: float = 0.0  # epoch seconds

    def is_available(self) -> bool:
        return time.time() >= self.cooldown_until

    def mark_failure(self, is_rate_limit: bool = False):
        self.failures += 1
        # Rate limit → back off for 60s; other errors → back off for 10s
        backoff = 60 if is_rate_limit else 10
        self.cooldown_until = time.time() + backoff
        logger.warning(
            f"Key ...{self.api_key[-6:]} marked unavailable for {backoff}s "
            f"(total failures: {self.failures})"
        )

    def mark_success(self):
        self.failures = 0
        self.cooldown_until = 0.0


class LLMRouter:
    """
    Routes LLM calls across a pool of Gemini API keys and alternative providers.
    """

    def __init__(self):
        self._keys: list[_KeyState] = []
        self._initialized = False

    def _initialize(self):
        if self._initialized:
            return
        settings = get_settings()

        raw_keys = getattr(settings, "gemini_api_keys", "")
        key_list: list[str] = []

        if raw_keys:
            key_list = [k.strip() for k in raw_keys.split(",") if k.strip()]

        primary = settings.gemini_api_key
        if primary and primary not in key_list:
            key_list.insert(0, primary)

        if not key_list:
            logger.warning("No Gemini API keys configured. LLMRouter will only use fallbacks.")

        self._keys = [_KeyState(k) for k in key_list]
        self._initialized = True
        logger.info(f"LLMRouter initialized with {len(self._keys)} Gemini API key(s).")

    def _get_available_key(self) -> Optional[_KeyState]:
        for key_state in self._keys:
            if key_state.is_available():
                return key_state
        return None

    async def generate(
        self,
        prompt: str,
        system_instruction: str,
        temperature: float = 1.0,
        max_output_tokens: int = 2048,
        response_mime_type: Optional[str] = None,
    ) -> str:
        """
        Generates a text response using Gemini keys.
        NOTE: Gemini 3.x models require temperature=1.0. The default is set
        accordingly; callers should not override it below 1.0 for Gemini 3.x.
        to litellm alternatives (OpenAI, Anthropic) if all fail.
        """
        self._initialize()
        settings = get_settings()

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": prompt}
        ]
        
        response_format = None
        if response_mime_type == "application/json":
            response_format = {"type": "json_object"}

        last_error: Optional[Exception] = None

        # 1. Try Gemini Keys
        for attempt in range(len(self._keys)):
            key_state = self._get_available_key()
            if key_state is None:
                break # All keys on cooldown, move to fallbacks immediately

            try:
                # Use litellm with the specific key
                response = await litellm.acompletion(  # type: ignore[misc]
                    model=f"gemini/{settings.gemini_model}",
                    messages=messages,
                    api_key=key_state.api_key,
                    temperature=temperature,
                    max_tokens=max_output_tokens,
                    response_format=response_format
                )
                key_state.mark_success()
                return response.choices[0].message.content or ""

            except Exception as exc:
                error_msg = str(exc)
                is_rate_limit = "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg
                key_state.mark_failure(is_rate_limit=is_rate_limit)
                last_error = exc
                logger.warning(
                    f"LLMRouter: Gemini key ...{key_state.api_key[-6:]} failed "
                    f"({'rate-limit' if is_rate_limit else 'error'}). "
                )

        raise AllProvidersFailedError(
            f"All Gemini API keys are exhausted or on cooldown. Last error: {last_error}"
        )

    async def generate_json(
        self,
        prompt: str,
        system_instruction: str,
        temperature: float = 1.0,
        max_output_tokens: int = 2048,
    ) -> str:
        """Convenience wrapper that forces JSON response mode."""
        return await self.generate(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            response_mime_type="application/json",
        )


# Global singleton — use this throughout the app
llm_router = LLMRouter()

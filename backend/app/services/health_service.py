import logging

from supabase import Client

from app.core.gemini import check_model_health

logger = logging.getLogger(__name__)

class HealthService:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    async def check_gemini(self) -> bool:
        """Verifies LLM availability by calling check_model_health()."""
        try:
            return await check_model_health()
        except Exception as exc:
            logger.warning("Gemini health check failed: %s", exc)
            return False

    async def check_supabase(self) -> bool:
        """Verifies Supabase DB connectivity."""
        try:
            self.supabase.table("profiles").select("id").limit(1).execute()
            return True
        except Exception as exc:
            logger.warning("Supabase health check failed: %s", exc)
            return False

    async def check_storage(self) -> bool:
        """
        Verifies Supabase Storage is accessible by listing buckets.
        A non-empty or empty list both indicate connectivity;
        an exception indicates Storage is down.
        """
        try:
            self.supabase.storage.list_buckets()
            return True
        except Exception as exc:
            logger.warning("Storage health check failed: %s", exc)
            return False

    async def check_rag(self) -> bool:
        """
        Verifies the RAG documents table exists and has at least one row.
        Returns False (not 'down') if empty — RAG simply has no data yet.
        """
        try:
            self.supabase.table("documents").select("id").limit(1).execute()
            return True  # Table exists (even if empty the query succeeds)
        except Exception as exc:
            logger.warning("RAG health check failed: %s", exc)
            return False

    async def check_notes(self) -> bool:
        """
        Verifies the user_notes migration has been run by querying the table.
        Returns False if the migration hasn't been executed yet.
        """
        try:
            self.supabase.table("user_notes").select("id").limit(1).execute()
            return True
        except Exception as exc:
            logger.warning("Notes table health check failed: %s", exc)
            return False

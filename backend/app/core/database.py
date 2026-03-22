from supabase import AsyncClient, acreate_client
from functools import lru_cache
from app.core.config import get_settings

@lru_cache
def get_supabase_settings():
    """Returns essential Supabase connection strings."""
    settings = get_settings()
    return settings.supabase_url, settings.supabase_service_key

async def get_supabase() -> AsyncClient:
    """
    Initializes and returns an asynchronous Supabase client.
    Uses service_role for server-side operations to manage skill roadmaps.
    """
    url, key = get_supabase_settings()
    return await acreate_client(url, key)

async def close_supabase(client: AsyncClient):
    """Gracefully closes the Supabase client connection."""
    await client.auth.sign_out()
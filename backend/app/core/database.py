from supabase import Client, create_client
from functools import lru_cache
from app.core.config import get_settings

@lru_cache
def get_supabase_settings():
    """Returns essential Supabase connection strings."""
    settings = get_settings()
    return settings.supabase_url, settings.supabase_service_key

@lru_cache
def get_supabase() -> Client:
    """
    Initializes and returns a singleton Supabase client.
    Uses service_role for server-side operations to manage skill roadmaps.
    """
    url, key = get_supabase_settings()
    return create_client(url, key)

def close_supabase(client: Client):
    """Gracefully closes the Supabase client connection."""
    client.auth.sign_out()

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    # API Keys & URLs
    gemini_api_key: str
    # Optional: comma-separated list of extra Gemini keys for rotation
    # e.g. GEMINI_API_KEYS="key1,key2,key3" in .env
    gemini_api_keys: str = ""
    supabase_url: str
    supabase_service_key: str
    frontend_url: str = "http://localhost:3000"
    app_env: str = "development"
    allow_start_without_gemini: bool = False
    admin_api_key: str = "skillmentor-admin-secret"
    admin_allowed_emails: str = ""
    redis_url: str = "redis://localhost:6379/0"

    # Judge0 Code Execution (free CE public instance)
    judge0_api_url: str = "https://ce.judge0.com"
    judge0_api_key: str = ""  # Not required for the free CE instance

    # AI Model Configuration
    gemini_model: str = "gemini-3-flash-preview"
    gemini_embed_model: str = "text-embedding-004"

    # RAG Settings
    chunk_size_tokens: int = 256
    chunk_overlap_tokens: int = 64
    rag_top_k: int = 3

    # Pydantic V2 Config
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

@lru_cache
def get_settings() -> Settings:
    return Settings()
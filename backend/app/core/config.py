from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    # API Keys & URLs
    gemini_api_key: str
    supabase_url: str
    supabase_service_key: str
    frontend_url: str = "http://localhost:3000"
    app_env: str = "development"
    allow_start_without_gemini: bool = False

    # AI Model Configuration
    gemini_model: str = "gemini-3.1-flash-lite-preview"
    gemini_embed_model: str = "text-embedding-004"

    # RAG Settings
    chunk_size_tokens: int = 512
    chunk_overlap_tokens: int = 64
    rag_top_k: int = 5

    # Pydantic V2 Config
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

@lru_cache
def get_settings() -> Settings:
    return Settings()
"""
Application configuration — loaded from environment variables only.
Never hardcode secrets here.
"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # OpenAI
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4.5-preview"
    OPENAI_MAX_TOKENS: int = 1024
    OPENAI_TEMPERATURE: float = 0.4   # lower = more deterministic PRD suggestions

    # Service
    PORT: int = 5000
    CORS_ORIGINS: str = "http://localhost:4000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

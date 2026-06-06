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

    # Anthropic (Claude) — used for wireframe hi-fi generation.
    # HIFI_PROVIDER selects the engine for /hifi-generate: "anthropic" | "openai".
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"
    HIFI_PROVIDER: str = "anthropic"

    # Google Gemini — optional; powers the Gemini option in the HLD Copilot's
    # per-message model picker. Absent by default → the option is reported
    # unavailable and hidden in the UI (no rework when a key is added).
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # HLD Architect Copilot (Track C) — conversational research per HLD section.
    HLD_COPILOT_PROVIDER: str = "anthropic"   # default model for chat/merge
    HLD_COPILOT_MAX_TOKENS: int = 2048
    HLD_COPILOT_TEMPERATURE: float = 0.5

    # Speech-to-Text (STT) — pluggable provider
    # Supported: "whisper" (OpenAI), "deepgram", "assemblyai", "elevenlabs", "cartesia"
    STT_PROVIDER: str = "whisper"
    STT_API_KEY: str = ""           # Leave empty to reuse OPENAI_API_KEY for Whisper
    STT_MODEL: str = "whisper-1"    # Whisper: "whisper-1", Deepgram: "nova-2", etc.
    STT_LANGUAGE: str = "en"        # ISO 639-1 language code

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

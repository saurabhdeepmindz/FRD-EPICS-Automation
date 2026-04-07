"""
Pluggable Speech-to-Text (STT) provider system.
Supports: OpenAI Whisper (default), Deepgram, AssemblyAI, ElevenLabs, Cartesia.
Add new providers by implementing the STTProvider interface and registering in PROVIDERS.
"""
import io
import logging
from abc import ABC, abstractmethod

import httpx
import openai

from config import Settings

logger = logging.getLogger(__name__)


class STTProvider(ABC):
    """Base class for all STT providers."""

    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, filename: str, mime_type: str) -> str:
        """Transcribe audio bytes to text. Returns the transcribed string."""
        ...


# ─── OpenAI Whisper ──────────────────────────────────────────────────────────

class WhisperProvider(STTProvider):
    """OpenAI Whisper API — default provider."""

    def __init__(self, settings: Settings):
        api_key = settings.STT_API_KEY or settings.OPENAI_API_KEY
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.model = settings.STT_MODEL or "whisper-1"
        self.language = settings.STT_LANGUAGE or "en"

    async def transcribe(self, audio_bytes: bytes, filename: str, mime_type: str) -> str:
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = filename or "audio.webm"
        response = await self.client.audio.transcriptions.create(
            model=self.model,
            file=audio_file,
            language=self.language,
        )
        return response.text


# ─── Deepgram ────────────────────────────────────────────────────────────────

class DeepgramProvider(STTProvider):
    """Deepgram Nova API."""

    def __init__(self, settings: Settings):
        self.api_key = settings.STT_API_KEY
        self.model = settings.STT_MODEL or "nova-2"
        self.language = settings.STT_LANGUAGE or "en"
        if not self.api_key:
            raise ValueError("STT_API_KEY is required for Deepgram provider")

    async def transcribe(self, audio_bytes: bytes, filename: str, mime_type: str) -> str:
        url = f"https://api.deepgram.com/v1/listen?model={self.model}&language={self.language}"
        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": mime_type or "audio/webm",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, content=audio_bytes)
            resp.raise_for_status()
            data = resp.json()
        return data["results"]["channels"][0]["alternatives"][0]["transcript"]


# ─── AssemblyAI ──────────────────────────────────────────────────────────────

class AssemblyAIProvider(STTProvider):
    """AssemblyAI real-time transcription."""

    def __init__(self, settings: Settings):
        self.api_key = settings.STT_API_KEY
        self.language = settings.STT_LANGUAGE or "en"
        if not self.api_key:
            raise ValueError("STT_API_KEY is required for AssemblyAI provider")

    async def transcribe(self, audio_bytes: bytes, filename: str, mime_type: str) -> str:
        headers = {"authorization": self.api_key}
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Upload
            upload_resp = await client.post(
                "https://api.assemblyai.com/v2/upload",
                headers=headers,
                content=audio_bytes,
            )
            upload_resp.raise_for_status()
            audio_url = upload_resp.json()["upload_url"]

            # Transcribe
            transcript_resp = await client.post(
                "https://api.assemblyai.com/v2/transcript",
                headers=headers,
                json={"audio_url": audio_url, "language_code": self.language},
            )
            transcript_resp.raise_for_status()
            transcript_id = transcript_resp.json()["id"]

            # Poll
            while True:
                poll_resp = await client.get(
                    f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
                    headers=headers,
                )
                poll_resp.raise_for_status()
                status = poll_resp.json()["status"]
                if status == "completed":
                    return poll_resp.json()["text"]
                if status == "error":
                    raise RuntimeError(f"AssemblyAI error: {poll_resp.json().get('error')}")
                import asyncio
                await asyncio.sleep(1)


# ─── ElevenLabs (STT) ───────────────────────────────────────────────────────

class ElevenLabsProvider(STTProvider):
    """ElevenLabs Speech-to-Text API."""

    def __init__(self, settings: Settings):
        self.api_key = settings.STT_API_KEY
        self.model = settings.STT_MODEL or "scribe_v1"
        self.language = settings.STT_LANGUAGE or "en"
        if not self.api_key:
            raise ValueError("STT_API_KEY is required for ElevenLabs provider")

    async def transcribe(self, audio_bytes: bytes, filename: str, mime_type: str) -> str:
        url = "https://api.elevenlabs.io/v1/speech-to-text"
        headers = {"xi-api-key": self.api_key}
        async with httpx.AsyncClient(timeout=30.0) as client:
            files = {"file": (filename or "audio.webm", audio_bytes, mime_type or "audio/webm")}
            data = {"model_id": self.model, "language_code": self.language}
            resp = await client.post(url, headers=headers, files=files, data=data)
            resp.raise_for_status()
            return resp.json()["text"]


# ─── Cartesia (placeholder — add when their STT API is available) ────────────

class CartesiaProvider(STTProvider):
    """Cartesia STT — placeholder for future integration."""

    def __init__(self, settings: Settings):
        self.api_key = settings.STT_API_KEY
        if not self.api_key:
            raise ValueError("STT_API_KEY is required for Cartesia provider")

    async def transcribe(self, audio_bytes: bytes, filename: str, mime_type: str) -> str:
        raise NotImplementedError(
            "Cartesia STT is not yet available. "
            "Switch to 'whisper', 'deepgram', 'assemblyai', or 'elevenlabs' in STT_PROVIDER."
        )


# ─── Provider registry ──────────────────────────────────────────────────────

PROVIDERS: dict[str, type[STTProvider]] = {
    "whisper": WhisperProvider,
    "deepgram": DeepgramProvider,
    "assemblyai": AssemblyAIProvider,
    "elevenlabs": ElevenLabsProvider,
    "cartesia": CartesiaProvider,
}


def get_stt_provider(settings: Settings) -> STTProvider:
    """Factory: returns the configured STT provider instance."""
    provider_name = settings.STT_PROVIDER.lower()
    provider_cls = PROVIDERS.get(provider_name)
    if not provider_cls:
        raise ValueError(
            f"Unknown STT_PROVIDER '{provider_name}'. "
            f"Supported: {', '.join(PROVIDERS.keys())}"
        )
    logger.info("STT provider: %s (model=%s, lang=%s)", provider_name, settings.STT_MODEL, settings.STT_LANGUAGE)
    return provider_cls(settings)

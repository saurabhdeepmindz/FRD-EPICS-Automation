"""
PRD Generator — AI Service
FastAPI microservice that wraps OpenAI to provide PRD field suggestions.
The OpenAI API key is NEVER exposed to the browser — only the NestJS backend
calls this service from server-side.
"""
import logging
from typing import Annotated

import openai
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from fastapi.responses import StreamingResponse
import json

from config import Settings, get_settings
from stt_providers import get_stt_provider, STTProvider
from prompts.section_prompts import get_section_prompt, SYSTEM_BASE
from prompts.parse_prompts import PARSE_SYSTEM_PROMPT, GAP_ANALYSIS_SUFFIX, INTERACTIVE_SUFFIX
from prompts.gap_check_prompts import GAP_CHECK_SYSTEM_PROMPT

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="PRD Generator — AI Service",
    description="OpenAI-powered field suggestion service for the PRD Generator.",
    version="0.1.0",
)


# ─── CORS — only accept calls from the NestJS backend ─────────────────────────

_settings_for_cors = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings_for_cors.cors_origins_list,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ─── Request / Response models ────────────────────────────────────────────────

class SuggestRequest(BaseModel):
    section: int = Field(..., ge=1, le=22, description="PRD section number (1-22)")
    field: str = Field(..., min_length=1, max_length=200, description="Field name to suggest")
    context: str = Field(
        default="",
        max_length=4000,
        description="Existing PRD content to inform the suggestion",
    )


class SuggestResponse(BaseModel):
    suggestion: str
    section: int
    field: str
    model: str


class HealthResponse(BaseModel):
    status: str
    model: str


# ─── Parse models ─────────────────────────────────────────────────────────────

class ParseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=60000, description="Raw requirements text")
    mode: str = Field(default="all_in_one", pattern="^(all_in_one|interactive)$")


class GapItem(BaseModel):
    section: int
    question: str


class ParseResponse(BaseModel):
    sections: dict
    gaps: list[GapItem]


# ─── Gap-check models ────────────────────────────────────────────────────────

class GapCheckRequest(BaseModel):
    sections: dict = Field(..., description="Current 22-section PRD content")
    answers: str = Field(default="", max_length=10000, description="User answers to gap questions")


class GapCheckResponse(BaseModel):
    updatedSections: dict
    remainingGaps: list[GapItem]
    gapCount: int


# ─── Dependency — OpenAI client ───────────────────────────────────────────────

def get_openai_client(settings: Annotated[Settings, Depends(get_settings)]) -> openai.AsyncOpenAI:
    return openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["ops"])
async def health(settings: Annotated[Settings, Depends(get_settings)]) -> HealthResponse:
    return HealthResponse(status="ok", model=settings.OPENAI_MODEL)


@app.post("/suggest", response_model=SuggestResponse, tags=["ai"])
async def suggest(
    body: SuggestRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> SuggestResponse:
    """
    Generate an AI suggestion for a specific PRD field.
    The OpenAI API key is injected server-side — never exposed to the browser.
    """
    section_prompt = get_section_prompt(body.section)

    user_message = (
        f"PRD Section: {body.section}\n"
        f"Field to fill: {body.field}\n"
    )
    if body.context.strip():
        user_message += f"\nExisting context:\n{body.context.strip()}"

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": f"{SYSTEM_BASE}\n\n{section_prompt}"},
                {"role": "user", "content": user_message},
            ],
            max_tokens=settings.OPENAI_MAX_TOKENS,
            temperature=settings.OPENAI_TEMPERATURE,
        )
    except openai.AuthenticationError as exc:
        logger.error("OpenAI authentication failed: %s", exc)
        raise HTTPException(status_code=401, detail="AI service authentication error") from exc
    except openai.RateLimitError as exc:
        logger.warning("OpenAI rate limit hit: %s", exc)
        raise HTTPException(status_code=429, detail="AI service rate limit — please retry") from exc
    except openai.OpenAIError as exc:
        logger.error("OpenAI error: %s", exc)
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    suggestion = (response.choices[0].message.content or "").strip()

    logger.info("Suggested %d chars for section=%d field=%s", len(suggestion), body.section, body.field)

    return SuggestResponse(
        suggestion=suggestion,
        section=body.section,
        field=body.field,
        model=settings.OPENAI_MODEL,
    )


# ─── Parse endpoint ──────────────────────────────────────────────────────────

def _build_parse_prompt(mode: str) -> str:
    prompt = PARSE_SYSTEM_PROMPT + "\n\n" + GAP_ANALYSIS_SUFFIX
    if mode == "interactive":
        prompt += "\n\n" + INTERACTIVE_SUFFIX
    return prompt


def _parse_ai_json(raw: str) -> dict:
    """Attempt to parse AI response as JSON, stripping code fences if present."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    if cleaned.startswith("json"):
        cleaned = cleaned[4:].strip()
    return json.loads(cleaned)


@app.post("/parse", response_model=ParseResponse, tags=["ai"])
async def parse_requirements(
    body: ParseRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> ParseResponse:
    """
    Parse raw requirements text into structured 22-section PRD JSON.
    """
    system_prompt = _build_parse_prompt(body.mode)

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": body.text},
            ],
            max_tokens=16384,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
    except openai.AuthenticationError as exc:
        logger.error("OpenAI auth failed: %s", exc)
        raise HTTPException(status_code=401, detail="AI service authentication error") from exc
    except openai.RateLimitError as exc:
        logger.warning("OpenAI rate limit: %s", exc)
        raise HTTPException(status_code=429, detail="AI service rate limit — please retry") from exc
    except openai.OpenAIError as exc:
        logger.error("OpenAI error: %s", exc)
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    raw_content = (response.choices[0].message.content or "").strip()
    logger.info("Parse response: %d chars", len(raw_content))

    try:
        parsed = _parse_ai_json(raw_content)
    except json.JSONDecodeError:
        logger.error("Failed to parse AI JSON: %s", raw_content[:500])
        raise HTTPException(status_code=502, detail="AI returned invalid JSON")

    sections = parsed.get("sections", {})
    gaps_raw = parsed.get("gaps", [])
    gaps = [GapItem(section=g.get("section", 0), question=g.get("question", "")) for g in gaps_raw]

    return ParseResponse(sections=sections, gaps=gaps)


# ─── Gap-check endpoint ──────────────────────────────────────────────────────

@app.post("/gap-check", response_model=GapCheckResponse, tags=["ai"])
async def gap_check(
    body: GapCheckRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> GapCheckResponse:
    """
    Run gap analysis on current PRD sections, merging user answers.
    """
    user_message = f"Current PRD sections:\n{json.dumps(body.sections, indent=2)}"
    if body.answers.strip():
        user_message += f"\n\nUser's answers to previous gaps:\n{body.answers.strip()}"

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": GAP_CHECK_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=16384,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
    except openai.AuthenticationError as exc:
        raise HTTPException(status_code=401, detail="AI service authentication error") from exc
    except openai.RateLimitError as exc:
        raise HTTPException(status_code=429, detail="AI service rate limit — please retry") from exc
    except openai.OpenAIError as exc:
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    raw_content = (response.choices[0].message.content or "").strip()

    try:
        parsed = _parse_ai_json(raw_content)
    except json.JSONDecodeError:
        logger.error("Failed to parse gap-check JSON: %s", raw_content[:500])
        raise HTTPException(status_code=502, detail="AI returned invalid JSON")

    updated = parsed.get("updatedSections", body.sections)
    remaining_raw = parsed.get("remainingGaps", [])
    remaining = [GapItem(section=g.get("section", 0), question=g.get("question", "")) for g in remaining_raw]

    return GapCheckResponse(
        updatedSections=updated,
        remainingGaps=remaining,
        gapCount=len(remaining),
    )


# ─── Speech-to-Text endpoint ───────────────────────────────────────────────

class TranscribeResponse(BaseModel):
    text: str
    provider: str


def get_stt(settings: Annotated[Settings, Depends(get_settings)]) -> STTProvider:
    return get_stt_provider(settings)


@app.post("/transcribe", response_model=TranscribeResponse, tags=["ai"])
async def transcribe(
    audio: UploadFile = File(..., description="Audio file (webm, wav, mp3, m4a)"),
    settings: Settings = Depends(get_settings),
    stt: STTProvider = Depends(get_stt),
) -> TranscribeResponse:
    """
    Transcribe an audio file to text using the configured STT provider.
    """
    contents = await audio.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(contents) > 25 * 1024 * 1024:  # 25 MB limit
        raise HTTPException(status_code=400, detail="Audio file too large (max 25 MB)")

    filename = audio.filename or "audio.webm"
    mime_type = audio.content_type or "audio/webm"

    logger.info("Transcribing %d bytes (%s) via %s", len(contents), mime_type, settings.STT_PROVIDER)

    try:
        text = await stt.transcribe(contents, filename, mime_type)
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("STT error: %s", exc)
        raise HTTPException(status_code=502, detail=f"Transcription failed: {exc}") from exc

    logger.info("Transcribed %d chars via %s", len(text), settings.STT_PROVIDER)

    return TranscribeResponse(text=text, provider=settings.STT_PROVIDER)

"""
PRD Generator — AI Service
FastAPI microservice that wraps OpenAI to provide PRD field suggestions.
The OpenAI API key is NEVER exposed to the browser — only the NestJS backend
calls this service from server-side.
"""
import logging
from typing import Annotated

import openai
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import Settings, get_settings
from prompts.section_prompts import get_section_prompt, SYSTEM_BASE

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

@app.on_event("startup")
async def configure_cors() -> None:
    settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
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

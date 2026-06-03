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
import os

from config import Settings, get_settings
from stt_providers import get_stt_provider, STTProvider
from prompts.section_prompts import get_section_prompt, SYSTEM_BASE
from prompts.parse_prompts import PARSE_SYSTEM_PROMPT, GAP_ANALYSIS_SUFFIX, INTERACTIVE_SUFFIX
from prompts.gap_check_prompts import GAP_CHECK_SYSTEM_PROMPT
from prompts.screen_map_prompts import SCREEN_MAP_SYSTEM_PROMPT
from prompts.wft_prompts import WFT_SYSTEM_PROMPT, build_wft_user_message
from prompts.brd_prompts import BRD_SYSTEM_PROMPT, build_brd_user_message
from prompts.an_prompts import AN_SYSTEM_PROMPT, build_an_user_message
from prompts.brand_extraction_prompts import BRAND_EXTRACTION_SYSTEM_PROMPT
from prompts.wireframe_prompts import WIREFRAME_SYSTEM_PROMPT, build_wireframe_user_message
from prompts.hifi_prompts import HIFI_SYSTEM_PROMPT, build_hifi_user_message
from prompts.hld_prompts import HLD_SYSTEM_PROMPT, build_hld_user_message
from prompts.e2e_flow_prompts import E2E_FLOW_SYSTEM_PROMPT, build_e2e_flow_user_message

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


def _strip_code_fences(raw: str) -> str:
    """If the model wrapped output in a ```lang ... ``` fence, unwrap it."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        # drop first fence line (```python, ```ts, or just ```)
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.rstrip() + "\n"


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


# ─── Discovery Track: WFT generation (Stage 2) ─────────────────────────────

class WftConcept(BaseModel):
    name: str
    context: str


class WftRequest(BaseModel):
    rawTranscript: str = Field(..., min_length=1, max_length=200_000)
    domainContext: str = Field(default="", max_length=500)
    languageHint: str = Field(default="auto", max_length=20)


class WftResponse(BaseModel):
    cleanedText: str | None = None
    paraphrased: str | None = None
    concepts: list[WftConcept] = []
    actionItems: list[str] = []
    openQuestions: list[str] = []
    detectedLanguage: str | None = None
    model: str | None = None


@app.post("/wft-generate", response_model=WftResponse, tags=["discovery"])
async def wft_generate(
    body: WftRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> WftResponse:
    """
    Stage 2 of the Discovery Track. Convert one or more concatenated raw audio
    transcripts into a 7-section Well-formed Text artefact per skill 01.
    Returns structured JSON for the NestJS backend to persist as a BaWft.
    """
    user_message = build_wft_user_message(
        body.rawTranscript, body.domainContext, body.languageHint
    )

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": WFT_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            # Override the global OPENAI_MAX_TOKENS=1024 default — a structured
            # 7-section WFT can run a few thousand tokens for a long transcript.
            max_tokens=4096,
            temperature=settings.OPENAI_TEMPERATURE,
            response_format={"type": "json_object"},
        )
    except openai.AuthenticationError as exc:
        logger.error("OpenAI auth failed during WFT generation: %s", exc)
        raise HTTPException(status_code=401, detail="AI service authentication error") from exc
    except openai.RateLimitError as exc:
        logger.warning("OpenAI rate limit hit during WFT generation: %s", exc)
        raise HTTPException(status_code=429, detail="AI service rate limit — please retry") from exc
    except openai.OpenAIError as exc:
        logger.error("OpenAI error during WFT generation: %s", exc)
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = _parse_ai_json(raw)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse WFT JSON: %s — raw=%r", exc, raw[:200])
        raise HTTPException(status_code=502, detail="WFT generator returned invalid JSON") from exc

    logger.info(
        "WFT generated: %d concepts · %d actions · %d open questions",
        len(parsed.get("concepts") or []),
        len(parsed.get("actionItems") or []),
        len(parsed.get("openQuestions") or []),
    )

    return WftResponse(
        cleanedText=parsed.get("cleanedText"),
        paraphrased=parsed.get("paraphrased"),
        concepts=[WftConcept(**c) for c in (parsed.get("concepts") or [])],
        actionItems=list(parsed.get("actionItems") or []),
        openQuestions=list(parsed.get("openQuestions") or []),
        detectedLanguage=parsed.get("detectedLanguage"),
        model=settings.OPENAI_MODEL,
    )


# ─── Discovery Track: BRD generation (Stage 3) ─────────────────────────────

class FrTableRow(BaseModel):
    id: str
    requirement: str
    testable: bool = True


class BrdRequest(BaseModel):
    wftParaphrased: str = Field(default="", max_length=60_000)
    wftConcepts: list[dict] = Field(default_factory=list)
    wftActionItems: list[str] = Field(default_factory=list)
    wftOpenQuestions: list[str] = Field(default_factory=list)
    productName: str = Field(default="", max_length=200)
    audience: str = Field(default="", max_length=50)


class BrdResponse(BaseModel):
    sections: dict[str, str] = Field(default_factory=dict)
    frTable: list[FrTableRow] = Field(default_factory=list)
    openItems: list[str] = Field(default_factory=list)
    detectedAudience: str | None = None
    model: str | None = None


@app.post("/brd-generate", response_model=BrdResponse, tags=["discovery"])
async def brd_generate(
    body: BrdRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> BrdResponse:
    """
    Stage 3 of the Discovery Track. Convert a Well-formed Text artefact into a
    15-section Business Requirements Document per skill 02. Returns structured
    JSON for the NestJS backend to persist as a BaBrd.
    """
    user_message = build_brd_user_message(
        body.wftParaphrased,
        body.wftConcepts,
        body.wftActionItems,
        body.wftOpenQuestions,
        body.productName,
        body.audience,
    )

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": BRD_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            # 15-section BRD with FR table + open items easily exceeds the global
            # OPENAI_MAX_TOKENS=1024 default. Bump well above the worst case so
            # JSON is never truncated mid-stream.
            max_tokens=8192,
            temperature=settings.OPENAI_TEMPERATURE,
            response_format={"type": "json_object"},
        )
    except openai.AuthenticationError as exc:
        logger.error("OpenAI auth failed during BRD generation: %s", exc)
        raise HTTPException(status_code=401, detail="AI service authentication error") from exc
    except openai.RateLimitError as exc:
        logger.warning("OpenAI rate limit hit during BRD generation: %s", exc)
        raise HTTPException(status_code=429, detail="AI service rate limit — please retry") from exc
    except openai.OpenAIError as exc:
        logger.error("OpenAI error during BRD generation: %s", exc)
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = _parse_ai_json(raw)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse BRD JSON: %s — raw=%r", exc, raw[:200])
        raise HTTPException(status_code=502, detail="BRD generator returned invalid JSON") from exc

    sections_raw = parsed.get("sections") or {}
    sections: dict[str, str] = {str(k): str(v) for k, v in sections_raw.items() if isinstance(v, str)}

    fr_rows_raw = parsed.get("frTable") or []
    fr_rows: list[FrTableRow] = []
    for row in fr_rows_raw:
        if not isinstance(row, dict):
            continue
        try:
            fr_rows.append(
                FrTableRow(
                    id=str(row.get("id", "")),
                    requirement=str(row.get("requirement", "")),
                    testable=bool(row.get("testable", True)),
                )
            )
        except Exception as exc:
            logger.warning("Skipping malformed FR row: %s — %s", row, exc)

    logger.info(
        "BRD generated: %d sections · %d FRs · %d open items",
        len(sections),
        len(fr_rows),
        len(parsed.get("openItems") or []),
    )

    return BrdResponse(
        sections=sections,
        frTable=fr_rows,
        openItems=list(parsed.get("openItems") or []),
        detectedAudience=parsed.get("detectedAudience"),
        model=settings.OPENAI_MODEL,
    )


# ─── Discovery Track: Approach Note generation (Stage 3) ──────────────────

class AnDecision(BaseModel):
    question: str
    decision: str


class AnOpenQuestion(BaseModel):
    number: int
    question: str
    default: str = ""


class AnBrandTokens(BaseModel):
    primary: str = "#0B1B2E"
    surface: str = "#FFFFFF"
    cta: str = "#F97316"
    logo: str | None = None
    productName: str = "—"


# ─── §12 PRD-Readiness Bridge models ─────────────────────────────────────
# Skill 03 §12 — structured form mirrors the §12 markdown narrative so the
# downstream PRD generator can lift items directly without manual re-keying.

class AnActor(BaseModel):
    role: str
    type: str = ""  # internal / external / system
    description: str = ""
    permissions: str = ""


class AnIntegration(BaseModel):
    name: str
    type: str = ""  # API / SDK / webhook / SSO / payment / messaging
    purpose: str = ""
    criticality: str = ""  # must-have / nice-to-have
    phase: str = ""


class AnCustomerJourney(BaseModel):
    name: str
    primaryActor: str = ""
    trigger: str = ""
    steps: list[str] = Field(default_factory=list)
    successOutcome: str = ""
    failureModes: list[str] = Field(default_factory=list)


class AnFunctionalLandscapeRow(BaseModel):
    module: str
    purpose: str = ""
    frRefs: list[str] = Field(default_factory=list)


class AnUiUxRequirements(BaseModel):
    interactionPatterns: str = ""
    accessibility: str = ""
    responsive: str = ""
    emptyErrorStates: str = ""
    microcopyTone: str = ""
    internationalization: str = ""


class AnComplianceRow(BaseModel):
    standard: str
    applicability: str = ""
    phase1Controls: str = ""


class AnTestType(BaseModel):
    coverageTarget: str = ""
    tools: str = ""
    owner: str = ""


class AnTestingRequirements(BaseModel):
    unit: AnTestType = Field(default_factory=AnTestType)
    integration: AnTestType = Field(default_factory=AnTestType)
    e2e: AnTestType = Field(default_factory=AnTestType)
    evalHarness: AnTestType = Field(default_factory=AnTestType)
    accessibility: AnTestType = Field(default_factory=AnTestType)
    performance: AnTestType = Field(default_factory=AnTestType)
    security: AnTestType = Field(default_factory=AnTestType)


class AnReceivable(BaseModel):
    item: str
    ownerClient: str = ""
    neededByWeek: int | None = None
    blocking: bool = False


class AnEnvironment(BaseModel):
    environment: str
    purpose: str = ""
    phase1Hosting: str = ""
    phase2Hosting: str = ""


class AnPrdReadiness(BaseModel):
    actors: list[AnActor] = Field(default_factory=list)
    integrations: list[AnIntegration] = Field(default_factory=list)
    customerJourneys: list[AnCustomerJourney] = Field(default_factory=list)
    functionalLandscape: list[AnFunctionalLandscapeRow] = Field(default_factory=list)
    uiUxRequirements: AnUiUxRequirements = Field(default_factory=AnUiUxRequirements)
    complianceRequirements: list[AnComplianceRow] = Field(default_factory=list)
    testingRequirements: AnTestingRequirements = Field(default_factory=AnTestingRequirements)
    keyDeliverables: list[str] = Field(default_factory=list)
    receivables: list[AnReceivable] = Field(default_factory=list)
    environmentList: list[AnEnvironment] = Field(default_factory=list)
    miscellaneous: str = ""


class AnRequest(BaseModel):
    brdSections: dict[str, str] = Field(default_factory=dict)
    brdFrTable: list[dict] = Field(default_factory=list)
    brdOpenItems: list[str] = Field(default_factory=list)
    productName: str = Field(default="", max_length=200)
    audience: str = Field(default="", max_length=50)
    changesRequested: str = Field(default="", max_length=4000)


class AnResponse(BaseModel):
    sections: dict[str, str] = Field(default_factory=dict)
    brandTokens: AnBrandTokens = Field(default_factory=AnBrandTokens)
    decisionsLocked: list[AnDecision] = Field(default_factory=list)
    openQuestions: list[AnOpenQuestion] = Field(default_factory=list)
    prdReadiness: AnPrdReadiness = Field(default_factory=AnPrdReadiness)
    detectedAudience: str | None = None
    model: str | None = None


@app.post("/an-generate", response_model=AnResponse, tags=["discovery"])
async def an_generate(
    body: AnRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> AnResponse:
    """
    Stage 3 of the Discovery Track. Convert a BRD into a 12-section Approach
    Note per skill 03 plus structured brandTokens / decisionsLocked /
    openQuestions / prdReadiness (the §12 bridge for downstream PRD bootstrap).
    Append-only versioning is handled on the NestJS side.
    """
    user_message = build_an_user_message(
        body.brdSections,
        body.brdFrTable,
        body.brdOpenItems,
        body.productName,
        body.audience,
        body.changesRequested,
    )

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": AN_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            # A 12-section AN with brand tokens + decisions + open questions +
            # PRD-readiness bridge is the largest single-document generation in
            # the pipeline. Use the model's full output budget — the §12 bridge
            # alone adds ~3000 tokens of structured JSON.
            max_tokens=16384,
            temperature=settings.OPENAI_TEMPERATURE,
            response_format={"type": "json_object"},
        )
    except openai.AuthenticationError as exc:
        logger.error("OpenAI auth failed during AN generation: %s", exc)
        raise HTTPException(status_code=401, detail="AI service authentication error") from exc
    except openai.RateLimitError as exc:
        logger.warning("OpenAI rate limit hit during AN generation: %s", exc)
        raise HTTPException(status_code=429, detail="AI service rate limit — please retry") from exc
    except openai.OpenAIError as exc:
        logger.error("OpenAI error during AN generation: %s", exc)
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = _parse_ai_json(raw)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse AN JSON: %s — raw=%r", exc, raw[:200])
        raise HTTPException(status_code=502, detail="AN generator returned invalid JSON") from exc

    sections_raw = parsed.get("sections") or {}
    sections: dict[str, str] = {str(k): str(v) for k, v in sections_raw.items() if isinstance(v, str)}

    bt_raw = parsed.get("brandTokens") or {}
    brand_tokens = AnBrandTokens(
        primary=str(bt_raw.get("primary", "#0B1B2E") or "#0B1B2E"),
        surface=str(bt_raw.get("surface", "#FFFFFF") or "#FFFFFF"),
        cta=str(bt_raw.get("cta", "#F97316") or "#F97316"),
        logo=bt_raw.get("logo"),
        productName=str(bt_raw.get("productName", "—") or "—"),
    )

    decisions: list[AnDecision] = []
    for d in parsed.get("decisionsLocked") or []:
        if not isinstance(d, dict):
            continue
        try:
            decisions.append(
                AnDecision(question=str(d.get("question", "")), decision=str(d.get("decision", "")))
            )
        except Exception as exc:
            logger.warning("Skipping malformed decision row: %s — %s", d, exc)

    open_qs: list[AnOpenQuestion] = []
    for q in parsed.get("openQuestions") or []:
        if not isinstance(q, dict):
            continue
        try:
            open_qs.append(
                AnOpenQuestion(
                    number=int(q.get("number", 0) or 0),
                    question=str(q.get("question", "")),
                    default=str(q.get("default", "") or ""),
                )
            )
        except Exception as exc:
            logger.warning("Skipping malformed open question: %s — %s", q, exc)

    prd_readiness = _parse_prd_readiness(parsed.get("prdReadiness"))

    logger.info(
        "AN generated: %d sections · %d decisions · %d open questions · "
        "prdReadiness(actors=%d, integrations=%d, journeys=%d, modules=%d, compliance=%d, deliverables=%d, receivables=%d)",
        len(sections),
        len(decisions),
        len(open_qs),
        len(prd_readiness.actors),
        len(prd_readiness.integrations),
        len(prd_readiness.customerJourneys),
        len(prd_readiness.functionalLandscape),
        len(prd_readiness.complianceRequirements),
        len(prd_readiness.keyDeliverables),
        len(prd_readiness.receivables),
    )

    return AnResponse(
        sections=sections,
        brandTokens=brand_tokens,
        decisionsLocked=decisions,
        openQuestions=open_qs,
        prdReadiness=prd_readiness,
        detectedAudience=parsed.get("detectedAudience"),
        model=settings.OPENAI_MODEL,
    )


def _parse_prd_readiness(raw: object) -> AnPrdReadiness:
    """Tolerant parser for the §12 PRD-Readiness Bridge structured payload.

    Skips malformed rows rather than failing the whole generation — the editor
    UI can fill gaps post-hoc.
    """
    if not isinstance(raw, dict):
        return AnPrdReadiness()

    actors: list[AnActor] = []
    for a in raw.get("actors") or []:
        if not isinstance(a, dict) or not a.get("role"):
            continue
        try:
            actors.append(
                AnActor(
                    role=str(a.get("role", "")),
                    type=str(a.get("type", "") or ""),
                    description=str(a.get("description", "") or ""),
                    permissions=str(a.get("permissions", "") or ""),
                )
            )
        except Exception as exc:
            logger.warning("Skipping malformed actor row: %s — %s", a, exc)

    integrations: list[AnIntegration] = []
    for i in raw.get("integrations") or []:
        if not isinstance(i, dict) or not i.get("name"):
            continue
        try:
            integrations.append(
                AnIntegration(
                    name=str(i.get("name", "")),
                    type=str(i.get("type", "") or ""),
                    purpose=str(i.get("purpose", "") or ""),
                    criticality=str(i.get("criticality", "") or ""),
                    phase=str(i.get("phase", "") or ""),
                )
            )
        except Exception as exc:
            logger.warning("Skipping malformed integration row: %s — %s", i, exc)

    journeys: list[AnCustomerJourney] = []
    for j in raw.get("customerJourneys") or []:
        if not isinstance(j, dict) or not j.get("name"):
            continue
        try:
            steps = [str(s) for s in (j.get("steps") or []) if s]
            failures = [str(f) for f in (j.get("failureModes") or []) if f]
            journeys.append(
                AnCustomerJourney(
                    name=str(j.get("name", "")),
                    primaryActor=str(j.get("primaryActor", "") or ""),
                    trigger=str(j.get("trigger", "") or ""),
                    steps=steps,
                    successOutcome=str(j.get("successOutcome", "") or ""),
                    failureModes=failures,
                )
            )
        except Exception as exc:
            logger.warning("Skipping malformed journey row: %s — %s", j, exc)

    landscape: list[AnFunctionalLandscapeRow] = []
    for m in raw.get("functionalLandscape") or []:
        if not isinstance(m, dict) or not m.get("module"):
            continue
        try:
            fr_refs = [str(x) for x in (m.get("frRefs") or []) if x]
            landscape.append(
                AnFunctionalLandscapeRow(
                    module=str(m.get("module", "")),
                    purpose=str(m.get("purpose", "") or ""),
                    frRefs=fr_refs,
                )
            )
        except Exception as exc:
            logger.warning("Skipping malformed landscape row: %s — %s", m, exc)

    ux_raw = raw.get("uiUxRequirements") or {}
    ux = AnUiUxRequirements(
        interactionPatterns=str(ux_raw.get("interactionPatterns", "") or ""),
        accessibility=str(ux_raw.get("accessibility", "") or ""),
        responsive=str(ux_raw.get("responsive", "") or ""),
        emptyErrorStates=str(ux_raw.get("emptyErrorStates", "") or ""),
        microcopyTone=str(ux_raw.get("microcopyTone", "") or ""),
        internationalization=str(ux_raw.get("internationalization", "") or ""),
    ) if isinstance(ux_raw, dict) else AnUiUxRequirements()

    compliance: list[AnComplianceRow] = []
    for c in raw.get("complianceRequirements") or []:
        if not isinstance(c, dict) or not c.get("standard"):
            continue
        try:
            compliance.append(
                AnComplianceRow(
                    standard=str(c.get("standard", "")),
                    applicability=str(c.get("applicability", "") or ""),
                    phase1Controls=str(c.get("phase1Controls", "") or ""),
                )
            )
        except Exception as exc:
            logger.warning("Skipping malformed compliance row: %s — %s", c, exc)

    test_raw = raw.get("testingRequirements") or {}
    def _test_type(key: str) -> AnTestType:
        sub = test_raw.get(key) if isinstance(test_raw, dict) else None
        if not isinstance(sub, dict):
            return AnTestType()
        return AnTestType(
            coverageTarget=str(sub.get("coverageTarget", "") or ""),
            tools=str(sub.get("tools", "") or ""),
            owner=str(sub.get("owner", "") or ""),
        )

    testing = AnTestingRequirements(
        unit=_test_type("unit"),
        integration=_test_type("integration"),
        e2e=_test_type("e2e"),
        evalHarness=_test_type("evalHarness"),
        accessibility=_test_type("accessibility"),
        performance=_test_type("performance"),
        security=_test_type("security"),
    )

    deliverables = [str(d) for d in (raw.get("keyDeliverables") or []) if d]

    receivables: list[AnReceivable] = []
    for r in raw.get("receivables") or []:
        if not isinstance(r, dict) or not r.get("item"):
            continue
        try:
            week_raw = r.get("neededByWeek")
            week_val = int(week_raw) if week_raw not in (None, "") else None
            receivables.append(
                AnReceivable(
                    item=str(r.get("item", "")),
                    ownerClient=str(r.get("ownerClient", "") or ""),
                    neededByWeek=week_val,
                    blocking=bool(r.get("blocking", False)),
                )
            )
        except Exception as exc:
            logger.warning("Skipping malformed receivable row: %s — %s", r, exc)

    envs: list[AnEnvironment] = []
    for e in raw.get("environmentList") or []:
        if not isinstance(e, dict) or not e.get("environment"):
            continue
        try:
            envs.append(
                AnEnvironment(
                    environment=str(e.get("environment", "")),
                    purpose=str(e.get("purpose", "") or ""),
                    phase1Hosting=str(e.get("phase1Hosting", "") or ""),
                    phase2Hosting=str(e.get("phase2Hosting", "") or ""),
                )
            )
        except Exception as exc:
            logger.warning("Skipping malformed environment row: %s — %s", e, exc)

    return AnPrdReadiness(
        actors=actors,
        integrations=integrations,
        customerJourneys=journeys,
        functionalLandscape=landscape,
        uiUxRequirements=ux,
        complianceRequirements=compliance,
        testingRequirements=testing,
        keyDeliverables=deliverables,
        receivables=receivables,
        environmentList=envs,
        miscellaneous=str(raw.get("miscellaneous", "") or ""),
    )


# ─── Discovery Track: Wireframe set generation (Stage 4) ──────────────────

class WireframeCallout(BaseModel):
    n: int | str
    description: str
    mappedTo: str = ""


class WireframeComponent(BaseModel):
    file: str
    purpose: str = ""


class WireframeScreen(BaseModel):
    sequenceNum: int
    slug: str
    title: str
    pattern: str | None = None
    callouts: list[WireframeCallout] = []
    components: list[WireframeComponent] = []
    mdContent: str | None = None
    htmlContent: str | None = None
    frRefs: list[str] = []


class WireframeBrandTokens(BaseModel):
    primary: str = "#0B1B2E"
    surface: str = "#FFFFFF"
    cta: str = "#F97316"
    productName: str = "—"


class WireframeRequest(BaseModel):
    anSections: dict[str, str] = Field(default_factory=dict)
    frTable: list[dict] = Field(default_factory=list)
    brandTokens: WireframeBrandTokens = Field(default_factory=WireframeBrandTokens)
    selectedPatterns: list[str] = Field(default_factory=list)
    productName: str = Field(default="", max_length=200)


class WireframeResponse(BaseModel):
    screens: list[WireframeScreen] = []
    coverageNotes: str | None = None
    model: str | None = None


@app.post("/wireframes-generate", response_model=WireframeResponse, tags=["discovery"])
async def wireframes_generate(
    body: WireframeRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> WireframeResponse:
    """
    Stage 4 of the Discovery Track. Convert an Approach Note into a complete
    lo-fi wireframe set per skill 04 — 7-14 screens with markdown bodies,
    HTML rendering, structured callouts, and components inventory.
    """
    user_message = build_wireframe_user_message(
        body.anSections,
        body.frTable,
        body.brandTokens.model_dump(),
        body.selectedPatterns or None,
        body.productName,
    )

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": WIREFRAME_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            # Largest output budget in the pipeline — full HTML for 12+ screens.
            max_tokens=16384,
            temperature=settings.OPENAI_TEMPERATURE,
            response_format={"type": "json_object"},
        )
    except openai.AuthenticationError as exc:
        logger.error("OpenAI auth failed during wireframe generation: %s", exc)
        raise HTTPException(status_code=401, detail="AI service authentication error") from exc
    except openai.RateLimitError as exc:
        logger.warning("OpenAI rate limit hit during wireframe generation: %s", exc)
        raise HTTPException(status_code=429, detail="AI service rate limit — please retry") from exc
    except openai.OpenAIError as exc:
        logger.error("OpenAI error during wireframe generation: %s", exc)
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = _parse_ai_json(raw)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse wireframe JSON: %s — raw=%r", exc, raw[:200])
        raise HTTPException(status_code=502, detail="Wireframe generator returned invalid JSON") from exc

    raw_screens = parsed.get("screens") or []
    screens: list[WireframeScreen] = []
    for s in raw_screens:
        if not isinstance(s, dict):
            continue
        try:
            callouts_raw = s.get("callouts") or []
            callouts = [
                WireframeCallout(
                    n=c.get("n", "?"),
                    description=str(c.get("description", "")),
                    mappedTo=str(c.get("mappedTo", "") or ""),
                )
                for c in callouts_raw
                if isinstance(c, dict)
            ]
            components_raw = s.get("components") or []
            components = [
                WireframeComponent(
                    file=str(c.get("file", "")),
                    purpose=str(c.get("purpose", "") or ""),
                )
                for c in components_raw
                if isinstance(c, dict)
            ]
            screens.append(
                WireframeScreen(
                    sequenceNum=int(s.get("sequenceNum", len(screens) + 1)),
                    slug=str(s.get("slug", f"screen-{len(screens) + 1}")),
                    title=str(s.get("title", f"Screen {len(screens) + 1}")),
                    pattern=s.get("pattern"),
                    callouts=callouts,
                    components=components,
                    mdContent=s.get("mdContent"),
                    htmlContent=s.get("htmlContent"),
                    frRefs=list(s.get("frRefs") or []),
                )
            )
        except Exception as exc:
            logger.warning("Skipping malformed wireframe screen: %s", exc)

    logger.info(
        "Wireframe set generated: %d screens · %d total callouts",
        len(screens),
        sum(len(s.callouts) for s in screens),
    )

    return WireframeResponse(
        screens=screens,
        coverageNotes=parsed.get("coverageNotes"),
        model=settings.OPENAI_MODEL,
    )


# ─── Discovery Track: Hi-fi mockup generation (Stage 5) ───────────────────

class HifiCallout(BaseModel):
    n: int | str
    description: str
    mappedTo: str = ""


class HifiScreen(BaseModel):
    sequenceNum: int
    slug: str
    title: str
    callouts: list[HifiCallout] = []
    htmlContent: str


class HifiBrandTokens(BaseModel):
    primary: str = "#0B1B2E"
    surface: str = "#FFFFFF"
    cta: str = "#F97316"
    productName: str = "—"


class HifiRequest(BaseModel):
    lofiScreens: list[dict] = Field(default_factory=list)
    brandTokens: HifiBrandTokens = Field(default_factory=HifiBrandTokens)
    syntheticSeed: dict = Field(default_factory=dict)
    productName: str = Field(default="", max_length=200)


class HifiResponse(BaseModel):
    screens: list[HifiScreen] = []
    syntheticDataNotes: str | None = None
    model: str | None = None


@app.post("/hifi-generate", response_model=HifiResponse, tags=["discovery"])
async def hifi_generate(
    body: HifiRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> HifiResponse:
    """
    Stage 5 of the Discovery Track. Polish lo-fi wireframes into branded
    high-fidelity HTML mockups per skill 05. Callout numbers preserved 1:1
    from the lo-fi parent (skill 05 §7 invariant — server-side validator
    enforces this).
    """
    user_message = build_hifi_user_message(
        body.lofiScreens,
        body.brandTokens.model_dump(),
        body.syntheticSeed,
        body.productName,
    )

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": HIFI_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            # Even larger output budget than lo-fi: hi-fi HTML is denser due
            # to inline styles, real content, and proper element structure.
            max_tokens=16384,
            temperature=settings.OPENAI_TEMPERATURE,
            response_format={"type": "json_object"},
        )
    except openai.AuthenticationError as exc:
        logger.error("OpenAI auth failed during hi-fi generation: %s", exc)
        raise HTTPException(status_code=401, detail="AI service authentication error") from exc
    except openai.RateLimitError as exc:
        logger.warning("OpenAI rate limit hit during hi-fi generation: %s", exc)
        raise HTTPException(status_code=429, detail="AI service rate limit — please retry") from exc
    except openai.OpenAIError as exc:
        logger.error("OpenAI error during hi-fi generation: %s", exc)
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = _parse_ai_json(raw)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse hi-fi JSON: %s — raw=%r", exc, raw[:200])
        raise HTTPException(status_code=502, detail="Hi-fi generator returned invalid JSON") from exc

    raw_screens = parsed.get("screens") or []
    screens: list[HifiScreen] = []
    for s in raw_screens:
        if not isinstance(s, dict):
            continue
        try:
            callouts_raw = s.get("callouts") or []
            callouts = [
                HifiCallout(
                    n=c.get("n", "?"),
                    description=str(c.get("description", "")),
                    mappedTo=str(c.get("mappedTo", "") or ""),
                )
                for c in callouts_raw
                if isinstance(c, dict)
            ]
            screens.append(
                HifiScreen(
                    sequenceNum=int(s.get("sequenceNum", len(screens) + 1)),
                    slug=str(s.get("slug", f"screen-{len(screens) + 1}")),
                    title=str(s.get("title", f"Screen {len(screens) + 1}")),
                    callouts=callouts,
                    htmlContent=str(s.get("htmlContent", "")),
                )
            )
        except Exception as exc:
            logger.warning("Skipping malformed hi-fi screen: %s", exc)

    logger.info(
        "Hi-fi set generated: %d screens · %d total callouts",
        len(screens),
        sum(len(s.callouts) for s in screens),
    )

    return HifiResponse(
        screens=screens,
        syntheticDataNotes=parsed.get("syntheticDataNotes"),
        model=settings.OPENAI_MODEL,
    )


# ─── Discovery Track: Brand-tokens extraction (Stage 3 polish) ────────────

class BrandTokensExtractResponse(BaseModel):
    primary: str = "#0B1B2E"
    surface: str = "#FFFFFF"
    cta: str = "#F97316"
    productName: str = "—"
    model: str | None = None


@app.post("/extract-brand-tokens", response_model=BrandTokensExtractResponse, tags=["discovery"])
async def extract_brand_tokens(
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
    image: UploadFile = File(...),
) -> BrandTokensExtractResponse:
    """
    Extract a 3-color brand palette + product name from a reference image
    (website screenshot / brand guide / logo). Used by the AN §3.10 brand
    tokens editor on the frontend.
    """
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Expected image/*, got {image.content_type or 'unknown'}",
        )

    # Encode the uploaded image as a data URL for the OpenAI Vision API.
    import base64
    raw = await image.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")
    data_url = f"data:{image.content_type};base64,{base64.b64encode(raw).decode()}"

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": BRAND_EXTRACTION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extract the brand palette from this reference."},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                },
            ],
            max_tokens=512,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
    except openai.AuthenticationError as exc:
        logger.error("OpenAI auth failed during brand extraction: %s", exc)
        raise HTTPException(status_code=401, detail="AI service authentication error") from exc
    except openai.RateLimitError as exc:
        logger.warning("OpenAI rate limit during brand extraction: %s", exc)
        raise HTTPException(status_code=429, detail="AI service rate limit") from exc
    except openai.OpenAIError as exc:
        logger.error("OpenAI error during brand extraction: %s", exc)
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    raw_response = response.choices[0].message.content or "{}"
    try:
        parsed = _parse_ai_json(raw_response)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse brand extraction JSON: %s — raw=%r", exc, raw_response[:200])
        raise HTTPException(status_code=502, detail="Brand extractor returned invalid JSON") from exc

    def hex_or_default(value: object, fallback: str) -> str:
        s = str(value or "").strip()
        return s if s.startswith("#") and len(s) in (4, 7) else fallback

    return BrandTokensExtractResponse(
        primary=hex_or_default(parsed.get("primary"), "#0B1B2E"),
        surface=hex_or_default(parsed.get("surface"), "#FFFFFF"),
        cta=hex_or_default(parsed.get("cta"), "#F97316"),
        productName=str(parsed.get("productName") or "—"),
        model=settings.OPENAI_MODEL,
    )


# ─── BA Tool: AI Format Transcript ─────────────────────────────────────────

class FormatTranscriptRequest(BaseModel):
    transcript: str = Field(..., min_length=1, max_length=30000)
    screenTitle: str = Field(default="", max_length=200)
    screenType: str = Field(default="", max_length=50)


class FormatTranscriptResponse(BaseModel):
    formattedText: str


FORMAT_TRANSCRIPT_PROMPT = """You are a senior business analyst. You receive a raw audio transcript
where a BA described a Figma screen verbally. Your job is to rewrite it into a clean, professional,
structured screen description suitable for a Functional Requirements Document (FRD).

RULES:
- Organise into clear sections: Screen Purpose, Primary Actor, Key Capabilities, UI Components, Business Rules, Navigation
- Use bullet points for lists
- Remove filler words, repetitions, and verbal hesitations (um, uh, like, you know, so basically)
- Correct grammar and punctuation
- Keep all factual content — do NOT invent information not in the transcript
- Use professional BA terminology (e.g., "The system shall..." for requirements)
- If the transcript mentions actors, fields, buttons, or flows — preserve them precisely
- Keep it concise but comprehensive — aim for 200-400 words
- Output plain text (no markdown headers, no code blocks)
"""


@app.post("/ba/format-transcript", response_model=FormatTranscriptResponse, tags=["ba"])
async def format_transcript(
    body: FormatTranscriptRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> FormatTranscriptResponse:
    """
    Reformat a raw audio transcript into professional BA documentation.
    """
    context = f"Screen: {body.screenTitle}" if body.screenTitle else ""
    if body.screenType:
        context += f" (Type: {body.screenType})"

    user_msg = f"{context}\n\nRaw transcript:\n{body.transcript}" if context else body.transcript

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": FORMAT_TRANSCRIPT_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=2048,
            temperature=0.3,
        )
    except openai.OpenAIError as exc:
        logger.error("Format transcript error: %s", exc)
        raise HTTPException(status_code=502, detail=f"AI formatting failed: {exc}") from exc

    formatted = (response.choices[0].message.content or "").strip()
    logger.info("Formatted transcript: %d → %d chars", len(body.transcript), len(formatted))

    return FormatTranscriptResponse(formattedText=formatted)


# ─── BA Tool: Refine artifact section text ──────────────────────────────────

class BaRefineSectionRequest(BaseModel):
    artifactType: str = Field(..., description="FRD | EPIC | USER_STORY | SUBTASK | SCREEN_ANALYSIS | PSEUDO_CODE")
    sectionLabel: str = Field(..., max_length=300)
    currentText: str = Field(..., max_length=20000)
    moduleContext: str = Field(default="", max_length=4000)
    instruction: str = Field(default="", max_length=2000, description="Optional refinement instruction")


class BaRefineSectionResponse(BaseModel):
    suggestion: str
    model: str


BA_REFINE_SYSTEM_PROMPT = """You are a senior business analyst and technical writer.
You refine, correct and improve a single section of a BA deliverable (FRD, EPIC,
User Story, or SubTask) while preserving its intent, factual content and any
identifiers (like F-01-01, EPIC-MOD-01, FR-xxx, TBD-Future markers, module IDs).

Rules:
- Keep the same structural markdown (headings, lists, tables) as the input unless the user instruction explicitly asks otherwise.
- Preserve all IDs, cross-references, and TBD-Future markers verbatim.
- Tighten language, fix grammar, remove redundancy, clarify ambiguity.
- Do NOT invent new facts, new features, or new integrations that are not implied by the existing text or module context.
- Return ONLY the refined section text — no preamble, no trailing commentary, no code-fence wrappers.
"""

PSEUDO_CODE_REFINE_SYSTEM_PROMPT = """You are a senior software engineer refining a single
pseudo-code / source file inside a low-level design (LLD). The user will provide the
current file contents, the file path and language via module context, and (optionally)
a plain-English instruction describing the change they want.

Rules:
- Preserve the file's language and syntax exactly (Python, TypeScript/TSX, Java, YAML, etc.).
- Preserve the Traceability block (FRD, EPIC, US, ST IDs) and any Collaborators comment.
- Preserve TBD-Future markers and stub traceability. Do NOT silently remove TBDs.
- If no instruction is given, do a light clean-up: fix obvious typos, tighten docstrings, normalize indentation, but DO NOT change logic or signatures.
- If an instruction IS given, apply only that change plus any trivial formatting cleanup it implies. Do not refactor unrelated code.
- Return ONLY the refined file contents — no preamble, no explanation, no markdown code fences. Output must be valid source code for the stated language.
"""


@app.post("/ba/refine-section", response_model=BaRefineSectionResponse, tags=["ba"])
async def ba_refine_section(
    body: BaRefineSectionRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> BaRefineSectionResponse:
    parts = [
        f"Artifact type: {body.artifactType}",
        f"Section: {body.sectionLabel}",
    ]
    if body.moduleContext.strip():
        parts.append(f"Module context:\n{body.moduleContext.strip()}")
    if body.instruction.strip():
        parts.append(f"User instruction: {body.instruction.strip()}")
    parts.append(f"Current section text:\n{body.currentText}")
    user_msg = "\n\n".join(parts)

    system_prompt = (
        PSEUDO_CODE_REFINE_SYSTEM_PROMPT
        if body.artifactType.upper() == "PSEUDO_CODE"
        else BA_REFINE_SYSTEM_PROMPT
    )

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=3000,
            temperature=0.3,
        )
    except openai.OpenAIError as exc:
        logger.error("BA refine-section error: %s", exc)
        raise HTTPException(status_code=502, detail=f"AI refine failed: {exc}") from exc

    suggestion = (response.choices[0].message.content or "").strip()
    # Strip stray markdown code fences if the model ignored the instruction
    if body.artifactType.upper() == "PSEUDO_CODE":
        suggestion = _strip_code_fences(suggestion)
    return BaRefineSectionResponse(suggestion=suggestion, model=settings.OPENAI_MODEL)


# ─── BA Tool: LLD Gap-Check + Image OCR ─────────────────────────────────────

class LldGapCheckRequest(BaseModel):
    moduleContext: str = Field(..., max_length=8000, description="Module + tech stack summary")
    narrative: str = Field(..., max_length=20000, description="Architect's free-form narrative")
    attachmentText: str = Field(default="", max_length=40000, description="Concatenated extracted text from attachments")
    useAsAdditional: bool = Field(default=True, description="True = narrative augments default LLD; False = narrative is the primary input")


class LldGap(BaseModel):
    id: str
    category: str      # e.g. "Security", "Data Model", "Integration", "Non-Functional"
    question: str      # what to ask the architect
    suggestion: str    # the suggested direction / default answer the AI would pick


class LldGapCheckResponse(BaseModel):
    gaps: list[LldGap]
    model: str


LLD_CANONICAL_SECTIONS = [
    "Summary", "Technology Stack", "Class Diagram", "Sequence Diagrams",
    "Data Model Definitions", "Schema Diagram", "Integration Points",
    "API Contract Manifest", "Non-Functional Requirements", "Cross-Cutting Concerns",
    "Env Var / Secret Catalog", "Test Scaffold Hints", "Build / CI Hooks",
    "Project Structure", "Open Questions / TBD-Future Reconciliation",
    "Applied Best-Practice Defaults", "Traceability Summary",
]


LLD_GAP_CHECK_SYSTEM_PROMPT = """You are a senior software architect performing a gap analysis.
The architect has provided a free-form narrative (and optionally attachment text) describing
what they want in the Low-Level Design. You must compare this against the standard LLD
framework the downstream generator will produce and identify gaps in BOTH directions:

  (A) Framework expectations the narrative does NOT address (e.g., architect wrote nothing
      about authentication, rate limiting, or data retention — ask about it).
  (B) Narrative mentions things the 19-section canonical LLD doesn't natively cover as a
      top-level section (e.g., "custom messaging bus adapter", "vector DB integration").
      For these, ask whether to fold them under §11 Integration Points (preferred) or treat
      them as additional narrative.

Framework canonical sections:
{sections}

Rules for your output:
- Return STRICT JSON only: {{"gaps": [{{"id": "g1", "category": "...", "question": "...", "suggestion": "..."}}, ...]}}
- id values are "g1", "g2", "g3" … in order.
- category is one of: Security, Data Model, Integration, Non-Functional, Observability, Testing, Scope, Custom.
- question is ONE specific question to the architect (no compound "and" questions).
- suggestion is the sensible default the generator WOULD pick if the architect says "just use the default".
- Prefer 5-10 high-signal gaps over 20 nitpicks. Skip anything the narrative already answers.
- If the narrative is very short or vague, include 1 gap with category "Scope" asking for more context.
- Output ONLY JSON. No preamble, no markdown fences, no trailing commentary.
"""


@app.post("/ba/lld-gap-check", response_model=LldGapCheckResponse, tags=["ba"])
async def ba_lld_gap_check(
    body: LldGapCheckRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> LldGapCheckResponse:
    system_prompt = LLD_GAP_CHECK_SYSTEM_PROMPT.format(
        sections="\n".join(f"  {i+1}. {s}" for i, s in enumerate(LLD_CANONICAL_SECTIONS))
    )
    mode = "additional-context" if body.useAsAdditional else "narrative-first"
    user_parts = [
        f"Mode: {mode}",
        f"Module / Stack context:\n{body.moduleContext}",
        f"Architect narrative:\n{body.narrative}",
    ]
    if body.attachmentText.strip():
        user_parts.append(f"Attachment extracts (truncated):\n{body.attachmentText[:20000]}")
    user_msg = "\n\n".join(user_parts)

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=2500,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
    except openai.OpenAIError as exc:
        logger.error("LLD gap-check error: %s", exc)
        raise HTTPException(status_code=502, detail=f"LLD gap-check failed: {exc}") from exc

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = _parse_ai_json(raw)
    except json.JSONDecodeError as exc:
        logger.error("LLD gap-check JSON parse failure: %s", raw[:500])
        raise HTTPException(status_code=502, detail="AI returned malformed JSON") from exc

    gaps = [LldGap(**g) for g in parsed.get("gaps", []) if g.get("question")]
    return LldGapCheckResponse(gaps=gaps, model=settings.OPENAI_MODEL)


# ─── BA Tool: FTC Gap-Check ─────────────────────────────────────────────────

class FtcGapCheckRequest(BaseModel):
    moduleContext: str = Field(..., max_length=8000)
    narrative: str = Field(..., max_length=20000)
    attachmentText: str = Field(default="", max_length=40000)
    useAsAdditional: bool = Field(default=True)
    # v4.3: multi-select; architects may pick several frameworks and several
    # test types. Either list may be empty, in which case the AI falls back
    # to sensible defaults (Playwright for web, pytest for backend; all types).
    testingFrameworks: list[str] = Field(default_factory=list)
    testTypes: list[str] = Field(default_factory=list)
    coverageTarget: str | None = Field(default=None)
    owaspWebEnabled: bool = Field(default=True)
    owaspLlmEnabled: bool = Field(default=True)
    excludedOwaspWeb: list[str] = Field(default_factory=list)
    excludedOwaspLlm: list[str] = Field(default_factory=list)
    includeLldReferences: bool = Field(default=True)
    hasLld: bool = Field(default=False)
    hasAiContent: bool = Field(default=False)


class FtcGapCheckResponse(BaseModel):
    gaps: list[LldGap]  # reuses the same {id, category, question, suggestion} shape
    model: str


FTC_CANONICAL_SECTIONS = [
    "Summary", "Test Strategy", "Test Environment & Dependencies",
    "Master Data Setup", "Test Cases Index", "Functional Test Cases",
    "Integration Test Cases", "White-Box Test Cases",
    "OWASP Web Top 10 Coverage Matrix", "OWASP LLM Top 10 Coverage Matrix",
    "Data Cleanup / Teardown", "Playwright Automation Readiness",
    "Traceability Summary", "Open Questions / TBD-Future Reconciliation",
    "Applied Best-Practice Defaults",
]


FTC_GAP_CHECK_SYSTEM_PROMPT = """You are a senior QA architect performing a gap analysis on
a Functional Test Cases (FTC) plan. The tester/architect has provided a narrative (and
optional attachments) describing additional test scenarios. You compare against the standard
FTC framework + OWASP expectations and surface gaps in BOTH directions:

  (A) Framework expectations the narrative does NOT address — e.g. the architect didn't
      mention data cleanup, or no test for rate limiting despite the module having one.
  (B) Narrative mentions scenarios the canonical sections don't natively cover — ask
      whether to file them under Integration Test Cases or treat them as narrative-driven.

Canonical FTC sections:
{sections}

OWASP considerations (honour the enabled flags + exclusion lists):
- Web Top 10 2021 (A01-A10): enabled={webEnabled}, excluded={excludedWeb}
- LLM Top 10 2025 (LLM01-LLM10): enabled={llmEnabled}, excluded={excludedLlm}
- The module {aiNote}has AI content. When AI content is present and LLM OWASP is enabled,
  ensure questions about prompt injection (LLM01), sensitive info disclosure (LLM02),
  improper output handling (LLM05), and excessive agency (LLM06) are raised unless
  already covered by the narrative or excluded.

LLD linkage:
- includeLldReferences={includeLld}; hasLld={hasLld}
- When hasLld is true and includeLldReferences is true, ask whether specific classes /
  methods from the LLD should be white-box tested; the narrative may be silent on this.

Rules for your output:
- Return STRICT JSON only: {{"gaps": [{{"id": "g1", "category": "...", "question": "...", "suggestion": "..."}}, ...]}}
- id values are "g1", "g2", "g3" … in order.
- category is one of: Scope, Coverage, Data, Integration, Security, LLM-Security,
  White-Box, Non-Functional, Observability, Tooling, Cleanup.
- question is ONE specific question. No compound "and" questions.
- suggestion is the sensible default this skill WOULD pick if the user says "use the default".
- Prefer 6-12 high-signal gaps over many nitpicks. Skip anything the narrative already answers.
- If the narrative is short or vague, include 1 gap with category "Scope" asking for more
  context about the module-under-test.
- Output ONLY JSON. No preamble, no markdown fences, no trailing commentary.
"""


@app.post("/ba/ftc-gap-check", response_model=FtcGapCheckResponse, tags=["ba"])
async def ba_ftc_gap_check(
    body: FtcGapCheckRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> FtcGapCheckResponse:
    system_prompt = FTC_GAP_CHECK_SYSTEM_PROMPT.format(
        sections="\n".join(f"  {i+1}. {s}" for i, s in enumerate(FTC_CANONICAL_SECTIONS)),
        webEnabled=body.owaspWebEnabled,
        excludedWeb=body.excludedOwaspWeb or "(none)",
        llmEnabled=body.owaspLlmEnabled,
        excludedLlm=body.excludedOwaspLlm or "(none)",
        aiNote="" if body.hasAiContent else "does not appear to ",
        includeLld=body.includeLldReferences,
        hasLld=body.hasLld,
    )
    mode = "additional-context" if body.useAsAdditional else "narrative-first"
    frameworks = ", ".join(body.testingFrameworks) if body.testingFrameworks else "(not selected — will default to Playwright for web, pytest for backend)"
    types = ", ".join(body.testTypes) if body.testTypes else "(not selected — will produce all types: Functional, Integration, UI, Security, Data, Performance, Accessibility, API)"
    user_parts = [
        f"Mode: {mode}",
        f"Testing frameworks: {frameworks}",
        f"Test types to generate: {types}",
        f"Coverage target (depth): {body.coverageTarget or '(not selected — will default to Regression)'}",
        f"Module / stack context:\n{body.moduleContext}",
        f"Tester/architect narrative:\n{body.narrative}",
    ]
    if body.attachmentText.strip():
        user_parts.append(f"Attachment extracts (truncated):\n{body.attachmentText[:20000]}")
    user_msg = "\n\n".join(user_parts)

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=2500,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
    except openai.OpenAIError as exc:
        logger.error("FTC gap-check error: %s", exc)
        raise HTTPException(status_code=502, detail=f"FTC gap-check failed: {exc}") from exc

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = _parse_ai_json(raw)
    except json.JSONDecodeError as exc:
        logger.error("FTC gap-check JSON parse failure: %s", raw[:500])
        raise HTTPException(status_code=502, detail="AI returned malformed JSON") from exc

    gaps = [LldGap(**g) for g in parsed.get("gaps", []) if g.get("question")]
    return FtcGapCheckResponse(gaps=gaps, model=settings.OPENAI_MODEL)


# ─── BA Tool: AC Coverage Verifier (standalone re-analysis) ─────────────────

class AcInputBundle(BaseModel):
    """One acceptance criterion supplied by the backend for analysis."""
    acSource: str                  # e.g. "US-001 AC#3"
    acSourceType: str              # EPIC | USER_STORY | SUBTASK | FEATURE
    acText: str
    sourceRef: str                 # the upstream artifact id (e.g. "US-001")


class TcInputBundle(BaseModel):
    """One test case summary supplied by the backend for analysis."""
    testCaseId: str                # e.g. "TC-001" / "Neg_TC-002"
    title: str
    category: str | None = None
    scope: str = "black_box"
    steps: str = ""
    expected: str = ""
    postValidation: str = ""
    linkedStoryIds: list[str] = Field(default_factory=list)
    linkedSubtaskIds: list[str] = Field(default_factory=list)
    linkedFeatureIds: list[str] = Field(default_factory=list)


class AcCoverageCheckRequest(BaseModel):
    acs: list[AcInputBundle] = Field(..., max_length=500)
    tcs: list[TcInputBundle] = Field(..., max_length=500)


class AcCoverageResult(BaseModel):
    acSource: str
    status: str                    # COVERED | PARTIAL | UNCOVERED
    coveringTcRefs: list[str]
    rationale: str


class AcCoverageCheckResponse(BaseModel):
    results: list[AcCoverageResult]
    model: str
    summary: dict                  # { covered, partial, uncovered, total }


AC_COVERAGE_SYSTEM_PROMPT = """You are a senior QA architect auditing test-plan coverage.
You receive a list of acceptance criteria (ACs) and a list of test cases (TCs). For every AC,
decide whether the test plan COVERS / PARTIALLY COVERS / DOES NOT COVER it, cite the TCs that
address it, and explain your decision in one or two sentences.

Status rules:
- COVERED: at least one TC directly asserts the AC's behaviour. Happy path + at least one
  negative/edge variant if the AC implies input validation.
- PARTIAL: the AC is addressed in one aspect but edge cases / error handling / boundary
  conditions the AC implies are missing.
- UNCOVERED: no TC addresses this AC.

Rules for output:
- Return STRICT JSON only: {{"results": [{{"acSource": "...", "status": "...", "coveringTcRefs": [...], "rationale": "..."}}, ...]}}
- Use the TC's testCaseId value (e.g. "TC-001", "Neg_TC-002") in coveringTcRefs. Empty list when UNCOVERED.
- rationale is one or two sentences. For UNCOVERED status, suggest what TC would close the gap.
- Be strict: a TC title that merely mentions the feature is NOT coverage unless its steps + expected actually assert the AC's behaviour.
- Output ONLY JSON. No preamble, no markdown fences.
"""


@app.post("/ba/ac-coverage-check", response_model=AcCoverageCheckResponse, tags=["ba"])
async def ba_ac_coverage_check(
    body: AcCoverageCheckRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> AcCoverageCheckResponse:
    if len(body.acs) == 0:
        return AcCoverageCheckResponse(
            results=[], model=settings.OPENAI_MODEL,
            summary={"covered": 0, "partial": 0, "uncovered": 0, "total": 0},
        )

    # Build a compact JSON payload for the AI
    acs_json = [ac.model_dump() for ac in body.acs]
    tcs_json = [tc.model_dump() for tc in body.tcs]
    user_msg = (
        f"Acceptance criteria ({len(acs_json)}):\n{json.dumps(acs_json, ensure_ascii=False)}\n\n"
        f"Test cases ({len(tcs_json)}):\n{json.dumps(tcs_json, ensure_ascii=False)[:30000]}"
    )

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": AC_COVERAGE_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=3000,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
    except openai.OpenAIError as exc:
        logger.error("AC coverage check error: %s", exc)
        raise HTTPException(status_code=502, detail=f"AC coverage check failed: {exc}") from exc

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = _parse_ai_json(raw)
    except json.JSONDecodeError as exc:
        logger.error("AC coverage JSON parse failure: %s", raw[:500])
        raise HTTPException(status_code=502, detail="AI returned malformed JSON") from exc

    results_raw = parsed.get("results", [])
    VALID_STATUS = {"COVERED", "PARTIAL", "UNCOVERED"}
    results: list[AcCoverageResult] = []
    for r in results_raw:
        if not r.get("acSource"):
            continue
        status = (r.get("status") or "UNCOVERED").upper()
        if status not in VALID_STATUS:
            status = "UNCOVERED"
        results.append(AcCoverageResult(
            acSource=r["acSource"],
            status=status,
            coveringTcRefs=r.get("coveringTcRefs") or [],
            rationale=r.get("rationale") or "",
        ))

    summary = {
        "covered": sum(1 for r in results if r.status == "COVERED"),
        "partial": sum(1 for r in results if r.status == "PARTIAL"),
        "uncovered": sum(1 for r in results if r.status == "UNCOVERED"),
        "total": len(results),
    }
    return AcCoverageCheckResponse(results=results, model=settings.OPENAI_MODEL, summary=summary)


# ─── BA Tool: RCA Analyzer (Phase 2a) ───────────────────────────────────────

class RcaAnalyzeRequest(BaseModel):
    """Send everything the AI needs to hypothesize a root cause."""
    defectTitle: str = Field(..., max_length=300)
    defectDescription: str = Field(default="", max_length=4000)
    reproductionSteps: str = Field(default="", max_length=4000)
    environment: str | None = Field(default=None, max_length=100)
    # Failing TC context
    testCaseId: str = Field(..., max_length=100)
    testCaseTitle: str = Field(..., max_length=500)
    testCaseSteps: str = Field(default="", max_length=4000)
    testCaseExpected: str = Field(default="", max_length=4000)
    testCasePostValidation: str = Field(default="", max_length=4000)
    testCasePlaywrightHint: str | None = Field(default=None, max_length=4000)
    # Optional LLD context for code-level reasoning (bounded to keep prompt small)
    lldContext: str = Field(default="", max_length=8000)
    # Extracted text from tester-uploaded evidence (logs, screenshots OCR'd, etc.)
    evidenceContext: str = Field(default="", max_length=8000)
    # Prior RCAs on the same defect — if any — so AI can refine or dissent
    priorAiRca: str | None = Field(default=None, max_length=2000)
    priorTesterRca: str | None = Field(default=None, max_length=2000)


class RcaAnalyzeResponse(BaseModel):
    rootCause: str
    contributingFactors: list[str]
    proposedFix: str
    confidence: float           # 0.0 - 1.0
    classification: str         # code_bug | test_bug | environment | flaky | data | unclear
    model: str


RCA_SYSTEM_PROMPT = """You are a senior software engineer performing Root Cause Analysis on a
failed test. Your job is to produce a crisp, actionable RCA — not a narrative essay.

Classify the failure into one of these bins:
- code_bug        — the implementation under test has a real defect
- test_bug        — the test assertion / setup is wrong; implementation is fine
- environment     — infra / config / network / data setup issue outside the code
- flaky           — timing / race / retry; intermittent but real
- data            — test fixture or seed data mismatches what the test expects
- unclear         — insufficient evidence; recommend what to gather next

Output format (STRICT JSON only, no markdown fences):
{
  "rootCause":           "<1-2 sentence crisp statement of the single most likely cause>",
  "contributingFactors": ["<factor 1>", "<factor 2>", ...],     // 0-5 bullets
  "proposedFix":         "<1-3 sentence concrete fix, referencing file/class/method when LLD context is provided>",
  "confidence":          0.0-1.0,
  "classification":      "<one of the bins above>"
}

Rules:
- Be specific. "Validation is missing" is bad; "AdminId validation is bypassed when email contains a '+' because the regex at SLABreachAlertService.py:42 rejects plus signs" is good.
- When LLD context is supplied, quote the exact class/method/file in rootCause and proposedFix.
- When tester evidence is supplied, cite the filename (e.g. "per auth-error.log: NullPointerException at line 42"); prefer evidence over speculation.
- If priorAiRca is present, either REFINE it with new evidence OR DISSENT with a different hypothesis — don't just restate it.
- If priorTesterRca is present, treat it as expert human input; disagree only with evidence.
- Confidence: 0.9+ means you'd stake a review on this; 0.5-0.7 means "most likely but verify"; <0.5 means "speculative, gather more data".
- NEVER hallucinate code. If you cite a file/class/method, it must appear in the LLD context or be referenced in the TC.
- Output ONLY the JSON object. No preamble, no markdown fences, no explanation.
"""


@app.post("/ba/rca-analyze", response_model=RcaAnalyzeResponse, tags=["ba"])
async def ba_rca_analyze(
    body: RcaAnalyzeRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> RcaAnalyzeResponse:
    # Compact prompt — include only what has signal
    sections: list[str] = [
        f"Defect title: {body.defectTitle}",
    ]
    if body.defectDescription.strip():
        sections.append(f"Defect description:\n{body.defectDescription}")
    if body.reproductionSteps.strip():
        sections.append(f"Reproduction steps:\n{body.reproductionSteps}")
    if body.environment:
        sections.append(f"Environment: {body.environment}")
    sections.append(
        f"Failing test case: {body.testCaseId} — {body.testCaseTitle}\n"
        f"Steps:\n{body.testCaseSteps}\n\n"
        f"Expected:\n{body.testCaseExpected}\n\n"
        f"Post-validation:\n{body.testCasePostValidation}"
    )
    if body.testCasePlaywrightHint:
        sections.append(f"Automation hint:\n{body.testCasePlaywrightHint}")
    if body.lldContext.strip():
        sections.append(f"LLD / source context (truncated):\n{body.lldContext[:8000]}")
    if body.evidenceContext.strip():
        sections.append(
            "Tester-uploaded evidence (logs / screenshot OCR / docs — cite filename when using):\n"
            f"{body.evidenceContext[:8000]}"
        )
    if body.priorAiRca:
        sections.append(f"Prior AI RCA (refine or dissent):\n{body.priorAiRca}")
    if body.priorTesterRca:
        sections.append(f"Prior tester RCA (expert human input):\n{body.priorTesterRca}")

    user_msg = "\n\n".join(sections)

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": RCA_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=1200,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
    except openai.OpenAIError as exc:
        logger.error("RCA analyze error: %s", exc)
        raise HTTPException(status_code=502, detail=f"RCA analyze failed: {exc}") from exc

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = _parse_ai_json(raw)
    except json.JSONDecodeError as exc:
        logger.error("RCA analyze JSON parse failure: %s", raw[:500])
        raise HTTPException(status_code=502, detail="AI returned malformed JSON") from exc

    VALID_CLASS = {"code_bug", "test_bug", "environment", "flaky", "data", "unclear"}
    classification = (parsed.get("classification") or "unclear").lower()
    if classification not in VALID_CLASS:
        classification = "unclear"
    try:
        confidence = float(parsed.get("confidence") or 0.0)
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    factors = parsed.get("contributingFactors") or []
    if not isinstance(factors, list):
        factors = [str(factors)]
    factors = [str(f) for f in factors if str(f).strip()]

    return RcaAnalyzeResponse(
        rootCause=str(parsed.get("rootCause") or "").strip() or "Insufficient evidence to determine root cause.",
        contributingFactors=factors,
        proposedFix=str(parsed.get("proposedFix") or "").strip(),
        confidence=confidence,
        classification=classification,
        model=settings.OPENAI_MODEL,
    )


class ExtractImageTextRequest(BaseModel):
    dataUrl: str = Field(..., description="data:<mime>;base64,<payload>")


class ExtractImageTextResponse(BaseModel):
    text: str
    provider: str


@app.post("/ba/extract-image-text", response_model=ExtractImageTextResponse, tags=["ba"])
async def ba_extract_image_text(
    body: ExtractImageTextRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> ExtractImageTextResponse:
    """
    Transcribe text content from an image attachment. Provider is selected via
    env LLD_OCR_PROVIDER (openai | gemini | tesseract). Only `openai` is wired
    today; the others raise 501 so the caller can display a helpful note.
    """
    provider = (os.getenv("LLD_OCR_PROVIDER") or "openai").lower()
    if provider == "openai":
        try:
            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an OCR + visual-content transcriber. Transcribe ALL visible text "
                            "in the image verbatim, preserving line breaks and lists. If the image contains "
                            "diagrams or charts, also describe them in plain prose under a heading "
                            "'## Visual description'. Output plain text only, no markdown fences."
                        ),
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Transcribe and describe this attachment."},
                            {"type": "image_url", "image_url": {"url": body.dataUrl}},
                        ],
                    },
                ],
                max_tokens=2000,
                temperature=0.0,
            )
            text = (response.choices[0].message.content or "").strip()
            return ExtractImageTextResponse(text=text, provider="openai")
        except openai.OpenAIError as exc:
            logger.error("Image OCR (openai) error: %s", exc)
            raise HTTPException(status_code=502, detail=f"Image OCR failed: {exc}") from exc

    # Gemini / Tesseract adapters intentionally left as stubs — wire in when
    # LLD_OCR_PROVIDER is set and credentials are present.
    raise HTTPException(status_code=501, detail=f"OCR provider '{provider}' not implemented")


# ─── BA Tool: Skill Execution endpoint ──────────────────────────────────────

class BaExecuteSkillRequest(BaseModel):
    systemPrompt: str = Field(..., description="Full skill file content as system prompt")
    textContent: str = Field(..., description="Assembled context text")
    images: list[dict] | None = Field(default=None, description="Base64 images for vision (SKILL-00)")


class BaExecuteSkillResponse(BaseModel):
    output: str


@app.post("/ba/execute-skill", response_model=BaExecuteSkillResponse, tags=["ba"])
async def ba_execute_skill(
    body: BaExecuteSkillRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> BaExecuteSkillResponse:
    """
    Execute a BA automation skill with the given system prompt and context.
    Supports vision (images) for SKILL-00 screen analysis.
    """
    # Build user message content
    user_content: list[dict] = []

    # Add images if provided (for SKILL-00)
    if body.images:
        for img in body.images:
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{img['source']['media_type']};base64,{img['source']['data']}",
                },
            })

    # Add text content
    user_content.append({"type": "text", "text": body.textContent})

    logger.info(
        "BA skill execution: %d chars text, %d images",
        len(body.textContent),
        len(body.images) if body.images else 0,
    )

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": body.systemPrompt},
                {"role": "user", "content": user_content},
            ],
            max_tokens=16384,
            temperature=0.3,
        )
    except openai.AuthenticationError as exc:
        logger.error("OpenAI auth failed: %s", exc)
        raise HTTPException(status_code=401, detail="AI service authentication error") from exc
    except openai.RateLimitError as exc:
        logger.warning("OpenAI rate limit: %s", exc)
        raise HTTPException(status_code=429, detail="AI service rate limit — please retry") from exc
    except openai.OpenAIError as exc:
        logger.error("OpenAI error: %s", exc)
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}") from exc

    output = (response.choices[0].message.content or "").strip()
    logger.info("BA skill output: %d chars", len(output))

    return BaExecuteSkillResponse(output=output)


# ─── New Pipeline: Project PRD + FRD Generation (Track C) ────────────────────
# Reuses the proven 22-section PARSE_SYSTEM_PROMPT. Section 6 (Functional
# Requirements) IS the FRD — hierarchical modules → features (FR-IDs, acceptance
# criteria, priorities). Input is the consolidated text of all customer inputs.

class ProjectPrdRequest(BaseModel):
    project_id: str
    consolidated_input: str = Field(..., description="All customer-input text concatenated")
    product_name: str | None = None
    mode: str = "interactive"  # "interactive" | "comprehensive"

class ProjectPrdGapItem(BaseModel):
    section: int
    question: str

class ProjectPrdResponse(BaseModel):
    sections: dict
    gaps: list[ProjectPrdGapItem] = []

@app.post("/project-prd-generate", response_model=ProjectPrdResponse, tags=["pipeline"])
async def project_prd_generate(
    body: ProjectPrdRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> ProjectPrdResponse:
    """
    Generate a combined PRD + FRD from all customer inputs (Track C).
    The FRD is embedded as Section 6 (Functional Requirements) of the 22-section PRD.
    """
    if not body.consolidated_input.strip():
        raise HTTPException(status_code=400, detail="consolidated_input is empty — add customer inputs first")

    system_prompt = _build_parse_prompt(body.mode)
    user_message = body.consolidated_input
    if body.product_name:
        user_message = f"Product name: {body.product_name}\n\n{user_message}"

    logger.info("project-prd-generate for %s (%d input chars)", body.project_id, len(user_message))

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
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
        logger.error("OpenAI error: %s", exc)
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    raw_content = (response.choices[0].message.content or "").strip()
    logger.info("project-prd-generate response: %d chars", len(raw_content))

    try:
        parsed = _parse_ai_json(raw_content)
    except json.JSONDecodeError:
        logger.error("project-prd-generate invalid JSON: %s", raw_content[:500])
        raise HTTPException(status_code=502, detail="AI returned invalid JSON")

    sections = parsed.get("sections", {})
    gaps_raw = parsed.get("gaps", [])
    gaps = [
        ProjectPrdGapItem(section=g.get("section", 0), question=g.get("question", ""))
        for g in gaps_raw
    ]
    return ProjectPrdResponse(sections=sections, gaps=gaps)


# ─── New Pipeline: Screen ↔ Feature Mapping (Track Y, v8) ────────────────────
# PRD-sourced screen map: screens + §6 FR-IDs + PRD-referenced annotations.
# Drives lo-fi/hi-fi wireframe generation (Stage 3a, between PRD and HLD).

class ScreenMapRequest(BaseModel):
    project_id: str
    prd_sections: dict = Field(..., description="The 22-section PRD+FRD JSON (Section 6 = FRD)")
    product_name: str | None = None

class ScreenMapResponse(BaseModel):
    screens: list[dict] = []
    coverage: dict = Field(default_factory=dict)

@app.post("/screen-map-generate", response_model=ScreenMapResponse, tags=["pipeline"])
async def screen_map_generate(
    body: ScreenMapRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> ScreenMapResponse:
    """
    Generate a PRD-sourced Screen ↔ Feature Mapping (Track Y). Every featureRef is a
    §6 FR-ID and every annotation prdRef cites PRD content (never SRS/BRD/Approach-Note).
    """
    if not body.prd_sections:
        raise HTTPException(status_code=400, detail="prd_sections is empty — generate the PRD first")

    user_message = json.dumps(body.prd_sections, ensure_ascii=False)
    if body.product_name:
        user_message = f"Product name: {body.product_name}\n\nPRD (22 sections, §6 = FRD):\n{user_message}"

    logger.info("screen-map-generate for %s (%d PRD chars)", body.project_id, len(user_message))

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SCREEN_MAP_SYSTEM_PROMPT},
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
        logger.error("OpenAI error: %s", exc)
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    raw_content = (response.choices[0].message.content or "").strip()
    logger.info("screen-map-generate response: %d chars", len(raw_content))

    try:
        parsed = _parse_ai_json(raw_content)
    except json.JSONDecodeError:
        logger.error("screen-map-generate invalid JSON: %s", raw_content[:500])
        raise HTTPException(status_code=502, detail="AI returned invalid JSON")

    screens = parsed.get("screens", []) if isinstance(parsed.get("screens"), list) else []
    coverage = parsed.get("coverage", {}) if isinstance(parsed.get("coverage"), dict) else {}
    return ScreenMapResponse(screens=screens, coverage=coverage)


# ─── New Pipeline: HLD Generation (Track E) ──────────────────────────────────
# 17-section HLD + Mermaid architecture diagrams, derived from the PRD+FRD.

class HldRequest(BaseModel):
    project_id: str
    prd_sections: dict = Field(..., description="The 22-section PRD+FRD JSON (Section 6 = FRD)")
    wireframe_context: str = ""
    product_name: str | None = None

class HldGapItem(BaseModel):
    section: int
    question: str

class HldResponse(BaseModel):
    sections: dict
    mermaid_diagrams: dict
    gaps: list[HldGapItem] = []

@app.post("/hld-generate", response_model=HldResponse, tags=["pipeline"])
async def hld_generate(
    body: HldRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> HldResponse:
    """
    Generate a 17-section High-Level Design + Mermaid diagrams from the PRD+FRD.
    """
    if not body.prd_sections:
        raise HTTPException(status_code=400, detail="prd_sections is empty — generate the PRD+FRD first")

    user_message = build_hld_user_message(
        body.prd_sections, body.wireframe_context, body.product_name or ""
    )
    logger.info("hld-generate for %s (%d msg chars)", body.project_id, len(user_message))

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": HLD_SYSTEM_PROMPT},
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
        logger.error("OpenAI error: %s", exc)
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    raw_content = (response.choices[0].message.content or "").strip()
    logger.info("hld-generate response: %d chars", len(raw_content))

    try:
        parsed = _parse_ai_json(raw_content)
    except json.JSONDecodeError:
        logger.error("hld-generate invalid JSON: %s", raw_content[:500])
        raise HTTPException(status_code=502, detail="AI returned invalid JSON")

    sections = parsed.get("sections", {})
    diagrams = parsed.get("mermaidDiagrams", parsed.get("mermaid_diagrams", {}))
    gaps_raw = parsed.get("gaps", [])
    gaps = [HldGapItem(section=g.get("section", 0), question=g.get("question", "")) for g in gaps_raw]
    return HldResponse(sections=sections, mermaid_diagrams=diagrams, gaps=gaps)


# ─── New Pipeline: E2E-Flow Generation (Track R) ─────────────────────────────
# Project-scoped, cross-module, decision-graph customer journeys + 4 Mermaid diagrams.

class E2eFlowRequest(BaseModel):
    project_id: str
    frd_sections: dict = Field(default_factory=dict, description="22-section PRD+FRD JSON (Section 6 = FRD)")
    modules: list = Field(default_factory=list, description="[{moduleId, moduleName, screens:[{screenId,title}]}]")
    config: dict | None = None
    product_name: str | None = None

class E2eFlowGapItem(BaseModel):
    question: str

class E2eFlowResponse(BaseModel):
    flows: list = []
    integrations: list = []
    gaps: list[E2eFlowGapItem] = []

@app.post("/e2e-flow-generate", response_model=E2eFlowResponse, tags=["pipeline"])
async def e2e_flow_generate(
    body: E2eFlowRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[openai.AsyncOpenAI, Depends(get_openai_client)],
) -> E2eFlowResponse:
    """Generate cross-module E2E flows (decision-graph) + Mermaid diagrams from the FRD + modules."""
    if not body.frd_sections:
        raise HTTPException(status_code=400, detail="frd_sections is empty — generate the PRD+FRD first")
    if not body.modules:
        raise HTTPException(status_code=400, detail="no modules provided — E2E flows span modules")

    user_message = build_e2e_flow_user_message(
        body.frd_sections, body.modules, body.config, body.product_name or ""
    )
    logger.info("e2e-flow-generate for %s (%d msg chars)", body.project_id, len(user_message))

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": E2E_FLOW_SYSTEM_PROMPT},
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
        logger.error("OpenAI error: %s", exc)
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    raw_content = (response.choices[0].message.content or "").strip()
    logger.info("e2e-flow-generate response: %d chars", len(raw_content))

    try:
        parsed = _parse_ai_json(raw_content)
    except json.JSONDecodeError:
        logger.error("e2e-flow-generate invalid JSON: %s", raw_content[:500])
        raise HTTPException(status_code=502, detail="AI returned invalid JSON")

    flows = parsed.get("flows", [])
    integrations = parsed.get("integrations", [])
    gaps = [E2eFlowGapItem(question=g.get("question", "")) for g in parsed.get("gaps", [])]
    return E2eFlowResponse(flows=flows, integrations=integrations, gaps=gaps)

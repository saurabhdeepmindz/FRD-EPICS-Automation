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

# Sprint v2 — Walkthrough

## Summary

Sprint v2 adds conversational PRD creation with AI-powered document parsing to the PRD Generator. Users can now paste raw text or upload documents (PDF/DOCX/MD/TXT), and the AI parses them into a structured 22-section PRD using enterprise-grade prompts with `[AI]` source tracking. An interactive gap wizard walks users through missing sections one-by-one, and a diff/review screen lets users Accept, Edit, or Skip each section before committing. The sprint also introduces Speech-to-Text (pluggable STT with five providers), version history with per-section audit trail, View Source modal, professional PDF/DOCX export with cover page and document history, admin settings, and a 3-level sidebar tree with dynamic Section 6 modules and Section 10 NFR sub-modules. Twelve tasks were completed across 70+ files adding approximately 9,000 lines of code.

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                        Browser (port 3001)                                    │
│                                                                               │
│   Next.js 14 (App Router) + Tailwind CSS + shadcn/ui                          │
│                                                                               │
│   /prd/new          ─── Tabbed: [Structured Form] | [Conversational]          │
│     ConversationalTab  ─── ModeToggle, FileDropzone, MicButton                │
│     GapWizard          ─── Section pills, per-gap card, skip/submit/progress  │
│     ChatArea           ─── Chat UI for gap analysis (alternative to wizard)   │
│                                                                               │
│   /prd/new/review   ─── SectionReviewCard x22 with Accept/Edit/Skip          │
│                         ReviewProgress bar, AI field count badges             │
│                                                                               │
│   /prd/:id/edit     ─── 3-level Sidebar (Section > Module > Feature)          │
│                         SubTabBar (scrollable), SectionForm, FormField         │
│                         MicButton + AISuggestButton on every field             │
│                         SectionHistory popover, ViewSource modal               │
│                                                                               │
│   /prd/:id/preview  ─── Cover page, Document History, TOC, logo upload        │
│                         [AI] prefix → blue font; PDF/DOCX export strips it    │
│                                                                               │
│   /dashboard        ─── PRD listing with AI badge, completion progress         │
│   /settings         ─── Admin settings (rate limit, model, file size)          │
│   /templates        ─── PRD template reference page                            │
│                                                                               │
└─────────────────────────────┬─────────────────────────────────────────────────┘
                              │ HTTP  (NEXT_PUBLIC_API_URL)
                              ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                     NestJS Backend (port 4000)                                │
│                     /api prefix — ValidationPipe                              │
│                                                                               │
│   PrdController                          AiController                         │
│   POST   /prd                            POST /ai/parse                       │
│   GET    /prd                            POST /ai/gap-check                   │
│   GET    /prd/:id                        POST /ai/suggest                     │
│   PUT    /prd/:id/section/:num           POST /ai/transcribe                  │
│   PATCH  /prd/:id/meta                                                        │
│   POST   /prd/:id/logo                   UploadController                     │
│   GET    /prd/:id/source                 POST /upload/extract                 │
│   GET    /prd/:id/completion                                                  │
│   GET    /prd/:id/history                SettingsController                   │
│   DELETE /prd/:id                        GET  /settings                       │
│                                          PUT  /settings                       │
│   ExportController                                                            │
│   GET /prd/:id/export/pdf                                                     │
│   GET /prd/:id/export/docx                                                    │
│                                                                               │
│   PrismaService (global) ─── PostgreSQL (port 5433)                           │
│   Tables: Prd, PrdSection, PrdAuditLog                                        │
└─────────────────────────┬──────────────────────────────────────┬──────────────┘
                          │ Prisma ORM                           │ HTTP (axios)
                          ▼                                      ▼
┌──────────────────────────────┐     ┌──────────────────────────────────────────┐
│   PostgreSQL 16              │     │   Python FastAPI AI Service (port 5000)  │
│                              │     │                                          │
│   Tables:                    │     │   GET  /health                           │
│   - prds                     │     │   POST /suggest   → OpenAI GPT-4.5      │
│   - prd_sections             │     │   POST /parse     → 22-section JSON     │
│   - prd_audit_logs           │     │   POST /gap-check → Gap analysis        │
│                              │     │   POST /transcribe → STT (5 providers)  │
│   Fields added in v2:        │     │                                          │
│     clientName, submittedBy  │     │   Prompts:                               │
│     clientLogo, sourceText   │     │     parse_prompts.py — Enterprise PRD    │
│     sourceFileName           │     │     gap_check_prompts.py — Checklist     │
│     sourceFileData           │     │                                          │
│                              │     │   STT Providers:                         │
│                              │     │     WhisperProvider (default)             │
│                              │     │     DeepgramProvider                     │
│                              │     │     AssemblyAIProvider                   │
│                              │     │     ElevenLabsProvider                   │
│                              │     │     CartesiaProvider (placeholder)       │
└──────────────────────────────┘     └──────────────────────────────────────────┘
```

## Files Created / Modified

---

### AI Service (Python FastAPI)

---

#### `ai-service/config.py`

**Purpose**: Application configuration loaded from environment variables via `pydantic-settings`. Extended in v2 with STT provider settings.

**Key exports**: `Settings` class, `get_settings()` factory (LRU-cached singleton).

**How it works**: The `Settings` class inherits from `BaseSettings` and reads environment variables for OpenAI credentials (`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_TEMPERATURE`), STT configuration (`STT_PROVIDER`, `STT_API_KEY`, `STT_MODEL`, `STT_LANGUAGE`), and service settings (`PORT`, `CORS_ORIGINS`). The `cors_origins_list` property splits the comma-separated `CORS_ORIGINS` into a list. STT defaults to `whisper` provider, which reuses the OpenAI API key if `STT_API_KEY` is empty.

---

#### `ai-service/main.py`

**Purpose**: FastAPI application with all AI endpoints. Extended in v2 with `/parse`, `/gap-check`, and `/transcribe` routes.

**Key functions**:
- `parse_requirements(body: ParseRequest)` — Accepts raw text (up to 60,000 chars) and mode (`all_in_one` or `interactive`). Calls OpenAI with `response_format={"type": "json_object"}` and the enterprise parse system prompt. Returns `ParseResponse` with 22 sections and gap list.
- `gap_check(body: GapCheckRequest)` — Accepts current sections and user answers. Calls OpenAI with the gap-check system prompt. Returns `GapCheckResponse` with updated sections, remaining gaps, and gap count.
- `transcribe(audio: UploadFile)` — Accepts audio files (webm/wav/mp3/m4a, max 25 MB). Delegates to the configured STT provider via `get_stt_provider()`. Returns `TranscribeResponse` with text and provider name.
- `_build_parse_prompt(mode: str)` — Concatenates `PARSE_SYSTEM_PROMPT` + `GAP_ANALYSIS_SUFFIX` + optional `INTERACTIVE_SUFFIX`.
- `_parse_ai_json(raw: str)` — Strips markdown code fences from AI response before JSON parsing.

**How it works**: Each endpoint uses FastAPI dependency injection for `Settings` and `openai.AsyncOpenAI` client. The parse endpoint enforces `json_object` response format and uses a lower temperature (0.3) for deterministic output. The gap-check endpoint sends the full 22-section JSON to the AI for re-evaluation. The transcribe endpoint reads the file buffer, validates size, and delegates to the pluggable STT provider. All OpenAI errors are caught and mapped to appropriate HTTP status codes (401, 429, 502).

---

#### `ai-service/prompts/parse_prompts.py`

**Purpose**: Enterprise-grade system prompt for parsing raw requirements into 22-section PRD JSON with `[AI]` source tracking.

**Key exports**: `PARSE_SYSTEM_PROMPT`, `GAP_ANALYSIS_SUFFIX`, `INTERACTIVE_SUFFIX`.

**How it works**: The system prompt instructs GPT-4.5 to act as a "world-class senior product manager" and generate comprehensive content for every section. It defines the exact JSON structure expected for each section (1-22), with detailed field-level guidance. Section 6 (Functional Requirements) uses a dynamic hierarchical module/feature structure with prefixed keys like `6.1_moduleName`, `6.1_features` (array of feature objects with `featureId`, `featureName`, `description`, `businessRule`, `acceptanceCriteria`, `priority`). Section 10 (NFRs) uses prefixed keys for 7 sub-modules (`10.1` through `10.7`) with measurable enterprise targets.

The critical `[AI]` source tracking rule requires the AI to prefix all AI-generated/inferred content with `"[AI] "` while leaving user-extracted content unprefixed. This enables the UI to render AI content in blue and user content in black. The `GAP_ANALYSIS_SUFFIX` adds completeness checklist evaluation, and the `INTERACTIVE_SUFFIX` limits gaps to 10-15 and prioritizes Sections 5, 6, and 10.

---

#### `ai-service/prompts/gap_check_prompts.py`

**Purpose**: System prompt for gap analysis that preserves `[AI]` source tracking prefixes during section merging.

**Key exports**: `GAP_CHECK_SYSTEM_PROMPT`.

**How it works**: Instructs the AI to merge user answers into appropriate sections, re-evaluate all 22 sections against a completeness checklist, and return updated sections with remaining gaps. User-provided answers must NOT get the `[AI]` prefix, while AI elaborations beyond user input must be prefixed. The checklist rules enforce minimum content thresholds per section: at least 4 modules with 3+ features for Section 6, all 7 NFR sub-modules for Section 10, at least 2 customer journeys for Section 8, and so on.

---

#### `ai-service/stt_providers.py`

**Purpose**: Pluggable Speech-to-Text provider system with five implementations and a factory registry.

**Key classes**: `STTProvider` (abstract base), `WhisperProvider`, `DeepgramProvider`, `AssemblyAIProvider`, `ElevenLabsProvider`, `CartesiaProvider`.

**Key function**: `get_stt_provider(settings: Settings) -> STTProvider` — Factory that reads `STT_PROVIDER` from config and instantiates the matching provider.

**How it works**: Each provider implements the `transcribe(audio_bytes, filename, mime_type) -> str` interface. `WhisperProvider` uses the OpenAI `audio.transcriptions.create` API. `DeepgramProvider` sends raw audio bytes to `api.deepgram.com/v1/listen` via httpx. `AssemblyAIProvider` uses a three-step upload/transcribe/poll flow. `ElevenLabsProvider` sends to `api.elevenlabs.io/v1/speech-to-text` with multipart form data. `CartesiaProvider` is a placeholder that raises `NotImplementedError`. The `PROVIDERS` dict maps string names to classes. Adding a new provider requires only implementing `STTProvider` and registering it in the dict.

---

#### `ai-service/requirements.txt`

**Purpose**: Python dependencies. Added `python-multipart==0.0.9` for file upload support (required by FastAPI `UploadFile`) and `httpx==0.27.0` for STT provider HTTP calls.

---

### Backend (NestJS)

---

#### `backend/prisma/schema.prisma`

**Purpose**: Database schema extended in v2 with audit trail model and PRD metadata fields.

**Key additions**:
- `Prd` model — Added `clientName`, `submittedBy`, `clientLogo` (base64 data-URI), `sourceText` (original input text, `@db.Text`), `sourceFileName`, `sourceFileData` (original file as base64, `@db.Text`), and `auditLogs` relation.
- `PrdAuditLog` model — Stores per-field change log with `prdId`, `sectionNumber`, `fieldKey`, `changeType` (enum: `CREATED | MODIFIED | AI_GENERATED | AI_MODIFIED`), `source` (enum: `AI | MANUAL`), `previousValue`, `newValue`, and `version`. Indexed on `[prdId, createdAt]`.
- `ChangeType` enum — `CREATED`, `MODIFIED`, `AI_GENERATED`, `AI_MODIFIED`.
- `ChangeSource` enum — `AI`, `MANUAL`.

**How it works**: The `PrdAuditLog` table creates one row per field change. When a section is updated via `updateSection()`, the service diffs old vs new content and writes audit entries with auto-incremented version numbers. The `sourceText` and `sourceFileData` fields store the original input used to create the PRD, enabling the View Source feature.

---

#### `backend/src/ai/ai.controller.ts`

**Purpose**: NestJS controller proxying AI requests to the Python FastAPI service. Extended in v2 with `parse`, `gapCheck`, and `transcribe` endpoints.

**Key methods**:
- `parse(@Body() dto: ParseDto)` — `POST /api/ai/parse`, proxies to Python `/parse`.
- `gapCheck(@Body() dto: GapCheckDto)` — `POST /api/ai/gap-check`, proxies to Python `/gap-check`.
- `transcribe(@UploadedFile() file)` — `POST /api/ai/transcribe`, uses `FileInterceptor('audio')` to handle multipart upload, proxies to Python `/transcribe`.

---

#### `backend/src/ai/ai.service.ts`

**Purpose**: Service layer that makes HTTP calls to the Python AI service using axios.

**Key methods**:
- `parse(dto: ParseDto): Promise<ParseResponse>` — POST to `${aiServiceUrl}/parse` with 180-second timeout. Returns sections and gaps.
- `gapCheck(dto: GapCheckDto): Promise<GapCheckResponse>` — POST to `${aiServiceUrl}/gap-check` with 180-second timeout. Returns updated sections and remaining gaps.
- `transcribe(file: Express.Multer.File): Promise<TranscribeResponse>` — Builds a `FormData` with the audio buffer and sends to `${aiServiceUrl}/transcribe` with 30-second timeout.

**How it works**: Each method wraps axios calls with error handling that maps Python service HTTP errors to NestJS `HttpException` with the same status code and detail message. The AI service URL defaults to `http://localhost:5000` and is configurable via the `AI_SERVICE_URL` environment variable.

---

#### `backend/src/ai/dto/parse.dto.ts`

**Purpose**: DTO for parse requests with class-validator decorators.

**Fields**: `text` (required, max 60,000 chars), `mode` (optional, regex-validated to `all_in_one` or `interactive`).

---

#### `backend/src/ai/dto/gap-check.dto.ts`

**Purpose**: DTO for gap-check requests.

**Fields**: `sections` (required object), `answers` (optional, max 10,000 chars).

---

#### `backend/src/upload/upload.controller.ts`

**Purpose**: File upload endpoint for text extraction from documents.

**Key method**: `extract(@UploadedFile() file)` — `POST /api/upload/extract`. Validates file presence, delegates to `ExtractService` for size validation, format detection, and text extraction. Returns `{ text, format, charCount, originalName }`.

---

#### `backend/src/upload/extract.service.ts`

**Purpose**: Text extraction service supporting PDF, DOCX, MD, and TXT formats.

**Key methods**:
- `getFormat(mimetype, originalname)` — Determines format from MIME type or file extension. Throws `BadRequestException` for unsupported formats.
- `validateSize(size)` — Rejects files over 20 MB with `BadRequestException`.
- `extractText(buffer, format)` — Routes to format-specific extractors.
- `extractPdf(buffer)` — Uses `pdf-parse` to extract text from PDF buffers. Handles scanned/image PDFs with a clear error message.
- `extractDocx(buffer)` — Uses `mammoth.extractRawText()` to extract plain text from DOCX buffers.

---

#### `backend/src/export/export.controller.ts`

**Purpose**: PDF and DOCX export endpoints with professional document structure.

**Key methods**:
- `exportPdf(@Param('id') id)` — `GET /api/prd/:id/export/pdf`. Loads the PRD and audit history, generates HTML via `generatePrdHtml()`, renders to PDF via Puppeteer with A4 format, header ("Product Requirements Document"), footer (page numbers), and margins.
- `exportDocx(@Param('id') id)` — `GET /api/prd/:id/export/docx`. Generates the same HTML and converts to DOCX via `html-docx-js` (with fallback to Microsoft Office-compatible HTML wrapper).

**How it works**: The `buildPrdData()` helper maps the Prisma PRD model to the `PrdData` interface expected by the HTML template. Both endpoints include audit history for the Document History page in the export.

---

#### `backend/src/export/pdf.service.ts`

**Purpose**: Puppeteer-based PDF renderer with header/footer and professional formatting.

**Key method**: `generatePdf(prd: PrdData, history?: unknown[]): Promise<Buffer>` — Launches headless Puppeteer, sets the HTML content, and renders to A4 PDF with `displayHeaderFooter: true`. Falls back to raw HTML buffer if Puppeteer is not installed.

---

#### `backend/src/export/templates/prd-html.ts`

**Purpose**: Comprehensive HTML template generator for PDF/DOCX export. Produces cover page, document history page, table of contents, all 22 sections, and an appendix with full revision history.

**Key functions**:
- `generatePrdHtml(prd: PrdData, history?: unknown[]): string` — Main entry point that assembles the full HTML document.
- `buildToc(sections)` — Generates a table of contents with nested module and feature links for Section 6.
- `buildDocumentHistory(history)` — Groups audit log entries by version and renders a change table.
- `renderSection6(content)` — Renders dynamic modules with feature tables, IDs, descriptions, business rules, acceptance criteria, and priority badges.
- `renderRevisionHistory(history)` — Full appendix table with version, date, section, field, change type, source, and summary columns.
- `stripAiPrefix(str)` — Strips `[AI]` prefix from values so PDF/DOCX renders all text in black.

**How it works**: The template uses inline CSS for maximum compatibility with Puppeteer and DOCX conversion. The cover page displays product name, PRD code, version, status, client name, submitted by, author, and client logo (base64 data-URI rendered as `<img>`). Each section is rendered with its section number as an anchor ID for TOC hyperlinks. The `[AI]` prefix is stripped before rendering so all content appears in uniform black text in exports.

---

#### `backend/src/settings/settings.controller.ts`

**Purpose**: Admin settings CRUD endpoints.

**Key methods**: `GET /api/settings` returns current settings, `PUT /api/settings` accepts partial updates.

---

#### `backend/src/settings/settings.service.ts`

**Purpose**: File-based settings persistence using `settings.json` in the project root.

**Key interface**: `AppSettings` — `rateLimit` (20), `maxFileSizeMB` (20), `aiModel` ("gpt-4.5-preview"), `aiTemperature` (0.4), `maxConcurrentUsers` (15), `uptimeTarget` (90).

**How it works**: `getSettings()` reads `settings.json` and merges with defaults. `updateSettings(updates)` performs an immutable merge of current settings with the update payload and writes back to disk. This avoids a database dependency for system configuration.

---

#### `backend/src/prd/prd.controller.ts`

**Purpose**: Extended PRD controller with v2 endpoints for metadata update, logo upload, source retrieval, and audit history.

**Key v2 additions**:
- `PATCH /api/prd/:id/meta` — Updates `clientName` and `submittedBy` via `updateMeta()`.
- `POST /api/prd/:id/logo` — Accepts image upload via `FileInterceptor`, validates MIME type, converts to base64 data-URI, stores in `clientLogo` field.
- `GET /api/prd/:id/source` — Returns original `sourceText`, `sourceFileName`, and `sourceFileData`.
- `GET /api/prd/:id/history` — Returns full audit trail ordered by `createdAt` descending.

---

#### `backend/src/prd/prd.service.ts`

**Purpose**: Core PRD business logic extended in v2 with audit trail, source storage, and metadata management.

**Key v2 additions**:
- `create(dto)` — Now accepts `clientName`, `submittedBy`, `sourceText`, `sourceFileName`, `sourceFileData`. Creates initial `PrdAuditLog` entry with `changeType: CREATED`.
- `updateSection(id, sectionNumber, dto)` — Computes the next version number from the latest audit log entry (e.g., `1.0` -> `1.1`), diffs old vs new content field-by-field via `diffContent()`, writes audit entries with appropriate `changeType` (`AI_GENERATED` vs `CREATED`, `AI_MODIFIED` vs `MODIFIED`), and auto-marks sections as `COMPLETE` when content is present.
- `diffContent(prdId, sectionNumber, oldContent, newContent, isAi, version)` — Iterates all keys in both old and new content objects, detects additions and modifications, and returns audit log entries. Uses `ChangeSource.AI` when `isAi` flag is true.
- `getHistory(id)` — Returns all audit log entries for a PRD.
- `getSource(id)` — Returns source text, filename, and file data.
- `updateMeta(id, data)` — Updates PRD-level metadata fields.

---

#### `backend/src/prd/dto/create-prd.dto.ts`

**Purpose**: Extended DTO for PRD creation with class-validator decorators.

**v2 additions**: `clientName` (optional, max 200), `submittedBy` (optional, max 200), `sourceText` (optional), `sourceFileName` (optional, max 500), `sourceFileData` (optional).

---

### Frontend (Next.js)

---

#### `frontend/lib/api.ts`

**Purpose**: Full API client with all v1 and v2 endpoints. Uses axios with base URL from `NEXT_PUBLIC_API_URL`.

**Key v2 additions**:
- `parseRequirements(payload: ParsePayload): Promise<ParseResponse>` — POST to `/ai/parse` with 180-second timeout. Accepts `text` and optional `mode`.
- `gapCheck(payload: GapCheckPayload): Promise<GapCheckResponse>` — POST to `/ai/gap-check` with 180-second timeout.
- `uploadAndExtract(file: File): Promise<ExtractResponse>` — POST multipart to `/upload/extract`. Returns extracted text, format, char count, and original filename.
- `transcribeAudio(audioBlob: Blob): Promise<TranscribeResponse>` — POST multipart to `/ai/transcribe`.
- `getSource(prdId): Promise<PrdSource>` — GET source text/file data.
- `getHistory(prdId): Promise<AuditLogEntry[]>` — GET audit trail.
- `updatePrdMeta(id, data): Promise<Prd>` — PATCH metadata.
- `uploadLogo(prdId, file): Promise<Prd>` — POST multipart logo.

**Interfaces**: `GapItem`, `ParsePayload`, `ParseResponse`, `GapCheckPayload`, `GapCheckResponse`, `ExtractResponse`, `TranscribeResponse`, `PrdSource`, `AuditLogEntry`, `CreatePrdPayload` (extended with `sourceText`, `sourceFileName`, `sourceFileData`).

---

#### `frontend/lib/section-config.ts`

**Purpose**: Section metadata for all 22 PRD sections. Section 6 `subModules` are no longer hardcoded — they are derived dynamically from PRD content at runtime.

**Key export**: `SECTIONS: readonly SectionMeta[]` — Array of 22 section definitions with `number`, `name`, `shortName`, and optional `subModules`. Section 6 has a comment: `// subModules are DYNAMIC — derived from PRD content at runtime, not hardcoded`. Section 10 has 7 static NFR sub-modules (`10.1` Performance through `10.7` Audit & Logging).

---

#### `frontend/lib/section-fields.ts`

**Purpose**: Field definitions for all 22 sections. Drives the generic `SectionForm` renderer.

**Key export**: `SECTION_FIELDS: Record<number, FieldDef[]>` — Maps section number to an array of `{ key, label, multiline?, rows?, placeholder? }`. Section 6 defines module-level fields (`moduleId`, `moduleName`, `moduleDescription`, `moduleBusinessRules`). Section 10 defines NFR-level fields (`category`, `requirement`, `metric`, `priority`).

---

#### `frontend/app/prd/new/page.tsx`

**Purpose**: PRD creation page refactored in v2 to a tabbed layout with Structured Form (v1) and Conversational (v2) tabs.

**How it works**: Uses a `Tab` state (`'structured' | 'conversational'`) to switch between tabs. The structured form tab preserves the original v1 form with fields for PRD Code, Product Name, Version, Author, Client Name, and Submitted By. The conversational tab renders `<ConversationalTab>` and passes a `handleParsed` callback that stores parsed sections and gaps in `sessionStorage` and navigates to `/prd/new/review`. Default tab is `'conversational'`.

---

#### `frontend/app/prd/new/review/page.tsx`

**Purpose**: Diff/review screen for AI-generated PRD sections. Users accept, edit, or skip each of the 22 sections before committing.

**Key functions**:
- `handleAccept(num)` / `handleEdit(num, content)` / `handleSkip(num)` — Update immutable review state per section.
- `handleAcceptAll()` — Marks all `pending` sections as `accepted`.
- `handleCommit()` — Creates the PRD via `createPrd()` with source data from `sessionStorage`, then calls `updateSection()` for each accepted/edited section with `aiSuggested: true`, cleans up `sessionStorage`, and redirects to `/prd/:id/edit`.

**How it works**: Loads parsed sections from `sessionStorage` on mount. Builds a `SectionReview[]` array with section number, name, content, and status. Auto-detects `productName` from Section 1. Renders `ReviewProgress` at the top, a metadata form (PRD Code, Product Name, Client Name, Submitted By), and `SectionReviewCard` for each section. A sticky bottom bar shows the commit button with accepted section count.

---

#### `frontend/components/conversational/ConversationalTab.tsx`

**Purpose**: Main conversational input component with text area, file upload, mode toggle, and gap wizard integration.

**Key functions**:
- `handleGenerate()` — Extracts text (from textarea or via `uploadAndExtract()` for files), stores original input in `sessionStorage` for source tracking, stores file as base64, calls `parseRequirements()`, and either navigates to review (all-in-one mode) or shows the GapWizard (interactive mode).
- `handleGapAnswers(answers)` — Calls `gapCheck()` API with consolidated answers and updates sections/gaps state.
- `handleProceedToReview()` — Passes current sections and gaps to the parent `onParsed` callback.

**How it works**: When `showGapWizard` is false, renders the input UI (textarea with `MicButton`, "OR" divider, `FileDropzone`, and "Generate PRD Draft" button). When true, renders the collapsible original input section and the `GapWizard`. The `MicButton` on the textarea appends transcribed text.

---

#### `frontend/components/conversational/GapWizard.tsx`

**Purpose**: Interactive per-gap wizard with section pills, active gap card, progress bar, skip/submit controls, and answer trail.

**Key state**:
- `gapAnswers: GapAnswer[]` — Per-gap tracking with `status` (`pending | answered | skipped`) and `answer`.
- `activeIndex` — Currently displayed gap index.
- `sectionPills` — Computed unique sections with aggregated status (all answered = green, all done but some skipped = gray, else amber).

**Key functions**:
- `handleSubmitAnswer()` — Marks current gap as `answered`, stores the input, and moves to the next pending gap.
- `handleSkip()` — Marks current gap as `skipped` and moves to next.
- `handleJumpToGap(idx)` — Direct navigation to any gap via section pills or answer trail.
- `handleReviewAll()` — Consolidates all answered gaps into a formatted string (`"Section N: answer"`), calls `onSubmitAll()` for gap-check, then proceeds to review.

**How it works**: The header shows gap count, section pills (clickable, color-coded), and a green progress bar. The active gap card displays the section name, question, a textarea with `MicButton`, and Submit/Skip buttons (Ctrl+Enter shortcut). Below the card, a trail of previously answered/skipped gaps is shown as clickable items. The footer has Previous/Next navigation and a "Review All & Proceed" button.

---

#### `frontend/components/conversational/FileDropzone.tsx`

**Purpose**: Drag-and-drop file upload zone with format and size validation.

**How it works**: Accepts PDF, DOCX, MD, and TXT files up to 20 MB. When a file is selected, it shows a card with the filename, file size, and a clear button. Uses a hidden `<input type="file">` with `accept=".pdf,.docx,.md,.txt"`. Validates extension and size on both drop and click-to-browse. Shows error messages inline for unsupported formats or oversized files.

---

#### `frontend/components/conversational/ModeToggle.tsx`

**Purpose**: Toggle between "All-in-one" and "Interactive" parsing modes.

**How it works**: A two-button pill toggle. The active mode gets `bg-primary text-primary-foreground`, the inactive gets muted styling. Calls `onModeChange` with the selected mode string.

---

#### `frontend/components/conversational/ChatArea.tsx`

**Purpose**: Chat-style UI for interactive gap analysis (alternative to the GapWizard).

**How it works**: Builds an initial AI message listing all gaps. User types answers in a text input and sends via Enter or button click. Messages appear in a scrollable area with AI (left, muted background) and user (right, primary background) bubbles. Shows a gap count badge in the header and a "Proceed to Review" button. When `gapCount` drops to 0, an AI message announces all gaps are resolved.

---

#### `frontend/components/review/SectionReviewCard.tsx`

**Purpose**: Individual section review card with Accept/Edit/Skip controls, `[AI]` source tracking, module/feature display, and NFR rendering.

**Key functions**:
- `isAiValue(val)` / `parseValue(val)` — Detect and strip `[AI]` prefix. Returns `{ text, isAi }`.
- `extractModules(content)` — Extracts Section 6 modules from prefixed keys (`6.1_moduleName`, `6.1_features`, etc.).
- `extractNFRs(content)` — Extracts Section 10 NFR sub-modules from prefixed keys (`10.1_category`, `10.1_requirement`, etc.).
- `RichText({ label, value })` — Helper component that renders label + value with blue text for AI-generated content.

**How it works**: Each card detects content presence, counts AI-generated fields (including nested feature strings), and shows a blue badge ("N AI-generated fields"). Section 6 cards render modules with a header row (module key, name, feature count), description, and either a collapsed feature ID list or expanded feature details (featureId, featureName, description, businessRule, acceptanceCriteria, priority badges). Section 10 cards render NFR sub-modules with category, requirement, and metric. Standard sections render field labels with values, using blue text for `[AI]`-prefixed content. Editing mode shows inline form fields. Status-based border colors: green for accepted, blue for edited, muted for skipped.

---

#### `frontend/components/review/ReviewProgress.tsx`

**Purpose**: Visual progress bar showing accepted (green), edited (blue), and skipped (gray) sections.

**How it works**: Receives `total`, `accepted`, `edited`, `skipped` counts. Renders a stacked horizontal bar where each segment's width is proportional to its count. Shows "N of 22 sections populated" text and a percentage. Below the bar, a legend shows counts for each status plus pending.

---

#### `frontend/components/forms/FormField.tsx`

**Purpose**: Generic form field with AI suggestion button, microphone button, and `[AI]` source tracking.

**How it works**: Renders a label row with `MicButton` and optional `AISuggestButton`. Detects `[AI]` prefix in the value and applies `text-blue-600` class. Shows contextual messages: "AI suggested — edit as needed" when `aiHighlighted` is true, "AI-generated content — displayed in blue" when value has `[AI]` prefix. Supports both single-line input and multiline textarea.

---

#### `frontend/components/forms/MicButton.tsx`

**Purpose**: Speech-to-text microphone button using the browser MediaRecorder API and the `/ai/transcribe` endpoint.

**Key functions**:
- `startRecording()` — Requests microphone access, detects supported MIME type (`audio/webm;codecs=opus` preferred), starts `MediaRecorder` with 250ms timeslice.
- `stopRecording()` — Stops the MediaRecorder, assembles chunks into a Blob, calls `transcribeAudio()`, and passes the result to `onTranscribed` callback.
- `getSupportedMimeType()` — Tests `audio/webm;codecs=opus`, `audio/webm`, `audio/ogg;codecs=opus`, `audio/mp4` in order.

**How it works**: Available in two sizes (`sm` and `md`). When recording, the button turns red and pulses. When transcribing, shows a spinner. Rejects recordings under 100 bytes. Handles errors for mic access denial, empty recordings, and transcription failures.

---

#### `frontend/components/forms/AISuggestButton.tsx`

**Purpose**: Reusable "AI Suggest" button with sparkle icon and loading spinner.

---

#### `frontend/components/forms/SectionHistory.tsx`

**Purpose**: Per-section change history popover showing audit log entries in a table.

**How it works**: A `History` icon button toggles an absolutely-positioned panel. On open, fetches all audit entries via `getHistory()` and filters by `sectionNumber`. Renders a table with Version, Date, Field, Type (color-coded badges: green for CREATED, blue for MODIFIED, purple for AI GENERATED, amber for AI MODIFIED), and Source columns.

---

#### `frontend/components/forms/ViewSource.tsx`

**Purpose**: Modal for viewing the original source text/document used to generate a PRD.

**How it works**: A "Source" button opens a fixed overlay modal. On open, fetches source data via `getSource()`. Displays metadata (filename, upload date, character count), a "Download Original File" button (creates a download link from the base64 `sourceFileData`), and the original text in a scrollable `<pre>` block. Shows a message if no source was saved (only stored for Conversational flow PRDs).

---

#### `frontend/components/forms/SectionForm.tsx`

**Purpose**: Generic section form renderer driven by `SECTION_FIELDS` definitions.

---

#### `frontend/components/layout/Sidebar.tsx`

**Purpose**: 3-level sidebar tree for PRD navigation: Section > Module > Feature.

**Key props**: `activeSection`, `activeSubTab`, `activeFeatureId`, `sectionStatuses`, `moduleFeatures`, `dynamicModuleNames`.

**How it works**: For Section 6, sub-modules are derived dynamically from `moduleFeatures` (keys starting with `6.`) rather than using hardcoded config. Each section row shows a status icon (green checkmark for COMPLETE, amber spinner for IN_PROGRESS, gray circle for NOT_STARTED). Sections with sub-modules have a chevron toggle. Level 2 (modules) shows module name with feature count badge. Level 3 (features) shows `featureId` and truncated `featureName` with monospace font. Active items get primary color highlighting. The sidebar uses `expandedSections` and `expandedModules` state for independent tree node expansion.

---

#### `frontend/components/layout/SubTabBar.tsx`

**Purpose**: Scrollable horizontal tab bar for sub-modules within a section.

**How it works**: Detects overflow using a `ResizeObserver` and scroll event listener. Shows left/right gradient fade buttons when content overflows. Auto-scrolls the active tab into view on mount and tab change. Each tab is a `shrink-0 whitespace-nowrap` button with active state styling. Uses `scrollbar-none` to hide the native scrollbar.

---

#### `frontend/components/layout/Stepper.tsx`

**Purpose**: Vertical step indicator for PRD creation workflow.

---

#### `frontend/app/prd/[id]/edit/page.tsx`

**Purpose**: PRD editor page extended in v2 with dynamic Section 6 modules, ViewSource button, and 3-level sidebar navigation.

**Key functions**:
- `extractModuleFeatures(content)` — Parses `{N.M}_features` keys from Section 6 content to build the `Record<string, FeatureItem[]>` for the sidebar.
- `extractDynamicSubModules(content)` — Parses `{N.M}_moduleName` keys to build sub-tab labels.

**How it works**: Uses the `usePrd` hook for data fetching. For Section 6, sub-modules are computed from actual PRD content using `section6SubModules` memo, not from hardcoded config. For Section 10, static NFR sub-modules from `section-config.ts` are used. The sidebar receives `moduleFeatures`, `dynamicModuleNames`, and section statuses. The SubTabBar receives the dynamically computed tabs.

---

#### `frontend/app/prd/[id]/preview/page.tsx`

**Purpose**: PRD preview page with cover page, document history, TOC, logo upload, source button, and `[AI]` prefix rendering.

**Key functions**:
- `AiText({ value })` — Renders text with `[AI]` prefix detection. AI content is blue (`text-blue-600`), user content is default color.
- `extractModules(content)` — Same module extraction as the review card.
- `buildDocumentHistory(history)` — Groups audit entries by version for display.

**How it works**: The preview renders the full document structure as it would appear in export: product name header, PRD code/version/status badges, client info, cover page with logo, document history table, and all 22 sections with their content. The `ViewSource` button is available in the toolbar. PDF and DOCX export buttons trigger downloads from `/api/prd/:id/export/pdf` and `/api/prd/:id/export/docx`.

---

#### `frontend/app/dashboard/page.tsx`

**Purpose**: PRD listing dashboard with delete functionality.

**Key functions**: `statusColor(status)` — Returns Tailwind color classes per status. `completionPercent(sections)` — Calculates percentage of COMPLETE sections.

---

#### `frontend/app/settings/page.tsx`

**Purpose**: Admin settings page for system-wide configuration.

**How it works**: Loads settings from `GET /api/settings` on mount. Displays input fields for rate limit, max file size (MB), AI model, AI temperature, max concurrent users, and uptime target. "Save Settings" sends the full settings object via `PUT /api/settings`. Shows a success confirmation after save.

---

#### `frontend/app/templates/page.tsx`

**Purpose**: Read-only PRD template reference page for BAs and customers.

---

## Data Flow

### Conversational PRD Creation (All-in-one mode)

```
1. User selects "Conversational" tab on /prd/new
2. User pastes text OR uploads PDF/DOCX/MD/TXT
   └─ File: POST /api/upload/extract → ExtractService → pdf-parse / mammoth → text
3. User clicks "Generate PRD Draft"
   └─ Original text + file stored in sessionStorage (prdSourceText, prdSourceFileName, prdSourceFileData)
4. Frontend → POST /api/ai/parse { text, mode: "all_in_one" }
   └─ NestJS → POST http://localhost:5000/parse
   └─ FastAPI → OpenAI GPT-4.5 (PARSE_SYSTEM_PROMPT + GAP_ANALYSIS_SUFFIX)
   └─ Returns: { sections: { "1": {...}, ..., "22": {...} }, gaps: [...] }
5. Sections + gaps stored in sessionStorage → redirect to /prd/new/review
6. User reviews 22 SectionReviewCards (Accept / Edit / Skip per section)
7. User fills PRD Code + Product Name → clicks "Accept All & Create PRD"
   └─ POST /api/prd { prdCode, productName, clientName, submittedBy, sourceText, ... }
   └─ For each accepted/edited section: PUT /api/prd/:id/section/:num { content, aiSuggested: true }
   └─ Each PUT triggers diffContent() → PrdAuditLog entries with version increment
8. Redirect to /prd/:id/edit (sections pre-populated)
```

### Conversational PRD Creation (Interactive mode)

```
1-4. Same as All-in-one, but mode: "interactive"
     └─ AI returns partial sections + gap list (10-15 focused questions)
5. Frontend shows GapWizard with section pills + per-gap cards
   └─ User answers gaps one-by-one (text or voice via MicButton)
   └─ Each "Submit & Next" stores answer locally
6. User clicks "Review All & Proceed"
   └─ Consolidates answers → POST /api/ai/gap-check { sections, answers }
   └─ NestJS → POST http://localhost:5000/gap-check
   └─ AI merges answers, re-evaluates → returns updatedSections + remainingGaps
7-8. Same as All-in-one steps 5-8
```

### Speech-to-Text Flow

```
1. User clicks MicButton on any text field
2. Browser requests microphone access → MediaRecorder starts (webm/opus)
3. User speaks → clicks button again to stop
4. Blob assembled → POST /api/ai/transcribe (multipart)
   └─ NestJS → FormData → POST http://localhost:5000/transcribe
   └─ FastAPI → get_stt_provider(settings) → WhisperProvider.transcribe()
   └─ OpenAI audio.transcriptions.create(model="whisper-1")
5. Text returned → appended to field value via onTranscribed callback
```

### Export Flow

```
1. User clicks "Export PDF" on preview page
   └─ GET /api/prd/:id/export/pdf
   └─ ExportController.exportPdf() → PrdService.findOne() + getHistory()
   └─ buildPrdData(prd) → generatePrdHtml(data, history) → PdfService.generatePdf()
   └─ Puppeteer renders HTML → A4 PDF with header/footer/margins
   └─ stripAiPrefix() removes [AI] prefix → all text renders black
   └─ Response: application/pdf attachment
```

### Audit Trail Flow

```
1. User or AI updates a section
   └─ PUT /api/prd/:id/section/:num { content, aiSuggested }
2. PrdService.updateSection():
   a. Loads current section content
   b. Computes nextVersion from latest PrdAuditLog (major.minor + 1)
   c. diffContent() compares old vs new field-by-field
   d. For each changed field: creates PrdAuditLog entry
      - changeType: AI_GENERATED / CREATED / AI_MODIFIED / MODIFIED
      - source: AI / MANUAL
      - previousValue / newValue
   e. Updates section status to COMPLETE
3. SectionHistory popover → GET /api/prd/:id/history → filter by sectionNumber
4. Export → grouped by version in Document History page + full Appendix
```

## Test Coverage

Sprint v2 focused on feature delivery. Existing v1 unit tests for `PrdController` and `PrdService` remain passing (`prd.controller.spec.ts`, `prd.service.spec.ts`). The Python AI service has `pytest` and `pytest-asyncio` in its requirements for future test expansion. Frontend components use `data-testid` attributes throughout for E2E test targeting (e.g., `conv-textarea`, `btn-generate`, `gap-wizard`, `review-card-{N}`, `mic-button`, `history-btn-{N}`, `source-panel`).

Test coverage expansion is deferred to v3 and should include:
- Unit tests for `ExtractService` (PDF/DOCX extraction)
- Unit tests for `PrdService.diffContent()` audit trail logic
- Integration tests for `/parse` and `/gap-check` endpoints with mocked OpenAI responses
- E2E tests for the conversational flow (upload -> parse -> review -> commit)
- STT provider unit tests with mocked API responses

## Security Measures

1. **OpenAI API key isolation**: The API key is only loaded server-side in the Python `Settings` class via environment variables. It never reaches the browser — the NestJS backend proxies all AI calls.

2. **Input validation**: All DTOs use `class-validator` decorators. `ParseDto.text` is capped at 60,000 chars. `GapCheckDto.answers` is capped at 10,000 chars. File uploads are limited to 20 MB with format whitelist (PDF/DOCX/MD/TXT). Audio files are limited to 25 MB.

3. **CORS restriction**: The Python AI service only accepts requests from the NestJS backend origin (`http://localhost:4000` by default).

4. **File type validation**: `ExtractService.getFormat()` validates both MIME type and file extension. Rejects anything not in the whitelist.

5. **Error message safety**: AI service errors are caught and re-thrown with generic messages. OpenAI error details are logged server-side but not exposed to the client.

6. **STT API key separation**: STT providers can use a separate `STT_API_KEY` from the OpenAI key, avoiding key reuse across services.

7. **Audit immutability**: `PrdAuditLog` entries are append-only — there is no update or delete endpoint for audit records.

## Known Limitations

1. **No streaming**: The `/parse` endpoint does not stream tokens progressively. Users see a loading spinner for the full 30-120 second parse duration. Streaming was deferred.

2. **Source storage in database**: Original files are stored as base64 in the `sourceFileData` column (`@db.Text`). For production, this should migrate to S3/blob storage with URL references.

3. **Settings in file**: Admin settings are persisted to a `settings.json` file on disk rather than a database table. This does not scale in multi-instance deployments.

4. **No authentication**: There is no user authentication or authorization. All endpoints are publicly accessible.

5. **No rate limiting**: While the admin settings page allows configuring a rate limit value, it is not enforced at the API level.

6. **Puppeteer dependency**: PDF export requires Puppeteer with a headless Chromium binary. If Puppeteer is not installed, the service falls back to returning raw HTML.

7. **No real-time collaboration**: Only one user can edit a PRD at a time. There is no optimistic locking or conflict detection.

8. **CartesiaProvider is a placeholder**: The Cartesia STT provider raises `NotImplementedError` — it is included for future integration only.

9. **DOCX export quality**: The DOCX export uses `html-docx-js` which produces basic formatting. Complex layouts may not render perfectly in Word.

## What's Next

Potential v3 improvements:

1. **EPIC and User Story generation** — Generate EPICs and user stories from the completed 22-section PRD, with traceability back to feature IDs.
2. **Streaming parse responses** — Stream AI tokens progressively so users see content being generated in real-time.
3. **Authentication and RBAC** — Add user login, roles (BA, Admin, Reviewer), and permission-based access control.
4. **S3 file storage** — Move `sourceFileData` and `clientLogo` to S3 with signed URL references.
5. **Database-backed settings** — Replace file-based settings with a Prisma `Settings` model.
6. **Rate limiting** — Enforce configurable rate limits on AI endpoints using NestJS throttler.
7. **Multi-document merge** — Allow uploading multiple documents and combining them into a single PRD.
8. **Version comparison** — Side-by-side diff between AI draft versions.
9. **Auto-save** — Persist conversational input mid-session to prevent data loss.
10. **E2E test suite** — Playwright tests covering the full conversational flow, gap wizard, review screen, and export.

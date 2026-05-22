# Approach Note — "Discovery & Solutioning Track for BA Tool"

## Claude Fit Assessment & Decision Input

| Field | Value |
|---|---|
| Project | FRD-EPICS-Automation — Discovery & Solutioning Track |
| Companion doc | `BRD-discovery-track.md` |
| Document version | **v1** (2026-04-30) |
| Supersedes | — (initial version) |
| Prepared by | Solution Architect (dogfood: produced via the very pipeline this document plans) |
| Audience | internal-tool (Deepmindz BA / presales / engineering) |
| Status | Decision-ready |

---

## 1. Executive Verdict

**Recommendation: GO with Claude.** All AI-specific capabilities — audio cleanup, structured artefact generation, branding extraction from reference pages, and callout-preserving hi-fi rendering — are direct fits for Claude features already in production use within the existing BA Tool. The non-AI parts (storage, versioning, project model, sandboxed iframe) are standard NestJS + Prisma + Next.js builds that reuse existing primitives.

**The Phase-1 stack is a 1:1 subset of the Phase-2 stack.** Phase 2 swaps managed services in for self-hosted equivalents (S3 for disk, Bedrock for direct Anthropic, ECS Fargate for native uvicorn, Cognito for no-auth) and turns on flags (multi-tenancy, BRD versioning, EPIC multi-source picker, PRD reference-docs panel). There is no rewrite — the existing BA Tool already follows a hexagonal-ish layout that the Discovery Track extends without modifying.

### Solution stack at a glance

| Layer | Tech (same code in both phases) | Phase 1 (laptop / single VM) | Phase 2 (cloud, ap-south-1) |
|---|---|---|---|
| Frontend | Next.js (existing App Router) | localhost | S3 + CloudFront |
| Audio capture | Browser MediaRecorder (existing `MicButton`) | localhost | localhost (browser-native) |
| STT | `STTProvider` interface + 5 providers (existing) | Whisper default | Whisper or AWS Transcribe (env swap) |
| AI orchestrator | Python FastAPI (existing `ai-service/main.py`) | Native uvicorn + venv | Containerized → ECS Fargate |
| Backend API | NestJS (existing) | Native | Containerized → ECS Fargate |
| Model routing | Per-stage rule-based (Haiku / Sonnet / Opus) | Same | Same |
| RDBMS | PostgreSQL 16+ (existing Prisma) | Native | RDS multi-AZ |
| LLM | Claude via existing Anthropic integration | Anthropic direct | AWS Bedrock (Mumbai) |
| Storage | `disk-storage` interface (existing) | Local disk | S3 |
| Audit | Existing audit log | Same | Same |
| Auth | Existing | Same | Cognito / Auth0 (P2) |
| Tenancy | `tenantId` on every new table | Single tenant ("default") | Multi-tenant flag flip |
| Branding tokens | End-user-supplied via AN §3.10 | Project-scoped | Per-tenant override (P2) |

---

## 2. Claude Feature / Model Palette Used

| Capability | Where it applies |
|---|---|
| Claude Haiku 4.5 | WFT cleanup (raw transcript → 7-section); inline section regeneration; quality validation prompts |
| Claude Sonnet 4.6 | BRD generation (full 15 sections); Approach Note section authoring; lo-fi wireframe generation per pattern |
| Claude Opus 4.7 | Hi-fi mockup HTML synthesis (callout-preservation invariant); branding palette extraction from reference pages |
| Messages API | Every generation turn |
| Tool use | Lo-fi pattern application (dispatch into 13-pattern catalogue); coverage validation invocations |
| Prompt caching | System prompt + AN brand tokens cached across all downstream stages |
| Vision | Reference page upload (logo / website screenshot / brand guide PDF) → extract palette |
| Files API | Brand guide PDF as input source for §3.10 token extraction |
| Streaming | Section-by-section render in editor UI |
| Citations | Every annotation row in lo-fi cites the specific BRD FR / AN § that drove it |

### 2.1 SDK Choice

**Anthropic Python SDK** (existing — reused via `ai-service/main.py`). Not the Agent SDK. Rationale: this pipeline is a deterministic 6-stage flow with explicit user gates between stages, not autonomous multi-step agentic work. Revisit Agent SDK only if Phase-2 introduces autonomous follow-up flows (none planned).

### 2.2 Considered but NOT used

- **MCP** — Skipped. No external system interaction beyond the existing tool ecosystem.
- **Claude Agent SDK** — Deferred. Pipeline is deterministic with user gates.
- **LangChain / LlamaIndex** — Skipped. Adds abstraction over the Messages API without unique benefit for this use-case.
- **External wireframe generators (Figma APIs / Whimsical APIs)** — Skipped. Per stakeholder direction, lo-fi/hi-fi are HTML+CSS only, generated directly via Claude.

### 2.3 Not provided by Claude (build / use OSS)

- Audio file storage / lifecycle / 90-day purge job
- Append-only versioning of Approach Note (Prisma schema + service logic)
- Sandboxed iframe rendering for hi-fi
- Coverage validator for traceability matrix (deterministic TS code)
- Callout parity check between lo-fi and hi-fi (deterministic TS code)
- Bundled reference templates (static asset registry)
- Audit log entries for artefact CRUD (reuse existing pattern)

---

## 3. Requirement-by-Requirement Fit

Legend — **Claude Provides:** ✓ Yes · ⚠ Partial · ✗ No

### 3.1 Functional Requirements

| ID | Requirement (from BRD §6) | Claude Provides | Claude Feature / Model | Build Around Claude |
|---|---|---|---|---|
| FR-1 | Audio file upload | ✗ | — | NestJS endpoint + browser file input |
| FR-2 | Audio transcription | ⚠ | (existing /transcribe with Whisper default) | Reuse existing endpoint; no new code |
| FR-3 | WFT 7-section generation | ✓ | Haiku 4.5 + structured prompt | Markdown renderer; persistence |
| FR-4 | BRD 15-section generation | ✓ | Sonnet 4.6 + skill 02 template | Section editor; quality validator |
| FR-5 | AN versioned generation | ✓ | Sonnet 4.6 + skill 03 template | Append-only DB schema + version timeline UI |
| FR-6 | Brand tokens (manual + reference page) | ✓ | Opus 4.7 + Vision (Files API for PDF) | Color picker UI; extraction confirmation flow |
| FR-7 | Lo-fi wireframe set | ✓ | Sonnet 4.6 + 13-pattern catalogue | Pattern picker; per-screen editor; matrix view |
| FR-8 | Coverage validation | ✗ | — | TypeScript validator over annotations data |
| FR-9 | Hi-fi mockup generation | ✓ | Opus 4.7 (high-stakes parity) | Sandboxed iframe; parity check |
| FR-10 | Sandboxed iframe rendering | ✗ | — | Browser-native sandbox attribute |
| FR-11 | Bundled reference templates | ✗ | — | Static asset registry; "View example" UI |
| FR-12 | EPIC + AN context | ⚠ | Existing EPIC service prompt extension | Add `approachNoteVersionId` FK to module; fold AN into prompt |
| FR-13 | Preserve existing flow | n/a | — | Discovery Context banner is the only structural addition |
| FR-14 | Audit logging | ✗ | — | Reuse existing audit pattern |
| FR-15 | Audio retention 90d | ✗ | — | Scheduled purge job + per-project setting |

### 3.2 Use-Case Fit (Phase 1 scope)

| Use-case | Claude Feature / Model | Notes |
|---|---|---|
| Audio voice note → 7-section WFT | Haiku 4.5 + structured prompt | No retrieval needed |
| WFT → 15-section BRD | Sonnet 4.6 + skill 02 prompt | Cached system prompt |
| BRD → versioned AN | Sonnet 4.6 + skill 03 prompt | Cached system prompt |
| Reference page → brand palette | Opus 4.7 + Vision | Files API for PDF input |
| AN → 12-screen lo-fi set | Sonnet 4.6 + tool use over 13-pattern catalogue | Per-pattern prompt |
| Lo-fi → hi-fi (callout-preserving) | Opus 4.7 + cached lo-fi prompt | Parity validation in code |
| EPIC + AN context | Existing EPIC prompt + cached AN prefix | Existing service extended |

### 3.3 Non-Functional Requirements

| Area | BRD §8 target | How Claude / build supports |
|---|---|---|
| Transcription latency | < 30 s | Existing endpoint already meets; cache on hot prompts |
| Generation latency | < 30 s per stage | Streaming + section-level rendering for perceived speed |
| Reuse | ≥ 70% | Skills' prompts are new; rest reuses BA Tool primitives |
| Audit | 100% | Reuse existing audit log; emit per-stage events |
| Sandboxing | Iframe sandbox | Browser-native; no Claude involvement |
| Multi-tenancy schema | tenantId day 1 | Schema enforced; Claude prompts threaded with tenant context |
| Compatibility | Zero regression | Discovery Track is additive; existing services untouched except small extensions |

### 3.4 Risks (mitigations)

| Risk (BRD §12) | Claude / build mitigation |
|---|---|
| Append-only AN versioning bloats DB | Compressed JSON; soft-archival; cold-tier in P2 |
| Generated HTML XSS vector | Iframe sandbox; CSP; prompt forbids `<script>` |
| LLM rate limits | Existing handling in `ai.service.ts`; Batch API for non-interactive runs |
| Existing module flow regression | Test suite gates; explicit "unchanged" list in stage 6 wireframe; PR review by maintainer |
| Branding extraction unreliable | Manual override always available; preview before commit |
| Stale AN version on module | UI banner: "AN has new versions, update?"; explicit user action |

### 3.5 NLP Preprocessing Layer

Not applicable in P1 — the existing `/transcribe` endpoint handles language detection. NLP enrichment (sentiment / NER) is not a requirement for the Discovery Track since downstream consumers (BRD generator, AN generator) receive cleaned text directly.

P2 may add: language hint propagation from STT into prompts; multi-language UI strings.

### 3.6 Voice I/O at Runtime

Audio input only at Stage 1 (and only as upload / record-to-stop, not real-time streaming). No TTS at any stage in P1. Reuses existing browser MediaRecorder via the existing `MicButton`.

### 3.7 Style Ingestion

Not applicable — there is no per-user style profile in this product. Brand tokens at AN §3.10 are project-scoped, not user-scoped.

### 3.8 Synthetic Data Plan

The bundled reference template (Shivam Jewels CRM example) IS the synthetic data source. Approximate volumes already produced:

- 1 BRD (15 sections, ~5 pages)
- 1 Approach Note (client-v5 edition, ~40 pages)
- 14 lo-fi wireframes + 14 hi-fi mockups (paired)
- 1 traceability matrix (FRs × screens)

End-user projects use real client audio + manually authored reference pages. No synthetic generation needed at runtime.

### 3.9 Domain Model

The Discovery Track is the domain. Key entities:

- **Project** (existing) — gains optional Discovery sub-tree
- **Discovery** (new, conceptual) — project-scoped container for the 5 Discovery artefact families
- **AudioFile** (new) — uploaded audio + retention policy
- **WFT** (new) — Well-formed Text artefact
- **BRD** (new) — Business Requirements Document artefact
- **ApproachNote** + **ApproachNoteVersion** (new) — append-only versioning
- **WireframeSet** + **WireframeScreen** (new) — lo-fi
- **HifiSet** + **HifiScreen** (new) — hi-fi
- **Module** (existing) — gains optional `approachNoteVersionId` FK
- **EpicArtifact** (existing) — gains optional `contextSourcesJson`

### 3.10 Branding & UI Theme

End-user-supplied via AN §3.10. Two input modes:

1. **Reference page upload** — drop client website screenshot / logo / brand guide PDF. Opus 4.7 + Vision extracts the palette. User confirms before commit.
2. **Manual entry** — color pickers + hex inputs + logo upload + product name field.

Output is a `brandTokens` JSON stored on the AN version that cascades to:
- Lo-fi wireframe generator (writes shared `wireframes.css` `:root` variables)
- Hi-fi generator (writes shared `hifi.css` `:root` variables)

Default tokens (if user does not set) — these serve two distinct purposes:

1. **Discovery Track UI itself** (this product's chrome — header, sidebar, callout badges) — these tokens are baked into the BA Tool styling and never change per project.
2. **New-project seed defaults** — when a presales user starts a new Discovery and hasn't yet uploaded a reference page or set colors manually, the AN §3.10 brand-token row is pre-populated with these values. The user can override at any point; the override does not affect the BA Tool's own UI.

| Element | Spec |
|---|---|
| Primary background | `#0B1B2E` (Dark Blue) |
| Surface / cards | `#FFFFFF` (White) |
| Primary CTA | `#F97316` (Orange) |
| Logo | placeholder until uploaded |
| Product name | inherits project name |

### 3.11 RAG / Hybrid Retrieval Design

Not applicable in P1. The 5-stage pipeline is deterministic with explicit input → output relationships; no semantic search is needed.

P2 candidates (deferred unless requested):
- "Find similar past projects" by AN content semantic match
- "Find similar past BRDs" for FR template reuse

### 3.12 Production-Parity Architecture

The existing BA Tool already follows a hexagonal-ish layout. The Discovery Track adds new services and controllers under `backend/src/ba-tool/discovery/` without modifying the existing structure.

#### 3.12.0 Brownfield variant — file taxonomy

Per skill 03 §3.12.0, every file path in §3.12.1 (backend) and §3.12.5 (frontend) below is tagged with one of:

| Tag | Meaning |
|---|---|
| **NEW** | File does not exist; will be created |
| **EXTENDED** | Existing file gets small additive changes; existing behavior preserved |
| **REUSED** | Existing file used as-is; no changes |
| **UNCHANGED** | Existing file explicitly listed to clarify scope (no behavior change) |

Quantitative target consistent with the companion BRD: **≥ 70% reuse share** (counted by file + LOC against fully-new equivalents). The Discovery Track adds ~12 new backend services + ~25 new frontend components + 9 new Prisma tables; reuses everything else (existing 8-step flow, AI service, Prisma layer, storage abstraction, MicButton, ArtifactViewer, MarkdownRenderer, AiEditableSection, audit log, project model). See the Punch list summary in §9 for an eyeball total.

#### 3.12.1 Backend folder structure

```
backend/src/ba-tool/discovery/             (NEW)
├── discovery.controller.ts                — NestJS routes for the new pipeline
├── discovery.module.ts                    — DI wiring
├── audio.service.ts                       — wraps existing /transcribe; manages 90-day retention
├── wft.service.ts                         — Stage 2: AI cleanup + persistence
├── brd.service.ts                         — Stage 3: 15-section generation + validation
├── approach-note.service.ts               — Stage 4: versioned (append-only)
├── approach-note-version.service.ts       — version creation + diff + client edition export
├── wireframe.service.ts                   — Stage 5: pattern-driven generation + matrix
├── wireframe-screen.service.ts            — per-screen generation
├── coverage.validator.ts                  — quality checks (deterministic, no LLM)
├── hifi.service.ts                        — Stage 6: callout-preserving HTML
├── parity.validator.ts                    — lo-fi ↔ hi-fi callout parity (deterministic)
├── audio-retention.job.ts                 — scheduled cleanup
├── templates/                             — bundled Shivam Jewels reference artefacts (static)
│   └── shivam-jewels/
│       ├── BRD-shivam-jewels.md
│       ├── Approach-Note-shivam-jewels-client-v5.md
│       ├── wireframes/  (14 .md + 14 .html + .css)
│       └── hifi-mockups/ (14 .html + .css)
└── dto/
    ├── audio-upload.dto.ts
    ├── generate-wft.dto.ts
    ├── generate-brd.dto.ts
    ├── new-an-version.dto.ts
    ├── generate-wireframes.dto.ts
    └── generate-hifi.dto.ts

backend/src/ba-tool/                       (EXTENDED — small additive only)
├── ba-narrative.service.ts                — accepts optional approachNoteVersionId param
└── (everything else UNCHANGED)

backend/src/ai/                            (REUSED — UNCHANGED)
└── ai.service.ts

ai-service/                                (REUSED — UNCHANGED)
└── main.py                                — already has /transcribe + 5 STT providers
```

#### 3.12.2 Single configuration surface

Phase 1 / Phase 2 differences encoded in env vars only:

```
# Phase 1 (.env)
NODE_ENV=development
DATABASE_URL=postgresql://...localhost...
STORAGE_PROVIDER=disk
STT_PROVIDER=whisper
LLM_PROVIDER=anthropic_direct
TENANCY_MODE=single
TENANT_ID_DEFAULT=default
AUDIO_RETENTION_DAYS=90
DISCOVERY_TRACK_ENABLED=true

# Phase 2 (.env.production)
NODE_ENV=production
DATABASE_URL=postgresql://...rds.amazonaws.com...
STORAGE_PROVIDER=s3
STT_PROVIDER=aws_transcribe   (or stay on whisper)
LLM_PROVIDER=anthropic_bedrock
TENANCY_MODE=multi
BRD_VERSIONING_ENABLED=true
EPIC_MULTI_SOURCE_ENABLED=true
PRD_REFERENCE_DOCS_ENABLED=true
```

#### 3.12.3 What is identical in both phases

| Aspect | Identical? |
|---|---|
| Domain models / business logic | ✓ |
| API surface (NestJS controllers) | ✓ |
| Database engine (Postgres) | ✓ |
| Schema (Prisma migrations) | ✓ |
| Frontend code | ✓ |
| `tenantId` column on every new table | ✓ (single value in P1, many in P2) |
| Existing BA Tool 8-step flow | ✓ (UNCHANGED both phases) |

#### 3.12.4 What changes between phases (config only)

| Change | Mechanism | Effort |
|---|---|---|
| Anthropic direct → Bedrock | env var | trivial |
| Local disk → S3 | env var | trivial |
| Whisper → AWS Transcribe | env var | trivial |
| Single → multi-tenant | flag flip + tenant resolver | small |
| BRD overwrite → versioned | flag + new schema migration | small |
| EPIC AN-only → multi-source | flag + UI picker | medium |
| PRD route → reference docs panel | flag + UI extension | small |
| Native runtime → containerized | Author Dockerfiles + ECR + ECS | small |

#### 3.12.5 Frontend folder structure

```
frontend/app/ba-tool/project/[id]/discovery/         (NEW)
├── page.tsx                                         — main pipeline view (wireframe 00)
├── audio/page.tsx                                   — Stage 1 detail (wireframe 01)
├── brd/page.tsx                                     — Stage 2 detail (wireframe 02)
├── approach-note/page.tsx                           — Stage 3 detail (wireframe 03)
├── wireframes/page.tsx                              — Stage 4 detail (wireframe 04)
├── wireframes/[screenId]/page.tsx                   — per-screen wireframe editor
├── hifi/page.tsx                                    — Stage 5 detail (wireframe 05)
└── hifi/[screenId]/page.tsx                         — per-screen hi-fi viewer

frontend/components/ba-tool/discovery/               (NEW)
├── DiscoveryPipeline.tsx                            — 13-stage horizontal visualization (00 wireframe)
├── DiscoveryRail.tsx                                — vertical sidebar nav (used in all stages)
├── StageDetailPanel.tsx                             — context-sensitive per-stage workspace
├── AudioUploader.tsx                                — composes existing MicButton + dropzone + file list
├── WftViewer.tsx                                    — 7-section tab viewer + editor
├── OpenQuestionsPanel.tsx                           — surfaces ambiguities (used in WFT, AN, etc.)
├── BrdEditor.tsx                                    — 15-section navigator + section editor
├── BrdSectionNav.tsx                                — section list with status
├── FrTableEditor.tsx                                — FR table with testability column
├── QualityCheckPanel.tsx                            — per-section validation
├── ApproachNoteEditor.tsx                           — version timeline + section editor
├── VersionTimeline.tsx                              — append-only version chips
├── ChangesSinceModal.tsx                            — capture changelog on save
├── BrandTokensEditor.tsx                            — color pickers + reference upload
├── BrandReferenceUploader.tsx                       — reference page upload + AI extraction confirm
├── DecisionsTable.tsx                               — §8.1 closed decisions
├── ScreenCataloguePicker.tsx                        — 13-pattern checkbox grid + custom add
├── ScreenGallery.tsx                                — wireframe thumbnail grid
├── TraceabilityMatrix.tsx                           — FRs × screens computed view
├── CoverageValidator.tsx                            — quality-check panel
├── HifiGallery.tsx                                  — sandboxed iframe grid
├── StateVariantToggle.tsx                           — default / loading / empty / error
├── AnnotationsDrawer.tsx                            — side drawer with callouts
├── ParityCheckPanel.tsx                             — callout parity status
├── ArtifactRefChip.tsx                              — linked-input chip (used across stages)
├── ReferenceTemplateLink.tsx                        — "View example" panel (used in stages 1-5)
├── DiscoveryContextBanner.tsx                       — module-page integration banner (Stage 6)
└── EpicContextTrace.tsx                             — tool trace: which AN sections drove which EPICs

frontend/components/ba-tool/                         (EXTENDED — small additive only)
├── ArtifactViewer.tsx                               — extended for sandboxed iframe rendering
├── EpicArtifactView.tsx                             — extended with "Generated with Discovery context" footer
└── (everything else UNCHANGED)

frontend/components/ba-tool/MicButton.tsx            (REUSED — UNCHANGED)
frontend/components/ba-tool/MarkdownRenderer.tsx     (REUSED — UNCHANGED)
frontend/components/ba-tool/AiEditableSection.tsx    (REUSED — UNCHANGED)
frontend/components/ba-tool/SkillStepper.tsx         (REUSED — UNCHANGED — the 8-step existing stepper)
```

---

## 4. Solution Architecture

### Phase 1 — Native (laptop / single VM)

```
[Browser]
   │ (existing MicButton + drag-drop)
   ▼
[Next.js dev server] ──► /ba-tool/project/[id]/discovery/...
   │ REST + SSE
   ▼
[NestJS backend] ──► [Prisma + PostgreSQL]
   │
   ├─► /api/ai/transcribe (existing) ──► [ai-service FastAPI] ──► [Whisper / 5 STTs]
   │
   └─► /api/ai/* (existing) ──► [ai-service] ──► [Anthropic API]
   │
   ▼
[disk-storage] ──► local FS
   │
   ▼
[audit log] ──► same Postgres
```

### Phase 2 — AWS Mumbai (production)

```
Users → CloudFront → Next.js (S3 / Amplify)
                       ▼
                ALB → NestJS (ECS Fargate, ap-south-1)
                       ▼
        ┌──────────────┴──────────────┐
        ▼                             ▼
   [ai-service Fargate]         [RDS PostgreSQL multi-AZ]
   Anthropic Bedrock                     │
   AWS Transcribe                        ▼
        ▼                          [S3 storage]
   [S3 audio + bundles]
        │
        ▼
   CloudWatch + X-Ray
   Cognito / Auth0 (auth)
   Secrets Manager (config)
   SQS (async retention purge job)
```

---

## 5. Model Routing Strategy

Single-axis (model only). Retrieval is not used in P1.

| Stage / Action | Model | Rationale |
|---|---|---|
| WFT cleanup (Stage 2) | Haiku 4.5 | Cheap, fast, simple structuring |
| BRD generation (Stage 3) | Sonnet 4.6 | Default for structured 15-section output |
| AN generation per section (Stage 4) | Sonnet 4.6 | Default — high-quality long-form |
| Brand palette extraction (Stage 4) | Opus 4.7 + Vision | Vision-required + high-stakes |
| Lo-fi per-screen (Stage 5) | Sonnet 4.6 | Pattern-driven structured output |
| Coverage validation (Stage 5) | Code only (no LLM) | Deterministic |
| Hi-fi per-screen (Stage 6) | Opus 4.7 | Callout-parity invariant is high-stakes |
| Parity check (Stage 6) | Code only (no LLM) | Deterministic |
| EPIC generation with AN context (Stage 9) | Sonnet 4.6 (existing) | Reuse existing EPIC service model |

Indicative cost share: Haiku ~10% · Sonnet ~70% · Opus ~20%.

### 5.1 Model Router

Implemented as a single function in `ai.service.ts` (or a new `discovery-router.ts`):

```typescript
function routeForDiscovery(stage: DiscoveryStage, opts: { hasImage?: boolean }) {
  if (stage === 'wft-cleanup') return 'claude-haiku-4-5';
  if (stage === 'hifi-generation') return 'claude-opus-4-7';
  if (stage === 'brand-extraction' && opts.hasImage) return 'claude-opus-4-7';
  return 'claude-sonnet-4-6';  // default
}
```

---

## 6. Coverage Summary

| Capability | Claude-native | Build (this project) | Reuse (existing BA Tool) |
|---|---|---|---|
| LLM reasoning | ✓ (Haiku/Sonnet/Opus) | — | — |
| Audio transcription | — | — | ✓ (`/api/ai/transcribe` + 5 STTs) |
| Vision (palette extraction) | ✓ | — | — |
| Browser audio capture | — | — | ✓ (`MicButton`) |
| Markdown rendering | — | — | ✓ (`MarkdownRenderer`) |
| Inline AI editing | — | — | ✓ (`AiEditableSection`) |
| Project model | — | — | ✓ (existing Prisma) |
| Storage abstraction | — | — | ✓ (`disk-storage`) |
| Audit log | — | — | ✓ (existing) |
| Append-only versioning | — | ✓ (new schema + service) | — |
| 13-pattern catalogue generation | ⚠ (via prompts) | ✓ (catalogue + prompts) | — |
| Coverage validator | — | ✓ (TypeScript) | — |
| Sandboxed iframe rendering | — | ✓ (small extension) | ⚠ (`ArtifactViewer` extended) |
| Callout parity check | — | ✓ (TypeScript) | — |
| Reference template registry | — | ✓ (static asset) | — |
| Discovery Context banner | — | ✓ (additive) | — |
| EPIC service extension | — | ✓ (small additive) | ⚠ (~95% reuse) |

**Estimated reuse share: ~70%** of moving parts already exist or extend trivially. New code is concentrated in: ~12 new backend services, ~25 new frontend components, 9 new Prisma tables, 2 small extensions to existing services.

---

## 7. Decision Inputs — Claude vs. Alternatives

| Axis | Claude | Alternatives | Verdict |
|---|---|---|---|
| Audio transcription | (via existing Whisper) | OpenAI direct, AWS Transcribe (already 5 providers configured) | Tie — reuse current default |
| Structured generation | Sonnet 4.6 | GPT-4 Turbo, Gemini Pro | Claude — already in production; cache hits compound |
| Vision (palette extraction) | Opus 4.7 + Vision | GPT-4V, Gemini Vision | Claude — keep stack consistent |
| Long-form authoring | Sonnet 4.6 | Equivalent | Claude |
| Tool use (catalogue dispatch) | Native | LangChain abstraction | Claude native — fewer moving parts |

No compelling reason to introduce a different LLM provider. Existing Claude integration via `ai-service/main.py` is reused.

---

## 8. Decisions Locked & Explanations

### 8.1 Closed by stakeholder input (8 decisions captured during conversation)

| # | Question | Decision |
|---|---|---|
| 1 | STT provider for Phase 1 | **Reuse existing** `MicButton` + `/api/ai/transcribe` + 5 STT providers (Whisper default). No new STT abstraction needed. |
| 2 | Discovery scope | **Project level** — one BRD / one AN per project, fans out to multiple modules |
| 3 | EPIC multi-source UI | **Phase 2** — Phase 1 is AN-only |
| 4 | Hi-fi rendering | **Sandboxed iframe** — preserves callout interactivity |
| 5 | Audio retention | **90 days default**, per-project setting |
| 6 | PRD integration | **Link from pipeline + reuse existing route**; Phase 2 adds reference-docs panel |
| 7 | BRD versioning | **Phase 1: overwrite** · Phase 2: append-only versioning |
| 8 | Pipeline gating | **Advisory** — warn but allow override |

Plus during wireframe iteration:

| Topic | Decision |
|---|---|
| Branding source | **End-user input** via AN §3.10 — reference page upload OR manual color pick |
| Reference templates | **Bundled default** (Shivam Jewels CRM example) accessible from each stage |

### 8.2 Reference explanations

- **Append-only versioning** = new versions stored as new rows; old versions never modified or deleted; supports audit trail and rollback
- **Sandboxed iframe** = `<iframe sandbox="allow-scripts">` without `allow-same-origin`; isolates generated HTML from app DOM
- **Callout parity** = the rule that hi-fi mockups MUST keep the same numbered annotations as their lo-fi parent (per skill 05 §7)
- **Advisory gating** = users can advance to a later stage even if quality checks fail in earlier stages, with a warning
- **AN-only EPIC context** = in P1, only the Approach Note (not BRD / lo-fi / hi-fi / FRD / PRD) is fed into EPIC generation
- **Project-scoped** = the Discovery artefacts belong to the project; modules (children of project) opt in to consume them

### 8.3 Still open — please clarify

| # | Question | Default proposed |
|---|---|---|
| 1 | Dedicated Product Owner (separate from sponsor)? | Saurabh Verma is both for now |
| 2 | "Reference template" feature — pre-loaded read-only project, or standalone bundled files? | Standalone bundled files (lighter) |
| 3 | Audit log — surface Discovery events in existing viewer, or new viewer? | Reuse existing |
| 4 | Audio retention override in UI in P1? | Yes, in Project Settings |
| 5 | PR review gate by BA Tool maintainer for any change touching existing services? | Yes, mandatory |

---

## 9. Phase 1 (PoC) Scope

**Duration: ~7 weeks** (per BRD §14 Next Steps).

### Punch list summary (eyeball total work)

| Category | Count | Where |
|---|---|---|
| New Prisma tables | **9** | AudioFile, WFT, BRD, ApproachNote, ApproachNoteVersion, WireframeSet, WireframeScreen, HifiSet, HifiScreen |
| Existing tables extended | 2 | `BaModule` (+`approachNoteVersionId` FK) · `EpicArtifact` (+`contextSourcesJson`) |
| New backend services | **~12** | All under `backend/src/ba-tool/discovery/` |
| Existing backend services extended | 1 | `ba-narrative.service.ts` (small additive — optional `approachNoteVersionId` param) |
| New frontend components | **~25** | All under `components/ba-tool/discovery/` |
| Existing frontend components extended | 2 | `ArtifactViewer.tsx` (sandboxed iframe) · `EpicArtifactView.tsx` (Discovery context footer) |
| New routes (Next.js App Router) | 8 | Main pipeline + 6 stage detail pages + per-screen wireframe + per-screen hi-fi |
| Bundled assets | 1 | Shivam Jewels reference template (BRD + AN + 14 lo-fi + 14 hi-fi) |
| Estimated reuse share | **≥ 70%** | Cross-references BRD §9 Success Metrics |

### Use cases (verified end-to-end)
1. Presales user uploads audio voice note → generates WFT
2. WFT → BRD with all 15 sections passing quality criteria
3. BRD → AN v1 with brand tokens set via reference page upload
4. Stakeholder review → AN v2 with "Changes since v1" log
5. AN → 12-screen lo-fi set with traceability matrix all-green
6. Lo-fi → 12-screen hi-fi set with parity check passing
7. Module created within the project → EPIC generation uses AN as context

### Components
1. 9 new Prisma tables (1 migration)
2. 1 small extension to existing `BaModule` (add `approachNoteVersionId` FK)
3. 1 small extension to existing `EpicArtifact` (add `contextSourcesJson`)
4. ~12 new backend services (under `backend/src/ba-tool/discovery/`)
5. ~25 new frontend components (under `components/ba-tool/discovery/`)
6. 1 new route group (`/discovery/...`) + 6 stage detail pages + 2 per-screen detail pages
7. Bundled Shivam Jewels reference templates (static assets)

### Native runs (no Docker required)
- `npm run dev` — Next.js
- NestJS via existing dev script
- `uvicorn` — ai-service
- Local PostgreSQL (existing)

### Eval harness
- 7 dogfood scenarios — one per stage flow + 1 end-to-end
- Quality gates per skill quality criteria (skill 02 §6, skill 03 §6, skill 04 §8, skill 05 §9)

### Phase 2 migration plan documented
See §11 below.

### 9.1 Success criteria

- A presales user runs the full pipeline (audio → hi-fi) in ≤ 1 working day
- 100% of generated lo-fi sets pass coverage validation
- 100% of generated hi-fi sets pass parity check
- 0 regressions on existing module / FRD / EPIC / US / ST / LLD / FTC tests
- ≥ 70% reuse of existing primitives (measured by file count + LOC against fully-new equivalents)
- ≥ 2 reviewers confirm EPIC quality lift when AN context is present vs. absent

### 9.2 Out of scope for Phase 1

(Everything in §11 below.)

---

## 10. Open Items for v(N+1)

(Refinements that may sharpen Approach Note v2 without blocking go-ahead on v1.)

- Sample audit-log entry shapes for each Discovery artefact CRUD event (specific structured format)
- Prisma schema-level decision: separate `Discovery` aggregate root, or per-artefact tables hanging directly off `Project`? Currently leaning toward per-artefact tables for simpler queries.
- Performance budget per stage (input audio size → expected end-to-end time)
- Concrete rollout plan (feature flag? gradual exposure to internal users? all-on?) once first version ships
- Naming convention for storage keys: `disk-storage://discovery/{projectId}/{stage}/{filename}` vs. flat?
- Whether the "Reference template" panel should expose all-stage examples or only the stage-specific one

---

## 11. Phase 2 — Post-PoC Production Roadmap

Indicative effort scale: **S** (≤ 2 days) · **M** (≤ 1 week) · **L** (≤ 2 weeks) · **XL** (> 2 weeks).

### 11.1 Hosting, Infrastructure & Containerization

- Author Dockerfiles for NestJS backend, Python ai-service, and Next.js frontend (S each, M total)
- ECR repositories + image build/push (CodeBuild or GitHub Actions) (S)
- ECS Fargate cluster + task definitions in ap-south-1 (M)
- VPC, IAM, security groups, Route 53, ACM, CloudFront (M total)
- IaC via Terraform or CDK (L)

### 11.2 LLM Provider Migration (Anthropic Direct → Bedrock)

- Set `LLM_PROVIDER=anthropic_bedrock` env var (trivial)
- Bedrock model access (Haiku 4.5 / Sonnet 4.6 / Opus 4.7) in ap-south-1 (S)
- Re-run dogfood scenarios for parity (S)

### 11.3 Multi-Tenancy Activation

- `TENANCY_MODE=multi` flag (S)
- Tenant resolver middleware (S — already designed)
- Per-tenant brand token namespace on AN versions (S)
- Tenant onboarding flow (M)

### 11.4 Authentication & Authorization

- Cognito user pool + clients (M)
- `AUTH_PROVIDER=cognito` env (S)
- Frontend auth wiring (M)
- Role definitions + RBAC enforcement on Discovery endpoints (M)
- SSO (SAML / OIDC) integration (M–L, optional)

### 11.5 Voice Stack Upgrade

Optional in P2 — existing 5 STT providers already cover this. If specific providers need to be the per-project default:

- Project-level STT provider override UI (S)
- Hot-swap without disrupting in-flight transcriptions (S)

### 11.6 Embedding Model Migration & Re-embed

Not applicable — no RAG / embeddings in this product.

### 11.7 Real Data Migration & ETL

Not applicable — no source-of-truth migration. Each project starts from raw audio.

### 11.8 Scale-up to Full Volume

- Audit log archival (24-month + cold storage) (M)
- AN version compression (gzip stored content) (S)
- Generated bundle archival to S3 with lifecycle rules (S)

### 11.9 Observability & Operations

- CloudWatch metrics + alarms (per-stage success/failure rate, latency) (M)
- X-Ray distributed tracing across NestJS + ai-service (S)
- Sentry / Rollbar for frontend errors (S)
- Cost dashboards (per-tenant, per-stage) (M)
- Runbooks for stage failures (M)

### 11.10 Performance & Reliability

- Auto-scaling ECS Fargate (S)
- RDS multi-AZ failover + read replicas (S)
- Rate limiting per tenant per stage (M)
- Load tests (M)

### 11.11 Security & Compliance Hardening

- WAF + DDoS (S)
- KMS encryption at rest (RDS, S3, Secrets Manager) (S)
- VPC isolation + private subnets (S)
- Audit log retention policy (M)
- Pen test (M)

### 11.12 Feature Expansions (deferred from Phase 1)

- **BRD append-only versioning** — schema migration + service logic + UI (M)
- **EPIC multi-source picker** — UI + EPIC service prompt extension to handle multiple context sources simultaneously (M)
- **PRD reference-documents panel** — PRD viewer extension showing hyperlinks to AN / hi-fi (S)
- **Per-tenant brand overrides** for the Discovery Track UI itself (S)
- **Dark/light theme variants** for hi-fi mockups (M)
- **Mobile/tablet adaptations** for hi-fi (M)
- **Figma token export** from brand tokens JSON (M)
- **Import existing BRD/AN markdown** (skip Stages 1–3 if user already has them) (M)
- **Discovery Track audit viewer** if existing viewer is insufficient (M)

### 11.13 Continuous Improvement Loop

- Eval harness expansion: 50+ scenarios (M)
- User feedback capture (👍/👎) on each generated artefact (S)
- Skill-prompt iteration based on eval scores (M)
- Per-tenant accuracy benchmarks (M)

### 11.14 Onboarding (for new client tenants in P2)

- Tenant signup flow (M)
- "Start from a template" wizard — clone Shivam Jewels reference structure (S)
- Brand token capture wizard at project creation (S)
- Admin console — users, roles, usage (L)

### 11.15 Indicative Phase 2 timeline

| Week | Milestones |
|---|---|
| 1 | AWS account + IaC + ECS + RDS scaffolding; Dockerfiles authored + ECR pipeline live |
| 2 | LLM swap to Bedrock; eval re-run; multi-tenancy activation |
| 3 | Auth (Cognito) + RBAC enforcement |
| 4 | BRD versioning + EPIC multi-source picker |
| 5 | PRD reference-docs panel + per-tenant brand overrides |
| 6 | Observability, runbooks, cost dashboards, load tests |
| 7 | Security hardening + pen test |
| 8+ | Feature expansions per priority |

**Net point:** Phase 2 effort is dominated by infrastructure and feature expansion, not application code rewrite. The hexagonal layout, provider abstractions, and `tenantId` discipline baked in during Phase 1 are what make this true.

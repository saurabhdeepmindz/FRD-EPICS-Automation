# Business Requirements Document
## Discovery & Solutioning Track for BA Tool

| Field | Value |
|---|---|
| Project | FRD-EPICS-Automation — Discovery & Solutioning Track extension |
| Version | 0.1 (Draft) |
| Date | 2026-04-30 |
| Prepared by | Solution Architect (dogfood: produced by running our own pipeline manually) |
| Source inputs | Stakeholder voice/text input across multiple sessions; reference materials from Shivam Jewels CRM project (5 skill files, 14 lo-fi wireframes + AN client-v5 PDF + BRD); 7 lo-fi wireframes for this project (00-main-pipeline + 01–06 stage details); 8 locked decisions captured in conversation |
| Audience | internal-tool (Deepmindz BA / presales / engineering team) |
| Status | For review |

---

## 1. Background

The existing FRD-EPICS-Automation BA Tool implements an 8-step linear flow that takes uploaded screen images and progressively generates artefacts: Screen Upload → Screen Analysis → FRD → EPICs → User Stories → Sub Tasks → LLD → FTC. This is well-suited to module-level engineering work where the visual artefacts (screens) are the primary input.

A separate gap exists upstream of this flow. When a client provides requirements as audio (voice notes, recorded meetings, dictated requirements), the BA / presales team currently transcribes manually, drafts a BRD by hand, writes an Approach Note, and produces wireframes — none of which are integrated with the existing tool. The result is artefact drift between the discovery phase and the engineering phase, and no traceability from the original requirement audio to the generated EPIC.

The Discovery & Solutioning Track (this initiative) closes that gap by adding 5 new pipeline stages — Audio → Well-formed Text → BRD → Approach Note → Lo-fi Wireframes → Hi-fi Mockups — at the project level, where outputs feed into the existing 8-step module flow as additional context for EPIC generation. The 5 skill files defining this pipeline already exist as documentation; this initiative builds the UI and services that let end users actually run them.

### 1.1 Reuse Audit (brownfield)

Per skill 02 §4.1, this is an `internal-tool` BRD extending an existing system. Engineering needs an explicit audit of what existing primitives the new functionality reuses, extends, or leaves alone — so that the blast radius is measurable and "preserve existing flow" stops being a vague constraint.

**Quantitative target: ≥ 70% reuse share** (counted by file + LOC against fully-new equivalents). Cross-references §8 NFRs and §9 Success Metrics.

| Bucket | What | Examples |
|---|---|---|
| **UNCHANGED** | Existing files explicitly preserved; no behavior change | 8-step SkillStepper module flow · FRD / EPIC / User Stories / Sub Tasks / LLD / FTC services · Module creation flow · Existing screen upload + analysis flow · `ai-service/main.py` (5 STT providers + Anthropic integration) · `ai.service.ts` NestJS proxy |
| **REUSED** | Existing primitives consumed by new functionality without modification | `/api/ai/transcribe` endpoint · `MicButton` component · `MarkdownRenderer` · `AiEditableSection` · `disk-storage` abstraction · Prisma + PostgreSQL layer · existing audit log · existing project model |
| **EXTENDED** | Existing files with small additive changes; existing behavior preserved | `ba-narrative.service.ts` (+ optional `approachNoteVersionId` param) · `ArtifactViewer.tsx` (sandboxed iframe support) · `EpicArtifactView.tsx` (Discovery context footer) · `BaModule` Prisma table (+`approachNoteVersionId` FK) · `EpicArtifact` Prisma table (+`contextSourcesJson`) · Module page template (Discovery Context banner) |
| **NEW** | Files / tables / routes / components that don't exist; will be created | 9 Prisma tables (AudioFile, WFT, BRD, ApproachNote, ApproachNoteVersion, WireframeSet, WireframeScreen, HifiSet, HifiScreen) · ~12 backend services under `backend/src/ba-tool/discovery/` · ~25 frontend components under `components/ba-tool/discovery/` · 8 Next.js App Router routes · Bundled Shivam Jewels reference template · Audio retention purge job |

**Implications for engineering**:

- The PR review gate by the BA Tool maintainer is scoped: only EXTENDED + NEW items need review.
- "Preserve existing flow" (§11 Constraints) becomes a verifiable checklist — every UNCHANGED entry is a regression-test target.
- §12 Risk register specifically tracks "regression on UNCHANGED items" as a mitigated risk (high-impact, mitigated by CI gates + maintainer review).

> Detailed file-by-file taxonomy for backend / frontend folders is in companion Approach Note §3.12.1 + §3.12.5 (each path tagged NEW / EXTENDED / REUSED / UNCHANGED per skill 03 §3.12.0).

## 2. Problem Statement

- Audio-to-deliverable pipeline today is manual: transcription, BRD authoring, Approach Note authoring, and wireframe production are separate tools / manual processes.
- No structured artefact lineage from raw client audio to finished EPIC — engineers can't trace why a particular EPIC was generated.
- The 5 skill files defining the audio-to-hi-fi pipeline exist as documentation but have no UI in any tool, so end users can't run them at scale.
- New BA / presales hires have no in-tool reference for what a polished BRD / Approach Note / wireframe set should look like.
- The existing BA Tool's EPIC generation cannot incorporate any context other than analysed screens, missing the rich requirement context captured upstream.

## 3. Business Objectives

1. Reduce time-to-deliverable from raw client audio to client-shareable Approach Note + wireframe bundle from ~5 days (manual baseline) to ~1 working day (assisted).
2. Achieve end-to-end traceability: every UI element on a wireframe maps back to an FR in the BRD, and every FR maps back to a section of the audio transcript.
3. Standardise the deliverable shape for BRDs / Approach Notes / wireframes across all client engagements, using bundled default templates as visual references.
4. Preserve existing BA Tool flow integrity — zero regression in existing module / FRD / EPIC / User Stories / Sub Tasks / LLD / FTC functionality.
5. Improve EPIC generation quality by allowing modules to optionally inherit Approach Note context from the parent project.

## 4. Scope

### In Scope (Phase 1 — MVP)

- Audio upload (drag-drop + browser MediaRecorder); reuse existing `/api/ai/transcribe` endpoint and 5 STT providers (Whisper default).
- Well-formed Text generation: 7-section structured markdown produced by AI cleanup of raw transcript.
- BRD generation: 15-section markdown per skill 02 template; overwrite-on-regenerate (no versioning in P1).
- Approach Note generation: append-only versioned (v1, v2, ...) per skill 03 template; "Changes since v(N-1)" log captured on each new version; client-edition export strips changelog.
- Lo-fi wireframes: per-screen MD + HTML using the 13-pattern catalogue from skill 04; traceability matrix auto-derived; coverage validation.
- Hi-fi mockups: HTML + CSS rendering; sandboxed iframe preview; callout-number parity check vs lo-fi (1:1 invariant per skill 05 §7).
- Project-level Discovery scope: one BRD / one AN versioned timeline per project, fanning out to multiple modules.
- EPIC integration: existing EPIC generator extended to optionally accept Approach Note version as additional context (P1 = AN-only).
- Default reference templates: Shivam Jewels CRM example artefacts bundled as static files and accessible from each stage's "Reference template" panel.
- Branding inputs: end user supplies brand tokens (colors, logo, product name) in AN §3.10 either by (a) uploading a reference page (AI extracts palette via Vision) or (b) picking manually; tokens cascade to lo-fi and hi-fi.
- Audio retention: 90 days default per project setting; auto-purge after WFT generated.

### Out of Scope (Phase 1 — deferred to Phase 2)

- BRD append-only versioning (P2).
- EPIC multi-source context picker (BRD + AN + Lo-fi + Hi-fi + FRD + PRD selection) — P1 is AN-only.
- PRD reference-documents panel showing hyperlinks to source AN / hi-fi / etc. (P2).
- Containerized (Docker) deployment — P1 runs natively; P2 introduces Dockerfiles + ECS Fargate.
- Multi-tenancy activation — P1 is single-tenant (default tenant); P2 flips the tenant flag (schema is multi-tenant ready from day 1).
- Per-project STT provider override UI — P1 ships with all 5 STT providers configured but Whisper as default; P2 adds project-level override.
- Per-tenant theme overrides; dark/light variants; mobile/tablet hi-fi adaptations; Figma token export.

## 5. Stakeholders

| Role | Stakeholder |
|---|---|
| Business sponsor | Saurabh Verma |
| Product owner | Saurabh Verma (current — TBD if dedicated PO is assigned) |
| Primary users | Internal BA / presales / solution architect team (Deepmindz) |
| Secondary users | Module engineers (consume Discovery context downstream when generating EPICs) |
| Delivery | Solution Architect + engineering team (TBD assignment) |
| Existing system owner | BA Tool maintainer — gates any change touching existing services |
| Reviewer | TBD architecture review board |

## 6. Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | System shall accept audio file upload (.opus / .m4a / .wav / .mp3 / .flac / .aac / .webm; max 25 MB per file) via drag-drop and via browser MediaRecorder. |
| FR-2 | System shall transcribe uploaded audio using the existing `/api/ai/transcribe` endpoint with the existing 5 STT providers (Whisper default). |
| FR-3 | System shall generate a Well-formed Text artefact with 7 sections: Raw transcript, Cleaned transcript, Paraphrased meaning, Key concepts, Action items, Open questions, Metadata. |
| FR-4 | System shall generate a 15-section BRD from a WFT artefact, with each Functional Requirement testable, atomic, and traceable to a §1–§3 motivation. |
| FR-5 | System shall generate a versioned Approach Note from a BRD; subsequent versions are append-only and each captures a "Changes since v(N-1)" log. |
| FR-6 | System shall accept brand tokens (primary / surface / CTA colours, logo asset, product name) via two input modes: reference-page upload (AI-extracted palette) or manual color picking. |
| FR-7 | System shall generate a lo-fi wireframe set (per-screen `.md` + `.html`) using the 13-pattern catalogue, with auto-derived traceability matrix linking FRs × screens. |
| FR-8 | System shall validate wireframe set coverage: every FR has at least one ✓ in some screen column; every screen has at least one ✓ in some FR row. |
| FR-9 | System shall generate hi-fi mockups (`.html` + shared `.css`) from a lo-fi wireframe set, preserving callout numbers 1:1; new hi-fi-only annotations use letter suffixes (e.g. `3a`). |
| FR-10 | System shall render hi-fi mockups inside a sandboxed `<iframe>` (same-origin off) to safely display generated HTML. |
| FR-11 | System shall provide bundled default templates (Shivam Jewels CRM example artefacts) accessible from a "Reference template" panel on each stage. |
| FR-12 | EPIC generation shall optionally accept an Approach Note version as additional context, identified by `approachNoteVersionId` foreign key on the module. |
| FR-13 | System shall preserve the existing 8-step module flow (Screen Upload → FTC) unchanged; Discovery context is additive only. |
| FR-14 | System shall log every artefact creation, regeneration, and version bump with user, timestamp, source artefact IDs, and tenant ID. |
| FR-15 | System shall purge audio files 90 days after WFT generation by default; retention configurable per project in Project Settings. |

## 7. Data Requirements

| Data Domain | Fields (illustrative) |
|---|---|
| Audio upload | filename, size, mimetype, durationSec, projectId, uploadedById, uploadedAt, retentionUntil |
| WFT artefact | rawTranscript, cleanedText, paraphrased, concepts[], actionItems[], openQuestions[], metadata, audioFileIds[], projectId |
| BRD artefact | sections{1..15}, frTable[], openItems[], wftId, projectId, generatedAt |
| Approach Note (header) | id, projectId, brdId, currentVersionId |
| AN Version (append-only) | n, sections{1..11}, brandTokens (JSON), decisionsLocked[], openQuestions[], changesSince, supersedesId, generatedAt |
| Wireframe Set | anVersionId, brandTokensSnapshot, coverageStatus |
| Wireframe Screen | sequenceNum, slug, pattern, callouts[], annotations[], components[], mdContent, htmlContent |
| Hi-fi Set | wireframeSetId, brandTokensSnapshot, syntheticDataSeed, parityStatus |
| Hi-fi Screen | sequenceNum, slug, htmlContent, calloutsJson |
| Module link | moduleId, approachNoteVersionId (nullable) |
| EPIC artifact (extended) | (existing fields) + contextSourcesJson |

All new tables include: `tenantId` (defaulted to `default` in P1), `createdAt`, `updatedAt`, audit columns.

## 8. Non-Functional Requirements

| Area | Target |
|---|---|
| Audio transcription latency | < 30 s for 25 MB / 10 min audio (whichever is lower) |
| AI generation latency | < 30 s per stage for typical input (single section) |
| Concurrent transcriptions | ≥ 5 per ai-service instance |
| Reuse | ≥ 70% of new functionality reuses existing BA Tool primitives (storage layer, AI service, MicButton, ArtifactViewer, MarkdownRenderer, project model, Prisma) |
| Audit | 100% of artefact CRUD logged with userId / timestamp / source artefact IDs / tenant ID |
| Privacy | Audio purged at 90-day retention by default; configurable per project |
| Compatibility | Zero regression on existing 8-step module flow; existing routes / components / services unchanged unless explicitly listed in §6 as extended |
| Browser support | Same as existing BA Tool — modern Chrome, Edge, Firefox |
| Multi-tenancy schema | `tenantId` on all new tables from day 1; flag-flip in P2 to enforce |
| Sandboxing | Hi-fi iframe renders with `sandbox` attribute and no `allow-same-origin` |
| Storage | Generated artefact content stored via existing storage layer (`disk-storage` in P1, swappable in P2) |

## 9. Success Metrics

| Metric | Target |
|---|---|
| Pipeline run-through completion | A presales user can take an audio file from upload to hi-fi mockup bundle in ≤ 1 working day (vs ~5 days manual baseline) |
| Reuse share | ≥ 70% of moving parts (components, services, storage keys) reuse existing infrastructure |
| Coverage validation | 100% of generated lo-fi wireframe sets pass the 4 quality checks in skill 04 §8 (no orphan FRs, no orphan screens, etc.) |
| Hi-fi parity | 100% of generated hi-fi sets pass the callout-parity check vs their lo-fi parent |
| Existing flow regression | 0 regressions in existing module / FRD / EPIC / User Stories / Sub Tasks / LLD / FTC tests |
| EPIC quality lift | EPICs generated with AN context show measurable improvement vs screens-only baseline (qualitative review by ≥ 2 reviewers) |

## 10. Assumptions

1. The existing `/api/ai/transcribe` endpoint and 5 STT providers (Whisper / Deepgram / AssemblyAI / ElevenLabs / Cartesia) are stable and available for reuse without modification.
2. The existing Anthropic Claude integration (via `ai.service.ts` and `ai-service/main.py`) supports the additional generation calls required for WFT cleanup, BRD, AN, wireframe, and hi-fi generation.
3. End users (BA / presales) have access to project-level audio recordings for the engagements they handle, with appropriate consent.
4. Browser MediaRecorder API is available on user environments (already in use today via the existing `MicButton`).
5. The existing Prisma + PostgreSQL infrastructure can absorb the new tables without performance impact (volume estimate: ~10 active projects × ~5 AN versions × ~14 screens = small).
6. The bundled Shivam Jewels CRM example artefacts can be shipped statically (not fetched at runtime) and accessed by all users without licensing concerns.

## 11. Constraints

- Existing 8-step BA Tool module flow MUST remain unchanged — new functionality is strictly additive.
- New code must follow existing project conventions: NestJS / Prisma backend, Next.js App Router with feature folders frontend.
- New Discovery routes nest under `/ba-tool/project/[id]/discovery/...` to keep mental model aligned with existing routes.
- Generated HTML (hi-fi mockups) must be sandboxed; no inline script execution outside the sandbox.
- All AI calls must go through the existing `ai-service/main.py` to inherit existing observability and provider configuration.
- Phase 1 must run natively on a developer laptop without Docker; Dockerfile authoring is a Phase 2 deliverable.
- No real client PII in bundled templates — Shivam Jewels example uses synthetic data.
- Any change touching existing services (e.g. extending `ba-narrative.service.ts` for AN context) requires PR review by the BA Tool maintainer.

## 12. Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Append-only AN versioning bloats DB over time | Medium | Versions stored as JSON with optional gzip compression; soft-archival policy after 24 months; schema supports cold-storage tier in P2 |
| Generated HTML in hi-fi could carry XSS vector | High | Sandboxed iframe (decision #4); CSP headers; no `srcdoc` with same-origin; review prompt to forbid `<script>` |
| LLM rate limits on heavy generation runs | Medium | Reuse existing rate-limit handling in `ai.service.ts`; fall back to Batch API for non-interactive jobs |
| Existing module flow regression | High | Stage 6 wireframe explicitly lists "what is unchanged"; CI must include existing module/FRD/EPIC/US/ST/LLD/FTC tests; PR review gate by BA Tool maintainer |
| Audio file format edge cases (malformed .opus, etc.) | Low | Existing `/transcribe` endpoint already handles 5 formats with error pathways; surface errors per file in UI |
| End user confused about which stage is required vs optional | Medium | Advisory pipeline gating with clear "Continue" CTA + warning banners; bundled reference template gives a worked example |
| Branding extraction from reference page is unreliable | Medium | Always allow manual override of AI-extracted palette; show extracted vs current side by side before commit |
| Storage of generated content (per-screen .md + .html) grows unbounded | Low | Use existing `disk-storage` interface; P2 swaps to S3 + lifecycle rules |
| Dogfood gap: skills produce inconsistent BRDs across runs | Medium | This very document is the first dogfood — gaps surface during writing; iterate skill prompts before scale rollout |
| Module link to a stale AN version (AN evolves but module is frozen) | Low | UI banner: "AN has new versions (v4, v5). Update link?"; explicit user action required to relink |

## 13. High-Level Solution Architecture (indicative)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Existing BA Tool (UNCHANGED)                                                │
│                                                                             │
│  Project ──┬── Module ──► SkillStepper (8 steps) ──► FTC                    │
│            │                ▲                                               │
│            │                │ optional AN context                           │
│            │                │                                               │
│            └── NEW: Discovery Track (project-scoped, parallel)              │
│                  │                                                          │
│                  │  Stage 1: Audio   ──► /api/ai/transcribe (REUSE)         │
│                  │     ▼                                                    │
│                  │  Stage 2: WFT    ──► AI cleanup → 7-section markdown     │
│                  │     ▼                                                    │
│                  │  Stage 3: BRD    ──► 15-section markdown (overwrite P1)  │
│                  │     ▼                                                    │
│                  │  Stage 4: AN     ──► append-only versioning v1…vN        │
│                  │     │       └── §3.10 brand tokens cascade ↓             │
│                  │     ▼                                                    │
│                  │  Stage 5: Lo-fi  ──► per-screen .md + .html + matrix     │
│                  │     ▼                                                    │
│                  │  Stage 6: Hi-fi  ──► sandboxed iframe + parity check     │
│                  │     │                                                    │
│                  └─────┴──► EPIC service extended (P1: AN-only context)     │
│                                                                             │
│  Shared infrastructure (REUSE):                                             │
│    • ai-service/main.py — FastAPI + 5 STT + Anthropic Claude                │
│    • ai.service.ts — NestJS proxy                                           │
│    • Prisma + PostgreSQL                                                    │
│    • disk-storage (P1) → S3 (P2)                                            │
│    • MicButton, ArtifactViewer, MarkdownRenderer, AiEditableSection         │
│    • SkillStepper (UNCHANGED)                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 14. Next Steps

| # | Action | Owner | Target |
|---|---|---|---|
| 1 | Sign off on this BRD (v0.1) | Saurabh Verma | Day 0 |
| 2 | Sign off on Approach Note v1 (companion to this BRD) | Saurabh Verma | Day 0–1 |
| 3 | Create Prisma migrations for 7 new tables + 2 column additions | Engineering | Week 1 |
| 4 | Implement Stage 1 (Audio → WFT) backend service + UI | Engineering | Week 1–2 |
| 5 | Implement Stage 2–3 (WFT → BRD) backend + UI | Engineering | Week 2–3 |
| 6 | Implement Stage 4 (BRD → AN versioned) backend + UI | Engineering | Week 3–4 |
| 7 | Implement Stage 5 (AN → lo-fi) backend + UI | Engineering | Week 4–5 |
| 8 | Implement Stage 6 (lo-fi → hi-fi) backend + UI | Engineering | Week 5–6 |
| 9 | Extend EPIC service for AN context + Discovery Context banner on module page | Engineering | Week 6 |
| 10 | Bundle Shivam Jewels reference templates as static assets | Engineering | Week 6 |
| 11 | E2E test: audio → hi-fi via the dogfood scenario | QA | Week 7 |
| 12 | Internal acceptance + sign-off | Saurabh Verma | Week 7 |

---

## 15. Open Items (to close before v1.0)

- Confirm dedicated Product Owner if different from sponsor.
- Confirm engineering team assignment + start date.
- Confirm whether the "Reference template" feature pre-loads the Shivam Jewels artefacts as a read-only "demo project" or as standalone bundled files; current default = standalone bundled files.
- Confirm tolerance for advisory-vs-strict pipeline gating once the pilot is run; current default = advisory.
- Confirm whether per-project audio retention override is exposed in UI in P1 or deferred to P2; current default = P1, in Project Settings.
- Confirm audit log access — does the existing BA Tool's audit viewer surface Discovery Track artefact events, or do we need a new viewer? Current default = reuse existing.
- Confirm whether brand-token extraction from reference page (Vision API) requires per-tenant API quota in P2.

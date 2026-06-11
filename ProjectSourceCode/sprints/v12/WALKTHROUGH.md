# Sprint v12 — Walkthrough: Wireframe Copilot (Track WC)

## Summary

Added a **Wireframe Copilot** — a conversational AI for wireframes (mirroring the HLD Copilot) — that lets a BA collect customer/internal feedback and act on it directly on the screens. Feedback arrives two ways: **typed/pasted in chat** (scoped to chosen screens) or **uploaded as a review document** (PDF/DOCX/MD/TXT) that the AI **parses screen-by-screen and auto-routes**. Each actionable item becomes a row in a **Change Register** with status, requestor, source (customer/internal), an optional requested-on date, and a full audit trail. The AI then **applies** each change to the target screen's HTML — on-brand (Design-System-grounded), callout-preserving, and **non-destructive** (written to an `edited` variant) — with a **before/after** review and one-click **Accept/Revert**, live status over SSE, and CSV/MD export. Strictly additive; no existing model, endpoint, or flow was modified.

Delivered wireframe-first: static HTML mockups were approved (WC-00) before any code, then **PR 1 (backend) → PR 2 (frontend) → PR 3 (references + verification)**.

## Architecture Overview

```
┌──────────────────────────── Browser (Next.js) ─────────────────────────────┐
│  /ba-tool/project/[id]/wireframes                                           │
│    ├─ Gallery (module-grouped, existing)                                    │
│    ├─ [💬 Copilot] ─▶ WireframeCopilot drawer                                │
│    │       • "Feedback for" screen picker (scope)                           │
│    │       • Upload feedback doc / paste → staging table                    │
│    │       • chat → proposed changes (confirm: requestor/source/date)       │
│    │       • Design-System chip · reference screens (≤2) · ref notes        │
│    └─ WireframeChangeRegister panel                                         │
│            • status badges · filters · Run/RunAll/Accept/Revert/Reopen      │
│            • before/after diff modal · live SSE · CSV/MD export             │
└───────────────┬──────────────────────────────────────────┬────────────────┘
                │ /api/ba/projects/:id/wireframes/...        │ EventSource (SSE)
                ▼                                            ▼
┌──────────────────────────── Backend (NestJS) ──────────────────────────────┐
│  WireframeCopilotController                                                 │
│    ├─ WireframeCopilotService   chat → proposed · feedback ingest → staging │
│    ├─ WireframeChangeService    register CRUD · apply · accept/revert ·     │
│    │                            run-all · comment/reopen · export · diff    │
│    ├─ WireframeEditService      AI edit → meta.editedHtml (non-destructive) │
│    ├─ WireframeContextService   latest lo-fi/hi-fi screens · tokens · refs  │
│    └─ WireframeChangeEventsService  per-project SSE (status/activity)       │
│         │ reuse: DesignSystemService · TextExtractionService · ProjectFolder │
└─────────┬───────────────────────────────────────────────────────────────────┘
          │ axios (AiService)
          ▼
┌──────────────────────── ai-service (FastAPI, Claude) ───────────────────────┐
│  /wireframe-chat (+ -stream)   grounded UX/UI chat                          │
│  /wireframe-extract-changes    chat turn → atomic change list (JSON)        │
│  /wireframe-edit-screen        screen HTML + NL change → edited HTML (raw)   │
│  /wireframe-parse-feedback     review doc → general/design-system/per-screen │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │ Prisma
                                      ▼
        Postgres (new_prd_generator): ba_wireframe_copilot_threads/messages,
        ba_wireframe_feedback_imports, ba_wireframe_changes, ba_wireframe_change_activities
```

## Files Created/Modified

### backend/prisma/schema.prisma · migrations/wireframe_copilot.sql
**Purpose**: Additive data model for the copilot — chat, feedback provenance, change register + trail.
**Models**: `BaWireframeCopilotThread` (one per project) · `BaWireframeCopilotMessage` (role, content, `targetScope`, attachments) · `BaWireframeFeedbackImport` (fileName, source, **uploadedBy/uploadedAt**, rawText, parsedCount) · `BaWireframeChange` (changeCode `WFC-001`, description, targetKind, targetScreens[], scopeAll, changeKind, calloutRef, **requestedBy/source/requestedOn**, status, before/afterRef, importId) · `BaWireframeChangeActivity` (immutable trail). Enums: `BaWireframeChangeStatus` (PENDING→IN_PROGRESS→IMPLEMENTED + FAILED/NEEDS_REVIEW/REVERTED/DEFERRED), `BaWireframeChangeSource`, `BaWireframeChangeActivityType`.
**How it works**: `projectId` is a soft scalar ref (matching `BaUpstreamSync`); intra-model FKs (messages→threads, activities→changes) cascade. Hand-written SQL applied as `prd_user` via `prisma db execute` (project convention), then `prisma generate`.

### ai-service/prompts/wireframe_chat_prompts.py · main.py
**Purpose**: Prompts + 5 FastAPI endpoints for the copilot (Claude default, provider-routed).
**Key endpoints**:
- `/wireframe-chat` (+ `/wireframe-chat-stream`) — grounded UX/UI chat; uses `_complete_text`.
- `/wireframe-extract-changes` — classifies a turn into atomic items (`SCREEN`/`ALL`/`DESIGN_SYSTEM`/`QUESTION`, `phase`, `priority`, `calloutRef`, `actionable`).
- `/wireframe-edit-screen` — returns **raw HTML** (a full HTML doc inside JSON proved fragile to truncation/escaping); fence-stripped; parity recomputed server-side.
- `/wireframe-parse-feedback` — segments a document into `general[]` / `designSystem[]` / per-screen `screens[]` (matched to slug) / `unmatched[]`, preserving callout refs and later-phase markers.

**How it works**: All grounded in Design-System tokens (and ≤2 reference screens). JSON endpoints route via a shared `_wf_complete_json` (OpenAI `response_format=json_object` or Claude + `_parse_ai_json`); the edit endpoint uses plain text + `_strip_html_fences`.

### backend/src/ai/ai.service.ts
**Purpose**: Typed HTTP client to the 5 ai-service endpoints (`wireframeChat`, `wireframeExtractChanges`, `wireframeEditScreen`, `wireframeParseFeedback`) via a shared `postAi()` with the standard axios→`HttpException` mapping.

### backend/src/ba-tool/pipeline/wireframe-context.service.ts
**Purpose**: Read-only helpers. `screensFor(projectId, kind)` returns the latest lo-fi/hi-fi screens with the **active variant's HTML**; `tokens()` resolves Design-System tokens; `referenceScreens()` returns ≤2 exemplars.

### backend/src/ba-tool/pipeline/wireframe-edit.service.ts
**Purpose**: The AI edit engine (WC-06).
**How it works**: Fetches the screen's active HTML + tokens + ≤2 reference screens, calls `/wireframe-edit-screen`, and writes the result **non-destructively** to `meta.editedHtml` (keeping `meta.editBaseHtml` for revert) — the live `htmlContent` is untouched. `calloutsPreserved()` checks every base callout number still appears (parity guard); failure → `NEEDS_REVIEW`. `accept()` promotes `editedHtml` to live HTML (and re-writes the navigator); `revert()` drops it. Non-HTML (image/PDF) screens are rejected with a clear message (WC-19).

### backend/src/ba-tool/pipeline/wireframe-change.service.ts
**Purpose**: The change register (WC-07/16/17 + diff).
**Key methods**: `createChanges()` (assigns `WFC-NNN`, maps `phase:LATER → DEFERRED`, logs SUBMITTED+EXTRACTED) · `apply()` (IN_PROGRESS → per-screen edit → IMPLEMENTED/NEEDS_REVIEW/FAILED; DESIGN_SYSTEM/QUESTION short-circuit to NEEDS_REVIEW) · `runAll()` (stop-on-failure) · `accept()/revert()` · `addComment()/reopen()` · `diff()` (before/after per edited screen) · `exportRegister()` (CSV+MD to `04-Wireframes-HiFi/` + CHANGELOG) · `flagReapplyAfterRegen()` (WC-17).

### backend/src/ba-tool/pipeline/wireframe-change-events.service.ts
**Purpose**: Per-project `ReplaySubject` SSE stream emitting `wfChangeStatus`/`wfChangeActivity` (WC-08), consumed by the register panel's `EventSource`.

### backend/src/ba-tool/pipeline/wireframe-copilot.service.ts
**Purpose**: Chat (WC-05) + feedback ingestion (WC-21).
**How it works**: `chat()` upserts the project thread, persists both turns (with `targetScope`), assembles grounding (in-scope screens + tokens + ≤2 reference screens + optional reference notes), calls `/wireframe-chat`, then `/wireframe-extract-changes` → returns proposed items (not yet persisted). `ingestFeedback()` extracts text (`TextExtractionService` for uploads), calls `/wireframe-parse-feedback`, fuzzy-resolves `screenRef → slug`, records a `BaWireframeFeedbackImport` (uploadedBy/uploadedAt), and returns a staging payload.

### backend/src/ba-tool/pipeline/wireframe-copilot.controller.ts
**Purpose**: REST surface under `ba/projects/:id/wireframes/...` (WC-09): `copilot/chat`, `copilot/feedback` (multipart), `changes` CRUD, `:cid/apply|accept|revert|comment|reopen|diff`, `run-all`, `export`, and the `changes/stream` SSE.

### backend/src/ba-tool/pipeline/pipeline-wireframe.service.ts · pipeline.module.ts
**Purpose**: Module wiring + the WC-17 hook (after lo-fi/hi-fi regen, flag implemented changes `NEEDS_REVIEW`).

### frontend/lib/pipeline-api.ts
**Purpose**: WC client — chat, ingest feedback, list/get/diff/create/apply/run-all/accept/revert/reopen/comment, SSE + export URLs, with full types.

### frontend/components/ba-tool/WireframeCopilot.tsx
**Purpose**: The drawer. Prominent always-open **"Feedback for"** screen picker (scope, with Check/Uncheck-all), orange **Upload feedback document**, paste→**Parse**, Design-System chip + Edit link, reference-screen picker (≤2), optional reference notes; chat → **proposed-changes confirmation** (editable + requestor/source/optional date) → add to register; feedback → **screen-routed staging table** → add.

### frontend/components/ba-tool/WireframeChangeRegister.tsx
**Purpose**: The register panel — status badges, status/source filters, Run · Run-all · Accept · Revert · Reopen · Comment, **before/after iframe diff modal**, **live SSE** status flips, CSV/MD export.

### frontend/app/ba-tool/project/[id]/wireframes/page.tsx
**Purpose**: Mounts the **💬 Copilot** header button + drawer and renders the Change Register below the gallery; passes the gallery selection as initial scope.

## Data Flow

1. **Chat**: user picks "Feedback for" screen(s) → types → `POST copilot/chat` → backend grounds on those screens + tokens → `/wireframe-chat` → reply + `/wireframe-extract-changes` → **proposed items** shown for confirmation.
2. **Document**: user uploads/pastes → `POST copilot/feedback` → `TextExtractionService` → `/wireframe-parse-feedback` → screen-routed **staging table** (general / design-system / per-screen / unmatched) → user reviews → **Add to register**.
3. **Register**: confirmed items → `POST changes` (PENDING/DEFERRED + WFC codes + trail).
4. **Apply**: `POST changes/:id/apply` → IN_PROGRESS (SSE) → per-screen `/wireframe-edit-screen` → `meta.editedHtml` → IMPLEMENTED/NEEDS_REVIEW/FAILED (SSE).
5. **Review**: `GET changes/:id/diff` → before/after iframes → **Accept** (promote to live HTML) or **Revert** (drop edit).
6. **Trail/Export**: every transition → `BaWireframeChangeActivity` + CHANGELOG; `GET changes/export` → CSV+MD.

## Test Coverage
- **Unit**: `wireframe-change.service.spec.ts` (2 tests) — sequential WFC codes, `phase:LATER→DEFERRED`, source/requestor/date capture, SUBMITTED+EXTRACTED trail. Plus the existing `pipeline-wireframe.upload.spec.ts` (hi-fi append) updated for the new constructor arg. **36 pipeline tests pass.**
- **Integration/E2E (manual)**: verified end-to-end on TestDemoProject — chat classified SCREEN/DESIGN_SYSTEM(cyan)/QUESTION correctly; create→apply→IMPLEMENTED (non-destructive `meta.editedHtml`)→revert→export; smoke data then cleaned. ai-service endpoints smoke-tested + OpenAPI-registered.
- **Playwright E2E journey**: deferred (see below).

## Security Measures
- **Non-destructive edits** — original `htmlContent` never overwritten until Accept; Revert restores instantly.
- **Callout-parity guard** — edits that drop/renumber base callouts are flagged `NEEDS_REVIEW`, not silently applied.
- **HTML-only edit guard** — image/PDF screens are tracked, not AI-edited.
- **Additive isolation** — new models/endpoints only; `projectId` FK cascade; `tsc` + 36 tests + regression confirm existing wireframe/HLD flows untouched.
- Feedback document extraction reuses the hardened `TextExtractionService`.

## Known Limitations
- **WC-14 (screenshot-to-chat)** deferred — needs vision wiring; document upload covers the main "upload" path.
- **WC-15 references** shipped as a lean **reference-notes** field injected into chat; the full **References tab** (URL fetch with SSRF guard + document ingestion + RAG, à la v11 Track RR) is deferred.
- **Chat is non-streaming** in the UI — the `/wireframe-chat-stream` endpoint exists but the token-stream proxy isn't wired.
- **DESIGN_SYSTEM changes** are flagged for manual token update (the editor link) rather than auto-editing tokens + recoloring every screen.
- **Global (`scopeAll`) changes** fan out by editing each screen sequentially; large sets are slow (bounded only by run-all).
- No **Playwright** journey yet (the register/diff/SSE flows are covered by manual e2e + unit tests).

## What's Next (v13 candidates)
1. Full **References tab** (URL/document ingestion + RAG) and **screenshot/region attach** with vision.
2. **Streaming** chat (wire the SSE proxy) for responsiveness.
3. **Design-System auto-apply**: update the token + queue per-screen recolors from one DESIGN_SYSTEM change.
4. **Playwright E2E**: chat→propose→add→apply→before/after→accept; feedback-doc→staging→add.
5. Roll wireframe changes up into the global **`BaChangeRequest`** register (Track M) for cross-stage traceability.

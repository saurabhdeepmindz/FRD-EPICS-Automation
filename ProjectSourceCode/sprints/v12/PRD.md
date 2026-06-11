# Sprint v12 — PRD: Wireframe Copilot — conversational AI + change register — Track WC

## Status: 🟡 PLANNED (2026-06-11) — tasks defined; awaiting user approval; implementation not started.

## Overview

Adds a **Wireframe Copilot** — a conversational AI for wireframes, mirroring the existing **HLD Copilot** — so a BA can collect and act on feedback (from the **customer** or **internally**) directly on the wireframes.

The Copilot is scoped to **all wireframes** (top-level) **or a selected subset** (the gallery already has per-card checkboxes). The user describes desired changes in chat; each turn is **distilled into a structured list of atomic changes** — a **Change Register** — where every change carries a **status** (`PENDING → IN_PROGRESS → IMPLEMENTED`, plus `FAILED / NEEDS_REVIEW / REVERTED / DEFERRED`), the **requestor name**, an **optional "requested-on" date**, the **source** (customer/internal), and a full **audit trail**. The AI then **applies** each change to the target wireframe screen(s) and **flips status incrementally** (live, over SSE). Edits are written as a **non-destructive variant** so the original is never lost and any change can be **Accepted** or **Reverted** after a **before/after** review.

This reuses ~80% of existing machinery: the HLD Copilot stack (`BaHldThread`/`BaHldMessage`, `/hld-chat[-stream]`, drawer/tabs, MicButton voice, references/RAG), the wireframe AI-generation path (`hifi.service.generate`, `regenerateLoFiWithAI`, the `meta.aiHtml`/`activeVariant` variant system), the status-list + live-SSE pattern (`BaCodeTask` + `CodeTasksPanel` + `RunManager`), the draft→review gate (`BaUpstreamSync`/`UpstreamSyncPanel`), and the durable audit trail (`appendChangelog`, RTM). **Strictly additive — no existing model, endpoint, or flow is modified.**

## Decisions (user, 2026-06-11)

| # | Decision | Chosen |
|---|---|---|
| A | Conversation granularity | **Project-level thread** with a per-message **target scope** (`ALL` or selected screen slugs) — changes naturally span multiple screens |
| B | Apply model | **Auto-apply to a non-destructive `edited` variant**, then human **Accept / Revert** after a before/after review (fast + safe rollback) |
| C | Target fidelity | **Hi-fi primary** (what customers review); **option to target lo-fi** |
| D | Register storage | **Dedicated wireframe models** (`BaWireframeChange` + activity) for per-screen granularity; may later surface into the global `BaChangeRequest` (Track M) |
| E | Model/provider for HTML edits | **Claude** (consistent with hi-fi generation / `HIFI_PROVIDER`) |
| F | Requestor capture (new) | Capture **requestor name** + **source** (customer/internal) + **optional requested-on date** per change; system also stamps auto `createdAt` |
| G | Scope of features | **All extra features included** (before/after diff, accept/revert, source tagging, actionable-vs-discussion classification, screenshot attach, run-all + per-change, parity guard, export, re-apply on regeneration, threaded comments + reopen) |
| H | Design System access | Active **Design Tokens** (fonts/colors/radius/spacing/weights/logo) are **auto-injected** into the chat + edit context (always-on, no clicking). The Copilot shows a **read-only Design System chip/tab**; the existing header **"Design System" button links** to the `/design-system` editor for *changing* tokens. Plus optional **≤ 2 user-picked reference screens** as style exemplars. |
| I | Delivery gate | **Wireframe-first**: build static UI **mockups** of the Copilot drawer + Change Register, get **user approval**, and only **then** write product code. |
| J | Feedback ingestion | The top-level Copilot accepts **(a) a whole feedback document** (PDF/DOCX/MD/TXT, reusing `TextExtractionService`) **or (b) pasted text** (whole doc or one screen). The AI **segments + auto-routes**: *General/project-wide* → scope **ALL** (or **Design-System-level** when about brand color/typography/spacing); *per-screen blocks* → matched to the right screen (Module + "Screen NN — Name" → slug), preserving **callout refs "(n)"** and **"later phase"** markers; screens **not in the set** → an **Unmatched** bucket. |
| K | Review-before-apply staging | Parsed changes land in a **staging table** the user reviews/edits/re-routes (batch-set requestor + source = **Customer** + optional date; drop later-phase to **Deferred**; map **Unmatched**) **before** any row enters the register or is applied. **Design-System-level** changes offer **"Update token"** (cascades) and/or per-screen recolor; **Global** changes become one row that **fans out to per-screen results**. |
| L | Feedback import provenance | Each uploaded/pasted feedback batch is recorded as a **feedback import** capturing **who uploaded it** (`uploadedBy`) and the **upload date** (`uploadedAt`, auto/editable) + file name + source; every change links its import so the trail answers "who sent this feedback, when, from which document." |

## Goals

- A **Wireframe Copilot drawer** (clone of `HldCopilot`) on the wireframes page: chat with streaming, voice input (MicButton), provider selection, a **scope chip** ("All 41 screens" / "5 selected") driven by the existing gallery checkboxes, a **References** tab, and **screenshot/region attachment** so a customer can point at the exact spot.
- **Ground every edit in the active Design System** — fonts, colors, radius, spacing, weights, logo are **auto-injected** (no clicking) so edits stay on-brand; a **read-only Design System chip/tab** in the Copilot shows what the AI is using, and the existing header **"Design System" link** opens the editor for changing tokens.
- Optionally reference **up to 2 existing screens** (user-picked) as style exemplars (e.g. "match `screen-03`'s header/layout") to keep screens consistent.
- **Ingest bulk feedback** — upload a customer review **document** (PDF/DOCX/MD/TXT) or paste it; the AI **segments it screen-by-screen and auto-routes** each change to the right screen (carrying callout refs and "later-phase" flags), recognizes **project-wide** and **Design-System-level** items, and presents a **review-before-apply staging table** so a multi-page review becomes a clean per-screen register in one pass.
- A chat turn is **classified** (discussion vs actionable) and **distilled into atomic change items**; the user reviews/edits/discards proposed items before they enter the register (no questions pollute the list).
- A **Change Register** panel (clone of `CodeTasksPanel`): change items grouped by screen/module, **status badges**, per-change **Run** + **Run all** (stop-on-failure), **Accept/Revert**, **before/after** side-by-side diff (reuse the existing compare modal), and filters by **status** and **source**. Each item shows **requestor**, **source**, **requested-on date (optional)** + captured `createdAt`.
- The AI **applies** a change to the target screen(s)' HTML (new `/wireframe-edit-screen`), writing an **`edited` variant** (`meta.editedHtml`, `activeVariant: 'edited'`) and **preserving numbered callouts** (parity guard). Status flips **live via SSE** as each item completes.
- A **complete, durable audit trail**: every status transition + comment is persisted (`BaWireframeChangeActivity`), a **CHANGELOG** entry is appended, and the register is **exportable** to CSV/MD into the project artifact folder (RTM-style).
- **Re-apply on regeneration**: if wireframes are regenerated, implemented changes are flagged "needs re-apply" so the trail stays honest.
- **Honest status** — failed edits surface as `FAILED` with the error; nothing silently no-ops.

## Technical architecture (summary)

- **New models (additive):**
  - `BaWireframeCopilotThread` (projectId, scope metadata) + `BaWireframeCopilotMessage` (role, content, model, `targetScope` JSON, attachments) — mirrors `BaHldThread`/`BaHldMessage`.
  - `BaWireframeChange` — the register row: `description`, `targetKind` (LOFI|HIFI), `targetScreens String[]` (slugs), `sourceMessageId?`, **`requestedBy`**, **`source` (CUSTOMER|INTERNAL)**, **`requestedOn DateTime?` (optional)**, `priority`, `status`, `beforeHtml?`/`afterHtml?` (or variant refs), `rationale?`, `appliedByRunId?`, `appliedAt?`, `createdAt`, `updatedAt`.
  - `BaWireframeChangeActivity` — immutable trail: `changeId`, `type` (SUBMITTED|EXTRACTED|IN_PROGRESS|IMPLEMENTED|FAILED|ACCEPTED|REVERTED|COMMENT|REOPENED|NEEDS_REAPPLY), `actor`, `message?`, `metadata?`, `createdAt`.
  - Enums: `BaWireframeChangeStatus`, `BaWireframeChangeSource`.
- **Feedback ingestion + routing:** a `WireframeFeedbackService` accepts an uploaded document (via `TextExtractionService`) or pasted text and calls a new ai-service `/wireframe-parse-feedback` → structured `{ general[], designSystem[], screens: [{ moduleRef, screenRef, items: [{ description, calloutRef?, phase, kind }] }], unmatched[] }`. The backend resolves each `screenRef` → slug (fuzzy match against the current set), classifies *screen / all / design-system / later-phase*, and returns a **staging payload** (nothing persisted until the user confirms). Single-screen paste uses the same parser with one block.
- **Design System grounding:** `DesignSystemService.resolveTokens(projectId)` + `getActive` (logo) feed the chat context and the `/wireframe-edit-screen` prompt as the **full `DesignTokens`** (fonts/colors/radius/spacing/weights), not just `{primary,surface,cta}`. Up to **2** user-picked **reference screens'** HTML are added as style exemplars (token-capped). The Copilot shows a **read-only** Design System chip/tab; editing tokens stays in the existing `/design-system` page (header link). `DesignSystemService` is already a dependency of the wireframe service — no new wiring.
- **ai-service (Python):** `/wireframe-chat` + `/wireframe-chat-stream` (mirror `/hld-chat[-stream]`); `/wireframe-extract-changes` (turn a chat turn + scope into an atomic change list with actionable/discussion classification + per-item target screens); `/wireframe-edit-screen` (current screen HTML + NL change + **full design tokens** + **≤2 reference screens** + existing callouts → edited HTML, low temperature, callouts preserved). Provider-routed (Claude default).
- **backend (NestJS):**
  - `WireframeCopilotService` — thread upsert, persist both turns, assemble context (current screen HTML/callouts/module + design tokens + PRD/BRD + included references), call ai-service, extract changes.
  - `WireframeChangeService` — register CRUD; `applyChange` (calls `editWireframeScreenWithAI`, writes `edited` variant, parity guard, flips status, emits SSE); `runAll` (ordered, stop-on-failure); `accept`/`revert` (toggle `activeVariant`); `addComment`/`reopen`; `exportRegister` (CSV/MD + `appendChangelog`); `flagNeedsReapply` (hook on regeneration).
  - `editWireframeScreenWithAI(screenId, kind, change)` — sits alongside `hifi.service.updateScreen` / `pipeline-wireframe.service.regenerateLoFiWithAI`, reuses the callout-parity validator.
  - SSE stream for live change-status flips (reuse the `RunManager`/`@Sse` pattern; new `WireframeChange*` event types).
  - New controller routes under the wireframes namespace (chat, chat-stream, extract, register CRUD, apply, run-all, accept, revert, comment, reopen, export, references).
- **frontend (Next.js):**
  - `WireframeCopilot.tsx` (clone `HldCopilot`) mounted on the wireframes page, opened from a header button; scope chip wired to the gallery's existing `selected` Set; References tab; screenshot attach (reuse the E2E per-step screenshot upload pattern).
  - `WireframeChangeRegister.tsx` (clone `CodeTasksPanel`) below the gallery: grouped list, status badges, Run/Run-all/Accept/Revert, before/after compare (reuse the existing modal), source/status filters, requestor + optional date capture, live SSE.
  - `pipeline-api.ts` helpers + types.

## Out of scope (deferred)

- Pixel-diff/visual-regression of before/after (we show side-by-side, not computed pixel diff).
- Auto-applying changes without any human review (Accept/Revert gate stays).
- Editing uploaded **image/PDF** wireframes' pixels (HTML screens only; image screens get a tracked change + manual note).
- Cross-project change templates / library (future, mirrors HD-10).
- Vector RAG over wireframe references (v1 = summarize-and-inject, same as v11 RR; RAG upgrade later).

## Dependencies

- ✅ HLD Copilot stack (drawer/tabs, `/hld-chat[-stream]`, provider routing, MicButton, references) — clone/reuse.
- ✅ Wireframe generation + variant system (`hifi.service`, `regenerateLoFiWithAI`, `meta.aiHtml`/`activeVariant`, callout-parity validator).
- ✅ Status-list + live SSE (`BaCodeTask`, `RunManager`, `CodeTasksPanel` EventSource pattern).
- ✅ Draft→review gate (`BaUpstreamSync`/`UpstreamSyncPanel`).
- ✅ Audit trail (`ProjectFolderService.appendChangelog`, RTM helpers).
- ✅ Module-grouped gallery + checkboxes (sprint v12 prerequisite work already on this branch).
- ⚠️ Migrations applied as `prd_user` against `new_prd_generator` (collision-checked table names).

## Risks & mitigations

| Risk | Sev | Mitigation |
|---|---|---|
| AI edit corrupts a screen / loses content | High | Write to a **non-destructive `edited` variant**; original `htmlContent` untouched; one-click **Revert**; before/after review before Accept |
| Edit renumbers/drops callouts (breaks parity) | High | Reuse the **callout-parity validator**; reject/flag `NEEDS_REVIEW` on violation; hi-fi-only annotations use letter suffixes |
| Chat questions wrongly become "changes" | Med | **Actionable-vs-discussion classification**; proposed items require user confirm before entering the register |
| Breaking existing wireframe/HLD flows | High | **Strictly additive** models/endpoints; no edits to existing controllers/services beyond additive hooks; `tsc` + full smoke before merge |
| Token cost / latency of per-screen edits | Med | Per-change edits are small (single screen); run-all is bounded-concurrency with stop-on-failure; Claude with low temp |
| Stale register after regeneration | Med | `flagNeedsReapply` hook resets status + logs `NEEDS_REAPPLY` so trail stays honest |
| Long audit trail growth | Low | Activity rows are compact; export to CSV/MD offloads to artifact folder |

## Delivery approach (wireframe-first)

**Phase 0 (gate):** before any product code, produce static, clickable **HTML mockups** of the Copilot drawer + Change Register (incl. the Design System chip/tab, reference-screen picker, and the requestor/source/optional-date capture) under `sprints/v12/wireframes/`. **The user reviews and approves the mockups; no implementation begins until then.** Phase 0 mockups are throwaway design artifacts — not wired to any backend.

After approval, implementation proceeds: **PR 1** (backend foundation) → **PR 2** (frontend) → **PR 3** (references + full verify). Each PR is `tsc`-clean both apps, smoke-green, and **regression-checked** against existing wireframe/HLD features before merge.

## Success criteria

- From the wireframes page, open the Copilot, scope to **all** or **selected** screens, and chat.
- A turn produces a **conversational reply** + **proposed atomic changes**; confirmed items enter the **Change Register** as `PENDING` with requestor + optional date + source.
- **Run** (or **Run all**) applies edits; statuses flip **live**; each shows a **before/after** diff; **Accept** keeps, **Revert** restores the original.
- The full **trail** (who/what/when/status transitions/comments) is persisted and **exportable**; a CHANGELOG entry is written.
- `tsc` clean (backend + frontend); unit + smoke + Playwright green; **no regression** in existing wireframe/HLD features.

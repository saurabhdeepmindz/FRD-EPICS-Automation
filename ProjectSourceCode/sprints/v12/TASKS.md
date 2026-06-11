# Sprint v12 — Tasks: Wireframe Copilot — conversational AI + change register — Track WC

## Status: 🟡 PLANNED (2026-06-11) — tasks defined; **wireframe-first**: WC-00 mockups → user approval → implementation. No product code until mockups approved.

> **PRD:** `sprints/v12/PRD.md`. **Decisions:** (A) project-level thread + per-message scope · (B) auto-apply to non-destructive `edited` variant + Accept/Revert · (C) hi-fi primary, lo-fi optional · (D) dedicated wireframe models · (E) Claude for HTML edits · (F) capture requestor + source + **optional** requested-on date · (G) all extra features in.
>
> **Sequencing:** **WC-00 (UI mockups + APPROVAL GATE)** → WC-01 (models+migration) → WC-02 (ai chat) ∥ WC-03 (ai extract) ∥ WC-04 (ai edit-screen) → WC-05 (copilot service) → WC-06 (edit-screen service + parity) → WC-07 (change service: CRUD/apply/runAll/accept/revert) → WC-08 (SSE stream) → WC-09 (controller routes) → WC-10 (api helpers) → WC-11 (Copilot drawer) ∥ WC-12 (Change Register panel) → WC-13 (before/after diff) ∥ WC-14 (screenshot attach) ∥ WC-15 (references tab) → WC-16 (export + changelog) → WC-17 (re-apply hook) → WC-18 (comments/reopen) → WC-19 (security/validation) → WC-20 (tests + verify). **No code (WC-01+) starts until WC-00 is approved.**
>
> **Reuse:** HLD Copilot (`HldCopilot.tsx`, `hld-copilot.service.ts`, `/hld-chat[-stream]`, MicButton, references); wireframe variant system (`meta.aiHtml`/`activeVariant`, callout-parity validator in `hifi.service.ts`); `CodeTasksPanel` + `RunManager` SSE; `UpstreamSyncPanel` review gate; `appendChangelog`; the module-grouped gallery + checkbox `selected` Set.
>
> **Invariant:** every task is **strictly additive** — no existing model/endpoint/flow is modified except via additive hooks. `tsc` + smoke green before each next task.

---

### Track 0 — Design (wireframe-first gate)

- [ ] **WC-00 (Design): static UI mockups + APPROVAL GATE** (P0, M) — **blocks all of WC-01+**
  - Produce clickable, **static HTML mockups** (no backend) under `sprints/v12/wireframes/` covering: (a) the **Wireframe Copilot drawer** — chat, streaming bubble, voice mic, provider select, **scope chip** (All / N selected), **proposed-changes confirmation** with editable description + **requestor name + source (customer/internal) + optional requested-on date**, **References** tab, **read-only Design System chip/tab** (active fonts/colors/tokens), and **reference-screen picker (≤2)**; (b) the **Change Register** panel — grouped-by-screen/module list, status badges, columns (requestor · source · requested-on · created), Run / Run-all / Accept / Revert, status + source filters; (c) the **before/after** compare modal.
  - Mockups use the project's brand tokens for realism; throwaway artifacts (not wired). **User reviews + approves before any code (WC-01+) is written.**

### Track A — Data model + migration (backend)

- [ ] **WC-01 (DB): copilot + change-register models + migration** (P0, L)
  - `BaWireframeCopilotThread` (`id`, `projectId`, `scopeLabel?`, timestamps; `@@index([projectId])`).
  - `BaWireframeCopilotMessage` (`id`, `threadId`, `role` "user"|"assistant", `model?`, `content @db.Text`, `targetScope Json` `{ kind: "ALL"|"SELECTED", slugs: string[] }`, `attachments Json?`, `createdAt`; `@@index([threadId])`).
  - `BaWireframeChange` (`id`, `projectId`, `threadId?`, `sourceMessageId?`, `changeCode` e.g. `WFC-001`, `description @db.Text`, `targetKind` LOFI|HIFI, `targetScreens String[]`, **`requestedBy String?`**, **`source` CUSTOMER|INTERNAL `@default(INTERNAL)`**, **`requestedOn DateTime?`** (optional, user-supplied), `priority @default("MEDIUM")`, `status @default(PENDING)`, `beforeRef Json?`, `afterRef Json?`, `rationale @db.Text?`, `appliedByRunId?`, `appliedAt?`, `createdAt`, `updatedAt`; `@@unique([projectId, changeCode])`, `@@index([projectId, status])`).
  - `BaWireframeChangeActivity` (`id`, `changeId`, `type`, `actor`, `message @db.Text?`, `metadata Json?`, `createdAt`; `@@index([changeId, createdAt])`).
  - Enums: `BaWireframeChangeStatus` (PENDING|IN_PROGRESS|IMPLEMENTED|FAILED|NEEDS_REVIEW|REVERTED|DEFERRED), `BaWireframeChangeSource` (CUSTOMER|INTERNAL), `BaWireframeChangeActivityType` (SUBMITTED|EXTRACTED|IN_PROGRESS|IMPLEMENTED|FAILED|ACCEPTED|REVERTED|COMMENT|REOPENED|NEEDS_REAPPLY).
  - Hand-written SQL migration applied as `prd_user` (collision-checked table names: `ba_wireframe_copilot_threads`, `ba_wireframe_copilot_messages`, `ba_wireframe_changes`, `ba_wireframe_change_activities`); `prisma generate`.

### Track B — AI service (Python)

- [ ] **WC-02 (AI): `/wireframe-chat` + `/wireframe-chat-stream`** (P0, M)
  - Mirror `/hld-chat[-stream]`. System prompt = "senior UX/UI architect reviewing wireframes." User message grounds on: target screen(s) HTML/title/callouts/module, **full Design Tokens (fonts/colors/radius/spacing/weights) + logo**, PRD/BRD context, included references, optional **≤2 reference screens**, chat history. SSE delta stream + non-streaming fallback. Provider-routed (Claude default).

- [ ] **WC-03 (AI): `/wireframe-extract-changes`** (P0, M)
  - Input: the latest user turn + assistant reply + scope (all/selected slugs) + screen list. Output: `{ items: [{ description, targetScreens: string[], rationale, actionable: bool, priority }] }`. **Classifies** discussion vs actionable; only actionable items become register candidates. Deterministic JSON (schema-validated).

- [ ] **WC-04 (AI): `/wireframe-edit-screen`** (P0, L)
  - Input: `{ htmlContent, changeRequest, designTokens (full), referenceScreens?: [{slug, html}] (≤2), callouts, fidelity }`. Output: `{ editedHtml, rationale, calloutsPreserved: bool }`. System prompt: surgical, **on-brand** edit (use the design tokens; match any reference screens' patterns); **never renumber/drop numbered callouts** (new annotations use letter suffixes); return full HTML only. Low temperature. Backend enforces the ≤2 reference-screen cap before calling.

### Track C — Backend services + edit engine

- [ ] **WC-05 (BE): `WireframeCopilotService`** (P0, M)
  - Upsert project thread; persist user + assistant messages (with `targetScope`); assemble grounding context (resolve scope → screen HTML/callouts/module from latest lo-fi/hi-fi set; **`DesignSystemService.resolveTokens` + `getActive` logo**; PRD/BRD; included references budgeted; optional **≤2 user-picked reference screens'** HTML); call `/wireframe-chat[-stream]`; then call `/wireframe-extract-changes` and return proposed items (not yet persisted as register rows).

- [ ] **WC-06 (BE): `editWireframeScreenWithAI` + parity guard** (P0, L)
  - New method beside `hifi.service.updateScreen` / `pipeline-wireframe.regenerateLoFiWithAI`. Fetch screen (lo-fi or hi-fi) + **full design tokens (`resolveTokens`)** + lo-fi callouts + **≤2 resolved reference screens** (cap enforced here); call `/wireframe-edit-screen`; **validate callout parity** (reuse existing validator); on pass store **`meta.editedHtml` + `meta.activeVariant='edited'`** (non-destructive; keep `htmlContent` + any `aiHtml`); on parity violation → return `NEEDS_REVIEW` with details. Re-write navigator on apply.

- [ ] **WC-07 (BE): `WireframeChangeService` (register + apply)** (P0, L)
  - CRUD: `createChanges` (persist confirmed items as `PENDING`, assign `changeCode`, log `SUBMITTED`+`EXTRACTED`, capture `requestedBy`/`source`/`requestedOn`); `listChanges(projectId, {status?, source?})`; `getChange`.
  - `applyChange(changeId)` → snapshot `beforeRef`, set `IN_PROGRESS` (emit SSE), call `editWireframeScreenWithAI` per target screen, snapshot `afterRef`, set `IMPLEMENTED`/`FAILED`/`NEEDS_REVIEW`, log activity.
  - `runAll(projectId, {ids?})` → ordered, **stop-on-failure** option; per-item SSE flips.
  - `accept(changeId)` (keep `edited` variant; `ACCEPTED`) / `revert(changeId)` (set `activeVariant` back to prior; `REVERTED`).

- [ ] **WC-08 (BE): SSE stream for change status** (P0, M)
  - Reuse the `RunManager`/`@Sse` pattern: `GET .../wireframes/changes/stream` emits `wfChangeStatus` + `wfChangeActivity` events. Frontend `EventSource` flips badges live (mirror `CodeTasksPanel`).

- [ ] **WC-09 (BE): controller routes** (P0, M)
  - Under the wireframes namespace: `POST .../copilot/chat`, `POST .../copilot/chat-stream` (SSE), `POST .../copilot/extract`, `GET/POST .../changes`, `GET .../changes/:id`, `POST .../changes/:id/apply`, `POST .../changes/run-all`, `POST .../changes/:id/accept`, `POST .../changes/:id/revert`, `POST .../changes/:id/comment`, `POST .../changes/:id/reopen`, `GET .../changes/export`, `GET .../changes/stream` (SSE), plus references routes (WC-15).

### Track D — Frontend

- [ ] **WC-10 (FE): `pipeline-api` helpers + types** (P0, S)
  - `wireframeChat`, `wireframeChatStreamUrl`, `wireframeExtractChanges`, `listWireframeChanges`, `createWireframeChanges`, `applyWireframeChange`, `runAllWireframeChanges`, `acceptWireframeChange`, `revertWireframeChange`, `commentWireframeChange`, `reopenWireframeChange`, `wireframeChangeStreamUrl`, `exportWireframeChangesUrl` + types.

- [ ] **WC-11 (FE): `WireframeCopilot` drawer** (P0, L)
  - Clone `HldCopilot`: streaming chat, MicButton voice, provider select, Q&A accordion. **Scope chip** wired to the gallery's `selected` Set ("All N screens" / "M selected"). **Read-only Design System chip/tab** (active fonts/colors/tokens; "Edit" deep-links to the existing `/design-system` page). **Reference-screen picker** — choose **≤2** screens (reuse the gallery selection) as style exemplars. On a turn → show proposed change items with **checkboxes + editable description + requestor + source + optional date** → "Add to register" persists them. Mounted on the wireframes page via a header **"Copilot"** button.

- [ ] **WC-12 (FE): `WireframeChangeRegister` panel** (P0, L)
  - Clone `CodeTasksPanel`: list grouped by screen/module, **status badges**, columns for **requestor · source · requested-on (optional) · created**, per-change **Run** + **Run all** (stop-on-failure toggle), **Accept/Revert**, **filters** (status, source CUSTOMER/INTERNAL). Live SSE status flips. Empty/loaded/error states.

- [ ] **WC-13 (FE): before/after diff** (P0, M)
  - Reuse the existing deterministic-vs-AI side-by-side compare modal to show **original vs edited** HTML per change (iframes), with **Accept/Revert** in the modal header.

- [ ] **WC-14 (FE): screenshot / region attachment in chat** (P1, M)
  - Reuse the E2E per-step screenshot upload pattern: attach an annotated screenshot to a chat turn so the AI grounds the change; thumbnail + remove; stored in message `attachments`.

- [ ] **WC-15 (FE+BE): References tab** (P1, M)
  - Mirror v11 RR References (summarize-and-inject) scoped to wireframes: add URL / upload doc, include toggle, summary preview; injected into `/wireframe-chat` context. (Reuse `TextExtractionService` + SSRF-guarded fetch from RR.)

### Track E — Audit trail, export, lifecycle

- [ ] **WC-16 (BE+FE): export register + CHANGELOG** (P0, S)
  - `exportRegister` → CSV + MD into the project artifact folder (RTM-style); append a `CHANGELOG` entry on each apply/accept/revert via `appendChangelog`. FE "Export" button.

- [ ] **WC-17 (BE): re-apply-on-regeneration hook** (P1, S)
  - When lo-fi/hi-fi is regenerated, flag affected `IMPLEMENTED` changes → `NEEDS_REVIEW` + log `NEEDS_REAPPLY` (additive hook in the generation services; no behavior change to generation itself).

- [ ] **WC-18 (BE+FE): threaded comments + reopen** (P1, S)
  - `addComment` (logs `COMMENT`) and `reopen` (IMPLEMENTED/REVERTED → PENDING, logs `REOPENED`). FE: per-change comment thread + Reopen button.

### Track F — Security, validation, tests

- [ ] **WC-19 (Sec): validation + safety** (P0, S)
  - Validate scope slugs exist; reject edits on image/PDF screens with a clear note (tracked, not applied); SSRF reuse for references; size/timeout caps on edit calls; ensure non-destructive variant write never overwrites `htmlContent`.

- [ ] **WC-20 (Test): unit + smoke + Playwright + tsc** (P0, M)
  - Unit: extract-changes classification, edit parity guard, register status machine, accept/revert variant toggle, requestor/date capture. Smoke: chat → propose → add → run → IMPLEMENTED → before/after → accept; run-all stop-on-failure; revert restores original; export writes files + CHANGELOG. **Regression:** existing wireframe gallery, navigator, upload-append, HLD Copilot all still work. `tsc` clean both apps; no console errors.

---

## Task table

| # | Track | ID | Pri | Size | Summary |
|---|-------|----|----|------|---------|
| 0 | Design | WC-00 | P0 | M | **Static UI mockups + APPROVAL GATE** (Copilot drawer + Change Register + Design System chip + ref-screen picker) — blocks all code |
| 1 | Model | WC-01 | P0 | L | Copilot + change-register models + migration (incl. requestor/source/optional date) |
| 2 | AI | WC-02 | P0 | M | `/wireframe-chat` + `-stream` |
| 3 | AI | WC-03 | P0 | M | `/wireframe-extract-changes` (actionable vs discussion) |
| 4 | AI | WC-04 | P0 | L | `/wireframe-edit-screen` (parity-preserving, on-brand edit; full tokens + ≤2 ref screens) |
| 5 | BE | WC-05 | P0 | M | `WireframeCopilotService` (chat + extract + context) |
| 6 | BE | WC-06 | P0 | L | `editWireframeScreenWithAI` + parity guard + `edited` variant |
| 7 | BE | WC-07 | P0 | L | `WireframeChangeService` (CRUD/apply/runAll/accept/revert) |
| 8 | BE | WC-08 | P0 | M | SSE stream for live change status |
| 9 | BE | WC-09 | P0 | M | Controller routes |
| 10 | FE | WC-10 | P0 | S | `pipeline-api` helpers + types |
| 11 | FE | WC-11 | P0 | L | Wireframe Copilot drawer (chat/voice/scope chip/propose) + Design System chip + ref-screen picker |
| 12 | FE | WC-12 | P0 | L | Change Register panel (status/run/accept/revert/filters/requestor+date) |
| 13 | FE | WC-13 | P0 | M | Before/after diff (reuse compare modal) |
| 14 | FE | WC-14 | P1 | M | Screenshot/region attachment in chat |
| 15 | FE+BE | WC-15 | P1 | M | References tab (summarize-and-inject) |
| 16 | BE+FE | WC-16 | P0 | S | Export register (CSV/MD) + CHANGELOG |
| 17 | BE | WC-17 | P1 | S | Re-apply-on-regeneration flag |
| 18 | BE+FE | WC-18 | P1 | S | Threaded comments + reopen |
| 19 | Sec | WC-19 | P0 | S | Validation + safety (additive, non-destructive) |
| 20 | Test | WC-20 | P0 | M | unit + smoke + Playwright + tsc + regression |

---

## Backlog linkage

New **Track WC (Wireframe Copilot)**. Complements Track DD (Wireframe Navigator), the v12 module-tagging work (this branch), and the schema-only **Track M (`BaChangeRequest`)** — wireframe changes may later roll up into the global CR register. References reuse the v11 **Track RR** pattern (summarize-and-inject; RAG upgrade deferred). The per-screen AI edit (`/wireframe-edit-screen`) is the wireframe analog of the HLD Copilot's section synthesis.

## Delivery plan (PRs)

0. **Phase 0 — wireframe-first gate:** WC-00 static HTML mockups under `sprints/v12/wireframes/`. **User approval required before any code below.** No backend/frontend product code is written until this is signed off.
1. **PR 1 — backend foundation:** WC-01..09 + WC-16/17/19 (models, ai endpoints, services, controller, SSE, export, safety) with unit tests.
2. **PR 2 — frontend:** WC-10..14 + WC-18 (api, Copilot drawer, register panel, diff, screenshot, comments).
3. **PR 3 — references + full verify:** WC-15 + WC-20 (references tab, Playwright, regression sweep).

Each PR: `tsc` clean both apps, smoke green, **no regression** in existing wireframe/HLD features, then `code-reviewer` + `security-reviewer` before merge.

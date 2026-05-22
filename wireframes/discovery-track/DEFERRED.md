# Discovery & Solutioning Track — Deferred Items

> Living tracker for everything we built **around** but didn't fully implement
> across Stages 1–3. Each item has a reason, an effort estimate, and concrete
> implementation notes so it can be picked up in a future slice without
> re-reading the conversation history.
>
> **Phase tags:**
> - **P1-polish** — Phase 1 nice-to-have; should ship before any external rollout
> - **P2** — Phase 2 (production deployment) per the Approach Note §11 roadmap
> - **P3-future** — beyond the current roadmap; revisit when relevant
>
> **Effort scale:** S (≤ 2 days) · M (≤ 1 week) · L (≤ 2 weeks) · XL (> 2 weeks)
>
> **Last updated:** 2026-05-01 (Stage 4 core shipped, 3 Stage-4 polish items + 2 verification gates added)

---

## Table of Contents

- [Stage 1 — Audio → Well-formed Text](#stage-1--audio--well-formed-text)
- [Stage 2 — Well-formed Text → BRD](#stage-2--well-formed-text--brd)
- [Stage 3 — BRD → Approach Note (versioned)](#stage-3--brd--approach-note-versioned)
- [Stage 4 — Approach Note → Lo-fi Wireframes (not yet built)](#stage-4--approach-note--lo-fi-wireframes-not-yet-built)
- [Stage 5 — Lo-fi → Hi-fi Mockups (not yet built)](#stage-5--lo-fi--hi-fi-mockups-not-yet-built)
- [Stage 6 — EPIC Context Handoff (not yet built)](#stage-6--epic-context-handoff-not-yet-built)
- [Cross-cutting concerns](#cross-cutting-concerns)
- [Reference templates / dogfood scenarios](#reference-templates--dogfood-scenarios)

---

## Stage 1 — Audio → Well-formed Text

### [P1-polish] WFT preview / PDF / DOCX export — effort: S

**Why deferred:** The BRD got a preview/PDF/DOCX toolbar (skill 02 output is the primary stakeholder-shareable artefact), but WFT didn't. WFT is mostly an internal staging artefact, not a deliverable. End users may still want a printable copy.

**What's needed:**
- Mirror `BrdExportService` pattern with `WftExportService`
- New template `discovery/templates/wft-html.ts` — 7-section layout
- Add 3 routes to `discovery.controller.ts`: `wft/:wftId/preview`, `/export/pdf`, `/export/docx`
- Add toolbar to `WftViewer.tsx` (component already has the right shape; copy the `BrdExportToolbar` pattern from `BrdEditor.tsx`)

**Cross-references:** mirror of BRD export work; uses existing `PdfService.generatePdfFromHtml()`.

---

### [P1-polish] Audio retention purge job — effort: S

**Why deferred:** The schema has `retentionUntil` on every `BaAudioFile`, set to `now + 90d` at upload (configurable per project). The purge logic is implemented (`AudioService.purgeExpired()`) but **not invoked anywhere** — no scheduled job runs it.

**What's needed:**
- NestJS scheduled task using `@nestjs/schedule` (`@Cron('0 3 * * *')`) — runs daily at 03:00
- Calls `audioService.purgeExpired(new Date())`
- Log purge counts to existing audit pattern
- (Phase 2) Move to SQS-triggered worker for horizontal scaling

**Cross-references:** BRD-discovery-track.md §6 FR-15, AN-discovery-track-v1.md §3.

---

### [P1-polish] Per-project STT provider override UI — effort: S

**Why deferred:** Backend already supports 5 STT providers (Whisper / Deepgram / AssemblyAI / ElevenLabs / Cartesia) via env var on the Python ai-service. The UI doesn't expose a per-project override.

**What's needed:**
- Project setting `sttProvider?: string` on `BaProject` (Prisma column)
- Pass `provider` query param through `audioService.transcribe()` → `aiService.transcribe()` → Python `/transcribe`
- Settings panel UI on the Stage 1 page right rail

**Cross-references:** AN §8.1 (decision #1), AN §11.5 (Phase 2 voice stack).

---

### [P2] Audio storage migration disk → S3 — effort: S

**Why deferred:** Phase 1 stores base64 audio in Postgres `BaAudioFile.fileData` (matches existing `BaScreen.fileData` pattern). Phase 2 moves to S3.

**What's needed:**
- New `StorageProvider` adapter (`s3-storage.ts`) per AN §3.12.1 hexagonal pattern
- Env var swap: `STORAGE_PROVIDER=s3`
- Migrate existing rows: write a one-time script to copy base64 → S3, replace `fileData` with S3 URL
- Update `audio.service.ts:upload()` to use the abstraction

**Cross-references:** AN §3.12.4, AN §11.1.

---

## Stage 2 — Well-formed Text → BRD

### [P2] BRD append-only versioning — effort: M

**Why deferred:** Stakeholder decision #7 (locked): Phase 1 overwrites on regenerate; Phase 2 adds versioning **with parity to Approach Note** (per BRD §1.1, skill 02 §4.1). The AN versioning infrastructure is already built and can be mirrored.

**What's needed:**
- Add `BaBrdVersion` Prisma model (mirror `BaApproachNoteVersion` shape)
- Add `currentVersionId` pointer on `BaBrd` (or rename existing `BaBrd` to `BaBrdHeader`)
- Service: `brd.service.ts:createNewVersion(brdId, changesSince)` (mirror `approach-note.service.ts:createNewVersion`)
- Routes: `POST /brd/:id/versions`, `GET /brd/versions/:vid`, etc.
- UI: replace BRD editor's Phase-2 placeholder with the same version-timeline UX as `ApproachNoteEditor`

**Cross-references:** BRD §1.1 Reuse Audit, AN §11.12.

---

### [P1-polish] BRD inline FR-table editor — effort: S

**Why deferred:** The BRD editor displays the structured FR table read-only with quality-check indicators. Editing FRs requires opening §6 markdown; the structured table doesn't sync back.

**What's needed:**
- Add edit/add/delete row affordances to the FR table panel in `BrdEditor.tsx`
- On save, PATCH `frTable` and re-render §6 markdown body from the structured rows
- Quality-check column should be editable too (toggle testable: true/false with reason)

**Cross-references:** wireframe `02-stage-wft-to-brd.html` callout #5.

---

### [P1-polish] BRD §15 inline open-items editor — effort: S

**Why deferred:** Same pattern as FR table — open items are displayed read-only.

**What's needed:**
- Add/edit/delete row affordances on the §15 panel
- PATCH `openItems` array; re-render §15 body

**Cross-references:** wireframe 02 callout #11.

---

### [P2] EPIC multi-source context picker — effort: M

**Why deferred:** Stakeholder decision #3 (locked): Phase 1 = AN-only; Phase 2 = full multi-source picker (BRD + AN + Lo-fi + Hi-fi + FRD + PRD).

**What's needed:**
- Extend `BaModule` Prisma schema: `discoveryContextRefsJson` field (currently we only have `approachNoteVersionId`)
- Extend EPIC generation prompt to fold in multiple sources
- New UI on existing module page Discovery Context banner (per wireframe 06): 5 currently-disabled buttons become active

**Cross-references:** wireframe `06-stage-epic-integration.html`, AN §11.12.

---

## Stage 3 — BRD → Approach Note (versioned)

### [✅ DONE 2026-05-01] AN preview / PDF / DOCX export — effort: S

**Why deferred:** Same reason as deferring WFT export — pattern is established with BRD; just needs mirroring.

**What's needed:**
- New template `discovery/templates/an-html.ts` — 11-section layout with version timeline header
- New service `approach-note-export.service.ts` mirroring `brd-export.service.ts`
- 3 routes on `discovery.controller.ts`: `approach-note/versions/:vid/preview`, `/export/pdf`, `/export/docx`
- Toolbar in `ApproachNoteEditor.tsx` (copy `BrdExportToolbar`)

**Cross-references:** BRD export pattern in `brd-export.service.ts`.

**Shipped:** `an-html.ts` (260 lines) + `an-export.service.ts` (255 lines) + 3 controller routes + `AnExportToolbar` sub-component in `ApproachNoteEditor.tsx`.

---

### [✅ DONE 2026-05-01] AN client-edition export — effort: S

**Why deferred:** Skill 03 §10 worked example shows the Shivam Jewels engagement produced both `Approach-Note-...-v5.md` (internal) AND `Approach-Note-...-client-v5.md` (strips the "Changes since v(N-1)" log).

**What's needed:**
- New endpoint `GET /approach-note/versions/:vid/export/{pdf,docx}?edition=client`
- In `approach-note-export.service.ts`, when `edition === 'client'`, set `changesSince = null` on the input before rendering
- UI button "Export client edition" alongside the regular export buttons

**Cross-references:** skill 03 §10, AN §3.10.

**Shipped:** `?edition=client|internal` query param honored across all 3 export routes; toolbar has Internal/Client segmented control; client edition strips Changes-since panel + adds a red "Client edition" pill on the cover.

---

### [✅ DONE 2026-05-01] Brand tokens editor with reference-page upload — effort: M

**Why deferred:** Currently the brand tokens display read-only in §3 of the AN editor. End users can change them only by editing the AN §3 markdown body, which doesn't update the structured `brandTokens` JSON. Needs a structured editor.

**What's needed:**
- Inline editor on the §3 brand tokens panel: 3 color pickers (primary / surface / CTA) + product name field + logo upload
- "Upload reference page" affordance: drop website screenshot / brand guide PDF; AI extracts palette via Vision API
- New `aiService.extractBrandTokens(imageBase64): Promise<BrandTokens>` method
- New Python `/extract-brand-tokens` endpoint with Vision-capable model
- Save updates `brandTokens` JSON on the current AN version (uses existing `updateDiscoveryAnVersion` API)
- These tokens cascade to Stage 4 (lo-fi wireframes) and Stage 5 (hi-fi) when those stages are built

**Cross-references:** wireframe `03-stage-brd-to-an.html` callout #4a, AN §3.10.

**Shipped:** `BrandTokensInlineEditor` sub-component in `ApproachNoteEditor.tsx` with HTML5 color pickers + hex inputs + product name field + "Extract from reference" button. Python `/extract-brand-tokens` endpoint uses OpenAI Vision (`gpt-4.1` image_url). Logo upload not yet wired (defer to a follow-up — see new entry below).

---

### [✅ DONE 2026-05-01] Decisions Locked + Open Questions inline editing — effort: S

**Why deferred:** Both panels in §8 are read-only. The skill 03 process flow expects users to mark questions resolved (which moves them from §8.3 to §8.1), but right now users can only do this by editing the AN markdown directly.

**What's needed:**
- Add edit/add/delete affordances on §8 panels in `ApproachNoteEditor.tsx`
- "Mark resolved" button on each open question → moves to decisions, captures the resolution
- PATCH `decisionsLocked` and `openQuestions` arrays
- Optional: re-render §8 markdown body from the structured arrays

**Cross-references:** skill 03 §6 quality criteria (every silent default surfaced), wireframe 03 callouts #6 and #7.

**Shipped:** `DecisionsInlineEditor` and `OpenQuestionsInlineEditor` sub-components. Open questions get a per-row **Resolve** button that moves the row into Decisions Locked using the question's `default` as the resolution (single PATCH atomic update). Auto-renumbering of open questions on save. The "re-render §8 markdown body from structured arrays" optional item not done — markdown body is independent of the structured panels (acceptable since both are visible in the export).

---

### [P1-polish] AN logo upload — effort: S

**Why deferred:** The brand-tokens editor handles colors + product name fully but doesn't yet let users upload a logo image. The AN HTML/PDF/DOCX cover already renders `clientLogo` from the **project** record, but per-AN-version logos aren't wired.

**What's needed:**
- File-input affordance in `BrandTokensInlineEditor` next to the Extract / Edit buttons
- Persist the logo as a base64 data URL on `brandTokens.logo` (consistent with existing `BaProject.clientLogo` storage pattern)
- Cover renderer in `an-html.ts` already supports logos — just needs to read from `brandTokens.logo` first, falling back to `project.clientLogo`

**Cross-references:** Discovered while building the brand-tokens editor; surfaced as a follow-up to keep that slice focused.

---

### [P1-polish] AN audit log integration — effort: S

**Why deferred:** Each AN version creation is logged via `Logger.log()` but doesn't write to the project's audit trail surface (where edits to artifacts get captured for compliance review).

**What's needed:**
- On version creation / version update, emit audit event using existing audit pattern
- Surface in existing audit viewer per BRD §6 FR-14

**Cross-references:** BRD §6 FR-14, AN §10.

---

## Stage 4 — Approach Note → Lo-fi Wireframes

> ✅ **Core shipped 2026-05-01.** Schema, AI generation, gallery, traceability matrix,
> per-screen viewer with sandboxed iframe + markdown editor. Three polish items
> deferred below.

### [P1-polish] Wireframe set bundle export — effort: S

**Why deferred:** Each screen has `mdContent` and `htmlContent`, plus a shared `coverageStatus`. Power users would want a single `.zip` of the whole set (one `.md` + one `.html` per screen + a shared `wireframes.css`) for offline sharing or version-control commits.

**What's needed:**
- New service `wireframe-bundle-export.service.ts` — uses `archiver` (already in package.json) to stream a zip
- `GET /api/ba/projects/:projectId/discovery/wireframes/:setId/export/bundle` route
- Toolbar button in `WireframeSetEditor.tsx` (mirror BRD/AN export pattern)
- Bundle should include a top-level `00-screen-navigation-flow.{md,html}` derived from the traceability matrix

**Cross-references:** skill 04 §5.3 + Shivam Jewels reference template (the `wireframes/` directory).

---

### [P1-polish] Custom screen creation — effort: S

**Why deferred:** The pattern picker covers the 13 skill 04 §4 patterns. End users may need a screen that doesn't fit any pattern (e.g. "API integration test page"). Currently there's no UI to add one.

**What's needed:**
- "+ Add custom screen" button on `WireframeSetEditor.tsx`
- Modal: name + slug + free-text "describe this screen" input
- Server-side: skip pattern dispatch in the AI prompt for custom screens; just generate per the freeform description
- The traceability matrix automatically picks up custom screens since it works off `callouts[].mappedTo`

**Cross-references:** skill 04 §4 catalogue (the 13 patterns are not exhaustive).

---

### [P1-polish] Per-screen callouts / components inline editing — effort: S

**Why deferred:** `mdContent` is editable on each screen but `callouts` and `components` arrays display read-only in the side rail. Power users want to add/edit/delete callouts directly without re-editing the markdown body.

**What's needed:**
- Inline editor UX similar to the AN `DecisionsInlineEditor` / `OpenQuestionsInlineEditor` pattern
- PATCH `callouts` and `components` arrays via the existing `PATCH /wireframes/screens/:id` endpoint (already supports both fields)
- Optional: re-render the markdown annotations table from the structured array on save

**Cross-references:** existing AN-section editing pattern in `ApproachNoteEditor.tsx`.

---

## Stage 5 — Lo-fi → Hi-fi Mockups

> Shipped 2026-05-01: end-to-end pipeline from lo-fi wireframe set to branded hi-fi
> HTML mockups, with deterministic callout-parity validator (skill 05 §7) per screen.
> Sandboxed iframe rendering, scaled thumbnails in the gallery, and full source-edit mode.

### [P1-polish] Hi-fi set bundle export (HTML / PDF) — effort: S

**Why deferred:** The set is browsable in-app but cannot yet be exported as a single
artifact for client handoff. Each screen has its own self-contained HTML, but no
combined deliverable.

**What's needed:**

- Export service that bundles all screens into one paginated HTML (one page per screen,
  with cover sheet listing brand tokens + parity status summary).
- PDF rendering via Puppeteer (mirrors the existing AN/BRD export pattern).
- Optional ZIP download with each screen as a standalone `.html` file.
- Toolbar in `HifiSetViewer.tsx` (preview / PDF / ZIP buttons).

**Cross-references:** skill 05 §6 (handoff package), `BrdExportService` /
`AnExportService` patterns.

---

### [P1-polish] Hi-fi callouts inline editor with parity guard — effort: M

**Why deferred:** Today the screen detail page allows editing the HTML body, but the
callouts list is read-only. Edits to callouts must go through a dedicated UI that
enforces the parity invariant in real time.

**What's needed:**

- Side-rail editor: add / edit / remove rows.
- Live validation: warn when adding a number that doesn't exist in lo-fi (must be
  letter-suffixed like `3a` for hi-fi-only annotations).
- Persists via the existing `PATCH /hifi/screens/:screenId` route (already runs the
  per-screen parity validator on save).

**Cross-references:** skill 05 §7, `hifi.service.ts` `computeScreenParity`.

---

### [P1-polish] Hi-fi visual diff vs lo-fi — effort: M

**Why deferred:** A reviewer cannot easily see "what changed" between the lo-fi
parent and the hi-fi child. A side-by-side rendering would make parity violations
visually obvious in addition to the numeric report.

**What's needed:**

- New "Compare to lo-fi" tab on the screen detail page.
- Two iframes side by side; horizontally scroll-locked.
- Highlight callout badges that exist on one side but not the other.

---

### [Verification gate] Stage 5 end-to-end test — pending

**What's pending:** A full Stage 1 → Stage 5 dry run on a fresh project to confirm:

- Hi-fi generation completes within the 10-min timeout for a 7-screen lo-fi set.
- Parity validator correctly flags missing / invalid-extra callouts.
- Sandboxed-iframe rendering shows the polished HTML without breaking the parent
  frame's CSS.
- Brand-token cascade actually colors the hi-fi (compare cta button color across
  AN tokens → lo-fi → hi-fi).
- Regenerate creates a new set rather than mutating in place.

**Owner:** TBD (BA + dev pair, ~30 min walkthrough).

---

## Stage 6 — Discovery → PRD → EPIC handoff (re-scoped)

**Stakeholder decision (2026-05-03):** Stage 6 is re-scoped from a direct
Discovery-→-EPIC banner to a **PRD-mediated** handoff. EPIC then accepts two
sources: the existing FRD path (legacy / brownfield) **or** a PRD generated
from Discovery (new path). PRD is the canonical "what to build" artifact.

**New target flow:** AN (with §12 PRD-Readiness Bridge) → auto-bootstrap PRD
draft (one-click) → BA reviews / edits PRD → EPIC consumes PRD as source.
Lo-fi / hi-fi attach as PRD reference assets.

### [✅ DONE 2026-05-03] AN §12 PRD-Readiness Bridge — effort: M

**What shipped:**

- Skill 03 §5 template extended from 11 → 12 sections; new §12 covers Actors, Integrations, Customer Journeys, Functional Landscape, UI/UX Requirements, Phase 1 Compliance, Testing Requirements, Key Deliverables, Receivables, Environment list, Miscellaneous (each maps 1:1 to a PRD template section).
- Skill 03 Tier-2 expansions: §1.1 Product overview, §3.3 NFRs split into 7 PRD sub-categories, §8.0 Assumptions & Constraints, §9.0 Product-level scope summary, §11.0 Phase 1 weekly timeline.
- `an_prompts.py` system prompt rewritten with the 12-section schema; `prdReadiness` JSON object emitted alongside `sections`.
- New `BaApproachNoteVersion.prdReadiness` Json column persists the structured form.
- Python `/an-generate` returns the new `AnPrdReadiness` model (with tolerant per-row parser); max_tokens bumped 12288 → 16384.
- NestJS `ApproachNoteService.generate` / `createNewVersion` / `updateVersion` thread `prdReadiness` through; shallow-merge on partial PATCH.
- Frontend `ApproachNoteEditor.tsx` adds a §12 tab with 11 sub-tabs (one per §12 sub-section) — each tab is a structured editor (table or fieldset) that PATCHes the `prdReadiness` partial.
- AN export (HTML / PDF / DOCX) renders §12 as labelled tables in addition to the markdown narrative.
- `PIPELINE-OVERVIEW.md` updated to reflect 12-section AN.

**Why this matters:** auto-bootstrapping a downstream PRD now requires zero manual re-keying — the AN already carries every PRD section in a structured form.

### [P1] PRD bootstrap from AN — effort: M

**Why deferred:** Implementation pending — needs the existing PRD-generator app to expose an "import from AN" endpoint or seed-document upload, plus a Discovery-side "Send to PRD" CTA.

**What's needed:**

- Determine the host: PRD lives in the BA project (NestJS-side bootstrap, project-scoped) **or** sibling `prd_generator` app (cross-app handoff). [Open question — see Stage 6 banner above.]
- New endpoint `POST /api/ba/projects/:projectId/discovery/prd/bootstrap-from-an` that reads the latest AN version + `prdReadiness` JSON and writes a PRD draft pre-populated by section:
  - PRD §1 Overview ← AN §1.1 Product overview
  - PRD §2-3 Scope / Out of scope ← AN §9.0
  - PRD §4 Assumptions and Constraints ← AN §8.0
  - PRD §5 Actors ← AN §12.1 (1:1)
  - PRD §6 Functional Requirements ← AN §3.1 + frTable
  - PRD §7 Integrations ← AN §12.2 (1:1)
  - PRD §8 Customer Journeys ← AN §12.3 (1:1)
  - PRD §9 Functional Landscape ← AN §12.4 (1:1)
  - PRD §10 NFRs ← AN §3.3.1-3.3.7 (already split per skill 03 update)
  - PRD §13 UI/UX ← AN §12.5 (1:1)
  - PRD §14 Branding ← AN §3.10 brandTokens
  - PRD §15 Compliance ← AN §12.6 (1:1)
  - PRD §16 Testing ← AN §12.7 (1:1)
  - PRD §17 Deliverables ← AN §12.8 (1:1)
  - PRD §18 Receivables ← AN §12.9 (1:1)
  - PRD §19 Environment ← AN §12.10 (1:1)
  - PRD §20 Timeline ← AN §11.0 + §11.15
  - PRD §21 Success criteria ← AN §9.1
  - PRD §22 Miscellaneous ← AN §12.11
- Frontend "Send to PRD" CTA at the end of Stage 5 (after hi-fi sign-off).
- Two-source EPIC: extend `SkillStepper` to accept `prdId` OR `frdId` as primary source.

**Cross-references:** skill 03 §12, PRD-Template.md §1-22, wireframe 06.

### [P2] EPIC two-source picker (PRD or FRD) — effort: M

**Why deferred:** Phase 2 work; requires the Phase 1 PRD bootstrap to land first. Once PRD generation is live, EPIC needs UI + service routing to choose between PRD-driven and FRD-driven flows.

**What's needed:**

- Source picker on the EPIC entry page (radio: "From PRD" / "From FRD").
- `ba-narrative.service.ts` accepts `{ source: 'prd' | 'frd', sourceId: string }` instead of just FRD.
- Reference panel showing back-links from EPIC → source PRD/FRD → underlying AN + lo-fi + hi-fi.

---

## Cross-cutting concerns

### [P2] Multi-tenancy activation — effort: M

**Why deferred:** Stakeholder decision: Phase 1 is single-tenant (`tenantId = "default"`); Phase 2 flips the flag. **Schema is already multi-tenant ready** — every Discovery table has the projectId/(eventually tenantId) relationships.

**What's needed:**
- Add `tenantId` column to all Discovery tables (currently relying on the existing `BaProject` boundary)
- Tenant resolver middleware (reads from auth claim)
- Per-tenant brand token namespace on AN versions (today's tokens are project-scoped, fine for P2 too)
- `TENANCY_MODE=multi` flag flip
- Update Prisma queries to filter by tenantId

**Cross-references:** AN §3.12, AN §11.3.

---

### [P2] Containerization — effort: M

**Why deferred:** Phase 1 runs natively (`npm run start:dev` + `uvicorn`). Phase 2 introduces Dockerfiles for ECS Fargate.

**What's needed:**
- Dockerfile for NestJS backend (multi-stage build, non-root user, slim base)
- Dockerfile for Python ai-service
- Dockerfile for Next.js frontend
- ECR repos + image build/push pipeline
- ECS Fargate task definitions
- IaC (Terraform or CDK)

**Cross-references:** AN §11.1.

---

### [P2] LLM provider migration: Anthropic Direct → Bedrock — effort: S

**Why deferred:** Phase 1 uses OpenAI (current `ai-service`) and Anthropic Direct (per AN). Phase 2 migrates to AWS Bedrock for ZDR-equivalent privacy guarantees.

**What's needed:**
- Add Bedrock provider to `ai-service/main.py` (or wrap existing OpenAI client behind an abstraction)
- Env var swap: `LLM_PROVIDER=anthropic_bedrock`
- Re-run dogfood scenarios (Stage 1, 2, 3) for output parity
- Update model names to Bedrock-style identifiers

**Cross-references:** AN §11.2.

---

### [P2] PRD reference-documents panel — effort: S

**Why deferred:** Stakeholder decision #6 (locked): Phase 1 links from pipeline + reuses existing PRD route; Phase 2 adds a "reference documents" panel in the PRD viewer that shows hyperlinks back to source AN / hi-fi / etc.

**What's needed:**
- Extend existing PRD viewer component
- Read `discoveryContextRefsJson` (from EPIC multi-source picker work above) on the linked module
- Render each ref as a clickable hyperlink

**Cross-references:** BRD §6 FR (deferred), AN §11.12.

---

### [P1-polish] OpenAPI doc for Discovery routes — effort: S

**Why deferred:** Other parts of the BA Tool have Swagger UI auto-generated (existing route `GET /api/ba/projects/:id/swagger`). Discovery routes don't yet appear there.

**What's needed:**
- Add `@ApiTags('discovery')` and `@ApiOperation` decorators to `discovery.controller.ts` (NestJS Swagger module)
- Verify routes appear in the project Swagger UI
- Optional: separate Discovery Swagger page

**Cross-references:** existing `BaSkillController` Swagger pattern.

---

### [P1-polish] Pipeline status awareness on existing project page — effort: S

**Why deferred:** The Discovery main page (`/discovery`) shows pipeline status, but the parent project page (`/ba-tool/project/[id]`) doesn't expose a "Discovery: 3 of 6 stages complete" indicator.

**What's needed:**
- Small addition to project page: load latest WFT/BRD/AN status, render a 1-line progress chip
- Link to `/discovery`

**Cross-references:** wireframe `00-main-pipeline.html` callout #3.

---

### [P1-polish] Stage gating policy (advisory vs strict) — effort: S

**Why deferred:** Stakeholder decision #8 (locked): advisory gating in Phase 1 (warn but allow override); current implementation lets users navigate freely between stages without checking quality criteria from prior stages.

**What's needed:**
- On each Continue CTA, run quality check against the prior stage's criteria
- Show a warning dialog with override option if criteria fail (per skill 02 §6, skill 03 §6)
- Phase 2 may flip a flag to strict (block, don't allow override)

**Cross-references:** AN §8.1 (decision #8), wireframe `00-main-pipeline.html` callout #19 (Phase-2 affordance).

---

## Verification gates (still pending end-to-end runs)

> These aren't deferred features — they're sanity checks that haven't been
> exercised yet because no real user has run the pipeline through. Tracked
> here so they don't get forgotten.

### [Verification] Stage 4 end-to-end test — effort: S (your time, not engineering)

**Status:** Stages 1–4 backend + frontend ship green per `npm run build` + `tsc --noEmit`. No human has run the full chain (audio → WFT → BRD → AN → wireframes) end-to-end against a real recording yet.

**What to test:**
- Upload an audio file at Stage 1 → confirm transcription succeeds
- Generate WFT → BRD → AN → Wireframes through to a 7+ screen set
- Coverage validator shows green for the AN's full FR list
- Click into a wireframe screen — sandboxed iframe renders, callouts overlay, components inventory references real AN §3.12.5 paths
- Try the AN brand-tokens reference upload — verify Vision extraction returns sensible colors

**Why this matters:** AI prompts can break on real-world inputs in ways the build doesn't catch. JSON parse failures, model token-limit truncation, prompt edge cases.

---

### [Verification] Stages 1–4 polish-readiness review — effort: S (review pass)

**Status:** ~10 P1-polish items spread across Stages 1–4 above. They're individually small (most are S effort) but no batch implementation slice has been scheduled.

**Recommendation:** before Stage 6 ships, dedicate a half-day polish slice to knock out the 5–6 most user-visible items (WFT export, audio retention purge job, OpenAPI doc, project-page status chip, AN logo upload, wireframe bundle export). Bringing the whole pipeline to high parity before adding Stage 5/6 surface area reduces technical debt.

---

## Reference templates / dogfood scenarios

### [P1-polish] Bundle Shivam Jewels reference template — effort: S

**Why deferred:** The reference template (BRD + AN client-v5 + 14 lo-fi wireframes + 14 hi-fi mockups) was prepared during the AN dogfood phase (per the worked example). It's not yet bundled into the BA Tool as a "View example" affordance on the Discovery pages.

**What's needed:**
- Static asset folder `backend/src/ba-tool/discovery/templates/shivam-jewels/` with the 5 artifact bundles
- New endpoint `GET /api/ba/discovery/templates/shivam-jewels/{kind}` to serve them
- Add "Reference template" panel link on each Stage page (already shown in wireframes 01–06 right rail)
- Handles end-user education without polluting their actual project data

**Cross-references:** wireframes 01–06 right rail "Reference template" panels, AN §3.8.

---

## Notes

- This file is the **single source of truth** for deferred items in the
  Discovery & Solutioning Track. Update on every slice — add new items, mark
  shipped items as DONE (with date) or remove.
- **Convention for shipped items:** change tag from `[P1-polish | P2 | P3-future]`
  to `[✅ DONE YYYY-MM-DD]` and append a brief **Shipped:** note explaining what
  landed (file paths, sub-components, deviations from the original plan).
  Don't delete shipped entries — they're history.
- Items here that map to AN §11 (Phase 2 roadmap) should stay consistent with
  the AN; if scope/effort changes, update both.
- For brand-new feature requests (not previously deferred), prefer adding to
  the AN §8.3 open questions or a new `OPEN-QUESTIONS.md` rather than this
  doc — this is for things we *consciously deferred*, not things to debate.

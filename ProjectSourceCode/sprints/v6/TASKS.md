# Sprint v6 — Tasks: Interactive PRD Authoring & Forward Propagation — Gap Loop · Inline AI/Mic Editing · PRD→HLD→E2E Freshness

## Status: ✅ COMPLETE (2026-06-03) — all phases shipped + verified. See WALKTHROUGH.md.

> **Backlog traceability:** S-01–S-03 (Foundation) → S-04–S-06 (Gap loop) → S-07–S-08 (Inline editor, unblocks I-03) → S-09–S-10 (Enrich-within-section) → T-01–T-04 (Forward propagation & freshness) → S-11 (Wire-up).
>
> **Sequencing note:** Phase 0 (S-01 schema · S-02 normalizer · S-03 M-06) gates everything. Phase 1–3 (Track S) can ship before Phase 4 (Track T), but T-02 freshness depends on S-03's populated `sourceArtifactVersions`. F2/F3 foundation decisions are locked (see PRD).

---

## Phase 0 — Foundation (gates everything)

### P0 Backend / DB

- [x] **Task 1: Add `metadata Json` to `BaProjectPrd` + `BaHld` (F1)** (P0-DB)
  - Acceptance:
    - `metadata Json @default("{}")` added to both `BaProjectPrd` and `BaHld` in `schema.prisma`
    - SQL migration written + applied **as `prd_user`** (no postgres password needed); `npx prisma generate` run
    - Existing rows default to `{}`; no data loss; PRD/HLD endpoints still return 200
    - Documented sub-keys: `metadata.gaps`, `metadata.gapAnswers`, `metadata.freshness`
  - Files: `backend/prisma/schema.prisma`, `backend/prisma/migrations/<ts>_prd_hld_metadata.sql` (new)
  - Effort: XS

- [x] **Task 2: `section-normalizer.ts` — flat `[AI]` ⇄ `{aiContent, editedContent, lockedAt, lastEditedAt}` (F2)** (P0-BE)
  - Acceptance:
    - `toStructured(raw): StructuredSection` — upgrades a legacy flat value (string with optional `[AI] ` prefix, or object of such) into `{ aiContent?, editedContent?, lockedAt?, lastEditedAt? }`; a `[AI] `-prefixed string → `{ aiContent }`, a plain string → `{ editedContent }`
    - `toFlat(structured): unknown` — collapses back to the display/export form: `editedContent ?? aiContent`, re-prefixing `[AI] ` only when the value came from `aiContent` and was not human-edited
    - `isAiOnly(field)` / `isLocked(field)` helpers for the UI + regeneration skip
    - **Single seam:** `ProjectPrdService.exportMarkdown`, the FRD module/feature read path, RTM enrichment, and `ContextEngineeringService` PRD read all go through `toFlat`/`toStructured` — no reader parses `[AI] ` inline anymore
    - Pure functions, fully unit-tested (round-trip: flat → structured → flat is stable)
  - Algorithm:
    1. Detect legacy shape (string / `[AI] string` / nested object); normalize to the structured record
    2. Preserve unknown extra keys verbatim (forward-compat)
    3. Round-trip safety: `toFlat(toStructured(x))` ≡ `x` for legacy inputs
  - Files: `backend/src/ba-tool/pipeline/section-normalizer.ts` (new), `backend/src/ba-tool/pipeline/section-normalizer.spec.ts` (new), `project-prd.service.ts` (export path), `context-engineering.service.ts` (PRD read)
  - Effort: M

- [x] **Task 3: M-06 — populate `triggeredBy` + `sourceArtifactVersions` on every generation (F5)** (P0-BE)
  - Acceptance:
    - `ProjectPrdService.generate`: sets `triggeredBy` (INITIAL_GENERATION first, else MANUAL_EDIT) — already partially done; add `sourceArtifactVersions = { inputCount: inputs.length }` for audit
    - `HldService.generate`: sets `sourceArtifactVersions = { prdVersion: latestPrd.version }` (verify existing) + `triggeredBy`
    - `E2eFlowService.generate`: sets `sourceArtifactVersions = { prdVersion, hldVersion }` + `triggeredBy`
    - A missing/legacy `sourceArtifactVersions` is tolerated everywhere as "unknown" (no crash)
  - Files: `backend/src/ba-tool/pipeline/project-prd.service.ts`, `hld.service.ts` (or `project-hld.service.ts`), `e2e-flow.service.ts`
  - Effort: S

---

## Phase 1 — Gap-answering loop (Track S)

### P0 Backend

- [x] **Task 4: Confirm/extend AI `/gap-check` contract for answer-merge** (P0-AI)
  - Acceptance:
    - `POST /gap-check` accepts `{ sections, answers: [{ section, question, answer }] }` and returns `{ updatedSections, remainingGaps: [{ section, question }] }` (reuse the legacy `/prd` endpoint — verify the shape in `main.py`; extend only if the project-PRD caller needs it)
    - Merged answers are written into the correct section keys; AI-added text in the merge is `[AI] `-prefixed
    - Returns `{ updatedSections: <unchanged>, remainingGaps: [] }` gracefully when `answers` is empty
  - Files: `ai-service/main.py`, `ai-service/prompts/gap_check_prompts.py` (extend prompt only if needed)
  - Effort: S

- [x] **Task 5: `ProjectPrdService` — persist gaps + `answerGaps` (new version + propagation)** (P0-BE)
  - Acceptance:
    - `generate()` persists returned gaps to `metadata.gaps` (so they survive refresh)
    - New `GET /api/ba/projects/:id/project-prd/gaps` returns `metadata.gaps` of the latest PRD (`[]` when none)
    - New `answerGaps(projectId, answers)`:
      - calls AI `/gap-check { sections, answers }`
      - validates `{ updatedSections, remainingGaps }` (reject + keep prior version on malformed shape — fail-safe)
      - creates a **NEW** `BaProjectPrd` version (`triggeredBy = MANUAL_EDIT`, `sourceInputIds` carried forward), `metadata.gaps = remainingGaps`, appends to `metadata.gapAnswers`
      - re-exports `02-PRD-FRD/PRD-FRD-v{n}.md` + CHANGELOG
      - fires `RequirementChangeService` + `ArtifactFreshnessService` (Track T) — best-effort, non-blocking
    - New route `POST /api/ba/projects/:id/project-prd/answer-gaps { answers }`
  - Files: `backend/src/ba-tool/pipeline/project-prd.service.ts`, `pipeline.controller.ts`
  - Effort: M

### P0 Frontend

- [x] **Task 6: `PrdGapPanel` — port `GapWizard` onto the PRD page (voice/text answers)** (P0-FE)
  - Acceptance:
    - Replaces the static amber "gaps flagged" card on `project-prd/page.tsx` with an interactive `PrdGapPanel`
    - Loads persisted gaps via `getProjectPrdGaps`; per-gap: question + answer textarea + `MicButton` (voice) + progress
    - "Submit answers" → `answerGaps` → reload PRD (fewer gaps, fuller sections); shows a toast on success
    - Empty-gaps state collapses the panel with "No open gaps"
    - Reuses `MicButton` and the `GapWizard` interaction model (Previous/Next, Ctrl+Enter)
  - Files: `frontend/components/ba-tool/PrdGapPanel.tsx` (new, ports `components/conversational/GapWizard.tsx`), `frontend/app/ba-tool/project/[id]/project-prd/page.tsx`, `frontend/lib/pipeline-api.ts` (new helpers `getProjectPrdGaps`, `answerProjectPrdGaps`)
  - Effort: M

---

## Phase 2 — Inline section editor + blue AI text (Track S) → unblocks I-03

### P0 Backend

- [x] **Task 7: Rework `updateSection` (F3) + per-field `suggest-field` endpoint** (P0-BE)
  - Acceptance:
    - `updateSection(prdId, sectionKey, content)`: stores the **structured** section (`{aiContent, editedContent, lockedAt}`) via the normalizer; merges in-place into the latest version (**no** new version for a plain edit); stamps `sections[key].lastEditedAt`
    - Controller PATCH continues to call `RequirementChangeService.analyzeChange` (verify existing wiring) and now also triggers `ArtifactFreshnessService` recompute
    - New `POST /api/ba/projects/:id/project-prd/:prdId/suggest-field { sectionKey, fieldName }` → proxies AI `/suggest` with section context → returns suggested text (UI writes it into `editedContent`, still visually AI until saved)
    - Locked fields (`lockedAt` set) are **skipped** by a subsequent `generate()`/`answerGaps` merge
  - Files: `backend/src/ba-tool/pipeline/project-prd.service.ts`, `pipeline.controller.ts`
  - Effort: M

### P0 Frontend

- [x] **Task 8: Inline section editor — `FormField` + AI Suggest + Mic + blue AI text + lock** (P0-FE)
  - Acceptance:
    - Each section on `project-prd/page.tsx` gains an "Edit" toggle; in edit mode every field renders via a ported `FormField` with an `AISuggestButton` and a `MicButton`
    - **Blue** text = `aiContent` not yet human-edited; **normal ink** = `editedContent`; a per-field **Lock** toggle (sets `lockedAt`)
    - "AI Suggest" → `suggestField` fills the field; "Mic" → `/transcribe` appends; "Save" → `updatePrdSection` with the structured value
    - FRD (§6) editor preserves the module/feature structure (edit feature `description`, `acceptanceCriteria`, etc.)
    - After save, the freshness banner on HLD/E2E reflects the change on next load (Track T)
  - Files: `frontend/components/ba-tool/PrdSectionEditor.tsx` (new, ports `components/forms/FormField.tsx` + `AISuggestButton.tsx` + `MicButton.tsx`), `frontend/app/ba-tool/project/[id]/project-prd/page.tsx`, `frontend/lib/pipeline-api.ts` (new helper `suggestPrdField`)
  - Effort: L

---

## Phase 3 — Enrich-within-section / §22 appendix rule (Track S)

- [x] **Task 9: AI prompts — enrich WITHIN canonical sections; net-new → §22 `[AI] [NEW]`** (P0-AI)
  - Acceptance:
    - `PARSE_SYSTEM_PROMPT` (and the gap-check merge prompt) instruct the model: new requirements from later inputs are added **within** the relevant canonical section — new modules/features under §6, new items under §10 (NFR) / §7 (Integrations) — and **MUST NOT** create new top-level section keys
    - Genuinely net-new items that fit no canonical section are placed in **§22 (Miscellaneous)**, each value prefixed `[AI] [NEW] `
    - The 22-key contract is preserved exactly (downstream RTM / HLD / context-engineering unaffected)
  - Files: `ai-service/prompts/parse_prompts.py`, `ai-service/prompts/gap_check_prompts.py`
  - Effort: S

- [x] **Task 10: Render `[AI] [NEW]` items with a distinct "new" chip** (P0-FE)
  - Acceptance:
    - The `AiText` renderer (and FRD feature renderer) detect the `[AI] [NEW] ` marker and show a distinct "NEW" chip (alongside the existing "AI" badge) so additions from later inputs are visible at a glance
    - Stripping logic handles both `[AI] ` and `[AI] [NEW] ` prefixes cleanly
  - Files: `frontend/app/ba-tool/project/[id]/project-prd/page.tsx` (`AiText` + `FrdView`)
  - Effort: XS

---

## Phase 4 — Forward propagation & artifact freshness (Track T)

### P0 Backend

- [x] **Task 11: Extend `RequirementChangeService` to flag HLD + E2E (T-01)** (P0-BE)
  - Acceptance:
    - `analyzeChange(projectId, 'PRD', …)` now also flags the latest `BaHld` and all `BaE2eFlow` rows (project-scoped) as impacted — in addition to the existing module EPIC/Story/SubTask/LLD counts
    - `analyzeChange(projectId, 'HLD', …)` flags `BaE2eFlow` + module artifacts (HLD sits above E2E + modules)
    - The change-impact report (MD+CSV in `10-RTM/`) gains an "Upstream artifacts flagged" section listing HLD vN / E2E flows
    - Existing "no downstream artifacts → hasImpact:false" guard preserved
  - Files: `backend/src/ba-tool/pipeline/requirement-change.service.ts`
  - Effort: M

- [x] **Task 12: `ArtifactFreshnessService` — version-staleness checker (T-02)** (P0-BE)
  - Acceptance:
    - `check(projectId): FreshnessReport` — for each downstream artifact (HLD, each E2E flow, and module EPIC/Story/SubTask/LLD where derivable), compares `sourceArtifactVersions.prdVersion` (and `hldVersion` for E2E) against the current latest upstream version
    - Returns `[{ artifactType, id, label, builtFrom: {prdVersion, hldVersion?}, current: {prdVersion, hldVersion?}, stale: boolean, reason }]`
    - Missing `sourceArtifactVersions` → `stale: true, reason: "unknown source version — recommend regenerate"` (never crash)
    - Persists the report to `BaProjectPrd.metadata.freshness` (latest PRD) with `computedAt`
    - New `GET /api/ba/projects/:id/freshness`
  - Files: `backend/src/ba-tool/pipeline/artifact-freshness.service.ts` (new), `pipeline.controller.ts`, `pipeline.module.ts` (register)
  - Effort: M

- [x] **Task 13: Fire propagation on every PRD/HLD change + CHANGELOG (T-04)** (P0-BE)
  - Acceptance:
    - `answerGaps` (S-05), `updateSection` (S-07), and `generate` (regenerate) all trigger `RequirementChangeService.analyzeChange` + `ArtifactFreshnessService.check` (best-effort, non-blocking, never breaks the primary save)
    - Each propagation event appends a CHANGELOG entry (category `Forward Sync`) summarising what changed and how many downstream artifacts were flagged
  - Files: `backend/src/ba-tool/pipeline/project-prd.service.ts`, `hld.service.ts`, `project-folder.service.ts` (changelog category)
  - Effort: S

### P0 Frontend

- [x] **Task 14: `FreshnessBanner` on HLD / E2E / Implementation pages (T-03) — renders I-03 data** (P0-FE)
  - Acceptance:
    - A reusable `<FreshnessBanner artifactType=… />` calls `GET /freshness`; when the page's artifact is stale, shows an amber banner: "Built from PRD v{n} · current is v{m} — review or regenerate" with a link to the latest change-impact report
    - Mounted on `/hld`, `/e2e-flows`, and `/implementation` pages
    - When not stale, renders nothing (or a small green "up to date with PRD v{m}")
    - This is the in-UI surface that finally renders the **I-03** impact data (now unblocked by the section editor)
  - Files: `frontend/components/ba-tool/FreshnessBanner.tsx` (new), `frontend/app/ba-tool/project/[id]/hld/page.tsx`, `.../e2e-flows/page.tsx`, `.../implementation/page.tsx`, `frontend/lib/pipeline-api.ts` (new helper `getArtifactFreshness`)
  - Effort: M

---

## Phase 5 — Wire-up + smoke test

- [x] **Task 15: Integration smoke test + regression sweep** (P1)
  - Acceptance:
    - Full forward loop on the **Taxcompass** project (already in DB):
      1. Generate PRD → gaps persist → answer one gap (voice + text) → verify new PRD version + remaining gaps shrink + markdown re-exported
      2. Edit a §6 feature with AI Suggest + Mic → save → verify blue AI text vs ink edit + `lastEditedAt` + locked field survives a regenerate
      3. Add a new input + regenerate → verify a net-new item lands in §22 tagged `[AI] [NEW]` (not a new top-level section)
      4. Verify HLD + E2E pages now show the **stale** freshness banner; verify CHANGELOG has `Forward Sync` entries; verify `10-RTM/` impact report lists HLD + E2E
    - `tsc --noEmit` clean on backend + frontend
    - No regressions: customer inputs, PRD generate/view, HLD, E2E, LLD workbench, FTC, test execution, implementation — all still render + function
    - `section-normalizer` round-trip verified against real legacy `BaProjectPrd` rows
  - Files: smoke notes; fixes as needed across touched files
  - Effort: S

---

## Addendum (added 2026-06-03, after Phase 2) — Track U + S-08b

> Raised while testing Phase 2: (1) §6 FRD feature-level fields are read-only in the inline editor (flagged Phase-2 limitation); (2) when a project has **no customer inputs**, the new pipeline has no in-browser "narrate / type → generate" path like the old `/prd` tool. The hub supports `TEXT_CONTEXT` (paste) + `AUDIO` (file upload, auto-transcribed) but **no in-browser mic recording** and **no empty-state conversational seed**.

### S-08b — FRD (§6) feature-level inline editing (Phase 2 fast-follow)
- [x] **Task 16:** Extend `PrdSectionEditor` (or a dedicated `FrdEditor`) so each FRD feature's text fields (`featureName`, `description`, `businessRule`, `acceptanceCriteria`, `priority`) are editable with AI Suggest + Mic + blue-AI/ink + lock; module-level fields already editable. Preserve the `6.N_*` module/feature structure + FR-IDs on save (round-trip through the normalizer per feature string field). Optional: add/remove a feature.
  - Files: `frontend/components/ba-tool/PrdSectionEditor.tsx` (or new `FrdEditor.tsx`), `project-prd/page.tsx`
  - Effort: M

### Track U — Direct Narration / Conversational Seed (no-inputs path)
- [x] **Task 17 (U-01):** In-browser **mic recording** on the Customer Inputs `AUDIO` card — reuse `MicButton`/MediaRecorder to record + transcribe in-browser, saving the result as an `AUDIO` (or `TEXT_CONTEXT`) input. Restores the old "narrate" capability (today audio is upload-only).
  - Files: `frontend/app/ba-tool/project/[id]/customer-inputs/page.tsx`, reuse `components/forms/MicButton.tsx`
  - Effort: S
- [x] **Task 18 (U-02):** PRD **empty-state conversational seed** — when no PRD/inputs exist, the project-prd page offers a "Start from voice or text" box (textarea + mic) that creates a `TEXT_CONTEXT` input and immediately triggers `generate`. Gives the old narrate/type → PRD experience directly on the PRD page.
  - Files: `frontend/app/ba-tool/project/[id]/project-prd/page.tsx`, `pipeline-api.ts` (reuse `createCustomerInput` + `generateProjectPrd`)
  - Effort: M

---

## Addendum 2 (added 2026-06-03, after Phase 4 testing) — Track V + Track W

> Raised while comparing the new pipeline to the original `/prd` tool: (1) AI Suggest is hidden behind the per-section "Edit" toggle (old tool shows it always on an always-editable form); (2) there is no in-browser **canonical PRD view / download** — the old tool's "Generate → Preview/Source" step. The 413 on the old tool's "Accept All & Create PRD" was a backend body-limit (fixed: 100kb → 25mb in `main.ts`).

### Track V — Canonical PRD Preview & Export + Always-On AI Suggest (BUILD)
- [x] **V-03:** AI Suggest **always visible** — expanding a section opens the editor directly (remove the read-only/Edit toggle), matching the old always-editable form. Save per section; collapse = discard unsaved.
  - Files: `frontend/app/ba-tool/project/[id]/project-prd/page.tsx`
  - Effort: S
- [x] **V-02:** Markdown **export endpoint + Download button** — `GET …/project-prd/markdown` returns the rendered canonical markdown (reuse the export renderer through the F2 seam); frontend downloads `.md`. (PDF/DOCX deferred.)
  - Files: `backend/.../project-prd.service.ts`, `pipeline.controller.ts`, `frontend/lib/pipeline-api.ts`, `project-prd/page.tsx`
  - Effort: S
- [x] **V-01:** **Preview** toggle on the project-prd page → full canonical rendered document (all 22 sections + §6 modules/features, read-only, AI text blue) reusing `FieldValue`/`FrdView`; the "generate → see the full PRD canonically" view.
  - Files: `frontend/app/ba-tool/project/[id]/project-prd/page.tsx`
  - Effort: M

### Track W — Draft Review & PRD Metadata (PLAN — DEFERRED)
- [ ] **W-01:** Optional draft-review stage — per-section Accept/Edit/Skip + progress (X/22, accepted/edited/skipped/pending) before finalizing, matching the old "PRD Draft Review". (New pipeline currently creates directly + edits inline.)
- [ ] **W-02:** PRD-level metadata (PRD Code, Client Name, Submitted By) on the new PRD + **version history UI** (view/compare/restore — `/project-prd/versions` API already exists).

---

## Task Summary

| # | Phase | Track | Priority | Effort | Deliverable |
|---|---|---|---|---|---|
| 1 | Foundation | S (F1) | P0 | XS | `metadata Json` on `BaProjectPrd` + `BaHld` |
| 2 | Foundation | S (F2) | P0 | M | `section-normalizer` — flat `[AI]` ⇄ structured (single seam) |
| 3 | Foundation | S (F5/M-06) | P0 | S | Populate `triggeredBy` + `sourceArtifactVersions` everywhere |
| 4 | Gap loop | S | P0 | S | AI `/gap-check` answer-merge contract |
| 5 | Gap loop | S | P0 | M | Persist gaps + `answerGaps` (new version + propagation) |
| 6 | Gap loop | S FE | P0 | M | `PrdGapPanel` — port GapWizard (voice/text) |
| 7 | Inline editor | S (F3) | P0 | M | Rework `updateSection` (in-place + propagate) + `suggest-field` |
| 8 | Inline editor | S FE | P0 | L | Section editor — FormField + AI Suggest + Mic + blue AI + lock |
| 9 | Enrich | S | P0 | S | Prompts — enrich-within-section; net-new → §22 `[AI] [NEW]` |
| 10 | Enrich | S FE | P0 | XS | Render `[AI] [NEW]` chip |
| 11 | Propagation | T-01 | P0 | M | Extend impact engine to HLD + E2E |
| 12 | Propagation | T-02 | P0 | M | `ArtifactFreshnessService` — version-staleness |
| 13 | Propagation | T-04 | P0 | S | Fire propagation on every PRD/HLD change + CHANGELOG |
| 14 | Propagation | T-03 FE | P0 | M | `FreshnessBanner` on HLD/E2E/Impl (renders I-03) |
| 15 | Wire-up | — | P1 | S | Smoke test + regression sweep |

**Total tasks: 15**  
**P0: 14 | P1: 1**  
**Track S: 11 · Track T: 4**

---

## Acceptance Criteria — Sprint Complete

- [ ] Gaps persist on the PRD across refreshes; a BA can answer them in-place (voice or text); answers merge into the right sections and remaining gaps shrink
- [ ] Answering gaps creates a new PRD version, re-exports the markdown, and fires forward propagation
- [ ] Any section field is editable inline with AI Suggest + Mic; AI text renders blue, human edits in ink; a locked field survives regeneration
- [ ] The 22 canonical sections are never exceeded — AI enrichment lands within sections or in §22 tagged `[AI] [NEW]`
- [ ] A PRD change flags downstream HLD + E2E flows + module artifacts (not just modules) with a change-impact report and CHANGELOG entry
- [ ] Every downstream page (HLD, E2E, Implementation) shows an accurate freshness banner derived from `sourceArtifactVersions`
- [ ] `triggeredBy` + `sourceArtifactVersions` are populated on every PRD/HLD/E2E generation (M-06 closed)
- [ ] Track I-03 is satisfied — impact data is surfaced in-UI via the freshness banner
- [ ] `section-normalizer` round-trips legacy flat `[AI]` data without loss; all readers (export, FrdView, RTM, context-engineering) go through the seam
- [ ] No regressions on existing routes; TypeScript compiles clean (`tsc --noEmit`) on backend + frontend

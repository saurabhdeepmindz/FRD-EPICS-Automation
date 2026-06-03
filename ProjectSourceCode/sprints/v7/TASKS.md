# Sprint v7 — Tasks: Guided PRD Editor Parity + Draft-Review Accept Gate (Tracks X + W)

## Status: ✅ COMPLETE (2026-06-03) — all 15 tasks shipped + verified. Open questions resolved with the recommended defaults (replace accordion ✓ · soft hint ✓ · auto PRD code ✓).

> **Backlog traceability:** Track X (guided editor shell — UI parity with old `/prd/[id]/edit`) + Track W (BACKLOG **W-01** draft-review gate, **W-02** metadata + version history).
>
> **Sequencing:** Phase 0 (backend foundation — status derivation, metadata cols, source/restore/review endpoints) gates the frontend. Phase 1 (shell) and Phase 2 (history/metadata) can land before Phase 3 (accept gate), which reuses Phase 1's stepper/sidebar to render review state. Phase 4 = wire-up + smoke.
>
> **Reuse note:** per-field AI Suggest + Mic + blue/ink + lock already exist (`PrdSectionEditor`/`FrdEditor`, v6). v7 ports the **navigation shell** and adds the **review gate** + **history/metadata** — it does NOT rebuild the field widgets. Old components to port live in `frontend/components/layout/{Stepper,Sidebar,SubTabBar}.tsx`, `frontend/components/forms/{SectionForm,ViewSource}.tsx`, `frontend/lib/section-config.ts`.

---

## Phase 0 — Backend foundation (gates the frontend)

### P0 DB

- [x] **Task 1: Add `prdCode? clientName? submittedBy?` to `BaProjectPrd` (W-02 / D7)** (P0-DB)
  - Acceptance:
    - Three nullable `String?` columns added to `BaProjectPrd` in `schema.prisma`
    - SQL migration written + applied **as `prd_user`** (no postgres password); `npx prisma generate` run
    - Existing rows tolerate `null`; PRD endpoints still return 200; no data loss
    - `generate()` sets `prdCode = "PRD" + DD-MM-YYYY` only when none exists yet on the project's PRD lineage (don't overwrite a user value); `clientName`/`submittedBy` left null (inherit from `BaProject` at read time)
  - Files: `backend/prisma/schema.prisma`, `backend/prisma/migrations/<ts>_prd_metadata_fields.sql` (new), `project-prd.service.ts`
  - Effort: S

### P0 Backend — section status + source

- [x] **Task 2: `computeSectionStatuses(sections)` pure helper + expose on `GET project-prd` (D2)** (P0-BE)
  - Acceptance:
    - New pure fn returns `Record<"1".."22", 'NOT_STARTED'|'IN_PROGRESS'|'COMPLETE'>`:
      - flattens each field via the v6 `section-normalizer` (`toFlat`) before emptiness checks
      - uses the field contract from `lib/section-fields` (shared list mirrored backend-side or imported) to know expected fields per section
      - **NOT_STARTED** = all expected fields empty; **COMPLETE** = all expected non-empty (and, for §6, every `6.N` module has ≥1 feature with `featureName`+`description`); else **IN_PROGRESS**
    - `getLatest()` / `GET project-prd` response includes `sectionStatuses` (computed, not stored)
    - Fully unit-tested (empty → NOT_STARTED; partial → IN_PROGRESS; full incl. §6 modules → COMPLETE; legacy flat `[AI]` values handled)
  - Files: `backend/src/ba-tool/pipeline/section-status.ts` (new) + `.spec.ts` (new), `project-prd.service.ts`, `pipeline.controller.ts`, `frontend/lib/pipeline-api.ts` (extend `ProjectPrd` type with `sectionStatuses`)
  - Effort: M

- [x] **Task 3: `GET project-prd/source` — return customer inputs used (D6)** (P0-BE)
  - Acceptance:
    - New route returns the `BaCustomerInput` rows whose ids are in the latest PRD's `sourceInputIds`: `[{ id, inputType, label, textExcerpt, fileName, createdAt }]` (text truncated to a safe excerpt; no raw file blobs)
    - Empty array when the PRD was seeded with no inputs (U-02 path); never crashes on a missing/legacy `sourceInputIds`
  - Files: `backend/src/ba-tool/pipeline/project-prd.service.ts`, `pipeline.controller.ts`, `frontend/lib/pipeline-api.ts` (`getProjectPrdSource`)
  - Effort: S

### P0 Backend — restore + review gate

- [x] **Task 4: `POST project-prd/:prdId/restore` — clone a version → new version (W-02 / D5)** (P0-BE)
  - Acceptance:
    - `restore(prdId)` reads that version's `sections` + metadata, creates a **NEW** `BaProjectPrd` (version = max+1, `status: 'DRAFT'`, `triggeredBy: 'MANUAL_EDIT'`, `sourceInputIds` carried forward), records `metadata.restoredFrom = <version>`
    - Re-exports `02-PRD-FRD/PRD-FRD-v{n}.md` + CHANGELOG entry; fires `RequirementChangeService` + `ArtifactFreshnessService` (best-effort, non-blocking) — same seam as `answerGaps`
    - Restoring a non-existent / cross-project prdId → 404, no write
  - Files: `backend/src/ba-tool/pipeline/project-prd.service.ts`, `pipeline.controller.ts`, `frontend/lib/pipeline-api.ts` (`restoreProjectPrdVersion`)
  - Effort: M

- [x] **Task 5: Review-status persistence + transition endpoints (W-01 / D3, D4)** (P0-BE)
  - Acceptance:
    - `generate()` / `answerGaps()` initialize `metadata.review` = all 22 keys `'pending'` (preserve existing entries on answerGaps merge)
    - `PATCH project-prd/:prdId/review/:sectionKey { status }` sets one of `accepted|edited|skipped|pending`; validates sectionKey ∈ 1..22 and status ∈ enum (reject otherwise)
    - `POST project-prd/:prdId/review/accept-all` sets every `pending` → `accepted` (leaves edited/skipped as-is)
    - `POST project-prd/:prdId/confirm` → `CONFIRMED` if no key is `pending`, else `CONFIRMED_PARTIAL`; returns the updated PRD; never advances to `APPROVED`
    - `updateSection()` (existing) also marks that section's review status `edited` (an inline edit counts as reviewed)
    - `GET project-prd` response includes `review` map + a computed `reviewProgress = { accepted, edited, skipped, pending }`
  - Files: `backend/src/ba-tool/pipeline/project-prd.service.ts`, `pipeline.controller.ts`, `frontend/lib/pipeline-api.ts` (`setPrdReviewStatus`, `acceptAllPrdReview`, `confirmProjectPrd`)
  - Effort: M

---

## Phase 1 — Guided editor shell (Track X — frontend)

- [x] **Task 6: Port `Stepper` onto the project-prd page (status-colored 1–22)** (P0-FE)
  - Acceptance:
    - A `PrdStepper` renders 22 numbered steps colored by `sectionStatuses` (COMPLETE green / IN_PROGRESS amber / NOT_STARTED muted / active ring), clicking a step selects that section
    - Adapts the old `components/layout/Stepper.tsx` to the new `Record`-keyed status map (string keys "1".."22") instead of the old numeric `sectionStatuses`
    - Mounted above the editor; matches the screenshot's circular numbered nav
  - Files: `frontend/components/ba-tool/PrdStepper.tsx` (new, ports `components/layout/Stepper.tsx`), `frontend/app/ba-tool/project/[id]/project-prd/page.tsx`
  - Effort: M

- [x] **Task 7: Port `Sidebar` — "PRD SECTIONS" checklist + §6 feature tree + §10 sub-areas** (P0-FE)
  - Acceptance:
    - A `PrdSidebar` lists all 22 sections with status icons (tick/loader/circle) from `sectionStatuses`; selecting a section opens it
    - §6 expands to a **module → feature tree** derived dynamically from the `6.N_*` keys (reuse the existing `extractDynamicSubModules` / `extractModuleFeatures` logic already in `prd/[id]/edit/page.tsx`); §10 shows its sub-areas; selecting a feature opens it in the form
    - Ports `components/layout/Sidebar.tsx` (`FeatureItem`, `moduleFeatures`, `dynamicModuleNames`, `onSelect/onSubTabSelect/onFeatureSelect`) to the new sections shape
  - Files: `frontend/components/ba-tool/PrdSidebar.tsx` (new, ports `components/layout/Sidebar.tsx`), `project-prd/page.tsx`
  - Effort: L

- [x] **Task 8: Port `SubTabBar` for §6 modules / §10 NFR areas** (P0-FE)
  - Acceptance:
    - A `PrdSubTabBar` renders horizontally-scrollable module tabs for §6 (dynamic) and §10 (static), with active-tab centering + overflow arrows (port `components/layout/SubTabBar.tsx` as-is)
    - Shown only when the active section has sub-modules; selecting a tab sets the active sub-module
  - Files: `frontend/components/ba-tool/PrdSubTabBar.tsx` (new, ports `components/layout/SubTabBar.tsx`), `project-prd/page.tsx`
  - Effort: S

- [x] **Task 9: Single-section focused layout + Save & Continue / Previous / Next** (P0-FE)
  - Acceptance:
    - Replace the accordion edit view with a **focused single-section layout**: Stepper (T6) + SubTabBar (T8) on top, Sidebar (T7) left, the active section's form on the right (Edit/Preview toggle preserved)
    - The form body **reuses the existing `PrdSectionEditor` / `FrdEditor`** (AI Suggest + Mic + blue/ink + lock) — no field-widget rewrite; the §6 path respects the active sub-tab/feature selection
    - Footer: **Previous** (disabled on §1) · **Save & Continue** (saves via existing `updatePrdSection`, then advances to the next section) · **Next** (disabled on §22)
    - After save, `sectionStatuses` refresh so the stepper/sidebar ticks update; the Preview toggle still renders the canonical document
  - Files: `frontend/app/ba-tool/project/[id]/project-prd/page.tsx`, (light edits) `frontend/components/ba-tool/PrdSectionEditor.tsx`, `FrdEditor.tsx`
  - Effort: L

- [x] **Task 10: Port `ViewSource` — show customer inputs used** (P0-FE)
  - Acceptance:
    - A "Source" header button opens a modal listing the inputs from `GET project-prd/source` (label, type chip, created date, text excerpt, file name + char count)
    - Empty state: "Generated from a quick note / no stored inputs" (U-02 path)
    - Ports `components/forms/ViewSource.tsx` UX, repointed to the new source endpoint
  - Files: `frontend/components/ba-tool/PrdViewSource.tsx` (new, ports `components/forms/ViewSource.tsx`), `project-prd/page.tsx`
  - Effort: S

---

## Phase 2 — Version history + PRD metadata (Track W / W-02 — frontend)

- [x] **Task 11: Version history modal — list · view · restore** (P0-FE)
  - Acceptance:
    - A clock/history button in the header opens a modal listing all versions from `GET project-prd/versions` (version, status, createdAt, triggeredBy)
    - Selecting a version shows it **read-only** (reuse the canonical `PrdPreview`); a **Restore** button calls `restoreProjectPrdVersion` (T4) then reloads onto the new latest version with a success toast
    - Diff/compare explicitly out of scope (note in UI: "view & restore")
  - Files: `frontend/components/ba-tool/PrdVersionHistory.tsx` (new), `project-prd/page.tsx`, `frontend/lib/pipeline-api.ts` (`listProjectPrdVersions`, `getProjectPrdVersion` if needed)
  - Effort: M

- [x] **Task 12: PRD metadata header + editor (PRD Code / Client / Submitted By)** (P0-FE)
  - Acceptance:
    - Header shows `{prdCode} — v{version}` + product name (matches the screenshot, e.g. `PRD03-06-2026 — v1.0`), with the `{status}` chip
    - A small "Edit details" affordance updates `prdCode`, `clientName`, `submittedBy` (PATCH the latest PRD; reuse `updateSection`-style endpoint or a dedicated `PATCH project-prd/:prdId/meta`)
    - Null client/submittedBy fall back to the `BaProject` values for display
  - Files: `frontend/app/ba-tool/project/[id]/project-prd/page.tsx`, `backend/.../project-prd.service.ts` + `pipeline.controller.ts` (`PATCH project-prd/:prdId/meta`), `frontend/lib/pipeline-api.ts` (`updateProjectPrdMeta`)
  - Effort: S

---

## Phase 3 — Draft-review accept gate (Track W / W-01 — frontend)

- [x] **Task 13: Review mode — per-section Accept / Edit / Skip + Accept All Pending + progress** (P0-FE)
  - Acceptance:
    - A "Review" toggle (or distinct mode) renders each section as a review card with **Accept** / **Edit** / **Skip** wired to `setPrdReviewStatus` (T5); **Edit** opens the inline editor (existing) and marks the section `edited` on save
    - An **Accept All Pending** header action calls `acceptAllPrdReview`; a progress bar shows `accepted / edited / skipped / pending` out of 22 (reuse the old `ReviewProgress` look)
    - In review mode the Stepper + Sidebar color by **review status** (accepted/edited green, skipped grey, pending amber); in edit mode they color by authoring status (T6/T7)
    - Mirrors the old `/prd/new/review` card UX, but operates on the already-persisted PRD (no sessionStorage staging)
  - Files: `frontend/components/ba-tool/PrdReviewMode.tsx` (new, ports `components/review/SectionReviewCard.tsx` + `ReviewProgress.tsx`), `project-prd/page.tsx`
  - Effort: L

- [x] **Task 14: Confirm PRD action + status lifecycle surfacing** (P0-FE)
  - Acceptance:
    - A **Confirm PRD** button calls `confirmProjectPrd` (T5); disabled with a tooltip while any section is `pending` unless the user explicitly confirms-partial
    - The header `{status}` chip reflects `DRAFT → CONFIRMED_PARTIAL → CONFIRMED`; on `CONFIRMED` the page shows a subtle "Reviewed & confirmed" state
    - (Optional, if low-risk) HLD/E2E pages show a soft hint when generating from a non-`CONFIRMED` PRD — no hard gate
  - Files: `frontend/app/ba-tool/project/[id]/project-prd/page.tsx`, (optional) `hld/page.tsx`, `e2e-flows/page.tsx`
  - Effort: M

---

## Phase 4 — Wire-up + smoke + regression

- [x] **Task 15: Integration smoke test + regression sweep** (P1)
  - Acceptance:
    - On an existing project (e.g. Taxcompass): generate → stepper + sidebar show statuses → edit a §6 feature via the tree with Save & Continue → tick turns COMPLETE
    - View Source lists the inputs; open History → restore an earlier version → new version created, markdown re-exported, freshness banners on HLD/E2E flip stale
    - Review mode: Accept/Edit/Skip a few sections, Accept All Pending, Confirm → status moves to CONFIRMED(_PARTIAL); progress numbers correct
    - Metadata: set PRD Code/Client/Submitted By → persists across refresh; header shows `{prdCode} — v{n}`
    - No regressions: gap loop, inline AI/Mic editing, Preview, `.md` export, Regenerate, forward propagation, freshness — all still function
    - `tsc --noEmit` clean (backend + frontend); `computeSectionStatuses` + any new pure helpers unit-tested
  - Files: smoke notes; fixes across touched files
  - Effort: S

---

## Task Summary

| # | Phase | Track | Priority | Effort | Deliverable |
|---|---|---|---|---|---|
| 1 | Foundation | W-02 | P0 | S | `prdCode/clientName/submittedBy` cols on `BaProjectPrd` |
| 2 | Foundation | X | P0 | M | `computeSectionStatuses` + expose on GET |
| 3 | Foundation | X | P0 | S | `GET project-prd/source` (inputs used) |
| 4 | Foundation | W-02 | P0 | M | `POST …/restore` (clone version) |
| 5 | Foundation | W-01 | P0 | M | Review-status persistence + accept-all + confirm endpoints |
| 6 | Shell | X FE | P0 | M | Port `Stepper` (status-colored 1–22) |
| 7 | Shell | X FE | P0 | L | Port `Sidebar` (checklist + §6 feature tree) |
| 8 | Shell | X FE | P0 | S | Port `SubTabBar` (§6/§10) |
| 9 | Shell | X FE | P0 | L | Single-section layout + Save & Continue/Prev/Next |
| 10 | Shell | X FE | P0 | S | Port `ViewSource` (customer inputs) |
| 11 | History | W-02 FE | P0 | M | Version history modal — list/view/restore |
| 12 | History | W-02 FE | P0 | S | PRD metadata header + editor |
| 13 | Gate | W-01 FE | P0 | L | Review mode — Accept/Edit/Skip + Accept All + progress |
| 14 | Gate | W-01 FE | P0 | M | Confirm PRD + status lifecycle |
| 15 | Wire-up | — | P1 | S | Smoke test + regression sweep |

**Total tasks: 15**  
**P0: 14 | P1: 1**  
**Track X (guided shell): 6 · Track W (gate + history + metadata): 8 · Wire-up: 1**

---

## Open questions for confirmation (before coding)

1. **Layout replacement vs. addition** — replace the current accordion with the guided single-section shell (recommended, matches the screenshot), or keep the accordion as an alternate view toggle?
2. **Confirm hard-gate** — should generating HLD/E2E from a non-`CONFIRMED` PRD be a *soft hint* (recommended) or a *hard block*?
3. **PRD Code source** — auto-generate `PRD{DD-MM-YYYY}` as the default (recommended), or always require the BA to enter it?

# Sprint v7 — PRD: Guided PRD Editor Parity + Draft-Review Accept Gate (Tracks X + W)

## Overview

Sprint v7 brings the **old standalone PRD tool's guided authoring experience** fully into the new project-scoped `/ba-tool` pipeline, and adds the **draft-review accept gate** that the old tool had before a PRD was committed.

Today the new pipeline's PRD page (`/ba-tool/project/[id]/project-prd`) is a **collapsible accordion** of 22 sections with always-on per-field AI Suggest + Mic, a canonical Preview, `.md` export, the gap-answering loop, and Regenerate. What it is **missing** versus the original tool ([app/prd/[id]/edit/page.tsx](../../frontend/app/prd/[id]/edit/page.tsx)) is the **guided navigation shell** — the 1–22 **Stepper**, the left **"PRD SECTIONS"** checklist with completion ticks, the §6/§10 **sub-tab bar** and module/feature tree, **Save & Continue / Previous / Next** flow, **View Source**, and **section version history** (the clock icon). It also has **no review/accept gate**: `generate()` writes the PRD straight to the DB as `DRAFT` and there is no per-section Accept/Edit/Skip nor a Confirm step, even though the schema already carries the `DRAFT → CONFIRMED_PARTIAL → CONFIRMED → APPROVED` status enum.

v7 delivers two tracks (both already itemized in BACKLOG.md):

- **Track X — Guided Editor Shell (UI parity):** port `Stepper`, `Sidebar`, `SubTabBar`, the single-section focused form (Save & Continue / Previous / Next), and `ViewSource` onto the persistent, versioned `BaProjectPrd` model — reusing the existing `PrdSectionEditor` / `FrdEditor` (AI Suggest + Mic + blue/ink + lock) as the per-section form body. Introduce a **per-section authoring status** (NOT_STARTED / IN_PROGRESS / COMPLETE) to drive the stepper and sidebar ticks.
- **Track W — Draft Review Gate, Metadata & Version History (BACKLOG W-01 + W-02):** per-section **Accept / Edit / Skip** with an **Accept All Pending** action and a progress summary, a **Confirm PRD** transition (`DRAFT → CONFIRMED_PARTIAL / CONFIRMED`); **PRD-level metadata** (PRD Code, Client Name, Submitted By); and a **version history UI** (list / view / restore) on top of the existing `/project-prd/versions` API plus a new **restore** endpoint.

After v7, the new pipeline's PRD page matches the screenshots the user shared — guided 22-section authoring, per-section review gating before finalize, source visibility, and version history — while keeping everything v6 already built (gap loop, inline AI/Mic editing, forward propagation, freshness).

## Goals

- A BA can navigate the 22 sections via a **status-colored Stepper** and a **left "PRD SECTIONS" checklist** with completion ticks (NOT_STARTED / IN_PROGRESS / COMPLETE), matching the old tool.
- §6 (FRD) and §10 (NFR) expose a **sub-tab bar** + **module/feature tree** (dynamically derived from content) for drilling into modules and features.
- Each section is edited in a **single-section focused view** with **Save & Continue / Previous / Next**, reusing the existing per-field AI Suggest + Mic + blue/ink + lock editor.
- A BA can **View Source** — see the customer inputs the PRD was generated from (the new-pipeline equivalent of the old tool's source document).
- A BA can open **version history** (clock icon) to list all versions, view any past version read-only, and **restore** one (creates a new version from it).
- The PRD carries **PRD Code, Client Name, Submitted By** metadata, shown in the header (e.g. `PRD03-06-2026 — v1.0`) and editable.
- A BA can **review the generated draft** section-by-section — **Accept / Edit / Skip** each, **Accept All Pending**, see live progress (accepted / edited / skipped / pending out of 22), and **Confirm** the PRD to advance its status out of `DRAFT`.
- No regressions: gap loop, inline editing, Preview, `.md` export, Regenerate, forward propagation, and freshness banners all still work; TypeScript compiles clean on backend + frontend.

## User Stories

- As a BA, I want a numbered stepper and a section checklist with completion ticks, so I can see at a glance which of the 22 sections are done and jump between them.
- As a BA, I want §6 modules and their features (and §10 NFR sub-areas) in a sub-tab bar / tree, so I can drill into a specific feature to edit it.
- As a BA, I want a focused one-section-at-a-time editor with Save & Continue / Previous / Next, so authoring feels like a guided wizard rather than scrolling an accordion.
- As a BA, I want to view the original customer inputs the PRD was built from, so I can verify the AI captured them faithfully.
- As a BA, I want to see the version history and restore an earlier version, so I can recover from a regeneration that went the wrong way.
- As a BA, I want the PRD to show its PRD Code, Client, and Submitted By, so the document is properly identified.
- As a BA, after generating a PRD I want to Accept / Edit / Skip each section (or Accept All Pending) and then Confirm, so I deliberately review the AI draft before it's treated as finalized — exactly like the old "PRD Draft Review".

## Technical Architecture

### Surface — v7

```
+------------------------------------------------------------------+
|  Browser (Next.js) — /ba-tool/project/[id]/project-prd  (reworked)|
|                                                                   |
|  Header: Back · {prdCode} — v{version} · {status} · Source ·      |
|          History(clock) · Preview · .md · Regenerate · HLD →      |
|  Stepper (1–22, status-colored)                  (Track X — port) |
|  SubTabBar (§6 modules / §10 NFR areas)          (Track X — port) |
|  +-----------------+--------------------------------------------+ |
|  | Sidebar          | Single-section focused form               | |
|  | "PRD SECTIONS"   |   = existing PrdSectionEditor / FrdEditor  | |
|  | + §6 feature tree|     (AI Suggest + Mic + blue/ink + lock)   | |
|  | + status ticks   |   Footer: Previous · Save & Continue · Next| |
|  +-----------------+--------------------------------------------+ |
|                                                                   |
|  Review mode (Track W — W-01): per-section Accept/Edit/Skip +     |
|    Accept All Pending + progress (X/22) + Confirm PRD             |
|  History modal (Track W — W-02): versions list · view · restore  |
|  Source modal (Track X): customer inputs used (sourceInputIds)    |
+----------------------------+-+------------------------------------+
                              | HTTP
                              v
+------------------------------------------------------------------+
|  NestJS — ProjectPrdService / pipeline.controller (extended)      |
|   existing: generate · get · versions(list) · gaps · answer-gaps  |
|             · markdown · suggest-field · updateSection(PATCH)      |
|   NEW:                                                             |
|     GET  project-prd/source            → customer inputs used      |
|     POST project-prd/:prdId/restore    → clone version → new ver   |
|     PATCH project-prd/:prdId/review/:sectionKey { status }         |
|     POST project-prd/:prdId/review/accept-all                      |
|     POST project-prd/:prdId/confirm    → DRAFT→CONFIRMED(_PARTIAL) |
|   sectionStatuses computed (NOT_STARTED/IN_PROGRESS/COMPLETE)      |
|     from section content via lib/section-fields field contract     |
|   BaProjectPrd: + prdCode? clientName? submittedBy?               |
|   metadata.review: Record<sectionKey, accept-status>             |
+------------------------------------------------------------------+
```

### Key decisions (locked)

- **D1 — Reuse, don't rebuild the per-section form.** The single-section view embeds the existing `PrdSectionEditor` / `FrdEditor` (already AI Suggest + Mic + blue/ink + lock from v6). The port is the **navigation shell** (Stepper, Sidebar, SubTabBar, Save & Continue/Prev/Next), not the field widgets.
- **D2 — Authoring status is derived, not a new per-section column.** `BaProjectPrd.sections` stays a `Record<string, unknown>` (no per-section status column). A pure `computeSectionStatuses(sections)` derives NOT_STARTED / IN_PROGRESS / COMPLETE from the `lib/section-fields` field contract (flattened through the v6 `section-normalizer`), returned on `GET project-prd`. §6 COMPLETE = every module has ≥1 feature with required fields.
- **D3 — Review status is separate from authoring status,** persisted in `metadata.review: Record<sectionKey, 'pending'|'accepted'|'edited'|'skipped'>` (default all `pending` on generate). In review mode the stepper/sidebar color by review status; in edit mode they color by authoring status.
- **D4 — Confirm uses the existing enum.** `confirm()` sets `CONFIRMED` when no section is `pending` (skipped allowed), else `CONFIRMED_PARTIAL`. No new status values. `APPROVED` remains reserved for a later sign-off step (out of scope).
- **D5 — Restore clones, never mutates.** `restore(prdId)` reads that version's `sections`, creates a **new** `BaProjectPrd` version (`triggeredBy = MANUAL_EDIT`, note "restored from vN"), re-exports markdown, and fires v6 forward propagation — consistent with answerGaps/regenerate.
- **D6 — Source = customer inputs.** The new pipeline has no `sourceText`/`sourceFileData` on the PRD (those were old-tool columns). `GET project-prd/source` returns the `BaCustomerInput` rows referenced by the latest PRD's `sourceInputIds` (label, type, text excerpt, file name, createdAt).
- **D7 — Metadata fields on BaProjectPrd.** Add `prdCode? clientName? submittedBy?` (nullable). Defaults: `prdCode` auto-suggested as `PRD{DD-MM-YYYY}` on first generate if unset; client/submittedBy inherit from `BaProject` when null. Migration applied **as `prd_user`** (per project DB convention).

### Non-goals (deferred)

- Version **diff/compare** view (history is list + view + restore only).
- `APPROVED` sign-off workflow / e-signature.
- Gating downstream HLD/E2E generation on `CONFIRMED` (surfaced as a soft warning only, if at all).
- PDF/DOCX export (v6 deferred `.md`-only; unchanged).

## Acceptance Criteria — Sprint Complete

- [ ] The project-prd page shows a status-colored 1–22 **Stepper** and a left **"PRD SECTIONS"** checklist with NOT_STARTED / IN_PROGRESS / COMPLETE ticks derived from content.
- [ ] §6 and §10 show a **SubTabBar**; §6 shows a **module → feature tree**; selecting a feature opens it in the form.
- [ ] Sections are edited one at a time with **Save & Continue / Previous / Next**, reusing the existing AI Suggest + Mic + blue/ink + lock editor; saving updates status ticks.
- [ ] **View Source** lists the customer inputs the PRD was generated from.
- [ ] **Version history** lists all versions, views any read-only, and **restores** one into a new version (markdown re-exported, propagation fired).
- [ ] **PRD Code / Client / Submitted By** render in the header and are editable and persisted.
- [ ] **Review mode**: each section can be Accepted / Edited / Skipped; **Accept All Pending** works; a progress summary shows X/22 accepted-edited-skipped-pending; **Confirm** moves status to `CONFIRMED` (or `CONFIRMED_PARTIAL`).
- [ ] No regressions: gap loop, inline editing, Preview, `.md` export, Regenerate, forward propagation, freshness banners all still function.
- [ ] `tsc --noEmit` clean on backend + frontend; `computeSectionStatuses` and any new pure helpers unit-tested.

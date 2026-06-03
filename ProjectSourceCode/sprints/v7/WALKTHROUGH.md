# Sprint v7 — Walkthrough: Guided PRD Editor Parity + Draft-Review Accept Gate

**Status:** ✅ Complete — all 15 tasks shipped, verified, and merged to `master` (2026-06-03, PR #7, commit `8a40179`).
**Tracks:** X (Guided Editor Shell — UI parity) · W (Draft Review Gate, Metadata & Version History).

---

## 1. What this sprint set out to do

After v6 the new pipeline's PRD page (`/ba-tool/project/[id]/project-prd`) was a **collapsible accordion** with always-on per-field AI Suggest + Mic, a canonical Preview, `.md` export, the gap-answering loop, and Regenerate. What it was **missing** versus the original standalone tool (`/prd/[id]/edit`) was the **guided navigation shell** — the 1–22 stepper, the "PRD SECTIONS" checklist with completion ticks, the §6 module/feature tree, **Save & Continue / Previous / Next**, View Source, and version history — and it had **no review/accept gate** before a PRD was treated as finalized.

v7 closed that gap by **porting the navigation shell** (not rebuilding the field widgets — those are reused from v6) and adding the **review gate + metadata + version history** on top of the persistent, versioned `BaProjectPrd`.

---

## 2. What shipped, by track

### Track X — Guided Editor Shell
- **`computeSectionStatuses`** (`section-status.ts`) — derives `NOT_STARTED / IN_PROGRESS / COMPLETE` per section from content (flattened through the v6 `section-normalizer`; §6 COMPLETE = every module has ≥1 feature with name + description). Exposed on `GET project-prd`. **12 unit tests.**
- **`PrdStepper`** — numbered 1–22, status-colored (green / amber / grey + active ring); colors by review status in review mode.
- **`PrdSidebar`** — "PRD SECTIONS" checklist with status ticks + a **§6 module → feature tree** derived from the `6.N_*` keys.
- **`PrdGuidedEditor`** — focused **single-section** layout (stepper + sidebar + the active section's form) with **Previous / Next**; the embedded editor's **Save acts as Save & Continue** (saves → advances). The form body **reuses the v6 `PrdSectionEditor` / `FrdEditor`** (AI Suggest + Mic + blue/ink + lock) — no field-widget rewrite.
- **`PrdViewSource`** — "Source" modal listing the `BaCustomerInput` rows the PRD was generated from (`GET project-prd/source`).

### Track W — Draft Review Gate, Metadata & Version History
- **`PrdReviewMode`** — per-section **Accept / Edit / Skip**, **Accept All Pending**, a progress summary (accepted / edited / skipped / pending out of 22), and **Confirm** (`DRAFT → CONFIRMED` when nothing pending, else `CONFIRMED_PARTIAL`). Review status lives in `metadata.review`; an inline edit auto-marks a section `edited`.
- **`PrdVersionHistory`** — lists all versions (`/versions`), views any read-only (`/version/:prdId`), and **restores** one (`POST …/restore` clones → new version, re-exports markdown, fires v6 forward propagation).
- **`PrdMetaEditor`** + header — **PRD Code / Client Name / Submitted By** (new nullable columns; `generate()` auto-sets `PRD{DD-MM-YYYY}`; client/submittedBy inherit from `BaProject` when null). Header shows `{prdCode} — v{n}` + status chip + "Edit details".
- The page header now has an **Edit / Preview / Review** segmented control + **Source · History · .md · Regenerate**.

---

## 3. Flow

```
Generate → DRAFT (review map = all 22 pending)
  Edit:    Stepper + Sidebar + focused section editor (AI Suggest/Mic/lock) · Save & Continue / Prev / Next
  Preview: canonical rendered document (v6) · .md download
  Source:  customer inputs used
  History: list → view (read-only) → Restore (clone → new version)
  Review:  Accept / Edit / Skip each · Accept All Pending · progress
             → Confirm → CONFIRMED (no pending) | CONFIRMED_PARTIAL (some skipped/pending)
```

---

## 4. Key decisions (locked)

| # | Decision |
|---|---|
| D1 | Reuse, don't rebuild the per-section form — embed v6 `PrdSectionEditor`/`FrdEditor`; port only the navigation shell. |
| D2 | Authoring status is **derived** (`computeSectionStatuses`), not a stored column. |
| D3 | Review status is separate from authoring status, persisted in `metadata.review`. |
| D4 | Confirm reuses the existing enum: `CONFIRMED` when no pending, else `CONFIRMED_PARTIAL`; `APPROVED` reserved for a later sign-off (out of scope). |
| D5 | Restore **clones** into a new version (never mutates) — same seam as answerGaps/regenerate. |
| D6 | "Source" = the `BaCustomerInput` rows from `sourceInputIds` (new pipeline has no `sourceText` column). |
| D7 | Metadata fields nullable; PRD code auto-suggested `PRD{DD-MM-YYYY}`; client/submittedBy inherit from `BaProject`. |

Open questions resolved with the recommended defaults: replace the accordion with the guided shell ✓ · non-Confirmed HLD/E2E generation = soft hint (no hard block) ✓ · auto-generate PRD code ✓.

---

## 5. Files

**Backend (new):** `pipeline/section-status.ts` (+ `.spec.ts`), `prisma/migrations/prd_metadata_fields.sql`.
**Backend (changed):** `prisma/schema.prisma` (`prdCode`/`clientName`/`submittedBy`), `pipeline/project-prd.service.ts` (`getLatestEnriched`, `getSource`, `restore`, `setReviewStatus`, `acceptAllReview`, `confirm`, `updateMeta`, review init/preserve, `updateSection` marks edited), `pipeline/pipeline.controller.ts` (source, version, restore, review/:section, review/accept-all, confirm, meta routes).
**Frontend (new):** `components/ba-tool/PrdStepper.tsx`, `PrdSidebar.tsx`, `PrdGuidedEditor.tsx`, `PrdViewSource.tsx`, `PrdVersionHistory.tsx`, `PrdMetaEditor.tsx`, `PrdReviewMode.tsx`.
**Frontend (changed):** `lib/pipeline-api.ts` (enriched `ProjectPrd` type + helpers), `app/ba-tool/project/[id]/project-prd/page.tsx` (Edit/Preview/Review shell; removed the dead accordion `PrdSection`).
**Docs:** `sprints/v7/PRD.md`, `TASKS.md`, this `WALKTHROUGH.md`, `BACKLOG.md` (Tracks X/W).

---

## 6. Verification

- Backend + frontend `tsc --noEmit` clean.
- **39 unit tests pass** (`section-status` 12, `section-normalizer` 27).
- Review→Confirm flow verified live: PATCH review (skip §2) + Accept All + Confirm → status `CONFIRMED`, `reviewProgress {accepted:21, skipped:1, pending:0}`.
- New routes mapped + smoke-tested (`source`, `version/:prdId`, `restore`, `review/*`, `confirm`, `meta`).
- 10-route regression sweep all 200; frontend page serves 200 on :3002.

---

## 7. Known limitations / deferred (non-goals)

- **Version diff/compare** — history is list / view / restore only.
- **`APPROVED`** sign-off / e-signature workflow.
- **Hard gate** on generating HLD/E2E from a non-`CONFIRMED` PRD — left as a soft hint (D-decision).
- **PDF/DOCX export from the new pipeline** — still `.md`-only (v6 deferral unchanged).
- **HLD page inline editor** — HLD has the v6 freshness banner but not the guided editor (fast-follow).
- Review "Edit" jumps to the guided editor at that section; per-feature deep-link within §6 is overview-level via the sidebar tree.

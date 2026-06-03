# Sprint v6 — Walkthrough: Interactive PRD Authoring & Forward Propagation

**Status:** ✅ Complete — all phases shipped and verified (2026-06-03).
**Tracks:** S (Interactive Requirement Authoring) · T (Forward Propagation & Freshness) · U (Direct Narration) · S-08b (FRD feature editing).

---

## 1. What this sprint set out to do

The new `/ba-tool` project-prd track was **read/generate-only**: gaps were shown once and lost on refresh, sections were not editable, and changes to a PRD did not propagate to the downstream HLD/E2E artifacts built from it. v6 brings the legacy `/prd` tool's interactive authoring experience onto the new **persistent, versioned** model and closes the **forward PRD→HLD→E2E propagation loop**.

Two gaps raised mid-sprint were folded in: **§6 FRD feature-level editing** (S-08b) and the **no-client-inputs narration path** (Track U).

---

## 2. What shipped, by phase

### Phase 0 — Foundation
- **F1:** `metadata Json` added to `BaProjectPrd` + `BaHld` (migration `prd_hld_metadata.sql`, applied as `prd_user`). Holds `gaps`, `gapAnswers`, `freshness`.
- **F2:** `section-normalizer.ts` — a single seam bridging the legacy flat `[AI] `/`[NEW] ` strings and the structured `{aiContent, editedContent, lockedAt, lastEditedAt}` shape. Routed every PRD/HLD section reader (markdown export, REQUIREMENTS context, EPIC-orchestrator context, module context, HLD + E2E AI feeds) through `flattenValue`/`flattenSections`. Proven **identity on legacy data** (66/66 real sections round-trip unchanged).
- **F5 / M-06:** `triggeredBy` + `sourceArtifactVersions` populated on PRD/HLD/E2E generation.

### Phase 1 — Gap-answering loop (Track S)
- `generate()` persists gaps to `metadata.gaps`.
- `answerGaps()` consolidates answers → AI `/gap-check` merge → **new PRD version** + remaining gaps + answer audit trail; fail-safe on malformed AI output; CHANGELOG entry.
- Routes: `GET …/project-prd/gaps`, `POST …/project-prd/answer-gaps`.
- `PrdGapPanel` (ports `GapWizard`): per-gap card, **voice + text** answers, skip, progress, trail.

### Phase 2 — Inline section editor (Track S) — unblocks I-03
- `updateSection` reworked (F3): stores structured fields, stamps `lastEditedAt`, in-place (no new version).
- `suggestField` + `POST …/project-prd/:prdId/suggest-field` (proxies AI `/suggest`).
- `PrdSectionEditor`: per-field **AI Suggest + Mic + lock**, **AI text in blue / human edits in ink**, using `SECTION_FIELDS` for labels. `FieldValue` renderer shows structured data + AI/NEW chips read-only.

### Track U — Direct narration / no-inputs path
- **U-01:** in-browser mic on the Customer Inputs "Text / Context Notes" card.
- **U-02:** PRD empty-state "start from a quick note (type or narrate) → **Narrate & Generate PRD**" — creates a `TEXT_CONTEXT` input and generates, with zero prior inputs.

### S-08b — FRD (§6) feature-level editing
- `FrdEditor`: edit each feature's Name/Description/Business Rule/Acceptance Criteria with AI Suggest + Mic + lock + blue/ink, preserving module/feature structure + FR-IDs. Read-only `FrdView` updated to render structured feature fields + business rule + AC.

### Phase 3 — Enrichment + lock
- **S-09:** `parse` + `gap_check` prompts now enrich **within** canonical sections, route net-new items to **§22 with `[AI] [NEW]`**, and never invent top-level sections beyond 1–22.
- **S-09b:** recursive `mergeLocked` — locked fields (any depth, incl. §6 features by FR-ID) **survive regenerate and gap-merge**.
- **S-10:** `[AI] [NEW]` green chip in `FieldValue`.

### Phase 4 — Forward propagation & freshness (Track T)
- **T-02:** `ArtifactFreshnessService` + `GET …/freshness` — compares each downstream HLD + E2E flow's `sourceArtifactVersions` to the current latest PRD/HLD; "unknown → regenerate" fallback for legacy artifacts.
- **T-03:** `FreshnessBanner` on the HLD, E2E, and Implementation pages — amber "may be out of date — review or regenerate" listing which artifacts are stale and why.
- **T-01:** `RequirementChangeService` extended to flag the HLD + all E2E flows on a PRD change (E2E on an HLD change), included in the `10-RTM/` impact report.
- **T-04:** regenerate / answer-gaps recompute freshness and append a **"Forward sync"** CHANGELOG entry when downstream is superseded.

---

## 3. Forward loop (the core outcome)

```
New input / answered gap / inline edit
  → PRD section updated (in-place edit) OR new PRD version (regenerate / gap-resolution)
    → RequirementChangeService flags impacted HLD + E2E + module artifacts (+ 10-RTM report)
      → ArtifactFreshnessService marks downstream stale by version diff
        → FreshnessBanner on HLD / E2E / Implementation → review or regenerate
          → CHANGELOG "Forward sync" entry
```

---

## 4. Foundation decisions (confirmed)

| # | Decision |
|---|---|
| F1 | Add `metadata Json` to `BaProjectPrd` + `BaHld` |
| F2 | Realize `{aiContent, editedContent, lockedAt}` via one normalizer seam |
| F3 | Inline edit = in-place + `lastEditedAt`; regenerate / gap-resolution = new version |
| F4 | Extend impact engine to HLD + E2E + version-staleness |
| F5 | Populate `sourceArtifactVersions` everywhere (reuse `MANUAL_EDIT`, no enum migration) |

---

## 5. Files

**Backend (new):** `pipeline/section-normalizer.ts` (+ `.spec.ts`), `pipeline/artifact-freshness.service.ts`, `prisma/migrations/prd_hld_metadata.sql`.
**Backend (changed):** `pipeline/project-prd.service.ts`, `project-hld.service.ts`, `e2e-flow.service.ts`, `context-engineering.service.ts`, `module-context.service.ts`, `requirement-change.service.ts`, `pipeline.controller.ts`, `pipeline.module.ts`, `ba-skill-orchestrator.service.ts`, `prisma/schema.prisma`.
**AI service (changed):** `prompts/parse_prompts.py`, `prompts/gap_check_prompts.py`.
**Frontend (new):** `components/ba-tool/PrdGapPanel.tsx`, `PrdSectionEditor.tsx`, `FrdEditor.tsx`, `FreshnessBanner.tsx`, `lib/structured-field.ts`.
**Frontend (changed):** `lib/pipeline-api.ts`, `app/ba-tool/project/[id]/project-prd/page.tsx`, `customer-inputs/page.tsx`, `hld/page.tsx`, `e2e-flows/page.tsx`, `implementation/page.tsx`.
**Docs:** `sprints/v6/PRD.md`, `TASKS.md`, this `WALKTHROUGH.md`, `BACKLOG.md`.

---

## 6. Verification

- `section-normalizer` — **27/27 unit tests pass**; round-trip identity on **66/66 real PRD sections**.
- Backend `tsc --noEmit` clean; Frontend `tsc --noEmit` clean (0 errors).
- 14 pipeline routes → 200 across two real projects; new routes (`gaps`, `answer-gaps`, `suggest-field`, `freshness`) mapped + smoke-tested.
- Gap loop verified live: regenerate produced 10 persisted gaps; answer-gaps no-op path correct.
- `updateSection` F3 verified (structured store + `lastEditedAt`); test edit restored.
- Freshness verified live: up-to-date HLD = fresh, legacy E2E = correctly flagged stale.
- All three services healthy (backend :4000, ai-service :5000, frontend :3000 → 200).

---

## 7. Known limitations / fast-follows

- **Feature-level `lastEditedAt`** isn't stamped for nested §6 feature fields (only top-level fields); feature locks are still enforced on regenerate.
- **Module-artifact (EPIC/Story/SubTask/LLD) version-staleness** is not yet precise — those rows don't carry `sourceArtifactVersions` (orchestrator M-06 not wired); they're covered coarsely by `RequirementChangeService` flagging.
- **HLD inline editor** not built — the HLD page gets the freshness banner but not the per-field editor (fast-follow).
- **Legacy artifacts** (generated before M-06) show "unknown source version — recommend regenerate" until regenerated once.

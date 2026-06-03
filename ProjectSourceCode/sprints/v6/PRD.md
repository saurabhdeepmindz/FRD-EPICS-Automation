# Sprint v6 — PRD: Interactive PRD Authoring & Forward Propagation — Gap Loop · Inline AI/Mic Editing · PRD→HLD→E2E Freshness

## Overview

Sprint v6 brings the **interactive authoring experience** of the legacy `/prd` pipeline to the new project-scoped `/ba-tool` pipeline, and closes the **forward-propagation gap**: when new information enters at the PRD stage (an answered gap, an inline edit, or a regeneration), every downstream artifact that was built from the older requirement version is **flagged stale and surfaced for review** — never silently overwritten.

Today the new `project-prd` track is a **read-only, generate-only** viewer. Gaps returned by the AI are shown once and lost on refresh; there is no way to answer them in-place; there is no inline section editor; and edits (when they eventually happen) do not propagate to HLD or E2E flows. The downstream **impact engine already exists** (`RequirementChangeService`, Track I-01/I-02) but is coarse (module artifacts only — it ignores the project-scoped HLD and E2E flows that sit *between* the PRD and the modules) and has no version-staleness concept. Track I-03 (the UI to surface impact) was explicitly **deferred** because no inline section-editor was wired.

v6 delivers two tracks:

- **Track S — Interactive Requirement Authoring:** port the proven `GapWizard`, `FormField`, `AISuggestButton`, and `MicButton` components onto the new persistent, versioned `BaProjectPrd` model. Answer gaps in-place (voice or text), edit any section field inline with AI Suggest + Mic, render AI-written text in **blue** and human edits in normal ink, keep the **22 canonical sections fixed** while enriching *within* sections, and route genuinely net-new items to §22 (Miscellaneous) as a marked appendix bucket.
- **Track T — Forward Propagation & Artifact Freshness:** extend the impact engine to the full **PRD → HLD → E2E → EPIC/Story/SubTask/LLD** chain, add a **version-staleness checker** driven by `sourceArtifactVersions`, and surface a **freshness banner** on every downstream page so a BA always knows when an artifact is built from a superseded requirement version.

After v6, the forward loop is complete:

```
New input / answered gap / inline edit
  → PRD section updated (in-place edit) OR new PRD version (regenerate / gap-resolution)
    → RequirementChangeService flags impacted HLD + E2E + module artifacts
      → ArtifactFreshnessService marks downstream artifacts stale (version diff)
        → Freshness banner on HLD / E2E / Implementation pages → review or regenerate
          → CHANGELOG entry for every propagation event
```

## Goals

- A BA can **answer AI-flagged gaps in-place** on `/ba-tool/project/[id]/project-prd` (voice or text); answers merge into the PRD via `/gap-check`, remaining gaps are recomputed, and gaps persist across refreshes
- A BA can **edit any section field inline** with an AI Suggest button and a Mic button; AI-generated content renders **blue**, human-edited content renders in normal ink, and a field can be **locked** so regeneration won't overwrite it
- The **22 canonical sections stay fixed** — AI enriches *within* §6 modules / §10 NFR / §7 integrations; net-new top-level items are routed to **§22 Miscellaneous** tagged `[AI] [NEW]` and never create new top-level sections
- When a PRD section changes, the system **flags downstream HLD, E2E flows, and module artifacts** for review (not just module artifacts as today)
- Every downstream artifact shows a **freshness state** ("built from PRD v1; current is v2 — review or regenerate") derived from `sourceArtifactVersions`
- `triggeredBy` + `sourceArtifactVersions` are **populated on every PRD/HLD/E2E generation** (closes M-06) so staleness detection is reliable
- Track **I-03 is unblocked** — the inline section-editor provides the in-UI trigger the deferred impact banner was waiting for

## User Stories

- As a BA, when the AI flags gaps in my generated PRD, I want to answer them right on the PRD page (typing or speaking), so the PRD fills out without re-uploading inputs
- As a BA, I want my answered gaps to merge into the correct sections and the remaining-gap list to shrink, so I can see progress toward a complete PRD
- As a BA, I want to edit any section field directly, ask the AI to suggest text for a field, or dictate it with my mic, so I can refine the PRD without leaving the page
- As a BA, I want AI-written text shown in blue and my own edits in normal ink, with the option to lock a field, so I can tell what's machine-drafted vs. human-confirmed and protect my edits from regeneration
- As a BA, I want new requirements from a later customer input to be added *within* the right canonical section (or clearly into Miscellaneous if net-new), so the 22-section structure stays stable for everything downstream
- As an Architect, when a PRD section changes after I've generated the HLD, I want the HLD page to tell me it was built from an older PRD version and may need review, so I never ship an HLD that contradicts the current requirements
- As a BA lead, when a requirement changes, I want the E2E flows and the EPIC/Story/SubTask/LLD artifacts for affected modules flagged for review with a CHANGELOG trail, so nothing downstream silently drifts out of sync

## Technical Architecture

### System Context — v6 surface

```
+------------------------------------------------------------------+
|  Browser (Next.js)                                                |
|                                                                   |
|  /ba-tool/project/[id]/project-prd            (existing — reworked)|
|    ├── PrdGapPanel            (NEW — S-06)  port of GapWizard      |
|    │     voice/text answers → answer-gaps → merge + re-gap        |
|    ├── Inline Section Editor  (NEW — S-07)  FormField + AISuggest  |
|    │     + Mic; blue=aiContent, ink=editedContent, lock toggle    |
|    └── [AI][NEW] enrichment chips             (NEW — S-10)         |
|                                                                   |
|  /ba-tool/project/[id]/hld                    (existing — enhanced)|
|  /ba-tool/project/[id]/e2e-flows              (existing — enhanced)|
|  /ba-tool/project/[id]/implementation         (existing — enhanced)|
|    └── FreshnessBanner        (NEW — T-03)                         |
|          "Built from PRD v1 · current v2 — review / regenerate"   |
|          + impact summary (finally renders I-03 data)             |
+----------------------------+-+------------------------------------+
                              | HTTP
                              v
+------------------------------------------------------------------+
|  NestJS Backend (ba-tool / pipeline module)                       |
|                                                                   |
|  ProjectPrdService (reworked):                                    |
|    - generate(): persist gaps to metadata.gaps; populate          |
|      triggeredBy + sourceArtifactVersions (M-06)                  |
|    - answerGaps(prdId, answers): /gap-check → merge → NEW version  |
|      → export → fire propagation                                  |
|    - updateSection(): in-place edit + lastEditedAt + propagation   |
|                                                                   |
|  section-normalizer.ts (NEW — S-02):                              |
|    toStructured([AI]-flat) <-> {aiContent, editedContent, lockedAt}|
|    single seam for export / FrdView / RTM / context-engineering    |
|                                                                   |
|  RequirementChangeService (extended — T-01):                      |
|    now flags BaHld + BaE2eFlow (project-scoped) in addition to    |
|    module EPIC/Story/SubTask/LLD                                  |
|                                                                   |
|  ArtifactFreshnessService (NEW — T-02):                           |
|    compares downstream.sourceArtifactVersions vs current upstream |
|    versions → { artifact, builtFrom, current, stale }[]           |
|                                                                   |
|  New / changed routes:                                            |
|    GET   /ba/projects/:id/project-prd/gaps                        |
|    POST  /ba/projects/:id/project-prd/answer-gaps                 |
|    POST  /ba/projects/:id/project-prd/:prdId/suggest-field        |
|    GET   /ba/projects/:id/freshness                               |
+----------------------------+-+------------------------------------+
                              | HTTP
                              v
+------------------------------------------------------------------+
|  Python AI Service (FastAPI)                                      |
|    /gap-check          (existing — reused for answer merge)       |
|    /project-prd-generate (existing — prompt extended for          |
|                           enrich-within-section + [NEW] tagging)  |
|    /suggest            (existing — reused for per-field suggest)  |
+------------------------------------------------------------------+
```

### Data Flow — Gap-answering loop (Track S)

```
1. generate() returns { sections, gaps } → gaps persisted to BaProjectPrd.metadata.gaps
   ↓
2. PrdGapPanel renders persisted gaps (survives refresh); BA answers (voice → /transcribe, or text)
   ↓
3. POST answer-gaps { answers: [{ section, question, answer }] }
   ↓
4. ProjectPrdService.answerGaps:
   - calls AI /gap-check { sections, answers } → { updatedSections, remainingGaps }
   - creates a NEW BaProjectPrd version (triggeredBy = MANUAL_EDIT)
   - persists metadata.gaps = remainingGaps + metadata.gapAnswers (audit)
   - re-exports 02-PRD-FRD/PRD-FRD-v{n}.md + CHANGELOG
   - fires forward propagation (Track T)
   ↓
5. Page reloads → fewer gaps, fuller sections; downstream pages now show stale banners
```

### Data Flow — Inline edit (Track S, F3 policy)

```
1. BA opens a section in edit mode → FormField per key (blue = aiContent, ink = editedContent)
   - "AI Suggest" (per field) → POST suggest-field → fills editedContent (still tagged AI until saved)
   - "Mic" (per field)        → /transcribe → appends to editedContent
   - "Lock" (per field)       → lockedAt set → regeneration skips this field
   ↓
2. Save → PATCH project-prd/:id/section/:key { content (structured) }
   ↓
3. ProjectPrdService.updateSection (F3):
   - in-place merge into the latest version's sections (no new version for a plain edit)
   - stamp sections[key].lastEditedAt
   - controller calls RequirementChangeService.analyzeChange (existing wiring)
   - fire ArtifactFreshnessService recompute
   ↓
4. Downstream HLD / E2E / module artifacts flagged; CHANGELOG entry written
```

### Data Flow — Forward propagation & freshness (Track T)

```
PRD changed (edit / answer-gaps / regenerate)
  ↓
RequirementChangeService.analyzeChange(projectId, 'PRD', sectionKey)   [extended T-01]
  → flags module EPIC/Story/SubTask/LLD          (existing)
  → flags BaHld (project-scoped)                 (NEW)
  → flags BaE2eFlow (project-scoped)             (NEW)
  → writes change-impact report (MD+CSV) to 10-RTM/    (existing)
  ↓
ArtifactFreshnessService.check(projectId)        [NEW T-02]
  for each downstream artifact:
    builtFromPrd = artifact.sourceArtifactVersions.prdVersion
    if builtFromPrd < latestPrd.version → stale=true
  persist to metadata.freshness; return list
  ↓
GET /freshness → FreshnessBanner on HLD / E2E / Implementation pages
```

### New / Changed Backend Surface (net-new in v6)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/ba/projects/:id/project-prd/gaps` | Persisted gaps for the latest PRD (from `metadata.gaps`) |
| POST | `/api/ba/projects/:id/project-prd/answer-gaps` | Merge answers via `/gap-check`, create new version, propagate |
| POST | `/api/ba/projects/:id/project-prd/:prdId/suggest-field` | Per-field AI suggestion (section key + field name) |
| GET | `/api/ba/projects/:id/freshness` | Downstream artifact freshness/staleness map |
| PATCH | `/api/ba/projects/:id/project-prd/:prdId/section/:key` | (existing — reworked per F3: in-place + lastEditedAt + propagation) |

### Schema Changes (Prisma — additive only)

```prisma
// F1 — persist gaps, answers, freshness, edit-state on the project artifacts.
// BaProjectPrd: add
//   metadata Json @default("{}")
//     metadata.gaps:       [{ section, question }]
//     metadata.gapAnswers: [{ section, question, answer, answeredAt }]
//     metadata.freshness:  { computedAt, downstream:[{ artifactType, id, builtFrom, current, stale }] }
// BaHld: add
//   metadata Json @default("{}")   // mirror — gaps + freshness symmetry
//
// F2 — section value shape realized via normalizer (NO schema change):
//   sections[key] : { aiContent?, editedContent?, lockedAt?, lastEditedAt? }
//   (stored inside the existing `sections` Json; old flat [AI] strings upgraded on read)
//
// F5 / M-06 — triggeredBy + sourceArtifactVersions columns already exist (M-02/M-04).
//   v6 only populates them in the service layer — no migration needed.
//
// triggeredBy enum: reuse MANUAL_EDIT for gap-resolution + inline edits
//   (no new BaTriggeredBy value → no enum migration).
```

> **Migration ownership:** runs as `prd_user` (owns `public` schema since M-05) — no postgres password needed. See [db-migration-setup].

### AI Service — reused, prompts extended (no new endpoints)

```
/gap-check              reused as-is for answer-merge (input: sections + answers)
/project-prd-generate   prompt extended (S-09): AI may enrich WITHIN §6 modules /
                        §10 NFR / §7 integrations; net-new top-level items → §22
                        tagged "[AI] [NEW] "; MUST NOT invent new top-level section keys
/suggest                reused for per-field suggestion (section + field + context)
```

## Foundation Decisions (confirmed with user, 2026-06-03)

| # | Decision | Chosen |
|---|---|---|
| F1 | Where to persist gaps/answers/freshness | **Add `metadata Json` to `BaProjectPrd` + `BaHld`** (additive migration) |
| F2 | Section value shape | **Realize documented `{aiContent, editedContent, lockedAt}` via a single normalizer seam** (blue=AI, ink=edited, lockable) |
| F3 | Edit vs version policy | **Inline section edit = in-place + `lastEditedAt` + propagation; regenerate / gap-resolution = new version** |
| F4 | Impact scope | **Extend `RequirementChangeService` to HLD + E2E + version-staleness** (Track T) |
| F5 | `sourceArtifactVersions` population | **Bundle M-06** — populate on every PRD/HLD/E2E generate; reuse `MANUAL_EDIT` (no enum migration) |

## Out of Scope (v7+)

- **Per-field LLM impact analysis** — v6 propagation is version-diff + coarse module flagging (reuses I-01); semantic per-section impact (à la Track L `/sync-analyze`) stays optional/future
- **Auto-regeneration of downstream artifacts** — v6 only *flags* stale HLD/E2E/EPICs; the BA chooses to regenerate (never automatic)
- **Net-new top-level PRD sections beyond the 22** — explicitly rejected; enrichment-within + §22 appendix only
- **Real-time collaborative editing / conflict resolution** — single-editor, last-write-wins
- **HLD inline gap-answering / editor** — v6 ports the authoring UX to the PRD page only; the HLD page gets the freshness banner but not the editor (fast-follow)
- **Change Request (CR) UI** — schema exists (Track M); CR workflow remains deferred

## Dependencies

- ✅ **Track C** — `ProjectPrdService.generate` + `/project-prd-generate` + 22-section viewer already shipped
- ✅ **Track I-01/I-02** — `RequirementChangeService.analyzeChange` + change-impact reports already exist (T-01 extends, does not rewrite)
- ✅ **Track M-02/M-04** — `triggeredBy` + `sourceArtifactVersions` columns already on `BaProjectPrd`/`BaHld`/`BaArtifact` (M-06 populates them)
- ✅ **Track R** — `BaE2eFlow` exists with `sourceArtifactVersions`-eligible generation (T-01 flags it, T-02 checks its freshness)
- ✅ **Old pipeline components** — `GapWizard.tsx`, `FormField.tsx`, `AISuggestButton.tsx`, `MicButton.tsx` all present for reuse
- ✅ **AI endpoints** — `/gap-check`, `/suggest`, `/transcribe` already live (legacy `/prd` pipeline)
- **F1 migration** — `metadata Json` on `BaProjectPrd` + `BaHld` must land (S-01) before gap persistence (S-05) and freshness (T-02)
- **S-02 normalizer** — must land before the inline editor (S-07) and before markdown export changes

## Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| F2 normalizer breaks existing flat-`[AI]` readers (export, FrdView, RTM, context-engineering) | High | Route **all** section reads through `toStructured`/`toFlat` in one seam (S-02); add a back-compat path that upgrades legacy flat strings on read; smoke-test every reader in S-11 |
| In-place edit (F3) leaves downstream unaware if propagation silently fails | High | Propagation is best-effort but **always writes a CHANGELOG entry**; freshness recompute is idempotent and re-runnable via `GET /freshness` |
| Coarse impact (project-wide) over-flags every module as stale | Medium | Keep I-01's existing "no downstream artifacts → no impact" guard; freshness is version-diff (precise per artifact), banner explains *which* upstream version changed |
| `sourceArtifactVersions` missing on artifacts generated before M-06 | Medium | Treat a missing `sourceArtifactVersions` as "unknown — recommend regenerate" (never crash); backfill note in S-03 |
| Voice answer transcription latency on the gap panel | Low | Reuse the proven `MicButton` chunked-record flow; show recording indicator; answers are also typeable |
| Gap merge via `/gap-check` returns a malformed shape | Low | Validate `{updatedSections, remainingGaps}` server-side; reject + keep prior version on parse failure (fail-safe, no data loss) |

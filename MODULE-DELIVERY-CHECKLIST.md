# Module Delivery Checklist

Forward-looking runbook for delivering a module's customer-facing artifacts (FRD, EPIC, User Story, SubTask, FTC, optionally LLD) as preview + PDF + DOCX. Built from the MOD-04 / MOD-05 pilot. Apply this to every new module before sharing exports with stakeholders.

**Delivery sequence (current commitment)**: MOD-05 ✅ → MOD-04 (in progress) → MOD-06 → new modules.

---

## When to use

- Generating exports for a **new** module that's just completed its skill cascade.
- Re-validating exports for an **existing** module after any skill re-run, prompt update, or render-pipeline change.
- Before shipping any module's deliverables to a customer.

## Glossary

- **Skill cascade** — SKILL-00 → SKILL-01-S → SKILL-02-S → SKILL-04 → SKILL-05 → [SKILL-06-LLD] → SKILL-07-FTC.
- **Canonical structure** — the deterministic section schema each artifact should follow (FRD canonical: feature requirements with `#### F-XX-YY` headings each carrying 9 attributes; FTC canonical: 16 sections + per-category feature buckets).
- **Per-feature screen card** — inline screen thumbnail spliced under a feature heading in PDF/DOCX, derived from the FRD's `Screen Reference: SCR-NN` line.

---

## Step 1 — Pre-flight: confirm data is intact

Run the audit. Expect every artifact type the customer will see (FRD, EPIC, User Story, SubTask, FTC; LLD optional).

```powershell
cd ProjectSourceCode/backend
npx ts-node scripts/_audit-mod-artifacts.ts MOD-NN
```

**Pass criteria** — the table must show:

| Field | Expected |
|---|---|
| Module status | `EPICS_COMPLETE`, `STORIES_COMPLETE`, `SUBTASKS_COMPLETE` or `APPROVED` |
| `screens` | all screens have `fileData` (no `0 with fileData` rows) |
| FRD | exists with > 0 sections |
| EPIC | exists |
| USER_STORY | exists |
| SUBTASK | exists in `BaArtifact` AND `BaSubTask rows > 0` |
| FTC | exists with `BaTestCase rows > 0` |
| Project metadata | `productName`, `projectCode`, `clientName`, `submittedBy` all populated (cover page hard fields) |

**If audit fails**: see Remediation Recipes below.

---

## Step 2 — Pre-flight: confirm FRD feature structure

The FRD is the upstream foundation. If it's weak, FTC's per-feature screen cards, EPIC's feature references, and User Story / SubTask traceability all suffer.

```powershell
npx ts-node scripts/_compare-frd-versions.ts MOD-NN
```

**Pass criteria** for the *latest* FRD version:

| Field | Expected |
|---|---|
| Features | One unique F-NN-XX entry per screen-derived feature (commonly 5–15) |
| Screen-refs | Equal to (or > than) feature count — every feature must reference at least one screen |
| `not applicable` phrases | 0 (any `not applicable` indicates the LLM emitted placeholder content) |
| Total body length | ≥ 10 KB |

**MOD-04 baseline (good)**: 9 features, 9 screen-refs, 0 "not applicable".
**MOD-04 pre-fix (bad)**: 9 features, 1 screen-ref, 0 "not applicable" but 8 features had placeholder `Description: Not applicable / Screen Reference: Not applicable`. Watch for that pattern even when the `not applicable` count is 0 — the LLM phrases vary.

**Fix path if FRD is weak**: re-run SKILL-01-S (Remediation Recipe A).

---

## Step 3 — Take a targeted snapshot before any write operation

If Steps 1-2 reveal you need a skill re-run or data fix, capture the module's state for granular rollback.

```powershell
npx ts-node scripts/_snapshot-module.ts MOD-NN
```

Writes JSON to `backups/db-backup/module-snapshots/MOD-NN-<timestamp>.json` (typically 10-30 MB). Faster to read for diff/rollback than the full pg_dump.

**For a full DB-level safety net** (when the operation touches multiple modules or shared tables):

```powershell
$env:PGPASSWORD = "prd_secret"; pg_dump -h localhost -p 5432 -U prd_user -d prd_generator -F p -f "backups/db-backup/prd_generator-pre-<change>-$(Get-Date -Format yyyyMMdd-HHmmss).sql"
```

---

## Step 4 — Smoke-render every artifact type, both formats

```powershell
npx ts-node scripts/_smoke-export-all.ts MOD-NN --skip=LLD
```

(Drop `--skip=LLD` once LLD is in scope for this module.)

**Pass criteria** — all rows show `ok` and produce files in `%TEMP%`. Sample sizes for sanity:

| Artifact | PDF (typical) | DOCX (typical) | Render time budget |
|---|---|---|---|
| FRD | 0.5 – 5 MB | 3 – 25 MB | < 10 s |
| EPIC | 0.2 – 1 MB | 3 – 25 MB | < 5 s |
| USER_STORY | 1 – 10 MB | 3 – 25 MB | < 10 s |
| SUBTASK (rollup) | 5 – 50 MB | 5 – 30 MB | < 120 s |
| FTC | 1 – 10 MB | 3 – 25 MB | < 10 s |

DOCX sizes plateau around 22-25 MB once the "Referenced Screens" appendix saturates with all module screens; this is expected.

---

## Step 5 — Verify renderer integrity (no internal leaks, screen cards firing)

```powershell
npx ts-node scripts/_check-rendered-sections.ts
```

(Edit the script's `targets` array if you need to validate a different module pair.)

**Pass criteria**:

| Check | Expected |
|---|---|
| Top-level section labels | **NO `LEAK` tags** — `Step N`, `Output Checklist`, `Validate the FRD`, `Sign-Off`, etc. must NOT appear |
| FRD feature-screen-inline cards | ≥ count of features |
| FTC feature-screen-inline cards | ≥ count of features × test-case category count (Functional + Integration + Security + UI + Performance + White-Box). Roughly 6× features for a typical module. |

The Gap B internal-section filter was added in commit `4ac27d6` — if this check fails, ensure that commit is on the active branch.

---

## Step 6 — Eyeball the exports against MOD-05 baseline

Open these files side-by-side in browser (HTML/PDF) and Word (DOCX):

| MOD-05 baseline (validated good) | New module candidate |
|---|---|
| `mod-05-frd.{pdf,docx}` | `mod-NN-frd.{pdf,docx}` |
| `mod-05-epic.{pdf,docx}` | `mod-NN-epic.{pdf,docx}` |
| `mod-05-user_story.{pdf,docx}` | `mod-NN-user_story.{pdf,docx}` |
| `mod-05-subtask.{pdf,docx}` | `mod-NN-subtask.{pdf,docx}` |
| `mod-05-ftc.{pdf,docx}` | `mod-NN-ftc.{pdf,docx}` |
| `mod-05-subtask-sample-*.{pdf,docx}` | `mod-NN-subtask-sample-*.{pdf,docx}` |

**Visual parity checklist for each artifact pair:**

- [ ] **Cover page** — same brand: eyebrow (artifact type), big title (artifact ID), accent divider, project/module/client/submitter fields, status chip.
- [ ] **Table of Contents** — nested tree shape: section → feature/subsection. No flat lists.
- [ ] **Per-feature inline screen cards** — present under each `F-NN-XX` heading in FRD; present under each `F-NN-XX` category bucket in FTC. Captions show `SCR-NN — Screen Title`.
- [ ] **Internal processing absent** — no `Step 1`, `Step 5`, `Output Checklist`, `Sign-Off`, etc.
- [ ] **Section content quality** — no `Description: Not applicable`, no empty feature blocks, no truncated paragraphs.
- [ ] **Referenced Screens appendix** — full module screen catalog at end of doc, 2-column grid.
- [ ] **Status chip color** — APPROVED green / CONFIRMED blue / DRAFT grey / CONFIRMED-PARTIAL amber.
- [ ] **Fonts and spacing** — Calibri body, Consolas mono, accent color `#F97316`. Heading hierarchy clean.

---

## Common gaps and remediation recipes

### Recipe A — FRD has weak feature content (Gap A from MOD-04)

**Symptom**: features in FRD show "not applicable" descriptions, missing Screen Reference lines, only one fully-detailed sample feature with the rest as placeholders.

**Root cause**: FRD was generated with older SKILL-01-S prompts (before `wrapSkill01SPrompt` + `validateSkill01SOutput` hardening landed).

**Fix**:

1. Take MOD snapshot (Step 3).
2. POST to the running backend:
   ```powershell
   curl -X POST "http://localhost:4000/api/ba/modules/<moduleDbId>/execute/SKILL-01-S"
   ```
3. Poll the execution ID until `AWAITING_REVIEW` (~30-60 s).
4. Inspect the new FRD: `npx ts-node scripts/_compare-frd-versions.ts MOD-NN`.
5. **Critical**: confirm the new FRD has the **SAME feature ID set** as the old one. If feature IDs change, downstream EPIC / US / ST / FTC artifacts reference stale features. STOP and assess re-cascade scope.
6. Approve via `curl -X POST "http://localhost:4000/api/ba/executions/<executionId>/approve"`.
7. Re-smoke (Step 4) and re-check (Step 5).

**Verified working on MOD-04**: feature IDs F-04-01..09 stayed stable; screen-refs jumped from 1 to 9; downstream artifacts untouched.

### Recipe B — Internal processing leaks into PDF/DOCX (Gap B)

**Symptom**: `Step 1: Confirm Module Identity`, `Output Checklist`, `Validate the FRD` etc. appear as top-level sections in the export.

**Root cause**: `shouldOmitFromExport` filter (in `templates/artifact-internal-filter.ts`) not on the active branch.

**Fix**: ensure commit `4ac27d6` (or later containing it) is in the branch. The filter is single-source-of-truth; no per-renderer change needed.

### Recipe C — FTC missing per-feature screen cards (Gap C)

**Symptom**: FTC export shows the per-category appendix sections (`Functional Test Cases (N)`, `Integration Test Cases (M)`, etc.) but no inline screen thumbnail under each F-NN-XX feature bucket.

**Root cause**: The sibling FRD doesn't carry `Screen Reference: SCR-NN` lines per feature, so `loadFtcExtras` builds an empty `frdFeatureScreenRefs` map.

**Fix**: This is downstream of Gap A. Apply Recipe A — once the FRD has full feature content with screen refs, the FTC will pick them up on the next export (no FTC re-run needed; pure render-side lookup).

### Recipe D — A skill execution went into FAILED state

**Cause**: post-emission validator detected a contract violation. Look at `BaSkillExecution.errorMessage`.

**Fix**: read the error, apply the suggested fix (typically a re-run of the same skill — the prompt already enforces the contract). For unfamiliar violations: check `ba-skill-orchestrator.service.ts` for the skill's `validateSkillNNOutput` method.

### Recipe E — Module status enum is stale

**Symptom**: `moduleStatus` is `EPICS_COMPLETE` but the module has all downstream artifacts (LLD, FTC, SubTasks).

**Cause**: cosmetic — the status enum doesn't auto-advance after every skill. Doesn't block exports.

**Fix**: optional. Manually update `BaModule.moduleStatus` to `APPROVED` once you're satisfied with deliverables. The exports don't care.

### Recipe F — EPIC PDF/DOCX renders cover + empty TOC + screen catalog only (no body)

**Symptom**: The exported EPIC has cover, document history, an empty "Table of Contents" page, and the Referenced Screens appendix — but no actual EPIC body content (no Module Overview, Feature List, Feature Summaries, Integration Signals, etc.).

**Root cause**: The shared internal-section filter (`shouldOmitFromExport`) was applied artifact-agnostic in the original Step 1 fix. EPIC stores its entire deliverable as a single monolithic section labelled "Introduction" — that label matches the FRD-derived `INTERNAL_SECTION_REGEX` and was being stripped.

**Fix**: Already landed — `shouldOmitFromExport` now takes the artifact type as a second argument and only applies the internal-section label regex when `artifactType === 'FRD'`. Empty-body and preamble-only checks remain artifact-agnostic.

**Verification**: After re-rendering, the EPIC TOC must contain entries derived from the markdown headings inside the body section (Module Overview, Feature List, etc.). An empty TOC indicates this regression is back — check the call sites in `templates/artifact-html.ts` and `ba-artifact-export.service.ts` are passing `doc.artifactType` to the predicate.

---

## Skill defense status (workstream B)

| Skill | Forbidden Patterns | Orchestrator wrapper | Post-emission validator | Status |
|---|---|---|---|---|
| SKILL-00 | partial | n/a | — | OK |
| **SKILL-01-S** | ✅ | ✅ `wrapSkill01SPrompt` | ✅ `validateSkill01SOutput` (9-attribute contract) | **Hardened** |
| **SKILL-02-S** | ✅ | ✅ `wrapSkill02SPrompt` | ✅ `validateSkill02SOutput` (17-section EPIC) | **Hardened** |
| **SKILL-04** | ✅ | ✅ `callAiServiceSkill04PerFeature` focus override | ✅ `validateSkill04Output` (27-section user story) | **Hardened** |
| **SKILL-05** | ✅ | ✅ `executeSkill05ForStory` focused prompt | ✅ `validateSkill05Output` (25-section SubTask) | **Hardened** |
| SKILL-06-LLD | partial | — | — | LLD not yet in delivery scope |
| SKILL-07-FTC | partial | n/a (per-mode orchestrator) | — | Mode-2b idempotency provides indirect defense |

Every LLM-driven skill in the customer-delivery path (SKILL-01-S → SKILL-05) now has the 3-layer contract enforcement at generation time. LLD (SKILL-06) and FTC (SKILL-07-FTC) remain partial — out of current delivery scope.

## Render-side canonical restructurers (workstream A)

Defense-in-depth complementary to the generation-time validators above. Even if the LLM's output drifts in shape, the render pipeline re-shapes the artifact into canonical form before PDF/DOCX emission. The export is therefore stable across LLM versions and prompt drift.

| Artifact | Restructurer file | Canonical shape |
|---|---|---|
| FRD | `templates/frd-restructure.ts` | Features nested under canonical root + Business Rules / Validations / TBD-Future sibling sections |
| **EPIC** | `templates/epic-restructure.ts` | 19 top-level sections (EPIC Header + FRD Feature IDs + Sections 1–17) — split from monolithic Introduction body |
| **USER_STORY** | `templates/user-story-restructure.ts` | One section per US-NNN, sorted numerically, empty feature-group markers dropped, story names extracted where present |
| **SUBTASK** | `templates/subtask-restructure.ts` | One section per ST-USNNN-TEAM-NN, grouped by story, sorted (story → team alpha → seq), story captions preserved |
| FTC | `templates/ftc-restructure.ts` + `templates/ftc-structure.ts` | 16 canonical text sections + 6 synthetic category appendices synthesised from BaTestCase rows |
| LLD | partial (`pseudoFiles` appendix) | Narrative through generic render + BaPseudoFile rows as appendix |

The restructurers chain in `generateBaArtifactHtml`:

```
restructureFtcDoc(
  restructureFrdDoc(
    restructureEpicDoc(
      restructureUserStoryDoc(
        restructureSubtaskDoc(input)
      )
    )
  )
)
```

Each is a no-op when `artifactType` doesn't match — so callers chain unconditionally and only the relevant transformer runs.

---

## Going-forward decisions

For each new module *before* running the skill cascade:

1. Confirm the module's screens are catalogued in `BaScreen` with `fileData` populated.
2. Run the cascade via `scripts/checklists/run-cascade.ts` with `--validateExports=FRD,EPIC,USER_STORY,SUBTASK,FTC`.
3. Apply this checklist's Steps 1-6 once the cascade completes.
4. Eyeball against MOD-05 baseline.
5. If any gap surfaces that doesn't match an existing remediation recipe, **add a new recipe to this document** before shipping the module.

This checklist is a living document — every module's pilot is an opportunity to capture a new failure mode before it bites the next one.

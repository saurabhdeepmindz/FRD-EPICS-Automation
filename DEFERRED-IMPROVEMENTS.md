# Deferred Improvements

Cross-cutting improvements to the BA-Tool pipeline and UI that have been identified during module-by-module remediation but parked for a later session. Each entry includes the user-visible symptom, suspected root cause, and rough scope so a fresh session can pick it up cold.

Maintained chronologically; newest items at the top. Resolved items move to the **Done** section at the bottom (or are removed when committed).

---

## -1. MOD-04 FTC artifact — patch OWASP coverage gap via mode-2b backfill

**Symptom:** MOD-04's FTC artifact (`status=DRAFT`, 16 sections, 180 `BaTestCase` rows) was generated on 2026-04-25, **before** the per-mode SKILL-07 orchestrator (mode 2 / 2b / 2c / 3) existed. As a result it has uneven coverage:

- Only **18 / 180 TCs (10%)** carry an OWASP tag — well below what mode-2b's per-category pass produces for a new module.
- **0 `BaSkillExecution` rows** — the artifact was produced via a legacy single-shot path (or seeded), not via the current append-mode pipeline. The trace of *which mode produced what* is missing.
- Status is **DRAFT** — never approved through `POST /api/ba/artifacts/:id/approve`.
- Created when mode-2c (per-feature white-box) didn't exist either; the 82 white-box TCs in there came from a different code path with the same structural shape but unverified per-category coverage.

**Why it matters:** When MOD-05 / MOD-06 (and any new module) run `executeSkill07Complete`, mode-2b explicitly produces 8-15 TCs per missing OWASP / UI / Performance / Accessibility category. New modules will have richer coverage matrices than MOD-04 — making MOD-04 inconsistent with the rest of the portfolio.

**Scope (low-risk, additive only):**

1. Run `POST /api/ba/modules/:MOD-04-id/execute/SKILL-07-FTC/category/Security` (and similarly for `UI`, `Performance`, `Accessibility`, `Smoke`, `Regression` — whichever appear in `listMissingCategoriesForCoverage(MOD-04-id)`).
2. The orchestrator's `executeSkill07ForCategory` is idempotent — it skips any category that already has at least one TC. So categories already covered (e.g. Functional, Integration which MOD-04 has) are no-ops.
3. After mode-2b backfill, optionally run mode 3 (`POST /api/ba/modules/:id/execute/SKILL-07-FTC/narrative`) to refresh §10 OWASP Web Coverage Matrix with the new TC IDs.

**Risk:** None. All operations are additive — no existing TCs are deleted or modified. The 180 existing TCs stay as-is; only new category-prefixed TCs (TC-SEC-NNN, TC-UI-NNN, etc.) get appended.

**Acceptance:** After backfill, MOD-04's `BaTestCase.owaspCategory` non-null count rises from 18 to roughly the same percentage as MOD-05/06 produce on a clean run.

**First identified on:** 2026-05-04 — during the SKILL-07 alignment review prior to running the cascade for MOD-05.

---

## 0. Harden SKILL-05 with the same 3-layer defense applied to SKILL-02-S and SKILL-04 (Option B)

**Symptom:** SKILL-05 produces correct SubTasks for MOD-05 (63 stories → 276 BaSubTask, 21/21 RTM linked) and MOD-06 (in-flight at time of writing) under the current per-story append-mode loop. However, the skill is **not yet hardened** to the 3-layer defense standard now applied to SKILL-02-S (PR #3) and SKILL-04 (PR #4):

| Defense layer                                     | SKILL-02-S                   | SKILL-04                                | **SKILL-05**                                  |
| ------------------------------------------------- | ---------------------------- | --------------------------------------- | --------------------------------------------- |
| Prompt — Forbidden Patterns + self-check          | ✅                           | ✅                                      | ❌                                            |
| Orchestrator — focus override re-stating contract | n/a (single-shot)            | ✅ `callAiServiceSkill04PerFeature`     | ❌ per-story loop has no `wrapSkill05Prompt`  |
| Post-emission validator (fails exec on drift)     | ✅ `validateSkill02SOutput`  | ✅ `validateSkill04Output`              | ❌ NONE                                       |

**Why it matters:** Today's runs work because the LLM happens to honour the prompt's heading-depth rules. If a future run drifts — emits `###` instead of `####` for a Section 16 heading inside a SubTask body, or drops one of the 24 numbered sections — the parser would explode the SubTask into fragmented DB rows or quietly skip a section, and we'd only catch it at the checklist stage (or worse, downstream in SKILL-06-LLD / SKILL-07-FTC which read those sections).

**Scope (mirror SKILL-04 PR #4):**

1. **Prompt hardening** — `Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-05-create-subtasks-v2.md`
   - Add explicit "Forbidden Patterns" block listing the simplified-narrative shape, `###`-instead-of-`####` collisions, missing numbered sections.
   - Add "Self-check before responding" step (count `#### Section N` markers per SubTask; verify all 24 present).

2. **Orchestrator wrapper** — new `wrapSkill05Prompt` invoked from `executeSkill05ForStory` (lines ~1927+ of `ba-skill-orchestrator.service.ts`). Re-states the validator contract + heading-depth + forbidden patterns at the top of each per-story call, mirroring the SKILL-04 focus override.

3. **Post-emission validator** — new `validateSkill05Output` invoked from `runSkillAsync` Step 5d (after `aiResponse` is materialized but before AWAITING_REVIEW transition). For each `## ST-USNNN-TEAM-NN` block, count `#### Section N` markers 1..24 — fail the exec as `FAILED` if any SubTask is missing required sections.

4. **Checklist additions** — `scripts/checklists/skill-05.ts` already covers RTM linkage and BaSubTask count. Add a per-SubTask 24-section coverage check that iterates `BaArtifactSection` rows by `sectionKey ^st_us\d{3,}_` and counts `#### Section N` in each row's content.

**Acceptance criteria:** SKILL-05 cascade for MOD-04 (sync-sweep) + a fresh re-run on MOD-06 produces 7/7 + 24-section per-SubTask coverage 100%.

**First seen on:** SKILL-04 hardening landed via PR #4 (2026-05-02); SKILL-05 was deliberately left as Option C (defer hardening, accept current state since both MOD-05 and MOD-06 produced clean SubTask data).

**Risk:** None on current MOD-05/MOD-06 data. Hardening only blocks divergent FUTURE runs.

---

## 1. Word/PDF export formatting parity with preview view

**Symptom:** When a user generates a Word (.docx) or PDF export of an FRD/EPIC/User Story/SubTask artifact, the document layout differs noticeably from the in-app preview view. Cover page styling, fonts, section spacing, color theme, and overall presentation are not as polished as the preview.

**Why it matters:** The preview is what stakeholders see during review; the export is what they share/print/sign. They should be visually equivalent so the user doesn't have to apologize for "the export looks different."

**Suspected scope:**
- `ProjectSourceCode/backend/src/ba-tool/ba-export.service.ts` (or similar) — likely uses `docx` / `pdfkit` / `puppeteer` directly with bare-bones styling.
- `ProjectSourceCode/frontend/components/ba-tool/FrdArtifactView.tsx` and the preview page at `ProjectSourceCode/frontend/app/ba-tool/preview/[kind]/[id]/page.tsx` — these define the preview look (cover page, table-of-contents, feature cards) that the export should mirror.
- The cleanest fix is probably to render the preview HTML server-side (puppeteer) and convert to PDF, then mirror the same layout in the docx generator. Alternatively, define a single shared "FRD layout spec" that both viewers read from.

**First seen on:** MOD-06 (2026-05-02). User reported the Word export's cover page, table-of-contents, and section spacing differ from the in-app preview.

**Suggested follow-up session approach:**
1. Eyeball the current export vs preview side-by-side for FRD, EPIC, User Story, SubTask. Document the gaps.
2. Decide: HTML-to-PDF via puppeteer (preview parity guaranteed) vs. native docx/pdfkit with explicit style spec (more work but portable).
3. Pilot on FRD first (highest user-visible) then propagate to the other artifact types.

---

## 2. Word/PDF export — embed screen thumbnails per-feature inline

**Symptom:** Word/PDF exports of an FRD currently show a single "Referenced Screens (N)" section near the top of the document listing every screen as a flat list with thumbnail. Each feature's body has a "Screen Reference: SCR-NN — Title" text reference but no thumbnail next to it.

The in-app editor view, by contrast, renders each feature's referenced screen thumbnail **inline under that feature's body**, which is much easier to scan when reviewing per-feature.

**Why it matters:** Reviewers reading a feature shouldn't have to scroll back up to "Referenced Screens" to see what the feature relates to. The export is also commonly printed/shared; flat thumbnail dumps don't scale.

**Suspected scope:**
- Same export pipeline as item #1.
- The export likely runs once at the document level and emits screen thumbnails as a single block. Need to refactor to walk per-feature and emit each feature's screen(s) inline.
- The screen-to-feature mapping is already there: `feature.screenRef` carries `SCR-NN — Title`, and `BaScreen` rows have the image URL. Just need to thread the lookup through the renderer.

**First seen on:** MOD-06 (2026-05-02). User compared MOD-05 editor view (per-feature thumbnails inline ✓) to MOD-06 Word export (grouped at top ✗).

**Suggested follow-up session approach:**
1. Locate the export's feature-rendering loop.
2. For each feature, look up its screen via `screenRef` and emit the thumbnail inline before the feature body.
3. Drop or shrink the standalone "Referenced Screens" section (keep as appendix if useful).

---

## 3. Backend cleanup of legacy `handoff_packet_json` artifact sections (MOD-01, 02, 03, 04, 05)

**Symptom:** Modules whose SKILL-01-S ran *before* the `parseAiOutput` strip-fix may have a leftover `handoff_packet_json` section in their FRD artifact. The section is invisible to the user via the preview filter we now have, but it duplicates ~14 KB of data already stored in `BaSkillExecution.handoffPacket` and bloats artifact rows.

**Why it matters:** Storage hygiene. If we ever re-render the artifact via a renderer that doesn't have the preview filter, the JSON would resurface.

**Scope:** Run the existing `scripts/_strip-handoff-packet-section.ts <MOD-NN>` for each pre-fix module: MOD-01, MOD-02, MOD-03, MOD-04, MOD-05.

**First seen on:** MOD-06 (2026-05-02). The fix for the live MOD-06 issue exposed that other modules might have the same leftover section.

**Risk:** None — the JSON is preserved in `BaSkillExecution.handoffPacket`. Only the redundant artifact section is removed.

---

## 4. EPIC tree "INTERNAL PROCESSING" mis-classification

**Symptom:** When viewing an EPIC artifact in the BA-tool tree, sections that the LLM labeled with leading numbers (`1. **Module Overview**`, `2. **Feature List...**`, `3. **Feature Summaries**`, etc.) get classified as "INTERNAL PROCESSING" rather than as deliverable sections. The data is correct — it's only the tree grouping that's misleading.

**Root cause:** The frontend's `INTERNAL_SECTION_REGEX` in `FrdArtifactView.tsx` likely matches the leading-number pattern (`/^\d+\. /` or similar) which catches both legitimate "Step N: ..." processing labels (which ARE internal) and EPIC's canonical numbered section headings (which are NOT internal).

**First seen on:** MOD-06 (2026-05-02). The EPIC's standard 9-section structure (Module Overview, Feature List, Feature Summaries, Integration Signals, Business Rules, Traceability, Summary Table, Conclusion) appeared under "INTERNAL PROCESSING" in the artifact tree.

**Suggested follow-up:** Review the regex in `FrdArtifactView.tsx`. The fix is to make the internal classification match `step_*` / `step-N` keys specifically rather than any leading-digit pattern, OR to maintain an explicit allowlist of EPIC's canonical section labels.

**Risk:** None. Cosmetic only.

---

## 5. Phase A cleanup script should also remove orphaned `BaSkillExecution` records

**Symptom:** When `_cleanup-mod06-broken.ts` (or any module's Phase A cleanup) deletes an artifact (e.g. USER_STORY) but preserves the historical execution records, the UI subsequently shows misleading status badges. Specifically: a SKILL-04 BaSkillExecution from a prior approved run still has `status=APPROVED` after its USER_STORY artifact is deleted, so the BA-tool UI renders "User Stories — Approved" with the old timestamp even though no artifact exists.

**Root cause:** The cleanup script comment says it "preserves historical skill execution records" — that's good for audit trail but creates UI lies when the corresponding artifact is gone. The UI's "latest skill execution status per module" query has no way to know the artifact was wiped.

**Suggested follow-up:** Update the Phase A cleanup pattern to also delete (or mark FAILED) any `BaSkillExecution` rows for skills whose artifact type was just deleted. Generic helper `_cleanup-orphan-executions.ts` could sweep across all modules. Either approach removes the misleading-badge class entirely.

**First seen on:** MOD-06 (2026-05-02). Stale 4/30 SKILL-04 execution was manually deleted via a one-off script after the UI showed "User Stories — Approved" badge with the old timestamp; corresponding USER_STORY artifact had been wiped in Phase A.

**Risk:** Low. Loses some audit trail history, but only for executions whose artifacts are already gone — the trace is broken anyway.

---

## 6. SkillExecutionPanel doesn't pick up AWAITING_REVIEW execution after a Phase A cleanup + re-run

**Symptom:** After we wipe a SKILL-02-S execution + EPIC artifact (Phase A cleanup) and re-run SKILL-02-S, the new execution lands in `AWAITING_REVIEW` in the DB, but the BA-tool UI's right pane keeps showing the pre-execution state ("Complete the previous step first" / "Run EPIC Generation"). The "Approve & Continue" green button never appears, even after a normal browser refresh, and even Ctrl+Shift+R sometimes doesn't help. Approval has to fall back to a direct API call (`POST /api/ba/executions/:id/approve`).

**Root cause (preliminary):** The page's local React state for `mod` is fetched once on initial load. The `latestExecution` `useMemo` filters `mod.skillExecutions` by skillName and picks `[0]` (newest). If `mod.skillExecutions` doesn't include the new execution because the cached fetch predates it, the panel sees `execution=null` AND `canStartStep` returns false (because module status has already advanced past this skill's "ready" step), so the fallback "Complete the previous step first" message renders. Suspected fixes:

- Re-fetch `mod` automatically when the user clicks a different pipeline tile, OR
- Add a manual "refresh module" button somewhere visible, OR
- Have `useSkillExecution` poll the executions endpoint directly when its `existingExecution` is null but the module status suggests the skill should have run, OR
- Disable HTTP caching headers on the `/api/ba/modules/:id` endpoint so even soft refreshes pick up new state.

**First seen on:** MOD-06 (2026-05-02). Hit again on MOD-04 and MOD-05 the same session — only the API approval fallback worked.

**Workaround:** `curl -X POST http://localhost:4000/api/ba/executions/<execId>/approve` from a terminal.

**Risk:** None data-side. UX issue only. But it consistently blocks UI-based approval after any Phase A regen, so worth fixing before the next module's review cycle if multiple users are doing this work.

---

## Done

(items move here once shipped)

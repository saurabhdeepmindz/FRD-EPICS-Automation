# Deferred Improvements

Cross-cutting improvements to the BA-Tool pipeline and UI that have been identified during module-by-module remediation but parked for a later session. Each entry includes the user-visible symptom, suspected root cause, and rough scope so a fresh session can pick it up cold.

Maintained chronologically; newest items at the top. Resolved items move to the **Done** section at the bottom (or are removed when committed).

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

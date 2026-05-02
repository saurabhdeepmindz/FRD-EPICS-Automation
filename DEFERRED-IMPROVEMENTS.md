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

## Done

(items move here once shipped)

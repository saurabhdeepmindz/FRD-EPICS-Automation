# Deferred Improvements

Cross-cutting improvements to the BA-Tool pipeline and UI that have been identified during module-by-module remediation but parked for a later session. Each entry includes the user-visible symptom, suspected root cause, and rough scope so a fresh session can pick it up cold.

Maintained chronologically; newest items at the top. Resolved items move to the **Done** section at the bottom (or are removed when committed).

---

## -4. LLD Workbench — "Copy config from another module" in-app feature

**Status (2026-05-15):** Captured for future work. Triggered when MOD-06 LLD config was empty and had to be copied from MOD-04 via a manual `PUT /api/ba/modules/<id>/lld/config` curl. The architect's normal workflow is to pick stacks / templates / NFRs per module from dropdowns; when a project has many modules sharing the same target stack, doing that picking N times per module is tedious and error-prone.

**Symptom:** A new module's LLD Workbench (`/ba-tool/project/<projectId>/module/<moduleDbId>/lld`) opens with every Tech Stack / Templates / NFR field set to `(none — use AI best practices)`. The architect must walk through 7 dropdowns + 4 NFR fields manually, even when an existing module in the same project already has the exact right configuration.

**Workflow today:** Manual per-module configuration via the dropdowns, OR ad-hoc curl that copies the full `BaLldConfig` row across modules (one-off, no UI).

**Proposed feature:** Add a "Copy from…" control next to the **Save selections** button at the top right of the LLD Workbench page. UX:

1. Click `↗ Copy from another module` → dropdown listing every module in the same project that already has a populated `BaLldConfig` (frontendStackId or backendStackId not null).
2. Each row shows `MOD-XX — <moduleName>  ·  <stack summary, e.g. "NestJS + Next.js + Postgres + Redis">`.
3. Pick a source module → form fields pre-fill with the source's values (frontend/backend/db/streaming/caching/storage/cloud/architecture stack IDs, all 4 template IDs, codingGuidelinesId, NFR values, customNotes, narrative). Architect can then tweak any field and Save.
4. **No DB write** until Save — same flow as today.

**Backend scope:**

- New endpoint `GET /api/ba/projects/:projectId/lld-configs/summary` → returns one row per module with `{ moduleDbId, moduleId, moduleName, hasConfig, stackSummary, configId }`. Fast project-scoped query; sub-second.
- Optionally a `POST /api/ba/modules/:targetModuleId/lld/config/clone-from/:sourceModuleId` shortcut that does the copy server-side — but the simpler path is have the frontend GET the source config and prefill the form locally, then PUT to save as today. No new mutation endpoint needed.

**Frontend scope:**

- New dropdown / popover above the Tech Stack section.
- Calls the summary endpoint on open.
- On select → fetch source's full config via existing `GET /api/ba/modules/:id/lld/config`, prefill the form, leave Save behaviour unchanged.

**Risk:** Low. Frontend-only state change until Save. Same `BaLldConfig` schema. No migration.

**Effort:** ~3-4 h (1 backend endpoint, 1 frontend popover component, prefill plumbing). Could be smaller if we skip the per-module summary endpoint and just list ALL modules in the project (frontend fetches each module's config on hover/click; lazier but works).

**Acceptance:** An architect opens MOD-07's LLD Workbench, clicks `Copy from MOD-04`, picks MOD-04 from the list, the 7 stack dropdowns + 4 NFR fields populate to MOD-04's values, the architect clicks **Save selections**, and the page shows the saved state on reload.

**First identified on:** 2026-05-15 — during the LLD pipeline run for MOD-06, where MOD-04's `nestjs-next-js-and-tailwind` config had to be hand-copied via curl because the UI offered no shortcut.

---

## -3. SKILL-07-FTC story-coverage gap-filler — close the per-feature → per-story drop

**Status (2026-05-15):** Captured for future work. Decision recorded 2026-05-04 / re-affirmed 2026-05-15 to **accept the 76% gap on MOD-05** (15 / 63 stories without a dedicated happy-path TC) rather than block the SKILL-07 cascade for MOD-05 + MOD-06. The fix is non-trivial and structural; the current data shape is consistent with what new modules will produce, so deferring is the right trade-off.

**Symptom (verbatim from the 2026-05-04 MOD-05 cascade post-checks):** MOD-05's SKILL-07 cascade produced 156 TCs across 21/21 features. Post-check 4 reports `Every user story has >= 1 happy-path test case — 48/63 covered; missing: US-113, US-120, US-131, US-132, US-134, +10 more`. So 15 stories have no dedicated happy-path TC.

**Root cause:** mode-2 (per-feature, the loop that produced the bulk of the TCs) emits TCs *scoped to features*. Each TC's `linkedStoryIds` array is populated by the AI's choice of which stories that TC implicitly covers. Some features had only 3–5 TCs total — not enough to emit one happy-path TC per story under that feature (avg 3 stories/feature for 63 stories / 21 features).

This is **a quality gap, not a structural break:**

- All 21 features have ≥ 1 TC ✅
- Negative TCs healthy (88 / 156 = 56%) ✅
- All 14 canonical narrative sections rendered ✅
- 156 TCs structurally well-formed per the parser contract ✅
- 15 stories don't appear in any TC's `linkedStoryIds` ❌

**Why it matters:** SKILL-07's checklist (`scripts/checklists/skill-07.ts`) expects per-story happy-path coverage as a 100% bar. Until this is closed, every new module's SKILL-07 cascade will likely fail post-check 4 the same way — making the checklist noisy and obscuring genuine structural regressions.

**Three fix options (from the 2026-05-04 recommendation):**

1. **`executeSkill07ForStory` sub-mode (preferred long-term).** New orchestrator method that takes `(moduleDbId, storyId)`, focuses the AI on that one story, emits 2–3 TCs (happy + at least 1 negative + optional edge), and tags `linkedStoryIds=[storyId]`. Wire into `executeSkill07Complete` as a post-mode-2 gap-filler that runs only for stories without a happy-path TC. Mirrors the SKILL-05 per-story pattern.

2. **Gap-filler that re-fires mode-2 with explicit story-coverage requirements.** Inspect which stories are uncovered, group them by feature, then re-call `executeSkill07ForFeature` with a focus override naming the missing stories ("ensure each of these stories has a happy-path TC: US-113, US-120, ..."). Risk: may regress existing TCs (mode-2 is idempotent per-feature but not per-story).

3. **Soften the post-check threshold** (e.g. 70% or "≥1 TC links to the story in any way"). Quickest, but gaming the metric — only acceptable if 100% is genuinely the wrong bar.

**Recommended approach:** Option 1 (new `executeSkill07ForStory` method). Per-story sub-mode is the natural extension of the existing per-feature / per-category / per-feature-white-box family. Idempotency is straightforward (skip stories that already have a happy-path TC). Aligns with how SKILL-05 closed its per-story coverage.

**Acceptance:** After the gap-filler runs on MOD-05, post-check 4 reports `63/63 covered`. Re-running on MOD-06 (and any future module) is a no-op when mode-2 happens to cover everything; fires only when stories are missing.

**Risk:** None for the data already captured — MOD-05's 156 TCs stay as-is. The new sub-mode appends `TC-S-USNNN-NNN` (or similar story-prefixed) TC IDs alongside the existing feature-prefixed ones.

**First identified on:** 2026-05-04 during MOD-05 SKILL-07 cascade post-checks. User decision 2026-05-04: accept 76% (Option 1 of the three options offered at the time), document the point clearly for recollection. Re-affirmed 2026-05-15 during session resume.

---

## -2. LLD RTM impl-status workflow — advance beyond Option A (CSV companion)

**Status (2026-05-15):** Workstream-3 Option A landed on branch `feat/export-parity-frd-pilot`, commit `5528960`. The RTM bundle now includes `LLD-MOD-NN-rtm-impl-status.csv` — a starter template the dev team downloads, edits as they implement files, and keeps in git alongside the codebase.

**What's working today (Option A):** Each LLD bundle ZIP contains an impl-status CSV pre-populated with one row per pseudo-file: `Feature, UserStory, SubTask, Folder, FilePath, design_status, impl_status, note, updated_by, updated_at`. `design_status` is auto-derived (Done / ToDo); `impl_status` starts at ToDo and devs maintain it manually. The CSV lives in the project's repo; no DB writes, no sync logic.

**Why advance:** Option A is per-machine / per-dev. The HTML RTM viewer can't see manual edits to the CSV because it ships separately. Three forward paths from the original design discussion:

- **Option B — Inline status UI in the HTML.** Add an editable status column to the RTM HTML viewer; saves to `localStorage` on the dev's machine. Optionally exports back as updates. Tradeoff: per-dev tracking, no DB writes, doesn't survive cross-machine.

- **Option C — Persist in BA-Tool DB.** New `BaImplementationStatus` table keyed by `(artifactDbId, subtaskId, filePath)`; UI in BA-Tool to update; the RTM HTML viewer loads it via a fetch and overlays the manual `impl_status` on top of the auto-derived `design_status`. Tradeoff: multi-user / team tracking, persists in DB, biggest scope.

- **Option D — Git-scan auto-derive.** Periodic CI job greps the real codebase for files matching the LLD path conventions; updates `impl_status` automatically (PR opened, merged, etc.). Tradeoff: true "code exists" signal, zero manual update overhead, but needs CI hookup and path-mapping logic between `LLD-PseudoCode/backend/service/foo.service.ts` and the real `src/modules/.../FooService.ts`.

**Trigger to revisit:** when the dev team starts using the impl-status CSV in anger and the manual-edit workflow becomes a pain point — typically once 3+ devs are working off the same module's RTM, OR when status tracking needs to surface in dashboards.

**Scope when picked up (recommended Option C):**

1. Add `BaImplementationStatus` Prisma model: `id, artifactDbId, subtaskId, filePath, implStatus (enum: ToDo | WIP | Done | Failed | Blocked), note, updatedBy, updatedAt`.
2. New endpoints under `BaLldController`:
   - `GET  /api/ba/artifacts/:id/rtm-impl-status` → returns merged design+impl status JSON for the RTM HTML to fetch
   - `PATCH /api/ba/artifacts/:id/rtm-impl-status/:subtaskId/:filePath` → updates one row
3. Extend `BaLldRtmService.emitHtml` to inject a fetch-on-load that overlays manual impl_status on the auto-derived rows.
4. Keep the standalone CSV export working (Option A) — it's still the offline-friendly format for customer hand-off.

**Risk:** Low for B (frontend-only, localStorage). Medium for C (Prisma migration, new endpoints). Higher for D (CI integration + path mapping is project-specific).

**Acceptance criteria (Option C):** A dev updates `impl_status` for `ST-US053-BE-01 / research-chat.service.ts` to `WIP`; refreshes the RTM HTML; the row shows the `WIP` badge and the dev's name in the updated_by column.

**First identified on:** 2026-05-15 — during the LLD RTM design discussion, immediately after Option A shipped.

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

## 0. ~~Harden SKILL-05 with the same 3-layer defense applied to SKILL-02-S and SKILL-04~~ — ✅ RESOLVED 2026-05-14

**Status (2026-05-14):** Resolved on branch `feat/export-parity-frd-pilot`, commit `e147845`. All three layers in place:

- **Layer 1 (prompt):** Forbidden Patterns + Self-check sections added to `Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-05-create-subtasks-v2.md`.
- **Layer 2 (orchestrator):** `executeSkill05ForStory`'s `focusedPrompt` now carries the Forbidden Patterns + Self-check blocks inline so the contract is re-stated at the top of every per-story call.
- **Layer 3 (validator):** New `validateSkill05Output()` invoked from `runSkillAsync` Step 5d. Splits humanDocument on `## ST-USNNN-TEAM-NN` headings, counts `#### Section N` markers (N=1..25) per SubTask, fails the exec on any incomplete coverage.

Defense applies to all future SKILL-05 runs (MOD-06 onwards). Existing MOD-04 / MOD-05 SubTask data is NOT being re-generated — the current data was approved manually and is preserved. Should a future re-run be needed, the validator will catch any drift from the canonical 25-section template.

---

### Original problem (preserved for context)

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

## 1. ~~Word/PDF export formatting parity with preview view~~ — ✅ RESOLVED (workstream A complete) 2026-05-14

**Status (2026-05-14):** All 5 customer-facing artifact types now have render-side canonical-shape restructurers PLUS upstream generation-time validators. Pilot landed on branch `feat/export-parity-frd-pilot`. MOD-04 + MOD-05 verified end-to-end. Module-level delivery runbook at `MODULE-DELIVERY-CHECKLIST.md`.

**Per-type canonicalization status:**

| Artifact | Render-side restructurer | Generation-side validator | Commit |
|---|---|---|---|
| FRD | `frd-restructure.ts` (pre-existing) | `validateSkill01SOutput` (pre-existing) | (existing) |
| EPIC | `epic-restructure.ts` | `validateSkill02SOutput` (pre-existing) | `b81bc1c` |
| USER_STORY | `user-story-restructure.ts` | `validateSkill04Output` (pre-existing) | `4f91724` |
| SUBTASK | `subtask-restructure.ts` | `validateSkill05Output` (this session) | `4e83aee` + `e147845` |
| FTC | `ftc-restructure.ts` (pre-existing) | mode-2b idempotency | (existing) |

Rollback anchor `pre-export-pilot-v1`; DB snapshot `backups/db-backup/prd_generator-pre-canonical-20260514-141231.sql`.

**Resolved gaps surfaced during MOD-04 review (2026-05-14):**

- **Gap A — MOD-04 FRD weak feature content.** Old FRD had 9 features but only 1 Screen Reference; rest were placeholder "Not applicable". Re-running SKILL-01-S with the hardened prompt produced 9 features × 9 screen-refs, feature IDs F-04-01..09 stable. No downstream re-cascade needed.
- **Gap B — Internal-processing leaks in PDF/DOCX exports.** Frontend `INTERNAL_SECTION_REGEX` was not mirrored on the export side. Fixed via shared `templates/artifact-internal-filter.ts` consumed by both renderers (commit `4ac27d6`).
- **Gap C — FTC missing per-feature inline screen cards (MOD-04).** Downstream of Gap A — the FTC injector reads `Screen Reference` lines from the sibling FRD's features. Fixing Gap A automatically populated MOD-04 FTC with 81 per-feature screen cards across the 6 category appendix sections.
- **Gap D — EPIC body stripped by the internal-section filter regression.** Step 1's filter applied to ALL artifact types stripped EPIC's monolithic "Introduction" section (matched the FRD-derived regex). Fixed via artifact-type-aware filter (commit `44b56db`); regex only applies to FRD now.
- **Gap E — Long-term EPIC/USER_STORY/SUBTASK render-side canonicalization.** These previously relied entirely on upstream skill validators. Now have per-type render-side restructurers (commits `b81bc1c`, `4f91724`, `4e83aee`) so the export is canonical regardless of LLM output drift.

---

### Original problem (preserved for context)

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

# Sprint v5 — Tasks: Bidirectional Sync — Requirement Change Impact · Code-to-Upstream Propagation · Sync Agent

## Status: ➖ Superseded — not executed as a standalone sprint. Track I delivered (I-01/I-02 + I-03 via v6 FreshnessBanner); Tracks J/L delivered differently via Track P (P-04/P-05 dynamic-file upstream sync) + v6 forward propagation; M-06 done in v6 (S-03). Only the optional LLM `/sync-analyze` (L-03) remains. See BACKLOG Tracks I/J/L + sprints/v6.

> **Backlog traceability:** I-01–I-03 (Track I) → J-01–J-04 (Track J) → L-01–L-06 (Track L) → M-06
>
> **Sequencing note:** Phase 1 (I) can ship independently. Phase 2 (J) depends only on existing `BaPseudoFile`. Phase 3 (L) depends on Phase 2 + L-03 Python endpoint.

---

## Phase 1 — Requirement Change Impact (Track I)

### P0 Backend

- [ ] **Task 1: `BaChangeImpactService` — detect downstream impact when PRD+FRD section is edited** (P0-BE)
  - Acceptance:
    - Service exposes `computeImpact(projectId, sectionKey, oldText, newText): ChangeImpactMap`
    - Queries all `BaRtmRow` rows for the project; finds rows where `frdFeatureIds` contains the changed FRD feature ID (derived from `sectionKey` by pattern e.g. `6_1_features → FR-…`) **or** where the row's free-text content (stored RTM references) mentions the changed section key
    - Groups impacted rows into `{ impactedEpics[], impactedUserStories[], impactedSubtasks[], impactedLldSections[] }` by `artifactType` + `artifactId`
    - Stores the result in `BaProjectPrd.metadata.changeImpact[sectionKey]` with `detectedAt` ISO timestamp
    - Returns the map
    - No-op when `oldText === newText`
  - Algorithm:
    1. Derive FRD feature IDs from `sectionKey` (e.g. `6_1_features` → scan the PRD section JSON for feature IDs like `FR-AUTH-001`)
    2. Query: `SELECT * FROM ba_rtm_rows WHERE project_id = $1 AND (frd_feature_ids && $2 OR epic_ids IS NOT NULL)`
    3. Group by the artifact type field; dedupe IDs
    4. Merge into existing `metadata.changeImpact` (not overwrite whole metadata)
    5. Save via `prisma.baProjectPrd.update`
  - Files: `backend/src/ba-tool/pipeline/ba-change-impact.service.ts` (new), `backend/src/ba-tool/pipeline/pipeline.module.ts` (register)
  - Effort: S

- [ ] **Task 2: Wire change-impact detection into PRD section save + expose GET endpoint** (P0-BE)
  - Acceptance:
    - `PATCH /api/ba/projects/:id/project-prd/section` (existing endpoint in `ProjectPrdService`) calls `BaChangeImpactService.computeImpact` after saving the section
    - New endpoint `GET /api/ba/projects/:id/change-impact` returns the full `changeImpact` map from `BaProjectPrd.metadata`; returns `{}` when no impact computed yet
    - Wire both into `BaPipelineController` (or the existing `PipelineController` if that's the naming)
  - Algorithm:
    1. In `ProjectPrdService.updateSection`: after `prisma.baProjectPrd.update`, call `changeImpactService.computeImpact(...)` asynchronously (fire-and-forget — don't block the save response)
    2. Add `GET /change-impact` route to `PipelineController`
  - Files: `backend/src/ba-tool/pipeline/project-prd.service.ts`, `backend/src/ba-tool/pipeline/pipeline.controller.ts`
  - Effort: XS

- [ ] **Task 3: `BaRtmDiskExportService` — write RTM + change-impact report to disk** (P0-BE)
  - Acceptance:
    - Service exposes `exportToDisk(projectId)` which writes two files:
      - `ProjectArtifacts/10-RTM/RTM.md` — full RTM as a Markdown table (columns: ID, Module, Feature, EPIC, User Story, SubTask, LLD Section, Exec Status, Sprint)
      - `ProjectArtifacts/10-RTM/RTM.csv` — same data as CSV (double-quoted fields)
      - `ProjectArtifacts/10-RTM/ChangeImpact.md` — if `changeImpact` data exists, a second file listing affected artifacts per changed section
    - Appends a CHANGELOG entry: "RTM exported to disk (N rows) + change-impact report"
    - Triggered by new endpoint `POST /api/ba/projects/:id/rtm/export-to-disk`
    - Also auto-triggered when `BaSkillOrchestratorService.getProjectRtm` is called (best-effort, non-blocking)
  - Algorithm:
    1. Fetch all `BaRtmRow` rows for the project (the existing `getProjectRtm` query already does this enriched)
    2. Render as Markdown table + CSV using template literals
    3. Write via `ProjectFolderService.writeArtifactFile('10-RTM', 'RTM.md', content)` and same for CSV
    4. Read `changeImpact` from latest `BaProjectPrd.metadata`; if non-empty, render a Markdown impact report
    5. Call `appendChangelog(projectId, ...)`
  - Files: `backend/src/ba-tool/pipeline/ba-rtm-disk-export.service.ts` (new), `backend/src/ba-tool/pipeline/pipeline.controller.ts` (new route), `backend/src/ba-tool/pipeline/pipeline.module.ts`
  - Effort: S

### P0 Frontend

- [ ] **Task 4: RTM page — change-impact banner + per-row impact badges** (P0-FE)
  - Acceptance:
    - When `GET /api/ba/projects/:id/change-impact` returns non-empty data, a yellow info banner appears above the RTM table: "⚠ Requirement changes detected. N EPICs, M User Stories, P LLD sections may need review. [Export RTM + Impact Report]"
    - Clicking "Export RTM + Impact Report" calls `POST /api/ba/projects/:id/rtm/export-to-disk` and shows a toast with the output path
    - Each RTM row affected by a change shows a yellow ⚠ icon in the "Status" column, with a tooltip listing which section was changed
    - Banner is dismissible per session (localStorage flag); re-appears if new changes are detected
  - Files: `frontend/app/ba-tool/project/[id]/rtm/page.tsx`, `frontend/lib/pipeline-api.ts` (new helper `getChangeImpact`, `exportRtmToDisk`)
  - Effort: S

---

## Phase 2 — Code-to-LLD Sync (Track J)

### P0 Backend

- [ ] **Task 5: `BaSyncLldService` — diff + pull ProjectSourceCode changes into BaPseudoFile** (P0-BE)
  - Acceptance:
    - `getDiff(moduleDbId): LldSyncDiffResult` — reads every `BaPseudoFile` for the module; for each, reads the corresponding `ProjectSourceCode/{path}` file from disk; computes a unified diff (changed lines only); returns `{ changed: DiffEntry[], unchanged: number, missing: string[] }` where `missing` lists pseudo-file paths that no longer exist on disk
    - `syncFromCode(moduleDbId): SyncResult` — for each changed file in the diff, updates `BaPseudoFile.editedContent` with current disk content and sets `isHumanModified = true`; for `missing` files, leaves `editedContent` unchanged but sets a `syncMissing` flag in metadata; appends CHANGELOG entry "LLD synced from code for module MOD-XX: N files updated, M missing"
    - Skips files where `isHumanModified = true` and the disk content matches `editedContent` exactly (already in sync)
  - Algorithm:
    1. Load all `BaPseudoFile` rows for `moduleDbId`
    2. For each, construct the absolute disk path via `ProjectFolderService.getSourcePath(projectId, pseudoFile.path)`
    3. Read disk file (UTF-8); if missing, mark as `syncMissing`; if present, compute line diff
    4. On `syncFromCode`, batch-update changed rows via `prisma.baPseudoFile.updateMany` (one tx)
    5. Append changelog via `ProjectFolderService.appendChangelog`
  - Files: `backend/src/ba-tool/pipeline/ba-sync-lld.service.ts` (new), `backend/src/ba-tool/pipeline/pipeline.module.ts`
  - Effort: M

- [ ] **Task 6: Expose sync-diff + sync-from-code endpoints; wire triggeredBy (M-06)** (P0-BE)
  - Acceptance:
    - `GET /api/ba/modules/:id/lld/sync-diff` returns `LldSyncDiffResult`
    - `POST /api/ba/modules/:id/lld/sync-from-code` executes the sync and returns `SyncResult`
    - Both endpoints call `BaSyncLldService`; module lookup uses the existing `moduleDbId` pattern
    - **M-06 wiring (bundled here to avoid separate PR):** In `ProjectPrdService.generate`, `HldService.generate`, and `BaSkillOrchestratorService.executeSkill` (for all 7 skills), set `triggeredBy` and `sourceArtifactVersions` on the artifact/prd/hld row at creation time:
      - `INITIAL_GENERATION` — first generation from scratch
      - `MANUAL_EDIT` — triggered by a section edit (already has `MANUAL_EDIT` constant from M-02)
      - `sourceArtifactVersions` — read from the latest sibling artifacts at generation time (e.g. `{ prdVersion: latestPrd.version, hldVersion: latestHld.version }`)
  - Files: `backend/src/ba-tool/pipeline/pipeline.controller.ts`, `backend/src/ba-tool/pipeline/project-prd.service.ts`, `backend/src/ba-tool/pipeline/hld.service.ts` (or wherever HLD lives), `backend/src/ba-tool/ba-skill-orchestrator.service.ts`
  - Effort: S

### P0 Frontend

- [ ] **Task 7: LLD page — "Sync LLD from Code" button + diff panel** (P0-FE)
  - Acceptance:
    - The AI LLD Workbench page (`/ba-tool/project/[id]/module/[moduleId]/lld`) gains a new **"Sync from Code"** outline button in the header (between "Export Unit Tests" and "Save")
    - Button is disabled with tooltip "No ProjectSourceCode scaffold yet" when `BaProjectImplementation` has no scaffold
    - On click: calls `GET .../lld/sync-diff` → shows a modal with 3 tabs: **Changed** (N), **Unchanged** (N), **Missing** (N)
      - "Changed" tab lists file paths with a mini diff (old line in red, new line in green, max 10 lines shown, "…N more" if truncated)
      - Footer: [Cancel] and [Apply N changes] buttons
    - On "Apply N changes": calls `POST .../lld/sync-from-code`; closes modal; shows a toast "N pseudo-files updated from ProjectSourceCode"
    - Implementation page "Sync to Upstream" button (Task 9) also appears here as a second CTA in the toast
  - Files: `frontend/app/ba-tool/project/[id]/module/[moduleId]/lld/page.tsx`, `frontend/components/ba-tool/SyncLldDiffModal.tsx` (new), `frontend/lib/ba-api.ts` (new helpers `getLldSyncDiff`, `syncLldFromCode`)
  - Effort: M

---

## Phase 3 — Sync Agent (Track L)

### P0 Backend

- [ ] **Task 8: Python AI Service — `/sync-analyze` endpoint** (P0-AI)
  - Acceptance:
    - New `POST /sync-analyze` endpoint in `main.py`
    - Input: `{ changedFiles: [{ path, beforeSnippet, afterSnippet }], prdSections: [{ key, label, contentSummary }], hldSections: [{ key, label, contentSummary }] }`
    - Uses OpenAI `gpt-4.1` (same model as all other BA endpoints) with `response_format={"type":"json_object"}`
    - Output: `{ impactedPrdSections: [{key, reason, proposedChange}], impactedHldSections: [{key, reason, proposedChange}], changelogEntry: string, confidence: "high"|"medium"|"low" }`
    - `proposedChange` is a 1-3 sentence update to the section that aligns it with the code change; never re-writes the whole section — only the affected part
    - `changelogEntry` is 1-3 sentences summarising what changed and which artifacts are affected
    - Returns `{ impactedPrdSections: [], impactedHldSections: [], changelogEntry: "No upstream impact detected.", confidence: "high" }` when changes are purely additive (new feature file, no existing requirement contradicted)
    - Prompt lives in a new `sync_analysis_prompts.py` file (not inline in `main.py`)
  - Algorithm:
    1. Prompt instructs the LLM: "You are a traceability analyst. Review the code diffs below. Identify which PRD+FRD sections and HLD sections are semantically contradicted or need updating. Only flag HIGH CONFIDENCE impacts. For each flagged section, propose a minimal update (1-3 sentences). Never hallucinate new requirement IDs."
    2. `beforeSnippet` and `afterSnippet` limited to first 40 lines of the file diff to stay within token budget
    3. Prd/HLD `contentSummary` is first 200 chars of section content
    4. Parse response with `_parse_ai_json`; validate required keys
  - Files: `ai-service/main.py` (new route), `ai-service/sync_analysis_prompts.py` (new)
  - Effort: M

- [ ] **Task 9: `BaSyncCheckpointService` + `BaSyncAgentService` — hash diff + auto-trigger + manual trigger** (P0-BE)
  - Acceptance:
    - `BaSyncCheckpointService.captureSnapshot(projectId)` — reads all files in `ProjectSourceCode/` (recursive, skips `node_modules/`, `.next/`, `dist/`, `__pycache__`, `*.pyc`); computes SHA-256 per file; stores `{ [filePath]: hash }` in `BaProjectImplementation.metadata.syncCheckpoint` + `lastSyncAt`; returns list of changed file paths vs previous snapshot (empty list on first call)
    - `BaSyncAgentService.analyze(projectId, changedPaths)` — reads changed file content (before from checkpoint content cache, after from disk); trims to first 40 lines per file; loads latest `BaProjectPrd` and `BaHld` sections as summaries; calls `POST /sync-analyze` on Python service; calls `applyImpact(...)` with the response
    - `BaSyncAgentService.applyImpact(projectId, report)` — for each `impactedPrdSection`: sets `sections[key].syncFlagged = true` + `sections[key].proposedChange = ...` in `BaProjectPrd`; same for HLD; appends `report.changelogEntry` to `CHANGELOG.md`; only processes `confidence = "high"` impacts (medium/low stored but not flagged in UI)
    - `BaSyncAgentService.reviewSection(projectId, artifactType, sectionKey, decision: 'accept'|'reject')` — if accept: sets `sections[key].content = sections[key].proposedChange`, clears `syncFlagged` + `proposedChange`; if reject: clears `syncFlagged` + `proposedChange` only; appends CHANGELOG entry with decision
    - **Auto-trigger**: `RunManagerService` (existing, K-03) emits a `'result'` event at run completion; `BaSyncAgentService` subscribes and fires `captureSnapshot` + `analyze` asynchronously (never blocks the run result SSE)
    - New endpoints:
      - `POST /api/ba/projects/:id/sync-to-upstream` — manual trigger (calls `captureSnapshot` + `analyze`)
      - `GET /api/ba/projects/:id/sync-status` — returns flagged sections grouped by artifact
      - `PATCH /api/ba/projects/:id/sync-review` — body `{ artifactType, sectionKey, decision }` → calls `reviewSection`
  - Files: `backend/src/ba-tool/pipeline/ba-sync-checkpoint.service.ts` (new), `backend/src/ba-tool/pipeline/ba-sync-agent.service.ts` (new), `backend/src/ba-tool/pipeline/pipeline.module.ts` (register both), `backend/src/ba-tool/pipeline/pipeline.controller.ts` (3 new routes), `backend/src/ba-tool/pipeline/run-manager.service.ts` (subscribe to completion event)
  - Effort: L

### P0 Frontend

- [ ] **Task 10: Implementation page — "Sync to Upstream" button + Sync Review Panel** (P0-FE)
  - Acceptance:
    - The Implementation page (`/ba-tool/project/[id]/implementation`) gains:
      1. **"Sync to Upstream" button** — prominent outline button next to "Scaffold from LLD"; disabled until `BaProjectImplementation.metadata.syncCheckpoint` exists (i.e., at least one agent run has completed); on click: calls `POST .../sync-to-upstream`, shows a loading state ("Analyzing changes…"), then reveals the Sync Review Panel on completion
      2. **Sync Review Panel** — rendered below the agent settings section; only visible when `GET .../sync-status` returns non-empty flagged sections:
         - Header: "Upstream Review — N sections flagged across M artifacts"
         - Sections grouped by artifact (PRD+FRD / HLD); each section shows:
           - Section key + label (e.g. "§2 — System Overview")
           - Two-column diff: current content (left, grey bg) | proposed change (right, yellow bg)
           - [Accept update] and [Dismiss] buttons
         - After all sections reviewed, panel collapses with a success message "All sections reviewed. CHANGELOG updated."
      3. **Auto-refresh**: after each agent run completes (SSE `result` event from `AgentRunPanel`), call `GET .../sync-status` silently; if new flags appear, show a yellow badge on the "Sync to Upstream" button
  - Files: `frontend/app/ba-tool/project/[id]/implementation/page.tsx`, `frontend/components/ba-tool/SyncReviewPanel.tsx` (new), `frontend/lib/pipeline-api.ts` (new helpers: `triggerSyncToUpstream`, `getSyncStatus`, `reviewSyncSection`)
  - Effort: L

---

## Phase 4 — Wire-up + Polish

- [ ] **Task 11: Integration smoke test + CHANGELOG format standardisation** (P1)
  - Acceptance:
    - Run the full new pipeline end-to-end for the Taxcompass project (already in DB):
      1. Edit one PRD section → verify change-impact computed → verify RTM banner appears with correct affected artifacts count → export RTM to disk → verify `ProjectArtifacts/10-RTM/` files written
      2. Click "Sync LLD from Code" on a module that has pseudo-files → verify diff shows correct changed files → apply → verify `BaPseudoFile.editedContent` updated + `isHumanModified=true`
      3. Trigger "Sync to Upstream" manually → verify `/sync-analyze` Python endpoint called → verify at least one PRD section flagged → accept it → verify `CHANGELOG.md` updated
    - `CHANGELOG.md` entries follow a consistent format: `## [YYYY-MM-DD HH:MM] <Category> — <Summary>` where Category is one of: `RTM Export | LLD Sync | Upstream Sync | PRD Edit | HLD Edit | Artifact Mirror | Scaffold`
    - Standardise the format in `ProjectFolderService.appendChangelog` — add a `category` parameter (string) and update all callers to pass it; existing entries are not retroactively updated
  - Files: `backend/src/ba-tool/pipeline/project-folder.service.ts`, all callers of `appendChangelog` (search: `appendChangelog`)
  - Effort: S

---

## Task Summary

| # | Phase | Track | Priority | Effort | Deliverable |
|---|---|---|---|---|---|
| 1 | Change Impact | I-01 | P0 | S | `BaChangeImpactService` — detect downstream impact on section edit |
| 2 | Change Impact | I-02 | P0 | XS | Wire impact to PRD save + GET endpoint |
| 3 | Change Impact | I-03 | P0 | S | `BaRtmDiskExportService` — RTM + impact report to disk |
| 4 | Change Impact | I-03 FE | P0 | S | RTM page — impact banner + per-row badges + export button |
| 5 | Code Sync | J-01 | P0 | M | `BaSyncLldService` — diff + pull code into BaPseudoFile |
| 6 | Code Sync | J-01 BE + M-06 | P0 | S | Expose sync endpoints + wire triggeredBy everywhere |
| 7 | Code Sync | J-02 FE | P0 | M | LLD page — "Sync from Code" button + diff modal |
| 8 | Sync Agent | L-03 | P0 | M | Python `/sync-analyze` endpoint + `sync_analysis_prompts.py` |
| 9 | Sync Agent | L-01/L-02/L-04 | P0 | L | `BaSyncCheckpointService` + `BaSyncAgentService` + auto-trigger |
| 10 | Sync Agent | L-05/L-06 FE | P0 | L | Implementation page — "Sync to Upstream" + Sync Review Panel |
| 11 | Polish | — | P1 | S | Smoke test + CHANGELOG format standardisation |

**Total tasks: 11**  
**P0: 10 | P1: 1**

---

## Acceptance Criteria — Sprint Complete

- [ ] Editing any PRD section triggers background change-impact computation; RTM page shows impact banner within one page refresh
- [ ] `ProjectArtifacts/10-RTM/RTM.md`, `RTM.csv`, and `ChangeImpact.md` (when applicable) are written to disk on demand
- [ ] "Sync LLD from Code" correctly diffs and applies changed pseudo-files; `isHumanModified` set on all updated files
- [ ] `POST /sync-analyze` Python endpoint returns structured JSON with correct format; smoke-tested with a real diff
- [ ] After a manual or auto-triggered "Sync to Upstream", at least one PRD/HLD section is correctly flagged with a proposed change
- [ ] Sync Review Panel renders flagged sections with diff view; Accept/Reject each section; panel collapses after all reviewed
- [ ] `CHANGELOG.md` has entries for: RTM export, LLD sync, upstream sync accept/reject — all with standardised `## [datetime] Category — summary` format
- [ ] `triggeredBy` is set on every new `BaArtifact`, `BaProjectPrd`, and `BaHld` row created after v5 ships
- [ ] No regressions on existing routes: customer inputs, PRD+FRD generate/view, HLD, LLD workbench, FTC, test execution, defects, sprints — all still render and function
- [ ] TypeScript compiles clean (`tsc --noEmit`) on both backend and frontend

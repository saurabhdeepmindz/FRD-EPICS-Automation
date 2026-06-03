# Sprint v5 — PRD: Bidirectional Sync — Requirement Change Impact · Code-to-Upstream Propagation · Sync Agent

## Overview

Sprint v5 closes the **final gap in the pipeline**: changes that flow *backwards* — from code to requirements, and from edited requirements to downstream artifacts. Tracks I, J, and L implement requirement change-impact detection (when a PRD+FRD section is edited, the system identifies which EPICs/Stories/SubTasks/LLD sections are affected), code-to-upstream sync (when source code evolves via `/prd` or `/dev`, LLD pseudo-files are reconciled and functional documents are flagged for review), and the Sync Agent (an LLM-powered agent that fires automatically at the end of each agentic code run, proposes upstream changes non-destructively, and writes a `CHANGELOG.md` entry). M-06 wires `triggeredBy` + `sourceArtifactVersions` into every artifact creation flow.

After v5, the pipeline is fully **bidirectional**:

```
Requirements ──[v1–v4]──▶ EPICs ──▶ LLD ──▶ Code
Requirements change ─[I]─▶ impact badge on EPICs / Stories / SubTasks / LLD
Code changes ─[J+L]──▶ LLD pseudo-files updated ──▶ PRD+FRD / HLD sections flagged ──▶ CHANGELOG
```

## Goals

- When a PRD+FRD section is edited, the system surfaces which downstream artifacts (EPICs, User Stories, SubTasks, LLD sections) are impacted — without requiring a full re-generation
- RTM changes and impact reports are written to `ProjectArtifacts/10-RTM/` as Markdown + CSV, matching the established disk-mirror pattern
- Developers can click "Sync LLD from Code" on a module LLD page to pull updated `ProjectSourceCode/` files back into `BaPseudoFile.editedContent` and see a diff
- After each `/prd` or `/dev` agent run, the Sync Agent auto-fires, performs a file-hash diff, calls an LLM to produce a semantic impact report, flags affected PRD+FRD / HLD sections, and appends a changelog entry
- Users can review flagged sections in a dedicated panel and accept or reject proposed upstream changes per section — the system never auto-overwrites
- `triggeredBy` (`BaTriggeredBy` enum) and `sourceArtifactVersions` JSON are populated in all artifact creation flows, making the CR audit trail complete

## User Stories

- As a BA, when I edit a PRD+FRD section, I want to see a banner listing which EPICs, User Stories, SubTasks, and LLD sections reference that requirement — so I know what needs re-review before I re-generate
- As a BA, I want the RTM and change-impact report automatically written to `ProjectArtifacts/10-RTM/` when the RTM is generated — so I always have a current file snapshot
- As an Architect, when `/prd` or `/dev` has evolved code in `ProjectSourceCode/`, I want to click "Sync LLD from Code" and see a diff of what changed — so I can decide whether the pseudo-files need updating before my next LLD re-generation
- As an Architect, I want a "Sync to Upstream" manual button that I can click at any time after editing files directly outside the agent — so I'm not locked to agent-triggered syncs
- As a PM, after every agent run I want the Sync Agent to automatically flag which PRD+FRD and HLD sections are semantically impacted by the code changes — so I know what requirements documentation may have drifted
- As a PM, I want to review flagged sections with the proposed change side-by-side, and accept or reject each one individually — so I'm always in control of what the official requirements say
- As a developer consuming the audit trail, I want every generated artifact row to carry `triggeredBy` (INITIAL_GENERATION / CHANGE_REQUEST / DOWNSTREAM_SYNC / MANUAL_EDIT) and `sourceArtifactVersions` — so we can trace causality for any artifact version

## Technical Architecture

### System Context — Remaining Tracks

```
+------------------------------------------------------------------+
|  Browser (Next.js, port 3001)                                     |
|                                                                   |
|  /ba-tool/project/[id]/implementation     (K-06 — existing)       |
|    ├── [Sync to Upstream] button  (NEW — L-06)                    |
|    └── Sync Review Panel (NEW — L-05)                             |
|         Shows flagged artifact sections with diff + accept/reject |
|                                                                   |
|  /ba-tool/project/[id]/rtm               (existing — enhanced)    |
|    └── Change-Impact banner above table  (NEW — I-03)             |
|         Shows impacted artifacts when PRD+FRD edited              |
|                                                                   |
|  /ba-tool/project/[id]/module/[mid]/lld  (existing — enhanced)    |
|    └── [Sync LLD from Code] button       (NEW — J-02)             |
|         Diff panel: BaPseudoFile vs ProjectSourceCode/            |
|                                                                   |
+----------------------------+-+------------------------------------+
                              | HTTP / SSE
                              ▼
+------------------------------------------------------------------+
|  NestJS Backend (port 4000)                                       |
|                                                                   |
|  New services (ba-tool module):                                   |
|    BaChangeImpactService (I-01)                                   |
|      — on BaProjectPrd section save: diff PRD section text        |
|        → query BaRtmRow.frdFeatureIds → find EPICs/US/ST/LLD     |
|        → emit change-impact record (stored in metadata)           |
|    BaRtmDiskExportService (I-02) — new / enhanced                 |
|      — writes RTM.md + RTM.csv + change-impact report to disk    |
|    BaSyncCheckpointService (L-01)                                 |
|      — SHA-256 hash of every ProjectSourceCode/ file              |
|        stored in BaProjectImplementation.metadata after each run  |
|    BaSyncAgentService (L-02, L-04)                                |
|      — orchestrates: diff → /sync-analyze → flag → CHANGELOG      |
|      — triggered by K-03 RunManager on skill completion           |
|      — manual trigger endpoint                                    |
|                                                                   |
|  New / enhanced controllers:                                      |
|    BaPipelineController (enhanced):                               |
|      PUT  /ba/pipeline/sync-lld-from-code/:moduleId  (J-01)      |
|      GET  /ba/pipeline/sync-lld-diff/:moduleId       (J-02)       |
|      POST /ba/pipeline/sync-to-upstream/:projectId   (L-06)       |
|      GET  /ba/pipeline/sync-status/:projectId        (L-05)       |
|      PATCH /ba/pipeline/sync-section-review          (J-04/L-05)  |
|                                                                   |
+----------------------------+-+------------------------------------+
                              | HTTP
                              ▼
+------------------------------------------------------------------+
|  Python AI Service (FastAPI, port 5000)                           |
|                                                                   |
|  NEW endpoint:                                                    |
|    POST /sync-analyze    (L-03)                                   |
|      — input: changed file diffs (path, before, after snippets)  |
|        + project artifact summary (PRD sections, HLD sections)    |
|      — output: JSON impact report                                 |
|        { impactedPrdSections: [{key, reason, proposedChange}]     |
|          impactedHldSections: [{key, reason, proposedChange}]     |
|          lldSectionsToUpdate: [{moduleId, sectionKey, reason}]    |
|          changelogEntry: string }                                 |
|                                                                   |
+------------------------------------------------------------------+
```

### Data Flow — Requirement Change Impact (Track I)

```
1. User edits a PRD+FRD section (PATCH /project-prd/:id/section)
   ↓
2. BaChangeImpactService.onSectionEdit(sectionKey, oldText, newText)
   - finds all BaRtmRow rows where frdFeatureIds or prdSectionRef matches
   - groups impacted rows by artifact type (EPIC / USER_STORY / SUBTASK / LLD)
   - stores impact record in BaProjectPrd.metadata.changeImpact
   ↓
3. GET /ba/projects/:id/change-impact — returns current impact map
   ↓
4. RTM page shows impact banner: "3 EPICs, 7 User Stories, 2 LLD sections may need review"
   - per-row impact badge in RTM table (yellow ⚠ icon with tooltip)
```

### Data Flow — Code-to-Upstream Sync (Track J + L)

```
1. /prd or /dev agent run completes (K-03 RunManager emits 'result' event)
   ↓
2. BaSyncCheckpointService.captureSnapshot(projectId)
   - computes SHA-256 of every file in ProjectSourceCode/
   - diffs against previous snapshot stored in BaProjectImplementation.metadata
   - stores changed file list (path, previousHash, currentHash)
   ↓
3. BaSyncAgentService.analyze(projectId)
   - reads changed file content (before from checkpoint, after from disk)
   - calls POST /sync-analyze with diffs + artifact summaries
   - Python LLM returns structured impact report
   ↓
4. BaSyncAgentService.applyImpact(projectId, report)
   - sets syncFlagged=true + proposedChange on impacted BaProjectPrd sections
   - sets syncFlagged=true + proposedChange on impacted BaHld sections
   - updates BaPseudoFile.editedContent for changed pseudo-files (J-01)
   - appends entry to CHANGELOG.md
   ↓
5. User opens implementation page → sees "Sync Review" panel
   - grouped by artifact: PRD+FRD sections / HLD sections
   - per section: diff view (current vs proposed), [Accept] / [Reject] buttons
   ↓
6. User accepts → section content updated, syncFlagged cleared, CHANGELOG entry
   User rejects → proposedChange discarded, syncFlagged cleared, CHANGELOG entry
```

### New Backend Surface (net-new in v5)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/ba/projects/:id/change-impact` | Get current requirement change-impact map |
| POST | `/api/ba/projects/:id/rtm/export-to-disk` | Write RTM + change-impact report to ProjectArtifacts/10-RTM/ |
| GET | `/api/ba/modules/:id/lld/sync-diff` | Diff BaPseudoFile vs current ProjectSourceCode/ files |
| POST | `/api/ba/modules/:id/lld/sync-from-code` | Pull ProjectSourceCode/ changes into BaPseudoFile.editedContent |
| POST | `/api/ba/projects/:id/sync-to-upstream` | Manual trigger: hash-diff → /sync-analyze → flag → CHANGELOG |
| GET | `/api/ba/projects/:id/sync-status` | Get flagged sections + proposed changes for review panel |
| PATCH | `/api/ba/projects/:id/sync-review` | Accept or reject a flagged section proposal |

### Schema Changes (Prisma — additive only)

```prisma
// BaProjectPrd — new fields on sections JSON entries
// sections[].syncFlagged: boolean — true when Sync Agent flagged this section
// sections[].proposedChange: string | null — LLM-proposed updated content
// (stored in the existing sections JSON field — no schema migration needed)

// BaHld — same pattern as above
// (stored in the existing sections JSON field — no schema migration needed)

// BaProjectImplementation — enhanced metadata
// metadata.syncCheckpoint: Record<filePath, sha256Hash>
// metadata.lastSyncAt: ISO timestamp
// metadata.lastSyncRunId: string (K-03 run ID that triggered the sync)
// (stored in the existing metadata JSON field — no schema migration needed)

// BaChangeImpact — lightweight inline store (no new table needed in v5)
// Stored in BaProjectPrd.metadata.changeImpact: {
//   [sectionKey]: { impactedEpics: string[], impactedStories: string[],
//                   impactedSubtasks: string[], impactedLldSections: string[],
//                   detectedAt: ISO timestamp }
// }

// BaArtifact, BaProjectPrd, BaHld — M-06 wiring
// triggeredBy: BaTriggeredBy (schema columns already exist from M-02)
// sourceArtifactVersions: Json (schema columns already exist from M-04)
// v5 just wires population in the service layer — no migration needed
```

### New Python AI Service Endpoint (L-03)

```python
# POST /sync-analyze
# Input: SyncAnalyzeRequest
#   changedFiles: list of { path, beforeSnippet (first 40 lines), afterSnippet (first 40 lines) }
#   prdSections: list of { key, label, content (first 200 chars) }
#   hldSections: list of { key, label, content (first 200 chars) }
#
# Output: SyncAnalyzeResponse
#   impactedPrdSections: [{ key, reason, proposedChange }]
#   impactedHldSections: [{ key, reason, proposedChange }]
#   lldSectionsToUpdate: [{ moduleId, sectionKey, reason }]
#   changelogEntry: string (1-3 sentences summarising what changed and why)
#   confidence: "high" | "medium" | "low"
```

## Out of Scope (v6+)

- **Change Request UI** — CR create/list/view/approve/implement workflow (schema already in place from M-01 to M-05)
- **Enterprise readiness (E1–E8)** — multi-tenancy, RBAC, SSO, audit log, rate limiting, observability, backup, GDPR
- **Codegen beyond Playwright (C1–C7)** — Cypress, Selenium, RestAssured/Postman, k6/JMeter
- **F2 Monday/Jira/ADO push** — external issue tracker integration for defects
- **Automated LLM-triggered requirement re-generation** — Sync Agent proposes but never auto-regenerates EPICs/Stories/SubTasks
- **Real-time collaborative editing** — sync conflicts are last-write-wins in v5

## Dependencies

- ✅ **K-03 / K-06** (Track K) — `RunManager` + SSE + `AgentRunPanel` already shipped; v5 hooks into `RunManager`'s completion event
- ✅ **H-06** (`appendChangelog`) — `ProjectFolderService.appendChangelog` already works; v5 adds new entry types
- ✅ **H-04** (real context assembly) — `ContextEngineeringService` already reads live artifacts; v5 re-uses the assembled context summaries for the sync-analyze prompt
- ✅ **M-01 to M-05** — DB columns for `triggeredBy`, `sourceArtifactVersions`, `changeRequestId` all exist; v5 just populates them
- ✅ **BaPseudoFile** — `editedContent` + `isHumanModified` fields already exist for J-01 to write to
- ✅ **BaRtmRow** — `frdFeatureIds` linkage already exists for I-01 to query
- **Python AI Service `/sync-analyze`** — new endpoint (L-03), must be implemented before L-04

## Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| LLM impact analysis over-flags unrelated sections | High | Limit prompt to changed file diffs ≤40 lines each + artifact summaries ≤200 chars; set `confidence` field and only auto-flag `high` confidence hits |
| Large projects with 500+ files cause slow SHA-256 snapshot | Medium | Process only files under `src/`, skip `node_modules/`, `__pycache__`, `.next/`, `dist/` — stored in a `.syncignore` pattern list |
| User confusion between "Accept" and "re-generate" | Low | Clear UI copy: "Accept applies the proposed text to the PRD/HLD section. To fully re-generate, use the Generate button." |
| BaProjectPrd.sections JSON grows large with flagged proposals | Low | proposedChange is cleared on accept/reject; trim to 2000 chars max per proposal |
| Sync Agent triggers on every micro-change during an agent run | Medium | Capture snapshot only on `result` event (end of run), not on individual `file` events |

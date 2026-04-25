# Sprint v4 — Walkthrough

## Summary

Sprint v4 started as a single scope (**SKILL-06-LLD** — Architect Workspace + Low-Level Design generation) and, through a long run of reactive enhancements captured in `BACKLOG.md`, grew to cover the full testing and execution lifecycle on top of it.

Everything shipped in v4 can be read as four layered bundles:

1. **Design (v4 PRD core)** — LLD skill + Architect Console + pseudo-code editor + LLD narrative workbench with attachments + RTM-to-LLD trace
2. **Test generation** — **SKILL-07-FTC** (Functional Test Cases from EPIC/User Story/SubTask/LLD), **AC Coverage Verifier**, runnable **Playwright export**
3. **Execution + quality (Phase 2a)** — test runs, defect capture with attachments, **dual-track RCA** (AI + tester), soft-delete, denormalised latest-status caches
4. **Orchestration layer (B1–B4 + D1–D2 + dashboard)** — real Sprint entity (table + picker + burndown + filters), Unit-Test scaffold export, Contract-Test scaffold export, Test Execution Health tile, global Defect list, RTM exec verdict column, bulk run recording, standalone "Open Defect", F3 Playwright drift badge + Re-verify+Export

The pipeline is now coherent end-to-end:

```
FRD → EPIC → User Story → SubTask → LLD → {Unit Tests, Contract Tests, FTC → Playwright} → Run → Defect → RCA
```

Every step writes forward; every step also traces backward via the RTM.

## Architecture Overview

```
+---------------------------------------------------------------------------------+
|                           Browser (Next.js, port 3001)                          |
|                                                                                 |
|   /ba-tool/project/[id]                       (Project dashboard)               |
|     Header nav: Architect Console | Sprints | RTM | Defects [N] | TBD Registry  |
|     Tiles (top → bottom):                                                       |
|       1. Quick stats (Modules / Approved / In Progress)                         |
|       2. Test Execution Health  (pass-rate + stacked bar + drill-downs)         |
|       3. Sprint Burndown        (inline SVG, ideal vs actual)                   |
|       4. Skill Chain diagram                                                    |
|                                                                                 |
|   /ba-tool/project/[id]/sprints                Sprint CRUD + backfill           |
|   /ba-tool/project/[id]/rtm                    RTM table w/ Sprint + Exec       |
|   /ba-tool/project/[id]/defects                Global defect list + filters     |
|                                                                                 |
|   /ba-tool/project/[id]/module/[mid]                                            |
|     ArtifactTree (LLD/FTC nodes) + ArtifactContentPanel                         |
|                                                                                 |
|   /ba-tool/project/[id]/module/[mid]/lld       AI LLD Workbench                 |
|     Header buttons:  Preview | Export Unit Tests | Export Contract Tests |      |
|                      Save | Regenerate LLD                                      |
|                                                                                 |
|   /ba-tool/project/[id]/module/[mid]/ftc       AI FTC Workbench                 |
|     Header buttons:  Export CSV | Export Playwright Suite [!N drift] |          |
|                      Re-verify + Export | Save | Regenerate                     |
|                                                                                 |
|   FTC artifact view (inside module detail)                                      |
|     Header:  Per-category totals | Sprint filter                                |
|     Bulk toolbar: select-all + "Run selected (N)" → BulkRunDialog               |
|     Per-TC accordion:                                                           |
|       checkbox | header (status pill, AI/Edited badge)                          |
|       body: Structured fields + Traceability table + AC Coverage card           |
|       ExecutionHistoryPanel:                                                    |
|         Header: "Record run" + "Open defect"                                    |
|         Runs table: #, Date, Status, Executor, Env, Sprint, Defects, Notes      |
|         Defects section: per-defect card (attachments + dual-track RCA)         |
|                                                                                 |
+------------------------------------+--------------------------------------------+
                                     | HTTP (axios)
                                     v
+---------------------------------------------------------------------------------+
|                          NestJS Backend (port 4000)                             |
|                                                                                 |
|   Controllers (ba-tool module):                                                 |
|     BaToolController       module / project / RTM backfill / exports            |
|     BaSkillController      skill execution orchestration + RTM data + health    |
|     BaLldController        LLD config/generate + Unit Test ZIP + Contract ZIP   |
|     BaFtcController        FTC config/generate + TC CRUD + CSV + Playwright ZIP |
|     BaExecutionController  test runs + defects + RCAs (Phase 2a)                |
|     BaSprintController     Sprint CRUD + backfill + burndown (B1–B3)            |
|     BaMasterDataController Architect Console dictionaries                       |
|                                                                                 |
|   Services (ba-tool module):                                                    |
|     BaSkillOrchestratorService  — context packet builder, RTM enrichment,       |
|                                   execution health roll-up                      |
|     BaLldService / BaLldParserService / BaLldNarrativeService                   |
|     BaFtcService / BaFtcParserService / BaFtcNarrativeService                   |
|     BaAcCoverageService                                                         |
|     BaPlaywrightExportService                                                   |
|     BaUnitTestExportService      (D1 — new)                                     |
|     BaContractTestExportService  (D2 — new)                                     |
|     BaTestRunService             (Phase 2a — run create + bulk + soft-delete)   |
|     BaDefectService              (Phase 2a — defect CRUD + attachments +        |
|                                   standalone createDefect)                      |
|     BaRcaService                 (Phase 2a — AI/tester dual-track)              |
|     BaSprintService              (B1 — CRUD, backfill, burndown computation)    |
|     BaArtifactExportService / BaExportService / BaTemplateService               |
|                                                                                 |
+------------------------------------+--------------------------------------------+
                                     | Prisma
                                     v
+---------------------------------------------------------------------------------+
|                 PostgreSQL (`prd_generator`, schema: public)                    |
|                                                                                 |
|   Existing (v1–v3):                                                             |
|     BaProject, BaModule, BaArtifact + BaArtifactSection,                        |
|     BaSubTask + BaSubTaskSection, BaRtmRow, BaMasterDataEntry, BaTemplate       |
|                                                                                 |
|   Added in v4 core (LLD):                                                       |
|     BaLldConfig, BaLldConfigAttachment, BaPseudoFile                            |
|                                                                                 |
|   Added in v4 FTC extension:                                                    |
|     BaFtcConfig, BaFtcConfigAttachment, BaTestCase, BaAcCoverage                |
|                                                                                 |
|   Added in v4 Phase 2a (execution + defects):                                   |
|     BaTestRun, BaDefect, BaDefectAttachment, BaRca                              |
|     BaTestCase.latestRunId (FK, denormalized), executionStatus, lastRunAt       |
|                                                                                 |
|   Added in v4 B1 (Sprint entity):                                               |
|     BaSprint                                                                    |
|     BaTestCase.sprintDbId (nullable FK)                                         |
|     BaTestRun.sprintDbId  (nullable FK)                                         |
|     Legacy free-text `sprintId` columns kept for backward compat                |
|                                                                                 |
+---------------------------------------------------------------------------------+
                                     | HTTP
                                     v
+---------------------------------------------------------------------------------+
|                       Python AI Service (FastAPI, port 5000)                    |
|                                                                                 |
|   Endpoints used by the Node backend:                                           |
|     POST /ba/lld-gap-check          (LLD narrative gap check)                   |
|     POST /ba/ftc-gap-check          (FTC narrative gap check)                   |
|     POST /ba/ac-coverage-check      (AC coverage verifier)                     |
|     POST /ba/extract-image-text     (OCR for image attachments)                 |
|     POST /ba/rca-analyze            (RCA with evidence + dual-track context)    |
|                                                                                 |
|   Model: gpt-4.1 (Anthropic fallback compatible).                               |
+---------------------------------------------------------------------------------+
```

## Database Schema Changes (v4 complete)

### New models

- **BaLldConfig** (`ba_lld_config`) — per-module architect selections for the LLD skill
- **BaLldConfigAttachment** (`ba_lld_config_attachments`) — files attached to the LLD narrative
- **BaPseudoFile** (`ba_pseudo_files`) — tree of language-specific pseudo-code files owned by each LLD artifact
- **BaFtcConfig** (`ba_ftc_config`) — per-module test-config selections (frameworks, types, OWASP, etc.)
- **BaFtcConfigAttachment** — files attached to the FTC narrative
- **BaTestCase** (`ba_test_cases`) — structured TCs parsed from FTC fenced-blocks with sprint/exec-status caches + traceability FKs
- **BaAcCoverage** (`ba_ac_coverage`) — AC-to-TC coverage matrix (COVERED / PARTIAL / UNCOVERED)
- **BaTestRun** (`ba_test_runs`) — execution events (Phase 2a), soft-deletable
- **BaDefect** (`ba_defects`) — defect lifecycle with OPEN/IN_PROGRESS/FIXED/VERIFIED/CLOSED/WONT_FIX workflow
- **BaDefectAttachment** (`ba_defect_attachments`) — evidence files (logs, screenshots) with OCR'd `extractedText`
- **BaRca** (`ba_rcas`) — dual-track AI + TESTER root cause analysis
- **BaSprint** (`ba_sprints`) — real Sprint entity with status enum (PLANNING / ACTIVE / COMPLETED / CANCELLED), unique `(projectId, sprintCode)`

### New FK/denormalised columns on existing tables

- `BaTestCase.executionStatus` (NOT_RUN / PASS / FAIL / BLOCKED / SKIPPED) — denormalised latest-run cache
- `BaTestCase.latestRunId` (FK → BaTestRun) — fast RTM queries
- `BaTestCase.lastRunAt`, `lastRunBy`, `defectIds[]` — denormalised for CSV export and at-a-glance RTM
- `BaTestCase.sprintDbId` (FK → BaSprint) — canonical sprint assignment (B1)
- `BaTestRun.sprintDbId` (FK → BaSprint) — sprint that the run belongs to (B1)
- `BaDefect.firstSeenRunId` (nullable FK) — allows standalone "Open Defect" without a triggering run
- `BaRtmRow.ftcArtifactId`, `owaspWebCategories[]`, `owaspLlmCategories[]` — FTC linkage
- `BaModule.lldCompletedAt`, `ftcCompletedAt` — milestone timestamps independent of the main status machine
- `BaProject.sqlDialect` — project-wide SQL dialect for test-data generation

## Key Files Created/Modified

### Backend — services

- **ba-lld.service.ts** — LLD config CRUD, trigger generation, parse AI output into `BaPseudoFile`s
- **ba-lld-parser.service.ts** — splits AI markdown into pseudo-files with path + language detection
- **ba-lld-narrative.service.ts** — attachments + gap-check calls against Python AI service
- **ba-ftc.service.ts**, **ba-ftc-parser.service.ts**, **ba-ftc-narrative.service.ts** — FTC skill mirror
- **ba-ac-coverage.service.ts** — extracts user-facing ACs from EPIC/US/SubTasks, matches to TCs (fixed bug where FRD process DoD was being included as ACs)
- **ba-playwright-export.service.ts** — deterministic template codegen: `playwright.config.ts`, fixtures, one spec per scenarioGroup, `test.skip()` for TCs without automation hints, ZIP with README
- **ba-test-run.service.ts** — `createRun`, `bulkCreateRuns` (200-cap, dedupes IDs), `softDeleteRun`, `resolveSprintFields` (B2 FK → sprintCode mirror)
- **ba-defect.service.ts** — `createDefect` (standalone), `updateDefect`, attachment upload/delete, `listDefectsForProject` (with nested Sprint + TC + module)
- **ba-rca.service.ts** — AI RCA with LLD + attachment evidence in prompt, tester RCA saving with revisions
- **ba-sprint.service.ts** — CRUD, `backfillFromLegacyStrings`, **`getSprintBurndown`** (B3 — first-run-per-TC semantics)
- **ba-skill-orchestrator.service.ts** — `getProjectRtm` enriched with `execCounts`, `execVerdict`, `sprintDbIds[]`, `sprintCodes[]`; `getProjectExecutionHealth` (B3 dashboard tile)
- **ba-unit-test-export.service.ts** — **D1** — language-aware regex function extraction → pytest/Jest/JUnit scaffolds
- **ba-contract-test-export.service.ts** — **D2** — provider/consumer detection, path normalisation, pair matching, orphan flagging; OpenAPI + Jest+msw + pytest+respx codegen

### Backend — controllers

- **ba-skill.controller.ts** — gained `GET /api/ba/projects/:id/execution-health`, `GET /api/ba/projects/:id/rtm` (enriched)
- **ba-lld.controller.ts** — `GET /lld-artifacts/:id/unit-tests-zip` (D1) + `GET /lld-artifacts/:id/contract-tests-zip` (D2)
- **ba-ftc.controller.ts** — `GET /artifacts/:id/playwright-zip`, TC CSV export, AC coverage analyze + list
- **ba-execution.controller.ts** — runs (create + bulk + list + delete), defects (CRUD + attachments + list for project), RCAs (list + analyze + save tester)
- **ba-sprint.controller.ts** — sprints CRUD, backfill, burndown

### Backend — Python AI service

- **main.py** — new endpoints:
  - `/ba/ac-coverage-check` — verifies TC coverage of ACs
  - `/ba/rca-analyze` — AI RCA with structured JSON output (classification + confidence), now reads attachment `evidenceContext` and prior AI/tester RCAs

### Frontend — pages

- **app/ba-tool/project/[id]/page.tsx** — project dashboard with **Test Execution Health** tile, **Sprint Burndown** tile, header nav (Sprints, Defects, RTM)
- **app/ba-tool/project/[id]/sprints/page.tsx** — B1 Sprint management (create/edit/delete + backfill)
- **app/ba-tool/project/[id]/defects/page.tsx** — F1 global Defect list with 5 filters + CSV + "direct" badge
- **app/ba-tool/project/[id]/rtm/page.tsx** — B4 Sprint filter + Exec verdict column + new CSV cols
- **app/ba-tool/project/[id]/module/[moduleId]/lld/page.tsx** — AI LLD Workbench + **Export Unit Tests** + **Export Contract Tests**
- **app/ba-tool/project/[id]/module/[moduleId]/ftc/page.tsx** — AI FTC Workbench + **Export Playwright Suite (drift badge)** + **Re-verify + Export**

### Frontend — components

- **SprintPicker.tsx** — B2 reusable status-aware dropdown (hides COMPLETED/CANCELLED by default)
- **BurndownChart.tsx** — B3 inline-SVG chart (ideal dashed + actual solid, tooltips, auto-scaling viewBox)
- **ExecutionHistoryPanel.tsx** — Phase 2a panel at the bottom of each TC: run history table, record-run + open-defect dialogs, per-defect card with attachments + AI/tester dual-track RCA
- **FtcArtifactView.tsx** — structured TC accordion, AC Coverage Card, bulk-run toolbar, sprint filter
- **BulkRunDialog** (inside FtcArtifactView) — shared status + metadata applied across many TCs
- **RecordRunDialog / OpenDefectDialog / DefectCard / RcaDualTrackPanel** (inside ExecutionHistoryPanel)

## Data Flow

### Happy path — end-to-end

1. **Upload screens** → SKILL-00 extracts screen metadata
2. **Run SKILL-01-S** → FRD generated
3. **Run SKILL-02-S** → EPICs generated
4. **Run SKILL-04** → User Stories generated (with ACs)
5. **Run SKILL-05** → SubTasks generated (with 24 sections per subtask)
6. **Architect opens LLD Workbench** → selects tech stack, patterns, templates; uploads narrative attachments; runs gap-check; approves
7. **Run SKILL-06-LLD** → LLD markdown + tree of pseudo-files generated; RTM rows auto-extended with `lldArtifactId`, `layer`, `pseudoFilePaths`
8. **Architect exports Unit Tests (D1)** → language-aware ZIP with pytest/Jest/JUnit scaffolds, every test red
9. **Architect exports Contract Tests (D2)** → ZIP with provider+consumer pairs, orphan consumers flagged in `UNRESOLVED_CONTRACTS.md`
10. **BA/QA opens FTC Workbench** → picks frameworks + test types + OWASP categories; runs gap-check; approves
11. **Run SKILL-07-FTC** → Test Cases parsed into `BaTestCase` rows + AC coverage matrix computed; RTM rows auto-extended with `ftcArtifactId`, `owaspWebCategories[]`, `owaspLlmCategories[]`
12. **BA exports Playwright Suite** → runnable ZIP; amber drift badge appears when AC coverage has gaps
13. **PM creates Sprint** in `/sprints` → status=PLANNING → ACTIVE
14. **Tester records runs** → "Record run" dialog with SprintPicker writes `BaTestRun.sprintDbId` + mirrors onto `BaTestCase.sprintDbId`
15. **Tester selects multiple TCs + "Run selected (N)"** → bulk endpoint creates N runs with shared status
16. **Tester opens defect** (from FAIL run OR standalone via "Open defect") → `BaDefect` created with `firstSeenRunId` (or null)
17. **Tester uploads evidence** (logs, screenshots) → `BaDefectAttachment` stored, text OCR'd via Python service
18. **Tester clicks "Analyze with AI"** → `BaRcaService.analyzeWithAi` sends defect + TC + LLD snippet + prior RCAs + **evidence** to Python → AI returns structured JSON → new `BaRca` row with `source=AI`
19. **Tester reviews + saves dissenting RCA** → new `BaRca` with `source=TESTER`
20. **Manager opens project dashboard** → sees Test Execution Health (pass-rate, failing TCs list), Sprint Burndown (actual vs ideal), Defects nav pill (red if P0/P1 open)
21. **Manager opens RTM** → filters by Sprint=v2.3, Exec=FAIL → finds the broken feature rows
22. **Manager opens global Defect list** → filters by Status="Open all", Severity=P0 → triages

### Key denormalisations

- `BaTestCase.executionStatus` + `.latestRunId` updated atomically on every run create/delete
- `BaTestCase.defectIds[]` — appended when a run creates a defect OR when standalone "Open defect" runs
- `BaTestCase.sprintId` + `sprintDbId` — mirrored from the latest run so RTM groupings stay consistent
- `BaRtmRow.ftcTestCaseRefs` + backend-enriched `execCounts`/`execVerdict`/`sprintDbIds[]` — computed in `getProjectRtm` from a single bulk lookup on `BaTestCase`

### Export artifacts (all ZIP-based, deterministic codegen, no AI call at export time)

- `{artifactId}-playwright.zip` — Playwright config + fixtures + `tests/<scenario>.spec.ts`
- `{artifactId}-unit-tests.zip` — `python/`, `javascript/`, `java/` per-language subdirs with runner config
- `{artifactId}-contract-tests.zip` — `openapi.yaml` + `javascript/contracts/` (Jest+msw) + `python/contracts/` (pytest+respx) + `UNRESOLVED_CONTRACTS.md` when orphans

## API Surface — net-new in v4 (non-exhaustive)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/ba/modules/:id/generate-lld` | Trigger SKILL-06-LLD |
| GET | `/api/ba/modules/:id/lld/config` | Load architect selections |
| PUT | `/api/ba/modules/:id/lld/config` | Save architect selections |
| POST | `/api/ba/modules/:id/lld/attachments` | Upload narrative attachments |
| POST | `/api/ba/modules/:id/generate-ftc` | Trigger SKILL-07-FTC |
| POST | `/api/ba/artifacts/:id/ac-coverage/analyze` | Re-verify AC coverage |
| GET | `/api/ba/artifacts/:id/playwright-zip` | Download Playwright suite |
| GET | `/api/ba/lld-artifacts/:id/unit-tests-zip` | **D1** Download unit-test scaffolds |
| GET | `/api/ba/lld-artifacts/:id/contract-tests-zip` | **D2** Download contract-test scaffolds |
| POST | `/api/ba/test-cases/:id/runs` | Record a single run (optionally open defect) |
| POST | `/api/ba/test-cases/bulk-runs` | Bulk-record runs across many TCs |
| DELETE | `/api/ba/runs/:id` | Soft-delete a run + recompute latest |
| POST | `/api/ba/test-cases/:id/defects` | Standalone "Open defect" (no run required) |
| GET | `/api/ba/projects/:id/defects` | Project-wide defect feed for list page |
| GET | `/api/ba/defects/:id` / PATCH / DELETE | Defect CRUD |
| POST | `/api/ba/defects/:id/attachments` | Upload defect evidence |
| POST | `/api/ba/defects/:id/rca/analyze` | Run AI RCA |
| POST | `/api/ba/defects/:id/rca` | Save tester RCA |
| GET | `/api/ba/projects/:id/execution-health` | Dashboard health tile data |
| POST | `/api/ba/projects/:id/sprints` / GET / backfill | Sprint CRUD (B1) |
| GET | `/api/ba/sprints/:id/burndown` | Sprint burndown data (B3) |

## Test Coverage

The v4 delivery is feature-heavy rather than test-suite-heavy; most validation happened via live smoke tests through the UI. Specifically:

- **Phase 2a smoke**: recorded a FAIL run on TC-001, opened defect with JIRA external ref, uploaded `audit-error.log`, ran AI RCA (correctly classified as "flaky" with 0.8 confidence), saved dissenting tester RCA — denormalised caches on `BaTestCase` verified correct
- **AC extractor fix**: before/after SQL inspection confirmed 15 bogus FRD-process-DoD rows removed; re-verify produced 20 real ACs (13 covered, 7 partial, 0 uncovered)
- **Bulk run**: recorded PASS against 30+ TCs in a single dialog submit; RTM badges + dashboard tile refreshed correctly
- **Sprint backfill**: tested against a project with free-text `sprintId` strings; `backfillFromLegacyStrings` created PLANNING sprints for each unknown code; dropdowns picked them up
- **D1/D2 exports**: verified ZIP contents unpack correctly and the READMEs list generated files

**Automated test coverage is a known gap** (see limitations below). Type-checking (`tsc --noEmit`) is clean across backend + frontend at every commit in v4.

## Security Measures

- Attachment uploads capped at **30 MB total** per artifact (LLD narrative, FTC narrative, defect evidence — same cap everywhere for consistency)
- `DiskAttachmentStorage` sanitises each path segment separately to prevent path traversal
- Defect `externalRef` is treated as opaque text (no URL parsing or auto-redirect)
- All AI service calls go to the trusted internal Python FastAPI on port 5000 — no user input is passed through as prompt without context framing
- AC Coverage re-verify uses only structured DB content; there's no pathway for attacker-controlled acText to reach the `system` prompt
- Pluggable `AttachmentStorage` abstraction via `ATTACHMENT_STORAGE` DI token — S3/GCS stubs ready for secret-scoped deployment

## Known Limitations

- **No automated test suite for Phase 2a / Sprint entity / D1 / D2** — validated live; unit/integration tests are in P3 backlog
- **Regex-grade pseudo-code parsing** — D1/D2 function/endpoint extraction is best-effort. Complex multi-line signatures, decorators across lines, and comment-embedded examples can be missed
- **No tenant isolation** — any user with DB access sees all projects (deferred to E1)
- **No RBAC** — anyone can edit anything (deferred to E2)
- **Rate limiting on AI endpoints is not enforced** — one user can drain the OpenAI quota (deferred to E5)
- **Free-text `sprintId` still accepted at the DB level** — legacy rows without `sprintDbId` still render in the UI via the "legacy" optgroup; migration tool exists (`backfillFromLegacyStrings`) but mixed state is possible
- **F2 Monday/Jira/ADO push is deferred** — defect `externalRef` is manual paste today
- **Playwright export regenerates on every click** but UI doesn't track "last-exported-at" timestamps, so the drift badge relies on AC coverage summary rather than a dedicated export watermark
- **AC coverage re-verify is manual** — no auto-trigger when ACs change; users must click the button
- **No offline mode** — every UI surface depends on the backend being reachable

## What's Next

Sprint v5 scope (not yet written):

- **F2 Monday/Jira/ADO integration** — unblock external issue tracker push, leveraging the pluggable `IssueTracker` abstraction designed but not implemented
- **E1–E8 Enterprise readiness** — multi-tenant, RBAC, audit log, SSO, rate limiting, observability, backup, GDPR
- **C1–C7 Codegen beyond Playwright** — Cypress, Selenium, WDIO, Appium, RestAssured/Postman, k6/JMeter, Pact contract tests
- **P3 polish** — UX1 dark mode, UX3 tree search, UX6 a11y audit, G1 user manual, H1 input-sanitisation audit

Near-term maintenance items:

- Automated test harness (Jest + supertest on backend, Playwright on frontend) — in P3
- `lastPlaywrightExportAt` / `lastUnitTestsExportAt` timestamps on `BaArtifact` for true drift detection
- Sprint auto-transition (PLANNING → ACTIVE on startDate, ACTIVE → COMPLETED on endDate+grace)
- Burndown drill-down — click a day on the chart → see which TCs transitioned

---

## Post-v4 patches — SubTask Renderer & Tree Hierarchy (April 2026)

After v4 was cut, a focused round of patches landed to make SubTask artifacts (SKILL-05 output) render consistently across the editor view, DOCX export, and PDF export. The patches also add a 4-level tree hierarchy so SubTasks visually nest under their parent User Story. This subsection records what was changed and why so future maintainers don't accidentally regress these contracts.

### What broke first (so the fix makes sense)

The first attempt to improve SubTask coverage introduced a **per-story AI loop** that called the AI once per user story and concatenated all responses into one document before storing. The orchestrator's section splitter then walked the concatenated document and treated every `^#`/`^##`/`^###` heading as a new database section. The per-story prompts caused the AI to emit `### Section N — Field` (level 3) headings inside each SubTask body — the splitter dutifully split each of the 24 template fields out as its own DB row. Result: ~22 stories × 6 subtasks × ~24 fields = **2,737 fragmented sections** in one SUBTASK artifact instead of one row per SubTask body.

Recovery (commits `caf1cb1` / `fc008f3` / `6e18ccf`) reverted the per-story loop and the "completeness mandate" prompt that pushed the AI to ignore the existing single-shot instructions. A one-shot Prisma script (`scripts/delete-broken-subtask-artifact.ts`) cleaned out the broken artifact rows. SKILL-05 was re-run as single-shot and produced one clean SubTask body per row again.

**The lesson, encoded in `FINAL-SKILL-05-create-subtasks-v2.md`:** numbered Section headings inside a SubTask body **must** use `####` (level 4). Level 1–3 are reserved for document title / SubTask separator / group intro respectively. The skill file now has a "Heading Hierarchy Rules" table making this explicit.

### Renderer parity — DOCX, PDF, non-preview

Three SubTask-template fields used to render as preformatted monospace walls in DOCX/PDF and as code blocks in the editor:

- **Section 19 — Traceability Header** (the `/* ... */` Module/Feature/User Story/Epic block)
- **Section 20 — Project Structure Definition** (`Project Structure:` KV lines + `Directory Map:` tree)
- **Section 21 — Sequence Diagram Inputs** (Mermaid `sequenceDiagram` source)

After the patches:

- **Section 19 splits into two tables** — main Traceability metadata and TBD-Future Dependencies. The `TBD-Future Dependencies:` literal line is the section break. `extractKvBlockAsGroups` (backend) / `extractKvGroups` (frontend) both implement the split; `allRowsLookLikeTraceability` keeps the heuristic from converting unrelated comment blocks into tables.
- **Section 20 renders as a 2-col KV table for the path lines + a monospace `<pre>` for the Directory Map tree**. `extractProjectStructureBlock` is duplicated in three locations (backend DOCX, backend HTML/PDF template, frontend MarkdownRenderer post-processor) — they are intentional copies because the runtimes can't share code; any change must be applied to all three.
- **Section 21 Mermaid is embedded as a real PNG in DOCX exports**. `BaArtifactExportService.prepareMermaidImages` does a pre-pass over all sections, renders each unique `mermaid` fence to PNG via a single shared headless Chromium instance, and stashes buffers in a `Map<string, MermaidImage>`. The markdown→DOCX pass then swaps each fence for an `ImageRun` scaled to fit the page width. Falls back to source-as-preformatted when puppeteer is unavailable, so the export never breaks. PDF rendering already worked because the HTML template emits `<div class="mermaid">` and `pdf.service.ts` waits for SVG render before capture.

### 4-level SubTask tree hierarchy

Before: SubTasks rendered flat under the SUBTASK artifact (`5.1.1`, `5.1.2`, ..., `5.1.8`) with the `subtask_decomposition_for_us_NNN_*` intro and `qa_subtasks_mandatory_for_every_story` header showing as separate siblings.

After: SubTasks group under their parent User Story, and QA SubTasks form a sibling group at the same depth:

```text
5.1   SUBTASK-MOD-04
  5.1.1   US-074 — Backend: Check and Decrement Verification Quota   ← tooltip on hover
    5.1.1.1   ST-US074-BE-01
    5.1.1.2   ST-US074-BE-02
    5.1.1.3   ST-US074-BE-03
    5.1.1.4   ST-US074-BE-04
    5.1.1.5   ST-US074-BE-05
  5.1.2   QA SubTasks (Mandatory for Every Story)
    5.1.2.1   ST-US074-QA-01
```

`buildSubtaskGroups` in `ArtifactTree.tsx` parses sectionKeys (`st_us074_be_01_*` → US-074 / BE / 01) to assign each leaf to its US group, with all `_qa_*` subtasks across stories collected into a single QA bucket. The `subtask_decomposition_for_us_NNN_*` and `qa_subtasks_mandatory_*` rows are dropped as separate nodes — their `sectionLabel`s feed the group node labels (parenthetical metadata stripped for the visible label, preserved for the `title=` tooltip). The same grouping mirrors in the preview-page TOC so /preview matches the editor tree.

Tooltips were added on `truncate` labels throughout (artifact, FRD feature, USER_STORY leaf, SUBTASK group + leaf) so users with a fixed-width sidebar can see the full text without expanding the panel.

### Files touched (post-v4)

| File | Change |
| --- | --- |
| `ProjectSourceCode/backend/src/ba-tool/ba-artifact-export.service.ts` | Project Structure table + Directory Map preformatted block; Mermaid → PNG via puppeteer; Traceability split |
| `ProjectSourceCode/backend/src/ba-tool/templates/artifact-html.ts` | Traceability split + Project Structure table + Directory Map block in PDF/HTML template |
| `ProjectSourceCode/frontend/components/ba-tool/MarkdownRenderer.tsx` | `kv_table` + `tree` block types; Traceability split; Project Structure / Directory Map detection |
| `ProjectSourceCode/frontend/components/ba-tool/ArtifactTree.tsx` | `subtaskGroups` 4-level hierarchy; tooltips on truncated labels; search match across new groups |
| `ProjectSourceCode/frontend/app/ba-tool/preview/[kind]/[id]/page.tsx` | SUBTASK preview TOC mirrors the tree's group hierarchy |
| `ProjectSourceCode/backend/scripts/delete-broken-subtask-artifact.ts` | One-shot Prisma cleanup for orphaned DRAFT SUBTASK artifacts (dry-run by default; `--apply` to execute) |
| `ProjectSourceCode/backend/scripts/inspect-subtask-artifact.ts` | Read-only inspection of a SUBTASK artifact's section keys/labels/lengths |
| `ProjectSourceCode/backend/scripts/peek-subtask-content.ts` | Sanity check that a sample body uses the expected stack (NestJS / Next.js / Prisma / no Java) |
| `Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-05-create-subtasks-v2.md` | Heading hierarchy rules; Section 20 example switched from Java/Spring Boot to NestJS / Next.js / Prisma; Traceability split parser contract |

### Known limitations carried over

- **SKILL-05 single-shot only covers one user story per execution.** This was the trade-off for reverting the per-story loop. A safe per-story orchestration mode (one AI call per story, each response split independently and **appended** to the same SUBTASK artifact) is designed but not yet implemented — see future work below.
- **Heading hierarchy is enforced by prompt only.** A defensive splitter that ignores `###` lines inside a `## ST-US...` block would close the loop, but isn't in place yet.

### Future work

- Per-story SKILL-05 orchestrator (append-mode) so a single execution covers all ~22 stories of a module
- Defensive splitter that clamps `###` inside a SubTask body
- Automated regression test that downloads DOCX + PDF for a known SUBTASK artifact and asserts on table count + image count

---

Generated as part of the **G4 (Architecture diagram refresh)** backlog item. Tracks every feature shipped in v4 including post-PRD expansions, and supersedes the v3 walkthrough as the canonical "current state" document.

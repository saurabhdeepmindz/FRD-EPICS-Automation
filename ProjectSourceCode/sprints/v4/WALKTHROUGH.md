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

- Automated regression test that downloads DOCX + PDF for a known SUBTASK artifact and asserts on table count + image count
- Per-module bulk run (one CLI command kicks off all 27 stories in sequence with checkpoints)
- Ability to re-generate a single SubTask body without redoing the whole story

---

## Post-v4 patches — Per-story SKILL-05 + renderer hardening (April 25, 2026)

The previous "Post-v4 patches" section was the recovery from the broken concatenated per-story loop. This second round of patches addresses the original "first-story-full, rest-compressed" coverage gap **without** the regression that bit us last time, plus a long tail of renderer fixes once we started looking at real generated output across 27 stories.

### Per-story SKILL-05 append-mode

The v4 SKILL-05 was strictly single-shot: one AI call, one user story decomposed, the other 21+ silently dropped. The reverted concatenated loop (now history) tried to fix this by stitching N AI responses into one document and running the splitter once — which let the AI's `### Section N` sub-headings inside SubTask bodies fragment into 2,737 separate DB rows.

The new **per-story append-mode** orchestrator pattern:

1. Caller hits `POST /api/ba/modules/:id/execute/SKILL-05/story/:storyId` once per story
2. `executeSkill05ForStory` finds (or creates) the module's SUBTASK `BaArtifact`, idempotency-skips when the story already has `st_us<NNN>_*` rows, otherwise calls the AI with a **single-story focus prompt** + the full module context
3. Each AI response is parsed and split **in isolation** (so the splitter only ever sees one story's worth of `## ST-US...` sections — identical in shape to the working single-shot path)
4. The resulting BaArtifactSection rows are **appended** to the SUBTASK artifact, not written to a new artifact

The intentional design rule: each AI response is processed exactly the same way the single-shot path processes its response. We never concatenate multiple stories' outputs and then split. The splitter is a generic markdown-heading splitter — feeding it one story keeps it predictable.

Idempotency: re-running the same `storyId` skips when `st_us<NNN>_*` keys already exist on the artifact. Lets a long loop be retried on partial failures (429 backoff, network blip, etc.) without duplicating sections.

A new helper endpoint `GET /api/ba/modules/:id/subtask-stories` enumerates the user-story IDs from the latest APPROVED SKILL-04 humanDocument so a caller can drive the per-story loop without re-parsing the doc itself.

**Why we still need the prompt prefix even though SKILL-04 worked the same way:** SKILL-04's per-feature pattern emits user stories with `# User Story:` (level 1) and `### Section N` (level 3). Our SubTask shape uses `## ST-US...` (level 2) for separators and `#### Section N` (level 4) for fields, so the splitter can stay at level 1–3 globally without fragmenting SubTask bodies. The prompt enumerates all 25 canonical Section labels explicitly so the AI doesn't improvise alternate names like "Algorithm Outline" instead of "Algorithm" or "SubTask Description" instead of "Description".

### Defensive splitter clamp (belt-and-suspenders)

Even with the prompt enumeration above, a future model upgrade or prompt slip could re-introduce `### Section N` inside a SubTask body. `splitIntoSections` now tracks an `insideSubtaskBody` flag that flips on at every `## ST-US...` heading and flips off at the next `^#`/`^##`. While the flag is set, `^###` lines are kept in body content rather than starting a new section. Non-SubTask artifacts never carry a `## ST-US...` heading, so the clamp is a no-op for FRD/EPIC/USER_STORY/SCREEN_ANALYSIS.

### Section 19 — Traceability table fixes (3 separate issues found in real output)

**Issue 1 — bare `/* */` comments rendering as bullet lists.** The AI emits Section 19's Traceability block as a C-style comment where each metadata line is prefixed with `*` followed by `Key: Value`. Both the frontend MarkdownRenderer and the backend HTML/PDF template's markdown parser were matching that leading `*` against the unordered-list rule (`^[-*+]\s+`), turning the comment body into a `<ul>` with one `<li>` per metadata line. The DOCX path was never affected because its parser had a `^/\*` branch that ran before list detection.

Fix: both renderers now intercept `^/\*` at the parser entry point, capture all lines until `*/` as a single paragraph block, and let the existing Traceability detection convert it into a 2-column KV table.

**Issue 2 — missing second table when no TBD entries.** The Traceability splitter pushes a `TBD-Future Dependencies` group only when at least one Key:Value row was captured under that header. For CONFIRMED stories the AI typically writes `* None for this SubTask.` — a sentence, not a Key:Value pair — so the second group ended up empty and was suppressed.

Fix: the parser now tracks `seenTbdHeader` separately and at flush time:

- If we saw the literal `TBD-Future Dependencies:` header but captured zero rows, it pushes one placeholder row: `Status / None — this SubTask has no TBD-Future dependencies`
- If the AI omitted the header entirely, the same placeholder group is appended at the end

Result: every SubTask's Section 19 always renders TWO tables — main Traceability metadata, then TBD-Future Dependencies (real entries or placeholder).

**Issue 3 — CONFIRMED-PARTIAL stories getting the placeholder instead of real TBD entries.** For stories that *do* have TBD-Future references in the parent story content, the AI was still defaulting to "None for this SubTask" on individual SubTasks several layers removed from the actual TBD integration. The "carry forward" model in the skill file mandates that *every* SubTask of a CONFIRMED-PARTIAL story carries the TBD context with stub guidance — even pure UI tasks should declare `Indirect — consumes data shape from <other SubTask>` in the Affected line.

Fix: the per-story prompt now has a dedicated CONFIRMED-PARTIAL clause that:

- Tells the AI when to spot a CONFIRMED-PARTIAL story (Story Status field in the user-story doc + presence of `[TBD-Future]` markers / `TBD-NNN` tokens)
- Mandates real TBD-NNN / Assumed / Stub / Affected / Resolution rows in every SubTask's Section 19
- Allows `Affected: Indirect — ...` for layers-removed SubTasks but requires the other 4 lines unchanged

The same rule was added to the skill file so future regenerations of the prompt keep the contract.

### Section 20 — Project Structure inside fenced code blocks

The AI sometimes wraps the Section 20 body in a ```` ```text ``` ```` fence to preserve indentation. The earlier paragraph-only detection in the renderers missed these. All three renderers now detect Project Structure inside a fenced block too and emit the canonical KV table + Directory Map preformatted output. The per-story prompt was also updated to ask the AI to emit Section 20 as plain text (no fence), but the renderer fallback handles either shape.

### Streaming downloads for large artifacts

A 27-story SUBTASK PDF carries ~30 Mermaid diagrams + screen images and weighs ~20 MB. The original download path buffered the response through `axios → arraybuffer → Blob → URL.createObjectURL → a.click()`, which fails with `Network Error` on large payloads — Chrome's network stack chokes on the chunked response when buffered in JS heap.

Fix: replaced with a direct anchor href pointing at the backend export URL. The browser's native streaming downloader handles the file the same way as right-click → Save As. No JS heap involved, no axios timeout, no Blob size limit. Works for any artifact size and removes the need for the recently-bumped 300-second timeout (left in place as a safety net for the legacy Blob path elsewhere in the app).

Two paths updated: the Preview-page Download buttons (`/ba-tool/preview/...`) and the Editor toolbar PDF/DOCX buttons.

### Operational milestone — all 27 MOD-04 stories generated

`SUBTASK-MOD-04` artifact was rebuilt from scratch using the per-story append flow:

| Metric | Value |
|---|---|
| `BaArtifactSection` rows | 174 |
| Decomposition group headers | 27 (one per story) |
| Implementation + QA SubTask bodies | 147 |
| Stories covered | US-052 through US-078 |
| CONFIRMED stories | 12 (Section 19 placeholder TBD-Future row) |
| CONFIRMED-PARTIAL stories | 15 (Section 19 real TBD-001/002/003 entries with stub guidance) |

DOCX export of the artifact: ~820 KB, 30+ tables, ~30 Mermaid PNGs, renders in ~98 seconds. PDF export: ~19.5 MB, renders in ~19 seconds.

### New helper scripts (under `ProjectSourceCode/backend/scripts/`)

| Script | Purpose |
| --- | --- |
| `delete-broken-subtask-artifact.ts` | Cleans orphaned DRAFT SUBTASK artifacts; dry-run by default, `--apply` to execute |
| `inspect-subtask-artifact.ts` | Lists section keys / labels / content lengths for a module's SUBTASK artifact |
| `peek-subtask-content.ts` | Dumps a single section's content for visual inspection |
| `peek-shape-checks.ts` | Heuristic shape check for one section (24 headings, Traceability, Project Structure, Mermaid, NestJS markers, Java leak) |
| `peek-sections-20-and-traceability.ts` | Side-by-side dump of Section 20 + Section 19 used during the renderer-parity work |
| `dump-section-content.ts` | One-liner full body dump |
| `verify-canonical-sections.ts` | Verifies all 25 canonical Section labels are present in a SubTask body — used to catch label drift mechanically |
| `verify-tbd-parser.ts` | Unit-style demonstration that the Traceability KV-group parser correctly emits the placeholder for empty TBD-Future and real rows for CONFIRMED-PARTIAL inputs |
| `list-story-statuses.ts` | Per-story-block scan of the SKILL-04 humanDocument to list status (CONFIRMED vs CONFIRMED-PARTIAL) and TBD-NNN refs for each story |
| `check-story-status.ts` | Drill-down for one specific story's source content + status detection |
| `inspect-skill04-executions.ts` | Lists all SKILL-04 executions for a module with their story counts — diagnoses "wrong story set picked up" issues when SKILL-04 has been re-run multiple times |
| `summary-subtask-counts.ts` | Per-story FE/BE/IN/QA SubTask tally + grand total for the SUBTASK artifact |

### Files touched in this round

| File | Change |
| --- | --- |
| `ProjectSourceCode/backend/src/ba-tool/ba-skill-orchestrator.service.ts` | `executeSkill05ForStory`, `listUserStoriesForModule`, `callAiServiceWithRetry`, `extractStorySlice`; defensive splitter clamp inside `splitIntoSections`; per-story prompt with all 25 canonical labels enumerated and CONFIRMED-PARTIAL TBD clause |
| `ProjectSourceCode/backend/src/ba-tool/ba-skill.controller.ts` | `GET /api/ba/modules/:id/subtask-stories`, `POST /api/ba/modules/:id/execute/SKILL-05/story/:storyId` |
| `ProjectSourceCode/backend/src/ba-tool/ba-artifact-export.service.ts` | Project Structure detection inside fenced blocks; TBD-Future placeholder when group ended empty; Traceability split contract kept aligned with the other two renderers |
| `ProjectSourceCode/backend/src/ba-tool/templates/artifact-html.ts` | `^/\*` branch in markdown parser; Project Structure inside fenced blocks; TBD-Future placeholder; Traceability split |
| `ProjectSourceCode/frontend/components/ba-tool/MarkdownRenderer.tsx` | `^/\*` branch in `parseMarkdown`; bare-comment Traceability detection in `postProcessBlocks`; Project Structure inside fenced blocks; empty-TBD placeholder |
| `ProjectSourceCode/frontend/app/ba-tool/preview/[kind]/[id]/page.tsx` | Preview-page Download switched to anchor href streaming; previously also gained the 300s axios timeout (still useful as fallback for other call sites) and surfaced-error reporting |
| `ProjectSourceCode/frontend/components/ba-tool/ArtifactContentPanel.tsx` | Editor toolbar Download switched to anchor href streaming |
| `Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-05-create-subtasks-v2.md` | CONFIRMED-PARTIAL TBD-Future enforcement clause; expanded Section 19 parser-contract section to cover both CONFIRMED and CONFIRMED-PARTIAL cases |

### Carryover lessons for future skill work

- **Always enumerate canonical Section labels in the orchestrator prompt.** The skill file's section-by-section template is comprehensive but sits in 800+ lines of context; the AI pattern-matches a memorised template instead. Spelling out `#### Section N — <Label>` in a list at the top forces it to use the exact labels.
- **Splitter clamps belong in the orchestrator, not the renderer.** The 2,737-fragment regression was a parser-side bug; once fixed there, every renderer benefits automatically.
- **Renderer parity has a price — when the AI changes one shape, three renderers need updating in lockstep.** The duplicated `extractProjectStructureBlock` / `extractKvBlockAsGroups` helpers in DOCX, PDF, and frontend MarkdownRenderer are intentional copies; any change must be applied to all three. A regression test that downloads DOCX + PDF for a known SubTask and diffs the table count would catch the asymmetric update we hit twice during this round.
- **Network-buffered downloads break for large artifacts on real browsers.** Always prefer `<a href>` streaming for files > a few MB.

---

## Round N+2 — White-box mode 2c, LLD validator, mermaid sanitizer, tree feature sub-grouping (2026-04-26 → 2026-04-28)

> Commit `67e6cf2` — 19 files, 3,900 insertions / 236 deletions.

### Summary

After the per-story SKILL-05 round, the natural next gaps surfaced on **MOD-04** (a 9-feature module with 7+ stories): the FTC pipeline produced black-box test cases but no white-box, LLD generation drifted to a per-user-story document on large modules, the validator gave false positives on stack-aware quotas, and the FTC stepper's left tree was an unstructured flat list of 180 TCs. This round closes all four gaps.

The shipped pipeline now runs **mode 2 (per-feature black-box) → mode 2b (per-category) → mode 2c (per-feature white-box) → mode 3 (narrative + structural)** as a single idempotent `executeSkill07Complete` orchestration. The LLD pipeline gains a deterministic completeness validator with per-section regen ($0.05/section vs $0.50 full-rerun) and a mermaid sanitizer that auto-fixes the two AI failure modes the renderer rejects.

### Architecture (additions to the v4 picture)

```text
                         BA Tool — FTC pipeline (post-67e6cf2)
                         ─────────────────────────────────────

  POST /generate-ftc/complete (one-button stepper)
       │
       ├──▶ executeSkill07ForFeature  (mode 2)  ──── black-box per feature
       │     • TC IDs: TC-04-01-NNN / Neg_TC-04-01-NNN
       │     • Idempotent on linkedFeatureIds
       │
       ├──▶ executeSkill07ForCategory (mode 2b) ──── Security / UI / Performance / …
       │     • TC IDs: TC-SEC-NNN / TC-UI-NNN / …
       │     • Driven by ftcConfig.testTypes
       │
       ├──▶ executeSkill07ForFeatureWhiteBox (mode 2c — NEW)
       │     • Only when LLD artifact exists for the module
       │     • TC IDs: WB-04-01-NNN / Neg_WB-04-01-NNN
       │     • scope=white_box, linkedPseudoFileIds → BaPseudoFile UUIDs
       │     • Tests target class invariants / algorithm steps / exception paths
       │
       └──▶ executeSkill07Narrative (mode 3) ──── §1-§5 / §9-§16 + structural §5-§8


  BA Tool — LLD pipeline (post-67e6cf2)
  ─────────────────────────────────────

  POST /generate-lld
       │
       └──▶ executeSkill('SKILL-06-LLD')
              │
              ├─▶ wrapSkill06Prompt   (NEW orchestrator override)
              │     • Forbids per-user-story scope drift
              │     • Hard-codes 19 canonical heading labels
              │     • Mermaid syntax rules (parens / slashes / erDiagram types)
              │     • Frontend pseudo-file quotas (Next.js + Tailwind specifics)
              │
              ├─▶ AI call (~3-5 min, ~$0.50)
              │
              ├─▶ mermaid-sanitizer (NEW post-process)
              │     • Auto-quotes graph node labels with parens/slashes
              │     • Lowercases erDiagram types (UUID → uuid, Enum → string)
              │
              ├─▶ BaLldParserService.parseAndStore
              │     • Idempotent: first-wins on duplicate sectionKey,
              │       update-existing for AI-generated rows
              │
              └─▶ extendRtmWithLld

  GET  /lld/validate  (deterministic, $0)
       └──▶ BaLldParserService.validateCompleteness
              • Per-section presence + thinness check
              • Pseudo-file shortfall vs feature count
              • Stack-aware frontend coverage:
                  - App Router pages
                  - Route handlers (lower target when full backend stack present)
                  - Components (1.5× feature count)
                  - Frontend tests
              • Recognises frontend/features/*api.ts as route-handler-equivalent

  POST /execute/SKILL-06-LLD/section/:sectionKey  (mode 06b — NEW)
       └──▶ executeSkill06ForSection
              • Focused AI call to regenerate ONE canonical section
              • Idempotent on isHumanModified
              • ~$0.05/call vs ~$0.50 full re-run
```

### Files created/modified

#### Backend (10 files)

| File | Purpose |
| --- | --- |
| `ba-skill-orchestrator.service.ts` | New methods: `executeSkill07ForCategory` (mode 2b), `executeSkill07ForFeatureWhiteBox` (mode 2c), `listFeaturesMissingWhiteBox`, `listMissingCategoriesForCoverage`, `executeSkill06ForSection` (mode 06b), `wrapSkill06Prompt`. Existing: `executeSkill07Complete` extended with mode 2c step; `wrapSkill07Prompt` strengthened with explicit format rules; `deriveLldSuffix` combines backend + frontend stacks; per-feature/per-category/white-box paths refresh `mod.ftcArtifactId` when creating new artifact (root-cause fix for stale-pointer bug). |
| `ba-ftc-parser.service.ts` | `parseAndStore` idempotent: append for `test_case_appendix`, first-wins for narrative; new deterministic `renderStructuralSections` builds §5/§6/§7/§8 from BaTestCase rows (no AI cost). |
| `ba-ftc.controller.ts` | New endpoints: `POST /execute/SKILL-07-FTC/category/:category`, `POST /execute/SKILL-07-FTC/white-box/:featureId`, `POST /execute/SKILL-07-FTC/complete`. |
| `ba-ftc.service.ts` | `getFtcArtifact` falls back to latest-by-moduleDbId when `mod.ftcArtifactId` is stale (self-healing). |
| `ba-lld-parser.service.ts` | `parseAndStore` runs the mermaid sanitizer pre-parse, then idempotent section storage (first-wins for human-modified rows, update-existing for AI-generated). New `validateCompleteness` returns `{ sections[], pseudoFiles, frontendCoverage, gaps[], isComplete }` — deterministic, no AI call. Stack-aware route-handler target. |
| `ba-lld.controller.ts` | New endpoints: `GET /lld/validate`, `POST /execute/SKILL-06-LLD/section/:sectionKey`. |
| `mermaid-sanitizer.ts` (NEW) | Pure utility: `sanitizeMermaidInMarkdown(md)` walks every ` ```mermaid ` block, auto-quotes unsafe `[label]` brackets in `graph`/`flowchart`, lowercases erDiagram types. Idempotent. |
| `scripts/compare-ftc-fields.ts` (NEW) | Side-by-side TC field-population audit (MOD-01 vs another module). |
| `scripts/delete-lld-artifact.ts` (NEW) | Wipe LLD artifact + pseudo-files + sections + executions; clears `BaModule.lldArtifactId`. |
| `scripts/merge-ftc-appendix-and-render.ts` (NEW) | One-time fixup: merge multiple `test_case_appendix` rows into one + trigger structural-sections render. |
| `scripts/sanitize-lld-mermaid.ts` (NEW) | Bulk mermaid sanitize pass on existing LLD artifacts (dry-run by default, `--apply` to execute). |

#### Frontend (5 files)

| File | Purpose |
| --- | --- |
| `lib/ba-api.ts` | New API client functions: `validateLld`, `regenerateLldSection`, `generateFtcWhiteBoxForFeature`, `listFtcFeaturesForModule`, `refreshFtcNarrative`, `generateFtcComplete` (extended with `perFeatureWhiteBox`). New types: `LldValidationReport`, `LldFrontendCoverage`, `LldSectionRegenResult`, `FtcCompleteResult`, `FtcWhiteBoxResult`. |
| `components/ba-tool/LldValidationCard.tsx` (NEW) | Validation card on AI LLD Workbench: top-row counters (sections / pseudo-files / feature coverage), gap list, per-section regen buttons (~$0.05 each), frontend-coverage panel (App Router pages / route handlers / components / tests / features without page reference). Always visible — yellow callout when no LLD artifact yet. |
| `components/ba-tool/ArtifactTree.tsx` | Two-level grouping inside FTC category buckets: `Functional Test Cases (143) → F-04-01 — Search Previous Chats (14) → TC-04-01-001…`. Reads feature names from same-module FRD artifact via `parseFrdContent`. UNGROUPED bucket for TCs without `linkedFeatureIds`. White-Box Test Cases bucket gets the same feature sub-grouping. Backwards-compatible. Plus: canonical-order sort for FTC sections. |
| `app/ba-tool/project/[id]/module/[moduleId]/lld/page.tsx` | Mounts `<LldValidationCard>` between Upstream Inputs and the Tech Stack form. |
| `app/ba-tool/project/[id]/module/[moduleId]/ftc/page.tsx` | New `Generate White-Box` button in the header (outline, between Save config and Generate FTC). Disabled when LLD or FTC missing — tooltip explains which prerequisite is blocking. Sequential per-feature loop with progress strip ("Generating white-box for F-04-03 (3 of 9)…"), structural-sections refresh at the end, summary alert. `Generate FTC` button alert now reports `perFeatureWhiteBox` step too. Timeout bumped 16 min → 25 min for the longer pipeline. |
| `app/ba-tool/preview/[kind]/[id]/page.tsx` | FTC sections sort by canonical `FTC_SECTION_ORDER` (Summary → Test Strategy → … → Test Case Appendix), so the preview TOC matches MOD-1's structure regardless of DB insertion order. |

#### Skill files (2 files)

| File | Change |
| --- | --- |
| `FINAL-SKILL-06-create-lld.md` | Added `Mermaid syntax rules` section (graph node label quoting, erDiagram type lowercase, arrow target IDs). Added `Frontend pseudo-file quota` section (Next.js + Tailwind App Router pages, route handlers, layouts, components, frontend tests, Tailwind utilities). Added `Module-wide scope, NOT per-user-story` rule to Hard Rules. Heading-count corrected from 15 → 19 throughout (long-standing inconsistency). |
| `FINAL-SKILL-07-create-ftc.md` | §1b modes table extended from 3 modes to 6 (added 2b, 2c, complete pipeline). Author rules added for mode 2 (feature-prefixed TC IDs, scenarioGroup as label not feature ID), mode 2b (per-category), mode 2c (per-feature white-box). Recommended flow updated to 5 steps. |

### How key pieces work

**`wrapSkill06Prompt` — anti-per-story-drift wrapper.** The bug it fixes was real: on MOD-04 (9 features, 7 stories) the AI emitted a single-story LLD scoped to F-04-08 / US-074 with non-canonical headings (`## 1. Identification`, `## 2. RTM Traceability`, `## 3. @frdContext`, `## 4. Public Contract`). The parser stored those under non-canonical keys, leaving 17 of 19 canonical slots empty. The wrapper hard-codes the 19 heading labels in the prompt + explicitly forbids the per-story patterns we observed. Same regression class as the FTC mode-1 single-story drift fixed in v4 round 1.

**`mermaid-sanitizer.ts` — deterministic AI output cleanup.** Mermaid 11+ rejects two AI tics: unquoted `[label]` brackets containing parens/slashes (`A[Foo (TBD)]`, `J[List/Details]`) and capitalised erDiagram column types (`UUID userId PK`, `Enum status`). The sanitizer walks every ` ```mermaid ` block in a markdown string, applies the right transformation per block type (`graph` / `flowchart` / `erDiagram`), and is idempotent. Wired into `BaLldParserService.parseAndStore` before splitting the document so corrected blocks land in the DB. Bulk-fixup script `sanitize-lld-mermaid.ts` runs it across an existing artifact's section content for retroactive cleanup.

**`validateCompleteness` — stack-aware completeness check.** Reads the artifact's sections + pseudo-files, scans `linkedFeatureIds` references in pseudo-file content, and emits a structured report. The frontend-coverage block only runs when `lldConfig.frontendStackId` is non-null. It detects whether a "full backend stack" (NestJS / Spring / FastAPI / Django / Express / Rails / .NET / Flask / Echo / Gin / Koa / Hapi / Laravel) is selected; if so, route-handler target drops from `featureCount × 0.7` to `featureCount × 0.2` because the frontend can call the backend service directly via api-client hooks. Path heuristic recognises `frontend/features/*api.ts` as route-handler-equivalent. Components target softened from `2× feature count` to `1.5× feature count`.

**Mode 2c per-feature white-box loop.** `executeSkill07ForFeatureWhiteBox(moduleDbId, featureId)`:

1. Asserts an LLD artifact exists (else throws — white-box has no class/method surface to cite).
2. Filters LLD pseudo-files to those whose content references `featureId` in their Traceability docstring.
3. Builds a focused prompt with: file list (path + first 12 lines per file), white-box-specific TC ID convention (`WB-04-01-NNN` / `Neg_WB-04-01-NNN`), required `scope=white_box`, required `linkedLldArtifactId`, required `linkedPseudoFileIds`, framework hint (Vitest / JUnit / pytest unit, not Playwright).
4. AI call → `parseAndStore` → backfill: enforce `scope=white_box`, `linkedLldArtifactId`, single `linkedFeatureIds` entry, resolve pseudo-file paths in TC body to BaPseudoFile UUIDs.
5. Idempotent: re-runs skip features that already have white-box TCs on the artifact.

Validated on MOD-04 F-04-08 as a de-risk pass: 10 white-box TCs in ~73 s, all 10 with `scope=white_box` ✓ + `linkedLldArtifactId` ✓ + 1-3 pseudo-file UUIDs each, real class/method coverage (`VerificationQuotaService.checkAndDecrementQuota — Quota Exceeded`, `QuotaManagementServiceStub.decrementQuota throws ServiceUnavailableException`, etc.). Then ran for the remaining 8 features via `executeSkill07Complete` — added 72 white-box TCs across F-04-01..07/09 (8-10 each). Final MOD-04 state: **180 TCs (98 black-box + 82 white-box) across 5 categories**, every feature 18-24 TCs.

**Tree feature sub-grouping.** Inside the existing per-category synthetic groups in `ArtifactTree.tsx`, TCs are now bucketed by their first `linkedFeatureIds` entry (with an `(Ungrouped)` bucket for TCs without a feature link). Feature buckets sort by feature ID using locale + numeric (so `F-04-09` < `F-04-10`). Feature names come from `parseFrdContent` on the same-module FRD artifact — falls back to bare ID when no FRD found. Three levels deep: `<artifact>.<category>.<feature>.<tc>` e.g. `6.1.13.1.5`.

**Self-healing `mod.ftcArtifactId` pointer.** Root cause: per-feature mode-2 created new FTC artifacts but didn't update `mod.ftcArtifactId`. After a wipe + per-feature regen, the pointer pointed at a deleted row, so `getFtcArtifact` returned null and the white-box button stayed disabled (its prerequisite check was `!!ftc?.artifact`). Two-part fix: (a) `getFtcArtifact` now falls back to latest-by-moduleDbId when the pointer doesn't resolve, (b) per-feature / per-category / per-feature-white-box paths now refresh the pointer when they create a new artifact. Either fix alone would solve the symptom; both together make the system self-healing AND prevent the same gap on future modules.

### Test coverage delta

| Layer | Before | After | New tests |
| --- | --- | --- | --- |
| Backend unit | (no Jest tests added in this round) | unchanged | — |
| Integration | (no Supertest tests added) | unchanged | — |
| Manual / smoke (curl + DB inspection) | per-feature mode 2 verified, narrative mode 3 verified | per-category mode 2b verified (Security/UI/Performance × MOD-04), per-feature white-box mode 2c verified (F-04-08 de-risk + remaining 8 via complete pipeline), validator endpoints verified, mermaid sanitizer verified (MOD-04 module dependency + schema diagrams render after sanitize) | New audit scripts under `scripts/` are de-facto regression checks for the data shape. |

### Security

No security surface change in this round. White-box TCs cite class/method names but never embed secrets, credentials, or environment values from the LLD pseudo-files (the LLD itself uses `// TODO:` bodies with no real logic). The validator endpoint reads existing artifact rows; no auth changes.

### Known limitations

- **No automated tests** for the new orchestrator methods. Manual verification via curl + DB audit scripts is the regression net. A future round should add Jest tests for `executeSkill07ForFeatureWhiteBox` and `validateCompleteness` since they have non-trivial path heuristics.
- **Multi-stack support is still a workaround.** The single-select dropdowns for frontend / backend stacks force the architect to combine into one master-data entry (`Next.js + Tailwind`). Proper schema migration to `frontendStackIds String[]` is documented but deferred.
- **Frontend tests heuristic is approximate** — the validator's "8/9" warning on MOD-04 is cosmetic; the AI emitted 8 component tests covering all major flows but the floor is `featureCount` which produces a 1-off mismatch.
- **Per-feature mode-2 still under-populates `linkedSubtaskIds`** (~10% of TCs cite a subtask vs MOD-1's 76%). Not blocking — feature/EPIC/US linkage is sufficient — but worth strengthening the prompt in a future round.
- **Tree feature sub-grouping doesn't yet handle TCs that genuinely span multiple features** (e.g. cross-feature integration tests). Currently shown under their first `linkedFeatureIds` entry only. Defensible default; could be revisited if architects request multi-bucket display.

### Carryover lessons for future skill work

- **Same regression class hits SKILL-06 as SKILL-07**: under deep context (10+ features × stories × subtasks), the AI pattern-matches to a per-user-story document instead of the canonical module-wide structure. The corrective is identical across skills — wrap the prompt with hard-coded heading labels + explicit forbidden patterns. SKILL-04 already had its per-feature-loop fix; SKILL-05 had its per-story-loop fix; now SKILL-06 has its module-wide-scope wrapper and SKILL-07 has its per-feature/per-category/per-feature-white-box loops. Five out of seven skills now have orchestrator overrides.
- **Stack-aware heuristics matter.** The validator's first cut flagged 5 gaps on MOD-04, but 4 of them were heuristic false positives caused by NestJS-paired Next.js (where route handlers are optional and `frontend/features/*api.ts` plays the route-handler role). One round of tuning made the validator green for the actual structural reality. Future heuristics should be **stack-aware from day 1** — read `lldConfig.backendStackId` etc. before applying targets.
- **Self-healing > pointer-update everywhere.** The stale `mod.ftcArtifactId` bug had two layers of cause (missing pointer refresh in 3 orchestrator paths) and one symptom (white-box button disabled). Adding the pointer refresh in all 3 places is necessary, but adding the fallback `getFtcArtifact → latest-by-moduleDbId` is what makes the system survive future similar bugs without disrupting users.
- **Idempotency is the test plan.** Every new mode (2b, 2c, complete pipeline, per-section regen, validator) is idempotent. The "test plan" for the architect is "click the button twice — second click is a fast no-op". This is also how I de-risked the white-box rollout — first F-04-08 alone ($0.05), then the remaining 8 via the complete pipeline (idempotent skip on F-04-08). Cheaper, safer, more diagnostic than running everything in one shot.

---

Generated as part of the **G4 (Architecture diagram refresh)** backlog item. Tracks every feature shipped in v4 including post-PRD expansions, and supersedes the v3 walkthrough as the canonical "current state" document.

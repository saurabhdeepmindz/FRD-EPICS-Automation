# BA Tool — Prioritized Backlog

> Living document. Updated after every execution so we always know what's next.
> **Last updated:** 2026-04-24 — after `82f2ff9 feat(defects): global defect list page`

Priority scale:

- **P0** — Top (do next, blocks or degrades the flow we already shipped)
- **P1** — High (visible gap users will hit within a week)
- **P2** — Medium (quality-of-life, active scope)
- **P3** — Low (nice-to-have, polish)
- **DEFERRED** — Scope-locked items parked for a future sprint (specs preserved so we can resume without re-designing)

---

## Active Lane — what we're working through

### P0 — Do Next

_P0 lane is clear. Next push starts from P1._

### P1 — High

| # | Item | Why | Effort |
|---|------|-----|--------|
| B1 | **Real Sprint entity** — replace string `sprintId` with `BaSprint` table (name, start/end, status) | Currently sprintId is free-text — no validation, no aggregation, no sprint picker. | M |
| B2 | Sprint picker in Record Run dialog (replace text input) | Depends on B1. | S |
| B3 | Sprint burndown chart on dashboard | Depends on B1 + run history. | M |
| B4 | Filter runs/defects by sprint in RTM and FTC views | Depends on B1. | S |
| F3 | **Re-run Playwright export with one click** — ZIP download currently is static; wire it to re-generate after AC changes | AC Coverage verifier already detects drift; wire it in. | S |

### P2 — TDD Codegen (active)

| # | Item | Why | Effort |
|---|------|-----|--------|
| D1 | **Unit-test scaffolds (Jest/Pytest)** derived from pseudo-code functions | Gives devs a failing test on day 1. Closes the loop FRD→EPIC→US→SubTask→LLD→**UnitTest**→FTC. | L |
| D2 | **Contract-test codegen** between service layers identified in LLD | Catches integration breakage early. | L |

### P3 — UX Polish

| # | Item | Why | Effort |
|---|------|-----|--------|
| UX1 | Dark mode toggle | Requested informally. | S |
| UX2 | Keyboard shortcuts (j/k to navigate tree, r to record run, g to generate) | Power users. | S |
| UX3 | Tree search / filter box | Tree gets huge; scrolling is painful. | S |
| UX4 | Drag-drop reorder of TCs within a category | Current order is DB insertion order. | M |
| UX5 | Toast notifications for long-running ops (export ZIP, AI generate) | Currently silent until done. | S |
| UX6 | A11y audit — ARIA labels, keyboard nav, focus order | We haven't checked; likely many misses. | M |

### P3 — Docs

| # | Item | Why | Effort |
|---|------|-----|--------|
| G1 | User manual (screenshots, end-to-end walkthrough) | Onboarding new BAs/testers. | M |
| G2 | Admin guide (env vars, storage backends, Prisma migrations, backup) | Ops handoff. | M |
| G3 | API reference — auto-gen from Nest decorators via `@nestjs/swagger` | Integrators. | S |
| G4 | Architecture diagrams refresh — Phase 2a added 4 new tables | Goes in `sprints/v?/WALKTHROUGH.md`. | S |
| G5 | Video tutorial (5 min end-to-end) | Sales / demo. | M |

### P3 — Security Hardening

| # | Item | Why | Effort |
|---|------|-----|--------|
| H1 | Input sanitization audit across all controllers | No systematic review done yet. | M |
| H2 | Virus scan on uploaded attachments (ClamAV) | Currently raw upload. | S |
| H3 | Secret rotation — OPENAI_API_KEY, DATABASE_URL via Vault/KMS | Today secrets live in `.env`. | M |
| H4 | Pen-test hardening pass | Pre-production gate. | L |

---

## DEFERRED Lane — parked for a future sprint (specs preserved)

### F2 — Issue Tracker Integrations (Monday / Jira / ADO)

**Decision (2026-04-24):** Build later, but scope locked.

- **Architecture:** Pluggable `IssueTracker` interface so one abstraction serves Monday, Jira, ADO.
- **Monday scope (first implementation):**
  - **Board mapping:** one Monday board **per BA project** (not global). Project schema needs `mondayBoardId` column.
  - **Severity column:** build-side creates a new "Severity" status column on each project board with P0/P1/P2/P3 swatches. Column IDs captured at board-create time and persisted in project row.
  - **Auth:** personal API token (OAuth deferred). Env: `MONDAY_API_TOKEN`, `MONDAY_API_URL=https://api.monday.com/v2`.
  - **API:** GraphQL (`create_item`, `change_column_value`, `change_simple_column_value`).
  - **externalRef format:** `monday://item/{itemId}` with `externalUrl = https://{account}.monday.com/boards/{bid}/pulses/{itemId}`.
  - **Status propagation:** when defect status/severity changes in our UI AND externalRef starts with `monday://`, fire async `change_column_value`.
  - **Testing stance:** user has no Monday access right now — build against monday.com API docs, ship, test later when they have credentials.
- **Deferred within the deferred item:** OAuth flow, Monday → us webhook sync, attachment mirroring, board/column picker UI.
- **Estimate when resumed:** M (~4 h) for tracker abstraction + Monday impl + push button + per-project board provisioning.

### E — Enterprise Readiness (all deferred)

| # | Item | Why parked |
|---|------|------------|
| E1 | Multi-tenant isolation (`tenantId` on all BA_* tables) | No second tenant yet |
| E2 | RBAC (BA/Dev/QA/Manager roles + per-project ACLs) | Single-team tool today |
| E3 | Audit log (`ba_audit_log`) | No compliance requirement yet |
| E4 | SSO (SAML/OIDC via next-auth) | No enterprise customer yet |
| E5 | Rate limiting on AI endpoints (per-user quotas) | Single-user budget risk is low |
| E6 | Observability — OpenTelemetry + Prometheus | Debug-via-logs is fine for now |
| E7 | Backup/restore of attachments storage | Disk backup suffices for dev |
| E8 | GDPR — user data export + delete | No EU users yet |

### C — Codegen beyond Playwright (all deferred)

| # | Item | Why parked |
|---|------|------------|
| C1 | Cypress codegen | Playwright covers MVP |
| C2 | Selenium + Java codegen | Playwright covers MVP |
| C3 | WebdriverIO codegen | Playwright covers MVP |
| C4 | Appium (mobile native) codegen | Mobile out of scope now |
| C5 | RestAssured / Postman collections for API-only TCs | API tests run via Playwright request context for now |
| C6 | k6 / JMeter for performance TCs | Perf TCs exist as docs only, no runnable artifact |
| C7 | Pact contract tests | Not a microservices project yet |

---

## Recently Completed (reverse chronological)

- ✅ 2026-04-24 — **Global Defect list page** — new route `/ba-tool/project/[id]/defects` with search + 5 filters (status incl. "Open all" shortcut, severity, sprint, module, reporter); header nav pill shows open-defect count (red when P0/P1 critical); CSV export; "direct" badge for run-less defects; new endpoint `GET /api/ba/projects/:id/defects` (`82f2ff9`)
- ✅ 2026-04-24 — **Standalone "Open defect" button** on each TC — logs bugs outside a formal run (spec review, prod report, ad-hoc exploration); new `POST /api/ba/test-cases/:id/defects` endpoint with nullable `firstSeenRunId`; denormalizes defect ref onto `BaTestCase.defectIds` like the run-triggered flow (`ea0ba94`)
- ✅ 2026-04-24 — **Bulk test-run recording** — multi-select checkboxes per TC, per-group "select all", sticky toolbar with "Run selected (N)" button, modal dialog for shared status/executor/env/sprint/notes; new backend endpoint `POST /api/ba/test-cases/bulk-runs` (200-TC cap, continues on individual failures) (`399b9d8`)
- ✅ 2026-04-24 — **Dashboard tile: Test Execution Health** — pass-rate, stacked bar, PASS/FAIL/BLOCKED/SKIPPED/NOT_RUN pills, open-defect count (with P0/P1 callout), failing + blocked TC drill-downs (top 10 each with deep links to module), new endpoint `GET /api/ba/projects/:id/execution-health` (`17ec30d`)
- ✅ 2026-04-24 — **RTM exec verdict column + filter** — per-row PASS/FAIL/BLOCKED/MIXED/NOT_RUN pill reading denormalized `BaTestCase.executionStatus`; new CSV columns (Pass/Fail/Blocked/Skipped/Not Run) (`2e4008c`)
- ✅ 2026-04-24 — Monday integration scope locked + deferred (decision captured in F2 section above)
- ✅ 2026-04-24 — **AI RCA now ingests attachment evidence** (logs, OCR'd screenshots, docs); per-file 2 KB cap, 8 KB total, system prompt updated to cite filenames (`38f054f`)
- ✅ 2026-04-24 — Tabular run history in ExecutionHistoryPanel (`9520d9d`)
- ✅ 2026-04-23 — Phase 2a: execution tracking + defect capture + AI/tester RCA (`a7dd8b0`)
- ✅ 2026-04-23 — AC coverage reads real user-facing ACs, not FRD process DoD (`00e6454`)
- ✅ 2026-04-23 — AC Coverage verifier + runnable Playwright suite export (`1528a73`)
- ✅ 2026-04-23 — FTC structured view + per-category tree sub-nodes (`9e537d2`, `5a51fc4`, `ccb75a1`)
- ✅ 2026-04-23 — Multi-select testing frameworks + test types (`c40e5ef`)
- ✅ 2026-04-23 — SKILL-07-FTC + AI FTC Workbench + OWASP Web/LLM coverage (`9b33d56`)
- ✅ 2026-04-23 — AI LLD Workbench (narrative + pseudo-code editor + RTM trace) (`5ffc7ae`)

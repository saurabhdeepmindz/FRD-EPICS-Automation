# BA Tool — Prioritized Backlog

> Living document. Updated after every execution so we always know what's next.
> **Last updated:** 2026-04-24 — after `38f054f feat(rca): evidence attachments into AI RCA prompt`

Priority scale:
- **P0** — Top (do next, blocks or degrades the flow we already shipped)
- **P1** — High (visible gap users will hit within a week)
- **P2** — Medium (quality-of-life, enterprise readiness)
- **P3** — Low (nice-to-have, polish)

---

## P0 — Do Next

| # | Item | Why | Effort |
|---|------|-----|--------|
| 1 | **RTM row badges reflect latest run** | BaTestCase already has `executionStatus` + `latestRunId` denormalized. RTM table still shows stale badges. Wire them into [RtmPage](ProjectSourceCode/frontend/app/ba-tool/project/[id]/rtm/page.tsx). | S (~1 h) |
| 2 | **Dashboard tile: "Test Execution Health"** | Module/project dashboard needs a PASS/FAIL/BLOCK roll-up. Without it, managers can't see where the red is. Uses existing `executionStatus` counts. | S (~1 h) |
| 3 | **"Run all" + bulk status for a suite** | Recording runs one-by-one is painful for 30+ TCs. Add multi-select checkbox + bulk-status dropdown in the FTC artifact view. | M (~3 h) |

## P1 — High

| # | Item | Why | Effort |
|---|------|-----|--------|
| B1 | **Real Sprint entity** — replace string `sprintId` with `BaSprint` table (name, start/end, status) | Currently sprintId is free-text — no validation, no aggregation, no sprint picker. | M |
| B2 | Sprint picker in Record Run dialog (replace text input) | Depends on B1. | S |
| B3 | Sprint burndown chart on dashboard | Depends on B1 + run history. | M |
| B4 | Filter runs/defects by sprint in RTM and FTC views | Depends on B1. | S |
| F1 | **Defect list page** (`/ba/project/[id]/defects`) with filters (status/severity/sprint/assignee) | We can open defects but have no global view. | M |
| F2 | **Open defects in Jira/Azure DevOps** via webhook/REST | `externalRef` exists but is manual paste. Auto-push is the killer feature. | L |
| F3 | **Re-run Playwright export with one click** — ZIP download currently is static; wire it to re-generate after AC changes | AC Coverage verifier already detects drift; wire it in. | S |

## P2 — Medium (Enterprise Readiness)

| # | Item | Why | Effort |
|---|------|-----|--------|
| E1 | Multi-tenant isolation (`tenantId` column on all BA_* tables, middleware filter) | Required before any second customer. | L |
| E2 | RBAC — roles (BA, Dev, QA, Manager) + per-project ACLs | Today anyone can edit anything. | L |
| E3 | Audit log (`ba_audit_log` table; who changed what when) | Compliance requirement; also helps debugging. | M |
| E4 | SSO (SAML/OIDC) via `next-auth` | Enterprise customers won't use email/password. | M |
| E5 | Rate limiting on AI endpoints (per-user + per-project quotas) | Today one user can drain OpenAI budget. | S |
| E6 | Observability — OpenTelemetry traces on Nest + Next; Prometheus metrics | Hard to debug prod issues without. | M |
| E7 | Backup/restore of attachments storage | Disk storage has no backup strategy. | S |
| E8 | GDPR — user data export + delete endpoints | Legal requirement in EU. | M |

## P2 — Codegen (non-Playwright)

| # | Item | Why | Effort |
|---|------|-----|--------|
| C1 | **Cypress** codegen template (alongside Playwright) | Many teams mandate Cypress. | M |
| C2 | **Selenium + Java** codegen | Enterprise standard. | M |
| C3 | **WebdriverIO** codegen | Some teams prefer it for mobile web. | M |
| C4 | **Appium** (mobile native) codegen | Different paradigm, separate template set. | L |
| C5 | **RestAssured / Postman collection** for API-only TCs | API TCs don't need a browser. | M |
| C6 | **k6 / JMeter** codegen for performance TCs | Perf TCs are in the template but have no runnable artifact yet. | M |
| C7 | **Pact** contract tests between services | Nice for microservice projects. | L |

## P2 — TDD Codegen

| # | Item | Why | Effort |
|---|------|-----|--------|
| D1 | **Unit-test scaffolds (Jest/Pytest)** derived from pseudo-code functions | Gives devs a failing test on day 1. Closes the loop FRD→EPIC→US→SubTask→LLD→**UnitTest**→FTC. | L |
| D2 | **Contract-test codegen** between service layers identified in LLD | Catches integration breakage early. | L |

## P3 — UX Polish

| # | Item | Why | Effort |
|---|------|-----|--------|
| UX1 | Dark mode toggle | Requested informally. | S |
| UX2 | Keyboard shortcuts (j/k to navigate tree, r to record run, g to generate) | Power users. | S |
| UX3 | Tree search / filter box | Tree gets huge; scrolling is painful. | S |
| UX4 | Drag-drop reorder of TCs within a category | Current order is DB insertion order. | M |
| UX5 | Toast notifications for long-running ops (export ZIP, AI generate) | Currently silent until done. | S |
| UX6 | A11y audit — ARIA labels, keyboard nav, focus order | We haven't checked; likely many misses. | M |

## P3 — Docs

| # | Item | Why | Effort |
|---|------|-----|--------|
| G1 | User manual (screenshots, end-to-end walkthrough) | Onboarding new BAs/testers. | M |
| G2 | Admin guide (env vars, storage backends, Prisma migrations, backup) | Ops handoff. | M |
| G3 | API reference — auto-gen from Nest decorators via `@nestjs/swagger` | Integrators. | S |
| G4 | Architecture diagrams refresh — Phase 2a added 4 new tables | Goes in `sprints/v?/WALKTHROUGH.md`. | S |
| G5 | Video tutorial (5 min end-to-end) | Sales / demo. | M |

## P3 — Security Hardening

| # | Item | Why | Effort |
|---|------|-----|--------|
| H1 | Input sanitization audit across all controllers | No systematic review done yet. | M |
| H2 | Virus scan on uploaded attachments (ClamAV) | Currently raw upload. | S |
| H3 | Secret rotation — OPENAI_API_KEY, DATABASE_URL via Vault/KMS | Today secrets live in `.env`. | M |
| H4 | Pen-test hardening pass | Pre-production gate. | L |

---

## Recently Completed (reverse chronological)

- ✅ 2026-04-24 — **AI RCA now ingests attachment evidence** (logs, OCR'd screenshots, docs); per-file 2 KB cap, 8 KB total, system prompt updated to cite filenames (`38f054f`)
- ✅ 2026-04-24 — Tabular run history in ExecutionHistoryPanel (`9520d9d`)
- ✅ 2026-04-23 — Phase 2a: execution tracking + defect capture + AI/tester RCA (`a7dd8b0`)
- ✅ 2026-04-23 — AC coverage reads real user-facing ACs, not FRD process DoD (`00e6454`)
- ✅ 2026-04-23 — AC Coverage verifier + runnable Playwright suite export (`1528a73`)
- ✅ 2026-04-23 — FTC structured view + per-category tree sub-nodes (`9e537d2`, `5a51fc4`, `ccb75a1`)
- ✅ 2026-04-23 — Multi-select testing frameworks + test types (`c40e5ef`)
- ✅ 2026-04-23 — SKILL-07-FTC + AI FTC Workbench + OWASP Web/LLM coverage (`9b33d56`)
- ✅ 2026-04-23 — AI LLD Workbench (narrative + pseudo-code editor + RTM trace) (`5ffc7ae`)

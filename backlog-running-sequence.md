# Backlog Running Sequence — Module-Scoped Code-Gen (Tracks N → O → P → Q)

> Living **execution order** for the module-scoped code-gen build. Companion to `BACKLOG.md`
> (which holds the full item specs). This file is the *order of operations* — each step is
> built and verified green before the next begins.
>
> **Status Legend:** ⬜ Pending · 🔄 In Progress · ✅ Complete
> **Last updated:** 2026-06-01

---

## Confirmed decisions baked into the sequence

| Decision | Choice |
|---|---|
| Code-gen scope | **Per module** (dropdown), not whole-project |
| Readiness gate | ALL artifacts required; **LLD + Sub-Tasks mandatory** |
| Task ordering | Topological sort of `BaSubTask.prerequisites` |
| Task linkage | Each task links its subtask(s) + pseudo file(s) |
| `/dev` execution | **Run-all + per-task** |
| Tests — Stage 1 | `/dev`-generated dev tests, shown in a **separate** section |
| Tests — Stage 2 | **Separate "Run" button** for FTC-derived Playwright tests + history |
| Dynamic files | New files not in LLD/subtasks → **auto-draft upstream, human approves** |
| J & L | Delivered **through** P-04/P-05 (not built separately first) |

---

## Step-by-step build order

### Step 1 — Foundation: module readiness (Track N backend) — ✅ COMPLETE
- ✅ **N-01** `ModuleReadinessService` (project + module gates; bulk-load, no N+1)
- ✅ **N-02** `GET /ba/projects/:id/code/modules`
- _Verified:_ Tax Compass — all 6 modules blocked only by project Wireframes gate; MOD-01/04/06 otherwise ready.

### Step 2 — Module-scoped runs (Track N backend) — ✅ COMPLETE
- ✅ **N-03** `moduleDbId` on run payload; `ModuleContextService` narrows grounding; `RunManager` gates on readiness.
- _Verified:_ non-ready module → `400 missing: …`; bogus id → `404`.

### Step 3 — Module dropdown UI (Track N frontend) — ✅ COMPLETE
- ✅ **N-04** `ModuleSelector` dropdown + readiness checklist; auto-selects first ready module; scopes/disables run panels.
- _Verified:_ frontend tsc clean; page 200.

### Step 4 — Task schema + plan generation (Track O) — ✅ COMPLETE
- ✅ **O-01** Prisma `BaCodeTask` + `code_tasks.sql` migration (as `prd_user`); client regenerated
- ✅ **O-02** `CodeTaskPlannerService` — deterministic plan from sub-tasks (topo-sort of prerequisites; subtask + pseudo-file + target linkage); `POST .../tasks/plan`
- ✅ **O-03** `GET .../modules/:moduleDbId/tasks`
- _Verified:_ MOD-01 → 6 tasks ordered ST-…-01→06, each linked; idempotent re-plan preserves status.
- _Design note:_ plan is deterministic from sub-tasks (authoritative sequence/linkage); the agentic Claude run is the **executor** (`/dev`, Step 6).

### Step 5 — Tasks panel UI (Track O frontend) — ✅ COMPLETE
- ✅ **O-04** `CodeTasksPanel`: "Generate Plan" + ordered task list (seq · taskKey · title · subtask chips · pseudo-file chips · status badge); scoped to selected module.
- _Verified:_ frontend tsc clean; page 200.

### Step 6 — `/dev` execution + live status (Track P) — ✅ COMPLETE
- ✅ **P-01** `RunManager.startCodeRun` — `/dev` run-all (ordered, stops on failure) **and** per-task; flips `BaCodeTask` status; `task` SSE events; readiness-gated.
- ✅ **P-02** `CodeTasksPanel` live execution — Run All + per-task Run, SSE status flips, /dev log, in-UI permissions.
- _Verified:_ run endpoints gate (`400 missing Wireframes`); tsc clean; page 200. Live status flips fire once a module is ready + key set.

### Step 7 — Test schema + dev-tests capture (Track P + Q-01) — ✅ COMPLETE
- ✅ **Q-01** Prisma `BaCodeTestRun` (table `ba_code_test_runs`, `kind DEV/FTC`) + migration; client regen. _(Renamed from `BaTestRun` after a name collision with the existing `ba_test_runs`; original table recovered from backup — see incident note in BACKLOG Q-01.)_
- ✅ **P-03** `TestRunnerService` (auto-detects test cmd, runs in ProjectSourceCode/, parses pass/fail) → `BaCodeTestRun{kind:DEV}`; `TestsPanel` Dev-Tests section (Run + history). Verified on MOD-01.
- _Note:_ fresh full backup taken before this step → `backups/db-backup/local-only/new_prd_generator-full-20260601-1303.sql.gz`.

### Step 8 — FTC Playwright runner + history (Track Q) — ✅ COMPLETE
- ✅ **Q-02** `runFtcTests` (reuses generic runner, `kind:FTC`) + `getFtcSummary`; `POST .../tests/ftc/run` + `GET .../tests/ftc/summary`
- ✅ **Q-03** history via `GET .../tests?kind=FTC` (newest-first)
- ✅ **Q-04** FTC `TestsPanel` (`kind="FTC"`): separate Run button + FTC-basis summary + expandable history
- _Verified:_ MOD-04 (180 FTC cases, 98 PW-ready) & MOD-06 (104, 91); honest ERROR for Java pseudo-code; history filters by kind.

### Step 9 — Dynamic files → upstream auto-draft (Track P + Track J) — ✅ COMPLETE
- ✅ **P-04** `UpstreamSyncService` — `detectDynamicFiles` (hooked into RunManager after each `/dev` run) stages `BaUpstreamSync` drafts + dynamic `BaCodeTask`; `approve()` applies LLD pseudo-file + sub-task + CHANGELOG + RTM; `reject()` discards. New `BaUpstreamSync` model + migration.
- ✅ **P-05** `UpstreamSyncPanel` — review list with Approve/Reject, proposed-change preview, pending badge.
- _Verified:_ seeded draft → approve → pseudo-file + sub-task + RTM row + CHANGELOG all applied; status→APPROVED. Test data cleaned up.
- _Closes Track J_ (J-03/J-04 review flow) and delivers Track L's event-driven core.

---

## 🎉 SEQUENCE COMPLETE — all 9 steps (Tracks N·O·P·Q) done. Module-scoped, traceable, two-tier-tested, self-syncing code-gen pipeline is live.

---

## Follow-on work (post-sequence)

### Track I — RTM for requirement changes — ✅ I-01/I-02 done · ⬜ I-03 deferred
- ✅ **I-01** `RequirementChangeService` — PRD/HLD section edit → downstream impact (per-module EPIC/Story/Subtask/LLD counts); hooked into both section PATCH endpoints, returns `impact`.
- ✅ **I-02** Change-impact report (MD + CSV) → `ProjectArtifacts/10-RTM/` + CHANGELOG entry.
- ⬜ **I-03** DEFERRED — frontend impact banner (no PRD/HLD inline section-editor wired to trigger it).
- _Verified:_ PRD §6 edit → 24 downstream artifacts across 6 modules; report files written; no new model/migration. Test artifacts cleaned up.

### Track R — E2E-Flow (cross-module journeys) — 🔄 R-P0 IN PROGRESS
> Design fully locked (see BACKLOG Track R). Project-scoped · WTC = white-box FTC sub-mode · manual/optional skill · full decision-graph steps · `BaThirdPartyIntegration` auto-seeded from HLD + editable · legacy `BaTestCase.e2eFlow` kept. **Strictly additive — no existing flow/test disturbed.**

- ✅ **R-P0** Foundation schema (additive): `BaArtifactType += E2E_FLOW`; new `BaE2eFlow`, `BaE2eFlowStep` (graph), `BaE2eFlowConfig`(+attachments), `BaThirdPartyIntegration`; nullable cols on `BaProject`/`BaRtmRow`/`BaTestCase` + `e2e_flows.sql` migration + client regen. _Verified: 5 tables live, existing endpoints still 200, no regression._
- ✅ **R-P1** Skill file (`FINAL-SKILL-E2E-FLOW-*.md`) + `E2eFlowService` (project-scoped CRUD · `generate` · integrations + `seedIntegrationsFromHld`) + `E2eFlowController` + ai-service `e2e_flow_prompts.py` + `POST /e2e-flow-generate`. _Verified: full CRUD + decision-graph steps + HLD→3 integrations seeded; no regression. (Project-scoped PRD/HLD pattern, not module `SKILL_ORDER`.)_
- ✅ **R-P2** E2E Flows page (`/e2e-flows`, linked from dashboard): Config & Generate · Integrations (seed from HLD) · Flows + **decision-graph step editor** (nodeType · cross-module module dropdown · branches nextStepId→label). _tsc clean; page 200._
- ✅ **R-P3** Downstream elaboration: `E2eElaborationService` (records module artifacts into `elaborationByStage[stage]`, read-only) + gap matrix; UI `ElaborationMatrix` (per-stage + "all" buttons, ✓/· grid). _Verified: MOD-04 fills EPIC→FTC; MOD-02 LLD/FTC gaps. Separate additive pass — existing skills untouched._
- ✅ **R-P4** `E2eMappingService` stamps `e2e_flow_mapping` `BaArtifactSection` on EPIC/US/SUBTASK/LLD/FTC + populates RTM `e2eFlow*` cols (idempotent); `POST /sync-mappings` + "Sync to artifacts" button. _Verified: 8 sections + 15 RTM rows; re-sync after delete → 0 residue._
- ✅ **R-P5** `E2eDiagramService` builds 4 Mermaid diagrams **deterministically** (functional decision-graph · classMethod from elaboration · dbEntities · integrations) → `BaE2eFlow.mermaidDiagrams`; `POST :flowId/build-diagrams`; frontend `DiagramsPanel` (Build + tabbed live render). _Verified: valid Mermaid all 4; OTP branches render._
- ✅ **R-P6** `E2eTestService`: `composeTestPlan` (read-only — per-step FTC coverage + layered UI/DB/white-box assertions + gap flags) + `runE2eTests` (per spanned module, reuses Track-Q runner); `GET :flowId/test-plan` + `POST :flowId/run-tests`; frontend `TestPlanPanel`. _Verified: MOD-04 step 180 cases (98 UI/180 DB/82 WBox), MOD-02 step = gap._

## ✅ TRACK R COMPLETE — all 7 phases (R-P0 → R-P6). Cross-module E2E-Flow artifact: decision-graph builder · bidirectional traceability · 4 Mermaid diagrams · test-plan + execution. Fully additive — no existing flow/test disturbed.

### R post-completion enhancements (UX, on request)
- **CSV/Excel import** — `POST /e2e-flows/import` + UI (Import CSV + template); one row per step, rows sharing a name = one flow; decision-graph branches & integration column parsed; re-import replaces a flow's steps (idempotent).
- **Add-flow UX** — flowKey now optional (auto-derived from name, e.g. `login`→`E2E-LOGIN`); only name required; Enter-to-add.
- **Step Integration picker** — surfaced existing `thirdPartyIntegrationId` as an optional dropdown from the registry + inline "+ add"; picking auto-sets `layer=Integration` (no migration — field existed from R-P0; wired the missing save path).
- **Step Screen picker + screenshot** — Screen field = dropdown of the module's analyzed `BaScreen` screens (reuses their screenshots, with preview) + per-step **custom screenshot upload** (`screenshotData`/`screenshotName` additive cols; multipart `POST .../steps/:stepId/screenshot`; view/remove). _Verified end-to-end: 8 MOD-04 screens listed, image data-URI, upload/persist/clear._

---

## Why this order
- **Steps 1–3 (done)** are pure-additive (readiness + scoping) — zero risk to existing flows; everything downstream needs module scope first.
- **Schema before consumers:** `BaCodeTask` (Step 4) and `BaTestRun` (Step 7) land just before the code that reads them — no orphan migrations.
- **Dynamic-files/upstream (Step 9) last:** most cross-cutting (LLD, subtasks, CHANGELOG, RTM, Track J); build the J-03/J-04 review flow **once** and share it.

## Notes / open dependencies
- **Wireframes / Screens gate (dual-source, 2026-06-01):** visual-design requirement is satisfied by EITHER generated wireframes (`BaWireframeSet`) OR customer screenshots that went through screen analysis (`BaScreen` + `SCREEN_ANALYSIS`). Tax Compass is a screenshot→screen-analysis project: **MOD-01 (12 screens), MOD-04 (8), MOD-06 (11) are now ready**; MOD-02/03/05 blocked only on LLD. Live `/dev` runs are now possible on the ready modules (key is in `.env`).
- **Migrations** run as `prd_user` (owns `public` schema) — no postgres password needed. Dev postgres pwd: `root`.

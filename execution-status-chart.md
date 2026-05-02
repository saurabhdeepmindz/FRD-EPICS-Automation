# BA-Tool Execution Status Chart

> Reference matrix for module owners running new modules through the BA-Tool pipeline. Maps each pipeline step to the canonical skill file, orchestrator method, post-emission validator, checklist, and the current hardening status. Use this to know **which skill file to follow**, **which checklist to run**, and **what gaps exist** before / after each step.

Last updated: **2026-05-02** (after PR #4 merged — SKILL-04 hardening shipped; SKILL-05 hardening deferred per Option C).

---

## 1. Pipeline at a glance

```
SKILL-00  →  SKILL-01-S  →  SKILL-02-S  →  SKILL-04  →  SKILL-05  →  SKILL-06-LLD  →  SKILL-07-FTC
Screen       FRD             EPIC            User Story    SubTask       LLD                Functional
Analysis     (per-feature    (per-module     (per-feature   (per-story    (single-shot       Test Cases
             9-attr)         17-section)     27-section)    24-section)   19-section)        (multi-mode)
```

Module-status state machine the orchestrator enforces:

```
DRAFT → SCREENS_UPLOADED → ANALYSIS_COMPLETE → FRD_COMPLETE → EPICS_COMPLETE → STORIES_COMPLETE → SUBTASKS_COMPLETE → APPROVED
         (SKILL-00)         (SKILL-01-S)        (SKILL-02-S)    (SKILL-04)        (SKILL-05)         (review)            (review)
```

---

## 2. Skill-by-step matrix

| Step                | Skill ID         | Skill prompt file                                                               | Orchestrator entry / loop method                                                   | Post-emission validator    | Checklist file                              | Output artifact / table        |
| ------------------- | ---------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------- | ------------------------------ |
| **Screen Analysis** | SKILL-00         | `Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-00-screen-analysis.md`          | `runSkillAsync` (single-shot vision)                                               | none                       | none                                        | `BaArtifact(SCREEN_ANALYSIS)`  |
| **FRD**             | SKILL-01-S       | `Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-01-S-create-frd-from-screens.md` | `runSkillAsync` (single-shot, with 9-attribute contract wrapper)                   | implicit (parser asserts)  | `scripts/checklists/skill-01-s.ts`          | `BaArtifact(FRD)` + `BaRtmRow` |
| **EPIC**            | SKILL-02-S       | `Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-02-S-create-epics-from-screens.md` | `runSkillAsync` + `wrapSkill02SPrompt` (single-shot, 17-section contract)         | `validateSkill02SOutput` ✅ | `scripts/checklists/skill-02-s.ts`          | `BaArtifact(EPIC)` + RTM epicId fill |
| **User Story**      | SKILL-04         | `Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-04-create-user-stories-v2.md`   | `callAiServiceSkill04PerFeature` (per-feature loop, 27-section focus override)     | `validateSkill04Output` ✅  | `scripts/checklists/skill-04.ts`            | `BaArtifact(USER_STORY)` + RTM storyId fill |
| **SubTask**         | SKILL-05         | `Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-05-create-subtasks-v2.md`       | `runSkill05PerStoryLoop` → `executeSkill05ForStory` (per-story append-mode)        | ❌ NONE — see Deferred §0   | `scripts/checklists/skill-05.ts`            | `BaArtifact(SUBTASK)` + `BaSubTask` + RTM subtaskId fill |
| **LLD**             | SKILL-06-LLD     | `Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-06-create-lld.md`               | `runSkillAsync` (single-shot, 19-section contract via `wrapSkill06LldPrompt`)      | ❌ NONE — see Gaps §5       | ❌ NONE                                      | `BaArtifact(LLD)` + `BaPseudoFile` tree + RTM lldArtifactId |
| **FTC**             | SKILL-07-FTC     | `Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-07-create-ftc.md`               | five modes — see §3 below                                                          | `BaFtcParser` strict       | ❌ NONE                                      | `BaArtifact(FTC)` + `BaTestCase` + RTM ftcArtifactId |

---

## 3. SKILL-07-FTC orchestrator modes

The single SKILL-07 prompt drives 5 different orchestrator flows. Pick by module size:

| Mode                                    | When to use                                                                  | Endpoint                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **1. Single-shot** (legacy)             | ≤ 4 features OR ≤ 8 stories                                                  | `POST /api/ba/modules/:id/generate-ftc`                                |
| **2. Per-feature append**               | > 4 features OR > 8 stories — primary mode for big modules                   | `POST /api/ba/modules/:id/execute/SKILL-07-FTC/feature/:featureId`     |
| **2b. Per-category append**             | After mode 2 — adds Security / UI / Perf / Accessibility coverage gaps       | `POST /api/ba/modules/:id/execute/SKILL-07-FTC/category/:category`     |
| **2c. Per-feature white-box append**    | After mode 2 AND LLD exists — class/method-level white-box TCs               | `POST /api/ba/modules/:id/execute/SKILL-07-FTC/white-box/:featureId`   |
| **3. Narrative-only append**            | After modes 2 / 2b / 2c — fills §1–§5 + §9–§12 + §14–§16 narrative sections  | `POST /api/ba/modules/:id/execute/SKILL-07-FTC/narrative`              |
| **Complete pipeline (one-click)**       | One-button stepper UX — runs 2 → 2b → 2c → 3 in sequence                     | `POST /api/ba/modules/:id/execute/SKILL-07-FTC/complete`               |

---

## 4. Hardening status — 3-layer defense parity

The 3-layer defense pattern (proven on SKILL-02-S PR #3 and SKILL-04 PR #4) catches LLM drift at three points: prompt, orchestrator wrapper, post-emission validator.

| Skill            | Prompt — Forbidden Patterns + self-check | Orchestrator — focus override re-stating contract | Post-emission validator (fails exec on drift)         | Status      |
| ---------------- | ---------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- | ----------- |
| **SKILL-00**     | n/a — vision-only                        | n/a                                                | n/a                                                   | n/a         |
| **SKILL-01-S**   | ✅ 9-attribute contract                  | ✅ `wrapSkill01SPrompt`                            | ⚠️ implicit via FRD parser                            | mostly-✅   |
| **SKILL-02-S**   | ✅                                       | ✅ `wrapSkill02SPrompt`                            | ✅ `validateSkill02SOutput`                           | ✅ hardened |
| **SKILL-04**     | ✅                                       | ✅ `callAiServiceSkill04PerFeature` focus override | ✅ `validateSkill04Output`                            | ✅ hardened |
| **SKILL-05**     | ⚠️ heading-depth rules but no Forbidden  | ❌ per-story loop has NO `wrapSkill05Prompt`       | ❌ NONE                                                | ⚠️ deferred (§0) |
| **SKILL-06-LLD** | ⚠️ partial                               | ✅ `wrapSkill06LldPrompt` (19-section contract)    | ❌ NONE                                                | ⚠️ gap     |
| **SKILL-07-FTC** | ✅ canonical TC fenced-block contract    | ✅ `wrapSkill07Prompt` per-mode                     | ⚠️ `BaFtcParser` errors on parse failure but no per-section coverage validator | mostly-✅   |

---

## 5. Gaps & follow-ups

| Gap                                                  | Owner skill   | Severity | Tracked in                               |
| ---------------------------------------------------- | ------------- | -------- | ---------------------------------------- |
| No post-emission validator                           | SKILL-05      | medium   | DEFERRED-IMPROVEMENTS §0                 |
| No orchestrator focus-override re-stating contract   | SKILL-05      | medium   | DEFERRED-IMPROVEMENTS §0                 |
| No checklist file (pre/post checks)                  | SKILL-06-LLD  | medium   | (new — file not yet created)             |
| No checklist file (pre/post checks)                  | SKILL-07-FTC  | medium   | (new — file not yet created)             |
| No post-emission validator — relies on parser errors | SKILL-06-LLD  | low      | (deferred)                               |
| Word/PDF export formatting parity with preview       | (export)      | low      | DEFERRED-IMPROVEMENTS §1                 |
| Word/PDF export — per-feature inline screen thumbs   | (export)      | low      | DEFERRED-IMPROVEMENTS §2                 |
| Phase A cleanup script — should sweep orphan execs   | (tooling)     | low      | DEFERRED-IMPROVEMENTS §5                 |
| SkillExecutionPanel UI staleness after Phase A regen | (UI)          | low      | DEFERRED-IMPROVEMENTS §6                 |
| MOD-04 SKILL-04 + SKILL-05 sync-sweep                | MOD-04 data   | low      | (deferred — revisit when MOD-04 needed)  |

---

## 6. Per-module status — current state

Sourced from `BaModule.moduleStatus` + APPROVED `BaSkillExecution` rows as of last refresh.

| Module     | Module status      | SKILL-00 | SKILL-01-S (FRD) | SKILL-02-S (EPIC) | SKILL-04 (User Story) | SKILL-05 (SubTask) | SKILL-06-LLD | SKILL-07-FTC | Notes                                                                             |
| ---------- | ------------------ | -------- | ---------------- | ----------------- | --------------------- | ------------------ | ------------ | ------------ | --------------------------------------------------------------------------------- |
| MOD-01     | APPROVED           | ✅       | ✅               | ✅                | ✅                    | ✅                 | ❌           | ❌           | Pre-hardening data; sync-sweep deferred                                           |
| MOD-02     | APPROVED           | ✅       | ✅               | ✅                | ✅                    | ✅                 | ❌           | ❌           | Pre-hardening data; sync-sweep deferred                                           |
| MOD-03     | APPROVED           | ✅       | ✅               | ✅                | ✅                    | ✅                 | ❌           | ❌           | Pre-hardening data; sync-sweep deferred                                           |
| MOD-04     | EPICS_COMPLETE     | ✅       | ✅               | ✅                | ✅ (legacy)           | ✅ (legacy 7/15 RTM linkage) | ❌  | ❌           | SKILL-05 only 47% RTM-linked; rerun deferred for sync-sweep                       |
| **MOD-05** | **APPROVED**       | ✅       | ✅               | ✅ (PR #3)        | ✅ (PR #4 — 63 stories, 27/27 sections each) | ✅ (276 SubTasks, 21/21 RTM) | ❌  | ❌  | Fully aligned with current hardened pipeline                                      |
| **MOD-06** | STORIES_COMPLETE   | ✅       | ✅               | ✅ (PR #3)        | ✅ (PR #4 — 27 stories, 27/27 sections each) | (in-flight)        | ❌           | ❌           | Validation module for SKILL-04 hardening; SKILL-05 about to fire (Option C)       |

Legend:

- ✅ = APPROVED execution + checklist passed
- ❌ = not yet run for this module
- (legacy) = ran with pre-hardening orchestrator code; data may be incomplete
- (in-flight) = run in progress at time of writing

---

## 7. New-module run order — recommended

When onboarding a brand-new module:

1. **Upload screens** → run `SKILL-00` (vision pass)
2. **Run `SKILL-01-S`** → review FRD → APPROVE  → run `scripts/checklists/skill-01-s.ts post <moduleDbId>` (target ≥ 9/9)
3. **Run `SKILL-02-S`** → review EPIC → APPROVE → run `scripts/checklists/skill-02-s.ts post <moduleDbId>` (target 5/5)
4. **Run `SKILL-04`** → review User Stories → APPROVE → run `scripts/checklists/skill-04.ts post <moduleDbId>` (target 6/6)
5. **Run `SKILL-05`** → review SubTasks → APPROVE → run `scripts/checklists/skill-05.ts post <moduleDbId>` (target 7/7)
6. *(optional)* **Run `SKILL-06-LLD`** for architecture/dev handoff
7. *(optional)* **Run `SKILL-07-FTC`** in mode 2 → 2b → 2c → 3 (or `/complete` one-shot)

**Rule of thumb for each step:** if the post-checklist isn't 100% green, do NOT approve — investigate first. Treat any FAIL as a regression.

**For long-running per-feature / per-story loops** (SKILL-04 ≥ 5 features; SKILL-05 ≥ 10 stories) prefer `scripts/_run-skill-standalone.ts <MOD-NN> <SKILL-NAME>` over the HTTP API. The standalone script runs the skill in its own Node process via `createApplicationContext` and is **immune to `nest --watch` restarts** that orphan detached `runSkillAsync` promises mid-flight.

---

## 8. References

- `DEFERRED-IMPROVEMENTS.md` — backlog of cross-cutting improvements with severity + scope
- `Screen-FRD-EPICS-Automation-Skills/` — all skill prompt files
- `ProjectSourceCode/backend/scripts/checklists/` — TS pre/post checklists per skill
- `ProjectSourceCode/backend/src/ba-tool/ba-skill-orchestrator.service.ts` — orchestrator + validators
- `ProjectSourceCode/backend/scripts/_run-skill-standalone.ts` — restart-immune skill runner
- `ProjectSourceCode/backend/scripts/_cleanup-module-stories-subtasks.ts` — Phase A reset for USER_STORY + SUBTASK
- `ProjectSourceCode/backend/scripts/_reextend-rtm-stories.ts` — re-link RTM without re-firing SKILL-04

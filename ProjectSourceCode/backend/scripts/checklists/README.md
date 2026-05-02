# Skill Pre/Post Checklists

Reusable input-readiness and output-correctness checks for every skill in the BA-Tool pipeline. Each checklist is a TypeScript module with two arrays — `PRE_CHECKS` and `POST_CHECKS` — exported alongside a CLI entry point.

## Layout

| File | What it covers |
|---|---|
| `lib.ts` | Shared types (`Check`, `CheckResult`, `ChecklistOutcome`), `runChecks` driver, `formatChecklist` printer, infra probes (`probeBackend`, `probeAiService`) |
| `skill-01-s.ts` | FRD generation — verifies SKILL-00 output is approved, screens exist, infra is up; post-checks the 9-attribute contract per feature, RTM seeding, handoff packet shape |
| `skill-02-s.ts` | EPIC generation — verifies FRD has features; post-checks EPIC ids and full epic-linkage in RTM |
| `skill-04.ts` | User Story generation — verifies EPIC exists; post-checks US-NNN ids and feature → story linkage in RTM |
| `skill-05.ts` | SubTask generation (per-story append loop) — verifies stories enumerable; post-checks ST-USNNN-TEAM-NN ids, BaSubTask records persisted, userStoryId populated, RTM subtask-linkage |
| `run-cascade.ts` | End-to-end orchestrator: runs pre → trigger → wait → post for every skill, with optional manual approval gate at SKILL-01-S |
| `README.md` | This file |

## CLI usage

Each per-skill module is invokable directly:

```bash
# Pre-checks for SKILL-01-S on a given module
npx ts-node scripts/checklists/skill-01-s.ts pre <moduleDbId>

# Post-checks
npx ts-node scripts/checklists/skill-01-s.ts post <moduleDbId>
```

Exit code: `0` if all checks pass, `1` if any fail, `2` on argv errors.

## Programmatic usage

```typescript
import { PRE_CHECKS, POST_CHECKS } from './scripts/checklists/skill-01-s';
import { runChecks, formatChecklist } from './scripts/checklists/lib';

const outcome = await runChecks(PRE_CHECKS, { prisma, moduleDbId, apiBase: 'http://localhost:4000' });
if (!outcome.allPassed) {
  console.error(formatChecklist('Pre-checks', outcome));
  // halt the cascade
}
```

## Why pre/post checks (not just one)

- **Pre-checks** stop a skill from running when its inputs are missing or stale. Cheaper than discovering the failure inside the AI call.
- **Post-checks** catch silent degradation — outputs that *look* successful but are structurally wrong (e.g. SKILL-01-S returning a meta-overview document with zero feature blocks). The orchestrator's built-in `validateSkill01SOutput` covers part of this for SKILL-01-S; these checks are broader and apply to every skill.

## Future integration points

Once the per-skill checklists prove reliable across multiple modules:

1. **Wire into `runSkillAsync`** in `ba-skill-orchestrator.service.ts`: import each skill's `PRE_CHECKS` and run before `callAiService`; run `POST_CHECKS` before flipping the execution to `AWAITING_REVIEW`. A failed pre-check rejects the request before any token spend; a failed post-check marks the execution `FAILED` with the structured check report as `errorMessage`.
2. **Reference from skill files**: each `Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-*.md` can add a "Pre-conditions" and "Definition of Done" pointer to the matching checklist in this folder — the markdown becomes the human-readable contract, the TS becomes the executable enforcement.
3. **Surface in the BA-Tool UI**: render the checklist outcomes per-skill on the module page so operators can see at a glance which checks failed without trawling logs.

## Adding a new skill's checklist

1. Copy any existing `skill-*.ts` as a template.
2. Replace the `PRE_CHECKS` / `POST_CHECKS` arrays with the new skill's specifics.
3. Update the CLI block's skill name string at the bottom.
4. Add the new file's row to the table at the top of this README.
5. (Optional) Reference it from the skill prompt's Definition of Done section.

## Conventions

- Each `Check` has a clear, present-tense `name` so the printed output reads as a checklist (e.g. `[PASS] FRD artifact created with sections — 17 sections`).
- The `detail` field is concise but specific — it's the diagnostic the operator reads at a glance.
- Checks that depend on infra (backend / AI service) live near the bottom of the pre-list so DB checks fail fast and don't waste a network call.
- No check makes a write-side change. Pre/post are read-only.

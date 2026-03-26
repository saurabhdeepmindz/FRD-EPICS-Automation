# SKILLS-generic.md — Reusable Workflow Skills

> **Purpose:** Stack-agnostic workflow playbooks applicable to any project on this framework.
> **Usage:** Reference directly, or extend in a project-specific `SKILLS-{project}.md`.
> **Naming:** Each skill is identified by `SKILL-G-NNN` for traceability.

---

## SKILL-G-001 — Run an Increment (Vertical Slice)

**When to use:** Starting any new increment of functionality.

**Steps:**
1. Read `development-execution-generic.md` — confirm increment anatomy and layer build order
2. Read the relevant Epic — confirm scope and acceptance criteria
3. Read the relevant User Story — confirm behaviour, ACs, DoD
4. Build in strict layer order: Models → Repository → Service → Task/Router → Tests → UI
5. Write tests FIRST before any implementation (RED phase)
6. Implement minimum code to pass tests (GREEN phase)
7. Refactor without breaking tests (IMPROVE phase)
8. Run full quality gate: lint → type check → tests → coverage ≥ 80%
9. Update API Spec and DB Schema if anything changed
10. Mark User Story as Done — confirm all ACs are met

---

## SKILL-G-002 — TDD Cycle (RED → GREEN → REFACTOR)

**When to use:** Before writing any function, class, or endpoint.

**Steps:**
1. Write the test first — assert the expected behaviour, not the implementation
2. Run the test — confirm it **fails** (RED). If it passes without implementation, the test is wrong
3. Write the minimum implementation to make the test pass — no extras
4. Run the test — confirm it **passes** (GREEN)
5. Refactor: improve naming, extract helpers, remove duplication — tests must still pass
6. Run full test suite — confirm no regressions
7. Check coverage — must stay at or above 80%

**Rules:**
- Never write implementation before its test
- Never weaken an assertion to make a test pass — fix the implementation instead
- One behaviour per test — do not bundle multiple assertions for unrelated behaviours

---

## SKILL-G-003 — Write and Validate an Epic

**When to use:** Before planning any new feature area or sprint.

**Steps:**
1. Read `epic-rules-generic.md` — confirm epic anatomy and INVEST criteria
2. Read project-specific `epic-rules-{project}.md` — confirm epic catalog and phase alignment
3. Draft epic with: ID, title, goal statement, scope (in/out), user story list, acceptance criteria, DoD
4. Validate INVEST: Independent, Negotiable, Valuable, Estimable, Small enough, Testable
5. Confirm epic fits within a single delivery phase
6. Add epic to the project epic catalog
7. Confirm at least one User Story is ready before coding begins

---

## SKILL-G-004 — Write and Validate a User Story

**When to use:** Before implementing any feature, fix, or enhancement.

**Steps:**
1. Read `user-story-rules-generic.md` — confirm Three Cs and GWT format
2. Read project-specific `user-story-rules-{project}.md` — confirm actor list and toolchain DoD
3. Draft story: "As a [actor], I want [action], so that [outcome]"
4. Write at least 3 Acceptance Criteria in Given/When/Then format
5. Validate INVEST compliance
6. Assign story points (1, 2, 3, 5, 8 — no higher; split if > 5)
7. Confirm parent Epic exists and story is linked to it
8. Confirm DoD checklist is attached: tests written, code reviewed, docs updated

---

## SKILL-G-005 — Create a Database Migration

**When to use:** Adding or modifying any table, column, index, or enum.

**Steps:**
1. Read `data-rules-{stack}.md` — confirm migration naming and conventions
2. Read current DB Schema doc — understand existing structure before changing it
3. Write migration script — additive changes only (never drop columns in the same migration as add)
4. Add rollback/downgrade logic
5. Test migration up: `migrate upgrade head`
6. Test migration down: `migrate downgrade -1`
7. Confirm no data loss on rollback
8. Update `DB_SCHEMA-{project}.md` to reflect the change
9. Run full test suite — confirm no broken queries

---

## SKILL-G-006 — Code Review Checklist

**When to use:** Before marking any PR ready for merge.

**Checklist:**
- [ ] All functions ≤ 50 lines
- [ ] All files ≤ 800 lines (target 200–400)
- [ ] No hardcoded secrets, URLs, ports, or env-specific values
- [ ] All external inputs validated at system boundaries
- [ ] Error handling explicit at every level — no silent swallows
- [ ] Tests written first — coverage ≥ 80%
- [ ] No direct DB calls outside the repository layer
- [ ] No business logic in the presentation layer
- [ ] Immutability followed — no in-place mutation
- [ ] API Spec and DB Schema updated if applicable
- [ ] Lint and type check passing with zero errors

---

## SKILL-G-007 — Pre-Commit Security Checklist

**When to use:** Before every `git commit`.

**Checklist:**
- [ ] No API keys, passwords, tokens, or secrets in source code
- [ ] All user inputs validated and sanitised
- [ ] SQL injection prevention — parameterised queries or ORM only
- [ ] Authentication and authorisation verified on all endpoints
- [ ] Rate limiting applied on all public-facing endpoints
- [ ] Error messages return user-friendly text — no internal stack traces exposed
- [ ] `.env` file excluded from commit — `.env.example` committed instead
- [ ] No debug logging left in production paths

---

## SKILL-G-008 — PR Creation Workflow

**When to use:** After completing an increment and passing the quality gate.

**Steps:**
1. Run full quality gate: lint → type check → tests → coverage report
2. `git status` — confirm only intended files are staged
3. `git diff main...HEAD` — review all changes since branch diverged
4. Draft commit message: `<type>: <short description>` (conventional commits)
5. Create PR with: Summary (what + why), Test Plan (checklist), breaking changes
6. PR title ≤ 70 characters
7. Link PR to the User Story and Epic
8. Request review — do not self-merge without a second approval

---

## SKILL-G-009 — Documentation Maintenance

**When to use:** After any increment that adds or changes behaviour.

**Steps:**
1. API endpoint added/changed → update `API_SPEC-{project}.md`
2. Table/column added/changed → update `DB_SCHEMA-{project}.md`
3. New Epic created → update epic catalog in `epic-rules-{project}.md`
4. User Story state changed → update story index
5. New pattern introduced → update `DesignPatterns-{project}.md`
6. New actor or permission added → update `ACTORS-{project}.md`
7. New generic best practice adopted → update `SKILLS-generic.md` and relevant rules file

---

*Suffix convention: `-generic` = applies to all stacks and projects.*
*Override in `SKILLS-python.md` (stack additions) or `SKILLS-{project}.md` (project overrides).*

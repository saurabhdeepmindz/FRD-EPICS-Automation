# User Story Rules

> **Source:** Atlassian Agile — User Stories (https://www.atlassian.com/agile/project-management/user-stories)
> **Sequence:** User stories are created AFTER each Epic is defined. Every story MUST link to a parent Epic.

---

## What Is a User Story?

A **user story** is a short, simple description of a feature told from the perspective of the person who desires the new capability — typically a user, admin, or system actor. Stories are the primary unit of work in a sprint.

> *"User stories are the building blocks of agile development. They are not specifications — they are an invitation to a conversation."* — Atlassian

A user story is NOT:
- A technical task (e.g., "Configure the database connection pool") — that is a subtask
- A bug report — bugs have their own workflow
- A vague wish (e.g., "Make the app faster") — that is a non-functional requirement captured in an NFR epic

---

## The Three Cs (Atlassian Framework)

Every user story embodies three properties:

| C | Meaning | How to Apply |
|---|---|---|
| **Card** | Brief written description of intent | The `US-<ID>` document with title and "As a… I want… So that…" |
| **Conversation** | Ongoing dialogue between team and stakeholder | Acceptance criteria refined together; assumptions documented |
| **Confirmation** | Acceptance criteria that confirm the story is done | Checkboxes the tester and owner sign off before closing |

---

## User Story Format (MANDATORY)

Every user story must use this format:

```markdown
## US-<ID>: <Title>

**Epic:** EPIC-<ID> — <Epic Title>
**Status:** Draft | Refined | In Sprint | In Progress | Done | Cancelled
**Priority:** Critical | High | Medium | Low
**Story Points:** <1 | 2 | 3 | 5 | 8 | 13 — Fibonacci scale>
**Sprint:** Sprint <N>
**Assignee:** <role or team member>
**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD

### User Story
> As a **<actor>**, I want **<goal/feature>**, so that **<business value/reason>**.

### Context / Background
<1–3 sentences. Why does this story exist now? What triggered the need?>

### Acceptance Criteria
Given <context/state>, when <action taken>, then <observable outcome>.

- [ ] AC1: Given…, When…, Then…
- [ ] AC2: Given…, When…, Then…
- [ ] AC3: Given…, When…, Then…
*(minimum 3 acceptance criteria per story)*

### Definition of Done (DoD)
- [ ] Code written and follows the project's architectural conventions
- [ ] Unit tests written (RED first, then GREEN — TDD)
- [ ] Integration tests written for any new API endpoint or service boundary
- [ ] Linting and type checking passes with zero errors
- [ ] Test coverage meets or exceeds project minimum threshold
- [ ] Database migration created for any schema change
- [ ] API spec updated if a new endpoint is added
- [ ] DB schema documentation updated if tables or columns change
- [ ] Code reviewed and approved
- [ ] Acceptance criteria above confirmed by assignee or story owner

### Subtasks
| ID | Description | Assignee | Status |
|---|---|---|---|
| T-01 | <Technical task> | — | Todo |
| T-02 | <Write unit tests> | — | Todo |

### Notes / Assumptions
- <Any assumption made while writing this story>
- <Known edge cases or constraints>

### Linked Stories
| Relation | Story ID | Title |
|---|---|---|
| Blocks | US-<ID> | <Story that cannot start until this is done> |
| Blocked by | US-<ID> | <Story that must finish before this one starts> |
| Related | US-<ID> | <Logically related but not dependent> |
```

---

## The INVEST Criteria (Atlassian / Bill Wake)

Every user story MUST pass the INVEST test before it enters a sprint:

| Letter | Criterion | Check |
|---|---|---|
| **I** — Independent | Can be developed and delivered without depending on another story (except documented blockers) | No circular dependencies |
| **N** — Negotiable | Scope and implementation details can be adjusted in conversation — not a rigid contract | Acceptance criteria are outcomes, not prescriptions |
| **V** — Valuable | Delivers value to the user or business when shipped alone | "So that" clause is meaningful |
| **E** — Estimable | Team can assign story points with confidence | Not too vague, not too large |
| **S** — Small | Completable within a single sprint (≤2 weeks) | If >8 story points, split it |
| **T** — Testable | Acceptance criteria can be verified by a human or automated test | No untestable criteria like "must feel fast" |

**Rule:** Any story that fails the INVEST test must be refined before sprint planning. Do not drag a failing story into a sprint.

---

## Story Points — Fibonacci Scale

Story points estimate complexity, effort, and uncertainty — not calendar hours.

| Points | Meaning | Examples |
|---|---|---|
| **1** | Trivial change, well-understood | Add a field to a response schema, update a config value |
| **2** | Small, straightforward | CRUD endpoint for a known entity, simple query |
| **3** | Moderate, some unknowns | New service method with validation logic, external API call |
| **5** | Complex, cross-layer | New feature spanning multiple service/repository layers with tests |
| **8** | Large, significant unknowns | New subsystem or pipeline stage with multiple integration points |
| **13** | Epic-level — SPLIT THIS STORY | — |

**Rule:** Any story estimated at 13 points must be split into two or more smaller stories before it enters a sprint.

---

## Actor Definition

Actors represent the roles or systems that interact with the product. Define actors in the project-specific guidelines before writing stories.

**Template:**
```
| Actor | Description | Example Usage |
|---|---|---|
| `<role>` | <What this person/system does> | "As a <role>, I want…" |
```

Actors must be:
- Defined once in the project-specific rules file
- Used consistently — do not invent new actor names mid-sprint
- Representative of a real role in the system (human or automated)

---

## Story Splitting Patterns

When a story is too large (>8 points), use these patterns to split it:

| Pattern | How to Split |
|---|---|
| **By workflow step** | Split along sequential process stages (e.g., validate → process → persist = 3 stories) |
| **By user role** | Separate admin behaviour from regular user behaviour |
| **By data variation** | Different input formats or data sources become separate stories |
| **By acceptance criterion** | If ACs are independently shippable, each becomes its own story |
| **By happy / sad path** | Core success flow as one story; error handling and edge cases as another |
| **By CRUD operation** | Create, Read, Update, Delete can be delivered independently |
| **By read / write** | Read-only view shipped before write operations |

---

## Story Acceptance Criteria Guidelines

Write acceptance criteria using the **Given / When / Then** (GWT) format:

```
Given <the system is in a specific state>
When  <the user or system takes an action>
Then  <a specific, observable, testable outcome occurs>
```

**Good example:**
```
Given a registered user with an active account,
When they submit the login form with valid credentials,
Then they are redirected to the dashboard
  and a session token is issued with a 24-hour expiry.
```

**Bad example (too vague):**
```
When the user logs in, it should work correctly.
```

### Rules for Acceptance Criteria
- Minimum **3 criteria** per story
- Each criterion must be independently testable
- Include both **happy path** (success) and **sad path** (validation failure, error) criteria
- Never use subjective language: "fast", "good", "nice", "intuitive"
- Always specify the observable state change (DB record, API response, UI message, redirect)

---

## Story File Location & Naming

- Store story documents organised by epic: `docs/stories/EPIC-<ID>/`
  - Example: `docs/stories/EPIC-02/US-001-user-registration.md`
- One file per story — do not combine multiple stories in one file
- Story IDs are global sequential integers: `US-001`, `US-002`, … — not reset per epic

---

## Story → Epic Traceability

Every user story file MUST include:
1. The parent **Epic ID and title** in the frontmatter
2. A reference back to the Epic file
3. The parent Epic's story table updated to include the new story

**Rule:** A story without a parent epic must not be created. If no epic exists, create the epic first (see `epic-rules.md`).

---

## Story Lifecycle States

```
Draft → Refined → Sprint Ready → In Progress → In Review → Done
                                                    ↓
                                               Blocked (temporary)
                                               Cancelled (permanent)
```

| State | Meaning | Gate to Next |
|---|---|---|
| **Draft** | Story identified, format incomplete | INVEST criteria pass |
| **Refined** | Full format written, ACs agreed | Sprint planning selects it |
| **Sprint Ready** | Added to sprint backlog | Sprint starts |
| **In Progress** | Development started | PR opened |
| **In Review** | PR submitted, tests passing | Code review approved |
| **Done** | DoD fully met, accepted by owner | Owner sign-off |
| **Blocked** | Cannot proceed — dependency unresolved | Blocker removed |
| **Cancelled** | De-scoped; rationale documented | — |

---

## Story Index Template

Maintain a story index file at `docs/stories/STORIES.md`:

```markdown
# Story Index

| Story ID | Title | Epic | Status | Points | Sprint |
|---|---|---|---|---|---|
| US-001 | <Story title> | EPIC-<ID> | Done | 3 | Sprint 1 |
| US-002 | <Story title> | EPIC-<ID> | In Progress | 2 | Sprint 1 |
```

---

## Rules Summary (Non-Negotiable)

- **Epic-linked:** Every story MUST reference a parent Epic ID — no orphan stories
- **INVEST-compliant:** Stories failing INVEST are refined before sprint, not during
- **Format complete:** All fields in the story anatomy must be populated
- **3 ACs minimum:** No story enters a sprint with fewer than 3 acceptance criteria
- **Sized correctly:** Stories ≥13 points are split before sprint planning
- **GWT criteria:** Acceptance criteria use Given/When/Then or equivalent testable format
- **DoD explicit:** Every story carries the full Definition of Done checklist
- **Subtasks for tech work:** Technical implementation details go in subtasks, not the story narrative
- **Traceability maintained:** Parent epic's story table updated when a new story is created
- **Story index kept current:** `docs/stories/STORIES.md` updated after every story state change

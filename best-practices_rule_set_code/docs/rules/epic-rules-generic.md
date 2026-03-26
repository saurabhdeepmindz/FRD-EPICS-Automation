# Epic Rules

> **Source:** Atlassian Agile — Epics (https://www.atlassian.com/agile/project-management/epics)
> **Sequence:** Epics are created BEFORE any development begins. User stories are created after each Epic.

---

## What Is an Epic?

An **Epic** is a large body of work that can be broken down into smaller, deliverable user stories. Epics represent a significant chunk of business value that typically spans multiple sprints and may cross team boundaries.

- An epic is NOT a project — it is a scoped initiative within a project
- An epic is NOT a sprint — it spans multiple sprints
- An epic IS the parent of user stories — stories are the children that deliver the epic

**Rule:** Every feature, module, or initiative MUST be represented as an Epic before any user stories or code are written.

---

## Epic Anatomy

Every epic must have the following structure:

```markdown
## EPIC-<ID>: <Title>

**Status:** Draft | Refined | Active | In Progress | Done | Cancelled
**Owner:** <role or team member>
**Priority:** Critical | High | Medium | Low
**Phase:** <Phase name from project delivery plan>
**Sprint Target:** <sprint range, e.g., Sprint 1–3>
**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD

### Business Goal
<One paragraph. What business problem does this solve? Tie to PRD epics.>

### Business Value
<Quantified or qualified value — what changes for the end user or business when this is done?>

### Scope (In / Out)

| In Scope | Out of Scope |
|---|---|
| <What this epic covers> | <What is explicitly excluded> |

### Acceptance Criteria
- [ ] <Criterion 1 — measurable, testable>
- [ ] <Criterion 2>
- [ ] ...

### User Stories (Children)
| Story ID | Title | Status |
|---|---|---|
| US-<ID> | <Title> | Draft |

### Dependencies
| Depends On | Type | Notes |
|---|---|---|
| EPIC-<ID> | Blocking | Must complete before this epic starts |
| <External system or API> | Integration | Reason this is a dependency |

### Definition of Done
- [ ] All child user stories are completed and accepted
- [ ] Acceptance criteria above are all met and verified
- [ ] Code reviewed, tests passing at the required coverage threshold
- [ ] API spec and DB schema updated if applicable
- [ ] Documentation updated
- [ ] Feature deployed to staging and smoke-tested
```

---

## How to Write a Good Epic

### 1. Tie to the PRD
Every epic must map to a requirement or feature area in the project PRD. Reference the PRD item in the epic body. Do not invent features without stakeholder sign-off.

### 2. Define the Business Goal First
Before writing acceptance criteria or stories, answer: **"What does the business or user gain when this epic is done?"**

Good: *"Users can complete the full onboarding flow without leaving the app."*
Bad: *"Build an onboarding module."*

### 3. Write Measurable Acceptance Criteria
Acceptance criteria must be testable by a human or automated test. Use the format:
- **Given** `<context>` **When** `<action>` **Then** `<observable result>`
- Or a checkbox checklist with clear pass/fail conditions

### 4. Define Scope Boundaries (In / Out)
Explicitly document what is OUT of scope. This prevents scope creep and gives the team permission to defer related-but-separate work to a future epic.

### 5. Set the Phase and Priority
Map every epic to a delivery phase from the project plan:
- **Phase 0** — Foundation (infrastructure, configuration, scaffolding)
- **Phase 1** — POC / MVP (end-to-end demo or initial release)
- **Phase 2** — Alpha (core features, internal users)
- **Phase 3** — Beta (external users, hardening)
- **Phase 4** — GA (production, scale)

### 6. Identify Dependencies Early
Flag any epic or external dependency that must be resolved before this epic can start. Block child stories accordingly before sprint planning.

---

## Epic Sizing Guidelines

| Size | Description | Story Count | Sprint Span |
|---|---|---|---|
| XS | Thin slice, low complexity | 1–3 stories | 1 sprint |
| S | Small initiative, single domain | 3–6 stories | 1–2 sprints |
| M | Cross-domain, moderate complexity | 5–10 stories | 2–3 sprints |
| L | Platform capability, multiple services | 8–15 stories | 3–5 sprints |
| XL | Major platform initiative | 15+ stories | 5+ sprints — SPLIT this epic |

**Rule:** If an epic has more than 15 user stories or spans more than 5 sprints, split it into two or more child epics under a shared parent theme.

---

## Epic Lifecycle States

```
Draft → Refined → Active → In Progress → Done
                                ↓
                           Cancelled (if de-prioritised)
```

| State | Meaning | Gate to Next |
|---|---|---|
| **Draft** | Epic identified, anatomy incomplete | Epic anatomy fully written |
| **Refined** | Acceptance criteria written, stories created | Sprint planning picks it up |
| **Active** | Sprint work has started on child stories | — |
| **In Progress** | At least one story is in development | — |
| **Done** | All stories done, DoD met, accepted by owner | Owner sign-off |
| **Cancelled** | De-scoped; record rationale in the document | — |

---

## File Location & Naming

- Store epic documents in: `docs/epics/` (or the project-equivalent documentation folder)
- File name pattern: `EPIC-<ID>-<slug>.md`
  - Example: `EPIC-01-platform-foundation.md`
  - Example: `EPIC-02-user-authentication.md`
- One file per epic — do not combine multiple epics in one file
- Maintain an epic index file: `docs/epics/EPICS.md`

---

## Rules Summary (Non-Negotiable)

- **Epic-first:** No user story, no task, no code may be written without a parent epic
- **PRD-aligned:** Every epic must trace to a PRD requirement or stakeholder-approved scope change
- **Scoped:** Every epic has explicit In/Out of scope boundaries
- **Measurable:** Every epic has at least three testable acceptance criteria
- **Phased:** Every epic is assigned to exactly one delivery phase
- **Documented:** Epic file created before the first sprint that works on its stories
- **Linked:** Every child user story references its parent epic ID (`EPIC-<ID>`)
- **Closed-loop:** Epic is not marked Done until all child stories are Done and DoD is verified

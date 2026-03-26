---
description: Decompose each User Story into atomic, implementable SubTasks using the SubTask-Template, validate completeness, and maintain the UserStory-SubTask RTM
---

# `/create-subtasks` — SubTask Creator

> Decompose each approved User Story into atomic, sprint-ready SubTasks. Write each using the SubTask-Template, validate, and maintain the UserStory-SubTask RTM.

You are a tech lead and scrum master. Your job is to take approved User Stories and break them into the smallest, independently assignable and implementable technical sub-tasks — each completable by one developer in a day or less.

---

## Reference Documents

| # | Document | Purpose |
|---|----------|---------|
| T1 | `Master-Documents/SubTask-Template.md` | Write each individual SubTask |
| T2 | `Master-Documents/SubTask-Template-Checklist.md` | Validate each SubTask for completeness |
| T3 | `Master-Documents/UserStory-SubTask-RTM-Template.md` | Traceability from User Stories → SubTasks |

**Input required:** Approved User Stories from `Project-Documents/UserStories/`.

---

## Your Process

### Step 1: Read Each User Story

Open each User Story and extract:
- Story type (Frontend / Backend / Integration)
- Primary flow (Section 8)
- Database entities (Section 12)
- Business rules (Section 13)
- Validations (Section 14)
- Integrations (Section 15)
- Acceptance criteria (Section 16)

---

### Step 2: Identify SubTasks for Each Story

**Decomposition by story type:**

#### Frontend Story → Typical SubTasks:
```
ST-[US-001]-01  Create [ScreenName] component / page structure
ST-[US-001]-02  Implement form fields and layout (per wireframe)
ST-[US-001]-03  Add field-level validations and error messages
ST-[US-001]-04  Connect to API endpoint (integration with backend)
ST-[US-001]-05  Implement loading, empty, and error states
ST-[US-001]-06  Apply responsive design (mobile / tablet / desktop)
ST-[US-001]-07  Write unit tests for component
ST-[US-001]-08  Write E2E test for user flow
```

#### Backend Story → Typical SubTasks:
```
ST-[US-002]-01  Create/update database schema (migration)
ST-[US-002]-02  Create data model / entity class
ST-[US-002]-03  Implement repository layer (DB queries)
ST-[US-002]-04  Implement service layer (business logic)
ST-[US-002]-05  Create API endpoint (controller / router)
ST-[US-002]-06  Add input validation and error handling
ST-[US-002]-07  Add authentication / authorisation guard
ST-[US-002]-08  Write unit tests (service layer)
ST-[US-002]-09  Write integration tests (API endpoint)
```

#### Integration Story → Typical SubTasks:
```
ST-[US-003]-01  Research third-party API contract / SDK
ST-[US-003]-02  Implement API client / connector
ST-[US-003]-03  Map internal data model to external payload
ST-[US-003]-04  Handle API error codes and retry logic
ST-[US-003]-05  Implement webhook handler (if applicable)
ST-[US-003]-06  Write unit tests (mock external API)
ST-[US-003]-07  Write integration tests (sandbox environment)
```

**SubTask naming convention:** `ST-[US-XXX]-[NN] — [Technical Action] [Object]`

---

### Step 3: Write Each SubTask

Open `Master-Documents/SubTask-Template.md`. Fill all sections for each SubTask:

| Section | Content |
|---------|---------|
| Header | SubTask ID, US-ID, EPIC-ID, dates, status |
| 1. SubTask ID | `ST-[US-XXX]-[NN]` |
| 2. SubTask Name | Clear technical action + object |
| 3. Description | What needs to be done, with enough detail to implement |
| 4. User Story Reference | Parent US-ID |
| 5. SubTask Type | Code / Config / Test / Documentation / DevOps |
| 6. Assigned To | Developer role (Frontend / Backend / DevOps / QA) |
| 7. Pre-requisites | SubTasks that must complete before this one can start |
| 8. Technical Details | Implementation notes, libraries, patterns, endpoints to call |
| 9. Acceptance Criteria | Definition of Done for this specific subtask |
| 10. Estimated Effort | Hours (rough) |
| 11. Testing Notes | How to verify this subtask works |
| Revision History | Initial entry |

Save each SubTask as:
```
Project-Documents/SubTasks/ST-[US-XXX]-[NN]-[ShortName].md
```

Or group them in one file per User Story:
```
Project-Documents/SubTasks/SubTasks-US-[XXX].md
```

---

### Step 4: Validate Each SubTask

Run `Master-Documents/SubTask-Template-Checklist.md` against each SubTask.

- All checklist items must pass before a SubTask is added to the sprint board.
- Common gaps: missing pre-requisites, vague description, no acceptance criteria, no assignee role.

---

### Step 5: Build / Update the UserStory-SubTask RTM

Open `Master-Documents/UserStory-SubTask-RTM-Template.md`. Map every User Story to its SubTasks.

- Every User Story must have at least one SubTask.
- Verify the SubTask sequence is logical (schema before service, service before API, API before frontend).
- Save the RTM as:
  ```
  Project-Documents/RTM/UserStory-SubTask-RTM-[ProjectCode].md
  ```

---

## Output Checklist (Definition of Done)

- [ ] Every User Story has been decomposed into SubTasks
- [ ] SubTasks follow the Frontend / Backend / Integration decomposition patterns
- [ ] Each SubTask is independently implementable in ≤ 1 day
- [ ] All SubTask template sections completed (no blank sections)
- [ ] Pre-requisite ordering verified (no circular dependencies)
- [ ] Testing SubTasks included for every Story (unit + integration or E2E)
- [ ] SubTask-Template-Checklist passes for every SubTask
- [ ] UserStory-SubTask RTM populated with 100% coverage
- [ ] All SubTasks saved to `Project-Documents/SubTasks/`
- [ ] RTM saved to `Project-Documents/RTM/`

---

## Flow Diagram

```
┌─────────────────────────┐
│  Read Approved User      │
│  Stories                 │
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│  Decompose Story into    │
│  SubTasks (by type:      │
│  FE / BE / Integration)  │
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│  Write SubTask (loop)    │◄──────────────────┐
│  Using SubTask-Template  │                   │
└──────────┬──────────────┘                   │
           ▼                                  │
┌─────────────────────────┐                   │
│  Run SubTask Checklist   │── Gaps found? ───┘
└──────────┬──────────────┘
           │ All subtasks pass
           ▼
┌─────────────────────────┐
│  Update UserStory-       │
│  SubTask RTM             │
└──────────┬──────────────┘
           ▼
┌─────────────────────────┐
│  SubTasks Complete ✅    │
└─────────────────────────┘
```

---

## Rules

- NEVER skip testing SubTasks — every story must have at least one test SubTask.
- NEVER create a SubTask that depends on itself or creates a circular dependency.
- SubTasks must be atomic — one developer, one day, one concern.
- If a SubTask is > 1 day, split it further.
- Order matters: schema → model → repository → service → API → frontend → tests.
- SubTask IDs are permanent — never reuse a deleted SubTask's ID.

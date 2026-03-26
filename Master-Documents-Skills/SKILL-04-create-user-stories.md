---
description: Derive User Stories from EPICs and screens, write each using the UserStory-Template, validate completeness, and maintain the EPICs-Screen-UserStory RTM
---

# `/create-user-stories` — User Story Creator

> Derive User Stories from approved EPICs and screen wireframes, write each using the UserStory-Template, validate completeness, and maintain the EPICs-Screen-UserStory RTM.

You are a senior business analyst and scrum practitioner. Your job is to break each EPIC down into well-structured, independently deliverable User Stories that together cover 100% of the EPIC's scope.

---

## Reference Documents

| # | Document | Purpose |
|---|----------|---------|
| T1 | `Master-Documents/UserStory-Template.md` | Write each individual User Story |
| T2 | `Master-Documents/UserStory-Template-Checklist.md` | Validate each User Story for completeness |
| T3 | `Master-Documents/EPICs-Screen-UserStory-RTM-Template.md` | Traceability from EPICs + Screens → User Stories |

**Input required:**
- Approved EPICs from `Project-Documents/EPICs/`
- Approved Screens from `Project-Documents/Screens/`

---

## Your Process

### Step 1: Read EPICs and Screens

For each EPIC, read:
- Section 7 (Scope: Modules, Features, Edge Cases)
- Section 8 (Acceptance Criteria)
- Section 4b (High-Level Flow)
- All screens mapped to this EPIC in the EPICs-Screen RTM

---

### Step 2: Decompose Each EPIC into User Stories

**User Story identification rules:**
- One User Story per distinct actor action / capability unit
- Each story must be independently testable and deliverable
- Scope each story to exactly ONE type: **Frontend**, **Backend**, or **Integration**
- A single EPIC feature may produce multiple stories (one per type/layer)
- Naming convention: `US-[001] — [Actor] [Action] [Object]`

**Decomposition pattern:**

| EPIC Feature | Story Type | Example Story |
|---|---|---|
| User Login | Frontend | US-001 — User sees login form and submits credentials |
| User Login | Backend | US-002 — System authenticates user and returns JWT token |
| Report Export | Frontend | US-003 — User selects export format and downloads file |
| Report Export | Backend | US-004 — System generates CSV/PDF from filtered data |
| Payment Gateway | Integration | US-005 — System processes payment via Stripe API |

---

### Step 3: Write Each User Story

Open `Master-Documents/UserStory-Template.md`. Fill all sections for each story:

| Section | Content |
|---------|---------|
| Header | US-ID, EPIC-ID, Sprint, dates, status |
| 1. User Story ID | `US-[XXX]` (sequential, never reused) |
| 2. User Story Name | Short capability title |
| 3. User Story Description | "As a [actor], I want to [action], so that [benefit]" |
| 4. EPIC Reference | Parent EPIC ID and name |
| 5. User Story Type | Frontend / Backend / Integration |
| 6. Trigger | What event initiates this story |
| 7. Actor(s) | Who performs the action |
| 8. Primary Flow | Step-by-step happy path; OR alternate scenarios |
| 9. StateChart | States and transitions for the main entity (e.g., Order: Draft → Submitted → Approved → Rejected) |
| 10. Screen Reference | Screen ID(s) this story is visible on |
| 11. Display Field Types | Fields shown: label, type (text/date/number/boolean), source |
| 12. Database Entities | Tables/collections read or written; key fields |
| 13. Business Rules | Rules that govern behaviour (e.g., "only active users can submit") |
| 14. Validations | Field-level validations and error messages |
| 15. Integrations | External systems called, endpoints, payload structure |
| 16. Acceptance Criteria | Gherkin-style: Given / When / Then |
| 17. SubTasks | High-level technical sub-tasks (detailed in SKILL-05) |
| Revision History | Initial entry |

**Acceptance Criteria format (Gherkin):**
```
Given [precondition]
When  [actor action]
Then  [expected outcome]
And   [additional outcome]

Example:
Given the user is on the Login screen and has a valid account
When  they enter correct credentials and click Login
Then  the system authenticates them, creates a session, and redirects to Dashboard
And   the last-login timestamp is updated in the database
```

Save each User Story as:
```
Project-Documents/UserStories/US-[001]-[ShortName].md
```

---

### Step 4: Validate Each User Story

Run `Master-Documents/UserStory-Template-Checklist.md` against each story.

- All checklist items must pass before a story is marked **Approved**.
- Common gaps: vague acceptance criteria, missing business rules, no database entity listed, missing state transitions.

---

### Step 5: Build / Update the EPICs-Screen-UserStory RTM

Open `Master-Documents/EPICs-Screen-UserStory-RTM-Template.md`. For each EPIC feature and associated screen, map to the User Story IDs that implement it.

- Every EPIC feature + screen combination must trace to at least one User Story.
- Flag any unmapped combination as a **coverage gap**.
- Save the RTM as:
  ```
  Project-Documents/RTM/EPICs-Screen-UserStory-RTM-[ProjectCode].md
  ```

---

## Output Checklist (Definition of Done)

- [ ] Every EPIC feature has corresponding User Stories (Frontend / Backend / Integration as applicable)
- [ ] Each User Story has the "As a / I want / So that" description filled
- [ ] All 17 User Story template sections completed (no blank sections)
- [ ] Acceptance Criteria written in Given/When/Then format
- [ ] Business rules and validations explicitly documented
- [ ] Database entities identified for all Backend stories
- [ ] Screen references populated for all Frontend stories
- [ ] Integration endpoints documented for all Integration stories
- [ ] UserStory-Template-Checklist passes for every story
- [ ] EPICs-Screen-UserStory RTM populated with 100% coverage
- [ ] All User Stories saved to `Project-Documents/UserStories/`
- [ ] RTM saved to `Project-Documents/RTM/`

---

## Flow Diagram

```
┌──────────────────────────────┐
│  Read Approved EPICs + Screens│
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│  Decompose EPIC → User Stories│
│  (Frontend / Backend /        │
│   Integration per feature)    │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│  Write User Story (loop)      │◄─────────────────┐
│  Using UserStory-Template     │                  │
└──────────────┬───────────────┘                  │
               ▼                                  │
┌──────────────────────────────┐                  │
│  Run UserStory Checklist      │── Gaps found? ──┘
└──────────────┬───────────────┘
               │ All stories pass
               ▼
┌──────────────────────────────┐
│  Update EPICs-Screen-         │
│  UserStory RTM                │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│  User Stories Complete ✅     │
└──────────────────────────────┘
```

---

## Rules

- NEVER write User Stories without approved EPICs AND approved Screens.
- NEVER mix Frontend + Backend in one story — separate by type always.
- "As a system" is NOT a valid actor — every story must have a human actor.
- Acceptance Criteria must be testable by a QA engineer — no subjective language.
- If a story cannot be delivered in one sprint (typically 1–2 weeks), split it further.
- US IDs are permanent — never reuse a deleted story's ID.

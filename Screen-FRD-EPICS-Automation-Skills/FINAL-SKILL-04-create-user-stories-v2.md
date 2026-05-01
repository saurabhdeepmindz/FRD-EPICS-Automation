---
description: Derive User Stories from approved EPIC Handoff Packets, FRD Features, and screens. Write each using the UserStory-Template. Handle TBD-Future integrations in Section 21 and Algorithm Outline with assumed interfaces. Maintain full RTM traceability.
---

# `/create-user-stories` — SKILL-04: User Story Creator [v2.0 — TBD-Future Enabled]

> Derive User Stories from approved EPICs and FRD Feature Lists. Write each using the UserStory-Template with full technical context for source code generation. TBD-Future integration signals are carried forward from EPICs with assumed interfaces — User Stories referencing TBD-Future integrations are NOT blocked and receive status CONFIRMED-PARTIAL.

You are a senior business analyst and scrum practitioner. Your job is to break each EPIC down into well-structured, independently deliverable User Stories that together cover 100% of the EPIC's scope, while capturing the technical context that bridges functional requirements to code generation.

---

## Prerequisites — What Must Exist Before This Skill Runs

| Prerequisite | Location | Status Required |
|-------------|----------|-----------------|
| FRD module section | `Project-Documents/FRD/FRD-[ProjectCode]-Screen-First.md` | Module section Approved |
| FRD Handoff Packet JSON | `Project-Documents/FRD/FRD-Handoff-[ProjectCode]-[ModuleID].json` | Generated |
| EPIC documents | `Project-Documents/EPICs/EPIC-[NNN]-[ShortName].md` | All Approved |
| EPIC Handoff Packets JSON | `Project-Documents/EPICs/EPIC-Handoff-[ProjectCode]-EPIC-[NNN].json` | Generated |
| Screen Summary Cards JSON | `Project-Documents/Screens/Screen-Summary-Cards-[ProjectCode]-[ModuleID].json` | Generated |
| Module-FRD-EPICs RTM | `Project-Documents/RTM/Module-FRD-EPICs-RTM-[ProjectCode].md` | Populated |
| TBD-Future Integration Registry | FRD Section 9 | Current |

---

## Context Management — What This Skill Receives

```
EPIC Handoff Packet JSON — current EPIC           ~600 tokens
FRD Handoff Packet JSON — current module          ~400 tokens
Screen Summary Cards — relevant screens only      ~120 tokens per screen
Compact Module Index                              ~50 tokens per module
TBD-Future Registry — relevant entries only       ~60 tokens per entry
Running RTM — current module rows                 ~40 tokens per feature
Skill-04 instructions                             ~6,000 tokens
```

Full EPIC documents and full FRD documents are NOT injected into context.

---

## User Story Status Definitions

| Status | Meaning | Can Proceed to SubTasks? |
|--------|---------|--------------------------|
| `CONFIRMED` | All integrations confirmed | Yes |
| `CONFIRMED-PARTIAL` | Story scope confirmed, one or more integrations TBD-Future | Yes — not blocked |
| `DRAFT` | Unresolved question about story's own scope or behaviour | No |

---

## Reference Documents

| # | Document | Purpose |
|---|----------|---------|
| T1 | `Master-Documents/UserStory-Template.md` | Write each individual User Story |
| T2 | `Master-Documents/UserStory-Template-Checklist.md` | Validate each User Story |
| T3 | `Master-Documents/Module-FRD-EPIC-Screen-UserStory-RTM-Template.md` | RTM extension |

---

## 🚨 MANDATORY OUTPUT RULE — READ BEFORE GENERATING ANYTHING

**You MUST produce User Stories for EVERY feature listed in the input RTM / EPIC Handoff Packet — not a subset, not just the "most important" one, not just the first one.**

Concrete expectation per run:

1. The input will list N features (typically 5–10 per EPIC).
2. Each feature must produce 2–3 User Stories (Frontend / Backend / Integration as applicable).
3. Your final output must therefore contain **~2×N to 3×N complete User Stories**.
4. Organise the output with one `## User Stories for {FEATURE_ID}` heading per feature, followed by every story that belongs under it.
5. Before you write any stories, emit a **Coverage Summary** table at the very top of your output:

```
## Coverage Summary

| Feature ID | Feature Name            | Story Count | Story IDs             |
|-----------:|-------------------------|:-----------:|-----------------------|
| F-04-01    | Search Previous Chats   |      2      | US-031, US-032        |
| F-04-02    | Initiate New Research   |      3      | US-033, US-034, US-035|
| F-04-03    | Filter Conversations    |      2      | US-036, US-037        |
…
```

This table is the **contract** — every row in it must be followed by the corresponding full story sections below. If you cannot fit all stories in a single response, explicitly flag it at the end with `## ⚠ CONTINUATION REQUIRED — N features unwritten` listing which features remain. **Never silently omit features.**

---

## Your Process

### Step 1: Read EPIC and FRD Handoff Packets

For each EPIC, read the EPIC Handoff Packet JSON. Extract:
- Module ID and Package Name
- All Feature IDs assigned to this EPIC and their statuses
- Integration Domains — classified as CONFIRMED or TBD-Future
- TBD-Future Registry IDs referenced by this EPIC
- Acceptance criteria summary

Also read the FRD Handoff Packet JSON for the current module to access Feature-level business rules and validations.

---

### Step 2: Decompose Each EPIC Feature into User Stories

**User Story identification rules:**
- One User Story per distinct actor action OR system capability unit
- Each story must be independently testable and deliverable
- Scope each story to exactly ONE type: Frontend, Backend, or Integration
- A single FRD Feature typically produces 2–3 stories (Frontend + Backend + Integration)
- Every story must reference its parent FRD Feature ID — mandatory for RTM continuity

**Decomposition pattern:**

| FRD Feature | Story Type | Example Story |
|-------------|-----------|---------------|
| F-02-07 Task Submission & Notification | Frontend | US-012 — Admin submits task assignment form |
| F-02-07 Task Submission & Notification | Backend | US-013 — System validates and persists task record |
| F-02-07 Task Submission & Notification | Integration | US-014 — System triggers notification to assigned professional |

**Status inheritance:**
- If an FRD Feature is CONFIRMED-PARTIAL due to TBD-Future integrations, all User Stories for that feature inherit CONFIRMED-PARTIAL status
- CONFIRMED-PARTIAL User Stories proceed to SubTask generation without waiting for resolution
- The TBD-Future interface is carried forward with assumed values

**Naming convention:** `US-[XXX] — [Actor] [Action] [Object]`

---

### Step 3: Write Each User Story — All 26 Sections

Open `Master-Documents/UserStory-Template.md`. Fill ALL sections.

**Critical mapping rules for LLD generation — apply before writing any section:**

| User Story Field | Maps Directly To | In Skill |
|-----------------|-----------------|---------|
| Section 3 — User Story Description (Goal) | Class Description in SubTask Section 8 | SKILL-05 |
| Section 10 — Actor(s) | "Identifies who triggers this class/service" in Class Description | SKILL-05 Section 8 |
| Section 17 — API Contract (Input/Output) | Method Signature: arguments + return type | SKILL-05 Sections 11, 12 |
| Section 22 — Algorithm Outline | Method body Algorithm in SubTask Section 14 | SKILL-05 Section 14 |
| Section 24 — Acceptance Criteria | Method-level success conditions + QA Test Cases | SKILL-05 Section 20 |
| Section 25 — Source File Reference | Exact file the automation tool creates | SKILL-05 Section 6 |

**Rule for Goal → Class Description:** The User Story Description (Section 3) written as "As a [actor], I want to [action], so that [benefit]" must be directly usable as the seed of the Class Description in SKILL-05 Section 8. When writing Section 3, write it with enough detail that a developer reading only the class docstring understands: who uses this class, what it does, and what business outcome it delivers. The automation tool reads Section 3 and Section 10 together to generate the opening sentence of the class docstring.

Example:
```
Section 3 (User Story Goal):
"As an Admin, I want to assign a task to a professional with type, priority, 
due date, and notes, so that the professional is notified immediately and the 
task appears in their queue."

Section 10 (Actor):
Admin

↓ Automation tool generates Class Description opening sentence:

"This service class is used by Admin users to assign operational tasks to 
professionals within the Tax Compass platform. It handles task creation, 
input validation, professional verification, task persistence, and 
notification dispatch."
```

| Section | Content | Purpose in Automation Tool |
|---------|---------|---------------------------|
| Header | US-ID, EPIC-ID, Sprint, dates, status | Identifier |
| 1. User Story ID | `US-[XXX]` — sequential, never reused | Unique key in RTM |
| 2. User Story Name | Short capability title | Story-level comment block |
| 3. User Story Description | "As a [actor], I want to [action], so that [benefit]" | Human-readable intent |
| **4. Module Reference** | **Module ID + Module Name + Package Name** | **Package context for code generation** |
| **5. FRD Feature Reference** | **Feature ID(s) this story implements + Feature Status** | **RTM linkage — mandatory** |
| 6. EPIC Reference | Parent EPIC ID and name | Parent context |
| 7. User Story Type | Frontend / Backend / Integration | Determines code layer generated |
| **8. User Story Status** | **CONFIRMED / CONFIRMED-PARTIAL / DRAFT** | **Propagated to SubTasks** |
| 9. Trigger | What event initiates this story | Entry point |
| 10. Actor(s) | Who performs the action — human role only, never "system" | Subject of story |
| 11. Primary Flow | Step-by-step happy path numbered 1–N — TBD-Future steps marked | Algorithm source for Backend stories |
| 12. Alternate / Exception Flows | Scenarios that deviate from happy path | Error handling source |
| 13. StateChart | Entity states and transitions | State machine generation |
| 14. Screen Reference | Screen ID(s) and component names | Frontend component context |
| 15. Display Field Types | Fields shown: label, type, source (API/static/computed) | Frontend field generation |
| **16. Primary Class Name** | **The main class/component this story maps to** | **Class name in generated source code** |
| **17. API Contract** | **Input → Process → Output for Backend/Integration stories** | **Method signature generation** |
| 18. Database Entities | Tables/collections read or written; key fields | Repository/model generation |
| 19. Business Rules | Named rules — each with BR-ID | Validation logic generation |
| 20. Validations | Field-level validations: field, rule, error message | Input validation generation |
| **21. Integrations** | **External systems called — CONFIRMED or TBD-Future format** | **Integration class generation** |
| **22. Algorithm Outline** | **Numbered plain-English steps — TBD-Future steps marked** | **Method body generation in SubTasks** |
| **23. Error Handling Outline** | **Named exceptions, trigger conditions, fallback behaviour** | **Exception class generation** |
| 24. Acceptance Criteria | Gherkin: Given / When / Then — class/method references included | QA test case generation |
| **25. Source File Reference** | **Expected source file name(s)** | **File naming for automation tool** |
| **26. Traceability Header Content** | **Module ID, Feature ID, Epic ID, Story ID, Screen Ref, TBD-Future refs** | **Embedded in every generated source file** |
| 27. SubTasks | High-level technical sub-tasks (detailed in SKILL-05) | Sprint planning |
| Revision History | Initial entry | Change tracking |

---

### Section 16 — Primary Class Name: Guidance

| Story Type | What to Capture |
|-----------|----------------|
| Frontend | Component class name e.g. `TaskAssignmentForm`, `ProfessionalDropdown` |
| Backend | Service class name e.g. `TaskService`, `NotificationService` |
| Integration | Client/connector class name e.g. `EmailServiceClient`, `NotificationGateway` |

---

### Section 17 — API Contract: Format

```
Input:
  - taskType       (String, required)     — Category of task e.g. "Research Verification"
  - professionalId (UUID, required)       — Unique ID of the professional being assigned
  - priorityLevel  (Enum, required)       — HIGH | MEDIUM | LOW
  - dueDateTime    (DateTime, required)   — Must be a future timestamp
  - taskNotes      (String, optional)     — Max 1000 characters

Process:
  Validate inputs → Verify professional exists and is active [TBD-Future: MOD-03] →
  Persist task → Trigger notification → Log audit event

Output:
  - taskId                 (UUID)      — System-generated unique task identifier
  - assignmentTimestamp    (DateTime)  — When the task was created
  - notificationStatus     (Enum)      — SENT | FAILED | PENDING
```

---

### Section 21 — Integrations: TBD-Future Format

Every integration must be documented individually using one of two formats.

**CONFIRMED integration format:**

```
Integration 1:
  System Name:       Notification Service
  Status:            CONFIRMED
  Endpoint/Method:   sendTaskAssignmentNotification(professionalId, taskId)
  Request Payload:   {professionalId: UUID, taskId: UUID, taskType: String}
  Response:          NotificationStatus enum — SENT | FAILED | PENDING
  Failure Handling:  Log error, set status FAILED, do not roll back task
```

**TBD-Future integration format:**

```
Integration 2:
  System Name:       Professional Profile Service
  Status:            TBD-Future
  TBD-Future Ref:    TBD-001
  Referenced Module: MOD-03 — Professionals (not yet processed)
  Assumed Method:    getProfessionalById(professionalId)
  Assumed Return:    Professional entity with {id: UUID, status: Enum(ACTIVE|INACTIVE)}
  Assumed Usage:     Check professional.status == ACTIVE before task assignment
  Resolution:        Update this section when MOD-03 User Stories are approved
  Impact on Story:   Algorithm Step 6 uses TBD-Future interface —
                     placeholder logic applies until resolved.
  SubTask Impact:    ST-US013-BE-06 will be marked TBD-Future and updated on resolution
```

**Rule:** NEVER write "TBD" alone in Section 21. Even for TBD-Future integrations, the assumed method name, assumed return type, and assumed usage must be documented.

---

### Section 22 — Algorithm Outline: Format with TBD-Future Steps

For Backend User Stories, the Algorithm Outline is a numbered plain-English sequence of what the primary method does. TBD-Future steps must be explicitly marked.

```
Algorithm Outline — TaskService.createTask():

  Step 1:  Call AuthService.getCurrentUser() to retrieve calling user identity and role.
  Step 2:  If calling user's role is not ADMIN, throw AuthorisationException.
  Step 3:  Validate taskType — apply TASK_TYPE_REQUIRED rule. If fails, throw TaskValidationException.
  Step 4:  Validate dueDateTime — apply DUE_DATE_MUST_BE_FUTURE rule. If fails, throw TaskValidationException.
  Step 5:  Validate taskNotes length if provided — apply NOTES_MAX_LENGTH rule.
  Step 6:  [TBD-Future — MOD-03 — TBD-001]
           Call ProfessionalService.getProfessionalById(professionalId).
           Assumed: returns Professional entity. Check professional.status == ACTIVE.
           If not found or not active, throw ProfessionalNotFoundException.
           Update this step when MOD-03 is confirmed.
  Step 7:  Construct Task entity with system-generated Task ID and current timestamp.
  Step 8:  Call TaskRepository.save(task). If fails, throw TaskPersistenceException.
  Step 9:  Call NotificationService.sendTaskAssignmentNotification(professionalId, taskId).
           If fails: log error, set notificationStatus = FAILED, continue.
  Step 10: Call AuditLogService.logAdminAction(currentUser.id, "TASK_ASSIGNED", taskId).
  Step 11: Return TaskConfirmationResponse with taskId, assignmentTimestamp, notificationStatus.
```

---

### Section 26 — Traceability Header Content: Format with TBD-Future

```
/*
 * ============================================================
 * TRACEABILITY
 * ============================================================
 * Module:      MOD-02 — Task Assignment & Workflow Management
 * Package:     task_management
 * Feature:     F-02-07 — Task Submission & Notification
 * Feature Status: CONFIRMED-PARTIAL
 * Epic:        EPIC-02 — Task Assignment & Workflow Management
 * User Story:  US-013 — System validates and persists task record
 * Story Status: CONFIRMED-PARTIAL
 * Screen:      SCR-15 — Assign Task Screen
 * Test Cases:  TC-US013-BE-001 to TC-US013-BE-005
 *
 * TBD-Future Dependencies:
 *   TBD-001: ProfessionalService interface — pending MOD-03 approval
 *   Assumed: getProfessionalById(professionalId) → Professional{status}
 *   Resolution: Update Algorithm Step 6 and Integration Point 2
 *               when MOD-03 SubTasks are confirmed
 * ============================================================
 */
```

---

### Acceptance Criteria Format (Gherkin with TBD-Future notation)

```
Given the Admin is authenticated and all mandatory task fields are completed
When  the Admin clicks "Assign Task Now"
Then  TaskService.createTask() persists the task and returns a valid Task ID
And   NotificationService.sendTaskAssignmentNotification() is called [CONFIRMED]
And   AuditLogService.logAdminAction() records the action [CONFIRMED]
And   Professional validation is performed via ProfessionalService.getProfessionalById() 
      [TBD-Future — MOD-03 — assumed interface]
```

---

### Step 4: Validate Each User Story

**Standard validation checks:**
- [ ] FRD Feature ID referenced and not blank
- [ ] Module ID and Package Name referenced
- [ ] Primary Class Name specified
- [ ] API Contract completed for all Backend and Integration stories
- [ ] Algorithm Outline completed for Backend stories (minimum 5 steps)
- [ ] Error Handling Outline lists at least one named exception
- [ ] Source File Reference specified
- [ ] Traceability Header Content populated
- [ ] Acceptance Criteria reference class/method names

**TBD-Future specific checks:**
- [ ] Every TBD-Future integration in Section 21 has: System Name, TBD-Future Ref, Referenced Module, Assumed Method, Assumed Return, Resolution, SubTask Impact
- [ ] Every Algorithm step referencing a TBD-Future integration is marked with [TBD-Future — MOD-XX — TBD-NNN]
- [ ] Traceability Header includes TBD-Future Dependencies section listing all TBD-Future refs
- [ ] User Story status is correctly set: CONFIRMED / CONFIRMED-PARTIAL / DRAFT
- [ ] CONFIRMED-PARTIAL stories are NOT blocked — they proceed to SubTask generation
- [ ] No story is DRAFT solely because of TBD-Future integrations

---

### Step 5: Extend the Master RTM

Extend the Module-FRD-EPICs RTM with User Story columns including TBD-Future tracking:

| Module ID | Package | Feature ID | Feature Name | Epic ID | Story ID | Story Name | Story Type | Story Status | Primary Class | Source File | Screen Ref | TBD-Future Ref |
|-----------|---------|------------|-------------|---------|----------|-----------|-----------|-------------|--------------|-------------|------------|----------------|
| MOD-02 | task_management | F-02-07 | Task Submission | EPIC-02 | US-013 | System validates & persists task | Backend | CONFIRMED-PARTIAL | `TaskService` | TaskService.java | SCR-15 | TBD-001 |

Save as:
```
Project-Documents/RTM/Module-FRD-EPIC-Screen-UserStory-RTM-[ProjectCode].md
```

---

## Output Checklist (Definition of Done)

**FRD and EPIC Traceability:**
- [ ] Every FRD Feature has corresponding User Stories (Frontend / Backend / Integration)
- [ ] Every User Story references its FRD Feature ID and Feature Status
- [ ] Every User Story references its Module ID, Package Name, and EPIC ID

**Technical Content:**
- [ ] Every User Story has a Primary Class Name
- [ ] All Backend stories have a completed API Contract
- [ ] All Backend stories have an Algorithm Outline (min 5 steps)
- [ ] All stories have an Error Handling Outline
- [ ] All 27 User Story template sections completed

**TBD-Future:**
- [ ] Every TBD-Future integration in Section 21 fully documented (no bare "TBD" entries)
- [ ] Every TBD-Future algorithm step marked with [TBD-Future — MOD-XX — TBD-NNN]
- [ ] Traceability Header includes TBD-Future Dependencies for every CONFIRMED-PARTIAL story
- [ ] No story is DRAFT or blocked due to TBD-Future integrations
- [ ] User Story statuses correctly set

**Quality:**
- [ ] Acceptance Criteria in Given/When/Then format with class/method references
- [ ] Business Rules explicitly named with BR-IDs
- [ ] Source File Reference populated for all stories
- [ ] UserStory-Template-Checklist v2 passes for every story
- [ ] Master RTM extended with TBD-Future column — 100% coverage
- [ ] All User Stories saved to `Project-Documents/UserStories/`
- [ ] RTM saved to `Project-Documents/RTM/`

---

## Rules

### Screen Citation Format (mandatory across every User Story section)

When citing a screen in **prose** — including the Description, Acceptance
Criteria, Edge Cases, Test Scenarios, Algorithm Outline, the §3 Story
heading, and the Traceability Header `Screen:` field — write the screen
with both its ID and title separated by an em-dash:

- ✅ `Screen: SCR-15 — Assign Task Screen`  (matches the existing example
  in §3 of this skill)
- ✅ `On SCR-15 — Assign Task Screen the Admin selects a professional`
- ❌ `SCR-15` (bare ID, no title)
- ❌ `SCR-15 (Assign Task Screen)` (parens — non-standard)

Bare IDs (no title) are acceptable ONLY in:

- The Section 14 RTM/inventory cell that has a column header for Screen.
- JSON `screenIds` arrays inside any handoff packet.
- Inline references in code-fence Algorithm Outlines where the screen is
  mentioned more than once and the first mention already carries the title.

This keeps the customer-facing PDF/Word exports, the live preview, and the
RTM consistent without the export pipeline patching references after the
fact. It also matches the format SKILL-05 uses for SubTask Traceability.

### General

- NEVER write User Stories without approved EPICs, FRD, AND Screens.
- NEVER mix Frontend + Backend in one story — separate by type always.
- NEVER leave FRD Feature ID blank.
- NEVER leave Primary Class Name blank.
- NEVER leave Algorithm Outline blank for Backend stories.
- NEVER write bare "TBD" in Section 21 — always document assumed interface.
- NEVER block a CONFIRMED-PARTIAL story from SubTask generation.
- "As a system" is NOT a valid actor — every story must have a human role.
- Acceptance Criteria must reference class and method names.
- TBD-Future steps in Algorithm Outline must include the TBD-Future Ref ID.
- US IDs are permanent — never reuse a deleted story's ID.

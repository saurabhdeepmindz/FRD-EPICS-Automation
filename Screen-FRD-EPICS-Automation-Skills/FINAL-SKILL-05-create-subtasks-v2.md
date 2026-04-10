---
description: Decompose each approved User Story into atomic, implementable SubTasks. Every SubTask carries complete class, method, argument, validation, algorithm, integration, and error-handling detail for source code generation. TBD-Future integrations are carried forward with assumed interfaces and stub implementation guidance — SubTasks are never blocked by TBD-Future dependencies.
---

# `/create-subtasks` — SKILL-05: SubTask Creator [v2.0 — TBD-Future Enabled]

> Decompose each approved User Story into atomic, sprint-ready SubTasks. Write each using the SubTask-Template. Every AUTOMATION CRITICAL field must be fully populated. TBD-Future integration points carry assumed interfaces with stub/mock guidance so developers can proceed without waiting for cross-module resolution.

You are a tech lead and senior business analyst working together. Your job is to take approved User Stories and break them into the smallest, independently assignable SubTasks — each carrying enough detail for the automation tool to generate a named class, named method, method signature, docstring, algorithm, validations, integration calls, error handling, and test case linkage.

---

## Prerequisites — What Must Exist Before This Skill Runs

| Prerequisite | Location | Status Required |
|-------------|----------|-----------------|
| Approved User Stories | `Project-Documents/UserStories/` | All Approved |
| Approved Screens | `Project-Documents/Screens/` | Approved |
| Master RTM (Module → Feature → Epic → Story) | `Project-Documents/RTM/` | Populated |
| TBD-Future Integration Registry | FRD Section 9 | Current |

**CONFIRMED-PARTIAL User Stories proceed to SubTask generation without waiting for TBD-Future resolution.**

---

## The Core Principle

> The SubTask is the atomic source code specification. When the automation tool reads a SubTask, it must independently generate: the source file name, class definition with docstring, method signature with all arguments typed and described, method docstring, step-by-step algorithm as code logic, all validation rules, all integration calls with exact service class and method names, all exception throws and error handling, and the traceability comment block.
>
> For TBD-Future integration points, the SubTask provides the assumed interface with stub/mock implementation guidance so the developer can write working code immediately — not wait for cross-module resolution.

---

## Context Management — What This Skill Receives

```
Current User Story — full document                ~3,000-5,000 tokens
Parent EPIC Handoff Packet JSON                   ~600 tokens
FRD Feature entry from Handoff Packet             ~200 tokens
Module entry from Compact Module Index            ~50 tokens
Running RTM — current module rows                 ~40 tokens per feature
TBD-Future Registry — relevant entries only       ~60 tokens per entry
Skill-05 instructions                             ~8,000 tokens
```

---

## Your Process

### Step 1: Read Each User Story

Open each User Story and extract:
- Story type (Frontend / Backend / Integration)
- Story status (CONFIRMED / CONFIRMED-PARTIAL)
- Module ID and Package Name (Section 4)
- FRD Feature ID and Feature Status (Section 5)
- Primary Class Name (Section 16)
- API Contract (Section 17)
- Primary Flow / Algorithm Outline (Sections 11 and 22)
- Business Rules (Section 19)
- Validations (Section 20)
- Integrations — Section 21 including TBD-Future entries
- Error Handling Outline (Section 23)
- Source File Reference (Section 25)
- Traceability Header Content including TBD-Future Dependencies (Section 26)

---

### Step 2: Identify SubTasks for Each Story

#### Frontend Story → SubTasks:
```
ST-[US-XXX]-FE-01  Create [ComponentName] component / page structure
ST-[US-XXX]-FE-02  Implement form fields and layout per wireframe [Screen ID]
ST-[US-XXX]-FE-03  Implement field-level validations and error message display
ST-[US-XXX]-FE-04  Implement state management (loading / success / error states)
ST-[US-XXX]-FE-05  Connect to API endpoint — integrate with backend
ST-[US-XXX]-FE-06  Implement navigation actions (submit / cancel / back)
ST-[US-XXX]-FE-07  Apply responsive design (mobile / tablet / desktop)
ST-[US-XXX]-FE-08  Write unit tests for [ComponentName]
ST-[US-XXX]-FE-09  Write E2E test for user flow
```

#### Backend Story → SubTasks:
```
ST-[US-XXX]-BE-01  Create / update database schema and migration
ST-[US-XXX]-BE-02  Create [EntityName] data model / entity class
ST-[US-XXX]-BE-03  Implement [EntityName]Repository — database query methods
ST-[US-XXX]-BE-04  Implement [ServiceName] — primary business logic method
ST-[US-XXX]-BE-05  Implement input validation rules in [ServiceName]
ST-[US-XXX]-BE-06  Implement integration calls within [ServiceName]
ST-[US-XXX]-BE-07  Create API controller / router — expose [ServiceName] as endpoint
ST-[US-XXX]-BE-08  Implement authentication / authorisation guard
ST-[US-XXX]-BE-09  Implement error handling and exception classes
ST-[US-XXX]-BE-10  Write unit tests — [ServiceName] layer
ST-[US-XXX]-BE-11  Write integration tests — API endpoint
```

#### Integration Story → SubTasks:
```
ST-[US-XXX]-IN-01  Research and document third-party API contract / SDK
ST-[US-XXX]-IN-02  Implement [ExternalSystemName]Client / connector class
ST-[US-XXX]-IN-03  Map internal data model to external payload
ST-[US-XXX]-IN-04  Implement error codes, retry logic, and timeout handling
ST-[US-XXX]-IN-05  Implement webhook handler (if applicable)
ST-[US-XXX]-IN-06  Write unit tests with mocked external API
ST-[US-XXX]-IN-07  Write integration tests in sandbox / test environment
```

#### QA SubTasks (mandatory for every story):
```
ST-[US-XXX]-QA-01  Write test cases — happy path scenario(s)
ST-[US-XXX]-QA-02  Write test cases — negative / validation failure scenarios
ST-[US-XXX]-QA-03  Write test cases — edge cases and boundary conditions
ST-[US-XXX]-QA-04  Write API test cases — Backend and Integration stories
ST-[US-XXX]-QA-05  Write UI test cases — Frontend stories
ST-[US-XXX]-QA-06  Verify traceability — confirm Test Case IDs linked in source file headers
ST-[US-XXX]-QA-07  Write test cases for TBD-Future stub — verify stub behaviour until resolved
```

QA-07 is added when the story has CONFIRMED-PARTIAL status. It covers testing the stub/mock implementation of TBD-Future integration points.

**SubTask naming convention:** `ST-[US-XXX]-[TEAM]-[NN] — [Technical Action] [Object]`

---

### Step 3: Write Each SubTask — Full Template

All fields marked **[AUTOMATION CRITICAL]** are used directly to generate source code. They must never be vague, empty, or generic.

---

#### SubTask Header

```
SubTask ID:         ST-[US-XXX]-[TEAM]-[NN]
User Story ID:      US-[XXX]
User Story Status:  CONFIRMED / CONFIRMED-PARTIAL
EPIC ID:            EPIC-[NNN]
Feature ID:         F-[MM]-[NN]
Feature Status:     CONFIRMED / CONFIRMED-PARTIAL
Module ID:          MOD-[NN]
Package Name:       [package_name]
Status:             Draft / In Progress / Review / Done
Assigned To:        [Frontend Dev / Backend Dev / QA Engineer / DevOps]
Sprint:             [Sprint Number]
Estimated Effort:   [Hours]
TBD-Future Refs:    [List of TBD-NNN IDs if applicable, else None]
```

---

#### Section 1 — SubTask ID
`ST-[US-XXX]-[TEAM]-[NN]` — unique, permanent

#### Section 2 — SubTask Name
Clear technical action + object. Example: `Implement createTask() business logic in TaskService`

#### Section 3 — SubTask Type
Code / Config / Test / Documentation / DevOps

#### Section 4 — Description **[AUTOMATION CRITICAL]**
3–5 sentences describing what this SubTask implements, why, and its boundaries. Becomes the SubTask-level docstring in source file.

#### Section 5 — Pre-requisites
List of SubTask IDs that must complete before this one can start.

#### Section 6 — Source File Name **[AUTOMATION CRITICAL]**
Exact file name: `TaskService.java`, `TaskAssignmentForm.jsx`

#### Section 7 — Class Name **[AUTOMATION CRITICAL]**
Exact class name: `TaskService`

#### Section 8 — Class Description **[AUTOMATION CRITICAL]**
Full paragraph describing what this class does, its responsibility boundary, and what it is NOT responsible for. Becomes the class-level docstring verbatim.

#### Section 9 — Method Name **[AUTOMATION CRITICAL]**
Exact method name: `createTask`

#### Section 10 — Method Description **[AUTOMATION CRITICAL]**
Full paragraph describing what this method does, its inputs, process, output, and side effects. Becomes the method-level docstring verbatim.

#### Section 11 — Arguments **[AUTOMATION CRITICAL]**

Each argument on its own block:

```
Argument 1:
  Name:         taskType
  Type:         String
  Required:     Yes
  Description:  Category of task e.g. "Research Verification"
  Constraints:  Must not be null or empty. Must match TaskType lookup table.

Argument 2:
  Name:         professionalId
  Type:         UUID
  Required:     Yes
  Description:  Unique identifier of the professional being assigned
  Constraints:  Must correspond to existing professional with status = ACTIVE
                [TBD-Future — MOD-03 — TBD-001: validation interface pending]
```

Arguments whose constraints depend on TBD-Future integrations are marked with the TBD-Future Ref.

#### Section 12 — Return Type **[AUTOMATION CRITICAL]**
Return type name, description of what it contains, and when null/empty is returned.

#### Section 13 — Validations **[AUTOMATION CRITICAL]**

Each validation rule individually:

```
Validation Rule 1:
  Rule Name:        TASK_TYPE_REQUIRED
  Field:            taskType
  Rule:             taskType must not be null, empty, or whitespace-only
  Error Message:    "Task type is required. Please select a task type."
  Exception Thrown: TaskValidationException

Validation Rule 2:
  Rule Name:        DUE_DATE_MUST_BE_FUTURE
  Field:            dueDateTime
  Rule:             dueDateTime must be strictly greater than current server timestamp
  Error Message:    "Due date must be a future date and time."
  Exception Thrown: TaskValidationException

Validation Rule 3:
  Rule Name:        PROFESSIONAL_MUST_BE_ACTIVE
  Field:            professionalId
  Rule:             Professional identified by professionalId must have status = ACTIVE
  Error Message:    "The selected professional is not currently active."
  Exception Thrown: ProfessionalNotFoundException
  TBD-Future Note:  Validation performed via ProfessionalService [TBD-Future — TBD-001]
                    Assumed: getProfessionalById(professionalId).status == ACTIVE
                    Update rule implementation when MOD-03 confirmed.
```

#### Section 14 — Algorithm **[AUTOMATION CRITICAL]**

Numbered steps in exact execution sequence. Specific enough to generate code. TBD-Future steps explicitly marked.

```
Algorithm — TaskService.createTask():

  Step 1:  Call AuthService.getCurrentUser() to retrieve calling user identity and role.
  Step 2:  If calling user's role is not ADMIN, throw AuthorisationException with message
           "Only Admin users may assign tasks."
  Step 3:  Validate taskType — apply TASK_TYPE_REQUIRED rule. Fail → throw TaskValidationException.
  Step 4:  Validate dueDateTime — apply DUE_DATE_MUST_BE_FUTURE rule. Fail → throw TaskValidationException.
  Step 5:  Validate taskNotes length if provided — apply NOTES_MAX_LENGTH rule.
  Step 6:  [TBD-Future — MOD-03 — TBD-001]
           Call ProfessionalService.getProfessionalById(professionalId).
           Assumed return: Professional entity with status field.
           If not found → throw ProfessionalNotFoundException.
           If status != ACTIVE → throw ProfessionalNotFoundException with message
           "The selected professional is not currently active."
           STUB GUIDANCE: Until MOD-03 is confirmed, implement as:
             Professional professional = professionalServiceStub.getProfessionalById(professionalId);
             // Stub returns hardcoded ACTIVE professional for approved test IDs
             // Returns null for unknown IDs — triggers ProfessionalNotFoundException
           Update this step with actual ProfessionalService interface when MOD-03 approved.
  Step 7:  Construct Task entity:
             taskId = UUID.randomUUID()
             taskType, assignedProfessionalId, priorityLevel, dueDateTime, taskNotes from input
             createdByAdminId = currentUser.id
             assignmentTimestamp = Instant.now()
             status = ASSIGNED
  Step 8:  Call TaskRepository.save(task). If fails → throw TaskPersistenceException.
  Step 9:  Call NotificationService.sendTaskAssignmentNotification(professionalId, taskId).
           If fails: log error, set notificationStatus = FAILED, continue.
  Step 10: Call AuditLogService.logAdminAction(currentUser.id, "TASK_ASSIGNED", taskId).
  Step 11: Return TaskConfirmationResponse(taskId, assignmentTimestamp, notificationStatus).
```

#### Section 15 — Integration Points **[AUTOMATION CRITICAL]**

**CONFIRMED integration format:**

```
Integration Point 1:
  Called Class:     NotificationService
  Status:           CONFIRMED
  Method Called:    sendTaskAssignmentNotification(professionalId, taskId)
  Arguments Passed: professionalId (UUID), taskId (UUID)
  Return Value:     NotificationStatus enum (SENT | FAILED | PENDING)
  Return Used For:  Setting notificationStatus in TaskConfirmationResponse
  Failure Behaviour: Log at ERROR level. Set notificationStatus = FAILED.
                     Do NOT throw. Do NOT roll back task creation.
```

**TBD-Future integration format:**

```
Integration Point 2:
  Called Class:         ProfessionalService           [TBD-Future]
  Status:               TBD-Future
  TBD-Future Ref:       TBD-001
  Referenced Module:    MOD-03 — Professionals
  Method Called:        getProfessionalById(professionalId)
  Arguments Passed:     professionalId (UUID)
  Return Value:         Professional entity (assumed — pending MOD-03 approval)
  Return Used For:      Checking professional.status == ACTIVE
  Failure Behaviour:    Throw ProfessionalNotFoundException

  TBD-Future Note:      Interface is an assumed placeholder based on screen
                        evidence and EPIC integration signal TBD-001.
                        Actual class name, method name, and return type MUST
                        be verified and updated when MOD-03 SubTasks are approved.

  Stub Implementation:
    Create ProfessionalServiceStub class implementing ProfessionalService interface:
      - getProfessionalById("known-active-uuid") → Professional{status: ACTIVE}
      - getProfessionalById("known-inactive-uuid") → Professional{status: INACTIVE}
      - getProfessionalById(unknown) → throws NotFoundException
    Use stub in unit tests and local development until MOD-03 confirmed.

  Resolution Action:    When MOD-03 is processed, update:
                        - Called Class (if class name differs)
                        - Method Called (if method name differs)
                        - Return type and field names
                        - Remove stub, inject real ProfessionalService
                        - Update this SubTask's Traceability Header
                        - Notify QA to re-run TC-US013-BE-003
```

#### Section 16 — Error Handling **[AUTOMATION CRITICAL]**

```
Exception 1:
  Exception Class:  AuthorisationException
  Trigger:          Calling user does not hold ADMIN role
  HTTP Status:      403 Forbidden
  On Catch:         Return error response "Insufficient permissions"

Exception 2:
  Exception Class:  TaskValidationException
  Trigger:          Any input validation rule fails (Steps 3–5)
  HTTP Status:      400 Bad Request
  On Catch:         Return error listing all failed validation rule names and messages

Exception 3:
  Exception Class:  ProfessionalNotFoundException
  Trigger:          getProfessionalById() returns null or status != ACTIVE [TBD-Future — TBD-001]
  HTTP Status:      404 Not Found
  On Catch:         Return error with message from ProfessionalNotFoundException

Exception 4:
  Exception Class:  TaskPersistenceException
  Trigger:          TaskRepository.save() fails
  HTTP Status:      500 Internal Server Error
  On Catch:         Roll back partial state. Log at ERROR. Return 500.
```

#### Section 17 — Database Operations
Table/Collection, Operation, Key Fields, Conditions.

#### Section 18 — Technical Notes
Libraries, frameworks, patterns, coding standards relevant to this SubTask.

#### Section 19 — Traceability Header **[AUTOMATION CRITICAL]**

```
/*
 * ============================================================
 * TRACEABILITY
 * ============================================================
 * Module:          MOD-02 — Task Assignment & Workflow Management
 * Package:         task_management
 * Feature:         F-02-07 — Task Submission & Notification
 * Feature Status:  CONFIRMED-PARTIAL
 * Epic:            EPIC-02 — Task Assignment & Workflow Management
 * User Story:      US-013 — System validates and persists task record
 * Story Status:    CONFIRMED-PARTIAL
 * SubTask:         ST-US013-BE-04 — Implement createTask() in TaskService
 * Screen:          SCR-15 — Assign Task Screen
 * Test Cases:      TC-US013-BE-001, TC-US013-BE-002, TC-US013-BE-003,
 *                  TC-US013-BE-004, TC-US013-BE-005
 * Generated:       [Automation Tool Name] v[Version]
 *
 * TBD-Future Dependencies:
 *   TBD-001: ProfessionalService interface — pending MOD-03 approval
 *   Assumed: getProfessionalById(professionalId) → Professional{status}
 *   Stub: ProfessionalServiceStub — replace with real service when MOD-03 confirmed
 *   Affected: Algorithm Step 6, Integration Point 2, Exception 3
 *   Resolution: Update Called Class, Method, Return type when MOD-03 SubTasks approved
 * ============================================================
 */
```

---

#### Section 20 — Project Structure Definition **[AUTOMATION CRITICAL — LLD Generation]**

The automation tool uses this section to determine the exact file system path where the source file is created. This is the bridge between Package Name and physical file location.

**Format:**

```
Project Structure:
  Language/Framework:   Java / Spring Boot
  Base Package:         com.taxcompass
  Module Package:       com.taxcompass.task_management
  Layer Package:        com.taxcompass.task_management.service
  Full File Path:       src/main/java/com/taxcompass/task_management/service/TaskService.java

  Directory Map:
    src/
    └── main/
        └── java/
            └── com/
                └── taxcompass/
                    └── task_management/
                        ├── controller/    TaskController.java
                        ├── service/       TaskService.java       ← this file
                        ├── repository/    TaskRepository.java
                        ├── entity/        TaskEntity.java
                        ├── dto/           TaskConfirmationResponse.java
                        └── exception/     TaskValidationException.java
                                           TaskPersistenceException.java
```

**Layer naming convention (apply consistently across all SubTasks in this module):**

| Class Type | Layer Package Suffix | File Suffix |
|-----------|---------------------|-------------|
| Service | `.service` | `Service.java` |
| Repository | `.repository` | `Repository.java` |
| Entity / Model | `.entity` | `Entity.java` |
| Controller / Router | `.controller` | `Controller.java` |
| Response DTO | `.dto` | `Response.java` |
| Request DTO | `.dto` | `Request.java` |
| Exception | `.exception` | `Exception.java` |
| Frontend Component | `/components/[module]/` | `.jsx` / `.tsx` |
| Frontend Page | `/pages/[module]/` | `.jsx` / `.tsx` |
| Frontend Service | `/services/` | `Service.js` |

**Rule:** Every SubTask must populate Section 20. The Full File Path must be specific enough that the automation tool can call `create_file(path, content)` with zero ambiguity.

---

#### Section 21 — Sequence Diagram Inputs **[AUTOMATION CRITICAL — LLD Generation]**

This section extracts the data from Integration Points (Section 15) in the exact format the automation tool needs to generate UML sequence diagrams for the LLD.

**Format:**

```
Sequence Diagram: createTask() — TaskService

Participants (in order of first appearance):
  1. AdminController        (caller — entry point)
  2. TaskService            (this class)
  3. AuthService            (Step 1 — authentication)
  4. ProfessionalService    (Step 6 — [TBD-Future TBD-001])
  5. TaskRepository         (Step 8 — persistence)
  6. NotificationService    (Step 9 — notification)
  7. AuditLogService        (Step 10 — audit)

Message Sequence:
  AdminController      →  TaskService           : createTask(taskType, professionalId, priorityLevel, dueDateTime, taskNotes)
  TaskService          →  AuthService           : getCurrentUser()
  AuthService          →  TaskService           : User{id, role}
  TaskService          →  TaskService           : validate inputs (Steps 3–5)
  TaskService          →  ProfessionalService   : getProfessionalById(professionalId) [TBD-Future]
  ProfessionalService  →  TaskService           : Professional{status} [TBD-Future assumed]
  TaskService          →  TaskRepository        : save(task)
  TaskRepository       →  TaskService           : Task{taskId}
  TaskService          →  NotificationService   : sendTaskAssignmentNotification(professionalId, taskId)
  NotificationService  →  TaskService           : NotificationStatus
  TaskService          →  AuditLogService       : logAdminAction(adminId, "TASK_ASSIGNED", taskId)
  TaskService          →  AdminController       : TaskConfirmationResponse{taskId, timestamp, notificationStatus}

Exception Flows (shown as alt blocks in UML):
  alt validation fails → TaskService throws TaskValidationException → AdminController returns 400
  alt professional not found → TaskService throws ProfessionalNotFoundException → AdminController returns 404
  alt persistence fails → TaskService throws TaskPersistenceException → AdminController returns 500
  alt notification fails → notificationStatus = FAILED, task persists, return 200 with FAILED status
```

**Rule:** Every Backend and Integration SubTask must have Section 21 populated. Frontend SubTasks may omit this section. TBD-Future participants are included with their assumed interfaces and marked [TBD-Future].

#### Section 22 — Test Case IDs **[AUTOMATION CRITICAL]**
List of TC-IDs that verify this SubTask. Linked in source file header and RTM.

For CONFIRMED-PARTIAL SubTasks, include TBD-Future stub test cases:
```
TC-US013-BE-001  Happy path — valid inputs, active professional, task created
TC-US013-BE-002  Validation failure — null taskType → TaskValidationException
TC-US013-BE-003  Validation failure — past dueDateTime → TaskValidationException
TC-US013-BE-004  Professional not found — ProfessionalNotFoundException [tests stub]
TC-US013-BE-005  Notification failure — task persists, notificationStatus = FAILED
TC-US013-BE-006  TBD-Future stub — verify ProfessionalServiceStub returns expected values
                 [Update to real integration test when MOD-03 confirmed]
```

#### Section 23 — Acceptance Criteria
Definition of Done for this specific SubTask.

#### Section 24 — Testing Notes
How to manually verify this SubTask works. For TBD-Future SubTasks, include stub testing guidance.

---

### Step 4: Validate Each SubTask

**Automation Critical checks:**
- [ ] Source File Name is exact — not generic
- [ ] Class Name is exact — matches User Story Primary Class Name
- [ ] Class Description is a full paragraph — derived from User Story Goal (Section 3) + Actor (Section 10)
- [ ] Method Name is exact — matches API Contract
- [ ] Method Description is a full paragraph
- [ ] All arguments documented: Name, Type, Required, Description, Constraints
- [ ] Return Type fully described
- [ ] Every Validation Rule: Rule Name, Field, Rule, Error Message, Exception
- [ ] Algorithm has numbered steps — minimum 5 for any business logic method
- [ ] Every Algorithm step specific enough to generate code
- [ ] Every Integration Point documented with Called Class, Method, Arguments, Return, Failure
- [ ] Every Exception: Class Name, Trigger, HTTP Status, On Catch behaviour
- [ ] Traceability Header has all 8 standard fields (Section 19)
- [ ] Project Structure Definition populated — Full File Path specified (Section 20)
- [ ] Sequence Diagram Inputs populated for all Backend and Integration SubTasks (Section 21)
- [ ] Test Case IDs listed (Section 22)

**TBD-Future specific checks:**
- [ ] Every TBD-Future Integration Point has: Status, TBD-Future Ref, Referenced Module, Assumed Method, Assumed Return, Stub Implementation guidance, Resolution Action
- [ ] Every TBD-Future Algorithm step marked [TBD-Future — MOD-XX — TBD-NNN] with stub guidance
- [ ] Traceability Header includes TBD-Future Dependencies section
- [ ] Test Case IDs include stub test cases for TBD-Future integration points (QA-07)
- [ ] No SubTask is blocked or marked incomplete due to TBD-Future integrations

---

### Step 5: Extend the Master RTM

| ... Story ID | Story Status | ST-ID | Team | Source File | Class | Method | TBD-Future Ref | Test Case IDs | Status |
|-------------|-------------|-------|------|-------------|-------|--------|----------------|---------------|--------|
| US-013 | CONFIRMED-PARTIAL | ST-US013-BE-04 | BE | TaskService.java | TaskService | createTask() | TBD-001 | TC-US013-BE-001 to 006 | Draft |

Save as:
```
Project-Documents/RTM/Master-RTM-[ProjectCode].md
```

---

## Mandatory Execution Order Within a Story

```
1. Database Schema / Migration             (BE-01)
2. Data Model / Entity Class               (BE-02)
3. Repository Layer                        (BE-03)
4. Service Layer — Primary Method          (BE-04)  ← Most detail required
5. Input Validation                        (BE-05)
6. Integration Calls + Stubs for TBD-Future (BE-06)
7. API Controller / Router                 (BE-07)
8. Auth Guard                              (BE-08)
9. Exception Classes                       (BE-09)
10. Frontend Component                     (FE-01 to FE-07)
11. Unit Tests (including stub tests)      (BE-10, FE-08)
12. Integration / E2E Tests                (BE-11, FE-09)
13. QA Test Cases (including QA-07 stubs)  (QA-01 to QA-07)
```

---

## TBD-Future Resolution Process (When Referenced Module Is Approved)

When MOD-03 is later processed and its SubTasks are approved:

1. System identifies all SubTasks with TBD-Future Ref = TBD-001
2. Resolution notification issued — lists every SubTask requiring update
3. For each affected SubTask:
   - Update Integration Point: Called Class, Method Called, Return Type (if different from assumed)
   - Update Algorithm Step: remove STUB GUIDANCE, update with actual call
   - Update Validation Rule: update constraint if actual interface differs
   - Update Traceability Header: change TBD-Future status to RESOLVED, date resolved
   - Update Test Cases: replace stub test (QA-07) with real integration test
4. SubTask status changes from CONFIRMED-PARTIAL to CONFIRMED
5. RTM TBD-Future column updated: ☐ → ✅

---

## Output Checklist (Definition of Done)

**Every SubTask:**
- [ ] Exact Source File Name
- [ ] Exact Class Name and full Class Description paragraph
- [ ] Exact Method Name and full Method Description paragraph
- [ ] All arguments fully documented
- [ ] Every Validation Rule individually named and documented
- [ ] Algorithm has numbered specific steps
- [ ] Every Integration Point fully documented
- [ ] Every Exception fully documented
- [ ] Traceability Header with all fields including TBD-Future Dependencies

**TBD-Future SubTasks additionally:**
- [ ] Stub Implementation guidance in every TBD-Future Integration Point
- [ ] TBD-Future Algorithm steps include stub guidance
- [ ] QA-07 stub test case included
- [ ] Resolution Action documented for every TBD-Future Integration Point

**Coverage:**
- [ ] QA SubTasks exist for every User Story (including QA-07 for CONFIRMED-PARTIAL)
- [ ] Execution order verified — schema before model, model before service, etc.
- [ ] SubTask Checklist v2 passes for every SubTask
- [ ] Master RTM extended with TBD-Future column — 100% coverage
- [ ] All SubTasks saved to `Project-Documents/SubTasks/`
- [ ] RTM saved to `Project-Documents/RTM/`

---

## Rules

- NEVER skip any AUTOMATION CRITICAL field — a vague field generates broken code.
- NEVER write "TBD" alone in any Integration Point — always provide assumed interface.
- NEVER block a SubTask due to TBD-Future integrations.
- NEVER skip stub implementation guidance for TBD-Future Integration Points.
- NEVER skip QA-07 for CONFIRMED-PARTIAL stories.
- Algorithm steps must be specific enough that a developer who has never seen the codebase can implement them without asking any questions.
- The Traceability Header TBD-Future Dependencies section is mandatory for all CONFIRMED-PARTIAL SubTasks.
- Stubs allow development to proceed immediately — they are not a workaround, they are a design pattern.
- SubTask IDs are permanent — never reuse a deleted SubTask's ID.
- Order matters: schema → model → repository → service → validation → integration → API → frontend → tests.

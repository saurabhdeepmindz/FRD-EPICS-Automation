---
description: Decompose each approved User Story into atomic, implementable SubTasks. Every SubTask carries complete class, method, argument, validation, algorithm, integration, and error-handling detail for source code generation. TBD-Future integrations are carried forward with assumed interfaces and stub implementation guidance — SubTasks are never blocked by TBD-Future dependencies.
---

# `/create-subtasks` — SKILL-05: SubTask Creator [v2.0 — TBD-Future Enabled]

> Decompose each approved User Story into atomic, sprint-ready SubTasks. Write each using the SubTask-Template. Every AUTOMATION CRITICAL field must be fully populated. TBD-Future integration points carry assumed interfaces with stub/mock guidance so developers can proceed without waiting for cross-module resolution.

You are a tech lead and senior business analyst working together. Your job is to take approved User Stories and break them into the smallest, independently assignable SubTasks — each carrying enough detail for the automation tool to generate a named class, named method, method signature, docstring, algorithm, validations, integration calls, error handling, and test case linkage.

---

## 🚨 MANDATORY — PER-SUBTASK COMPLETENESS

Every SubTask you emit MUST be fully populated with **all 24 sections** at the same depth. The automation tool runs a completeness check after this skill — any SubTask where Section 21 is blank, or where Sections 15/22/23 are abbreviated compared to peers, is rejected and the whole artifact is re-run.

**Observed failure mode to avoid:** writing the first SubTask in full (~15 KB) and then compressing every subsequent one to ~3 KB without Mermaid, algorithm, or proper validation tables. **Do NOT do this.** Treat the 5th SubTask with the same depth as the 1st.

Concrete requirements per SubTask, regardless of position in the output:

- **Section 21** MUST include BOTH the Mermaid `sequenceDiagram` block AND the textual Message Sequence (for every BE / IN SubTask; FE SubTasks may emit a minimal diagram for any HTTP callsite).
- **Section 15** (Integration Points) — listed as a numbered list, each with class name, method signature, and TBD-Future marking when applicable.
- **Section 20** (Validations) — as a table with rows.
- **Section 22** (End-to-End Flow) — identical across siblings in the same flow (copy verbatim).
- **Section 23** (Error Handling Outline) — every exception with type + HTTP status + rollback note.

If the output response would truncate before covering all SubTasks, **emit the first SubTasks in full and add `## ⚠ CONTINUATION REQUIRED — <list remaining SubTask IDs>` at the end** rather than compressing. The orchestrator will loop to cover the remainder.

---

## 🛠 Tech Stack — Read from Input Context

The orchestrator provides a `techStack` object in the input context with fields:

- `frontend` — e.g., `"Next.js (App Router, TypeScript, Tailwind CSS)"`
- `backend` — e.g., `"NestJS (TypeScript, Prisma ORM)"`
- `database` — e.g., `"PostgreSQL"`
- `architecture` — e.g., `"Modular monolith"`
- `frontendExt` — file extension for frontend source files (`.tsx` / `.ts` / `.vue` / etc.)
- `backendExt` — file extension for backend source files (`.ts` / `.py` / `.java` / etc.)
- `ormHint` — e.g., `"Prisma ORM (schema.prisma)"`
- `testFrameworkFrontend` / `testFrameworkBackend` — suggested test frameworks

**Every SubTask you emit MUST reflect this stack.** Concretely:

- **Frontend SubTasks (FE team)**: source files end in `techStack.frontendExt` (e.g., `app/features/.../Component.tsx` for Next.js, NOT `components/Component.vue` or `src/views/Component.jsx`). Use the stack's idioms: App Router `page.tsx` / `layout.tsx` when Next.js; React Server Components where appropriate; imports from `next/*` when Next.js; Tailwind utility classes when Tailwind is in the stack.
- **Backend SubTasks (BE team)**: source files end in `techStack.backendExt` (e.g., `src/modules/.../invoice.service.ts` for NestJS). Use `@Controller`, `@Injectable`, `@Module` decorators when NestJS; DTOs with `class-validator` decorators; dependency injection via constructor parameters; async/await returning `Promise<T>` — NEVER generic pseudocode like `function createInvoice(...)` that ignores the framework.
- **Database SubTasks / schema changes**: emit Prisma schema diffs (`prisma/schema.prisma`) when `ormHint` mentions Prisma; otherwise emit SQL migrations compatible with `techStack.database`. Use `techStack.database` for dialect-specific syntax (e.g., PostgreSQL `SERIAL` / `TIMESTAMPTZ`, MySQL `AUTO_INCREMENT`).
- **Integration SubTasks (IN team)**: HTTP client style matches the backend (NestJS → use `HttpService` from `@nestjs/axios` or native `fetch`; Python FastAPI → `httpx`).
- **Test SubTasks (QA team)**: use `testFrameworkFrontend` / `testFrameworkBackend` — e.g., Jest+supertest for backend E2E, Playwright for frontend E2E.

**Example section — Primary Class Name**:

> ❌ Generic: `InvoiceController`
> ✅ Stack-appropriate (NestJS): `InvoiceController` class decorated with `@Controller('invoices')`, injected via `@Injectable()`, located at `src/modules/invoice/invoice.controller.ts`

**Example section — Source File Reference**:

> ❌ Generic: `src/controllers/InvoiceController.java`
> ✅ Next.js + NestJS stack: FE story → `app/invoices/page.tsx`; BE story → `src/modules/invoice/invoice.controller.ts`; DB story → `prisma/schema.prisma` (add `Invoice` model) + `prisma/migrations/XXXX_add_invoice.sql`

**If `techStack` is missing from context** (pre-stack-aware module), fall back to generic pseudocode but explicitly flag the assumption in Section 22 Algorithm Outline.

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

This section drives two outputs:

1. **A visually-rendered UML sequence diagram** — produced by emitting a Mermaid `sequenceDiagram` fenced block (the frontend renders it as a swim-lane diagram, and the DOCX/PDF exports show the Mermaid source so it can be regenerated).
2. **A deterministic text-based message sequence** — used by downstream SKILL-06 (LLD) for programmatic consumption.

**Both forms are REQUIRED.** Emit the Mermaid block first, then the textual message sequence below it.

---

**Mermaid (UML swim-lane):**

````
```mermaid
sequenceDiagram
    autonumber
    participant AC as AdminController
    participant TS as TaskService
    participant AUTH as AuthService
    participant PS as ProfessionalService
    participant TR as TaskRepository
    participant NS as NotificationService
    participant AL as AuditLogService

    AC->>TS: createTask(taskType, professionalId, priorityLevel, dueDateTime, taskNotes)
    TS->>AUTH: getCurrentUser()
    AUTH-->>TS: User{id, role}
    TS->>TS: validate inputs (Steps 3-5)
    TS->>PS: getProfessionalById(professionalId) [TBD-Future]
    PS-->>TS: Professional{status} [TBD-Future assumed]
    TS->>TR: save(task)
    TR-->>TS: Task{taskId}
    TS->>NS: sendTaskAssignmentNotification(professionalId, taskId)
    NS-->>TS: NotificationStatus
    TS->>AL: logAdminAction(adminId, "TASK_ASSIGNED", taskId)
    TS-->>AC: TaskConfirmationResponse{taskId, timestamp, notificationStatus}

    alt validation fails
        TS-->>AC: throw TaskValidationException (HTTP 400)
    else professional not found
        TS-->>AC: throw ProfessionalNotFoundException (HTTP 404)
    else persistence fails
        TS-->>AC: throw TaskPersistenceException (HTTP 500)
    else notification fails
        NS-->>TS: FAILED
        TS-->>AC: 200 with notificationStatus=FAILED
    end
```
````

Mermaid syntax rules the AI must follow:

- Use `sequenceDiagram` as the first line (lowercase; Mermaid is case-sensitive here).
- `participant <shortAlias> as <LongName>` for each participant. Keep the `as` label in sync with the textual message sequence below.
- Use `->>` for synchronous request, `-->>` for response/dashed return.
- Use `alt` / `else` / `end` blocks for exception flows (matches UML `alt` fragment).
- Mark TBD-Future interactions with `[TBD-Future]` or `[TBD-Future TBD-NNN]` in the message label so they're visible in the rendered diagram.
- Include `autonumber` at the top so step numbers appear automatically in the rendered swim-lane diagram.
- Do NOT emit any Mermaid features the 10.x release doesn't support (e.g. no `box` grouping, no `links`).

---

**Textual Message Sequence (for LLD codegen):**

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

**Rule:** Every Backend and Integration SubTask must have Section 21 populated with BOTH the Mermaid diagram AND the textual message sequence. Frontend SubTasks may omit this section (or emit a minimal Mermaid diagram for any HTTP call they make). TBD-Future participants appear in both forms with their assumed interfaces marked `[TBD-Future]`.

#### Section 22 — End-to-End Integration Flow **[AUTOMATION CRITICAL — Sprint Sequencing]**

This section is MANDATORY for EVERY SubTask regardless of team type (FE, BE, IN, QA). It provides the complete picture of how all SubTasks within the same User Story (or closely related feature flow) connect end-to-end. Every developer — frontend, backend, or QA — sees the same content so they understand where their piece fits.

**Rule:** This section is IDENTICAL across all SubTasks for the same User Story / feature flow. When one SubTask's Section 22 is written, copy it verbatim into every other SubTask in the same flow.

---

##### Part A — Flow Chain

A sequential arrow diagram showing every SubTask in the complete user action flow, from the FE component that initiates the action through every BE layer to the response handling. Each step is labelled with team, SubTask ID, class, method, and any TBD-Future flags.

```
End-to-End Flow: Admin Assigns Task (US-013)

[FE] ST-US013-FE-01  TaskAssignmentForm.render()
  │  User fills form fields and clicks "Assign Task Now"
  ▼
[FE] ST-US013-FE-05  TaskAssignmentForm.handleSubmit()
  │  Validates client-side, calls POST /api/tasks
  ▼
[BE] ST-US013-BE-07  TaskController.createTask()
  │  Receives HTTP request, extracts DTO, delegates to service
  ▼
[BE] ST-US013-BE-08  AuthGuard.canActivate()
  │  Verifies caller has ADMIN role
  ▼
[BE] ST-US013-BE-05  TaskService.validateInputs()
  │  Applies TASK_TYPE_REQUIRED, DUE_DATE_MUST_BE_FUTURE, NOTES_MAX_LENGTH
  ▼
[BE] ST-US013-BE-04  TaskService.createTask()
  │  Core business logic — orchestrates the full creation flow
  ▼
[BE] ST-US013-BE-06  ProfessionalService.getProfessionalById()  [TBD-Future — TBD-001]
  │  Validates assignee exists and is active (stub until MOD-03)
  ▼
[BE] ST-US013-BE-03  TaskRepository.save()
  │  Persists Task entity to database
  ▼
[IN] ST-US013-IN-02  NotificationServiceClient.sendTaskAssignment()
  │  Dispatches notification to assigned professional
  ▼
[BE] ST-US013-BE-06  AuditLogService.logAdminAction()
  │  Records admin action for audit trail
  ▼
[BE] ST-US013-BE-07  TaskController → returns TaskConfirmationResponse
  │  HTTP 201 with taskId, timestamp, notificationStatus
  ▼
[FE] ST-US013-FE-04  TaskAssignmentForm.handleResponse()
  │  Shows success toast, navigates back to queue
```

---

##### Part B — Dependency Table

| SubTask ID | Team | Layer | Class | Depends On | Depended On By | Status |
|-----------|------|-------|-------|-----------|---------------|--------|
| ST-US013-BE-01 | BE | Database | Migration | — | ST-US013-BE-02 | CONFIRMED |
| ST-US013-BE-02 | BE | Entity | TaskEntity | ST-US013-BE-01 | ST-US013-BE-03, BE-04 | CONFIRMED |
| ST-US013-BE-03 | BE | Repository | TaskRepository | ST-US013-BE-02 | ST-US013-BE-04 | CONFIRMED |
| ST-US013-BE-04 | BE | Service | TaskService | ST-US013-BE-03, BE-05, BE-06 | ST-US013-BE-07 | CONFIRMED-PARTIAL |
| ST-US013-BE-05 | BE | Validation | TaskService | — | ST-US013-BE-04 | CONFIRMED |
| ST-US013-BE-06 | BE | Integration | TaskService | — | ST-US013-BE-04 | CONFIRMED-PARTIAL [TBD-001] |
| ST-US013-BE-07 | BE | Controller | TaskController | ST-US013-BE-04, BE-08 | ST-US013-FE-05 | CONFIRMED |
| ST-US013-BE-08 | BE | Auth | AuthGuard | — | ST-US013-BE-07 | CONFIRMED |
| ST-US013-BE-09 | BE | Exception | Exceptions | — | ST-US013-BE-04, BE-05 | CONFIRMED |
| ST-US013-FE-01 | FE | Component | TaskAssignmentForm | ST-US013-BE-07 (API ready) | — | CONFIRMED |
| ST-US013-FE-05 | FE | Integration | TaskAssignmentForm | ST-US013-BE-07 | ST-US013-FE-04 | CONFIRMED |
| ST-US013-IN-02 | IN | Connector | NotificationClient | — | ST-US013-BE-04 | CONFIRMED |
| ST-US013-QA-01 | QA | Test | — | All above | — | CONFIRMED |

Reading this table:
- "Depends On" = what must be done before I can start
- "Depended On By" = what is waiting for me to finish
- A developer picks up ST-US013-BE-04 → sees they need BE-03, BE-05, BE-06 done first → sees BE-07 is waiting for them

---

##### Part C — Sprint Sequencing

Prioritised implementation order that `/prd` uses when building TASKS.md. This ensures correct build sequence — no SubTask starts before its dependencies are ready.

```
Sprint Sequencing — US-013: System validates and persists task record

P0 (Must build first — blocking dependencies):
  1. ST-US013-BE-01  Database schema / migration
  2. ST-US013-BE-02  TaskEntity data model
  3. ST-US013-BE-03  TaskRepository
  4. ST-US013-BE-09  Exception classes
  5. ST-US013-BE-05  Input validation rules

P1 (Core logic — depends on P0):
  6. ST-US013-BE-06  Integration calls + TBD-Future stubs
  7. ST-US013-IN-02  NotificationServiceClient
  8. ST-US013-BE-04  TaskService.createTask() — primary method
  9. ST-US013-BE-08  Auth guard

P2 (API + Frontend — depends on P1):
  10. ST-US013-BE-07  TaskController (API endpoint)
  11. ST-US013-FE-01  TaskAssignmentForm component
  12. ST-US013-FE-05  API integration in form

P3 (Tests — after implementation):
  13. ST-US013-BE-10  Unit tests — TaskService
  14. ST-US013-BE-11  Integration tests — API endpoint
  15. ST-US013-FE-08  Unit tests — TaskAssignmentForm
  16. ST-US013-FE-09  E2E test — full flow
  17. ST-US013-QA-01 to QA-07  QA test cases
```

Rule for /prd task generation: When building TASKS.md, read Part C of every SubTask's Section 22. Tasks within the same P-level can be parallelised. Tasks in P(N) must not start before all P(N-1) tasks are complete. This prevents "blocked by dependency" issues during the sprint.

---

#### Section 23 — Test Case IDs **[AUTOMATION CRITICAL]**
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

#### Section 24 — Acceptance Criteria
Definition of Done for this specific SubTask.

#### Section 25 — Testing Notes
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
- [ ] End-to-End Integration Flow populated — identical across all SubTasks in same flow (Section 22)
- [ ] Test Case IDs listed (Section 23)

**TBD-Future specific checks:**
- [ ] Every TBD-Future Integration Point has: Status, TBD-Future Ref, Referenced Module, Assumed Method, Assumed Return, Stub Implementation guidance, Resolution Action
- [ ] Every TBD-Future Algorithm step marked [TBD-Future — MOD-XX — TBD-NNN] with stub guidance
- [ ] Traceability Header includes TBD-Future Dependencies section
- [ ] Test Case IDs include stub test cases for TBD-Future integration points (QA-07)
- [ ] No SubTask is blocked or marked incomplete due to TBD-Future integrations
- [ ] End-to-End Integration Flow (Section 22) includes TBD-Future steps with flags in Part A
- [ ] Dependency Table (Part B) shows TBD-Future status for affected SubTasks
- [ ] Sprint Sequencing (Part C) accounts for TBD-Future stubs in P1 priority

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
- [ ] End-to-End Integration Flow (Section 22) populated with Parts A, B, C
- [ ] Section 22 is identical across all SubTasks in the same User Story / feature flow

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

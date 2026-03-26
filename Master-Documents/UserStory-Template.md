# User Story Template

> **Document Flow:** BRD → FRD → Initiative → EPIC → **User Story** → Tasks → Subtasks
>
> A User Story is a single, deliverable unit of work derived from an EPIC. It represents
> one specific capability from the perspective of an actor. One EPIC can contain multiple
> User Stories. Each User Story is scoped to exactly one type: Frontend, Backend, or
> Integration — because each type is owned and delivered by a separate team.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User Story ID   : US-[XXX]
EPIC ID         : EPIC-[XXX]
Created Date    : DD-MMM-YYYY
Last Updated    : DD-MMM-YYYY
Sprint          : Sprint-[XX]
Status          : [ Draft | In Review | Approved | In Progress | Done ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Table of Contents

| # | Section |
| --- | --- |
| 1 | User Story ID |
| 2 | User Story Name |
| 3 | User Story Description |
| 4 | EPIC Reference |
| 5 | User Story Type |
| 6 | Trigger |
| 7 | Actor(s) |
| 8 | Primary Flow *(OR)* Alternate Scenario |
| 9 | StateChart |
| 10 | Screen Reference |
| 11 | Display Field Types |
| 12 | Database Entities |
| 13 | Business Rules |
| 14 | Validations |
| 15 | Integrations |
| 16 | Acceptance Criteria |
| 17 | SubTasks |
| — | Revision History |

---

## 1. User Story ID

> **Guideline:** A unique identifier for this User Story. Follow the naming convention
> `US-[XXX]` where XXX is a zero-padded sequential number. The ID must never be reused,
> even if a story is deleted. Optionally prefix with the EPIC ID for grouping
> (e.g., `EPIC001-US-003`).

```
User Story ID : US-[XXX]

Example: US-001
```

---

## 2. User Story Name

> **Guideline:** A short, descriptive name that identifies what this story delivers.
> Should be unique within the EPIC, specific enough to distinguish from other stories,
> and written in plain language understandable by both business and technical team members.

```
[Name of the User Story]

Example: "Multi-Step Customer Registration Form"
```

---

## 3. User Story Description

> **Guideline:** Write the story in the standard Agile format:
> **"As a [Actor], I want [Goal/Action], so that [Benefit/Value]."**
> This format keeps the story anchored to a real user need rather than a technical task.
> The Actor must match one of the actors defined in Section 7.
> The Goal must be a single, focused capability — not multiple goals in one sentence.
> The Benefit must state a meaningful outcome, not just repeat the goal.

```
As a    : [Actor — who wants this capability]
I want  : [Goal — what they want to do]
So that : [Benefit — why it matters / what value it delivers]

Example:
  As a    : New Customer
  I want  : to fill in a multi-step registration form with my personal details
  So that : I can create my account on the portal and proceed to KYC verification
```

---

## 4. EPIC Reference

> **Guideline:** Link this User Story to its parent EPIC. Every User Story must belong
> to exactly one EPIC. Also include a one-line description of the EPIC so that any
> reader immediately understands the broader context of this story without needing
> to open the EPIC document.

```
EPIC ID          : EPIC-[XXX]
EPIC Name        : [Name of the Parent EPIC]
EPIC Description : [One-line description of what the parent EPIC delivers]

Example:
  EPIC ID          : EPIC-001
  EPIC Name        : Customer Registration & KYC Verification
  EPIC Description : End-to-end digital onboarding flow covering customer
                     registration, document upload, and KYC verification.
```

---

## 5. User Story Type

> **Guideline:** Classify this User Story into exactly ONE of the three types below.
> A single User Story cannot span multiple types — if a feature requires both a UI
> and a backend service, these must be written as separate User Stories and linked
> via the Integrations section (Section 15).
>
> - **Frontend** — All work visible to the user: screens, forms, UI components,
>   client-side validation, navigation, and layout. Owned by the Frontend team.
>
> - **Backend** — All server-side logic: business rules, data processing, API endpoints,
>   database operations, and background jobs. Owned by the Backend team.
>
> - **Integration** — Connectivity with external systems, third-party APIs, or
>   inter-module communication. Owned by the Integration / Middleware team.

```
User Story Type : [ Frontend | Backend | Integration ]   ← Select ONE only

Example: Frontend
```

---

## 6. Trigger

> **Guideline:** Identify what initiates or triggers this User Story. A trigger answers:
> *"What causes this story's flow to begin?"*
> It can be:
> - Another **User Story** completing or producing an output
> - A specific **Feature** within this EPIC or another EPIC going live
> - A **User Action** (button click, form submit, page load)
> - A **System Event** (job schedule, API callback, status change)
> - A **Business Event** (campaign launch, approval decision)
>
> List all triggers if more than one applies.

```
| Trigger ID | Trigger Type               | Trigger Description                                        |
|------------|----------------------------|------------------------------------------------------------|
| TRG-01     | [User Action / User Story  | [What event or condition starts this User Story's flow]    |
|            |  / Feature / System Event] |                                                            |

Example:
| Trigger ID | Trigger Type | Trigger Description                                              |
|------------|--------------|------------------------------------------------------------------|
| TRG-01     | User Action  | Customer clicks "Start Registration" on the portal landing page  |
```

---

## 7. Actor(s)

> **Guideline:** List all actors who interact with or are affected by this User Story.
> An actor can be a human user (primary or secondary) or a system/service.
> For each actor, describe their specific role within this story — not a generic description.
> Multiple actors are allowed when more than one party participates in the same story's flow.

```
| Actor ID | Actor Type    | Actor Name / Role        | Role in This User Story                               |
|----------|---------------|--------------------------|-------------------------------------------------------|
| ACT-01   | Primary User  | [Name / Role]            | [What this actor does specifically in this story]     |
| ACT-02   | Internal User | [Name / Role]            | [What this actor does specifically in this story]     |
| ACT-03   | System        | [System / Service Name]  | [How this system participates in this story]          |

Example:
| Actor ID | Actor Type   | Actor Name / Role | Role in This User Story                                    |
|----------|--------------|-------------------|------------------------------------------------------------|
| ACT-01   | Primary User | New Customer      | Fills in and submits the registration form                 |
| ACT-02   | System       | Registration API  | Receives form data, validates, and creates a draft record  |
```

---

## 8. Primary Flow *(OR)* Alternate Scenario

> **IMPORTANT — MUTUALLY EXCLUSIVE RULE:**
> A User Story must contain EITHER a Primary Flow OR an Alternate Scenario — **never both**.
>
> - **Primary Flow** — Use for the main, expected success path of a new capability.
>
> - **Alternate Scenario** — Use for a deviation or exception that branches away from
>   a Primary Flow defined in another User Story. Must reference the parent story.
>
> Delete the section that does not apply when filling in an actual User Story.

---

### 8A. Primary Flow
*(Use this section for the main success path. Delete Section 8B.)*

> **Guideline:** Number each step. Each step is a single, observable action or system
> response. Keep at a functional level — avoid implementation details.

```
| Step # | Actor     | Action / System Response                                           |
|--------|-----------|--------------------------------------------------------------------|
| 1      | [Actor]   | [What the actor does or what the system does at this step]         |
| 2      | [System]  | [System response to the actor's action]                            |

Example:
| Step # | Actor         | Action / System Response                                              |
|--------|---------------|-----------------------------------------------------------------------|
| 1      | New Customer  | Navigates to the portal and clicks "Register Now"                     |
| 2      | System        | Displays Step 1 of the registration form (Personal Details)           |
| 3      | New Customer  | Enters First Name, Last Name, Date of Birth, Email, Mobile Number     |
| 4      | New Customer  | Clicks "Next"                                                         |
| 5      | System        | Validates all fields; shows Step 2 — Address Details                  |
| 6      | New Customer  | Enters Address, City, State, PIN Code, Country and clicks "Next"      |
| 7      | System        | Validates address; shows Step 3 — Review & Submit                     |
| 8      | New Customer  | Reviews all details and clicks "Submit"                               |
| 9      | System        | Creates draft record; redirects to Document Upload page               |
```

---

### 8B. Alternate Scenario
*(Use this section for exception/deviation paths. Delete Section 8A.)*

> **Guideline:** State which Primary Flow User Story this deviates from and at which step.

```
Parent User Story  : US-[XXX] — [Name of the Primary Flow User Story this deviates from]
Deviation Point    : Step [#] of US-[XXX] — [Brief description of where the deviation occurs]

| Step # | Actor     | Action / System Response                                            |
|--------|-----------|---------------------------------------------------------------------|
| 1      | [Actor]   | [First step of the alternate path from the deviation point]         |
| 2      | [System]  | [System response in the alternate path]                             |

Example:
Parent User Story  : US-001 — Multi-Step Customer Registration Form
Deviation Point    : Step 5 of US-001 — System detects a duplicate email address

| Step # | Actor        | Action / System Response                                                |
|--------|--------------|-------------------------------------------------------------------------|
| 1      | System       | Detects the entered email already exists; returns HTTP 409              |
| 2      | System       | Highlights Email field red; shows error message with recovery options   |
| 3      | New Customer | Chooses: (a) enter different email, or (b) click "Log In"               |
| 4a     | New Customer | Enters new email and clicks "Next" → flow returns to US-001             |
| 4b     | New Customer | Clicks "Log In" → redirected to the Login page (US-010)                 |
```

---

## 9. StateChart

> **Guideline:** Define all possible states that the primary entity (or process) in this
> User Story can be in during its lifecycle. A state represents a distinct condition or
> status that the entity holds at a point in time. States change when a specific event
> or action (a transition trigger) occurs.
>
> This section serves as the state machine specification for the story and directly
> informs how the `status` field in the database should be designed and validated.
>
> For each state, capture:
> - **State ID** — Unique identifier (ST-XXX)
> - **State Name** — The value as it would appear in the database or system (e.g., DRAFT)
> - **State Description** — What this state means in plain language
> - **Entry Trigger** — What causes the entity to enter this state
> - **Exit Trigger** — What causes the entity to leave this state
> - **Transitions To** — Which state(s) this state can move to next
>
> Also include a visual State Transition Summary showing the full flow from start to end.

```
| State ID | State Name      | State Description                             | Entry Trigger                          | Exit Trigger                        | Transitions To                  |
|----------|-----------------|-----------------------------------------------|----------------------------------------|-------------------------------------|---------------------------------|
| ST-001   | [STATE_NAME]    | [Plain language description of this state]    | [What causes entry into this state]    | [What causes exit from this state]  | [ST-XXX, ST-XXX]                |

STATE TRANSITION SUMMARY:
  [ST-001: STATE_A] ──trigger──> [ST-002: STATE_B] ──trigger──> [ST-003: STATE_C]
                                                    └──trigger──> [ST-004: STATE_D]

Example:
| State ID | State Name         | State Description                                | Entry Trigger                            | Exit Trigger                        | Transitions To         |
|----------|--------------------|--------------------------------------------------|------------------------------------------|-------------------------------------|------------------------|
| ST-001   | NOT_STARTED        | Registration not yet initiated by the customer   | User lands on the registration page      | User clicks "Register Now"          | ST-002                 |
| ST-002   | IN_PROGRESS        | Customer is actively filling in the form         | Customer starts Step 1                   | Customer submits or abandons         | ST-003, ST-004, ST-005  |
| ST-003   | SUBMITTED          | All steps completed and form submitted           | Customer clicks "Submit" successfully    | Backend creates draft record        | ST-006                 |
| ST-004   | ABANDONED          | Customer left mid-flow without submitting        | No activity for 30 minutes               | Customer resumes or record expires  | ST-002, ST-005         |
| ST-005   | EXPIRED            | Draft registration window has lapsed             | 72 hours elapsed since last activity     | —                                   | — (terminal state)     |
| ST-006   | PENDING_KYC        | Registration complete; awaiting KYC verification | Backend creates customer_draft record    | KYC result received                 | — (handled by US-004)  |

STATE TRANSITION SUMMARY:
  [ST-001: NOT_STARTED]
         │ clicks Register Now
         ▼
  [ST-002: IN_PROGRESS] ──30 min inactivity──> [ST-004: ABANDONED]
         │                                              │ resumes
         │ submits form                                 └──────────> [ST-002: IN_PROGRESS]
         ▼
  [ST-003: SUBMITTED]
         │ backend confirms
         ▼
  [ST-006: PENDING_KYC]

  [ST-002 or ST-004] ──72 hrs lapsed──> [ST-005: EXPIRED]
```

---

## 10. Screen Reference

> **Guideline:** List every distinct screen (page, view, modal, or overlay) that is
> involved in this User Story. Each screen gets a unique Screen ID that can be referenced
> in Section 11 (Display Field Types) and in test cases.
>
> - **Screen ID** — Unique identifier for the screen (SCR-XXX). Used for cross-referencing
>   in Display Field Types, test cases, and wireframe links.
> - **Screen Name** — The name of the screen as it will be known in the application and
>   in design files (should match wireframe/Figma naming).
> - **Screen Description** — A brief description of the screen's purpose, what it shows,
>   and when it appears during the User Story flow.
> - **Wireframe / Design Reference** — Link or reference to the design artifact for this
>   screen (Figma frame, Zeplin screen, SharePoint path, etc.).
>
> For Backend and Integration User Stories with no UI screens, mark this section as N/A.

```
| Screen ID | Screen Name           | Screen Description                                            | Wireframe / Design Reference             |
|-----------|-----------------------|---------------------------------------------------------------|------------------------------------------|
| SCR-001   | [Screen Name]         | [Purpose of the screen and when it appears in the flow]       | [Figma / Zeplin / SharePoint link]       |

Example:
| Screen ID | Screen Name           | Screen Description                                                               | Wireframe / Design Reference             |
|-----------|-----------------------|----------------------------------------------------------------------------------|------------------------------------------|
| SCR-001   | Landing Page          | Public-facing page with "Register Now" CTA; entry point to the registration flow | Figma: /onboarding/SCR-001-landing       |
| SCR-002   | Personal Details      | Step 1 of 3 — Captures name, DOB, email, mobile, gender                         | Figma: /onboarding/SCR-002-personal      |
| SCR-003   | Address Details       | Step 2 of 3 — Captures address, city, state, PIN code, country                  | Figma: /onboarding/SCR-003-address       |
| SCR-004   | Review & Submit       | Step 3 of 3 — Read-only summary of all entered data; final submission action     | Figma: /onboarding/SCR-004-review        |
| SCR-005   | Registration Success  | Confirmation screen shown after successful submission; redirects to Upload page  | Figma: /onboarding/SCR-005-success       |
```

---

## 11. Display Field Types

> **Guideline:** Applies primarily to **Frontend** User Stories. For Backend or Integration
> stories, mark as N/A with a reason.
> List every UI element on the screen(s) covered by this User Story. Use the Screen ID
> from Section 10 in the Screen / Section column for traceability.
> Specify: Label (as on screen), Field Type, Mandatory, Default Value, Placeholder Text.

```
| # | Screen ID | UI Label               | Field Type     | Mandatory | Default Value | Placeholder Text              |
|---|-----------|------------------------|----------------|-----------|---------------|-------------------------------|
| 1 | SCR-[XXX] | [Label as on screen]   | [Field Type]   | Yes / No  | [Default]     | [Placeholder hint text]       |

Example:
| # | Screen ID | UI Label               | Field Type     | Mandatory | Default Value | Placeholder Text              |
|---|-----------|------------------------|----------------|-----------|---------------|-------------------------------|
| 1 | SCR-002   | First Name             | Text Input     | Yes       | —             | Enter your first name         |
| 2 | SCR-002   | Last Name              | Text Input     | Yes       | —             | Enter your last name          |
| 3 | SCR-002   | Date of Birth          | Date Picker    | Yes       | —             | DD/MM/YYYY                    |
| 4 | SCR-002   | Email Address          | Text Input     | Yes       | —             | Enter your email address      |
| 5 | SCR-002   | Mobile Number          | Text Input     | Yes       | —             | Enter 10-digit mobile number  |
| 6 | SCR-002   | Gender                 | Radio Button   | No        | —             | —                             |
| 7 | SCR-002   | Next                   | Button         | —         | —             | —                             |
| 8 | SCR-003   | Address Line 1         | Text Input     | Yes       | —             | House / Flat / Street         |
| 9 | SCR-003   | Address Line 2         | Text Input     | No        | —             | Area / Locality (optional)    |
|10 | SCR-003   | City                   | Text Input     | Yes       | —             | Enter your city               |
|11 | SCR-003   | State                  | Dropdown       | Yes       | Select State  | —                             |
|12 | SCR-003   | PIN Code               | Text Input     | Yes       | —             | 6-digit PIN code              |
|13 | SCR-003   | Country                | Dropdown       | Yes       | India         | —                             |
|14 | SCR-003   | Next                   | Button         | —         | —             | —                             |
|15 | SCR-004   | [All fields read-only] | Label/Read-only| —         | —             | —                             |
|16 | SCR-004   | Submit                 | Button         | —         | —             | —                             |
|17 | SCR-004   | Back                   | Button         | —         | —             | —                             |
```

---

## 12. Database Entities

> **Guideline:** List all database tables and fields that this User Story reads from,
> writes to, or modifies. Mandatory for Backend and Integration stories.
> For Frontend-only stories, mark N/A if no direct DB interaction exists.
> This section drives the Backend team's data model and database test cases.

```
| # | Table Name          | Field / Column Name  | Data Type          | Nullable | Description                               |
|---|---------------------|----------------------|--------------------|----------|-------------------------------------------|
| 1 | [table_name]        | [column_name]        | [VARCHAR/INT/etc.] | Y / N    | [What this field stores]                  |

Example:
| # | Table Name     | Field / Column Name | Data Type    | Nullable | Description                                   |
|---|----------------|---------------------|--------------|----------|-----------------------------------------------|
| 1 | customer_draft | customer_id         | UUID         | N        | Auto-generated unique ID for the draft record |
| 2 | customer_draft | first_name          | VARCHAR(100) | N        | Customer's first name                         |
| 3 | customer_draft | email               | VARCHAR(255) | N        | Customer's email — unique index enforced      |
| 4 | customer_draft | status              | VARCHAR(20)  | N        | DRAFT / PENDING_KYC / ACTIVE / REJECTED       |
| 5 | customer_draft | created_at          | TIMESTAMP    | N        | Record creation timestamp (UTC)               |
| 6 | customer_draft | expires_at          | TIMESTAMP    | N        | created_at + 72 hours — for draft expiry job  |
```

---

## 13. Business Rules

> **Guideline:** List all business rules that govern the behaviour of this User Story.
> A business rule is a policy, constraint, or decision logic imposed by the business —
> not a technical validation. Each rule must be specific, unambiguous, and testable.
> Reference the BRD or FRD section where each rule originates.

```
| BR ID | Business Rule Description                                                         | Source Reference       |
|-------|-----------------------------------------------------------------------------------|------------------------|
| BR-01 | [Clear statement of the business rule]                                            | [BRD/FRD section/ID]   |

Example:
| BR ID | Business Rule Description                                                         | Source Reference       |
|-------|-----------------------------------------------------------------------------------|------------------------|
| BR-01 | A customer must be at least 18 years of age at the time of registration           | BRD v2.1 / Sec 3.2     |
| BR-02 | Email address must be unique across all active and pending customer records       | FRD v1.0 / Sec 5.1     |
| BR-03 | A draft registration record expires and is deleted after 72 hours of inactivity  | BRD v2.1 / Sec 3.5     |
```

---

## 14. Validations

> **Guideline:** List all input validations for this User Story. For each validation,
> state the field, the rule, the error message (for user-facing validations), and
> whether it is Client-side, Server-side, or Both.

```
| VAL ID | Field / Entity       | Validation Rule                                   | Error Message Shown to User                        | Layer              |
|--------|----------------------|---------------------------------------------------|----------------------------------------------------|---------------------|
| VAL-01 | [Field Name]         | [What the rule checks]                            | [Exact error message text]                         | Client/Server/Both  |

Example:
| VAL ID | Field         | Validation Rule                                       | Error Message Shown to User                             | Layer  |
|--------|---------------|-------------------------------------------------------|---------------------------------------------------------|--------|
| VAL-01 | First Name    | Mandatory; letters and spaces only; max 100 chars     | "First Name is required and must contain letters only"  | Both   |
| VAL-02 | Date of Birth | Mandatory; valid date; age >= 18 years                | "You must be at least 18 years old to register"         | Both   |
| VAL-03 | Email Address | Mandatory; valid email format                         | "Please enter a valid email address"                    | Both   |
| VAL-04 | Email Address | Unique — not already registered in the system         | "This email is already registered. Please log in."      | Server |
```

---

## 15. Integrations

> **Guideline:** List all integrations this User Story requires.
> - **External** — Third-party system, payment gateway, government API, SMS/email provider.
> - **Internal** — Another feature, module, or User Story within the same application.
> Describe direction (calls / called by), method, and what data is exchanged.
> If none, mark as "None" with a reason.

```
| INT ID | Integration Type      | System / Module / Story    | Direction           | Method              | Description                                         |
|--------|-----------------------|----------------------------|---------------------|---------------------|-----------------------------------------------------|
| INT-01 | [External / Internal] | [System or Story Name]     | [Calls / Called by] | [REST/Queue/DB/etc] | [What data is exchanged and why]                    |

Example:
| INT ID | Integration Type | System / Story                       | Direction        | Method       | Description                                                   |
|--------|------------------|--------------------------------------|------------------|--------------|---------------------------------------------------------------|
| INT-01 | Internal         | US-003 — Backend: Draft Record API   | This story calls | REST API POST | Submits form data to backend to create the draft record       |
| INT-02 | Internal         | US-007 — Frontend: Document Upload   | Calls this story | Page Redirect | On success from US-003, user is redirected to US-007          |
```

---

## 16. Acceptance Criteria

> **Guideline:** Define specific, testable conditions that must be met for this User Story
> to be accepted as DONE. Use Given-When-Then (GWT) format wherever possible. Cover the
> main success path, key validations, business rules, error states, and edge cases.
> Every criterion must be something a tester can pass or fail with a specific test case.

```
| AC ID | Acceptance Criterion                                                                              |
|-------|---------------------------------------------------------------------------------------------------|
| AC-01 | [Testable condition in GWT or plain statement]                                                    |

Example:
| AC ID | Acceptance Criterion                                                                              |
|-------|---------------------------------------------------------------------------------------------------|
| AC-01 | Given all required fields are filled correctly, when "Next" is clicked, then Step 2 is displayed. |
| AC-02 | Given a mandatory field is blank and "Next" is clicked, then the field highlights red with error. |
| AC-03 | Given an email already in the system is entered, then the server returns the duplicate error.     |
| AC-04 | Given DOB results in age under 18, then submission is blocked with the underage error message.    |
| AC-05 | Given all steps are complete and "Submit" is clicked, then a draft record is created and user     |
|       | is redirected to the Document Upload page.                                                        |
```

---

## 17. SubTasks

> **Guideline:** Break down this User Story into individual, assignable work items
> (SubTasks). Each SubTask is a discrete unit of technical work that one developer or
> tester can pick up independently. SubTasks together must cover the complete delivery
> of the User Story.
>
> - **SubTask ID** — Unique identifier (ST-XXX), scoped within this User Story.
> - **SubTask Description** — A clear, action-oriented description of the work to be done.
>   Should start with a verb (e.g., "Create", "Implement", "Write", "Configure").
> - **Assigned To** — The role or team member responsible (can be filled during sprint planning).
> - **Estimated Hours** — Optional effort estimate in hours.
> - **Status** — [ To Do | In Progress | Done ]
>
> One User Story must have at least two SubTasks. Writing tests is always a mandatory SubTask.

```
| SubTask ID | SubTask Description                                              | Assigned To       | Est. Hours | Status      |
|------------|------------------------------------------------------------------|-------------------|------------|-------------|
| ST-001     | [Action-oriented description of the work unit]                   | [Role / Name]     | [X hrs]    | [ To Do ]   |
| ST-002     | Write unit tests for [component/function]                        | [Role / Name]     | [X hrs]    | [ To Do ]   |

Example:
| SubTask ID | SubTask Description                                              | Assigned To       | Est. Hours | Status      |
|------------|------------------------------------------------------------------|-------------------|------------|-------------|
| ST-001     | Create HTML/CSS structure for 3-step registration form           | Frontend Dev      | 4 hrs      | [ To Do ]   |
| ST-002     | Implement client-side field validation for Step 1 & Step 2       | Frontend Dev      | 3 hrs      | [ To Do ]   |
| ST-003     | Implement progress indicator and step navigation logic           | Frontend Dev      | 2 hrs      | [ To Do ]   |
| ST-004     | Implement form state persistence (save & resume within 72 hrs)   | Frontend Dev      | 3 hrs      | [ To Do ]   |
| ST-005     | Integrate form submit with US-003 backend API                    | Frontend Dev      | 2 hrs      | [ To Do ]   |
| ST-006     | Write unit tests for validation functions                        | Frontend Dev      | 2 hrs      | [ To Do ]   |
| ST-007     | Write integration tests for form submit → API flow               | QA Engineer       | 3 hrs      | [ To Do ]   |
```

---

## Revision History

> **Guideline:** Track all changes to this User Story for auditability.

```
| Version | Date         | Author         | Changes Made                              |
|---------|--------------|----------------|-------------------------------------------|
| 1.0     | DD-MMM-YYYY  | [Author Name]  | Initial draft                             |
| 1.1     | DD-MMM-YYYY  | [Author Name]  | [Brief description of changes]            |
```

---

*Template Version: 2.0 | Last Reviewed: 25-Mar-2026*

---
---

# EXAMPLES

> The following four examples are drawn from **EPIC-001: Customer Registration & KYC
> Verification** (Initiative: Unified Digital Onboarding Platform — INIT-001).
>
> | Example | Story ID | Type        | Flow Type          |
> | --- | --- | --- | --- |
> | 1 | US-001 | Frontend    | Primary Flow       |
> | 2 | US-002 | Frontend    | Alternate Scenario |
> | 3 | US-003 | Backend     | Primary Flow       |
> | 4 | US-004 | Integration | Primary Flow       |

---
---

# EXAMPLE 1 — Frontend User Story with Primary Flow

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User Story ID   : US-001
EPIC ID         : EPIC-001
Created Date    : 25-Mar-2026
Last Updated    : 25-Mar-2026
Sprint          : Sprint-01
Status          : Approved
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 1. User Story ID
```
US-001
```

## 2. User Story Name
```
Multi-Step Customer Registration Form
```

## 3. User Story Description
```
As a    : New Customer
I want  : to complete a multi-step registration form with my personal and address details
So that : I can create my account on the portal and proceed to KYC document verification
```

## 4. EPIC Reference
```
EPIC ID          : EPIC-001
EPIC Name        : Customer Registration & KYC Verification
EPIC Description : End-to-end digital onboarding covering customer registration,
                   document upload, OCR extraction, and KYC verification.
```

## 5. User Story Type
```
User Story Type : Frontend
```

## 6. Trigger

| Trigger ID | Trigger Type | Trigger Description |
|------------|--------------|---------------------|
| TRG-01 | User Action | Customer clicks "Register Now" on the portal's public landing page |

## 7. Actor(s)

| Actor ID | Actor Type | Actor Name / Role | Role in This User Story |
|----------|------------|-------------------|-------------------------|
| ACT-01 | Primary User | New Customer | Fills in personal details, address, reviews and submits the form |
| ACT-02 | System | Registration UI | Renders each form step, validates input, and submits to the backend API |

## 8A. Primary Flow

| Step # | Actor | Action / System Response |
|--------|-------|--------------------------|
| 1 | New Customer | Clicks "Register Now" on the landing page |
| 2 | System | Displays Step 1 — Personal Details form |
| 3 | New Customer | Fills in First Name, Last Name, DOB, Email, Mobile, Gender |
| 4 | New Customer | Clicks "Next" |
| 5 | System | Validates all fields client-side; on success displays Step 2 — Address Details |
| 6 | New Customer | Fills in Address Line 1, Address Line 2, City, State, PIN Code, Country |
| 7 | New Customer | Clicks "Next" |
| 8 | System | Validates address fields; displays Step 3 — Review & Submit |
| 9 | New Customer | Reviews all entered details |
| 10 | New Customer | Clicks "Submit" |
| 11 | System | Submits data to backend API (US-003); on success redirects to Document Upload page (US-007) |

## 9. StateChart

| State ID | State Name | State Description | Entry Trigger | Exit Trigger | Transitions To |
|----------|------------|-------------------|---------------|--------------|----------------|
| ST-001 | NOT_STARTED | Registration not yet initiated | User lands on landing page | User clicks "Register Now" | ST-002 |
| ST-002 | IN_PROGRESS | Customer is actively filling the form | Customer starts Step 1 | Customer submits or abandons | ST-003, ST-004, ST-005 |
| ST-003 | SUBMITTED | All steps completed and form submitted | Customer clicks "Submit" successfully | Backend creates draft record | ST-006 |
| ST-004 | ABANDONED | Customer left mid-flow without submitting | No activity for 30 minutes | Customer resumes or record expires | ST-002, ST-005 |
| ST-005 | EXPIRED | Draft registration window has lapsed | 72 hours elapsed since last activity | — | — (terminal) |
| ST-006 | PENDING_KYC | Registration complete; awaiting KYC | Backend creates customer_draft record | KYC result received | — (handled by US-004) |

```
STATE TRANSITION SUMMARY:
  [ST-001: NOT_STARTED]
         │ clicks Register Now
         ▼
  [ST-002: IN_PROGRESS] ──30 min inactivity──> [ST-004: ABANDONED]
         │                                              │ resumes
         │ submits form                                 └──────────> [ST-002]
         ▼
  [ST-003: SUBMITTED]
         │ backend confirms
         ▼
  [ST-006: PENDING_KYC]

  [ST-002 or ST-004] ──72 hrs elapsed──> [ST-005: EXPIRED]
```

## 10. Screen Reference

| Screen ID | Screen Name | Screen Description | Wireframe / Design Reference |
|-----------|-------------|-------------------|------------------------------|
| SCR-001 | Landing Page | Public-facing page with "Register Now" CTA; entry point to the flow | Figma: /onboarding/SCR-001-landing |
| SCR-002 | Personal Details | Step 1 of 3 — Captures name, DOB, email, mobile, gender | Figma: /onboarding/SCR-002-personal |
| SCR-003 | Address Details | Step 2 of 3 — Captures address, city, state, PIN code, country | Figma: /onboarding/SCR-003-address |
| SCR-004 | Review & Submit | Step 3 of 3 — Read-only summary of all entered data; final submission | Figma: /onboarding/SCR-004-review |
| SCR-005 | Registration Success | Confirmation screen after successful submission; redirects to Upload | Figma: /onboarding/SCR-005-success |

## 11. Display Field Types

| # | Screen ID | UI Label | Field Type | Mandatory | Default Value | Placeholder Text |
|---|-----------|----------|------------|-----------|---------------|------------------|
| 1 | SCR-002 | First Name | Text Input | Yes | — | Enter your first name |
| 2 | SCR-002 | Last Name | Text Input | Yes | — | Enter your last name |
| 3 | SCR-002 | Date of Birth | Date Picker | Yes | — | DD/MM/YYYY |
| 4 | SCR-002 | Email Address | Text Input | Yes | — | Enter your email address |
| 5 | SCR-002 | Mobile Number | Text Input | Yes | — | Enter 10-digit mobile number |
| 6 | SCR-002 | Gender | Radio Button | No | — | — |
| 7 | SCR-002 | Next | Button | — | — | — |
| 8 | SCR-003 | Address Line 1 | Text Input | Yes | — | House / Flat / Street |
| 9 | SCR-003 | Address Line 2 | Text Input | No | — | Area / Locality (optional) |
| 10 | SCR-003 | City | Text Input | Yes | — | Enter your city |
| 11 | SCR-003 | State | Dropdown | Yes | Select State | — |
| 12 | SCR-003 | PIN Code | Text Input | Yes | — | 6-digit PIN code |
| 13 | SCR-003 | Country | Dropdown | Yes | India | — |
| 14 | SCR-003 | Next | Button | — | — | — |
| 15 | SCR-004 | [All fields read-only for review] | Label / Read-only | — | — | — |
| 16 | SCR-004 | Submit | Button | — | — | — |
| 17 | SCR-004 | Back | Button | — | — | — |

## 12. Database Entities
```
Not applicable for this Frontend story.
Data persistence is handled by US-003 (Backend — Draft Record Creation).
```

## 13. Business Rules

| BR ID | Business Rule Description | Source Reference |
|-------|--------------------------|------------------|
| BR-01 | Customer must be at least 18 years of age at time of registration | BRD v2.1 / Sec 3.2 |
| BR-02 | Email address must be unique across all active and pending records | FRD v1.0 / Sec 5.1 |
| BR-03 | Mobile number must be unique across all active and pending records | FRD v1.0 / Sec 5.1 |
| BR-04 | Gender selection is optional and must not block form progression | FRD v1.0 / Sec 5.1 |
| BR-05 | Country defaults to "India" but can be changed by the customer | FRD v1.0 / Sec 5.1 |
| BR-06 | Draft registration record expires after 72 hours of inactivity | BRD v2.1 / Sec 3.5 |

## 14. Validations

| VAL ID | Field | Validation Rule | Error Message | Layer |
|--------|-------|-----------------|---------------|-------|
| VAL-01 | First Name | Mandatory; letters and spaces only; max 100 chars | "First Name is required and must contain letters only" | Both |
| VAL-02 | Last Name | Mandatory; letters and spaces only; max 100 chars | "Last Name is required and must contain letters only" | Both |
| VAL-03 | Date of Birth | Mandatory; valid date; age >= 18 years | "You must be at least 18 years old to register" | Both |
| VAL-04 | Email Address | Mandatory; valid email format | "Please enter a valid email address" | Both |
| VAL-05 | Email Address | Unique — not already in system | "This email is already registered. Please log in." | Server |
| VAL-06 | Mobile Number | Mandatory; exactly 10 numeric digits | "Please enter a valid 10-digit mobile number" | Both |
| VAL-07 | Mobile Number | Unique — not already in system | "This mobile number is already linked to an account." | Server |
| VAL-08 | PIN Code | Mandatory; exactly 6 numeric digits | "Please enter a valid 6-digit PIN code" | Both |
| VAL-09 | State | Mandatory; must be a value from reference list | "Please select a valid State" | Both |

## 15. Integrations

| INT ID | Integration Type | System / Story | Direction | Method | Description |
|--------|-----------------|----------------|-----------|--------|-------------|
| INT-01 | Internal | US-003 — Backend: Draft Customer Record Creation | This story calls | REST API POST | On Submit, form data is sent to US-003's API to create the draft record |
| INT-02 | Internal | US-007 — Frontend: Document Upload Page | Calls this story | Page Redirect | On success response from US-003, user is redirected to US-007 |

## 16. Acceptance Criteria

| AC ID | Acceptance Criterion |
|-------|---------------------|
| AC-01 | Given the customer is on Step 1 and fills all required fields correctly, when "Next" is clicked, then Step 2 is displayed without errors. |
| AC-02 | Given any mandatory field on Step 1 is left blank and "Next" is clicked, then the blank field is highlighted red with the corresponding error message. |
| AC-03 | Given an email already existing in the system is entered, when the form is submitted, then the server returns the duplicate email error message. |
| AC-04 | Given a Date of Birth resulting in an age under 18 is entered, then form submission is blocked with the underage error message. |
| AC-05 | Given all three steps are completed correctly and "Submit" is clicked, then a draft record is created and the user is redirected to the Document Upload page. |
| AC-06 | Given a customer returns within 72 hours to an incomplete registration, then the form resumes from the last saved step with data retained. |
| AC-07 | The form is fully operable using keyboard-only navigation (WCAG 2.1 AA). |

## 17. SubTasks

| SubTask ID | SubTask Description | Assigned To | Est. Hours | Status |
|------------|---------------------|-------------|------------|--------|
| ST-001 | Create HTML/CSS structure for the 3-step registration form with progress indicator | Frontend Dev | 4 hrs | [ To Do ] |
| ST-002 | Implement client-side field validation for Step 1 (Personal Details) | Frontend Dev | 3 hrs | [ To Do ] |
| ST-003 | Implement client-side field validation for Step 2 (Address Details) | Frontend Dev | 2 hrs | [ To Do ] |
| ST-004 | Implement step navigation logic (Next / Back) with state preservation across steps | Frontend Dev | 3 hrs | [ To Do ] |
| ST-005 | Implement form save and resume functionality (72-hour persistence via local/session storage) | Frontend Dev | 3 hrs | [ To Do ] |
| ST-006 | Integrate form Submit action with US-003 backend API; handle success and error responses | Frontend Dev | 2 hrs | [ To Do ] |
| ST-007 | Implement redirect to Document Upload page (US-007) on successful API response | Frontend Dev | 1 hr | [ To Do ] |
| ST-008 | Write unit tests for all client-side validation functions | Frontend Dev | 2 hrs | [ To Do ] |
| ST-009 | Write integration tests for form submit → API → redirect flow | QA Engineer | 3 hrs | [ To Do ] |
| ST-010 | Verify WCAG 2.1 AA accessibility compliance (keyboard navigation, screen reader) | QA Engineer | 2 hrs | [ To Do ] |

---
---

# EXAMPLE 2 — Frontend User Story with Alternate Scenario

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User Story ID   : US-002
EPIC ID         : EPIC-001
Created Date    : 25-Mar-2026
Last Updated    : 25-Mar-2026
Sprint          : Sprint-01
Status          : Approved
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 1. User Story ID
```
US-002
```

## 2. User Story Name
```
Registration Form — Duplicate Email Error and Recovery
```

## 3. User Story Description
```
As a    : New Customer
I want  : to be clearly informed when my email is already registered and given
          options to recover or continue with a different email
So that : I am not stuck at a generic error and can complete registration or
          access my existing account without contacting support
```

## 4. EPIC Reference
```
EPIC ID          : EPIC-001
EPIC Name        : Customer Registration & KYC Verification
EPIC Description : End-to-end digital onboarding covering customer registration,
                   document upload, OCR extraction, and KYC verification.
```

## 5. User Story Type
```
User Story Type : Frontend
```

## 6. Trigger

| Trigger ID | Trigger Type | Trigger Description |
|------------|--------------|---------------------|
| TRG-01 | User Story | Triggered from US-001 Step 11 when backend API (US-003) returns HTTP 409 Conflict — duplicate email |

## 7. Actor(s)

| Actor ID | Actor Type | Actor Name / Role | Role in This User Story |
|----------|------------|-------------------|-------------------------|
| ACT-01 | Primary User | New Customer | Reads the error, chooses to use a different email or navigate to login |
| ACT-02 | System | Registration UI | Displays inline error, highlights field, offers recovery action buttons |

## 8B. Alternate Scenario

```
Parent User Story  : US-001 — Multi-Step Customer Registration Form
Deviation Point    : Step 11 of US-001 — Backend API (US-003) returns HTTP 409
                     Conflict with error code DUPLICATE_EMAIL
```

| Step # | Actor | Action / System Response |
|--------|-------|--------------------------|
| 1 | System | Receives HTTP 409 from US-003 with error code DUPLICATE_EMAIL |
| 2 | System | Scrolls form back to Step 1 (Personal Details) |
| 3 | System | Highlights the Email Address field in red |
| 4 | System | Displays inline error: "This email is already registered. Please use a different email or log in." |
| 5 | System | Displays two recovery buttons: "Use a Different Email" and "Log In to Existing Account" |
| 6a | New Customer | Clicks "Use a Different Email" — Email field is cleared, cursor placed in field |
| 6b | New Customer | Enters new email and resubmits — flow returns to US-001 Step 11 |
| 7b | New Customer | Clicks "Log In to Existing Account" — redirected to Login page (US-010) with email pre-filled |

## 9. StateChart

| State ID | State Name | State Description | Entry Trigger | Exit Trigger | Transitions To |
|----------|------------|-------------------|---------------|--------------|----------------|
| ST-001 | EMAIL_ERROR | Form is in error state due to duplicate email | HTTP 409 received from US-003 | Customer takes a recovery action | ST-002, ST-003 |
| ST-002 | EMAIL_CORRECTION | Customer is editing the email field to enter a new value | Customer clicks "Use a Different Email" | Customer enters new email and resubmits | ST-004 (returns to US-001) |
| ST-003 | LOGIN_REDIRECT | Customer has chosen to log in to existing account | Customer clicks "Log In to Existing Account" | System redirects to Login page | — (terminal for this story) |
| ST-004 | RESOLVED | Email corrected; flow returned to US-001 primary path | New email passes uniqueness check | — | — (continues in US-001) |

```
STATE TRANSITION SUMMARY:
  [US-001 Step 11 — HTTP 409 received]
         │
         ▼
  [ST-001: EMAIL_ERROR]
         │
         ├── clicks "Use a Different Email" ──> [ST-002: EMAIL_CORRECTION]
         │                                               │ new email submitted
         │                                               ▼
         │                                       [ST-004: RESOLVED → returns to US-001]
         │
         └── clicks "Log In" ──> [ST-003: LOGIN_REDIRECT → US-010 Login page]
```

## 10. Screen Reference

| Screen ID | Screen Name | Screen Description | Wireframe / Design Reference |
|-----------|-------------|-------------------|------------------------------|
| SCR-002E | Personal Details (Error State) | Step 1 of US-001 displayed in error state with Email field highlighted red and recovery buttons | Figma: /onboarding/SCR-002-email-error |

## 11. Display Field Types

| # | Screen ID | UI Label | Field Type | Mandatory | Default Value | Placeholder Text |
|---|-----------|----------|------------|-----------|---------------|------------------|
| 1 | SCR-002E | Email Address | Text Input (error state) | Yes | Cleared on error | Enter a different email address |
| 2 | SCR-002E | Inline Error Message | Label (red text) | — | — | "This email is already registered..." |
| 3 | SCR-002E | Use a Different Email | Button (secondary) | — | — | — |
| 4 | SCR-002E | Log In to Existing Account | Button (primary) | — | — | — |

## 12. Database Entities
```
Not applicable for this Frontend Alternate Scenario story.
The duplicate email check is performed server-side by US-003 (Backend).
```

## 13. Business Rules

| BR ID | Business Rule Description | Source Reference |
|-------|--------------------------|------------------|
| BR-01 | Email address must be unique across all active and pending customer records | FRD v1.0 / Sec 5.1 |
| BR-02 | On duplicate email detection, user must be given a self-service recovery path — no dead end | FRD v1.0 / Sec 5.1 |
| BR-03 | When redirecting to Login, the duplicate email must be pre-filled to reduce customer friction | FRD v1.0 / Sec 5.1 |

## 14. Validations

| VAL ID | Field | Validation Rule | Error Message | Layer |
|--------|-------|-----------------|---------------|-------|
| VAL-01 | Email Address (re-entry) | Mandatory; valid email format | "Please enter a valid email address" | Both |
| VAL-02 | Email Address (re-entry) | Must again pass uniqueness check on re-submit | "This email is already registered. Please log in." | Server |

## 15. Integrations

| INT ID | Integration Type | System / Story | Direction | Method | Description |
|--------|-----------------|----------------|-----------|--------|-------------|
| INT-01 | Internal | US-001 — Frontend: Registration Form | Called by | Error callback | Activates when US-001 receives a 409 error from US-003 |
| INT-02 | Internal | US-010 — Frontend: Login Page | This story calls | Page Redirect | Redirects to Login page with duplicate email pre-filled as URL param |

## 16. Acceptance Criteria

| AC ID | Acceptance Criterion |
|-------|---------------------|
| AC-01 | Given US-001 submit returns a duplicate email error, then the form scrolls back to Step 1 and highlights the Email field red. |
| AC-02 | Given the error state is shown, then the inline error message and both recovery buttons are visible simultaneously. |
| AC-03 | Given the customer clicks "Use a Different Email", then the Email field is cleared, focused, and all other form data is retained. |
| AC-04 | Given the customer enters a new unique email and resubmits, then the form proceeds successfully (draft record created). |
| AC-05 | Given the customer clicks "Log In to Existing Account", then they are redirected to US-010 Login page with the duplicate email pre-filled. |

## 17. SubTasks

| SubTask ID | SubTask Description | Assigned To | Est. Hours | Status |
|------------|---------------------|-------------|------------|--------|
| ST-001 | Implement error state handler for HTTP 409 response in the registration form | Frontend Dev | 2 hrs | [ To Do ] |
| ST-002 | Apply red highlight styling to Email field and display inline error message on 409 | Frontend Dev | 1 hr | [ To Do ] |
| ST-003 | Implement "Use a Different Email" button — clear field, retain all other form data | Frontend Dev | 1 hr | [ To Do ] |
| ST-004 | Implement "Log In to Existing Account" button — redirect to US-010 with email as URL param | Frontend Dev | 1 hr | [ To Do ] |
| ST-005 | Implement email pre-fill on Login page from URL param (coordinate with US-010 dev) | Frontend Dev | 1 hr | [ To Do ] |
| ST-006 | Write unit tests for 409 error handler and both recovery paths | Frontend Dev | 2 hrs | [ To Do ] |
| ST-007 | Write end-to-end test for duplicate email scenario and recovery flows | QA Engineer | 2 hrs | [ To Do ] |

---
---

# EXAMPLE 3 — Backend User Story with Primary Flow

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User Story ID   : US-003
EPIC ID         : EPIC-001
Created Date    : 25-Mar-2026
Last Updated    : 25-Mar-2026
Sprint          : Sprint-01
Status          : Approved
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 1. User Story ID
```
US-003
```

## 2. User Story Name
```
Draft Customer Record Creation — Backend API
```

## 3. User Story Description
```
As a    : Registration Backend Service
I want  : to receive customer registration data from the frontend form, validate
          it server-side, and persist a draft customer record in the database
So that : the customer's details are securely stored and available for the
          KYC verification flow in the next step
```

## 4. EPIC Reference
```
EPIC ID          : EPIC-001
EPIC Name        : Customer Registration & KYC Verification
EPIC Description : End-to-end digital onboarding covering customer registration,
                   document upload, OCR extraction, and KYC verification.
```

## 5. User Story Type
```
User Story Type : Backend
```

## 6. Trigger

| Trigger ID | Trigger Type | Trigger Description |
|------------|--------------|---------------------|
| TRG-01 | User Story | Triggered when US-001 (Frontend Registration Form) submits an HTTP POST to /api/v1/registrations |

## 7. Actor(s)

| Actor ID | Actor Type | Actor Name / Role | Role in This User Story |
|----------|------------|-------------------|-------------------------|
| ACT-01 | System | Registration API Service | Receives POST, validates payload, applies business rules, persists record |
| ACT-02 | System | customer_draft Database Table | Stores the new draft customer record |
| ACT-03 | System | US-001 Frontend Form | Caller — submits registration payload and awaits success or error response |

## 8A. Primary Flow

| Step # | Actor | Action / System Response |
|--------|-------|--------------------------|
| 1 | US-001 Frontend | Sends HTTP POST to /api/v1/registrations with registration JSON payload |
| 2 | Registration API | Validates request payload structure (required fields, data types) |
| 3 | Registration API | Applies server-side business rule validations (age >= 18, email unique, mobile unique) |
| 4 | Registration API | If all validations pass — generates a UUID for customer_id |
| 5 | Registration API | Inserts a new record into customer_draft table with status = DRAFT |
| 6 | Registration API | Sets expires_at = created_at + 72 hours |
| 7 | Registration API | Returns HTTP 201 Created with customer_id and status: DRAFT in response body |
| 8 | US-001 Frontend | Receives 201 and redirects customer to the Document Upload page (US-007) |

## 9. StateChart

| State ID | State Name | State Description | Entry Trigger | Exit Trigger | Transitions To |
|----------|------------|-------------------|---------------|--------------|----------------|
| ST-001 | PENDING | API has received the request; processing not yet started | HTTP POST received | Validation begins | ST-002 |
| ST-002 | VALIDATING | Server-side validation of the payload is in progress | Validation logic starts | Validation completes | ST-003, ST-004 |
| ST-003 | DRAFT_CREATED | All validations passed; draft record persisted in DB | INSERT to customer_draft succeeds | — | ST-005 (handed to US-004/US-007) |
| ST-004 | VALIDATION_FAILED | One or more validations failed; record not created | Any validation rule is violated | — | — (HTTP 4xx returned to caller) |
| ST-005 | PENDING_KYC | Draft record exists; awaiting document upload and KYC | Caller receives 201 and redirects to US-007 | KYC process triggered | — (handled by US-004) |

```
STATE TRANSITION SUMMARY:
  [HTTP POST received]
         │
         ▼
  [ST-001: PENDING]
         │ validation starts
         ▼
  [ST-002: VALIDATING]
         │
         ├── validation fails ──> [ST-004: VALIDATION_FAILED] ──> HTTP 4xx to caller (terminal)
         │
         └── validation passes ──> [ST-003: DRAFT_CREATED] ──> HTTP 201 to caller
                                          │
                                          ▼
                                   [ST-005: PENDING_KYC]
```

## 10. Screen Reference
```
Not applicable — this is a Backend User Story with no UI screens.
```

## 11. Display Field Types
```
Not applicable — this is a Backend User Story with no UI components.
```

## 12. Database Entities

| # | Table Name | Field / Column Name | Data Type | Nullable | Description |
|---|------------|---------------------|-----------|----------|-------------|
| 1 | customer_draft | customer_id | UUID | N | Auto-generated primary key |
| 2 | customer_draft | first_name | VARCHAR(100) | N | Customer's first name |
| 3 | customer_draft | last_name | VARCHAR(100) | N | Customer's last name |
| 4 | customer_draft | date_of_birth | DATE | N | Customer's date of birth |
| 5 | customer_draft | email | VARCHAR(255) | N | Customer's email — unique index |
| 6 | customer_draft | mobile_number | VARCHAR(15) | N | Customer's mobile — unique index |
| 7 | customer_draft | gender | VARCHAR(10) | Y | M / F / Other / Not Specified |
| 8 | customer_draft | address_line_1 | VARCHAR(255) | N | Address line 1 |
| 9 | customer_draft | address_line_2 | VARCHAR(255) | Y | Address line 2 (optional) |
| 10 | customer_draft | city | VARCHAR(100) | N | City |
| 11 | customer_draft | state | VARCHAR(100) | N | State from ref_state table |
| 12 | customer_draft | pin_code | CHAR(6) | N | 6-digit postal PIN |
| 13 | customer_draft | country | VARCHAR(100) | N | Country — default India |
| 14 | customer_draft | status | VARCHAR(20) | N | DRAFT / PENDING_KYC / ACTIVE / REJECTED |
| 15 | customer_draft | created_at | TIMESTAMP | N | UTC timestamp of record creation |
| 16 | customer_draft | updated_at | TIMESTAMP | N | UTC timestamp of last update |
| 17 | customer_draft | expires_at | TIMESTAMP | N | created_at + 72 hours — for draft expiry job |

## 13. Business Rules

| BR ID | Business Rule Description | Source Reference |
|-------|--------------------------|------------------|
| BR-01 | Customer age must be >= 18 years calculated from date_of_birth and today's date | BRD v2.1 / Sec 3.2 |
| BR-02 | Email must be unique across customer_draft records with status DRAFT or PENDING_KYC | FRD v1.0 / Sec 5.1 |
| BR-03 | Mobile must be unique across customer_draft records with status DRAFT or PENDING_KYC | FRD v1.0 / Sec 5.1 |
| BR-04 | Draft record expires_at is always set to created_at + 72 hours | FRD v1.0 / Sec 5.6 |
| BR-05 | A new submission for an email matching an EXPIRED draft record is allowed | FRD v1.0 / Sec 5.6 |

## 14. Validations

| VAL ID | Field / Entity | Validation Rule | Error Response to Caller | Layer |
|--------|---------------|-----------------|--------------------------|-------|
| VAL-01 | Request Payload | All required fields present in JSON body | HTTP 400 — "Missing required field: [field_name]" | Server |
| VAL-02 | first_name / last_name | Not blank; max 100 chars; letters and spaces only | HTTP 400 — "Invalid value for [field_name]" | Server |
| VAL-03 | date_of_birth | Valid ISO date; age >= 18 years from today | HTTP 422 — "Customer must be at least 18 years old" | Server |
| VAL-04 | email | Valid email format | HTTP 400 — "Invalid email format" | Server |
| VAL-05 | email | Unique across active and pending records | HTTP 409 — "DUPLICATE_EMAIL" | Server |
| VAL-06 | mobile_number | Exactly 10 numeric digits | HTTP 400 — "Mobile number must be 10 digits" | Server |
| VAL-07 | mobile_number | Unique across active and pending records | HTTP 409 — "DUPLICATE_MOBILE" | Server |
| VAL-08 | pin_code | Exactly 6 numeric digits | HTTP 400 — "Invalid PIN code" | Server |
| VAL-09 | state | Must exist in ref_state reference table | HTTP 400 — "Invalid state value" | Server |

## 15. Integrations

| INT ID | Integration Type | System / Story | Direction | Method | Description |
|--------|-----------------|----------------|-----------|--------|-------------|
| INT-01 | Internal | US-001 — Frontend Registration Form | Called by | REST API POST /api/v1/registrations | Receives registration payload from the form |
| INT-02 | Internal | US-007 — Backend: Document Upload Record | This story triggers | Database / Event | On success, customer_id is available for US-007 to link uploaded documents |
| INT-03 | Internal | Draft Expiry Batch Job | Called by | Scheduled Job | Nightly job reads expires_at and deletes DRAFT records older than 72 hours |

## 16. Acceptance Criteria

| AC ID | Acceptance Criterion |
|-------|---------------------|
| AC-01 | Given a valid registration payload is received, then a new record is created in customer_draft with status=DRAFT and HTTP 201 is returned with the customer_id. |
| AC-02 | Given date_of_birth results in an age under 18, then HTTP 422 is returned with error code UNDERAGE_CUSTOMER. |
| AC-03 | Given an email that already exists in a non-expired draft record is submitted, then HTTP 409 is returned with error code DUPLICATE_EMAIL. |
| AC-04 | Given a mobile number that already exists in a non-expired record is submitted, then HTTP 409 is returned with error code DUPLICATE_MOBILE. |
| AC-05 | Given any required field is missing from the payload, then HTTP 400 is returned with the name of the missing field. |
| AC-06 | Given a valid record is created, then expires_at is set to exactly 72 hours after created_at. |
| AC-07 | Given the same email from an expired (>72hr) draft record is re-submitted, then a new draft record is created successfully (HTTP 201). |

## 17. SubTasks

| SubTask ID | SubTask Description | Assigned To | Est. Hours | Status |
|------------|---------------------|-------------|------------|--------|
| ST-001 | Create POST /api/v1/registrations endpoint with request/response contract | Backend Dev | 3 hrs | [ To Do ] |
| ST-002 | Implement server-side payload validation (required fields, data types, formats) | Backend Dev | 3 hrs | [ To Do ] |
| ST-003 | Implement business rule validations (age check, email uniqueness, mobile uniqueness) | Backend Dev | 3 hrs | [ To Do ] |
| ST-004 | Create customer_draft database table with all columns, indexes, and constraints | Backend Dev | 2 hrs | [ To Do ] |
| ST-005 | Implement INSERT logic with UUID generation and expires_at calculation | Backend Dev | 2 hrs | [ To Do ] |
| ST-006 | Implement HTTP response structure (201 on success; 400/409/422 on failure with error codes) | Backend Dev | 1 hr | [ To Do ] |
| ST-007 | Write unit tests for all validation functions and business rules | Backend Dev | 3 hrs | [ To Do ] |
| ST-008 | Write integration tests for the full endpoint with real database | QA Engineer | 3 hrs | [ To Do ] |
| ST-009 | Create and document API contract (Swagger / OpenAPI spec) for US-001 and US-007 consumers | Backend Dev | 2 hrs | [ To Do ] |

---
---

# EXAMPLE 4 — Integration User Story with Primary Flow

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User Story ID   : US-004
EPIC ID         : EPIC-001
Created Date    : 25-Mar-2026
Last Updated    : 25-Mar-2026
Sprint          : Sprint-02
Status          : Approved
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 1. User Story ID
```
US-004
```

## 2. User Story Name
```
Third-Party KYC API — Identity Verification Integration
```

## 3. User Story Description
```
As a    : KYC Integration Service
I want  : to send the customer's extracted identity data to the third-party KYC
          API and receive a verification status response
So that : the customer's identity can be verified automatically without manual
          intervention, enabling instant account activation on successful verification
```

## 4. EPIC Reference
```
EPIC ID          : EPIC-001
EPIC Name        : Customer Registration & KYC Verification
EPIC Description : End-to-end digital onboarding covering customer registration,
                   document upload, OCR extraction, and KYC verification.
```

## 5. User Story Type
```
User Story Type : Integration
```

## 6. Trigger

| Trigger ID | Trigger Type | Trigger Description |
|------------|--------------|---------------------|
| TRG-01 | User Story | Triggered when US-008 (Backend — OCR Data Extraction) updates kyc_request status to READY_FOR_VERIFICATION |
| TRG-02 | System Event | A queue consumer picks up the READY_FOR_VERIFICATION message from the kyc_request message queue |

## 7. Actor(s)

| Actor ID | Actor Type | Actor Name / Role | Role in This User Story |
|----------|------------|-------------------|-------------------------|
| ACT-01 | System | KYC Integration Service | Reads KYC request, calls third-party API, processes the response |
| ACT-02 | External | Third-Party KYC API (Vendor) | Receives identity data, performs government DB lookup, returns status |
| ACT-03 | System | kyc_request Database Table | Stores request payload, response payload, and final status |
| ACT-04 | System | Notification Service (EPIC-004) | Receives event trigger to send the customer's verification result |

## 8A. Primary Flow

| Step # | Actor | Action / System Response |
|--------|-------|--------------------------|
| 1 | KYC Integration Service | Reads a READY_FOR_VERIFICATION message from the kyc_request queue |
| 2 | KYC Integration Service | Fetches the full customer record from customer_draft using customer_id |
| 3 | KYC Integration Service | Constructs the KYC API request payload per vendor API contract v1.2 |
| 4 | KYC Integration Service | Sends HTTP POST to the KYC vendor's /api/verify endpoint |
| 5 | Third-Party KYC API | Performs identity lookup against the government database |
| 6 | Third-Party KYC API | Returns HTTP 200 with verification_status = "VERIFIED" and a reference_id |
| 7 | KYC Integration Service | Updates kyc_request: status = VERIFIED, vendor_reference_id, verified_at = now() |
| 8 | KYC Integration Service | Updates customer_draft: status = PENDING_ACTIVATION |
| 9 | KYC Integration Service | Publishes CUSTOMER_VERIFIED event to Notification Service with customer_id |
| 10 | Notification Service | Sends customer a "Your KYC is verified" email and SMS |

## 9. StateChart

| State ID | State Name | State Description | Entry Trigger | Exit Trigger | Transitions To |
|----------|------------|-------------------|---------------|--------------|----------------|
| ST-001 | QUEUED | KYC request is on the queue awaiting processing | US-008 publishes READY_FOR_VERIFICATION message | Consumer picks up the message | ST-002 |
| ST-002 | IN_PROGRESS | KYC Integration Service is actively calling the vendor API | Consumer picks up message | API response received | ST-003, ST-004, ST-005 |
| ST-003 | VERIFIED | Vendor API confirmed the customer's identity | API returns VERIFIED status | — | ST-006 |
| ST-004 | FAILED | Vendor API returned a FAILED verification status | API returns FAILED status | — | ST-007 |
| ST-005 | RETRY | API call failed with timeout or 5xx; retrying | Timeout or 5xx error on API call | Retry succeeds or max retries reached | ST-002, ST-007 |
| ST-006 | PENDING_ACTIVATION | KYC verified; customer record awaiting account activation | VERIFIED status processed | Account activation triggered | — (handled by US-005) |
| ST-007 | MANUAL_REVIEW | KYC failed or retries exhausted; routed to ops team | FAILED or 3 retries exhausted | Ops team resolves | — (handled by US-009) |

```
STATE TRANSITION SUMMARY:
  [ST-001: QUEUED]
         │ consumer picks up message
         ▼
  [ST-002: IN_PROGRESS]
         │
         ├── API returns VERIFIED ──> [ST-003: VERIFIED] ──> [ST-006: PENDING_ACTIVATION]
         │
         ├── API returns FAILED ──> [ST-004: FAILED] ──> [ST-007: MANUAL_REVIEW]
         │
         └── API timeout / 5xx ──> [ST-005: RETRY]
                                         │ retry < 3 ──> [ST-002: IN_PROGRESS]
                                         │ retry >= 3 ──> [ST-007: MANUAL_REVIEW]
```

## 10. Screen Reference
```
Not applicable — this is an Integration User Story with no UI screens.
```

## 11. Display Field Types
```
Not applicable — this is an Integration User Story with no UI components.
```

## 12. Database Entities

| # | Table Name | Field / Column Name | Data Type | Nullable | Description |
|---|------------|---------------------|-----------|----------|-------------|
| 1 | kyc_request | kyc_request_id | UUID | N | Unique ID for this KYC request |
| 2 | kyc_request | customer_id | UUID | N | FK to customer_draft.customer_id |
| 3 | kyc_request | status | VARCHAR(30) | N | QUEUED / IN_PROGRESS / VERIFIED / FAILED / RETRY / MANUAL_REVIEW |
| 4 | kyc_request | vendor_reference_id | VARCHAR(100) | Y | Reference ID returned by the KYC vendor |
| 5 | kyc_request | request_payload | JSONB | N | Full payload sent to KYC API (for audit) |
| 6 | kyc_request | response_payload | JSONB | Y | Full response from KYC API (for audit) |
| 7 | kyc_request | verification_status | VARCHAR(20) | Y | VERIFIED / FAILED / PENDING |
| 8 | kyc_request | failure_reason_code | VARCHAR(50) | Y | Reason code returned by vendor on failure |
| 9 | kyc_request | retry_count | INT | N | Number of retries attempted (default 0) |
| 10 | kyc_request | verified_at | TIMESTAMP | Y | UTC timestamp when verification succeeded |
| 11 | kyc_request | created_at | TIMESTAMP | N | UTC timestamp when request was created |
| 12 | kyc_request | updated_at | TIMESTAMP | N | UTC timestamp of last status update |
| 13 | customer_draft | status | VARCHAR(20) | N | Updated to PENDING_ACTIVATION on VERIFIED response |

## 13. Business Rules

| BR ID | Business Rule Description | Source Reference |
|-------|--------------------------|------------------|
| BR-01 | KYC API must only be called for requests with kyc_request.status = READY_FOR_VERIFICATION | FRD v1.0 / Sec 5.3 |
| BR-02 | On VERIFIED response, customer_draft.status is updated to PENDING_ACTIVATION | FRD v1.0 / Sec 5.3 |
| BR-03 | On FAILED response, customer_draft.status remains PENDING_KYC and is routed to manual ops | FRD v1.0 / Sec 5.3 |
| BR-04 | On API timeout or 5xx error, request must be retried up to 3 times with exponential backoff | FRD v1.0 / Sec 5.3 |
| BR-05 | After 3 failed retries, request is escalated to the manual ops review queue | FRD v1.0 / Sec 5.3 |
| BR-06 | Full request and response payloads must be stored in kyc_request for compliance audit | BRD v2.1 / Sec 3.4 |

## 14. Validations

| VAL ID | Field / Entity | Validation Rule | Error Response | Layer |
|--------|---------------|-----------------|----------------|-------|
| VAL-01 | Queue Message | customer_id must be a valid UUID present in customer_draft | Log error; discard message; alert on-call | Server |
| VAL-02 | Queue Message | kyc_request.status must be READY_FOR_VERIFICATION before calling vendor API | Skip; log warning; no API call made | Server |
| VAL-03 | KYC API Response | HTTP 200 with verification_status field must be present | Treat as failure; initiate retry logic | Server |
| VAL-04 | KYC API Response | vendor_reference_id must be present on VERIFIED response | Log anomaly; store as NULL; proceed | Server |
| VAL-05 | Retry Logic | retry_count must not exceed 3 before escalating to manual queue | After 3 retries — set status = MANUAL_REVIEW | Server |

## 15. Integrations

| INT ID | Integration Type | System / Story | Direction | Method | Description |
|--------|-----------------|----------------|-----------|--------|-------------|
| INT-01 | External | Third-Party KYC Vendor API v1.2 | This story calls | REST API POST /api/verify | Sends customer identity payload; receives VERIFIED or FAILED status |
| INT-02 | Internal | US-008 — Backend: OCR Data Extraction | Called by | Message Queue | US-008 publishes READY_FOR_VERIFICATION message that triggers this story |
| INT-03 | Internal | EPIC-004 — Notification Service | This story calls | Event / Message Queue | Publishes CUSTOMER_VERIFIED or CUSTOMER_KYC_FAILED event for email/SMS dispatch |
| INT-04 | Internal | US-009 — Backend: Manual Ops Review Queue | This story calls | Database Insert | On 3 retries exhausted or FAILED, inserts record into ops_review_queue |
| INT-05 | Internal | US-005 — Backend: Account Activation | This story triggers | Message Queue | On VERIFIED, publishes PENDING_ACTIVATION event consumed by US-005 |

## 16. Acceptance Criteria

| AC ID | Acceptance Criterion |
|-------|---------------------|
| AC-01 | Given a READY_FOR_VERIFICATION message is on the queue, then the KYC API is called with the correct identity payload per vendor contract v1.2. |
| AC-02 | Given the KYC API returns VERIFIED, then kyc_request.status = VERIFIED, customer_draft.status = PENDING_ACTIVATION, and CUSTOMER_VERIFIED event is published. |
| AC-03 | Given the KYC API returns FAILED, then kyc_request.status = FAILED and the record is inserted into ops_review_queue. |
| AC-04 | Given the KYC API times out or returns 5xx, then the request is retried up to 3 times with exponential backoff before escalating. |
| AC-05 | Given all retries are exhausted, then kyc_request.status = MANUAL_REVIEW and an on-call alert fires within 2 minutes. |
| AC-06 | Given any KYC API call completes, then full request and response payloads are stored in kyc_request for audit. |
| AC-07 | Given a duplicate READY_FOR_VERIFICATION message arrives for a customer already in VERIFIED status, then the message is discarded and a warning is logged. |

## 17. SubTasks

| SubTask ID | SubTask Description | Assigned To | Est. Hours | Status |
|------------|---------------------|-------------|------------|--------|
| ST-001 | Implement queue consumer to read READY_FOR_VERIFICATION messages from kyc_request queue | Integration Dev | 3 hrs | [ To Do ] |
| ST-002 | Build KYC vendor API adapter (request construction, authentication, response parsing) per v1.2 spec | Integration Dev | 4 hrs | [ To Do ] |
| ST-003 | Implement retry logic with exponential backoff (max 3 retries) for timeout and 5xx errors | Integration Dev | 3 hrs | [ To Do ] |
| ST-004 | Implement VERIFIED response handler — update kyc_request and customer_draft; publish CUSTOMER_VERIFIED event | Integration Dev | 2 hrs | [ To Do ] |
| ST-005 | Implement FAILED response handler — update kyc_request; insert into ops_review_queue | Integration Dev | 2 hrs | [ To Do ] |
| ST-006 | Implement audit logging — store full request and response payloads in kyc_request table | Integration Dev | 1 hr | [ To Do ] |
| ST-007 | Configure on-call alert for MANUAL_REVIEW escalations (PagerDuty / alerting tool) | DevOps | 1 hr | [ To Do ] |
| ST-008 | Write unit tests for adapter, retry logic, and both response handlers | Integration Dev | 3 hrs | [ To Do ] |
| ST-009 | Write integration tests against KYC vendor sandbox environment | QA Engineer | 4 hrs | [ To Do ] |
| ST-010 | Perform end-to-end test of full KYC flow: US-008 output → queue → this story → US-005 activation | QA Engineer | 3 hrs | [ To Do ] |

---

*Template Version: 2.0 | Last Reviewed: 25-Mar-2026*

---

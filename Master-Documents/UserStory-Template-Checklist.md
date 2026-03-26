# User Story Completeness Checklist

> **Purpose:** Use this checklist when creating or reviewing a User Story to ensure all
> sections are filled in completely and correctly before the story is submitted for review,
> added to a sprint, or handed to the development team.
>
> **When to use:**
> - **Author** — self-review before submitting the User Story for approval
> - **Product Owner** — review before accepting story into the sprint backlog
> - **Scrum Master** — sprint planning gate check
> - **Tech Lead / Reviewer** — before development begins
> - **QA Engineer** — before test case creation begins
>
> **Scoring:** Each item is marked as one of:
> - `[ ]` — Not done
> - `[x]` — Complete
> - `[N/A]` — Not applicable (add a brief reason in the Notes column)
>
> A User Story is considered **READY FOR SPRINT** only when all applicable items
> are marked `[x]` and the Final Readiness Gate is passed.
>
> **Type-Specific Rules:**
> Certain sections apply only to specific User Story types. Where a section is marked
> as type-specific, use `[N/A]` with the reason if the type does not apply.
>
> | Section | Frontend | Backend | Integration |
> | --- | --- | --- | --- |
> | 9 — StateChart | Required | Required | Required |
> | 10 — Screen Reference | Required | N/A | N/A |
> | 11 — Display Field Types | Required | N/A | N/A |
> | 12 — Database Entities | Optional | Required | Required |
> | 14 — Validations | Required | Required | Optional |

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User Story ID   : US-[XXX]
User Story Name : [Name of the User Story]
EPIC ID         : EPIC-[XXX]
Reviewed By     : [Name / Role]
Review Date     : DD-MMM-YYYY
Review Stage    : [ Author Self-Review | PO Review | Tech Lead Review | QA Review | Final Approval ]
Overall Status  : [ NOT READY | READY WITH COMMENTS | READY FOR SPRINT ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## SECTION 0 — Header & Metadata

> Verify the User Story's identity and administrative fields are correctly filled
> before reviewing any content section.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 0.1 | User Story ID is assigned and follows naming convention (US-XXX) | `[ ]` | |
| 0.2 | EPIC ID in the header matches the EPIC Reference in Section 4 | `[ ]` | |
| 0.3 | Created Date is filled in (DD-MMM-YYYY format) | `[ ]` | |
| 0.4 | Last Updated date reflects the most recent edit to this document | `[ ]` | |
| 0.5 | Sprint is assigned or set to TBD with a reason | `[ ]` | |
| 0.6 | Status field is set to the correct current state | `[ ]` | |

---

## SECTION 1 — User Story ID

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.1 | User Story ID is present and not left as placeholder (US-[XXX]) | `[ ]` | |
| 1.2 | User Story ID is unique — does not duplicate any other story ID in the EPIC | `[ ]` | |
| 1.3 | User Story ID follows the project-wide naming convention | `[ ]` | |

---

## SECTION 2 — User Story Name

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 2.1 | User Story Name is filled in (not placeholder text) | `[ ]` | |
| 2.2 | Name is concise and clearly describes the specific capability being built | `[ ]` | |
| 2.3 | Name is unique within the EPIC — does not duplicate another story's name | `[ ]` | |
| 2.4 | Name is free of unexplained technical abbreviations | `[ ]` | |
| 2.5 | Name is understandable to both business stakeholders and the development team | `[ ]` | |

---

## SECTION 3 — User Story Description

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 3.1 | Description follows the standard format: "As a [Actor], I want [Goal], so that [Benefit]" | `[ ]` | |
| 3.2 | The "As a" field names a specific actor — not a vague role like "User" or "System" | `[ ]` | |
| 3.3 | The actor in "As a" matches one of the actors listed in Section 7 | `[ ]` | |
| 3.4 | The "I want" field describes a single, focused capability — not multiple goals in one sentence | `[ ]` | |
| 3.5 | The "So that" field states a meaningful business benefit — does not just repeat the "I want" clause | `[ ]` | |
| 3.6 | The description is free of implementation details (those belong in SubTasks) | `[ ]` | |

---

## SECTION 4 — EPIC Reference

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 4.1 | EPIC ID is filled in and matches a valid, approved EPIC (EPIC-XXX) | `[ ]` | |
| 4.2 | EPIC Name matches the official name in the EPIC document | `[ ]` | |
| 4.3 | EPIC Description is present — provides a one-line summary of the parent EPIC's purpose | `[ ]` | |
| 4.4 | This User Story belongs to exactly one EPIC (not duplicated across EPICs) | `[ ]` | |

---

## SECTION 5 — User Story Type

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 5.1 | Exactly one type is selected: Frontend, Backend, or Integration | `[ ]` | |
| 5.2 | The selected type accurately reflects the nature of the work in this story | `[ ]` | |
| 5.3 | The story does not mix UI work with backend logic in the same story — if both are needed, separate stories have been created | `[ ]` | |
| 5.4 | The assigned team for this type has been informed or tagged | `[ ]` | |

---

## SECTION 6 — Trigger

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 6.1 | At least one trigger is documented | `[ ]` | |
| 6.2 | Each trigger has a Trigger Type (User Action / User Story / Feature / System Event / Business Event) | `[ ]` | |
| 6.3 | Each trigger description is specific — not vague (e.g., not just "when the user is ready") | `[ ]` | |
| 6.4 | If triggered by another User Story, that story's US-ID is referenced explicitly | `[ ]` | |
| 6.5 | If triggered by a system event or scheduled job, the event name or schedule is stated | `[ ]` | |

---

## SECTION 7 — Actor(s)

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 7.1 | At least one actor is listed | `[ ]` | |
| 7.2 | The primary actor (who initiates or benefits from this story) is clearly identified | `[ ]` | |
| 7.3 | Each actor has an Actor Type (Primary User / Internal User / System / External) | `[ ]` | |
| 7.4 | Each actor has a specific Role in This User Story — not a generic description | `[ ]` | |
| 7.5 | System actors (APIs, services) are listed where they actively participate in the flow | `[ ]` | |
| 7.6 | No actor is listed without a meaningful role description — no blank entries | `[ ]` | |
| 7.7 | The actor named in Section 3 (Description) appears in this actor list | `[ ]` | |

---

## SECTION 8 — Primary Flow OR Alternate Scenario

> **Mutual Exclusion Check:** A story must have either Section 8A or Section 8B — never both.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 8.0 | Only ONE of Primary Flow (8A) or Alternate Scenario (8B) is present — not both | `[ ]` | |

### 8A — Primary Flow *(if applicable)*

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 8a.1 | At least three steps are documented in the Primary Flow | `[ ]` | |
| 8a.2 | Each step is numbered sequentially | `[ ]` | |
| 8a.3 | Each step specifies the Actor performing the action (not left blank) | `[ ]` | |
| 8a.4 | The flow has a clear starting point (what the actor does first) | `[ ]` | |
| 8a.5 | The flow has a clear successful end state (what "done" looks like) | `[ ]` | |
| 8a.6 | Steps are at a functional level — no implementation details or code references | `[ ]` | |
| 8a.7 | System response steps are included after each actor action where relevant | `[ ]` | |

### 8B — Alternate Scenario *(if applicable)*

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 8b.1 | The Parent User Story ID and Name are clearly referenced | `[ ]` | |
| 8b.2 | The exact Deviation Point (step number and description) is stated | `[ ]` | |
| 8b.3 | At least two steps are documented for the alternate path | `[ ]` | |
| 8b.4 | The alternate path has a clear resolution — not left open-ended | `[ ]` | |
| 8b.5 | The alternate path references what happens next (returns to parent story, redirects, terminates) | `[ ]` | |

---

## SECTION 9 — StateChart

> Required for ALL User Story types.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 9.1 | At least two distinct states are defined | `[ ]` | |
| 9.2 | Each state has a unique State ID (ST-XXX) | `[ ]` | |
| 9.3 | Each state has a State Name in UPPER_CASE matching the value used in the database or system | `[ ]` | |
| 9.4 | Each state has a clear State Description in plain language | `[ ]` | |
| 9.5 | Each state has an Entry Trigger (what causes entry into this state) | `[ ]` | |
| 9.6 | Each state has an Exit Trigger (what causes exit from this state) — or marked as terminal | `[ ]` | |
| 9.7 | Each state lists its valid Transitions To (next states) — or marked as terminal with "—" | `[ ]` | |
| 9.8 | A State Transition Summary diagram or flow is included | `[ ]` | |
| 9.9 | All states in the StateChart are reachable — no orphaned / unreachable states | `[ ]` | |
| 9.10 | Terminal states (no further transitions) are explicitly marked as such | `[ ]` | |
| 9.11 | The state names in the StateChart are consistent with the `status` field values in Section 12 (Database Entities) | `[ ]` | |

---

## SECTION 10 — Screen Reference

> Required for **Frontend** stories. Mark N/A for Backend and Integration.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 10.1 | At least one screen is listed (or explicitly marked N/A for non-Frontend stories) | `[ ]` | |
| 10.2 | Each screen has a unique Screen ID (SCR-XXX) | `[ ]` | |
| 10.3 | Each screen has a Screen Name that matches the wireframe / design file naming | `[ ]` | |
| 10.4 | Each screen has a Screen Description explaining its purpose and when it appears | `[ ]` | |
| 10.5 | Each screen has a Wireframe / Design Reference link (Figma, Zeplin, SharePoint, etc.) | `[ ]` | |
| 10.6 | All screens referenced in Section 11 (Display Field Types) are listed here | `[ ]` | |
| 10.7 | Every distinct screen in the Primary Flow / Alternate Scenario is accounted for | `[ ]` | |

---

## SECTION 11 — Display Field Types

> Required for **Frontend** stories. Mark N/A for Backend and Integration.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 11.1 | Section is filled in or explicitly marked N/A with a reason | `[ ]` | |
| 11.2 | Every UI element on every screen in this story is listed | `[ ]` | |
| 11.3 | Each field is linked to a Screen ID from Section 10 | `[ ]` | |
| 11.4 | Each field has a UI Label exactly as it will appear on screen | `[ ]` | |
| 11.5 | Each field has a Field Type specified (Text Input, Dropdown, Button, Date Picker, etc.) | `[ ]` | |
| 11.6 | Each field has Mandatory set to Yes or No (or — for non-input elements like buttons) | `[ ]` | |
| 11.7 | Each field has a Default Value specified (or "—" if none) | `[ ]` | |
| 11.8 | Each field has Placeholder Text specified (or "—" if not applicable) | `[ ]` | |
| 11.9 | All mandatory fields correspond to validations in Section 14 | `[ ]` | |
| 11.10 | All dropdowns have their data source identified (reference table, hardcoded list, API) | `[ ]` | |
| 11.11 | Buttons that trigger navigation or API calls are noted in Section 15 (Integrations) | `[ ]` | |

---

## SECTION 12 — Database Entities

> Required for **Backend** and **Integration** stories. Optional for Frontend.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 12.1 | Section is filled in or explicitly marked N/A with a reason | `[ ]` | |
| 12.2 | Every table that this story reads from, writes to, or modifies is listed | `[ ]` | |
| 12.3 | Every field / column in scope for this story is listed (not just the table name) | `[ ]` | |
| 12.4 | Each field has a correct Data Type (VARCHAR, UUID, INT, TIMESTAMP, JSONB, etc.) | `[ ]` | |
| 12.5 | Each field has Nullable correctly set (Y or N) | `[ ]` | |
| 12.6 | Each field has a Description explaining what it stores | `[ ]` | |
| 12.7 | Primary keys and unique indexes are identified in the description | `[ ]` | |
| 12.8 | Foreign keys are noted with the parent table they reference | `[ ]` | |
| 12.9 | The `status` field values (if present) match the State Names in Section 9 (StateChart) | `[ ]` | |
| 12.10 | Auto-calculated fields (e.g., expires_at = created_at + 72hrs) have their formula stated | `[ ]` | |

---

## SECTION 13 — Business Rules

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 13.1 | At least one business rule is documented (or "None" with a reason) | `[ ]` | |
| 13.2 | Each rule is a business policy or constraint — not a technical validation | `[ ]` | |
| 13.3 | Each rule is specific and testable — not vague (e.g., not "data must be valid") | `[ ]` | |
| 13.4 | Each rule has a Source Reference linking it to a BRD or FRD section | `[ ]` | |
| 13.5 | Eligibility rules (age, role, status) are captured | `[ ]` | |
| 13.6 | Uniqueness rules (email, ID, mobile) are captured | `[ ]` | |
| 13.7 | Expiry, timeout, or time-based rules are captured | `[ ]` | |
| 13.8 | Default value rules (e.g., country defaults to "India") are captured | `[ ]` | |
| 13.9 | All business rules are reflected in either Validations (Section 14) or Acceptance Criteria (Section 16) | `[ ]` | |

---

## SECTION 14 — Validations

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 14.1 | At least one validation is documented (or "None" with a reason for Backend-only stories) | `[ ]` | |
| 14.2 | Every mandatory field from Section 11 has a "must not be blank" validation | `[ ]` | |
| 14.3 | Every field with a format requirement has a format validation (email, phone, date, etc.) | `[ ]` | |
| 14.4 | Every field with a length or size constraint has the corresponding validation | `[ ]` | |
| 14.5 | Each validation has a clear, user-friendly Error Message (for client-facing stories) | `[ ]` | |
| 14.6 | Each validation is classified correctly as Client-side, Server-side, or Both | `[ ]` | |
| 14.7 | Server-side validations exist for all business rules that cannot be trusted to the client | `[ ]` | |
| 14.8 | Uniqueness validations are marked Server-side (never Client-only) | `[ ]` | |
| 14.9 | No validation message leaks sensitive system information (table names, stack traces) | `[ ]` | |
| 14.10 | All validations correspond to Acceptance Criteria in Section 16 | `[ ]` | |

---

## SECTION 15 — Integrations

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 15.1 | Section is completed or explicitly marked "None" with a reason | `[ ]` | |
| 15.2 | All external integrations (third-party APIs, payment gateways, government systems) are listed | `[ ]` | |
| 15.3 | All internal integrations (other User Stories, modules, services this story depends on) are listed | `[ ]` | |
| 15.4 | Each integration has a Direction: "This story calls" or "Called by" | `[ ]` | |
| 15.5 | Each integration specifies the Method (REST API, Message Queue, Database, Page Redirect, etc.) | `[ ]` | |
| 15.6 | Each integration has a Description of what data is exchanged and why | `[ ]` | |
| 15.7 | All other User Stories referenced in the Primary Flow / Alternate Scenario appear here | `[ ]` | |
| 15.8 | For external APIs — the API contract version or specification reference is noted | `[ ]` | |
| 15.9 | For Integration-type stories — at least one external integration is documented | `[ ]` | |

---

## SECTION 16 — Acceptance Criteria

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 16.1 | At least three Acceptance Criteria are documented | `[ ]` | |
| 16.2 | Each criterion is independently testable — a tester can write a test case directly from it | `[ ]` | |
| 16.3 | Given-When-Then (GWT) format is used wherever possible | `[ ]` | |
| 16.4 | At least one criterion covers the successful end state of the Primary Flow / Alternate Scenario | `[ ]` | |
| 16.5 | At least one criterion covers a validation failure or error state | `[ ]` | |
| 16.6 | At least one criterion covers a key business rule from Section 13 | `[ ]` | |
| 16.7 | Edge cases from the StateChart (Section 9) are reflected as criteria | `[ ]` | |
| 16.8 | For Frontend stories — at least one criterion covers an accessibility or usability requirement | `[ ]` | |
| 16.9 | For Integration stories — retry behaviour and failure escalation are covered by criteria | `[ ]` | |
| 16.10 | No criterion uses vague language such as "works correctly", "user-friendly", or "performs well" | `[ ]` | |
| 16.11 | All criteria are achievable within the scope of this single User Story (no cross-story criteria) | `[ ]` | |

---

## SECTION 17 — SubTasks

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 17.1 | At least two SubTasks are defined | `[ ]` | |
| 17.2 | Each SubTask has a unique SubTask ID (ST-XXX) scoped to this User Story | `[ ]` | |
| 17.3 | Each SubTask Description starts with an action verb (Create, Implement, Write, Configure, etc.) | `[ ]` | |
| 17.4 | Each SubTask is granular enough for one developer or tester to pick up independently | `[ ]` | |
| 17.5 | Writing unit tests is included as an explicit SubTask | `[ ]` | |
| 17.6 | Writing integration or end-to-end tests is included as a SubTask (where applicable) | `[ ]` | |
| 17.7 | An Assigned To role or team member is set (or marked TBD with a note) | `[ ]` | |
| 17.8 | An Estimated Hours value is provided (or marked TBD) | `[ ]` | |
| 17.9 | SubTasks collectively cover the full delivery of this User Story end-to-end | `[ ]` | |
| 17.10 | No SubTask duplicates another SubTask in scope within this story | `[ ]` | |
| 17.11 | All SubTasks have Status set to "To Do" at the time of sprint entry | `[ ]` | |

---

## SECTION RH — Revision History

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| RH.1 | Version 1.0 entry exists with Created Date and Author name | `[ ]` | |
| RH.2 | Every significant change to the story after v1.0 is recorded with a new version entry | `[ ]` | |
| RH.3 | The latest version's date in Revision History matches the Last Updated date in the header | `[ ]` | |

---

## CROSS-SECTION CONSISTENCY CHECKS

> These checks validate that sections are internally consistent with each other —
> not just individually complete. Run these after all individual sections pass.

| # | Consistency Check | Status | Notes / Comments |
|---|-------------------|--------|------------------|
| CC.1 | The actor in Section 3 (Description — "As a") appears in Section 7 (Actors) | `[ ]` | |
| CC.2 | Every actor in Section 7 appears at least once in the flow steps of Section 8 | `[ ]` | |
| CC.3 | Every trigger in Section 6 is reflected in Section 9 (StateChart) as an entry trigger for the initial state | `[ ]` | |
| CC.4 | All Screen IDs in Section 11 (Display Field Types) exist in Section 10 (Screen Reference) | `[ ]` | |
| CC.5 | All mandatory fields in Section 11 have a corresponding validation in Section 14 | `[ ]` | |
| CC.6 | The `status` field values in Section 12 (Database Entities) match the State Names in Section 9 (StateChart) | `[ ]` | |
| CC.7 | Every business rule in Section 13 is tested by at least one Acceptance Criterion in Section 16 | `[ ]` | |
| CC.8 | Every validation in Section 14 is tested by at least one Acceptance Criterion in Section 16 | `[ ]` | |
| CC.9 | Every User Story or system referenced in Section 8 (Flow) appears in Section 15 (Integrations) | `[ ]` | |
| CC.10 | No item listed in Integrations (Section 15) contradicts the story's User Story Type (Section 5) — e.g., a Frontend story should not directly call a database | `[ ]` | |
| CC.11 | SubTasks in Section 17 collectively cover every step in Section 8 (Flow) | `[ ]` | |
| CC.12 | For Alternate Scenario stories — the Parent User Story ID in Section 8B exists and is valid | `[ ]` | |

---

## FINAL READINESS GATE

> Complete this section last, after all individual and cross-section checks above are done.
> The User Story may only proceed to sprint planning when all applicable items are `[x]`.

| # | Gate Check | Status | Notes / Comments |
|---|------------|--------|------------------|
| G.1 | All mandatory sections are fully completed — no placeholder text remains | `[ ]` | |
| G.2 | All `[N/A]` items have a brief reason recorded in the Notes column | `[ ]` | |
| G.3 | The story has been self-reviewed by the Author before submission | `[ ]` | |
| G.4 | The story has been reviewed and accepted by the Product Owner | `[ ]` | |
| G.5 | The story has been reviewed by the Tech Lead or relevant team lead | `[ ]` | |
| G.6 | The story fits within a single sprint based on total SubTask effort estimate | `[ ]` | |
| G.7 | All EPIC IDs, User Story IDs, and Screen IDs referenced are valid and exist | `[ ]` | |
| G.8 | The story type (Frontend / Backend / Integration) is confirmed with the receiving team | `[ ]` | |
| G.9 | No section in this story contradicts the parent EPIC's scope or Out of Scope definition | `[ ]` | |
| G.10 | All cross-section consistency checks (CC.1–CC.12) are passed | `[ ]` | |
| G.11 | User Story status is updated to "Approved" after this checklist is fully passed | `[ ]` | |

---

## CHECKLIST SIGN-OFF

```
Author             : [Name]                    Date : DD-MMM-YYYY
PO Review          : [Name]                    Date : DD-MMM-YYYY
Tech Lead Review   : [Name]                    Date : DD-MMM-YYYY
QA Review          : [Name]                    Date : DD-MMM-YYYY
Final Approval     : [Name / Role]             Date : DD-MMM-YYYY

Overall Result     : [ NOT READY | READY WITH COMMENTS | READY FOR SPRINT ]

Open Items / Comments:
  1. [Any open item that must be resolved before the story enters sprint]
  2. [Any conditional approval note]
```

---

## QUICK REFERENCE — SECTION APPLICABILITY BY TYPE

> Use this as a fast reference during review to know which sections to focus on
> based on the User Story type.

| Section | Description | Frontend | Backend | Integration |
| --- | --- | --- | --- | --- |
| 0 | Header & Metadata | Required | Required | Required |
| 1 | User Story ID | Required | Required | Required |
| 2 | User Story Name | Required | Required | Required |
| 3 | Description (As a / I want / So that) | Required | Required | Required |
| 4 | EPIC Reference | Required | Required | Required |
| 5 | User Story Type | Required | Required | Required |
| 6 | Trigger | Required | Required | Required |
| 7 | Actor(s) | Required | Required | Required |
| 8A | Primary Flow | Required if no 8B | Required if no 8B | Required if no 8B |
| 8B | Alternate Scenario | Required if no 8A | Required if no 8A | Required if no 8A |
| 9 | StateChart | Required | Required | Required |
| 10 | Screen Reference | Required | N/A | N/A |
| 11 | Display Field Types | Required | N/A | N/A |
| 12 | Database Entities | Optional | Required | Required |
| 13 | Business Rules | Required | Required | Required |
| 14 | Validations | Required | Required | Optional |
| 15 | Integrations | Required | Required | Required |
| 16 | Acceptance Criteria | Required | Required | Required |
| 17 | SubTasks | Required | Required | Required |
| RH | Revision History | Required | Required | Required |

---

*Checklist Version: 1.0 | Aligned to UserStory-Template v2.0 | Last Reviewed: 25-Mar-2026*

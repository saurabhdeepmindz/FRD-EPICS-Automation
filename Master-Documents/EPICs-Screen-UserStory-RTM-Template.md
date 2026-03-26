# EPICs – Screen – User Story Requirements Traceability Matrix (RTM) Template

> **Document Flow:** PRD → BRD → FRD → Initiative → **EPIC → Screen → User Story** → SubTask
>
> This RTM is the **mid-tier traceability document** that connects EPICs (capability level)
> to Screens (design level) to User Stories (delivery level) in a single consolidated view.
>
> It enables teams to answer:
> - Which User Stories belong to each EPIC?
> - Which screens does each EPIC touch, and which User Stories implement those screens?
> - Which EPICs and User Stories touch a shared screen?
> - Are there any screens without User Stories, or User Stories without screens (where expected)?
> - Are there any EPICs with no User Stories assigned?
>
> **Cardinality Rules:**
> - One EPIC → One or more Screens (for Frontend stories) + Zero or more N/A rows (for Backend / Integration stories)
> - One Screen → One or more User Stories
> - One User Story → One or more Screens (a story that spans multiple screens appears once per screen)
> - One row = one EPIC → Screen → User Story relationship
>
> **Screen ID Rules:**
> - **Frontend** stories — Screen ID is mandatory; enter the primary screen this story implements
> - **Backend** stories — Screen ID = N/A (backend has no UI screens)
> - **Integration** stories — Screen ID = N/A (integration has no UI screens)
> - A story that spans multiple screens — enter primary Screen ID in the Screen ID column;
>   list additional screens in the Screen Name / Description column with a note
>
> **Relationship to other RTMs:**
> - **PRD–EPICs RTM** — traces PRD features → EPICs (one level above this RTM)
> - **EPIC–Screen RTM** — traces EPICs → screens only (subset view of this RTM)
> - **UserStory–SubTask RTM** — traces User Stories → SubTasks (one level below this RTM)
> - Together, all four RTMs provide complete vertical traceability:
>   PRD Feature → EPIC → Screen → User Story → SubTask

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RTM ID          : RTM-ES-US-[XXX]
Initiative ID   : INIT-[XXX]
Initiative Name : [Initiative Name]
PRD ID          : PRD-[XXX]
Created Date    : DD-MMM-YYYY
Last Updated    : DD-MMM-YYYY
Prepared By     : [Name / Role]
Reviewed By     : [Name / Role]
Version         : 1.0
Status          : [ Draft | Under Review | Approved | Baselined ]
Total EPICs     : [N]
Total Screens   : [N]
Total User Stories : [N]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Table of Contents

| # | Section |
|---|---------|
| — | Column Definitions |
| 1 | EPIC → Screen → User Story RTM (main matrix) |
| 2 | RTM Summary — User Stories per EPIC |
| 3 | RTM Summary — User Stories per Screen |
| 4 | RTM Summary — Screen Coverage per EPIC |
| 5 | Coverage Gap Analysis |
| — | Usage Notes |
| — | Revision History |

---

## Column Definitions

> **Guideline:** All columns are mandatory for every row. Use N/A only where explicitly
> permitted (Screen ID and Screen Name for Backend and Integration story types).

| Column | Description | Allowed Values / Format |
|--------|-------------|------------------------|
| **Sr No** | Sequential row number across the entire RTM | 1, 2, 3 … |
| **EPIC ID** | ID of the EPIC this row belongs to | EPIC-[XXX] |
| **EPIC Name** | Short name of the EPIC | Free text |
| **EPIC Description** | One-line description of the EPIC's purpose | Free text — max 1 sentence |
| **Screen ID** | ID of the screen this User Story primarily implements | SCR-[XXX] or N/A |
| **Screen Name** | Name of the screen as defined in the Screen Wireframe document | Free text or N/A |
| **Screen Type** | The audience and access level of the screen | Customer-facing / Operations / Admin / N/A |
| **User Story ID** | ID of the User Story implementing this EPIC on this screen | US-[XXX] |
| **User Story Name** | Short name of the User Story | Free text |
| **User Story Type** | The technical classification of the story | Frontend / Backend / Integration |
| **User Story Description** | The full "As a / I want / So that" statement | As a… / I want… / So that… |
| **Flow** | Whether this story is a primary or alternate path | Primary / Alternate |
| **Priority** | Delivery priority | High / Medium / Low |
| **Sprint** | Planned or actual sprint | Sprint-[XX] or TBD |
| **Status** | Current delivery status of the User Story | To Do / In Progress / Done / Blocked / Deferred |

---

## 1. EPIC → Screen → User Story RTM

> **Guideline:**
> - One row per EPIC → Screen → User Story relationship.
> - Sort by EPIC ID → Screen ID → User Story ID within each group.
> - Backend and Integration stories have Screen ID = N/A and appear after all screen-mapped rows
>   for the same EPIC.
> - If one User Story touches multiple screens (e.g., a navigation component spanning steps 1–3),
>   create one row per screen, repeating the User Story ID and Description.
> - If one screen is implemented by multiple User Stories (e.g., a dashboard with frontend UI
>   story and a backend data API story), create one row per User Story.
> - Alternate Scenario User Stories are included — they are linked to the screen where the
>   deviation occurs.

| Sr No | EPIC ID | EPIC Name | EPIC Description | Screen ID | Screen Name | Screen Type | User Story ID | User Story Name | User Story Type | User Story Description | Flow | Priority | Sprint | Status |
|-------|---------|-----------|------------------|-----------|-------------|-------------|---------------|-----------------|-----------------|------------------------|------|----------|--------|--------|
| 1 | EPIC-[XXX] | [EPIC Name] | [One-line EPIC description] | SCR-[XXX] | [Screen Name] | [Screen Type] | US-[XXX] | [User Story Name] | Frontend | As a [Actor] / I want [Goal] / So that [Benefit] | Primary | H/M/L | TBD | To Do |
| 2 | EPIC-[XXX] | [EPIC Name] | [One-line EPIC description] | SCR-[XXX] | [Screen Name] | [Screen Type] | US-[XXX] | [User Story Name] | Frontend | As a [Actor] / I want [Goal] / So that [Benefit] | Alternate | H/M/L | TBD | To Do |
| 3 | EPIC-[XXX] | [EPIC Name] | [One-line EPIC description] | N/A | N/A | N/A | US-[XXX] | [User Story Name] | Backend | As a [Actor] / I want [Goal] / So that [Benefit] | Primary | H/M/L | TBD | To Do |
| 4 | EPIC-[XXX] | [EPIC Name] | [One-line EPIC description] | N/A | N/A | N/A | US-[XXX] | [User Story Name] | Integration | As a [Actor] / I want [Goal] / So that [Benefit] | Primary | H/M/L | TBD | To Do |

---

## 2. RTM Summary — User Stories per EPIC

> **Guideline:** Lists every User Story under each EPIC with type and screen coverage.
> Use this view during sprint planning to confirm all User Stories for an EPIC are accounted for.
> An EPIC with zero User Stories must be flagged in the Gap Analysis (Section 5).

| EPIC ID | EPIC Name | Total User Stories | Frontend Stories | Backend Stories | Integration Stories | User Story IDs |
|---------|-----------|--------------------|------------------|-----------------|---------------------|----------------|
| EPIC-[XXX] | [EPIC Name] | [N] | [N] | [N] | [N] | US-[XXX], US-[XXX], … |

---

## 3. RTM Summary — User Stories per Screen

> **Guideline:** Lists every User Story linked to each screen.
> A screen with multiple User Stories is a shared or complex screen — flag for design review
> to ensure all story-specific requirements are reflected in the wireframe.
> A screen with zero User Stories is a wireframe gap — flag in Section 5.

| Screen ID | Screen Name | Screen Type | Total User Stories | User Story IDs | EPIC IDs |
|-----------|-------------|-------------|-------------------|----------------|----------|
| SCR-[XXX] | [Screen Name] | [Screen Type] | [N] | US-[XXX], US-[XXX], … | EPIC-[XXX], … |

---

## 4. RTM Summary — Screen Coverage per EPIC

> **Guideline:** Shows the count of unique screens per EPIC and which stories have no screen
> (Backend / Integration). A high N/A count is expected for backend-heavy EPICs.
> An EPIC with zero screens AND zero backend/integration stories has no coverage at all — critical gap.

| EPIC ID | EPIC Name | Total Screens | Screen IDs | Stories With Screen | Stories Without Screen (N/A) |
|---------|-----------|---------------|------------|---------------------|-------------------------------|
| EPIC-[XXX] | [EPIC Name] | [N] | SCR-[XXX], … | [N] Frontend stories | [N] Backend + Integration stories |

---

## 5. Coverage Gap Analysis

> **Guideline:** Log every gap, mismatch, or traceability issue identified during RTM review.
> All gaps must be assigned an owner and a resolution target date.
> Gaps that remain open at RTM baseline are risks to delivery completeness.

| Gap ID | Gap Type | EPIC ID | Screen ID | User Story ID | Description | Action Required | Assigned To | Target Date | Status |
|--------|----------|---------|-----------|---------------|-------------|-----------------|-------------|-------------|--------|
| GAP-001 | [Gap Type] | EPIC-[XXX] or N/A | SCR-[XXX] or N/A | US-[XXX] or N/A | [Description of the gap] | [Action to close the gap] | [Name / Role] | DD-MMM-YYYY | Open / Closed |

> **Gap Types:**
> - `EPIC Without User Story` — An EPIC has no User Stories assigned in the backlog
> - `Screen Without User Story` — A wireframe screen exists but no User Story implements it
> - `User Story Without Screen` — A Frontend User Story has no Screen ID (mandatory for Frontend)
> - `User Story Without EPIC` — A User Story exists in the backlog without a parent EPIC
> - `Missing Wireframe` — A Screen ID is referenced in the RTM but no Wireframe document exists
> - `Shared Screen Conflict` — A screen is used by multiple User Stories whose requirements may conflict
> - `Sprint Not Assigned` — User Stories are approaching sprint start with no sprint allocated
> - `Scope Change` — A User Story or Screen was added / removed after RTM baseline

---

## Usage Notes

> 1. **Baseline this RTM** once all EPICs are approved and User Stories are drafted for Phase 1.
>    Any addition, removal, or reassignment of a User Story or screen after baseline is a scope
>    change — log it in Section 5 with the approver's name.
>
> 2. **Sorting:** Primary sort by EPIC ID ascending. Within each EPIC, sort screen-mapped rows
>    (Frontend) first by Screen ID, then by User Story ID. N/A rows (Backend / Integration)
>    appear at the end of each EPIC block.
>
> 3. **Shared screens:** A screen that belongs to multiple EPICs or User Stories must appear as
>    a separate row for each EPIC–User Story pair. Do not merge rows — every relationship
>    must be independently traceable.
>
> 4. **Sprint column:** Populate as sprint planning progresses. TBD at RTM baseline is acceptable.
>    Before each sprint, all stories in that sprint must have Sprint = Sprint-[XX] — no TBD entries
>    in the active sprint.
>
> 5. **Cross-reference:** This RTM must be kept consistent with:
>    - EPIC–Screen RTM (Section 1 of this RTM is the superset of that document)
>    - UserStory–SubTask RTM (each US-[XXX] here links to SubTask rows in that RTM)
>    - PRD–EPICs RTM (each EPIC-[XXX] here links to PRD features in that RTM)

---

## Revision History

```
| Version | Date         | Author         | Changes Made                                    | Approved By     |
|---------|--------------|----------------|-------------------------------------------------|-----------------|
| 1.0     | DD-MMM-YYYY  | [Author Name]  | Initial RTM draft                               | [Approver Name] |
| 1.1     | DD-MMM-YYYY  | [Author Name]  | [Brief description of changes]                  | [Approver Name] |
```

---

*Template Version: 1.0 | Last Reviewed: 26-Mar-2026*

---
---

# EXAMPLE — INIT-001: Unified Digital Onboarding Platform

> **Initiative:** INIT-001 — Unified Digital Onboarding Platform (UDOP)
> **PRD:** PRD-001
>
> **EPIC Register:**
>
> | EPIC ID | EPIC Name | Phase |
> |---------|-----------|-------|
> | EPIC-001 | Customer Registration & KYC Verification | Phase 1 |
> | EPIC-002 | Document Upload & Verification | Phase 1 |
> | EPIC-003 | Account Provisioning | Phase 1 |
> | EPIC-004 | Notification & Communication Hub | Phase 1 |
> | EPIC-005 | Identity & Access Management | Phase 1 |
> | EPIC-006 | Operations Exception Dashboard & Reporting | Phase 2 |
> | EPIC-007 | Admin Configuration Panel | Phase 2 |
>
> **Screen Register:**
>
> | Screen ID | Screen Name | Screen Type | EPIC(s) |
> |-----------|-------------|-------------|---------|
> | SCR-001 | Portal Landing Page | Customer-facing | EPIC-001 |
> | SCR-002 | Personal Details — Registration Step 1 | Customer-facing | EPIC-001 |
> | SCR-003 | Address Details — Registration Step 2 | Customer-facing | EPIC-001 |
> | SCR-004 | Document Upload — Registration Step 3 | Customer-facing | EPIC-001, EPIC-002 |
> | SCR-005 | Registration Confirmation | Customer-facing | EPIC-001 |
> | SCR-006 | KYC Verification Status | Customer-facing | EPIC-001, EPIC-002 |
> | SCR-007 | KYC Manual Review — Back Office | Operations | EPIC-002 |
> | SCR-008 | Account Activation Confirmation | Customer-facing | EPIC-003 |
> | SCR-009 | Notification Preferences | Customer-facing | EPIC-004 |
> | SCR-010 | Customer Login | Customer-facing | EPIC-005 |
> | SCR-011 | MFA / OTP Verification | Customer-facing | EPIC-005 |
> | SCR-012 | Operations Exception Queue | Operations | EPIC-006 |
> | SCR-013 | Application Detail — Manual Review | Operations | EPIC-006 |
> | SCR-014 | Reporting & Analytics Dashboard | Operations | EPIC-006 |
> | SCR-015 | KYC Rule Configuration | Admin | EPIC-007 |
> | SCR-016 | Notification Template Management | Admin | EPIC-007 |
> | SCR-017 | User Role & Permission Management | Admin | EPIC-007 |

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RTM ID          : RTM-ES-US-001
Initiative ID   : INIT-001
Initiative Name : Unified Digital Onboarding Platform
PRD ID          : PRD-001
Created Date    : 26-Mar-2026
Last Updated    : 26-Mar-2026
Prepared By     : Business Analyst / Product Owner
Reviewed By     : Tech Lead
Version         : 1.0
Status          : Approved
Total EPICs     : 7
Total Screens   : 17
Total User Stories : 28
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 1. EPIC → Screen → User Story RTM

| Sr No | EPIC ID | EPIC Name | EPIC Description | Screen ID | Screen Name | Screen Type | User Story ID | User Story Name | User Story Type | User Story Description | Flow | Priority | Sprint | Status |
|-------|---------|-----------|------------------|-----------|-------------|-------------|---------------|-----------------|-----------------|------------------------|------|----------|--------|--------|
| 1 | EPIC-001 | Customer Registration & KYC Verification | End-to-end digital registration covering personal details, address, OTP verification, and KYC initiation | SCR-001 | Portal Landing Page | Customer-facing | US-001 | Multi-Step Customer Registration Form | Frontend | As a New Customer / I want a guided multi-step registration form / So that I can complete my account application digitally without visiting a branch | Primary | High | Sprint-1 | To Do |
| 2 | EPIC-001 | Customer Registration & KYC Verification | End-to-end digital registration covering personal details, address, OTP verification, and KYC initiation | SCR-002 | Personal Details — Step 1 | Customer-facing | US-001 | Multi-Step Customer Registration Form | Frontend | As a New Customer / I want a guided multi-step registration form / So that I can complete my account application digitally without visiting a branch | Primary | High | Sprint-1 | To Do |
| 3 | EPIC-001 | Customer Registration & KYC Verification | End-to-end digital registration covering personal details, address, OTP verification, and KYC initiation | SCR-003 | Address Details — Step 2 | Customer-facing | US-001 | Multi-Step Customer Registration Form | Frontend | As a New Customer / I want a guided multi-step registration form / So that I can complete my account application digitally without visiting a branch | Primary | High | Sprint-1 | To Do |
| 4 | EPIC-001 | Customer Registration & KYC Verification | End-to-end digital registration covering personal details, address, OTP verification, and KYC initiation | SCR-005 | Registration Confirmation | Customer-facing | US-001 | Multi-Step Customer Registration Form | Frontend | As a New Customer / I want a guided multi-step registration form / So that I can complete my account application digitally without visiting a branch | Primary | High | Sprint-1 | To Do |
| 5 | EPIC-001 | Customer Registration & KYC Verification | End-to-end digital registration covering personal details, address, OTP verification, and KYC initiation | SCR-002 | Personal Details — Step 1 (Error State) | Customer-facing | US-002 | Registration — Duplicate Email Recovery | Frontend | As a New Customer / I want to be clearly informed when my email is already registered / So that I can recover or continue with a different email without contacting support | Alternate | High | Sprint-1 | To Do |
| 6 | EPIC-001 | Customer Registration & KYC Verification | End-to-end digital registration covering personal details, address, OTP verification, and KYC initiation | SCR-002 | Personal Details — Step 1 (OTP Panel) | Customer-facing | US-003 | Mobile OTP Verification | Frontend | As a New Customer / I want to verify my mobile number via OTP / So that my contact details are confirmed before proceeding | Primary | High | Sprint-1 | To Do |
| 7 | EPIC-001 | Customer Registration & KYC Verification | End-to-end digital registration covering personal details, address, OTP verification, and KYC initiation | SCR-006 | KYC Verification Status | Customer-facing | US-004 | KYC Status Tracking Screen | Frontend | As a New Customer / I want to see my current KYC verification status / So that I know whether my application is progressing or requires action from me | Primary | High | Sprint-2 | To Do |
| 8 | EPIC-001 | Customer Registration & KYC Verification | End-to-end digital registration covering personal details, address, OTP verification, and KYC initiation | N/A | N/A | N/A | US-005 | Customer Draft Record — Backend API | Backend | As a Registration Backend Service / I want to receive and persist customer registration data / So that details are securely stored and available for the KYC verification flow | Primary | High | Sprint-1 | To Do |
| 9 | EPIC-001 | Customer Registration & KYC Verification | End-to-end digital registration covering personal details, address, OTP verification, and KYC initiation | N/A | N/A | N/A | US-006 | OTP Generation and Validation Service | Backend | As a Registration Backend Service / I want to generate, send, and validate OTPs / So that mobile numbers are verified before registration proceeds | Primary | High | Sprint-1 | To Do |
| 10 | EPIC-002 | Document Upload & Verification | Customer document upload, OCR-based data extraction, and automated third-party KYC API verification | SCR-004 | Document Upload — Step 3 | Customer-facing | US-007 | Document Upload Interface | Frontend | As a New Customer / I want to upload my identity document and have my details auto-extracted / So that I do not need to retype information already present in the document | Primary | High | Sprint-2 | To Do |
| 11 | EPIC-002 | Document Upload & Verification | Customer document upload, OCR-based data extraction, and automated third-party KYC API verification | SCR-006 | KYC Verification Status | Customer-facing | US-008 | KYC Re-submission Request Screen | Frontend | As a New Customer whose KYC has failed / I want to be clearly shown the reason for failure and how to re-submit / So that I can correct my documents and reactivate my application | Alternate | High | Sprint-2 | To Do |
| 12 | EPIC-002 | Document Upload & Verification | Customer document upload, OCR-based data extraction, and automated third-party KYC API verification | SCR-007 | KYC Manual Review — Back Office | Operations | US-009 | Operations KYC Manual Review Screen | Frontend | As an Operations Agent / I want to review KYC applications flagged for manual verification / So that I can approve, reject, or request re-submission from the customer | Primary | High | Sprint-2 | To Do |
| 13 | EPIC-002 | Document Upload & Verification | Customer document upload, OCR-based data extraction, and automated third-party KYC API verification | N/A | N/A | N/A | US-010 | Document Storage & Encryption Service | Backend | As a Document Storage Service / I want to store uploaded documents in AES-256 encrypted object storage / So that all documents are secure and tamper-evident at rest | Primary | High | Sprint-2 | To Do |
| 14 | EPIC-002 | Document Upload & Verification | Customer document upload, OCR-based data extraction, and automated third-party KYC API verification | N/A | N/A | N/A | US-011 | OCR & KYC API Integration | Integration | As a KYC Integration Service / I want to extract document data via OCR and verify identity via the KYC API / So that customer KYC is completed automatically without manual intervention for standard cases | Primary | High | Sprint-2 | To Do |
| 15 | EPIC-003 | Account Provisioning | Automated account creation in the Core Banking System on KYC approval and welcome communication dispatch | SCR-008 | Account Activation Confirmation | Customer-facing | US-012 | Account Activation Confirmation Screen | Frontend | As a New Customer / I want to see my new account number and activation confirmation immediately after approval / So that I know my account is ready and how to start using it | Primary | High | Sprint-3 | To Do |
| 16 | EPIC-003 | Account Provisioning | Automated account creation in the Core Banking System on KYC approval and welcome communication dispatch | N/A | N/A | N/A | US-013 | CBS Account Creation Integration | Integration | As an Account Provisioning Service / I want to call the CBS account creation API on KYC approval / So that a new customer account is automatically created without manual intervention | Primary | High | Sprint-3 | To Do |
| 17 | EPIC-003 | Account Provisioning | Automated account creation in the Core Banking System on KYC approval and welcome communication dispatch | N/A | N/A | N/A | US-014 | Welcome Notification Trigger | Backend | As a Notification Service / I want to send a Welcome SMS and Email on account activation / So that the customer receives their account details and next steps immediately upon activation | Primary | High | Sprint-3 | To Do |
| 18 | EPIC-004 | Notification & Communication Hub | Event-driven notification system for SMS, Email, and In-app alerts across all customer journey events | SCR-009 | Notification Preferences | Customer-facing | US-015 | Notification Preferences Screen | Frontend | As an Authenticated Customer / I want to manage my notification preferences / So that I receive communications only through the channels I prefer | Primary | Medium | Sprint-3 | To Do |
| 19 | EPIC-004 | Notification & Communication Hub | Event-driven notification system for SMS, Email, and In-app alerts across all customer journey events | N/A | N/A | N/A | US-016 | Notification Event Processing Service | Backend | As a Notification Backend Service / I want to consume application lifecycle events and dispatch the correct communications / So that customers are always informed of their application status in real time | Primary | High | Sprint-3 | To Do |
| 20 | EPIC-005 | Identity & Access Management | Customer self-registration login, MFA enforcement, session management, and RBAC for all user types | SCR-010 | Customer Login | Customer-facing | US-017 | Customer Login Screen | Frontend | As an Existing Customer / I want to log in securely using my email and password / So that I can access my account and track my onboarding status | Primary | High | Sprint-1 | To Do |
| 21 | EPIC-005 | Identity & Access Management | Customer self-registration login, MFA enforcement, session management, and RBAC for all user types | SCR-010 | Customer Login (Locked State) | Customer-facing | US-018 | Account Lockout and Recovery Flow | Frontend | As a Customer who has exceeded login attempts / I want to be clearly informed of the lockout and offered a recovery path / So that I can regain access to my account securely | Alternate | High | Sprint-1 | To Do |
| 22 | EPIC-005 | Identity & Access Management | Customer self-registration login, MFA enforcement, session management, and RBAC for all user types | SCR-011 | MFA / OTP Verification | Customer-facing | US-019 | MFA OTP Verification Screen | Frontend | As an Authenticating Customer / I want to verify my identity via OTP as a second factor / So that my account is protected against unauthorised access | Primary | High | Sprint-1 | To Do |
| 23 | EPIC-005 | Identity & Access Management | Customer self-registration login, MFA enforcement, session management, and RBAC for all user types | N/A | N/A | N/A | US-020 | Session Management & Token Service | Backend | As an Authentication Backend Service / I want to issue, validate, and expire session tokens / So that authenticated sessions are secure and automatically terminated after inactivity | Primary | High | Sprint-1 | To Do |
| 24 | EPIC-006 | Operations Exception Dashboard & Reporting | Operations agent exception queue management, SLA monitoring, and reporting analytics for management | SCR-012 | Operations Exception Queue | Operations | US-021 | Operations Exception Queue Dashboard | Frontend | As an Operations Agent / I want a consolidated dashboard of applications flagged for manual review / So that I can prioritise and process exceptions efficiently within SLA | Primary | High | Sprint-5 | To Do |
| 25 | EPIC-006 | Operations Exception Dashboard & Reporting | Operations agent exception queue management, SLA monitoring, and reporting analytics for management | SCR-013 | Application Detail — Manual Review | Operations | US-022 | Application Detail and Review Actions Screen | Frontend | As an Operations Agent / I want to view the full application detail and available actions on a single screen / So that I can review, approve, reject, or request re-submission without switching contexts | Primary | High | Sprint-5 | To Do |
| 26 | EPIC-006 | Operations Exception Dashboard & Reporting | Operations agent exception queue management, SLA monitoring, and reporting analytics for management | SCR-014 | Reporting & Analytics Dashboard | Operations | US-023 | Onboarding Analytics and Reporting Dashboard | Frontend | As an Operations Supervisor / I want a real-time dashboard showing onboarding volumes, TAT, and drop-off rates / So that I can monitor team performance and identify bottlenecks | Primary | Medium | Sprint-6 | To Do |
| 27 | EPIC-006 | Operations Exception Dashboard & Reporting | Operations agent exception queue management, SLA monitoring, and reporting analytics for management | N/A | N/A | N/A | US-024 | Operations Queue Backend API | Backend | As an Operations Backend Service / I want to expose the exception queue and SLA status via API / So that the Operations Dashboard can display real-time queue data | Primary | High | Sprint-5 | To Do |
| 28 | EPIC-007 | Admin Configuration Panel | Admin panel for KYC rule management, notification templates, and user role/permission configuration | SCR-015 | KYC Rule Configuration | Admin | US-025 | KYC Rule Configuration Screen | Frontend | As a System Administrator / I want to configure KYC verification rules without code changes / So that business rule updates can be deployed instantly without a software release | Primary | Medium | Sprint-7 | To Do |
| 29 | EPIC-007 | Admin Configuration Panel | Admin panel for KYC rule management, notification templates, and user role/permission configuration | SCR-016 | Notification Template Management | Admin | US-026 | Notification Template Management Screen | Frontend | As a System Administrator / I want to create and edit notification templates / So that communication messages can be updated by business users without engineering involvement | Primary | Medium | Sprint-7 | To Do |
| 30 | EPIC-007 | Admin Configuration Panel | Admin panel for KYC rule management, notification templates, and user role/permission configuration | SCR-017 | User Role & Permission Management | Admin | US-027 | User Role and Permission Management Screen | Frontend | As a System Administrator / I want to assign and revoke user roles and permissions / So that access control is maintained accurately as team membership changes | Primary | Medium | Sprint-7 | To Do |
| 31 | EPIC-007 | Admin Configuration Panel | Admin panel for KYC rule management, notification templates, and user role/permission configuration | N/A | N/A | N/A | US-028 | Admin Configuration Backend API | Backend | As an Admin Backend Service / I want to expose secure APIs for KYC rule, template, and permission management / So that the Admin panel can read and write configuration with full audit logging | Primary | High | Sprint-7 | To Do |

---

## 2. RTM Summary — User Stories per EPIC

| EPIC ID | EPIC Name | Phase | Total Stories | Frontend | Backend | Integration | User Story IDs |
|---------|-----------|-------|---------------|----------|---------|-------------|----------------|
| EPIC-001 | Customer Registration & KYC Verification | Phase 1 | 6 | 4 | 2 | 0 | US-001, US-002, US-003, US-004, US-005, US-006 |
| EPIC-002 | Document Upload & Verification | Phase 1 | 5 | 3 | 1 | 1 | US-007, US-008, US-009, US-010, US-011 |
| EPIC-003 | Account Provisioning | Phase 1 | 3 | 1 | 1 | 1 | US-012, US-013, US-014 |
| EPIC-004 | Notification & Communication Hub | Phase 1 | 2 | 1 | 1 | 0 | US-015, US-016 |
| EPIC-005 | Identity & Access Management | Phase 1 | 4 | 3 | 1 | 0 | US-017, US-018, US-019, US-020 |
| EPIC-006 | Operations Exception Dashboard & Reporting | Phase 2 | 4 | 3 | 1 | 0 | US-021, US-022, US-023, US-024 |
| EPIC-007 | Admin Configuration Panel | Phase 2 | 4 | 3 | 1 | 0 | US-025, US-026, US-027, US-028 |
| **TOTAL** | — | — | **28** | **18** | **8** | **2** | — |

---

## 3. RTM Summary — User Stories per Screen

| Screen ID | Screen Name | Screen Type | Total User Stories | User Story IDs | EPIC IDs |
|-----------|-------------|-------------|-------------------|----------------|----------|
| SCR-001 | Portal Landing Page | Customer-facing | 1 | US-001 | EPIC-001 |
| SCR-002 | Personal Details — Registration Step 1 | Customer-facing | 3 | US-001, US-002, US-003 | EPIC-001 |
| SCR-003 | Address Details — Registration Step 2 | Customer-facing | 1 | US-001 | EPIC-001 |
| SCR-004 | Document Upload — Registration Step 3 | Customer-facing | 2 | US-001, US-007 | EPIC-001, EPIC-002 |
| SCR-005 | Registration Confirmation | Customer-facing | 1 | US-001 | EPIC-001 |
| SCR-006 | KYC Verification Status | Customer-facing | 3 | US-004, US-008, US-009 | EPIC-001, EPIC-002 |
| SCR-007 | KYC Manual Review — Back Office | Operations | 1 | US-009 | EPIC-002 |
| SCR-008 | Account Activation Confirmation | Customer-facing | 1 | US-012 | EPIC-003 |
| SCR-009 | Notification Preferences | Customer-facing | 1 | US-015 | EPIC-004 |
| SCR-010 | Customer Login | Customer-facing | 2 | US-017, US-018 | EPIC-005 |
| SCR-011 | MFA / OTP Verification | Customer-facing | 1 | US-019 | EPIC-005 |
| SCR-012 | Operations Exception Queue | Operations | 1 | US-021 | EPIC-006 |
| SCR-013 | Application Detail — Manual Review | Operations | 1 | US-022 | EPIC-006 |
| SCR-014 | Reporting & Analytics Dashboard | Operations | 1 | US-023 | EPIC-006 |
| SCR-015 | KYC Rule Configuration | Admin | 1 | US-025 | EPIC-007 |
| SCR-016 | Notification Template Management | Admin | 1 | US-026 | EPIC-007 |
| SCR-017 | User Role & Permission Management | Admin | 1 | US-027 | EPIC-007 |

> **Shared Screens — Design Review Required:**
>
> | Screen ID | Screen Name | Shared By | Risk |
> |-----------|-------------|-----------|------|
> | SCR-002 | Personal Details — Step 1 | US-001 (form), US-002 (error state), US-003 (OTP panel) | Three different story requirements on one screen — wireframe must handle all states |
> | SCR-004 | Document Upload — Step 3 | US-001 (registration flow) and US-007 (document upload feature) | Shared entry point — registration context and upload feature must not conflict |
> | SCR-006 | KYC Verification Status | US-004, US-008, US-009 | Three states (in-progress, re-submission prompt, ops-view) must coexist in one screen design |

---

## 4. RTM Summary — Screen Coverage per EPIC

| EPIC ID | EPIC Name | Total Screens | Screen IDs | Stories With Screen (Frontend) | Stories Without Screen (Backend / Integration) |
|---------|-----------|---------------|------------|-------------------------------|-----------------------------------------------|
| EPIC-001 | Customer Registration & KYC Verification | 5 | SCR-001, SCR-002, SCR-003, SCR-005, SCR-006 | 4 (US-001, US-002, US-003, US-004) | 2 (US-005, US-006) |
| EPIC-002 | Document Upload & Verification | 3 | SCR-004, SCR-006, SCR-007 | 3 (US-007, US-008, US-009) | 2 (US-010, US-011) |
| EPIC-003 | Account Provisioning | 1 | SCR-008 | 1 (US-012) | 2 (US-013, US-014) |
| EPIC-004 | Notification & Communication Hub | 1 | SCR-009 | 1 (US-015) | 1 (US-016) |
| EPIC-005 | Identity & Access Management | 2 | SCR-010, SCR-011 | 3 (US-017, US-018, US-019) | 1 (US-020) |
| EPIC-006 | Operations Exception Dashboard | 3 | SCR-012, SCR-013, SCR-014 | 3 (US-021, US-022, US-023) | 1 (US-024) |
| EPIC-007 | Admin Configuration Panel | 3 | SCR-015, SCR-016, SCR-017 | 3 (US-025, US-026, US-027) | 1 (US-028) |
| **TOTAL** | — | **17 unique** | — | **18 Frontend** | **10 Backend / Integration** |

---

## 5. Coverage Gap Analysis

| Gap ID | Gap Type | EPIC ID | Screen ID | User Story ID | Description | Action Required | Assigned To | Target Date | Status |
|--------|----------|---------|-----------|---------------|-------------|-----------------|-------------|-------------|--------|
| GAP-001 | Missing Wireframe | EPIC-001 | SCR-003 | US-001 | Screen Wireframe document for SCR-003 (Address Details — Step 2) not yet created | Create Screen Wireframe for SCR-003 per Screen-Wireframe-Template | Business Analyst | 01-Apr-2026 | Open |
| GAP-002 | Missing Wireframe | EPIC-001 | SCR-005 | US-001 | Screen Wireframe document for SCR-005 (Registration Confirmation) not yet created | Create Screen Wireframe for SCR-005 including reference number display and next steps | Business Analyst | 01-Apr-2026 | Open |
| GAP-003 | Missing Wireframe | EPIC-001, EPIC-002 | SCR-006 | US-004, US-008, US-009 | Screen Wireframe for SCR-006 (KYC Verification Status) must handle three distinct story states | Design all three states in one wireframe: in-progress, re-submission prompt, escalated view | UX Designer | 05-Apr-2026 | Open |
| GAP-004 | Shared Screen Conflict | EPIC-001 | SCR-002 | US-001, US-002, US-003 | SCR-002 is shared by three User Stories with different content requirements (form, error state, OTP panel). Risk of wireframe inconsistency. | Schedule design review with UX; ensure all three states are captured in SCR-002 wireframe with clear state machine | UX Designer + BA | 05-Apr-2026 | Open |
| GAP-005 | Shared Screen Conflict | EPIC-001, EPIC-002 | SCR-004 | US-001, US-007 | SCR-004 is the entry point for both the registration flow (EPIC-001) and the document upload feature (EPIC-002). Context differences must be handled. | Clarify with PO whether SCR-004 is a single screen with context-aware behaviour or two separate screens | Product Owner | 01-Apr-2026 | Open |
| GAP-006 | Sprint Not Assigned | EPIC-006 | SCR-012 to SCR-014 | US-021 to US-024 | EPIC-006 stories have Sprint-5 allocated but Phase 2 scope is not yet sprint-planned. Sprint allocation is a placeholder. | Confirm Phase 2 sprint plan after Phase 1 go-live date is locked | Delivery Manager | 30-Apr-2026 | Open |
| GAP-007 | Missing Wireframe | EPIC-006 | SCR-012 | US-021 | Wireframe for SCR-012 (Operations Exception Queue) not yet created | Create Operations Exception Queue wireframe including filters, SLA indicators, and action buttons | Business Analyst | 15-May-2026 | Open |
| GAP-008 | Missing Wireframe | EPIC-007 | SCR-015, SCR-016, SCR-017 | US-025, US-026, US-027 | Wireframes for all three Admin screens not yet created | Create Admin panel wireframes for KYC Rules, Notification Templates, and Role Management | Business Analyst | 20-May-2026 | Open |

---

## Revision History

```
| Version | Date         | Author              | Changes Made                                             | Approved By     |
|---------|--------------|---------------------|----------------------------------------------------------|-----------------|
| 1.0     | 26-Mar-2026  | Business Analyst    | Initial RTM — 7 EPICs, 17 screens, 28 User Stories mapped| Product Owner   |
```

---

*Template Version: 1.0 | Last Reviewed: 26-Mar-2026*

# User Story SubTask — Requirements Traceability Matrix (RTM) Template

> **Document Flow:** BRD → FRD → Initiative → EPIC → User Story → **SubTask RTM**
>
> **Purpose:** This RTM (Requirements Traceability Matrix) provides a single consolidated
> view that traces every SubTask back through its parent User Story to its parent EPIC.
> It enables teams to:
> - Verify that every SubTask has a valid lineage to a business requirement
> - Identify which screens, flows, and story types each SubTask belongs to
> - Track delivery completeness — ensuring no SubTask is orphaned or duplicated
> - Support sprint planning, QA coverage mapping, and release sign-off
>
> **Relationship Rules:**
> - One EPIC → Many User Stories
> - One User Story → Many SubTasks
> - Each row in this RTM represents exactly **one SubTask**
> - EPIC and User Story columns repeat across rows that share the same parent
>
> **How to read this matrix:**
> - Rows sharing the same User Story ID belong to the same User Story
> - Rows sharing the same EPIC ID belong to the same EPIC
> - Screen ID and Screen Description are populated for Frontend stories only
> - For Backend and Integration stories, Screen ID and Screen Description are N/A

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RTM ID          : RTM-[XXX]
EPIC ID         : EPIC-[XXX]
Created Date    : DD-MMM-YYYY
Last Updated    : DD-MMM-YYYY
Prepared By     : [Name / Role]
Version         : [vX.X]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Column Definitions

> **Guideline:** Understand each column before filling in the RTM.
> Every column must be completed for each row. Use N/A only where explicitly permitted.

| Column | Description | Allowed Values / Format |
| --- | --- | --- |
| **Sr No** | Sequential row number across the entire RTM | 1, 2, 3 … |
| **EPIC ID** | ID of the parent EPIC this SubTask traces to | EPIC-[XXX] |
| **EPIC Description** | One-line description of the EPIC's purpose | Free text — max 1 sentence |
| **User Story ID** | ID of the User Story this SubTask belongs to | US-[XXX] |
| **User Story Type** | The type classification of the parent User Story | Frontend / Backend / Integration |
| **Screen ID** | ID of the screen this SubTask works on (Frontend only) | SCR-[XXX] or N/A |
| **Screen Description** | Brief description of the screen (Frontend only) | Free text or N/A |
| **Flow** | Whether the parent User Story follows a Primary or Alternate flow | Primary / Alternate |
| **User Story Description** | The full "As a / I want / So that" statement of the parent User Story | As a… / I want… / So that… |
| **SubTask ID** | Unique ID of the SubTask scoped within its User Story | ST-[XXX] |
| **SubTask Description** | Clear, action-oriented description of the work unit | Starts with a verb |

---

## RTM Table — Template

> **Guideline:** Each row = one SubTask. Repeat EPIC and User Story columns across
> rows that share the same parent. For Frontend stories, populate Screen ID and Screen
> Description with the specific screen this SubTask primarily relates to.
> For SubTasks that span multiple screens (e.g., a navigation component), list the
> primary screen in Screen ID and note others in Screen Description.

```
| Sr No | EPIC ID   | EPIC Description                                    | User Story ID | User Story Type | Screen ID | Screen Description                          | Flow      | User Story Description                                                 | SubTask ID | SubTask Description                                        |
|-------|-----------|-----------------------------------------------------|---------------|-----------------|-----------|---------------------------------------------|-----------|------------------------------------------------------------------------|------------|------------------------------------------------------------|
| 1     | EPIC-[XXX]| [One-line description of the EPIC]                  | US-[XXX]      | Frontend        | SCR-[XXX] | [Brief description of the screen]           | Primary   | As a [Actor] / I want [Goal] / So that [Benefit]                       | ST-001     | [Action-oriented SubTask description]                      |
| 2     | EPIC-[XXX]| [One-line description of the EPIC]                  | US-[XXX]      | Frontend        | SCR-[XXX] | [Brief description of the screen]           | Primary   | As a [Actor] / I want [Goal] / So that [Benefit]                       | ST-002     | [Action-oriented SubTask description]                      |
| 3     | EPIC-[XXX]| [One-line description of the EPIC]                  | US-[XXX]      | Backend         | N/A       | N/A                                         | Primary   | As a [Actor] / I want [Goal] / So that [Benefit]                       | ST-001     | [Action-oriented SubTask description]                      |
| 4     | EPIC-[XXX]| [One-line description of the EPIC]                  | US-[YYY]      | Integration     | N/A       | N/A                                         | Primary   | As a [Actor] / I want [Goal] / So that [Benefit]                       | ST-001     | [Action-oriented SubTask description]                      |
```

---

## Usage Notes

> - **Screen ID for multi-screen SubTasks:** If a SubTask spans multiple screens
>   (e.g., a progress bar component shared across Step 1, Step 2, Step 3), enter the
>   primary screen in Screen ID and list additional screens in the Screen Description
>   column with a note such as "Shared across SCR-002, SCR-003, SCR-004".
>
> - **Testing SubTasks:** Unit and integration test SubTasks may have Screen ID = N/A
>   even for Frontend stories, since tests are not tied to a specific screen at runtime.
>   In this case, enter "N/A — Testing SubTask" in Screen Description.
>
> - **Alternate Scenario stories:** Set Flow = "Alternate" and reference the parent
>   Primary Flow story in the User Story Description if helpful for traceability.
>
> - **Sorting:** The RTM should be sorted by EPIC ID → User Story ID → SubTask ID
>   to maintain consistent readability and grouping.

---

## Revision History

```
| Version | Date         | Author         | Changes Made                              |
|---------|--------------|----------------|-------------------------------------------|
| 1.0     | DD-MMM-YYYY  | [Author Name]  | Initial RTM draft                         |
| 1.1     | DD-MMM-YYYY  | [Author Name]  | [Brief description of changes]            |
```

---

*Template Version: 1.0 | Last Reviewed: 25-Mar-2026*

---
---

# EXAMPLE — User Story SubTask RTM

> **EPIC:** EPIC-001 — Customer Registration & KYC Verification
> **Initiative:** INIT-001 — Unified Digital Onboarding Platform
>
> This RTM covers all SubTasks across all four User Stories of EPIC-001:
>
> | User Story | Type | Flow |
> | --- | --- | --- |
> | US-001 — Multi-Step Customer Registration Form | Frontend | Primary |
> | US-002 — Registration Form — Duplicate Email Error and Recovery | Frontend | Alternate |
> | US-003 — Draft Customer Record Creation — Backend API | Backend | Primary |
> | US-004 — Third-Party KYC API — Identity Verification Integration | Integration | Primary |

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RTM ID          : RTM-001
EPIC ID         : EPIC-001
Created Date    : 25-Mar-2026
Last Updated    : 25-Mar-2026
Prepared By     : Product Owner / BA Team
Version         : v1.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

| Sr No | EPIC ID | EPIC Description | User Story ID | User Story Type | Screen ID | Screen Description | Flow | User Story Description | SubTask ID | SubTask Description |
|-------|---------|------------------|---------------|-----------------|-----------|--------------------|------|------------------------|------------|---------------------|
| 1 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-001 | Frontend | SCR-001 | Landing Page — Public-facing page with "Register Now" CTA; entry point to the flow | Primary | As a New Customer / I want to complete a multi-step registration form / So that I can create my account and proceed to KYC verification | ST-001 | Create HTML/CSS structure for the 3-step registration form with step progress indicator |
| 2 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-001 | Frontend | SCR-002 | Personal Details — Step 1 of 3: captures name, DOB, email, mobile, gender | Primary | As a New Customer / I want to complete a multi-step registration form / So that I can create my account and proceed to KYC verification | ST-002 | Implement client-side field validation for Step 1 — Personal Details (mandatory, format, age check) |
| 3 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-001 | Frontend | SCR-003 | Address Details — Step 2 of 3: captures address, city, state, PIN code, country | Primary | As a New Customer / I want to complete a multi-step registration form / So that I can create my account and proceed to KYC verification | ST-003 | Implement client-side field validation for Step 2 — Address Details (mandatory fields, PIN format, State reference list) |
| 4 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-001 | Frontend | SCR-002 | Personal Details — shared across Step 1, Step 2, Step 3 via navigation component | Primary | As a New Customer / I want to complete a multi-step registration form / So that I can create my account and proceed to KYC verification | ST-004 | Implement step navigation logic (Next / Back) with form state preservation across all steps |
| 5 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-001 | Frontend | SCR-002 | Personal Details — Shared across SCR-002, SCR-003, SCR-004; resume from any step | Primary | As a New Customer / I want to complete a multi-step registration form / So that I can create my account and proceed to KYC verification | ST-005 | Implement form save-and-resume functionality (72-hour persistence via session/local storage) |
| 6 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-001 | Frontend | SCR-004 | Review & Submit — Step 3 of 3: read-only summary of all entered data with final submit action | Primary | As a New Customer / I want to complete a multi-step registration form / So that I can create my account and proceed to KYC verification | ST-006 | Integrate form Submit button with US-003 backend API; handle success (201) and error (4xx/5xx) responses |
| 7 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-001 | Frontend | SCR-005 | Registration Success — Confirmation screen after submission; redirects to Document Upload page | Primary | As a New Customer / I want to complete a multi-step registration form / So that I can create my account and proceed to KYC verification | ST-007 | Implement redirect to Document Upload page (US-007) on successful 201 response from backend |
| 8 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-001 | Frontend | N/A | N/A — Testing SubTask (not tied to a specific runtime screen) | Primary | As a New Customer / I want to complete a multi-step registration form / So that I can create my account and proceed to KYC verification | ST-008 | Write unit tests for all client-side validation functions (Step 1 and Step 2) |
| 9 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-001 | Frontend | N/A | N/A — Testing SubTask (not tied to a specific runtime screen) | Primary | As a New Customer / I want to complete a multi-step registration form / So that I can create my account and proceed to KYC verification | ST-009 | Write integration tests for full form submit → API → redirect flow |
| 10 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-001 | Frontend | SCR-002 | Personal Details — Accessibility verified across SCR-002, SCR-003, SCR-004 | Primary | As a New Customer / I want to complete a multi-step registration form / So that I can create my account and proceed to KYC verification | ST-010 | Verify WCAG 2.1 AA accessibility compliance across all three form steps (keyboard navigation, screen reader) |
| 11 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-002 | Frontend | SCR-002E | Personal Details (Error State) — Step 1 in error state with Email field highlighted and recovery buttons | Alternate | As a New Customer / I want to be clearly informed when my email is already registered / So that I can recover or continue with a different email without contacting support | ST-001 | Implement error state handler for HTTP 409 Conflict response received from US-003 backend API |
| 12 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-002 | Frontend | SCR-002E | Personal Details (Error State) — Email field highlighted red with inline error message displayed | Alternate | As a New Customer / I want to be clearly informed when my email is already registered / So that I can recover or continue with a different email without contacting support | ST-002 | Apply red highlight styling to Email field and display inline error message on HTTP 409 response |
| 13 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-002 | Frontend | SCR-002E | Personal Details (Error State) — "Use a Different Email" recovery button clears field, retains other data | Alternate | As a New Customer / I want to be clearly informed when my email is already registered / So that I can recover or continue with a different email without contacting support | ST-003 | Implement "Use a Different Email" button — clear Email field, retain all other form field values |
| 14 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-002 | Frontend | SCR-002E | Personal Details (Error State) — "Log In to Existing Account" button redirects to Login page with email pre-filled | Alternate | As a New Customer / I want to be clearly informed when my email is already registered / So that I can recover or continue with a different email without contacting support | ST-004 | Implement "Log In to Existing Account" button — redirect to US-010 Login page with duplicate email as URL parameter |
| 15 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-002 | Frontend | SCR-002E | Personal Details (Error State) — Coordinates with Login page (US-010) to pre-fill email from URL param | Alternate | As a New Customer / I want to be clearly informed when my email is already registered / So that I can recover or continue with a different email without contacting support | ST-005 | Implement email pre-fill on Login page (US-010) from URL parameter — coordinate with US-010 developer |
| 16 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-002 | Frontend | N/A | N/A — Testing SubTask (not tied to a specific runtime screen) | Alternate | As a New Customer / I want to be clearly informed when my email is already registered / So that I can recover or continue with a different email without contacting support | ST-006 | Write unit tests for the HTTP 409 error handler and both recovery path functions |
| 17 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-002 | Frontend | N/A | N/A — Testing SubTask (not tied to a specific runtime screen) | Alternate | As a New Customer / I want to be clearly informed when my email is already registered / So that I can recover or continue with a different email without contacting support | ST-007 | Write end-to-end test for duplicate email scenario — covers both recovery paths (re-enter email and login redirect) |
| 18 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-003 | Backend | N/A | N/A — Backend User Story; no UI screens | Primary | As a Registration Backend Service / I want to receive and persist customer registration data / So that details are securely stored and available for the KYC verification flow | ST-001 | Create POST /api/v1/registrations endpoint with request/response contract definition |
| 19 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-003 | Backend | N/A | N/A — Backend User Story; no UI screens | Primary | As a Registration Backend Service / I want to receive and persist customer registration data / So that details are securely stored and available for the KYC verification flow | ST-002 | Implement server-side payload validation (required fields, data types, format checks) |
| 20 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-003 | Backend | N/A | N/A — Backend User Story; no UI screens | Primary | As a Registration Backend Service / I want to receive and persist customer registration data / So that details are securely stored and available for the KYC verification flow | ST-003 | Implement business rule validations (age >= 18 check, email uniqueness, mobile uniqueness) |
| 21 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-003 | Backend | N/A | N/A — Backend User Story; no UI screens | Primary | As a Registration Backend Service / I want to receive and persist customer registration data / So that details are securely stored and available for the KYC verification flow | ST-004 | Create customer_draft database table with all columns, indexes, unique constraints, and foreign keys |
| 22 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-003 | Backend | N/A | N/A — Backend User Story; no UI screens | Primary | As a Registration Backend Service / I want to receive and persist customer registration data / So that details are securely stored and available for the KYC verification flow | ST-005 | Implement INSERT logic with UUID generation and expires_at = created_at + 72 hours calculation |
| 23 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-003 | Backend | N/A | N/A — Backend User Story; no UI screens | Primary | As a Registration Backend Service / I want to receive and persist customer registration data / So that details are securely stored and available for the KYC verification flow | ST-006 | Implement HTTP response structure — 201 on success; 400 / 409 / 422 on failure with structured error codes |
| 24 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-003 | Backend | N/A | N/A — Testing SubTask | Primary | As a Registration Backend Service / I want to receive and persist customer registration data / So that details are securely stored and available for the KYC verification flow | ST-007 | Write unit tests for all validation functions and business rules (age, uniqueness, format) |
| 25 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-003 | Backend | N/A | N/A — Testing SubTask | Primary | As a Registration Backend Service / I want to receive and persist customer registration data / So that details are securely stored and available for the KYC verification flow | ST-008 | Write integration tests for the full endpoint against a real test database |
| 26 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-003 | Backend | N/A | N/A — Documentation SubTask | Primary | As a Registration Backend Service / I want to receive and persist customer registration data / So that details are securely stored and available for the KYC verification flow | ST-009 | Create and publish OpenAPI / Swagger specification for the registration endpoint (for US-001 and US-007 consumers) |
| 27 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-004 | Integration | N/A | N/A — Integration User Story; no UI screens | Primary | As a KYC Integration Service / I want to send identity data to the third-party KYC API and receive a verification status / So that customer identity is verified automatically enabling instant account activation | ST-001 | Implement queue consumer to read READY_FOR_VERIFICATION messages from the kyc_request message queue |
| 28 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-004 | Integration | N/A | N/A — Integration User Story; no UI screens | Primary | As a KYC Integration Service / I want to send identity data to the third-party KYC API and receive a verification status / So that customer identity is verified automatically enabling instant account activation | ST-002 | Build KYC vendor API adapter — request construction, authentication, and response parsing per vendor API contract v1.2 |
| 29 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-004 | Integration | N/A | N/A — Integration User Story; no UI screens | Primary | As a KYC Integration Service / I want to send identity data to the third-party KYC API and receive a verification status / So that customer identity is verified automatically enabling instant account activation | ST-003 | Implement retry logic with exponential backoff — maximum 3 retries for timeout and 5xx errors |
| 30 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-004 | Integration | N/A | N/A — Integration User Story; no UI screens | Primary | As a KYC Integration Service / I want to send identity data to the third-party KYC API and receive a verification status / So that customer identity is verified automatically enabling instant account activation | ST-004 | Implement VERIFIED response handler — update kyc_request status, update customer_draft status to PENDING_ACTIVATION, publish CUSTOMER_VERIFIED event |
| 31 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-004 | Integration | N/A | N/A — Integration User Story; no UI screens | Primary | As a KYC Integration Service / I want to send identity data to the third-party KYC API and receive a verification status / So that customer identity is verified automatically enabling instant account activation | ST-005 | Implement FAILED response handler — update kyc_request status to FAILED, insert record into ops_review_queue |
| 32 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-004 | Integration | N/A | N/A — Integration User Story; no UI screens | Primary | As a KYC Integration Service / I want to send identity data to the third-party KYC API and receive a verification status / So that customer identity is verified automatically enabling instant account activation | ST-006 | Implement audit logging — store full request and response payloads in kyc_request.request_payload and kyc_request.response_payload |
| 33 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-004 | Integration | N/A | N/A — Infrastructure / DevOps SubTask | Primary | As a KYC Integration Service / I want to send identity data to the third-party KYC API and receive a verification status / So that customer identity is verified automatically enabling instant account activation | ST-007 | Configure on-call alert for MANUAL_REVIEW escalations — alert must fire within 2 minutes of escalation |
| 34 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-004 | Integration | N/A | N/A — Testing SubTask | Primary | As a KYC Integration Service / I want to send identity data to the third-party KYC API and receive a verification status / So that customer identity is verified automatically enabling instant account activation | ST-008 | Write unit tests for the API adapter, retry logic, VERIFIED handler, and FAILED handler |
| 29 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-004 | Integration | N/A | N/A — Testing SubTask | Primary | As a KYC Integration Service / I want to send identity data to the third-party KYC API and receive a verification status / So that customer identity is verified automatically enabling instant account activation | ST-009 | Write integration tests against the KYC vendor sandbox environment |
| 36 | EPIC-001 | End-to-end digital onboarding: registration, document upload, OCR, and KYC verification | US-004 | Integration | N/A | N/A — Testing SubTask | Primary | As a KYC Integration Service / I want to send identity data to the third-party KYC API and receive a verification status / So that customer identity is verified automatically enabling instant account activation | ST-010 | Perform end-to-end test of the full KYC flow: US-008 OCR output → queue → this story → US-005 account activation |

---

## RTM Summary

> Quick reference counts for this RTM to verify completeness.

| EPIC ID | User Story ID | User Story Type | Flow | Total SubTasks |
| --- | --- | --- | --- | --- |
| EPIC-001 | US-001 | Frontend | Primary | 10 |
| EPIC-001 | US-002 | Frontend | Alternate | 7 |
| EPIC-001 | US-003 | Backend | Primary | 9 |
| EPIC-001 | US-004 | Integration | Primary | 10 |
| **Total** | **4 User Stories** | — | — | **36 SubTasks** |

---

## Screen Coverage Summary

> Lists which screens have SubTask coverage — used to verify no screen is left
> without at least one implementation and one testing SubTask.

| Screen ID | Screen Name | User Story ID | SubTask IDs with Coverage |
| --- | --- | --- | --- |
| SCR-001 | Landing Page | US-001 | ST-001 |
| SCR-002 | Personal Details | US-001 | ST-001, ST-002, ST-004, ST-005, ST-010 |
| SCR-003 | Address Details | US-001 | ST-001, ST-003, ST-004, ST-010 |
| SCR-004 | Review & Submit | US-001 | ST-001, ST-004, ST-006, ST-010 |
| SCR-005 | Registration Success | US-001 | ST-007 |
| SCR-002E | Personal Details (Error State) | US-002 | ST-001, ST-002, ST-003, ST-004, ST-005 |
| N/A | Backend — No Screens | US-003 | ST-001 to ST-009 |
| N/A | Integration — No Screens | US-004 | ST-001 to ST-010 |

---

*RTM Template Version: 1.0 | Aligned to UserStory-Template v2.0 | Last Reviewed: 25-Mar-2026*

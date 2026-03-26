# SubTask Template Checklist

> **Document Flow:** BRD → FRD → Initiative → EPIC → User Story → **SubTask**
>
> This checklist is used to verify that a SubTask document is complete, consistent,
> and ready for sprint execution. Review every item before moving the SubTask from
> **To Do** to **In Progress**.
>
> **Status Values:**
> - `[ ]` — Not yet done
> - `[x]` — Complete
> - `[N/A]` — Not applicable (provide reason in parentheses)

---

## How to Use This Checklist

1. Complete the SubTask document first, then use this checklist to review it.
2. Work through each section sequentially.
3. Mark `[N/A]` only when a field genuinely does not apply — state why in parentheses.
4. All items in the **Final Readiness Gate** must be `[x]` before the SubTask is sprint-ready.
5. The **Sign-off** block at the end must be completed before the SubTask is handed off.

---

## SubTask Reference

```
SubTask ID      : ST-[XXX]
User Story ID   : US-[XXX]
EPIC ID         : EPIC-[XXX]
Checklist Date  : DD-MMM-YYYY
Reviewed By     : [Name / Role]
```

---

## Table of Contents

| # | Section |
| --- | --- |
| 0 | Header Block |
| 1 | EPIC Context |
| 2 | User Story Context |
| 3 | SubTask ID |
| 4 | SubTask Description |
| 5 | Steps |
| — | Revision History |
| CC | Cross-Section Consistency Checks |
| TS | Type-Specific Checks |
| G | Final Readiness Gate |

---

## Section 0 — Header Block

| # | Check | Status |
| --- | --- | --- |
| 0.1 | SubTask ID is filled in and follows the format `ST-[XXX]` (zero-padded, e.g., ST-001) | `[ ]` |
| 0.2 | User Story ID is filled in and references a valid User Story (e.g., US-001) | `[ ]` |
| 0.3 | EPIC ID is filled in and references the parent EPIC (e.g., EPIC-001) | `[ ]` |
| 0.4 | Created Date is filled in (DD-MMM-YYYY format) | `[ ]` |
| 0.5 | Last Updated date is filled in and is on or after Created Date | `[ ]` |
| 0.6 | Sprint is assigned (e.g., Sprint-01) | `[ ]` |
| 0.7 | Assigned To is filled in with a name or role | `[ ]` |
| 0.8 | Estimated Hours is filled in with a numeric value (not blank or TBD) | `[ ]` |
| 0.9 | Status is one of the allowed values: `To Do`, `In Progress`, `In Review`, `Done` | `[ ]` |

---

## Section 1 — EPIC Context

| # | Check | Status |
| --- | --- | --- |
| 1.1 | EPIC ID is filled in and matches the EPIC ID in the Header Block | `[ ]` |
| 1.2 | EPIC Description is filled in (not blank or placeholder text) | `[ ]` |
| 1.3 | EPIC Description is a single concise line describing the EPIC's purpose and scope | `[ ]` |
| 1.4 | EPIC ID and Description exactly match the parent EPIC document — no paraphrasing | `[ ]` |

---

## Section 2 — User Story Context

| # | Check | Status |
| --- | --- | --- |
| 2.1 | User Story ID is filled in and matches the User Story ID in the Header Block | `[ ]` |
| 2.2 | User Story Type is filled in and is one of: `Frontend`, `Backend`, `Integration` | `[ ]` |
| 2.3 | Screen ID is filled in as `SCR-[XXX]` for Frontend stories, or `N/A` for Backend/Integration | `[ ]` |
| 2.4 | Screen Description is filled in for Frontend stories, or `N/A` for Backend/Integration | `[ ]` |
| 2.5 | Screen Description (if applicable) is specific enough to identify the screen without opening a design tool | `[ ]` |
| 2.6 | Flow is filled in and is one of: `Primary`, `Alternate` | `[ ]` |
| 2.7 | User Story Description is filled in with all three As a / I want / So that fields | `[ ]` |
| 2.8 | "As a" identifies the actor or system performing the action | `[ ]` |
| 2.9 | "I want" clearly states the goal or capability being implemented | `[ ]` |
| 2.10 | "So that" clearly states the business benefit or outcome | `[ ]` |
| 2.11 | All User Story Context fields exactly match the parent User Story document — no paraphrasing | `[ ]` |

---

## Section 3 — SubTask ID

| # | Check | Status |
| --- | --- | --- |
| 3.1 | SubTask ID is filled in and follows the format `ST-[XXX]` | `[ ]` |
| 3.2 | Full Reference is provided in the format `US-[XXX] / ST-[XXX]` | `[ ]` |
| 3.3 | SubTask ID is unique within the parent User Story (no duplicate ST numbers for the same US) | `[ ]` |
| 3.4 | SubTask ID matches the SubTask ID in the Header Block | `[ ]` |

---

## Section 4 — SubTask Description

| # | Check | Status |
| --- | --- | --- |
| 4.1 | Description is filled in (not blank or placeholder) | `[ ]` |
| 4.2 | Description begins with an action verb (Implement, Create, Build, Configure, Write, Integrate, etc.) | `[ ]` |
| 4.3 | Description is specific enough to understand the full scope without reading the Steps section | `[ ]` |
| 4.4 | Description identifies the specific component, screen, endpoint, or system being worked on | `[ ]` |
| 4.5 | Description scope is completable by one person within a single sprint | `[ ]` |
| 4.6 | Description does not duplicate another SubTask in the same User Story | `[ ]` |
| 4.7 | Description mentions the relevant Business Rules, if applicable (e.g., BR-04 age check) | `[ ]` |

---

## Section 5 — Steps

### 5A — Steps Table Completeness

| # | Check | Status |
| --- | --- | --- |
| 5A.1 | At least one step is documented | `[ ]` |
| 5A.2 | Each step has a Step ID in the format `STEP-[NNN]` (e.g., STEP-001, STEP-002) | `[ ]` |
| 5A.3 | Step IDs are sequential with no gaps or duplicates | `[ ]` |
| 5A.4 | Each step has a non-empty Step Description (not "TBD" or placeholder text) | `[ ]` |
| 5A.5 | Steps are ordered logically — later steps do not depend on steps that appear after them | `[ ]` |
| 5A.6 | The last step produces a clearly testable or deliverable output | `[ ]` |

### 5B — Step Description Quality

| # | Check | Status |
| --- | --- | --- |
| 5B.1 | Each step specifies the exact file, component, class, function, or system to work on | `[ ]` |
| 5B.2 | Each step describes the expected output or result of completing the step | `[ ]` |
| 5B.3 | Steps are written at production implementation level — not POC or prototype level | `[ ]` |
| 5B.4 | Steps include relevant code patterns, function signatures, or data schemas where applicable | `[ ]` |
| 5B.5 | Steps include conditions, constraints, or dependencies that apply at each step | `[ ]` |
| 5B.6 | Error handling requirements are explicitly mentioned where relevant (not left to developer judgment) | `[ ]` |
| 5B.7 | Logging requirements are specified where the application logs must record an action | `[ ]` |
| 5B.8 | Steps do not reference external URLs, design tools, or documents that may be unavailable | `[ ]` |
| 5B.9 | Steps reference specific Business Rules by ID (e.g., BR-04) where the rule drives implementation logic | `[ ]` |
| 5B.10 | A unit test or verification step is included as the final or second-to-last step | `[ ]` |

### 5C — Frontend-Specific Step Checks

> *Complete this section only if User Story Type = Frontend. Otherwise mark all as `[N/A]`.*

| # | Check | Status |
| --- | --- | --- |
| 5C.1 | Steps reference the correct Screen ID (e.g., SCR-002) from the User Story Context | `[ ]` |
| 5C.2 | Steps specify the component file path (e.g., `src/components/registration/PersonalDetailsStep.jsx`) | `[ ]` |
| 5C.3 | Validation logic is implemented in a separate utility/service module, not embedded in the component | `[ ]` |
| 5C.4 | Validation function contracts are defined (input parameter, return type/shape) | `[ ]` |
| 5C.5 | Steps cover both the "Next/Submit button" validation trigger and the "on blur" real-time trigger | `[ ]` |
| 5C.6 | Steps cover error clearing on re-input (stale error messages are removed as the user types) | `[ ]` |
| 5C.7 | Error display mechanism is specified (inline beneath field, error CSS class, colour) | `[ ]` |
| 5C.8 | Mandatory vs optional field distinction is explicit in the steps (mandatory validated, optional excluded) | `[ ]` |
| 5C.9 | Steps note any validations intentionally excluded and the Business Rule that permits the exclusion | `[ ]` |
| 5C.10 | Steps include a linter check or code quality verification at the end | `[ ]` |

### 5D — Backend-Specific Step Checks

> *Complete this section only if User Story Type = Backend. Otherwise mark all as `[N/A]`.*

| # | Check | Status |
| --- | --- | --- |
| 5D.1 | Steps reference the correct API endpoint (method + path, e.g., `POST /api/v1/registrations`) | `[ ]` |
| 5D.2 | Service class/module file path is specified | `[ ]` |
| 5D.3 | Each public method's contract is defined (method name, input parameters, return type/shape) | `[ ]` |
| 5D.4 | Parameterised queries are required for all database operations (SQL injection prevention explicit) | `[ ]` |
| 5D.5 | Database status filter conditions are explicitly listed (e.g., must exclude EXPIRED records) | `[ ]` |
| 5D.6 | Server time (UTC) is specified for date/time calculations — not client-provided time | `[ ]` |
| 5D.7 | HTTP error codes are specified for each failure scenario (e.g., 409 for duplicate, 422 for validation) | `[ ]` |
| 5D.8 | Structured error response schema is defined (field, errorCode, message) | `[ ]` |
| 5D.9 | Error response must not leak internal details (table names, stack traces, query text) | `[ ]` |
| 5D.10 | Execution pipeline order is specified (payload validation → business rules → DB insert) | `[ ]` |
| 5D.11 | Parallel execution is used for independent async operations (e.g., Promise.all for dual uniqueness checks) | `[ ]` |
| 5D.12 | PII fields are excluded from application log entries | `[ ]` |
| 5D.13 | Unit tests cover all branch cases including boundary values (e.g., exactly 18 years old today) | `[ ]` |

### 5E — Integration-Specific Step Checks

> *Complete this section only if User Story Type = Integration. Otherwise mark all as `[N/A]`.*

| # | Check | Status |
| --- | --- | --- |
| 5E.1 | An interface / abstract contract is defined before the concrete implementation | `[ ]` |
| 5E.2 | The interface method signature is specified (method name, input type, return type) | `[ ]` |
| 5E.3 | Concrete adapter class file path is specified | `[ ]` |
| 5E.4 | Configuration values (base URL, API key, timeout) are injected via constructor — not hardcoded | `[ ]` |
| 5E.5 | Configuration is loaded from environment variables, not from the adapter class itself | `[ ]` |
| 5E.6 | Request payload construction maps internal field names to vendor field names explicitly | `[ ]` |
| 5E.7 | Date format conversions (if any) are explicitly documented with source and target formats | `[ ]` |
| 5E.8 | Authentication header construction is separated into its own method | `[ ]` |
| 5E.9 | API key must never appear in any log output — this is explicitly stated in the steps | `[ ]` |
| 5E.10 | HTTP timeout is configurable (not hardcoded) and timeout errors propagate to the retry handler | `[ ]` |
| 5E.11 | Response parser handles all expected status values (VERIFIED, FAILED) and unexpected values (ERROR fallback) | `[ ]` |
| 5E.12 | Response parser returns a typed result object — never throws for known vendor response patterns | `[ ]` |
| 5E.13 | Audit persistence step is included (writing request + response payloads to audit table) | `[ ]` |
| 5E.14 | Audit DB write failure is caught and logged at ERROR level — must not silently fail | `[ ]` |
| 5E.15 | PII fields are excluded from application log entries — only non-PII identifiers (UUID, status) logged | `[ ]` |
| 5E.16 | Adapter is registered in the DI container / service factory at the end | `[ ]` |
| 5E.17 | Unit tests mock the HTTP client — do not connect to vendor sandbox in unit tests | `[ ]` |
| 5E.18 | Unit tests include a test case verifying PII does not appear in logs | `[ ]` |

---

## Revision History

| # | Check | Status |
| --- | --- | --- |
| RH.1 | Revision History table is present | `[ ]` |
| RH.2 | Version 1.0 entry exists with Created Date, Author, and "Initial draft" as the change description | `[ ]` |
| RH.3 | Every subsequent edit has a corresponding version entry | `[ ]` |
| RH.4 | Author field is filled in for each version row | `[ ]` |

---

## CC — Cross-Section Consistency Checks

> These checks verify that fields used in multiple sections remain consistent with each other.

| # | Check | Status |
| --- | --- | --- |
| CC.1 | SubTask ID in Section 3 matches SubTask ID in the Header Block | `[ ]` |
| CC.2 | User Story ID in Section 2 matches User Story ID in the Header Block | `[ ]` |
| CC.3 | EPIC ID in Section 1 matches EPIC ID in the Header Block | `[ ]` |
| CC.4 | User Story Type in Section 2 is consistent with the type-specific checks applied in Section 5 (5C/5D/5E) | `[ ]` |
| CC.5 | Screen ID in Section 2 is referenced correctly in the Steps section (for Frontend) or marked N/A (Backend/Integration) | `[ ]` |
| CC.6 | Flow in Section 2 (`Primary` or `Alternate`) is consistent with the scenario described in the Steps | `[ ]` |
| CC.7 | EPIC Description in Section 1 matches the EPIC Description in the parent EPIC document | `[ ]` |
| CC.8 | User Story Description in Section 2 (As a / I want / So that) matches the parent User Story document | `[ ]` |
| CC.9 | SubTask Description in Section 4 is reflected in the scope of the Steps in Section 5 — no gaps or extra scope | `[ ]` |
| CC.10 | Any Business Rules referenced in Section 4 or Section 5 are traceable to the parent User Story's Business Rules section | `[ ]` |
| CC.11 | Sprint in the Header Block matches the sprint the parent User Story is planned in | `[ ]` |
| CC.12 | Estimated Hours in the Header Block is consistent with the number and complexity of steps described | `[ ]` |

---

## TS — Type-Specific Applicability Summary

> Quick reference: which sections are Required (R) vs Not Applicable (N/A) per User Story Type.

| Section | Frontend | Backend | Integration |
| --- | --- | --- | --- |
| Header Block (Sec 0) | R | R | R |
| EPIC Context (Sec 1) | R | R | R |
| User Story Context (Sec 2) | R | R | R |
| — Screen ID | R | N/A | N/A |
| — Screen Description | R | N/A | N/A |
| SubTask ID (Sec 3) | R | R | R |
| SubTask Description (Sec 4) | R | R | R |
| Steps — General (5A, 5B) | R | R | R |
| Steps — Frontend-Specific (5C) | R | N/A | N/A |
| Steps — Backend-Specific (5D) | N/A | R | N/A |
| Steps — Integration-Specific (5E) | N/A | N/A | R |
| Revision History | R | R | R |

---

## G — Final Readiness Gate

> All 12 gate checks must be `[x]` before the SubTask is approved for sprint execution.
> A SubTask that fails any gate check must be returned to the author for remediation.

| # | Gate Check | Status |
| --- | --- | --- |
| G.1 | All Header Block fields (Section 0) are complete with no placeholders | `[ ]` |
| G.2 | EPIC Context (Section 1) values are verified against the parent EPIC document | `[ ]` |
| G.3 | User Story Context (Section 2) values are verified against the parent User Story document | `[ ]` |
| G.4 | SubTask ID (Section 3) is unique within the parent User Story | `[ ]` |
| G.5 | SubTask Description (Section 4) starts with an action verb and clearly describes the scope | `[ ]` |
| G.6 | All steps in Section 5 have non-empty, production-level descriptions (no TBD, no placeholder text) | `[ ]` |
| G.7 | All applicable type-specific checks (5C / 5D / 5E) are complete for the SubTask's User Story Type | `[ ]` |
| G.8 | A unit test or verification step is included in Section 5 | `[ ]` |
| G.9 | All Cross-Section Consistency Checks (CC.1–CC.12) are resolved | `[ ]` |
| G.10 | PII handling rules are addressed in the Steps section (fields never logged, only stored in encrypted audit table) | `[ ]` |
| G.11 | Revision History has at least a Version 1.0 entry | `[ ]` |
| G.12 | The SubTask scope is executable by one person within the assigned sprint given the estimated hours | `[ ]` |

---

## Sign-off

> The Author must complete this checklist before handoff.
> The Tech Lead must review and approve before sprint planning locks.

```
Author
  Name         :
  Role         :
  Date         :
  Signature    : [ ] I confirm all applicable checklist items are complete

Tech Lead Review
  Name         :
  Date         :
  Decision     : [ ] Approved for Sprint   [ ] Returned — remediation required
  Notes        :

QA Review (optional — for SubTasks that produce testable outputs)
  Name         :
  Date         :
  Decision     : [ ] Test cases can be derived from Steps   [ ] Steps need more detail
  Notes        :
```

---

*Checklist Version: 1.0 | Aligned to SubTask-Template v1.0 | Last Reviewed: 25-Mar-2026*

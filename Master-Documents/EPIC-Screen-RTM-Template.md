# EPIC–Screen Requirements Traceability Matrix (RTM)

> **Document Flow:** BRD → FRD → Initiative → EPIC → User Story → SubTask
> **Design Flow:** Screen Wireframe → High-Fidelity Mockup → UI Development
>
> This document is a Requirements Traceability Matrix that maps EPICs to the
> screens they involve. It provides a single view across the full delivery to answer:
>
> - Which screens does a given EPIC touch?
> - Which EPICs does a given screen belong to?
> - Are any screens unaccounted for in any EPIC?
> - Are any EPICs missing screen coverage?
>
> **Cardinality:**
> - One EPIC → One or more Screens
> - One Screen → One or more EPICs (a shared screen appears in multiple EPICs)
> - One row in this RTM = one EPIC–Screen relationship

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Initiative ID   : INIT-[XXX]
Initiative Name : [Initiative Name]
Created Date    : DD-MMM-YYYY
Last Updated    : DD-MMM-YYYY
Author          : [Name / Role]
Version         : 1.0
Status          : [ Draft | Under Review | Approved | Baselined ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Table of Contents

| # | Section |
| --- | --- |
| 1 | EPIC–Screen RTM |
| 2 | RTM Summary — Screens per EPIC |
| 3 | RTM Summary — EPICs per Screen |
| 4 | Coverage Gap Analysis |
| — | Usage Notes |
| — | Revision History |

---

## 1. EPIC–Screen RTM

> **Guideline:**
> - One row per EPIC–Screen pair. If EPIC-001 touches 5 screens, there are 5 rows for EPIC-001.
> - If a screen is shared across two EPICs, it appears once per EPIC (two rows with the same Screen ID).
> - Sort rows by EPIC ID first, then by Screen ID within each EPIC.
> - Screen Description should be a single concise line — the full description lives in the Screen Wireframe document.

| Sr No | EPIC ID | EPIC Description | Screen ID | Screen Name | Screen Description |
| --- | --- | --- | --- | --- | --- |
| 1 | EPIC-[XXX] | [One-line description of the EPIC] | SCR-[XXX] | [Screen Name] | [One-line description of what this screen does] |
| 2 | EPIC-[XXX] | [One-line description of the EPIC] | SCR-[XXX] | [Screen Name] | [One-line description of what this screen does] |

---

## 2. RTM Summary — Screens per EPIC

> **Guideline:** Count of unique screens associated with each EPIC.
> Use this table to verify that every EPIC has at least one screen assigned,
> and to identify EPICs that may have an unusually high or low screen count.

| EPIC ID | EPIC Description | Total Screens | Screen IDs |
| --- | --- | --- | --- |
| EPIC-[XXX] | [One-line description] | [N] | SCR-[XXX], SCR-[XXX], … |

---

## 3. RTM Summary — EPICs per Screen

> **Guideline:** Count of EPICs associated with each screen.
> A count > 1 means the screen is shared — flag it for design review to ensure
> the screen handles all EPIC-specific requirements without conflict.

| Screen ID | Screen Name | Total EPICs | EPIC IDs |
| --- | --- | --- | --- |
| SCR-[XXX] | [Screen Name] | [N] | EPIC-[XXX], EPIC-[XXX], … |

---

## 4. Coverage Gap Analysis

> **Guideline:** Use this section to flag any gaps or mismatches identified
> during RTM review. A gap is any EPIC without a screen, any screen without
> an EPIC, or any Screen Wireframe document that has not yet been created.

| Sr No | Gap Type | EPIC ID | Screen ID | Description | Action Required | Assigned To | Target Date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | [ EPIC without Screen \| Screen without EPIC \| Missing Wireframe \| Scope Change ] | EPIC-[XXX] or N/A | SCR-[XXX] or N/A | [Brief description of the gap] | [Action to close the gap] | [Name / Role] | DD-MMM-YYYY |

> **Gap Types:**
> - `EPIC without Screen` — An EPIC has been defined but no screen has been assigned to it yet
> - `Screen without EPIC` — A screen has been created but is not linked to any EPIC
> - `Missing Wireframe` — The EPIC–Screen link exists in this RTM but no Screen Wireframe document has been created for the Screen ID
> - `Scope Change` — A screen was removed from or added to an EPIC after baseline, requiring RTM update

---

## Usage Notes

> 1. **Baseline this document** once all EPICs and screens for an initiative are defined and approved.
>    Any addition or removal of a screen from an EPIC after baseline is a scope change and must
>    be recorded in Section 4 (Coverage Gap Analysis) with a justification.
>
> 2. **One row = one relationship.** Do not merge rows for a screen that belongs to multiple EPICs.
>    Keep them as separate rows so each relationship is independently traceable and auditable.
>
> 3. **Sort order:** Primary sort by EPIC ID ascending, secondary sort by Screen ID ascending within
>    each EPIC block. This makes it easy to scan all screens for a given EPIC in one view.
>
> 4. **Screen Description** in this RTM is intentionally brief (one line). The detailed description,
>    business rules, controls, and mockup all live in the corresponding `Screen-Wireframe-Template.md`
>    for that Screen ID.
>
> 5. **Cross-reference with UserStory-SubTask-RTM:** That RTM maps User Stories and SubTasks to
>    Screen IDs. This RTM maps EPICs to Screen IDs. Together they provide full traceability from
>    business requirement (EPIC) down to implementation task (SubTask) via the screen.

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

# EXAMPLE — INIT-001: Unified Digital Onboarding Platform

> This example covers **EPIC-001: Customer Registration & KYC Verification**
> from **Initiative INIT-001: Unified Digital Onboarding Platform**.
>
> The screens below represent the full customer-facing journey for registration,
> document upload, and KYC verification, plus the back-office screen used by
> operations staff to review flagged KYC cases.
>
> Screen inventory for this example:
>
> | Screen ID | Screen Name | Type |
> | --- | --- | --- |
> | SCR-001 | Portal Landing Page | Public — Unauthenticated |
> | SCR-002 | Personal Details — Registration Step 1 | Public — Unauthenticated |
> | SCR-003 | Address Details — Registration Step 2 | Public — Unauthenticated |
> | SCR-004 | Document Upload — Registration Step 3 | Public — Unauthenticated |
> | SCR-005 | Registration Confirmation | Public — Unauthenticated |
> | SCR-006 | KYC Verification Status | Authenticated — Customer |
> | SCR-007 | KYC Manual Review — Back Office | Authenticated — Operations Staff |

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Initiative ID   : INIT-001
Initiative Name : Unified Digital Onboarding Platform
Created Date    : 25-Mar-2026
Last Updated    : 25-Mar-2026
Author          : Business Analyst
Version         : 1.0
Status          : Approved
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 1. EPIC–Screen RTM

| Sr No | EPIC ID | EPIC Description | Screen ID | Screen Name | Screen Description |
| --- | --- | --- | --- | --- | --- |
| 1 | EPIC-001 | End-to-end digital onboarding covering customer registration, document upload, OCR extraction, and KYC verification | SCR-001 | Portal Landing Page | Entry point for new customers; presents the "Register Now" CTA that launches the registration wizard |
| 2 | EPIC-001 | End-to-end digital onboarding covering customer registration, document upload, OCR extraction, and KYC verification | SCR-002 | Personal Details — Registration Step 1 | Step 1 of 3 — collects First Name, Last Name, Date of Birth, Email, Mobile Number, and Gender |
| 3 | EPIC-001 | End-to-end digital onboarding covering customer registration, document upload, OCR extraction, and KYC verification | SCR-003 | Address Details — Registration Step 2 | Step 2 of 3 — collects residential address: Street, City, State, PIN Code, and Country |
| 4 | EPIC-001 | End-to-end digital onboarding covering customer registration, document upload, OCR extraction, and KYC verification | SCR-004 | Document Upload — Registration Step 3 | Step 3 of 3 — allows the customer to upload a government-issued identity document (Aadhaar, PAN, Passport) for OCR extraction and KYC |
| 5 | EPIC-001 | End-to-end digital onboarding covering customer registration, document upload, OCR extraction, and KYC verification | SCR-005 | Registration Confirmation | Displays a success message and customer reference number after all three registration steps are completed and the draft record is persisted |
| 6 | EPIC-001 | End-to-end digital onboarding covering customer registration, document upload, OCR extraction, and KYC verification | SCR-006 | KYC Verification Status | Authenticated dashboard screen showing the customer's current KYC verification status: Pending / Verified / Failed, with action prompts for re-submission on failure |
| 7 | EPIC-001 | End-to-end digital onboarding covering customer registration, document upload, OCR extraction, and KYC verification | SCR-007 | KYC Manual Review — Back Office | Back-office screen for Operations staff to review KYC cases flagged for manual verification; displays extracted document data alongside the uploaded document image |

---

## 2. RTM Summary — Screens per EPIC

| EPIC ID | EPIC Description | Total Screens | Screen IDs |
| --- | --- | --- | --- |
| EPIC-001 | End-to-end digital onboarding covering customer registration, document upload, OCR extraction, and KYC verification | 7 | SCR-001, SCR-002, SCR-003, SCR-004, SCR-005, SCR-006, SCR-007 |

---

## 3. RTM Summary — EPICs per Screen

| Screen ID | Screen Name | Total EPICs | EPIC IDs |
| --- | --- | --- | --- |
| SCR-001 | Portal Landing Page | 1 | EPIC-001 |
| SCR-002 | Personal Details — Registration Step 1 | 1 | EPIC-001 |
| SCR-003 | Address Details — Registration Step 2 | 1 | EPIC-001 |
| SCR-004 | Document Upload — Registration Step 3 | 1 | EPIC-001 |
| SCR-005 | Registration Confirmation | 1 | EPIC-001 |
| SCR-006 | KYC Verification Status | 1 | EPIC-001 |
| SCR-007 | KYC Manual Review — Back Office | 1 | EPIC-001 |

> **Note on Shared Screens:** In this single-EPIC example all screens are owned exclusively by
> EPIC-001. In a multi-EPIC initiative, shared screens would have a count > 1. For example,
> if a future **EPIC-002: Account Management** reuses SCR-006 (KYC Verification Status) to
> allow customers to re-trigger KYC after account update, that row would be updated to:
>
> | SCR-006 | KYC Verification Status | 2 | EPIC-001, EPIC-002 |
>
> The RTM Section 1 would then contain two rows for SCR-006 — one per EPIC.

---

## 4. Coverage Gap Analysis

| Sr No | Gap Type | EPIC ID | Screen ID | Description | Action Required | Assigned To | Target Date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Missing Wireframe | EPIC-001 | SCR-003 | Screen Wireframe document for SCR-003 (Address Details — Step 2) has not yet been created | Create Screen-Wireframe for SCR-003 following the Screen-Wireframe-Template | Business Analyst | 01-Apr-2026 |
| 2 | Missing Wireframe | EPIC-001 | SCR-004 | Screen Wireframe document for SCR-004 (Document Upload — Step 3) has not yet been created | Create Screen-Wireframe for SCR-004 with file upload controls and OCR status polling | Business Analyst | 01-Apr-2026 |
| 3 | Missing Wireframe | EPIC-001 | SCR-005 | Screen Wireframe document for SCR-005 (Registration Confirmation) has not yet been created | Create Screen-Wireframe for SCR-005 showing confirmation message, reference number, and next steps | Business Analyst | 01-Apr-2026 |
| 4 | Missing Wireframe | EPIC-001 | SCR-006 | Screen Wireframe document for SCR-006 (KYC Verification Status) has not yet been created | Create Screen-Wireframe for SCR-006 with status card, failure reason, and re-submission flow | Business Analyst | 03-Apr-2026 |
| 5 | Missing Wireframe | EPIC-001 | SCR-007 | Screen Wireframe document for SCR-007 (KYC Manual Review) has not yet been created | Create Screen-Wireframe for SCR-007 including document image viewer, extracted data panel, and approve/reject actions | Business Analyst | 03-Apr-2026 |

> **Status:** SCR-001 and SCR-002 wireframes are complete and approved.
> SCR-003 through SCR-007 wireframes are pending creation (tracked above).

---

## Revision History

```
| Version | Date         | Author              | Changes Made                              |
|---------|--------------|---------------------|-------------------------------------------|
| 1.0     | 25-Mar-2026  | Business Analyst    | Initial RTM — EPIC-001, 7 screens mapped  |
```

---

*Template Version: 1.0 | Last Reviewed: 25-Mar-2026*

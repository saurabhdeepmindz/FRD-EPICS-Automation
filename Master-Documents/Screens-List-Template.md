# Screens List

> **Document Flow:** BRD → FRD → Initiative → EPIC → User Story → SubTask
> **Design Flow:** Screens List → Screen Wireframe → High-Fidelity Mockup → UI Development
>
> This document is the **master screen register** for the initiative. Its primary purpose is
> to provide a complete, numbered inventory of every screen in the application so that the
> total screen count is visible at a glance.
>
> Every screen that will be built — customer-facing, internal, back-office, error pages,
> or shared utility screens — must have an entry here before its Screen Wireframe document
> is created. The Screen ID assigned here is the canonical ID used across all other
> documents: User Story, SubTask, RTM, EPIC–Screen RTM, and Screen Wireframe.

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
Total Screens   : [N]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Table of Contents

| # | Section |
| --- | --- |
| 1 | Screens List |
| 2 | Screen Count Summary |
| — | Usage Notes |
| — | Revision History |

---

## 1. Screens List

> **Guideline:**
> - Assign Screen IDs sequentially starting from SCR-001. Do not reuse or skip IDs.
> - Screen Name is a short title (3–6 words) used as a quick reference in other documents.
> - Screen Description is a single concise line describing what the screen does and who uses it.
>   The full detailed description lives in the Screen Wireframe document for that screen.
> - User Type identifies the audience: `Public` (unauthenticated), `Customer` (authenticated),
>   `Back-Office` (internal staff), or `System` (automated/non-human, e.g., an error page).
> - EPIC ID(s) lists all EPICs this screen is associated with. See EPIC-Screen-RTM for full mapping.
> - Wireframe Status tracks whether the Screen Wireframe document has been created:
>   `Not Started` / `In Progress` / `Draft` / `Approved`.

| Sr No | Screen ID | Screen Name | Screen Description | User Type | EPIC ID(s) | Wireframe Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | SCR-001 | [Screen Name] | [One-line description of what the screen does and who uses it] | [ Public \| Customer \| Back-Office \| System ] | EPIC-[XXX] | [ Not Started \| In Progress \| Draft \| Approved ] |

---

## 2. Screen Count Summary

> **Guideline:** Break down the total screen count by User Type to give a quick sense
> of the application's scope across public, authenticated, and back-office areas.

| User Type | Screen Count | Screen IDs |
| --- | --- | --- |
| Public (Unauthenticated) | [N] | SCR-[XXX], … |
| Customer (Authenticated) | [N] | SCR-[XXX], … |
| Back-Office (Internal Staff) | [N] | SCR-[XXX], … |
| System (Error / Redirect Pages) | [N] | SCR-[XXX], … |
| **Total** | **[N]** | |

---

## Usage Notes

> 1. **Assign Screen IDs here first.** Before creating a Screen Wireframe document or referencing
>    a screen in a User Story, the screen must be registered here and assigned a `SCR-[XXX]` ID.
>    This prevents duplicate IDs and ensures every screen is accounted for.
>
> 2. **Baseline this list** at the start of each sprint or design phase. Any new screen added after
>    baseline is a scope addition and must be reviewed with the Product Owner before proceeding.
>
> 3. **Screen Description** here is intentionally one line. The full description — including
>    business rules, conditional logic, controls, and mockup — lives in the Screen Wireframe
>    document (`Screen-Wireframe-Template.md`) for that Screen ID.
>
> 4. **Cross-references:**
>    - `EPIC-Screen-RTM-Template.md` — maps each EPIC to its screens
>    - `UserStory-SubTask-RTM-Template.md` — maps each User Story and SubTask to a Screen ID
>    - `Screen-Wireframe-Template.md` — detailed wireframe document per screen

---

## Revision History

```
| Version | Date         | Author         | Changes Made                              |
|---------|--------------|----------------|-------------------------------------------|
| 1.0     | DD-MMM-YYYY  | [Author Name]  | Initial screen list                       |
| 1.1     | DD-MMM-YYYY  | [Author Name]  | [Brief description of changes]            |
```

---

*Template Version: 1.0 | Last Reviewed: 25-Mar-2026*

---
---

# EXAMPLE — INIT-001: Unified Digital Onboarding Platform

> This example lists all screens for **INIT-001: Unified Digital Onboarding Platform**
> covering **EPIC-001: Customer Registration & KYC Verification**.
>
> The screens span the full customer registration wizard, the post-registration KYC
> status view, back-office manual review, and system-level utility screens.

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
Total Screens   : 10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 1. Screens List

| Sr No | Screen ID | Screen Name | Screen Description | User Type | EPIC ID(s) | Wireframe Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | SCR-001 | Portal Landing Page | Public entry point presenting the product value proposition and the "Register Now" call-to-action that launches the registration wizard | Public | EPIC-001 | Approved |
| 2 | SCR-002 | Personal Details — Step 1 | First step of the three-step registration wizard; collects the customer's core identity fields: First Name, Last Name, Date of Birth, Email Address, Mobile Number, and Gender | Public | EPIC-001 | Approved |
| 3 | SCR-003 | Address Details — Step 2 | Second step of the registration wizard; collects the customer's residential address: Street, City, State, PIN Code, and Country | Public | EPIC-001 | Draft |
| 4 | SCR-004 | Document Upload — Step 3 | Third and final step of the registration wizard; allows the customer to upload a government-issued identity document (Aadhaar, PAN, or Passport) for OCR extraction and KYC verification | Public | EPIC-001 | Not Started |
| 5 | SCR-005 | Registration Confirmation | Success screen displayed after all three registration steps are completed; shows a confirmation message, the customer's unique reference number, and the next steps for KYC | Public | EPIC-001 | Not Started |
| 6 | SCR-006 | KYC Verification Status | Authenticated customer dashboard screen showing the current KYC verification status (Pending / Verified / Failed), the reason for failure if applicable, and an option to re-submit documents | Customer | EPIC-001 | Not Started |
| 7 | SCR-007 | KYC Manual Review — Back Office | Internal back-office screen for Operations staff to review KYC cases flagged for manual verification; displays the uploaded document image alongside OCR-extracted data and provides Approve / Reject actions | Back-Office | EPIC-001 | Not Started |
| 8 | SCR-008 | Session Timeout | System screen displayed when the customer's browser session expires during the registration flow; prompts the customer to restart or return to the landing page | System | EPIC-001 | Not Started |
| 9 | SCR-009 | Registration Error | System screen displayed when a critical server-side error occurs during form submission or KYC initiation; shows a user-friendly error message and a support reference code | System | EPIC-001 | Not Started |
| 10 | SCR-010 | Document Re-Upload | Screen allowing a customer whose KYC failed to re-upload a corrected or different identity document without restarting the full registration flow | Customer | EPIC-001 | Not Started |

---

## 2. Screen Count Summary

| User Type | Screen Count | Screen IDs |
| --- | --- | --- |
| Public (Unauthenticated) | 5 | SCR-001, SCR-002, SCR-003, SCR-004, SCR-005 |
| Customer (Authenticated) | 2 | SCR-006, SCR-010 |
| Back-Office (Internal Staff) | 1 | SCR-007 |
| System (Error / Redirect Pages) | 2 | SCR-008, SCR-009 |
| **Total** | **10** | |

---

## Revision History

```
| Version | Date         | Author              | Changes Made                              |
|---------|--------------|---------------------|-------------------------------------------|
| 1.0     | 25-Mar-2026  | Business Analyst    | Initial screen list — 10 screens for EPIC-001 |
```

---

*Template Version: 1.0 | Last Reviewed: 25-Mar-2026*

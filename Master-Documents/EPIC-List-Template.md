# EPIC List

> **Document Flow:** BRD → FRD → Initiative → **EPIC** → User Story → SubTask
>
> This document is the **master EPIC register** for the initiative. Its primary purpose is
> to provide a complete, numbered inventory of every EPIC so that the total EPIC count and
> overall delivery scope are visible at a glance.
>
> Every EPIC that will be delivered under this initiative must have an entry here before
> its EPIC document is created. The EPIC ID assigned here is the canonical ID used across
> all other documents: User Story, SubTask, RTM, EPIC–Screen RTM, and Screen Wireframe.

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
Total EPICs     : [N]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Table of Contents

| # | Section |
| --- | --- |
| 1 | EPIC List |
| 2 | EPIC Count Summary |
| — | Usage Notes |
| — | Revision History |

---

## 1. EPIC List

> **Guideline:**
> - Assign EPIC IDs sequentially starting from EPIC-001. Do not reuse or skip IDs.
> - EPIC Name is a short title (3–6 words) used as a quick reference in other documents.
> - EPIC Description is a single concise line describing what the EPIC delivers and its business purpose.
>   The full detailed description lives in the EPIC document (`EPIC-Template.md`) for that EPIC ID.
> - EPIC Type classifies the EPIC's role in the system:
>   `Frontend` — primarily UI/UX screens and customer-facing flows
>   `Backend` — primarily APIs, business logic, and data processing
>   `Integration` — primarily third-party system integrations and adapters
>   `Full-Stack` — spans frontend, backend, and/or integration layers together
> - Master / Slave indicates the integration relationship with other EPICs:
>   `Master` — this EPIC consumes services or features provided by other EPICs
>   `Slave` — this EPIC provides services or features consumed by other EPICs
>   `Standalone` — this EPIC has no dependency relationship with other EPICs
> - EPIC Status tracks the current state of the EPIC document and delivery:
>   `Not Started` / `In Progress` / `Under Review` / `Approved` / `In Development` / `Done`

| Sr No | EPIC ID | EPIC Name | EPIC Description | EPIC Type | Master / Slave | EPIC Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | EPIC-[XXX] | [EPIC Name] | [One-line description of what this EPIC delivers and its business purpose] | [ Frontend \| Backend \| Integration \| Full-Stack ] | [ Master \| Slave \| Standalone ] | [ Not Started \| In Progress \| Under Review \| Approved \| In Development \| Done ] |

---

## 2. EPIC Count Summary

> **Guideline:** Break down the total EPIC count by EPIC Type and by delivery status
> to give a quick sense of scope and progress at a glance.

### 2A. Count by EPIC Type

| EPIC Type | EPIC Count | EPIC IDs |
| --- | --- | --- |
| Frontend | [N] | EPIC-[XXX], … |
| Backend | [N] | EPIC-[XXX], … |
| Integration | [N] | EPIC-[XXX], … |
| Full-Stack | [N] | EPIC-[XXX], … |
| **Total** | **[N]** | |

### 2B. Count by Delivery Status

| Status | EPIC Count | EPIC IDs |
| --- | --- | --- |
| Not Started | [N] | EPIC-[XXX], … |
| In Progress | [N] | EPIC-[XXX], … |
| Under Review | [N] | EPIC-[XXX], … |
| Approved | [N] | EPIC-[XXX], … |
| In Development | [N] | EPIC-[XXX], … |
| Done | [N] | EPIC-[XXX], … |
| **Total** | **[N]** | |

---

## Usage Notes

> 1. **Assign EPIC IDs here first.** Before creating an EPIC document or referencing an EPIC
>    in a User Story, the EPIC must be registered here and assigned an `EPIC-[XXX]` ID.
>    This prevents duplicate IDs and ensures every EPIC is accounted for in the initiative scope.
>
> 2. **Baseline this list** at the start of the initiative or sprint planning. Any new EPIC added
>    after baseline is a scope addition and must be reviewed with the Product Owner and stakeholders
>    before proceeding.
>
> 3. **EPIC Description** here is intentionally one line. The full description — including
>    Key Actors, High-Level Flow, Features, NFRs, and Acceptance Criteria — lives in the EPIC
>    document (`EPIC-Template.md`) for that EPIC ID.
>
> 4. **Cross-references:**
>    - `EPIC-Template.md` — full detailed document per EPIC
>    - `EPIC-Template-Checklist.md` — completeness checklist per EPIC
>    - `EPIC-Screen-RTM-Template.md` — maps each EPIC to its screens
>    - `UserStory-SubTask-RTM-Template.md` — maps User Stories and SubTasks to EPIC IDs

---

## Revision History

```
| Version | Date         | Author         | Changes Made                              |
|---------|--------------|----------------|-------------------------------------------|
| 1.0     | DD-MMM-YYYY  | [Author Name]  | Initial EPIC list                         |
| 1.1     | DD-MMM-YYYY  | [Author Name]  | [Brief description of changes]            |
```

---

*Template Version: 1.0 | Last Reviewed: 25-Mar-2026*

---
---

# EXAMPLE — INIT-001: Unified Digital Onboarding Platform

> This example lists all EPICs for **INIT-001: Unified Digital Onboarding Platform**.
>
> The initiative digitises the end-to-end customer onboarding journey — from the first
> visit to the portal through identity verification, account activation, and the first
> login — replacing the existing paper-based and branch-assisted process.
>
> The four EPICs below represent the full functional scope of the initiative, each
> covering a distinct phase of the onboarding journey.

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
Total EPICs     : 4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 1. EPIC List

| Sr No | EPIC ID | EPIC Name | EPIC Description | EPIC Type | Master / Slave | EPIC Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | EPIC-001 | Customer Registration & KYC | End-to-end digital onboarding covering customer registration form (3 steps), document upload, OCR data extraction, and automated KYC verification via third-party API | Full-Stack | Master | In Development |
| 2 | EPIC-002 | Document Management & OCR | Secure document storage, format and size validation, OCR text extraction from uploaded identity documents, and structured data output for downstream KYC and profile population | Backend | Slave | Approved |
| 3 | EPIC-003 | Account Activation & Profile Setup | Post-KYC account activation workflow covering credential creation, initial profile population from registration data, welcome notification dispatch, and first-login screen | Full-Stack | Slave | In Progress |
| 4 | EPIC-004 | Notification & Communication | Centralised notification service managing all customer-facing and back-office communications triggered during onboarding: email, SMS, and in-app alerts for registration, KYC status, and account activation | Backend | Slave | Not Started |

---

## 2. EPIC Count Summary

### 2A. Count by EPIC Type

| EPIC Type | EPIC Count | EPIC IDs |
| --- | --- | --- |
| Frontend | 0 | — |
| Backend | 2 | EPIC-002, EPIC-004 |
| Integration | 0 | — |
| Full-Stack | 2 | EPIC-001, EPIC-003 |
| **Total** | **4** | |

### 2B. Count by Delivery Status

| Status | EPIC Count | EPIC IDs |
| --- | --- | --- |
| Not Started | 1 | EPIC-004 |
| In Progress | 1 | EPIC-003 |
| Under Review | 0 | — |
| Approved | 1 | EPIC-002 |
| In Development | 1 | EPIC-001 |
| Done | 0 | — |
| **Total** | **4** | |

---

## Revision History

```
| Version | Date         | Author              | Changes Made                                         |
|---------|--------------|---------------------|------------------------------------------------------|
| 1.0     | 25-Mar-2026  | Business Analyst    | Initial EPIC list — 4 EPICs for INIT-001 registered  |
```

---

*Template Version: 1.0 | Last Reviewed: 25-Mar-2026*

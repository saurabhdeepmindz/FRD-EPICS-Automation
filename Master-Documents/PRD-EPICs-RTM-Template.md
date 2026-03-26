# PRD–EPICs Requirements Traceability Matrix (RTM) Template

> **Document Flow:** **PRD** → BRD → FRD → Initiative → **EPICs** → User Stories → Tasks → Subtasks
>
> This RTM provides the **top-level traceability bridge** between the PRD and the EPIC backlog.
> It answers the following questions in a single view:
>
> - Which PRD section and feature does each EPIC originate from?
> - Which EPICs are driven by each PRD functional module?
> - Which integrations, NFRs, and compliance requirements trace to which EPICs?
> - Are there any EPICs without a PRD origin, or PRD features without an EPIC?
> - Is every PRD section covered in the EPIC backlog?
>
> **Cardinality:**
> - One PRD Feature → One or more EPICs
> - One EPIC → One or more PRD Features
> - One row in the main RTM = one PRD Feature → EPIC relationship
>
> **Sections in this RTM:**
> 1. PRD Functional Feature → EPIC Traceability (main matrix)
> 2. Integration Requirement → EPIC Traceability
> 3. NFR → EPIC Traceability
> 4. Compliance Requirement → EPIC Traceability
> 5. RTM Summary — EPICs per PRD Section
> 6. RTM Summary — PRD Feature Coverage per EPIC
> 7. Coverage Gap Analysis

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RTM ID          : RTM-PRD-[XXX]
PRD ID          : PRD-[XXX]
Product Name    : [Product / Application Name]
Initiative ID   : INIT-[XXX]
Created Date    : DD-MMM-YYYY
Last Updated    : DD-MMM-YYYY
Prepared By     : [Name / Role]
Reviewed By     : [Name / Role]
Version         : 1.0
Status          : [ Draft | Under Review | Approved | Baselined ]
Total Features  : [N]
Total EPICs     : [N]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Table of Contents

| # | Section |
|---|---------|
| 1 | PRD Functional Feature → EPIC Traceability |
| 2 | Integration Requirement → EPIC Traceability |
| 3 | NFR → EPIC Traceability |
| 4 | Compliance Requirement → EPIC Traceability |
| 5 | RTM Summary — EPICs per PRD Section |
| 6 | RTM Summary — PRD Feature Coverage per EPIC |
| 7 | Coverage Gap Analysis |
| — | Column Definitions |
| — | Usage Notes |
| — | Revision History |

---

## Column Definitions

> **Guideline:** Understand each column before populating the RTM.
> All columns are mandatory unless marked as conditional (e.g., User Story ID is TBD at PRD stage).

| Column | Description | Allowed Values / Format |
|--------|-------------|------------------------|
| **Sr No** | Sequential row number across the entire RTM | 1, 2, 3 … |
| **PRD Section No** | The section number in the PRD where this feature is defined | e.g., 6.1, 6.2, 7, 10.1 |
| **PRD Section Name** | Name of the PRD section | e.g., "Functional Requirements", "Integration Requirements" |
| **Module Name** | The functional module within Section 6 that this feature belongs to | e.g., "Customer Registration & KYC" |
| **Feature ID** | The unique feature ID from the PRD (FR-XXX) or Integration ID (INT-XXX) / NFR-ID | FR-[XXX] / INT-[XXX] / NFR-[XXX] |
| **Feature / Requirement Description** | One-line description of the feature or requirement | Free text — max 1 sentence |
| **EPIC ID** | The EPIC ID this feature maps to | EPIC-[XXX] |
| **EPIC Name** | The name of the mapped EPIC | Free text |
| **Initiative ID** | The Initiative this EPIC belongs to | INIT-[XXX] |
| **Delivery Phase** | The phase in which this EPIC (and hence this feature) will be delivered | Phase 1 / Phase 2 / TBD |
| **Priority** | Delivery priority of the feature | High / Medium / Low |
| **User Story ID(s)** | The User Story ID(s) that implement this feature (populated after backlog decomposition) | US-[XXX] or TBD |
| **Status** | Current traceability status | Mapped / Partially Mapped / Not Mapped / Deferred |

---

## 1. PRD Functional Feature → EPIC Traceability

> **Guideline:**
> - One row per PRD Feature → EPIC relationship. If one feature maps to two EPICs, create two rows.
> - Sort by PRD Section No first, then Feature ID within each section.
> - User Story IDs are populated during backlog decomposition — set to TBD at PRD baseline.
> - Features listed as Out of Scope in PRD Section 3 must not appear in this RTM.
> - Every row in this table must trace to an approved EPIC in the Initiative backlog.

| Sr No | PRD Section No | PRD Section Name | Module Name | Feature ID | Feature / Requirement Description | EPIC ID | EPIC Name | Initiative ID | Phase | Priority | User Story ID(s) | Status |
|-------|----------------|------------------|-------------|------------|------------------------------------|---------|-----------|---------------|-------|----------|------------------|--------|
| 1 | 6.[X] | Functional Requirements | [Module Name] | FR-[XXX] | [One-line feature description] | EPIC-[XXX] | [EPIC Name] | INIT-[XXX] | Phase [X] | H/M/L | TBD | Mapped |
| 2 | 6.[X] | Functional Requirements | [Module Name] | FR-[XXX] | [One-line feature description] | EPIC-[XXX] | [EPIC Name] | INIT-[XXX] | Phase [X] | H/M/L | TBD | Mapped |

---

## 2. Integration Requirement → EPIC Traceability

> **Guideline:**
> - Each integration from PRD Section 7 must map to the EPIC(s) that consume it.
> - An integration used by multiple EPICs appears on multiple rows (one per EPIC).
> - If the API contract is not yet available, mark User Story IDs as TBD and flag in Gap Analysis.

| Sr No | PRD Section No | Integration ID | Integration Name / System | Direction | EPIC ID | EPIC Name | Phase | Priority | User Story ID(s) | Contract Status | Status |
|-------|----------------|----------------|---------------------------|-----------|---------|-----------|-------|----------|------------------|-----------------|--------|
| 1 | 7 | INT-[XXX] | [System / Service Name] | [Inbound / Outbound] | EPIC-[XXX] | [EPIC Name] | Phase [X] | H/M/L | TBD | [Available / TBD — Date] | Mapped |
| 2 | 7 | INT-[XXX] | [System / Service Name] | [Inbound / Outbound] | EPIC-[XXX] | [EPIC Name] | Phase [X] | H/M/L | TBD | [Available / TBD — Date] | Mapped |

---

## 3. NFR → EPIC Traceability

> **Guideline:**
> - Each NFR from PRD Section 10 must be mapped to the EPIC(s) it applies to.
> - An NFR applicable to all EPICs (e.g., TLS encryption) must either have a row per EPIC
>   or be marked as "Platform-wide" with EPIC ID = ALL.
> - NFRs that are not mapped to any EPIC will create a delivery gap — flag these in Section 7.

| Sr No | PRD Section No | NFR ID | NFR Category | NFR Description (summary) | EPIC ID | EPIC Name | Verification Method | Priority | Status |
|-------|----------------|--------|--------------|---------------------------|---------|-----------|---------------------|----------|--------|
| 1 | 10.[X] | NFR-[CAT]-[XXX] | [Security / Performance / etc.] | [One-line NFR summary] | EPIC-[XXX] or ALL | [EPIC Name or Platform-wide] | [Load Test / Pen Test / Code Review / etc.] | Critical / High / Medium | Mapped |
| 2 | 10.[X] | NFR-[CAT]-[XXX] | [Security / Performance / etc.] | [One-line NFR summary] | EPIC-[XXX] or ALL | [EPIC Name or Platform-wide] | [Load Test / Pen Test / Code Review / etc.] | Critical / High / Medium | Mapped |

---

## 4. Compliance Requirement → EPIC Traceability

> **Guideline:**
> - Each compliance regulation from PRD Section 15 must be mapped to the EPIC(s) it applies to.
> - Compliance requirements that span all EPICs (e.g., DPDP Act data handling) are marked ALL.
> - Sign-off Owner is the person responsible for confirming compliance is met before go-live.

| Sr No | PRD Section No | Compliance ID | Regulation / Standard | Key Requirement (summary) | EPIC ID | EPIC Name | Sign-off Owner | Phase Gate | Status |
|-------|----------------|---------------|-----------------------|---------------------------|---------|-----------|----------------|------------|--------|
| 1 | 15 | COMP-[XXX] | [Regulation Name] | [One-line requirement summary] | EPIC-[XXX] or ALL | [EPIC Name or Platform-wide] | [Owner Name / Team] | Before Go-Live | Mapped |
| 2 | 15 | COMP-[XXX] | [Regulation Name] | [One-line requirement summary] | EPIC-[XXX] or ALL | [EPIC Name or Platform-wide] | [Owner Name / Team] | Before Go-Live | Mapped |

---

## 5. RTM Summary — EPICs per PRD Section

> **Guideline:** Shows how many EPICs each PRD section drives. A section with zero EPICs
> is either non-functional (and intentionally excluded — e.g., Section 1 Overview) or a gap.
> Sections 6, 7, 10, and 15 must always have at least one EPIC mapped.

| PRD Section No | PRD Section Name | Total EPICs Driven | EPIC IDs |
|----------------|------------------|--------------------|----------|
| 1 | Overview / Objective | 0 | — (strategic context; all EPICs inherit from this section) |
| 2 | High-Level Scope | 0 | — (scope boundary; traced at module level in Section 6) |
| 3 | Out of Scope | 0 | — (exclusions; no EPICs) |
| 4 | Assumptions and Constraints | 0 | — (governance; impacts all EPICs) |
| 5 | Actors / User Types | 0 | — (actor definitions; referenced in EPICs, not mapped here) |
| 6 | Functional Requirements | [N] | EPIC-[XXX], EPIC-[XXX], … |
| 7 | Integration Requirements | [N] | EPIC-[XXX], EPIC-[XXX], … |
| 8 | Customer Journeys | 0 | — (flows; traced at User Story level, not EPIC RTM) |
| 9 | Functional Landscape | 0 | — (infographic; summarises all EPICs) |
| 10 | Non-Functional Requirements | [N] | EPIC-[XXX], EPIC-[XXX], … (or ALL) |
| 11 | Technology | 0 | — (platform-wide; impacts architecture, not individual EPICs) |
| 12 | DevOps and Observability | 0 | — (platform-wide; impacts infrastructure, not individual EPICs) |
| 13 | UI/UX Requirements | 0 | — (platform-wide UX standards; apply to all Frontend EPICs) |
| 14 | Branding Requirements | 0 | — (design standards; apply to all Frontend EPICs) |
| 15 | Compliance Requirements | [N] | EPIC-[XXX], EPIC-[XXX], … (or ALL) |
| 16 | Testing Requirements | 0 | — (platform-wide QA coverage; not EPIC-specific) |
| 17 | Key Deliverables | 0 | — (project deliverables; not mapped to EPICs) |
| 18 | Receivables | 0 | — (customer inputs; blocking specific EPICs noted in Gap Analysis) |
| 19 | Environment | 0 | — (infrastructure; platform-wide) |
| 20 | High-Level Timelines | 0 | — (milestones; phasing reflected in EPIC Phase column) |

---

## 6. RTM Summary — PRD Feature Coverage per EPIC

> **Guideline:** Shows how many PRD features, integrations, NFRs, and compliance
> requirements each EPIC is responsible for. An EPIC with zero features is not grounded
> in the PRD and must be investigated. An EPIC with very high feature count may need splitting.

| EPIC ID | EPIC Name | Phase | PRD Features (FR) | Integrations (INT) | NFRs | Compliance (COMP) | Total PRD Items | User Stories (TBD count) |
|---------|-----------|-------|-------------------|--------------------|------|-------------------|-----------------|--------------------------|
| EPIC-[XXX] | [EPIC Name] | Phase [X] | [N] | [N] | [N] | [N] | [Total] | TBD |
| EPIC-[XXX] | [EPIC Name] | Phase [X] | [N] | [N] | [N] | [N] | [Total] | TBD |

---

## 7. Coverage Gap Analysis

> **Guideline:** Log every gap, mismatch, or traceability issue found during RTM review.
> A gap is any condition where a PRD item is not yet mapped to an EPIC, or an EPIC exists
> without a PRD origin. All gaps must be assigned an owner and a resolution date.
> Gaps that remain open at PRD baseline are risks to scope integrity.

| Gap ID | Gap Type | PRD Reference | EPIC ID | Description | Action Required | Assigned To | Target Date | Status |
|--------|----------|---------------|---------|-------------|-----------------|-------------|-------------|--------|
| GAP-001 | [Gap Type] | [Section / Feature ID] | EPIC-[XXX] or N/A | [Description of the gap or mismatch] | [Action to close the gap] | [Name / Role] | DD-MMM-YYYY | Open / Closed |

> **Gap Types:**
> - `Feature Without EPIC` — A PRD functional feature has no EPIC assigned to it
> - `EPIC Without PRD Feature` — An EPIC exists in the backlog but no PRD feature maps to it
> - `Integration Without EPIC` — An integration in Section 7 has no EPIC that consumes it
> - `NFR Without EPIC` — An NFR in Section 10 has no EPIC assigned for implementation
> - `Compliance Without EPIC` — A compliance requirement has no EPIC responsible for it
> - `Receivable Blocks EPIC` — A customer receivable (Section 18) is blocking an EPIC and has no owner / date
> - `Out of Scope Conflict` — A PRD feature appears in both Section 6 (In Scope) and Section 3 (Out of Scope)
> - `Phase Mismatch` — An EPIC is assigned to a phase inconsistent with its PRD feature priority
> - `Scope Change` — A feature was added to or removed from the PRD after RTM baseline

---

## Usage Notes

> 1. **Baseline this RTM** once the PRD is approved and the Initiative EPIC list is finalised.
>    Any addition or removal of a feature or EPIC after baseline is a scope change and must
>    be logged in Section 7 (Coverage Gap Analysis) with justification and approver sign-off.
>
> 2. **One row = one relationship.** Do not merge rows for a feature that maps to multiple EPICs.
>    Keep them as separate rows so each relationship is independently traceable and auditable.
>
> 3. **User Story IDs** are set to TBD at PRD baseline stage. They are populated during backlog
>    decomposition (sprint 0 / refinement). The RTM must be updated after each sprint's story
>    decomposition to maintain traceability from PRD feature to User Story.
>
> 4. **Section 5 and Section 6 (RTM Summaries)** must be updated every time rows are added,
>    modified, or removed in Sections 1–4. They are derived views — not independently maintained.
>
> 5. **Cross-reference documents:**
>    - EPIC-Screen-RTM — traces EPICs to screens
>    - UserStory-SubTask-RTM — traces User Stories to SubTasks
>    - Together, all three RTMs provide complete vertical traceability:
>      PRD Feature → EPIC → User Story → SubTask → Screen

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

# EXAMPLE — PRD-001: Unified Digital Onboarding Platform → INIT-001

> This example maps all features from **PRD-001** (Unified Digital Onboarding Platform)
> to **EPIC-001 through EPIC-007** under **INIT-001**.
>
> **EPIC Register for this example:**
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

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RTM ID          : RTM-PRD-001
PRD ID          : PRD-001
Product Name    : Unified Digital Onboarding Platform (UDOP)
Initiative ID   : INIT-001
Created Date    : 26-Mar-2026
Last Updated    : 26-Mar-2026
Prepared By     : Business Analyst
Reviewed By     : Product Owner / Tech Lead
Version         : 1.0
Status          : Approved
Total Features  : 24 (FR) + 8 (INT) + 14 (NFR) + 6 (COMP)
Total EPICs     : 7
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 1. PRD Functional Feature → EPIC Traceability

| Sr No | PRD Section No | PRD Section Name | Module Name | Feature ID | Feature / Requirement Description | EPIC ID | EPIC Name | Initiative ID | Phase | Priority | User Story ID(s) | Status |
|-------|----------------|------------------|-------------|------------|------------------------------------|---------|-----------|---------------|-------|----------|------------------|--------|
| 1 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-001 | Multi-step form collects personal details (Name, DOB, Gender, Nationality) in Step 1 | EPIC-001 | Customer Registration & KYC Verification | INIT-001 | Phase 1 | High | US-001 | Mapped |
| 2 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-002 | Multi-step form collects contact details (Mobile, Email, Alternate Mobile) in Step 2 | EPIC-001 | Customer Registration & KYC Verification | INIT-001 | Phase 1 | High | US-001 | Mapped |
| 3 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-003 | Multi-step form collects address details (Permanent + Current) in Step 3 | EPIC-001 | Customer Registration & KYC Verification | INIT-001 | Phase 1 | High | US-001 | Mapped |
| 4 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-004 | System allows customers to save progress and resume within 48 hours via secure link | EPIC-001 | Customer Registration & KYC Verification | INIT-001 | Phase 1 | Medium | US-002 | Mapped |
| 5 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-005 | Step progress indicator showing completion percentage throughout registration | EPIC-001 | Customer Registration & KYC Verification | INIT-001 | Phase 1 | Medium | US-001 | Mapped |
| 6 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-006 | Address auto-fill using browser geolocation API on customer consent | EPIC-001 | Customer Registration & KYC Verification | INIT-001 | Phase 1 | Low | US-001 | Mapped |
| 7 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-007 | 6-digit OTP generated and sent via SMS to mobile number within 10 seconds | EPIC-001 | Customer Registration & KYC Verification | INIT-001 | Phase 1 | High | US-003 | Mapped |
| 8 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-008 | OTP valid for 5 minutes only; expired OTPs rejected | EPIC-001 | Customer Registration & KYC Verification | INIT-001 | Phase 1 | High | US-003 | Mapped |
| 9 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-009 | Maximum 3 OTP entry attempts before 15-minute lockout | EPIC-001 | Customer Registration & KYC Verification | INIT-001 | Phase 1 | High | US-003 | Mapped |
| 10 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-010 | Resend OTP available after 30 seconds; max 3 resend attempts | EPIC-001 | Customer Registration & KYC Verification | INIT-001 | Phase 1 | High | US-003 | Mapped |
| 11 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-011 | Error messages must not reveal whether a mobile number is already registered | EPIC-001 | Customer Registration & KYC Verification | INIT-001 | Phase 1 | High | US-003 | Mapped |
| 12 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-012 | Accept Aadhaar, PAN, Passport, Voter ID, and Driving Licence as valid identity documents | EPIC-002 | Document Upload & Verification | INIT-001 | Phase 1 | High | US-005 | Mapped |
| 13 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-013 | Accept document uploads in JPG, PNG, PDF up to 5 MB per file | EPIC-002 | Document Upload & Verification | INIT-001 | Phase 1 | High | US-005 | Mapped |
| 14 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-014 | OCR on uploaded documents to auto-extract name, DOB, document number | EPIC-002 | Document Upload & Verification | INIT-001 | Phase 1 | High | US-006 | Mapped |
| 15 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-015 | Submit extracted data to KYC API; receive verification result within 30 seconds | EPIC-002 | Document Upload & Verification | INIT-001 | Phase 1 | High | US-006 | Mapped |
| 16 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-016 | On KYC PASS — advance application status to "KYC Verified — Pending Account Provisioning" | EPIC-002 | Document Upload & Verification | INIT-001 | Phase 1 | High | US-006 | Mapped |
| 17 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-017 | On KYC FAIL — flag application to Operations exception queue with failure reason code | EPIC-002 | Document Upload & Verification | INIT-001 | Phase 1 | High | US-006 | Mapped |
| 18 | 6.1 | Functional Requirements | Customer Registration & KYC | FR-018 | Store uploaded documents in AES-256 encrypted object storage with tamper-evident checksum | EPIC-002 | Document Upload & Verification | INIT-001 | Phase 1 | High | US-005 | Mapped |
| 19 | 6.2 | Functional Requirements | Account Provisioning | FR-019 | Trigger CBS account creation API within 2 minutes of KYC approval | EPIC-003 | Account Provisioning | INIT-001 | Phase 1 | High | US-007 | Mapped |
| 20 | 6.2 | Functional Requirements | Account Provisioning | FR-020 | Receive generated account number from CBS and persist against customer application record | EPIC-003 | Account Provisioning | INIT-001 | Phase 1 | High | US-007 | Mapped |
| 21 | 6.2 | Functional Requirements | Account Provisioning | FR-021 | On successful account creation — update status to "Active" and trigger Welcome Notification | EPIC-003 | Account Provisioning | INIT-001 | Phase 1 | High | US-007 | Mapped |
| 22 | 6.2 | Functional Requirements | Account Provisioning | FR-022 | Retry CBS API up to 3 times with exponential backoff on failure before routing to Operations queue | EPIC-003 | Account Provisioning | INIT-001 | Phase 1 | High | US-007 | Mapped |
| 23 | 6.2 | Functional Requirements | Account Provisioning | FR-023 | Dispatch Welcome SMS and Email with account number and online banking setup link on activation | EPIC-004 | Notification & Communication Hub | INIT-001 | Phase 1 | High | US-008 | Mapped |
| 24 | 6.2 | Functional Requirements | Account Provisioning | FR-024 | Welcome Email includes dynamically generated PDF welcome letter | EPIC-004 | Notification & Communication Hub | INIT-001 | Phase 1 | Medium | US-008 | Mapped |

---

## 2. Integration Requirement → EPIC Traceability

| Sr No | PRD Section No | Integration ID | Integration Name / System | Direction | EPIC ID | EPIC Name | Phase | Priority | User Story ID(s) | Contract Status | Status |
|-------|----------------|----------------|---------------------------|-----------|---------|-----------|-------|----------|------------------|-----------------|--------|
| 1 | 7 | INT-001 | KYC Verification API (VerifyFast) | Outbound | EPIC-002 | Document Upload & Verification | Phase 1 | High | US-006 | TBD — 15-Apr-2026 | Mapped |
| 2 | 7 | INT-002 | Core Banking System (CBS) | Outbound | EPIC-003 | Account Provisioning | Phase 1 | High | US-007 | Available — v1.2 | Mapped |
| 3 | 7 | INT-003 | SMS Gateway | Outbound | EPIC-001 | Customer Registration & KYC Verification | Phase 1 | High | US-003 | Available | Mapped |
| 4 | 7 | INT-003 | SMS Gateway | Outbound | EPIC-004 | Notification & Communication Hub | Phase 1 | High | US-008 | Available | Mapped |
| 5 | 7 | INT-004 | Email Service (SES/SMTP) | Outbound | EPIC-004 | Notification & Communication Hub | Phase 1 | High | US-008 | Available | Mapped |
| 6 | 7 | INT-005 | OCR Document Service (DocuScan) | Outbound | EPIC-002 | Document Upload & Verification | Phase 1 | High | US-006 | TBD — Mar-2026 | Mapped |
| 7 | 7 | INT-006 | Identity Provider (IdP / Keycloak) | Inbound | EPIC-005 | Identity & Access Management | Phase 1 | High | TBD | Available — OIDC spec | Mapped |
| 8 | 7 | INT-007 | Analytics / BI Platform (Kafka) | Outbound | EPIC-006 | Operations Exception Dashboard & Reporting | Phase 2 | Medium | TBD | TBD — May-2026 | Mapped |
| 9 | 7 | INT-008 | Audit Logging Service | Outbound | EPIC-001 | Customer Registration & KYC Verification | Phase 1 | High | TBD | Available | Mapped |
| 10 | 7 | INT-008 | Audit Logging Service | Outbound | EPIC-002 | Document Upload & Verification | Phase 1 | High | TBD | Available | Mapped |
| 11 | 7 | INT-008 | Audit Logging Service | Outbound | EPIC-003 | Account Provisioning | Phase 1 | High | TBD | Available | Mapped |
| 12 | 7 | INT-008 | Audit Logging Service | Outbound | EPIC-005 | Identity & Access Management | Phase 1 | High | TBD | Available | Mapped |

---

## 3. NFR → EPIC Traceability

| Sr No | PRD Section No | NFR ID | NFR Category | NFR Description (summary) | EPIC ID | EPIC Name | Verification Method | Priority | Status |
|-------|----------------|--------|--------------|---------------------------|---------|-----------|---------------------|----------|--------|
| 1 | 10.1 | NFR-SEC-001 | Security | All data in transit encrypted using TLS 1.2+ | ALL | Platform-wide | TLS config audit; DAST scan | Critical | Mapped |
| 2 | 10.1 | NFR-SEC-002 | Security | All PII and documents at rest encrypted using AES-256 | EPIC-001 | Customer Registration & KYC Verification | Code review; storage config audit | Critical | Mapped |
| 3 | 10.1 | NFR-SEC-002 | Security | All PII and documents at rest encrypted using AES-256 | EPIC-002 | Document Upload & Verification | Code review; storage config audit | Critical | Mapped |
| 4 | 10.1 | NFR-SEC-003 | Security | Authentication must support MFA (OTP mandatory) | EPIC-005 | Identity & Access Management | Functional test; pen test | Critical | Mapped |
| 5 | 10.1 | NFR-SEC-004 | Security | All API endpoints enforce authentication and RBAC | ALL | Platform-wide | Penetration test; code review | Critical | Mapped |
| 6 | 10.1 | NFR-SEC-005 | Security | No secrets or API keys stored in source code | ALL | Platform-wide | SAST scan; secrets manager audit | Critical | Mapped |
| 7 | 10.1 | NFR-SEC-006 | Security | OWASP Top 10 vulnerabilities mitigated before go-live | ALL | Platform-wide | Penetration test (mandatory) | Critical | Mapped |
| 8 | 10.1 | NFR-SEC-007 | Security | Penetration test conducted and signed off before Phase 1 launch | ALL | Platform-wide | External pen test report | Critical | Mapped |
| 9 | 10.2 | NFR-PERF-001 | Performance | API response time P95 ≤ 2 seconds under normal load | ALL | Platform-wide | Load test (k6 / JMeter) | Critical | Mapped |
| 10 | 10.2 | NFR-PERF-002 | Performance | Page load time P95 ≤ 3 seconds on 4G mobile | EPIC-001 | Customer Registration & KYC Verification | Lighthouse; WebPageTest | High | Mapped |
| 11 | 10.2 | NFR-PERF-003 | Performance | Document upload processing (OCR + validation) ≤ 10 seconds | EPIC-002 | Document Upload & Verification | Performance test; timer logging | High | Mapped |
| 12 | 10.2 | NFR-PERF-004 | Performance | KYC API call (including network) must complete within 30 seconds | EPIC-002 | Document Upload & Verification | Integration test with timeout monitoring | Critical | Mapped |
| 13 | 10.3 | NFR-SCAL-001 | Scalability | Platform must scale horizontally; support 10x Phase 1 load without architectural change | ALL | Platform-wide | Load and stress test | Critical | Mapped |
| 14 | 10.4 | NFR-AVAIL-001 | Availability | 99.9% platform uptime SLA | ALL | Platform-wide | Uptime monitoring; CloudWatch alarms | Critical | Mapped |
| 15 | 10.4 | NFR-AVAIL-004 | Availability | Circuit breakers on all external API calls | EPIC-002 | Document Upload & Verification | Code review; integration test | High | Mapped |
| 16 | 10.4 | NFR-AVAIL-004 | Availability | Circuit breakers on all external API calls | EPIC-003 | Account Provisioning | Code review; integration test | High | Mapped |
| 17 | 10.7 | NFR-AUDIT-001 | Audit & Logs | Every application state transition logged with actor, timestamp, IP | ALL | Platform-wide | Log audit; automated monitoring | Critical | Mapped |
| 18 | 10.7 | NFR-AUDIT-005 | Audit & Logs | Logs must not contain raw PII in plaintext — masked or tokenized references only | ALL | Platform-wide | Log review; SAST scan | Critical | Mapped |

---

## 4. Compliance Requirement → EPIC Traceability

| Sr No | PRD Section No | Compliance ID | Regulation / Standard | Key Requirement (summary) | EPIC ID | EPIC Name | Sign-off Owner | Phase Gate | Status |
|-------|----------------|---------------|-----------------------|---------------------------|---------|-----------|----------------|------------|--------|
| 1 | 15 | COMP-001 | DPDP Act 2023 (India) | Explicit digital consent before data collection; right to erasure; breach notification within 72 hrs | EPIC-001 | Customer Registration & KYC Verification | Legal / DPO | Before Go-Live | Mapped |
| 2 | 15 | COMP-001 | DPDP Act 2023 (India) | Explicit digital consent before data collection; right to erasure; breach notification within 72 hrs | EPIC-005 | Identity & Access Management | Legal / DPO | Before Go-Live | Mapped |
| 3 | 15 | COMP-002 | RBI Master Directions on KYC | Document retention ≥ 7 years; re-KYC triggers; PEP and sanction list checks | EPIC-002 | Document Upload & Verification | Compliance / Legal | Before Go-Live | Mapped |
| 4 | 15 | COMP-003 | IT Act 2000 (India) | Electronic records and e-signatures legally valid; digital consent meets evidentiary requirements | EPIC-001 | Customer Registration & KYC Verification | Legal | Before Go-Live | Mapped |
| 5 | 15 | COMP-005 | OWASP Top 10 | All OWASP Top 10 vulnerabilities mitigated before launch | ALL | Platform-wide | Security / Dev Lead | Before Go-Live | Mapped |
| 6 | 15 | COMP-006 | SOC 2 Type II | If required by enterprise customer — audit controls for security, availability, confidentiality | ALL | Platform-wide | Customer / Legal | Before Go-Live | Mapped |

---

## 5. RTM Summary — EPICs per PRD Section

| PRD Section No | PRD Section Name | Total EPICs Driven | EPIC IDs |
|----------------|------------------|--------------------|----------|
| 1 | Overview / Objective | 0 | — (strategic context; all EPICs inherit) |
| 2 | High-Level Scope | 0 | — (scope boundary; traced via Section 6) |
| 3 | Out of Scope | 0 | — (exclusions; no EPICs) |
| 4 | Assumptions and Constraints | 0 | — (governance; impacts all EPICs) |
| 5 | Actors / User Types | 0 | — (actor definitions; referenced in all EPICs) |
| 6 | Functional Requirements | 5 | EPIC-001, EPIC-002, EPIC-003, EPIC-004, EPIC-006 |
| 7 | Integration Requirements | 7 | EPIC-001, EPIC-002, EPIC-003, EPIC-004, EPIC-005, EPIC-006 |
| 8 | Customer Journeys | 0 | — (flows; traced at User Story level) |
| 9 | Functional Landscape | 0 | — (infographic; summarises all EPICs) |
| 10 | Non-Functional Requirements | 7 | ALL (platform-wide) + EPIC-001, EPIC-002, EPIC-003, EPIC-005 |
| 11 | Technology | 0 | — (platform-wide; impacts HLD / architecture) |
| 12 | DevOps and Observability | 0 | — (platform-wide infrastructure) |
| 13 | UI/UX Requirements | 0 | — (applies to all Frontend EPICs) |
| 14 | Branding Requirements | 0 | — (design standards; all Frontend EPICs) |
| 15 | Compliance Requirements | 5 | ALL (platform-wide) + EPIC-001, EPIC-002, EPIC-005 |
| 16 | Testing Requirements | 0 | — (platform-wide QA coverage) |
| 17 | Key Deliverables | 0 | — (project deliverables; not EPIC-specific) |
| 18 | Receivables | 0 | — (noted in Gap Analysis where blocking specific EPICs) |
| 19 | Environment | 0 | — (infrastructure; platform-wide) |
| 20 | High-Level Timelines | 0 | — (milestones; phasing reflected in EPIC Phase column) |

---

## 6. RTM Summary — PRD Feature Coverage per EPIC

| EPIC ID | EPIC Name | Phase | PRD Features (FR) | Integrations (INT) | NFRs | Compliance (COMP) | Total PRD Items | User Stories |
|---------|-----------|-------|-------------------|--------------------|------|-------------------|-----------------|--------------|
| EPIC-001 | Customer Registration & KYC Verification | Phase 1 | 11 (FR-001 to FR-011) | 2 (INT-003, INT-008) | 5 (NFR-SEC-002, NFR-PERF-001, NFR-PERF-002, NFR-AUDIT-001, NFR-AUDIT-005) | 2 (COMP-001, COMP-003) | 20 | US-001, US-002, US-003 |
| EPIC-002 | Document Upload & Verification | Phase 1 | 7 (FR-012 to FR-018) | 3 (INT-001, INT-005, INT-008) | 6 (NFR-SEC-002, NFR-PERF-001, NFR-PERF-003, NFR-PERF-004, NFR-AVAIL-004, NFR-AUDIT-001) | 1 (COMP-002) | 17 | US-005, US-006 |
| EPIC-003 | Account Provisioning | Phase 1 | 4 (FR-019 to FR-022) | 2 (INT-002, INT-008) | 3 (NFR-PERF-001, NFR-AVAIL-004, NFR-AUDIT-001) | 0 | 9 | US-007 |
| EPIC-004 | Notification & Communication Hub | Phase 1 | 2 (FR-023, FR-024) | 2 (INT-003, INT-004) | 1 (NFR-PERF-001) | 0 | 5 | US-008 |
| EPIC-005 | Identity & Access Management | Phase 1 | 0 | 2 (INT-006, INT-008) | 2 (NFR-SEC-003, NFR-SEC-004) | 1 (COMP-001) | 5 | TBD |
| EPIC-006 | Operations Exception Dashboard & Reporting | Phase 2 | 0 | 1 (INT-007) | 1 (NFR-PERF-001) | 0 | 2 | TBD |
| EPIC-007 | Admin Configuration Panel | Phase 2 | 0 | 0 | 0 | 0 | 0 | TBD |

> **Note on EPIC-005, EPIC-006, EPIC-007:** These EPICs are driven by the High-Level Scope
> (PRD Section 2) and Actor requirements (PRD Section 5) rather than individually numbered FR-XXX
> features. Their detailed functional requirements will be elaborated in the corresponding FRD
> modules and EPIC documents. The gap for EPIC-007 is flagged below in Section 7.

---

## 7. Coverage Gap Analysis

| Gap ID | Gap Type | PRD Reference | EPIC ID | Description | Action Required | Assigned To | Target Date | Status |
|--------|----------|---------------|---------|-------------|-----------------|-------------|-------------|--------|
| GAP-001 | Feature Without EPIC | Section 6 | EPIC-005 | EPIC-005 (Identity & Access Management) has no FR-XXX features mapped from PRD Section 6. Its scope is derived from Section 2 and Section 5 only. | Elaborate IAM functional requirements in PRD Section 6 as FR-025 onwards and update this RTM | Business Analyst | 15-Apr-2026 | Open |
| GAP-002 | Feature Without EPIC | Section 6 | EPIC-006 | EPIC-006 (Operations Dashboard & Reporting) has no FR-XXX features. Scope is referenced in Section 2 only. | Elaborate Operations and Reporting features in PRD Section 6 as additional modules and map to EPIC-006 | Business Analyst | 15-Apr-2026 | Open |
| GAP-003 | EPIC Without PRD Feature | N/A | EPIC-007 | EPIC-007 (Admin Configuration Panel) has zero PRD items mapped — no FR, INT, NFR, or Compliance. Risk that this EPIC is underfunded in scope definition. | Define Admin Configuration features in PRD Section 6 and map to EPIC-007 | Product Owner | 15-Apr-2026 | Open |
| GAP-004 | Receivable Blocks EPIC | Section 18, REC-002 | EPIC-002 | KYC API contract (INT-001) required by 15-Apr-2026. If delayed, EPIC-002 development (FR-015 to FR-017) cannot begin as planned. | Escalate to Procurement; identify backup vendor option | Procurement / PO | 01-Apr-2026 | Open |
| GAP-005 | Receivable Blocks EPIC | Section 18, REC-003 | EPIC-003 | CBS API specification (INT-002) required by 01-Apr-2026. If delayed, EPIC-003 (Account Provisioning) development cannot begin. | CBS team to confirm API readiness; schedule integration design session in Sprint 0 | IT / CBS Team | 25-Mar-2026 | Open |
| GAP-006 | Phase Mismatch | Section 6.2 | EPIC-006 | Operations Dashboard is Phase 2 but Operations agents are needed from go-live (Phase 1) to handle KYC exception queue. Consider a minimal Phase 1 Operations screen. | Review with PO whether a minimal Operations queue view should be included in Phase 1 scope | Product Owner | 05-Apr-2026 | Open |

---

## Revision History

```
| Version | Date         | Author              | Changes Made                                        | Approved By     |
|---------|--------------|---------------------|-----------------------------------------------------|-----------------|
| 1.0     | 26-Mar-2026  | Business Analyst    | Initial RTM — 24 FR, 8 INT, 14 NFR, 6 COMP mapped  | Product Owner   |
```

---

*Template Version: 1.0 | Last Reviewed: 26-Mar-2026*

# EPIC Template

> **Document Flow:** BRD → FRD → Initiative → **EPIC** → User Stories → Tasks → Subtasks
>
> An EPIC is a large body of work under an Initiative, representing a distinct feature set
> or capability. It is broken down into User Stories for sprint execution.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EPIC ID         : EPIC-[XXX]
Created Date    : DD-MMM-YYYY
Last Updated    : DD-MMM-YYYY
Status          : [ Draft | In Review | Approved | In Progress | Done ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Table of Contents

| # | Section |
| --- | --- |
| — | Reference Documents |
| 1 | EPIC Name |
| 2 | Initiative Reference |
| 3 | Summary |
| 4 | Description (4a. Key Actors / 4b. High-Level Flow) |
| 5 | Pre-requisites |
| 6 | Trigger |
| 7 | Scope (7a. Modules / 7b. Features / 7c. Edge Cases) |
| 8 | Acceptance Criteria |
| 9 | Non-Functional Requirements (Performance / Security / Reliability / Availability / Scalability) |
| 10 | Business Value |
| 11 | Integration with Other EPICs |
| 12 | Out of Scope |
| 13 | Risks & Challenges |
| — | Revision History |

---

## Reference Documents

> **Guideline:** List all source documents that this EPIC is derived from or refers to.
> This section establishes the complete traceability chain from business requirement
> documents down to this EPIC. Every document that contains requirements, decisions,
> constraints, or context that influenced this EPIC must be listed here.
>
> Document types may include:
>
> - **BRD** (Business Requirements Document) — original business need from the customer/stakeholder
> - **FRD** (Functional Requirements Document) — detailed functional specifications
> - **SRS** (Software Requirements Specification) — technical requirements
> - **SOW** (Statement of Work) — contractual scope document
> - **Meeting Minutes / Decision Log** — key decisions that shaped this EPIC
> - **Wireframes / Prototypes** — UI/UX design references
> - **API Contracts / Interface Specs** — third-party or internal API documentation
> - **Compliance / Regulatory Docs** — legal or industry standards referenced
>
> For each document, record the exact section or page reference so that any reader
> can quickly locate the originating requirement without searching the whole document.

```
| Sr No | Document Type | Document Name / Title          | Version   | Section / Page Reference        | Owner / Author      | Location / Link                        |
|-------|---------------|--------------------------------|-----------|---------------------------------|---------------------|----------------------------------------|
| 1     | [Type]        | [Document Name]                | [vX.X]    | [Section # or Page #]           | [Name / Team]       | [File path, SharePoint URL, Confluence]|

Example:
| Sr No | Document Type  | Document Name / Title              | Version | Section / Page Reference              | Owner / Author     | Location / Link                          |
|-------|----------------|------------------------------------|---------|---------------------------------------|--------------------|------------------------------------------|
| 1     | BRD            | BRD_CustomerPortal                 | v2.1    | Section 3.2 — Digital Onboarding      | Business Analysis  | SharePoint: /Projects/BRD/v2.1.docx      |
| 2     | FRD            | FRD_CustomerPortal                 | v1.0    | Section 5 — Customer Acquisition Flow | Product Team       | SharePoint: /Projects/FRD/v1.0.docx      |
| 3     | Wireframes     | Onboarding UX Prototype            | v3      | Screens: REG-01 to REG-09             | UX Design Team     | Figma: /designs/onboarding-v3            |
| 4     | API Contract   | KYC Vendor API Specification       | v1.2    | Endpoints: /verify, /status           | Vendor / IT        | Confluence: /integrations/kyc-api-spec   |
| 5     | Regulatory Doc | DPDP Act 2023 — Data Privacy Rules | 2023    | Chapter 3 — Processing of PII         | Legal / Compliance | Legal Drive: /compliance/dpdp-act-2023   |
| 6     | Meeting Minutes| KYC Integration Design Decision    | —       | Decision: Use adapter pattern         | Architect / PO     | Confluence: /decisions/kyc-design-log    |
```

---

## 1. EPIC Name

> **Guideline:** A concise name that uniquely identifies the capability being built.
> Should be self-explanatory and distinguishable from other EPICs in the same Initiative.
> Avoid technical abbreviations that business stakeholders may not understand.

```
[Name of the EPIC]

Example: "Customer Registration & KYC Verification"
```

---

## 2. Initiative Reference

> **Guideline:** Link this EPIC to its parent Initiative for full traceability.
> Every EPIC must belong to exactly one Initiative. This ensures the EPIC can always
> be traced back to the originating business requirement in the BRD/FRD.

```
Initiative ID   : INIT-[XXX]
Initiative Name : [Name of the Parent Initiative]

Example:
  Initiative ID   : INIT-001
  Initiative Name : Unified Digital Onboarding Platform
```

---

## 3. Summary

> **Guideline:** A 2–3 sentence functional overview of what this EPIC delivers.
> Should answer: *What capability does this EPIC enable — for whom — and why does it matter?*
> Avoid deep technical detail here; keep it readable for both business and technical audiences.

```
[2–3 sentence functional summary]

Example:
  This EPIC covers the end-to-end flow for a new customer to register on the
  portal and complete their KYC verification digitally. It includes identity
  document capture, real-time verification via a third-party API, and
  approval/rejection workflows for the operations team.
```

---

## 4. Description

> **Guideline:** A detailed narrative of the EPIC covering business context, user journey,
> and system flow. This section is split into two structured sub-sections:
> **4a. Key Actors** and **4b. High-Level Flow**.
> Together they provide a complete picture of who is involved and how the process unfolds.

### 4a. Key Actors

> **Guideline:** List all personas, users, systems, and external parties that interact
> with or are affected by this EPIC. For each actor, describe their role and
> their primary interaction with the system within this EPIC's scope.
> Actors can be human (end users, internal staff) or non-human (external APIs, systems).

```
| Actor Type    | Actor Name / Role              | Interaction / Responsibility                              |
|---------------|--------------------------------|-----------------------------------------------------------|
| Primary User  | [Name / Role]                  | [What this actor does in the EPIC flow]                   |
| Internal User | [Name / Role]                  | [What this actor does in the EPIC flow]                   |
| System        | [System / Service Name]        | [How this system participates]                            |
| External      | [Third-party / API Name]       | [What external service is involved and why]               |

Example:
| Actor Type    | Actor Name / Role              | Interaction / Responsibility                              |
|---------------|--------------------------------|-----------------------------------------------------------|
| Primary User  | New Customer                   | Initiates registration, fills form, uploads documents     |
| Internal User | Operations Executive           | Reviews flagged KYC cases, approves or rejects manually   |
| Internal User | Compliance Officer             | Audits KYC records; sets verification rules               |
| System        | OCR Service                    | Extracts text data from uploaded identity documents       |
| External      | Third-Party KYC API            | Performs real-time identity validation against govt DB    |
| System        | Notification Service (EPIC-004)| Sends email/SMS alerts on registration status changes     |
```

---

### 4b. High-Level Flow

> **Guideline:** Describe the end-to-end process flow at a high level using numbered steps.
> Each step should represent a meaningful action or system event. Include decision points,
> branching paths (happy path and alternate/exception paths), and where the flow ends.
> This is a narrative flow — detailed screen/API specs belong in User Stories.

```
[Numbered step-by-step high-level flow]

Example:

  HAPPY PATH:
  ──────────
  Step 1 : Customer navigates to the registration page and enters personal details
           (name, DOB, email, phone).
  Step 2 : System validates entered data format and checks for duplicate accounts.
  Step 3 : Customer uploads identity documents (Aadhaar, PAN, Passport — any one).
  Step 4 : System performs format and file size validation on uploaded document.
  Step 5 : OCR Service extracts data from the document and matches it against
           the customer-entered details.
  Step 6 : System invokes the Third-Party KYC API with extracted identity data.
  Step 7 : KYC API returns a "Verified" response.
  Step 8 : Customer account is activated and a welcome email/SMS is triggered.
  Step 9 : Customer is redirected to the onboarding dashboard.

  ALTERNATE / EXCEPTION PATHS:
  ────────────────────────────
  Alt-1 : Duplicate account detected at Step 2
            → Block registration, show error with login/recovery options.

  Alt-2 : Document is blurry or unreadable at Step 4
            → Prompt customer to re-upload; max 3 attempts allowed.

  Alt-3 : OCR data does not match entered details at Step 5
            → Flag for manual review; route to Operations Executive queue.

  Alt-4 : KYC API returns "Failed" at Step 7
            → Send rejection notification with reason code and next steps.

  Alt-5 : KYC API is unavailable (timeout/error) at Step 6
            → Retry up to 3 times; if still failing, queue for manual verification.

  Alt-6 : Customer abandons mid-flow
            → Save progress; allow resume within 72 hours via saved link.
```

---

## 5. Pre-requisites

> **Guideline:** List everything that must be in place BEFORE this EPIC can begin execution
> or deliver its outcomes. Pre-requisites fall into three categories:
>
> - **EPIC Dependencies** — Other EPICs (or specific features within them) that must be
>   completed or at a certain stage before this EPIC can start or finish.
> - **Feature / Functional Dependencies** — Specific features, APIs, data, or system
>   capabilities (outside any EPIC) that this EPIC depends on being available.
> - **Non-Technical Pre-requisites** — Approvals, contracts, legal clearances, environment
>   setup, or team readiness that must be confirmed before work begins.
>
> For each pre-requisite, indicate whether it is a Hard Dependency (blocks start/progress)
> or a Soft Dependency (preferred but not blocking).

### 5a. EPIC Dependencies

> **Guideline:** List other EPICs that must be fully or partially complete before this EPIC
> can begin or reach completion. Specify the minimum state required (e.g., "Done", "In Progress",
> "Feature F-XXX must be live"). This directly informs sprint sequencing and release planning.

```
| Dependency ID | EPIC ID  | EPIC Name                      | Required State / Feature          | Dependency Type     |
|---------------|----------|--------------------------------|-----------------------------------|---------------------|
| DEP-01        | EPIC-[X] | [Name of prerequisite EPIC]    | [Minimum state required]          | Hard / Soft         |

Example:
| Dependency ID | EPIC ID  | EPIC Name                      | Required State / Feature          | Dependency Type     |
|---------------|----------|--------------------------------|-----------------------------------|---------------------|
| DEP-01        | EPIC-005 | Identity & Access Management   | User account schema must be Done  | Hard — blocks start |
| DEP-02        | EPIC-004 | Notification & Communication   | Email templates must be approved  | Hard — blocks UAT   |
| DEP-03        | EPIC-002 | Document Storage Service       | Upload API must be In Progress    | Soft — parallel OK  |
```

---

### 5b. Feature / Functional Dependencies

> **Guideline:** List specific features, APIs, data sets, integrations, or system capabilities
> that this EPIC requires but that do not belong to any EPIC in this Initiative.
> Examples include: third-party API availability, shared platform services, master data,
> or infrastructure components that another team owns.

```
| Dependency ID | Type              | Name / Description                            | Owner / Provider      | Required By         |
|---------------|-------------------|-----------------------------------------------|-----------------------|---------------------|
| DEP-04        | [API/Data/Service]| [Name and brief description]                  | [Team or vendor]      | [Sprint or Phase]   |

Example:
| Dependency ID | Type              | Name / Description                            | Owner / Provider      | Required By         |
|---------------|-------------------|-----------------------------------------------|-----------------------|---------------------|
| DEP-04        | Third-Party API   | KYC Verification API (vendor contract signed) | Procurement / Vendor  | Sprint 2            |
| DEP-05        | Infrastructure    | Cloud object storage bucket for documents     | IT / DevOps Team      | Sprint 1            |
| DEP-06        | Master Data       | Country and document type reference data      | Data Engineering Team | Sprint 1            |
| DEP-07        | Shared Service    | OCR engine library licensed and deployed      | Platform Team         | Sprint 2            |
```

---

### 5c. Non-Technical Pre-requisites

> **Guideline:** List approvals, legal sign-offs, contractual agreements, environment
> readiness, compliance clearances, or team onboarding that must be confirmed before
> this EPIC's development can begin or its output can go live.

```
| Dependency ID | Pre-requisite Description                          | Owner               | Target Date   | Status        |
|---------------|----------------------------------------------------|---------------------|---------------|---------------|
| DEP-08        | [What must be confirmed or approved]               | [Responsible party] | DD-MMM-YYYY   | [Status]      |

Example:
| Dependency ID | Pre-requisite Description                          | Owner               | Target Date   | Status        |
|---------------|----------------------------------------------------|---------------------|---------------|---------------|
| DEP-08        | Legal sign-off on digital consent form wording     | Legal Team          | 31-Mar-2026   | In Review     |
| DEP-09        | DPDP Act 2023 compliance review completed          | Legal / Compliance  | 15-Apr-2026   | Not Started   |
| DEP-10        | UAT environment provisioned and accessible         | IT / DevOps         | 01-Apr-2026   | In Progress   |
| DEP-11        | Operations team trained on manual review dashboard | L&D / Ops Manager   | 01-Jun-2026   | Not Started   |
```

---

## 6. Trigger

> **Guideline:** Describe what initiates or activates this EPIC. A trigger is the event,
> condition, action, or milestone that causes this EPIC's flow to begin. Triggers can be:
>
> - **EPIC-Based** — Completion or a specific output from another EPIC starts this EPIC.
> - **Feature-Based** — A particular feature going live activates this EPIC's execution.
> - **Business Event** — A business milestone, product launch, or external event kicks off
>   this EPIC (e.g., campaign launch, regulatory deadline, partner go-live).
> - **User / System Action** — A specific user action or system state change initiates
>   the flow within this EPIC (runtime trigger, not just a planning trigger).
> - **Manual / Scheduled** — This EPIC is triggered by a planned sprint, release schedule,
>   or a manual decision by the Product Owner or business stakeholder.
>
> Distinguish between the **Planning Trigger** (what causes this EPIC to be picked up for
> development) and the **Runtime Trigger** (what initiates the EPIC's flow in production).

### 6a. Planning Trigger

> **Guideline:** What must happen for this EPIC to be pulled into active development?
> This is typically a dependency being met, a business decision, or a phase gate being passed.

```
| Trigger ID | Trigger Type        | Trigger Description                                            |
|------------|---------------------|----------------------------------------------------------------|
| TRG-01     | [Type]              | [What event or condition causes this EPIC to begin work]       |

Example:
| Trigger ID | Trigger Type        | Trigger Description                                            |
|------------|---------------------|----------------------------------------------------------------|
| TRG-01     | EPIC-Based          | EPIC-005 (Identity & Access Management) reaches "Done" status  |
| TRG-02     | Business Event      | Digital Onboarding Initiative is approved and funded (INIT-001)|
| TRG-03     | Feature-Based       | Cloud infrastructure setup (DEP-05) confirmed ready by IT      |
```

---

### 6b. Runtime Trigger

> **Guideline:** What event or action starts the flow of this EPIC in the live production
> system? This is the in-system trigger — the moment the EPIC's functionality activates
> for a real user or system process. Be specific about the initiating condition.

```
| Trigger ID | Trigger Type        | Trigger Description                                            |
|------------|---------------------|----------------------------------------------------------------|
| TRG-04     | [Type]              | [What event starts this EPIC's flow at runtime in production]  |

Example:
| Trigger ID | Trigger Type        | Trigger Description                                            |
|------------|---------------------|----------------------------------------------------------------|
| TRG-04     | User Action         | Customer clicks "Register Now" on the public-facing portal     |
| TRG-05     | System Event        | New customer record created in CRM with status "Pending KYC"   |
| TRG-06     | EPIC Output         | EPIC-002 document upload confirmed; OCR extraction job queued  |
| TRG-07     | Scheduled           | Nightly batch re-queues all pending KYC cases older than 24hrs |
```

---

## 7. Scope

> **Guideline:** Define the boundaries of what this EPIC covers across three dimensions:
> Modules (system components), Features (functional capabilities), and Edge Cases
> (boundary/non-standard scenarios). Together these three sub-sections form the
> complete scope definition of the EPIC.

### 7a. Modules

> **Guideline:** List all application modules or system components involved in this EPIC.
> Modules are high-level functional groupings such as UI screens, backend microservices,
> integrations, or data components. Each module listed here must have at least one
> feature mapped to it in Section 7b.

```
| Module ID | Module Name                  | Description                                               |
|-----------|------------------------------|-----------------------------------------------------------|
| MOD-01    | [Module Name]                | [Brief description of this module's role in the EPIC]    |
| MOD-02    | [Module Name]                | [Brief description of this module's role in the EPIC]    |

Example:
| Module ID | Module Name                  | Description                                               |
|-----------|------------------------------|-----------------------------------------------------------|
| MOD-01    | Registration UI              | Web forms for customer personal data entry                |
| MOD-02    | Document Upload Service      | File upload, format validation, and secure storage        |
| MOD-03    | OCR & Data Extraction Engine | Text extraction and parsing from uploaded documents       |
| MOD-04    | KYC API Integration Layer    | Third-party identity verification service connector       |
| MOD-05    | Ops Review Dashboard         | Internal tool for manual case review and approval         |
| MOD-06    | Notification Service         | Email and SMS alerts for registration status updates      |
```

---

### 7b. Features

> **Guideline:** List all features/functionalities to be built within this EPIC.
> Each feature must be mapped to its parent Module for clear ownership and traceability.
> The **FRD / BRD Reference** column links each feature back to the exact section or
> requirement ID in the source document where it was originally specified — providing
> full traceability from requirement to delivery.
> Priority indicates the delivery order: High = Must Have (MVP), Medium = Should Have,
> Low = Nice to Have. Each feature will typically generate one or more User Stories.

```
| Sr No | Module Name                  | Feature ID | Feature Name                              | Priority | FRD / BRD Reference                  |
|-------|------------------------------|------------|-------------------------------------------|----------|---------------------------------------|
| 1     | [Module Name]                | F-[XXX]    | [Feature Name]                            | High     | [Doc Name] / [Section # or Req ID]   |
| 2     | [Module Name]                | F-[XXX]    | [Feature Name]                            | Medium   | [Doc Name] / [Section # or Req ID]   |
| 3     | [Module Name]                | F-[XXX]    | [Feature Name]                            | Low      | [Doc Name] / [Section # or Req ID]   |

Example:
| Sr No | Module Name                  | Feature ID | Feature Name                              | Priority | FRD / BRD Reference                  |
|-------|------------------------------|------------|-------------------------------------------|----------|---------------------------------------|
| 1     | Registration UI              | F-001      | Multi-step registration form              | High     | FRD v1.0 / Sec 5.1 — REQ-101        |
| 2     | Registration UI              | F-002      | Registration progress save and resume     | Medium   | FRD v1.0 / Sec 5.1 — REQ-102        |
| 3     | Document Upload Service      | F-003      | Document upload (JPG, PNG, PDF — max 5MB) | High     | FRD v1.0 / Sec 5.2 — REQ-201        |
| 4     | Document Upload Service      | F-004      | File format and size validation           | High     | FRD v1.0 / Sec 5.2 — REQ-202        |
| 5     | OCR & Data Extraction Engine | F-005      | Real-time OCR text extraction             | High     | BRD v2.1 / Sec 3.2 — BR-045         |
| 6     | OCR & Data Extraction Engine | F-006      | OCR data vs. entered data matching        | High     | BRD v2.1 / Sec 3.2 — BR-046         |
| 7     | KYC API Integration Layer    | F-007      | KYC API request and response handling     | High     | FRD v1.0 / Sec 5.3 — REQ-301        |
| 8     | KYC API Integration Layer    | F-008      | KYC retry logic and fallback to manual    | High     | FRD v1.0 / Sec 5.3 — REQ-302        |
| 9     | Ops Review Dashboard         | F-009      | Manual review queue for flagged cases     | Medium   | FRD v1.0 / Sec 5.4 — REQ-401        |
| 10    | Ops Review Dashboard         | F-010      | Approve / Reject action with audit log    | Medium   | BRD v2.1 / Sec 3.4 — BR-078         |
| 11    | Notification Service         | F-011      | Email notification on KYC status update   | Medium   | FRD v1.0 / Sec 5.5 — REQ-501        |
| 12    | Notification Service         | F-012      | SMS notification on KYC status update     | Low      | FRD v1.0 / Sec 5.5 — REQ-502        |
```

---

### 7c. Edge Cases

> **Guideline:** Identify non-standard, boundary, or exception scenarios that the system
> must explicitly handle within this EPIC. Edge cases often expose gaps in the main flow
> and are critical for preventing production defects. For each edge case, describe the
> trigger condition and the expected system behaviour.

```
| EC ID | Trigger Condition                                   | Expected System Behaviour                                   |
|-------|-----------------------------------------------------|-------------------------------------------------------------|
| EC-01 | [What unusual condition triggers this edge case]    | [How the system must respond]                               |

Example:
| EC ID | Trigger Condition                                   | Expected System Behaviour                                   |
|-------|-----------------------------------------------------|-------------------------------------------------------------|
| EC-01 | Customer uploads a blurry or unreadable document    | Reject file, prompt re-upload with guidance; max 3 attempts |
| EC-02 | KYC API returns timeout or service unavailable      | Retry up to 3 times; if still failing, queue for manual ops |
| EC-03 | Name on document differs from entered name (typo)   | Apply fuzzy match tolerance; flag if confidence < 85%       |
| EC-04 | Duplicate registration with same email or phone     | Block with clear message; provide login and recovery links  |
| EC-05 | Customer abandons mid-flow and returns after 24 hrs | Restore last saved step; session valid for 72 hours         |
| EC-06 | Uploaded document is expired                        | Reject with specific error; prompt upload of valid document |
| EC-07 | Customer age is below 18 years                      | Redirect to guardian-assisted onboarding flow               |
| EC-08 | Same document uploaded multiple times               | Detect duplicate hash; prevent re-processing                |
```

---

## 8. Acceptance Criteria

> **Guideline:** Define the conditions that must be met for this EPIC to be considered DONE.
> Write in clear, testable, and unambiguous language. These are high-level criteria that
> roll up from individual User Story acceptance criteria. Use Given-When-Then (GWT) format
> where applicable to make criteria verifiable during UAT.

```
| AC ID | Acceptance Criterion                                                                          |
|-------|-----------------------------------------------------------------------------------------------|
| AC-01 | [Clear, testable condition using GWT or plain statement]                                      |

Example:
| AC ID | Acceptance Criterion                                                                          |
|-------|-----------------------------------------------------------------------------------------------|
| AC-01 | A new customer can complete registration and KYC in under 10 minutes on standard broadband.   |
| AC-02 | Given a valid, legible document is uploaded, when OCR completes, then data accuracy >= 95%.   |
| AC-03 | Given KYC API returns "Verified", then account status is set to "Active" within 30 seconds.   |
| AC-04 | Given KYC API returns "Failed", then customer receives rejection email within 2 minutes.       |
| AC-05 | All document uploads are encrypted at rest (AES-256) and in transit (TLS 1.2+).              |
| AC-06 | Registration form is WCAG 2.1 AA accessible (screen reader and keyboard navigation).          |
| AC-07 | System handles 500 concurrent registration sessions with page response time under 3 seconds.  |
| AC-08 | All KYC decisions (approve/reject) are recorded in an immutable audit log with timestamp.     |
```

---

## 9. Non-Functional Requirements

> **Guideline:** Non-Functional Requirements (NFRs) define the operational quality
> characteristics of the system — not *what* it does, but *how well* it does it.
> Unlike functional requirements that describe features and flows, NFRs set measurable
> standards for system behaviour under various conditions.
>
> Each sub-section below covers one NFR dimension. For every requirement, specify:
>
> - The **metric** or measurable threshold
> - The **condition** under which it applies (normal load, peak load, failure scenario)
> - The **verification method** (how it will be tested or measured)
>
> NFRs form part of the Definition of Done and must be validated before the EPIC is closed.

---

### 9a. Performance

> **Guideline:** Define the speed, responsiveness, and throughput standards the system
> must meet. Performance requirements typically cover response times, processing times,
> transaction throughput, and data processing capacity. Specify requirements for both
> normal operating conditions and peak/stress conditions.
> These are validated through load testing, stress testing, and profiling.

```
| NFR ID  | Requirement Description                                          | Metric / Threshold          | Condition              | Verification Method        |
|---------|------------------------------------------------------------------|-----------------------------|------------------------|----------------------------|
| PER-001 | [What performance behaviour is required]                         | [Measurable target]         | [When / under what load| [How it will be tested]    |

Example:
| NFR ID  | Requirement Description                                          | Metric / Threshold          | Condition              | Verification Method        |
|---------|------------------------------------------------------------------|-----------------------------|------------------------|----------------------------|
| PER-001 | Registration form page load time                                 | < 2 seconds                 | Normal load (100 users)| Load test — JMeter         |
| PER-002 | Registration form page load time                                 | < 3 seconds                 | Peak load (500 users)  | Stress test — JMeter       |
| PER-003 | Document upload processing time (OCR + validation)              | < 10 seconds per document   | Normal load            | Performance test            |
| PER-004 | KYC API call round-trip response time                            | < 5 seconds                 | Normal conditions      | API response time monitoring|
| PER-005 | End-to-end registration flow completion time                     | < 10 minutes                | Standard broadband     | E2E test with timer         |
| PER-006 | Ops review dashboard page load with 1,000 records               | < 3 seconds                 | Normal load            | Browser performance profiler|
```

---

### 9b. Security

> **Guideline:** Define the security controls, data protection standards, and access
> management requirements that this EPIC must comply with. Security NFRs cover
> authentication, authorisation, data encryption, audit logging, vulnerability standards,
> and regulatory compliance. These are validated through security reviews, penetration
> testing, and compliance audits.
> Every EPIC handling PII (Personally Identifiable Information) must address this section.

```
| NFR ID  | Requirement Description                                          | Standard / Control          | Applies To             | Verification Method        |
|---------|------------------------------------------------------------------|-----------------------------|------------------------|----------------------------|
| SEC-001 | [What security control or standard must be met]                  | [Standard or specification] | [Component / data]     | [How it will be verified]  |

Example:
| NFR ID  | Requirement Description                                          | Standard / Control          | Applies To             | Verification Method        |
|---------|------------------------------------------------------------------|-----------------------------|------------------------|----------------------------|
| SEC-001 | All data transmitted between client and server must be encrypted | TLS 1.2 or higher           | All API and UI traffic | SSL/TLS scan — SSL Labs    |
| SEC-002 | All PII and document data stored at rest must be encrypted       | AES-256 encryption          | Document storage       | Infrastructure audit        |
| SEC-003 | Authentication must use industry-standard token mechanism        | JWT with expiry <= 30 min   | All authenticated APIs | Security code review        |
| SEC-004 | All user inputs must be sanitised to prevent injection attacks   | OWASP Top 10 compliance     | Registration form      | DAST scan — OWASP ZAP      |
| SEC-005 | Access to Ops Review Dashboard restricted to authorised roles    | RBAC — Ops Executive role   | Dashboard module       | Role-based access test      |
| SEC-006 | All KYC approval/rejection actions must be recorded in audit log | Immutable audit trail       | Ops Dashboard          | Audit log verification      |
| SEC-007 | Customer PII must not appear in application logs or error traces | PII masking in logs         | All modules            | Log inspection review       |
| SEC-008 | Failed login attempts must trigger account lockout               | 5 failed attempts → lockout | Registration / Login   | Security test                |
```

---

### 9c. Reliability

> **Guideline:** Define the system's ability to perform its required functions consistently
> and without failure over a specified time period. Reliability NFRs cover error rates,
> failure tolerance, data integrity, and recovery from partial failures.
> These are validated through fault injection testing, error rate monitoring, and
> long-duration soak tests.

```
| NFR ID  | Requirement Description                                          | Metric / Threshold          | Condition              | Verification Method        |
|---------|------------------------------------------------------------------|-----------------------------|------------------------|----------------------------|
| REL-001 | [What reliability behaviour is required]                         | [Measurable target]         | [Condition]            | [How it will be tested]    |

Example:
| NFR ID  | Requirement Description                                          | Metric / Threshold          | Condition              | Verification Method        |
|---------|------------------------------------------------------------------|-----------------------------|------------------------|----------------------------|
| REL-001 | System error rate for registration submissions                   | < 0.1% error rate           | Normal operation       | Production monitoring       |
| REL-002 | KYC API failure must not cause data loss                         | Zero data loss on API fail   | API timeout / failure  | Fault injection test        |
| REL-003 | Incomplete registrations must be recoverable                     | Resume within 72 hours       | Mid-flow abandonment   | Recovery scenario test      |
| REL-004 | OCR failure must fall back to manual ops queue gracefully        | No silent failures           | OCR engine error       | Fault injection test        |
| REL-005 | Document upload must be idempotent                               | No duplicate records created | Retry on network fail  | Idempotency test            |
| REL-006 | All critical errors must trigger alerts to the on-call team      | Alert within 2 minutes       | P1 / P2 errors         | Alert simulation test       |
```

---

### 9d. Availability

> **Guideline:** Define the uptime, downtime tolerance, and maintenance window requirements
> for the system. Availability is typically expressed as a percentage of time the system
> must be operational. Also include Recovery Time Objective (RTO) — the maximum acceptable
> time to restore service after a failure — and Recovery Point Objective (RPO) — the
> maximum acceptable data loss measured in time.
> These are validated through uptime monitoring, disaster recovery drills, and SLA reviews.

```
| NFR ID  | Requirement Description                                          | Metric / Threshold          | Condition              | Verification Method        |
|---------|------------------------------------------------------------------|-----------------------------|------------------------|----------------------------|
| AVL-001 | [What availability target or recovery objective is required]     | [Measurable target]         | [Condition]            | [How it will be verified]  |

Example:
| NFR ID  | Requirement Description                                          | Metric / Threshold          | Condition              | Verification Method        |
|---------|------------------------------------------------------------------|-----------------------------|------------------------|----------------------------|
| AVL-001 | Customer-facing registration portal uptime                       | >= 99.9% per month          | Production             | Uptime monitoring — Pingdom|
| AVL-002 | Internal Ops Review Dashboard uptime                             | >= 99.5% during business hrs| Business hours only    | Uptime monitoring           |
| AVL-003 | Planned maintenance window (downtime allowed)                    | Max 2 hrs/month, off-peak   | Scheduled maintenance  | Maintenance schedule review |
| AVL-004 | Recovery Time Objective (RTO) after critical failure             | <= 1 hour                   | P1 production failure  | DR drill test               |
| AVL-005 | Recovery Point Objective (RPO) — maximum acceptable data loss   | <= 15 minutes               | Database failure       | Backup and restore test     |
| AVL-006 | KYC API third-party dependency downtime handling                 | Failover within 30 seconds  | Vendor API outage      | Failover test               |
```

---

### 9e. Scalability

> **Guideline:** Define the system's ability to handle growing workloads — both in terms
> of increasing user volume (horizontal scalability) and increasing data volume (vertical
> scalability). Include auto-scaling thresholds, data growth projections, and limits the
> system must handle without architectural changes.
> These are validated through load testing, capacity planning reviews, and autoscaling tests.

```
| NFR ID  | Requirement Description                                          | Metric / Threshold          | Condition              | Verification Method        |
|---------|------------------------------------------------------------------|-----------------------------|------------------------|----------------------------|
| SCL-001 | [What scalability characteristic is required]                    | [Measurable target]         | [Condition]            | [How it will be tested]    |

Example:
| NFR ID  | Requirement Description                                          | Metric / Threshold          | Condition              | Verification Method        |
|---------|------------------------------------------------------------------|-----------------------------|------------------------|----------------------------|
| SCL-001 | System must support concurrent user registrations                | 500 concurrent users        | Peak load              | Load test — JMeter          |
| SCL-002 | System must auto-scale under increased load without manual ops   | Scale out at 70% CPU usage  | Traffic spike          | Autoscaling trigger test    |
| SCL-003 | System must scale down after traffic normalises (cost efficiency)| Scale in at 30% CPU usage   | Post-peak cooldown     | Autoscaling trigger test    |
| SCL-004 | Document storage must handle projected data growth               | 10TB initial, 2TB/month     | 12-month projection    | Capacity planning review    |
| SCL-005 | Database must handle growing KYC records without query degradation| < 3s query time at 5M rows | Production data volume | DB performance test         |
| SCL-006 | System must support 10x user growth without architecture change  | 5,000 concurrent users      | Future growth scenario | Architecture review + test  |
```

---

## 10. Business Value

> **Guideline:** Articulate the tangible and intangible value this EPIC delivers to the
> business. Include quantitative benefits (cost savings, revenue, capacity) and qualitative
> benefits (compliance, user experience, risk reduction). This section justifies the EPIC's
> prioritization in the backlog and helps stakeholders understand the return on investment.

```
QUANTITATIVE BENEFITS:
  [Measurable impact — time saved, cost reduced, capacity increased, revenue gained]

  Example:
    - Reduces average onboarding TAT from 5 days to 4 hours (95% reduction)
    - Eliminates 3 FTE manual verification roles (cost saving: ~₹18L/year)
    - Increases daily registration capacity from 200 to 2,000 customers

QUALITATIVE BENEFITS:
  [Non-measurable but important impact — brand, compliance, experience, risk]

  Example:
    - Improves customer first impression and NPS score
    - Reduces compliance risk via standardized, auditable digital KYC trail
    - Enables 24x7 onboarding with no branch dependency
    - Positions product competitively against digital-native fintech players
```

---

## 11. Integration with Other EPICs

> **Guideline:** Document how this EPIC interacts with other EPICs in the same Initiative
> or across Initiatives. Classify each relationship using the Master-Slave model:
>
> - **Master EPIC** — This EPIC *consumes* features or services provided by another EPIC.
>   (Think of Master as the "caller" or "consumer".)
> - **Slave EPIC** — This EPIC *provides* features or services to another EPIC.
>   (Think of Slave as the "provider" or "dependency".)
>
> Also note sequencing constraints: which EPICs must complete before this one can begin,
> or which EPICs depend on this one completing first.

```
CURRENT EPIC: EPIC-[XXX] — [EPIC Name]

─────────────────────────────────────────────────────────────────────
THIS EPIC AS MASTER (consumes services/features FROM these EPICs):
─────────────────────────────────────────────────────────────────────
| EPIC ID  | EPIC Name                        | Service / Feature Consumed               |
|----------|----------------------------------|------------------------------------------|
| EPIC-[X] | [Name of the providing EPIC]     | [Specific feature or service consumed]   |

Example:
| EPIC ID  | EPIC Name                        | Service / Feature Consumed               |
|----------|----------------------------------|------------------------------------------|
| EPIC-004 | Notification & Communication Hub | Email/SMS trigger on KYC status changes  |
| EPIC-005 | Identity & Access Management     | User account creation post-KYC approval  |

─────────────────────────────────────────────────────────────────────
THIS EPIC AS SLAVE (provides services/features TO these EPICs):
─────────────────────────────────────────────────────────────────────
| EPIC ID  | EPIC Name                        | Service / Feature Provided               |
|----------|----------------------------------|------------------------------------------|
| EPIC-[X] | [Name of the consuming EPIC]     | [Specific feature or service provided]   |

Example:
| EPIC ID  | EPIC Name                        | Service / Feature Provided               |
|----------|----------------------------------|------------------------------------------|
| EPIC-003 | Account Provisioning             | Verified customer identity record        |
| EPIC-006 | Reporting & Analytics Dashboard  | Registration funnel events and data      |

─────────────────────────────────────────────────────────────────────
SEQUENCING CONSTRAINTS:
─────────────────────────────────────────────────────────────────────
  [Document any ordering dependencies between EPICs]

  Example:
    - This EPIC (EPIC-001) must reach "Done" BEFORE EPIC-003 (Account Provisioning) can begin.
    - EPIC-004 (Notification Hub) must have email templates ready BEFORE this EPIC's UAT phase.
    - No blocking dependency on EPIC-006 — analytics integration can run in parallel.
```

---

## 12. Out of Scope

> **Guideline:** Explicitly list what is NOT included in this EPIC. This section is critical
> to eliminate grey areas, prevent scope creep, and align stakeholder expectations before
> development begins. For each exclusion, reference where that item IS being handled
> (another EPIC, Phase 2, or a separate decision) if known.

```
| # | Excluded Item                                        | Reason / Where It Is Handled          |
|---|------------------------------------------------------|----------------------------------------|
| 1 | [What is excluded]                                   | [Why excluded or where it belongs]     |

Example:
| # | Excluded Item                                        | Reason / Where It Is Handled          |
|---|------------------------------------------------------|----------------------------------------|
| 1 | Corporate / B2B customer onboarding                  | Separate EPIC — EPIC-009               |
| 2 | Mobile app (iOS/Android) registration flow           | Phase 2 — future Initiative            |
| 3 | Biometric / facial recognition verification          | Future enhancement — not in roadmap    |
| 4 | Re-KYC for existing customers                        | Separate EPIC — EPIC-010               |
| 5 | Backend admin tool for KYC rule configuration        | Separate EPIC — EPIC-007               |
| 6 | Multi-language support (Hindi, regional languages)   | Phase 2                                |
| 7 | Migration of existing offline customer records       | Separate Initiative — INIT-002         |
```

---

## 13. Risks & Challenges

> **Guideline:** Identify known risks, technical challenges, third-party dependencies,
> and open questions that could impact this EPIC's delivery. For each risk, provide a
> mitigation strategy. Rate Likelihood and Impact as: High / Medium / Low.
> This section enables proactive management rather than reactive firefighting.

```
| Risk ID | Risk / Challenge Description                    | Likelihood | Impact | Mitigation Strategy                                    |
|---------|-------------------------------------------------|------------|--------|--------------------------------------------------------|
| R-001   | [Description of the risk or challenge]          | H/M/L      | H/M/L  | [How this risk will be avoided or minimized]           |

Example:
| Risk ID | Risk / Challenge Description                    | Likelihood | Impact | Mitigation Strategy                                    |
|---------|-------------------------------------------------|------------|--------|--------------------------------------------------------|
| R-001   | KYC API vendor delays contract finalization     | Medium     | High   | Identify backup vendor; build adapter pattern in code  |
| R-002   | OCR accuracy falls below 95% threshold         | Medium     | High   | Run POC with 3 OCR libraries; set manual fallback      |
| R-003   | DPDP Act 2023 compliance gaps in PII handling  | Low        | High   | Legal review in Sprint 1; encrypt all PII fields       |
| R-004   | High concurrent load during marketing campaign | Medium     | Medium | Load test at 2x peak; configure autoscaling policy     |
| R-005   | Legacy CRM integration latency                 | High       | Medium | Use async message queue instead of synchronous API     |
| R-006   | Scope creep from stakeholders post-approval    | High       | Medium | Freeze scope at Sprint 0; use Change Request process   |
```

---

## Revision History

> **Guideline:** Track all significant changes to this EPIC document for auditability.

```
| Version | Date         | Author         | Changes Made                              |
|---------|--------------|----------------|-------------------------------------------|
| 1.0     | DD-MMM-YYYY  | [Author Name]  | Initial draft                             |
| 1.1     | DD-MMM-YYYY  | [Author Name]  | [Brief description of changes]            |
```

---

*Template Version: 2.1 | Last Reviewed: 25-Mar-2026*

# Product Requirements Document (PRD) Template

> **Document Flow:** **PRD** → BRD → FRD → Initiative → EPICs → User Stories → Tasks → Subtasks
>
> The PRD is the **single source of truth** for the product being built. It defines the what, why,
> and for whom — bridging business intent with product execution. It forms the foundation from which
> all downstream documents (BRD, FRD, Initiatives, EPICs, User Stories) are derived.
> Every functional feature, integration, NFR, compliance mandate, and delivery expectation defined
> here must trace into one or more EPICs and User Stories in the backlog.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRD ID          : PRD-[XXX]
Product Name    : [Product / Application Name]
Version         : [1.0]
Created Date    : DD-MMM-YYYY
Last Updated    : DD-MMM-YYYY
Author          : [Name / Role]
Reviewed By     : [Name / Role]
Approved By     : [Name / Role]
Status          : [ Draft | Under Review | Approved | Baselined ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Table of Contents

| # | Section |
|---|---------|
| 1 | Overview / Objective of the Application |
| 2 | High-Level Scope |
| 3 | Out of Scope |
| 4 | Assumptions and Constraints |
| 5 | Actors / User Types |
| 6 | Functional Requirements / Functional Features |
| — | 6.1 Module: [Module Name] → Features → Business Rules |
| 7 | Integration Requirements |
| 8 | Customer Journeys / Flows |
| 9 | Functional Landscape |
| 10 | Non-Functional Requirements |
| — | 10.1 Security |
| — | 10.2 Performance |
| — | 10.3 Scalability |
| — | 10.4 Availability and Reliability |
| — | 10.5 Compliance |
| — | 10.6 Maintainability |
| — | 10.7 Audit & Logs |
| 11 | Technology |
| 12 | DevOps and Observability |
| 13 | UI/UX Requirements |
| 14 | Branding Requirements |
| 15 | Compliance Requirements |
| 16 | Testing Requirements |
| 17 | Key Deliverables |
| 18 | Receivables |
| 19 | Environment |
| 20 | High-Level Timelines |
| — | Revision History |

---

## 1. Overview / Objective of the Application

> **Guideline:** This section is the foundation of the entire PRD. It must answer four core questions:
> *What is this product? Why is it being built? Who is it for? What problem does it solve?*
>
> Write this as if you are explaining the product to a senior executive who has no prior context.
> It must be clear, jargon-free, and compelling. This section directly feeds into:
>
> - **BRD** — Business case and justification
> - **FRD** — Functional specifications
> - **Initiatives** — Strategic grouping of EPICs
> - **EPICs** — Capability-level breakdown
> - **User Stories** — Actor-specific deliverable units
> - **High-Level Design (HLD)** — System architecture decisions
> - **Low-Level Design (LLD)** — Component and data design
> - **Customer Journeys** — End-to-end user experience flows
>
> Include: product name, business context, primary goal, target users, and the value delivered.
> Avoid listing features here — this section sets the "why" and the big picture "what".

```
[2–4 paragraph executive-level overview of the product]

Example:

  PRODUCT NAME:
    Unified Digital Onboarding Platform (UDOP)

  BUSINESS CONTEXT:
    The organization currently onboards new retail customers via a fully manual, branch-based
    process involving physical document submission, manual KYC verification, and 3–5 working
    days of processing time. As of Q1-2026, this process handles approximately 200 applications
    per day across 12 operations staff, with an 8% error rate in data entry and a 38%
    customer drop-off rate during the acquisition funnel.

  OBJECTIVE:
    The Unified Digital Onboarding Platform (UDOP) is a web-based self-service product that
    enables new retail customers to complete the entire onboarding journey — registration,
    document upload, KYC verification, and account activation — digitally, in under 10 minutes,
    available 24x7, without requiring any branch visit or human intervention for standard cases.

  VALUE DELIVERED:
    - Customers: Instant, frictionless onboarding from any device, any time
    - Operations Team: Elimination of manual effort for 90%+ of standard applications
    - Business: 10x increase in daily onboarding capacity, 80% reduction in TAT,
      and direct contribution to the "Digital First" strategic pillar for FY2026
    - Compliance: Automated DPDP Act 2023-compliant data handling and consent management

  FOUNDATION FOR DOWNSTREAM DOCUMENTS:
    This PRD forms the input for:
    - BRD_UDOP_v1.0 — Business justification and funding approval
    - FRD_UDOP_v1.0 — Detailed functional specifications per module
    - INIT-001       — Unified Digital Onboarding Initiative
    - EPIC-001 to EPIC-007 — Customer Registration, Document Verification,
                              Account Provisioning, Notifications, IAM,
                              Reporting, Admin Configuration
```

---

## 2. High-Level Scope

> **Guideline:** This section extends the Overview with a structured breakdown of what the product
> covers at a module or capability level. It defines the **boundaries of what will be built** in
> concrete terms without going into feature-level detail (that belongs in Section 6).
>
> Organise scope by functional modules or product areas. For each area, describe what is included
> at a summary level. This section is what stakeholders refer to when agreeing on the size and
> shape of the product. It must be signed off before detailed requirements are written.
>
> Tip: Structure as a two-level breakdown — Product Areas → Capabilities — to make scope
> immediately scannable for leadership, delivery teams, and vendors.

```
[Structured breakdown of what the product covers — areas and capabilities]

Example:

  The UDOP product scope covers the following functional areas:

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  AREA                        │  CAPABILITIES INCLUDED                   │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  Customer Registration       │  Multi-step registration form             │
  │                              │  Mobile OTP verification                  │
  │                              │  Email verification                       │
  │                              │  Duplicate detection                      │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  KYC & Document Handling     │  Document upload (Aadhaar, PAN, passport) │
  │                              │  Automated OCR-based data extraction      │
  │                              │  Third-party KYC API verification         │
  │                              │  Document status tracking                 │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  Account Provisioning        │  Account creation on approval             │
  │                              │  Account number generation                │
  │                              │  Welcome kit and credentials dispatch     │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  Notifications               │  SMS, Email, and In-app notifications     │
  │                              │  Status-triggered communication events    │
  │                              │  Notification preference management       │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  Identity & Access           │  Customer self-registration and login     │
  │                              │  MFA (OTP + biometric on mobile)          │
  │                              │  Session management and token expiry      │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  Operations Dashboard        │  Exception queue management               │
  │                              │  Manual override and re-verification      │
  │                              │  SLA monitoring per application           │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  Reporting & Analytics       │  Daily / weekly onboarding summary        │
  │                              │  Drop-off funnel analytics                │
  │                              │  TAT and throughput dashboards            │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  Admin Configuration         │  Rule engine configuration (KYC rules)   │
  │                              │  Notification template management         │
  │                              │  User role and permission management      │
  └──────────────────────────────────────────────────────────────────────────┘

  DELIVERY PHASING (High Level):
    Phase 1 (MVP): Customer Registration, KYC & Document Handling,
                   Account Provisioning, Notifications, Identity & Access
    Phase 2:       Operations Dashboard, Reporting & Analytics, Admin Configuration
```

---

## 3. Out of Scope

> **Guideline:** This section is the first line of defence against scope creep and misunderstanding.
> It explicitly states what the product will NOT cover in this release or engagement.
>
> Every item listed here must be something that could reasonably be assumed to be in scope —
> these are the "grey areas" and "adjacent capabilities" that must be clarified upfront.
> For each excluded item, state why it is excluded and, where possible, indicate where it is
> being handled (another phase, another product, another team, or not in roadmap at all).
>
> This section must be reviewed and formally agreed with the customer/stakeholder at kick-off.
> Any item not explicitly listed as Out of Scope is considered In Scope.

```
| # | Excluded Item / Capability                              | Reason / Where Handled                              |
|---|---------------------------------------------------------|-----------------------------------------------------|
| 1 | [What is excluded]                                      | [Why / which phase or product handles it]           |

Example:

| # | Excluded Item / Capability                              | Reason / Where Handled                              |
|---|---------------------------------------------------------|-----------------------------------------------------|
| 1 | Mobile App (iOS / Android) onboarding                   | Phase 2 — separate initiative; web-only for Phase 1 |
| 2 | Migration of existing offline / branch customer records | Separate project — INIT-002 Data Migration          |
| 3 | Corporate / B2B customer onboarding                     | Separate Initiative — INIT-003                      |
| 4 | Multi-language support (Hindi, regional languages)      | Phase 2 only                                        |
| 5 | Wealth management / investment product onboarding       | Out of roadmap for FY2026                           |
| 6 | International KYC / AML database integration            | Pending regulatory review; future scope             |
| 7 | Loan or credit product origination during onboarding    | Separate product line — LOAN-ORIG-001               |
| 8 | Physical document dispatch (debit card, welcome kit)    | Operations team — not part of this digital product  |
| 9 | Call centre / IVR integration                           | Not in Phase 1; may be reviewed in Phase 2          |
|10 | Biometric authentication (fingerprint / face scan)      | Deferred — device compatibility review pending      |
```

---

## 4. Assumptions and Constraints

> **Guideline:** This section documents two distinct but equally critical categories:
>
> **ASSUMPTIONS** — Conditions believed to be true at the time of writing that, if they change,
> will directly impact scope, design, or delivery. Assumptions must be explicitly validated before
> development begins. For each assumption, assign an owner responsible for confirming it and
> a date by which it must be validated. An unvalidated assumption is a risk.
>
> **CONSTRAINTS** — Fixed, non-negotiable boundaries imposed on the product design or delivery.
> These could be technical, legal, budgetary, organizational, or timeline-driven. Constraints
> must be accommodated in the solution — they cannot be changed, only worked around.
>
> Document both clearly. Assumptions missed here become costly change requests. Constraints ignored
> here result in design rework.

```
─────────────────────────────────────────────────────────────
4A. ASSUMPTIONS
─────────────────────────────────────────────────────────────

| # | Assumption                                                            | Owner           | Validation Date | Risk if False                          |
|---|-----------------------------------------------------------------------|-----------------|-----------------|----------------------------------------|
| 1 | [Condition assumed to be true]                                        | [Owner]         | DD-MMM-YYYY     | [Impact if assumption is wrong]        |

Example:
| # | Assumption                                                            | Owner           | Validation Date | Risk if False                          |
|---|-----------------------------------------------------------------------|-----------------|-----------------|----------------------------------------|
| 1 | Customer master data from legacy CRM will be migrated by Apr-2026     | Data Eng Team   | 01-Apr-2026     | Duplicate accounts; broken references  |
| 2 | Third-party KYC API vendor contract signed by Apr-2026                | Procurement     | 15-Apr-2026     | KYC module blocked; phase delay        |
| 3 | Legal sign-off on digital consent forms obtained by Mar-2026          | Legal Team      | 31-Mar-2026     | Cannot go live without consent flows   |
| 4 | Cloud infrastructure provisioning is approved within budget           | IT / Infra      | 15-Mar-2026     | Delays in environment setup            |
| 5 | Operations team is available for UAT for 2 weeks in Jun-2026          | Ops Manager     | 01-Jun-2026     | UAT cycle delayed; go-live pushed      |
| 6 | Customers have access to a smartphone with valid mobile number        | Business / PO   | Kick-off        | OTP flow unusable; alternate path needed|
| 7 | OCR vendor API accuracy is ≥95% on standard ID documents              | Tech Lead       | POC by Apr-2026 | Manual fallback required; ops impact   |


─────────────────────────────────────────────────────────────
4B. CONSTRAINTS
─────────────────────────────────────────────────────────────

| # | Constraint                                                            | Type            | Impact on Design / Delivery             |
|---|-----------------------------------------------------------------------|-----------------|-----------------------------------------|
| 1 | [Non-negotiable constraint]                                           | [Type]          | [How it shapes the solution]            |

Constraint Types: Technical | Legal / Regulatory | Budget | Timeline | Organizational | Operational

Example:
| # | Constraint                                                            | Type            | Impact on Design / Delivery             |
|---|-----------------------------------------------------------------------|-----------------|-----------------------------------------|
| 1 | Solution must be deployed on the organization's approved cloud (AWS)  | Technical       | IaC and CI/CD pipelines must target AWS |
| 2 | DPDP Act 2023 compliance is mandatory at launch — no waiver possible  | Legal           | Privacy-by-design across all modules    |
| 3 | Total project budget capped at ₹2.5Cr for Phase 1                    | Budget          | Limits third-party vendor options       |
| 4 | Phase 1 go-live must be achieved before Jul-2026 (board commitment)   | Timeline        | Reduces buffer; MVP scope must hold     |
| 5 | Must integrate with existing core banking system (CBS) via approved   | Technical       | No direct DB access; CBS API only       |
|   | APIs only — no direct database access                                 |                 |                                         |
| 6 | All user-facing pages must meet WCAG 2.1 AA accessibility standards   | Legal / UX      | Accessible component library mandatory  |
| 7 | Development team is fixed at 8 engineers + 2 QA for Phase 1          | Organizational  | Scope must be right-sized to capacity   |
```

---

## 5. Actors / User Types

> **Guideline:** This section identifies every type of user or system that interacts with the product.
> For each actor, define: who they are, what their role is, what they can do in the system (permissions
> and responsibilities), and how they interact with the product (channel, device, frequency).
>
> Actors drive User Stories. Every User Story is written from the perspective of a specific actor.
> An incomplete actor definition leads to missing user stories and feature gaps.
>
> Distinguish between:
> - **Human Actors** — real users of the system (customers, agents, admins)
> - **System Actors** — external systems that interact with the product (KYC API, payment gateway)
>
> For each actor, also note what they must NOT be allowed to do — this shapes authorization design.

```
─────────────────────────────────────────────────────────────
5A. ACTOR SUMMARY
─────────────────────────────────────────────────────────────

| # | Actor / User Type         | Type    | Channel / Device         | Frequency of Use    |
|---|---------------------------|---------|--------------------------|---------------------|
| 1 | [Actor Name]              | [Type]  | [Web / Mobile / API]     | [Daily / Occasional]|

Example:
| # | Actor / User Type         | Type    | Channel / Device         | Frequency of Use    |
|---|---------------------------|---------|--------------------------|---------------------|
| 1 | New Customer (Applicant)  | Human   | Web Browser / Mobile Web | Once (onboarding)   |
| 2 | Existing Customer         | Human   | Web / Mobile App         | Occasional          |
| 3 | Operations Agent          | Human   | Web Browser (internal)   | Daily               |
| 4 | Operations Supervisor     | Human   | Web Browser (internal)   | Daily               |
| 5 | System Administrator      | Human   | Web Browser (internal)   | Occasional          |
| 6 | KYC API (Third-party)     | System  | REST API                 | Per application     |
| 7 | Core Banking System (CBS) | System  | REST API                 | Per account event   |
| 8 | Notification Service      | System  | Internal API / MQ        | Event-driven        |


─────────────────────────────────────────────────────────────
5B. ACTOR DETAIL — ROLES AND RESPONSIBILITIES
─────────────────────────────────────────────────────────────

[Repeat this block for each human actor]

  ACTOR: New Customer (Applicant)
  ─────────────────────────────────────────────────────────
  Description   : A first-time retail customer initiating a new account opening request
                  through the digital onboarding portal. Has no prior system account.
  Goals         : Complete registration, upload documents, pass KYC, and activate account
                  without visiting a branch.
  Permissions   : Create own application; upload documents; view own application status;
                  respond to re-submission requests.
  Restrictions  : Cannot view other customers' data; cannot approve own application;
                  cannot access operations or admin areas.
  Authentication: Email + mobile OTP verification (no pre-existing login).
  ─────────────────────────────────────────────────────────

  ACTOR: Operations Agent
  ─────────────────────────────────────────────────────────
  Description   : An internal operations staff member who handles exception cases —
                  applications flagged by the automated KYC system for manual review.
  Goals         : Review flagged applications, verify documents, approve or reject,
                  or request re-submission from the customer.
  Permissions   : View assigned exception queue; approve / reject / request resubmission;
                  add review notes; escalate to supervisor.
  Restrictions  : Cannot modify core application data; cannot access admin config;
                  cannot access applications outside their assigned queue.
  Authentication: Corporate SSO (LDAP integration).
  ─────────────────────────────────────────────────────────

  ACTOR: System Administrator
  ─────────────────────────────────────────────────────────
  Description   : Internal IT/Product admin responsible for system configuration,
                  user role management, notification templates, and KYC rule settings.
  Goals         : Configure and maintain platform settings without requiring code changes.
  Permissions   : Full access to admin panel; manage roles and permissions; configure
                  KYC rules, notification templates, and system thresholds.
  Restrictions  : Cannot directly access or modify customer data; all config changes
                  are audit-logged with user and timestamp.
  Authentication: Corporate SSO + MFA mandatory.
  ─────────────────────────────────────────────────────────
```

---

## 6. Functional Requirements / Functional Features

> **Guideline:** This is the core body of the PRD. It defines WHAT the product must do, organized
> by Module → Features → Business Rules.
>
> **Module** — A logical grouping of related capabilities (e.g., Customer Registration, KYC).
>              Each module maps to one or more EPICs in the backlog.
>
> **Feature** — A specific, deliverable capability within a module (e.g., OTP Verification).
>              Each feature maps to one or more User Stories.
>
> **Business Rule** — A non-negotiable condition that governs system behaviour within the module.
>              Business rules are distinct from validations — they define policy, not just
>              data checks (e.g., "A customer with an existing active account cannot register again").
>
> For each feature, write it in a way that is testable and unambiguous. Use the format:
> "The system shall [action] when [condition]."
>
> **Traceability:** At the end of each module block, map the module to its EPIC(s) and sample
> User Stories to maintain vertical traceability through the document hierarchy.

---

### 6.1 Module: Customer Registration & KYC

> **Module Description:** Covers the end-to-end journey from a new customer initiating a
> registration request through to successful KYC verification and identity confirmation.
> This is the entry point of the onboarding funnel.

```
EPIC MAPPING  : EPIC-001 (Customer Registration & KYC Verification)
               EPIC-002 (Document Upload & Verification)
```

#### Features

```
─────────────────────────────────────────────────────────────
FEATURE 6.1.1 — Multi-Step Registration Form
─────────────────────────────────────────────────────────────
User Story Mapping : US-001 (Multi-Step Customer Registration Form — Frontend)
                     US-002 (Registration Data Persistence — Backend)

Description:
  The system shall present a multi-step registration form that collects customer
  information in logical, grouped steps to reduce cognitive load and improve completion rates.

Requirements:
  FR-001 : The system shall collect personal details in Step 1:
           Full Name, Date of Birth, Gender, Nationality.
  FR-002 : The system shall collect contact details in Step 2:
           Mobile Number, Email Address, Alternate Mobile (optional).
  FR-003 : The system shall collect address details in Step 3:
           Permanent Address, Current Address (with "same as permanent" toggle).
  FR-004 : The system shall allow customers to save progress and resume the form
           within 48 hours using a secure one-time link sent to their email.
  FR-005 : The system shall display a progress indicator showing step completion
           percentage throughout the registration flow.
  FR-006 : The system shall auto-fill address fields if the customer consents to
           sharing location data (browser geolocation API).

─────────────────────────────────────────────────────────────
FEATURE 6.1.2 — Mobile OTP Verification
─────────────────────────────────────────────────────────────
User Story Mapping : US-003 (Mobile OTP Verification — Frontend)
                     US-004 (OTP Generation and Validation Service — Backend)

Description:
  The system shall verify the customer's mobile number via a time-bound OTP before
  allowing them to proceed past Step 2 of registration.

Requirements:
  FR-007 : The system shall generate a 6-digit numeric OTP and send it via SMS
           to the mobile number provided within 10 seconds of submission.
  FR-008 : The OTP shall be valid for 5 minutes only. Expired OTPs must be rejected.
  FR-009 : The system shall allow a maximum of 3 OTP entry attempts before locking
           the verification for 15 minutes.
  FR-010 : The system shall provide a "Resend OTP" option, available only after
           30 seconds from the initial send, with a maximum of 3 resend attempts.
  FR-011 : The system shall not reveal whether a mobile number is already registered
           in the error message, to prevent account enumeration attacks.

─────────────────────────────────────────────────────────────
FEATURE 6.1.3 — Document Upload & KYC Verification
─────────────────────────────────────────────────────────────
User Story Mapping : US-005 (Document Upload Interface — Frontend)
                     US-006 (OCR & KYC API Integration — Backend/Integration)

Description:
  The system shall enable customers to upload government-issued identity documents
  and trigger automated KYC verification via a third-party API.

Requirements:
  FR-012 : The system shall accept the following document types for identity proof:
           Aadhaar Card, PAN Card, Passport, Voter ID, Driving Licence.
  FR-013 : The system shall accept documents in JPG, PNG, or PDF format with a
           maximum file size of 5 MB per document.
  FR-014 : The system shall perform OCR on uploaded documents to auto-extract name,
           date of birth, and document number, pre-filling corresponding form fields.
  FR-015 : The system shall submit extracted data to the third-party KYC API and
           receive a verification result within 30 seconds.
  FR-016 : On successful KYC verification, the application status shall automatically
           advance to "KYC Verified — Pending Account Provisioning".
  FR-017 : On KYC failure, the system shall flag the application to the Operations
           exception queue with the failure reason code from the KYC API.
  FR-018 : The system shall store uploaded documents in encrypted object storage
           (AES-256) and generate a tamper-evident checksum for each file.
```

#### Business Rules

```
  BR-001 : A customer with an existing active account (matched by PAN or Aadhaar)
           shall not be allowed to create a new account. The system shall display a
           redirect message to the login page or a branch contact instruction.

  BR-002 : If the name extracted from the uploaded document does not match the name
           entered in the registration form (fuzzy match threshold < 80%), the
           application must be routed to manual Operations review — it shall not
           be auto-rejected.

  BR-003 : An OTP-verified mobile number is considered the primary communication
           channel for all notifications for the lifecycle of that application.
           It cannot be changed after OTP verification without supervisor approval.

  BR-004 : Documents uploaded by the customer are retained for 7 years in encrypted
           storage in compliance with the Records Retention Policy, regardless of
           whether the application was approved or rejected.

  BR-005 : A customer whose application was rejected (for fraud or document mismatch)
           is blocked from re-applying for 90 days. A manual override by a Supervisor
           is required to unblock them before the 90-day period.

  BR-006 : KYC verification must be completed within 72 hours of document upload.
           If not completed within this window (due to API outage or exception queue
           backlog), the application must generate an SLA breach alert to the
           Operations Supervisor.
```

---

### 6.2 Module: Account Provisioning

> **Module Description:** Covers the automated creation of a customer account in the core
> banking system upon successful KYC approval. This module is triggered by an event from
> the KYC module and is fully system-driven with no customer-facing UI beyond status display.

```
EPIC MAPPING  : EPIC-003 (Account Provisioning)
```

#### Features

```
─────────────────────────────────────────────────────────────
FEATURE 6.2.1 — Automated Account Creation
─────────────────────────────────────────────────────────────
User Story Mapping : US-007 (Account Creation API Integration — Backend/Integration)

Requirements:
  FR-019 : Upon KYC approval, the system shall automatically trigger the account
           creation API on the Core Banking System (CBS) within 2 minutes.
  FR-020 : The system shall receive the generated account number from CBS and
           persist it against the customer's application record.
  FR-021 : On successful account creation, the system shall update the application
           status to "Active" and trigger the Welcome Notification event.
  FR-022 : If the CBS API fails or times out, the system shall retry up to 3 times
           with exponential backoff before routing the case to the Operations queue.

─────────────────────────────────────────────────────────────
FEATURE 6.2.2 — Welcome Communication Dispatch
─────────────────────────────────────────────────────────────
User Story Mapping : US-008 (Welcome Notification Trigger — Backend)

Requirements:
  FR-023 : The system shall dispatch a Welcome SMS and Email to the customer upon
           successful account activation containing: account number, customer name,
           and a link to set up their online banking login.
  FR-024 : The Welcome Email shall include a PDF welcome letter attachment generated
           dynamically using the customer's registered details.
```

#### Business Rules

```
  BR-007 : Account provisioning must be triggered only after BOTH conditions are met:
           (a) KYC status = "Verified" AND (b) Customer consent = "Accepted".
           If either is missing, provisioning must be held and an alert raised.

  BR-008 : The account number generated by CBS is the system of record.
           It must not be overridden or modified by the onboarding platform.
           All display references must use the CBS-returned value.
```

---

### 6.[N]. Module: [Module Name]

> **Guideline:** Repeat Section 6.x for each additional module. Suggested modules based on
> the scope defined in Section 2:
>
> - 6.3 Notifications & Communication Hub (EPIC-004)
> - 6.4 Identity & Access Management (EPIC-005)
> - 6.5 Operations Exception Dashboard (EPIC-006)
> - 6.6 Reporting & Analytics (EPIC-006)
> - 6.7 Admin Configuration Panel (EPIC-007)

```
[Define Features and Business Rules for each additional module following the same structure]
```

---

## 7. Integration Requirements

> **Guideline:** This section documents all external and internal system integrations required
> by the product. Each integration must be specified with:
> - The system being integrated with and who owns it
> - The integration pattern (REST API, event/message queue, file transfer, etc.)
> - The data exchanged and the direction of flow
> - SLA, timeout, and error-handling expectations
> - Authentication mechanism
> - Who is responsible for providing the API contract / specification
>
> Integration failures are one of the most common causes of project delays. Document every
> dependency here, even if specifications are not yet available. Flag those as TBD with an owner.

```
─────────────────────────────────────────────────────────────
INTEGRATION SUMMARY TABLE
─────────────────────────────────────────────────────────────

| INT-ID | System / Service          | Type       | Direction          | Owner              | Contract Available | Priority |
|--------|---------------------------|------------|--------------------|--------------------|--------------------|----------|
| INT-001| [System Name]             | [REST/MQ]  | [Inbound/Outbound] | [Team / Vendor]    | [Yes / No / TBD]   | [H/M/L]  |

Example:
| INT-ID | System / Service          | Type       | Direction          | Owner              | Contract Available | Priority |
|--------|---------------------------|------------|--------------------|--------------------|--------------------|----------|
| INT-001| KYC Verification API      | REST API   | Outbound           | Vendor: VerifyFast | TBD (Apr-2026)     | High     |
| INT-002| Core Banking System (CBS) | REST API   | Outbound           | IT / CBS Team      | Yes — v1.2         | High     |
| INT-003| SMS Gateway               | REST API   | Outbound           | IT / Infra         | Yes — available    | High     |
| INT-004| Email Service (SES/SMTP)  | REST API   | Outbound           | IT / Infra         | Yes — available    | High     |
| INT-005| OCR Document Service      | REST API   | Outbound           | Vendor: DocuScan   | TBD (Mar-2026)     | High     |
| INT-006| Identity Provider (IdP)   | OAuth 2.0  | Inbound            | IT / IAM Team      | Yes — OIDC spec    | High     |
| INT-007| Analytics / BI Platform   | Event Stream| Outbound (Kafka)  | Data Eng Team      | TBD (May-2026)     | Medium   |
| INT-008| Audit Logging Service     | REST / MQ  | Outbound           | IT / Security      | Yes                | High     |


─────────────────────────────────────────────────────────────
INTEGRATION DETAIL
─────────────────────────────────────────────────────────────

[Repeat block for each integration]

  INT-001: KYC Verification API
  ─────────────────────────────────────────────────────────
  System         : VerifyFast KYC API (Third-party vendor)
  Pattern        : REST API (HTTPS / JSON)
  Direction      : Outbound — platform sends document data; receives verification result
  Data Sent      : Document type, document number, name, DOB, extracted OCR data
  Data Received  : Verification status (PASS/FAIL/MANUAL_REVIEW), failure reason codes
  Authentication : API Key (stored in secrets manager — not in code)
  SLA / Timeout  : Response expected within 30 seconds; 45-second circuit breaker timeout
  Error Handling : Retry up to 3 times on timeout; route to Operations queue on final failure
  Contract Owner : Procurement / Vendor — expected by 15-Apr-2026
  Feature Ref    : FR-015, FR-016, FR-017
  ─────────────────────────────────────────────────────────

  INT-002: Core Banking System (CBS)
  ─────────────────────────────────────────────────────────
  System         : Internal Core Banking System
  Pattern        : REST API (HTTPS / JSON) — Internal network only
  Direction      : Outbound — platform triggers account creation; receives account number
  Data Sent      : Customer PII (name, DOB, address, document references), KYC status
  Data Received  : Account number, account status, creation timestamp
  Authentication : Service-to-service mTLS with rotating client certificate
  SLA / Timeout  : CBS must respond within 10 seconds; 15-second circuit breaker
  Error Handling : Exponential backoff retry (3 attempts); Operations alert on failure
  Contract Owner : IT / CBS Team — API v1.2 already available
  Feature Ref    : FR-019, FR-020, FR-021, FR-022
  ─────────────────────────────────────────────────────────
```

---

## 8. Customer Journeys / Flows

> **Guideline:** This section defines the end-to-end experience flows for each key actor.
> A Customer Journey describes the sequence of steps, decisions, and system interactions
> that a user goes through to achieve a goal.
>
> **Representation options:**
> - Use **text-based flowcharts** within this document for version-controlled documentation
> - Use **Lucidchart / Miro / Figma** for visual flow diagrams — embed link + attach export
> - Use **ASCII flowcharts** for quick inline representation
>
> For each journey, document: Happy Path, Alternate Paths, and Exception / Error Paths.
> Every branch point is a potential gap in User Stories — ensure each path is covered.

```
─────────────────────────────────────────────────────────────
JOURNEY 8.1 — New Customer Self-Onboarding (Happy Path)
─────────────────────────────────────────────────────────────
Actor     : New Customer (Applicant)
Goal      : Complete registration and account activation end-to-end
Trigger   : Customer lands on onboarding portal via marketing link / website CTA
End State : Customer account is active; welcome communication received

FLOW:
  ┌──────────────────────────────────────────────────────────────────┐
  │  STEP 1: Landing Page                                            │
  │  Customer lands on portal → Clicks "Open Account" CTA           │
  └─────────────────────┬────────────────────────────────────────────┘
                        │
  ┌─────────────────────▼────────────────────────────────────────────┐
  │  STEP 2: Registration — Personal Details                         │
  │  Enters Full Name, DOB, Gender, Nationality → Clicks Next        │
  └─────────────────────┬────────────────────────────────────────────┘
                        │
  ┌─────────────────────▼────────────────────────────────────────────┐
  │  STEP 3: Contact Details + Mobile OTP Verification               │
  │  Enters Mobile, Email → Requests OTP → Enters OTP → Verified     │
  └─────────────────────┬────────────────────────────────────────────┘
                        │
  ┌─────────────────────▼────────────────────────────────────────────┐
  │  STEP 4: Address Details                                         │
  │  Enters Permanent + Current Address → Clicks Next                │
  └─────────────────────┬────────────────────────────────────────────┘
                        │
  ┌─────────────────────▼────────────────────────────────────────────┐
  │  STEP 5: Document Upload                                         │
  │  Selects document type → Uploads file → OCR auto-fills fields    │
  │  Customer confirms extracted data → Clicks Submit                │
  └─────────────────────┬────────────────────────────────────────────┘
                        │
  ┌─────────────────────▼────────────────────────────────────────────┐
  │  STEP 6: KYC API Verification (Automated — background)           │
  │  System calls KYC API → Receives PASS result within 30 sec       │
  └─────────────────────┬────────────────────────────────────────────┘
                        │
  ┌─────────────────────▼────────────────────────────────────────────┐
  │  STEP 7: Account Provisioning (Automated — background)           │
  │  System calls CBS API → Account created → Account number stored  │
  └─────────────────────┬────────────────────────────────────────────┘
                        │
  ┌─────────────────────▼────────────────────────────────────────────┐
  │  STEP 8: Confirmation                                            │
  │  Customer sees "Account Activated" screen with account number    │
  │  Welcome SMS + Email dispatched                                  │
  └──────────────────────────────────────────────────────────────────┘

ALTERNATE PATH — OTP Failed (Max Attempts):
  At STEP 3: Customer enters wrong OTP 3 times
  → System locks verification for 15 minutes
  → Displays wait message with countdown timer
  → After 15 minutes, customer can request fresh OTP

EXCEPTION PATH — KYC API Returns MANUAL_REVIEW:
  At STEP 6: KYC API returns MANUAL_REVIEW result
  → Application status set to "Pending Manual Review"
  → Application routed to Operations exception queue
  → Customer receives notification: "Your application is under review.
     You will be notified within 48 hours."
  → Operations Agent reviews and either approves or requests resubmission

─────────────────────────────────────────────────────────────
JOURNEY 8.2 — Operations Agent Exception Handling
─────────────────────────────────────────────────────────────
Actor     : Operations Agent
Goal      : Review and resolve a flagged application in the exception queue
Trigger   : Application routed to exception queue by automated KYC failure
End State : Application approved (triggers provisioning) or rejected with reason logged

[Define flow following same pattern as Journey 8.1]

─────────────────────────────────────────────────────────────
  Visual Flow Diagram Reference
─────────────────────────────────────────────────────────────
  Tool     : Lucidchart / Miro / Figma
  Link     : [Insert diagram URL here]
  Export   : [Attach PDF / PNG in the document repository]
  Location : [SharePoint / Confluence path]
```

---

## 9. Functional Landscape

> **Guideline:** The Functional Landscape is an infographic/architectural overview that depicts
> the full product — all modules, their sub-modules, and how they relate to each other —
> in a single visual view. It is intended for leadership, architects, and new team members
> to quickly understand the scope and structure of the product.
>
> **Representation:**
> - Use a **block diagram** or **capability map** format
> - Recommended tools: Lucidchart, Miro, draw.io, Figma, or PowerPoint
> - Include this as an inline ASCII representation in this document AND as a linked visual
>
> The Functional Landscape must show:
> - All modules (columns or swimlanes)
> - Sub-modules / key features within each module
> - System integrations at the boundary
> - Actor touchpoints per module

```
  FUNCTIONAL LANDSCAPE — Unified Digital Onboarding Platform (UDOP)
  ══════════════════════════════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────────────────────────────────┐
  │                            CUSTOMER-FACING LAYER                                    │
  │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
  │   │  Registration │  │  Document     │  │  Application  │  │  Account          │   │
  │   │  & KYC        │  │  Upload &     │  │  Status       │  │  Activation &     │   │
  │   │               │  │  Verification │  │  Tracking     │  │  Confirmation     │   │
  │   │ • Multi-step  │  │ • Upload UI   │  │ • Status page │  │ • Success screen  │   │
  │   │   form        │  │ • OCR preview │  │ • Timeline    │  │ • Account number  │   │
  │   │ • OTP verify  │  │ • Doc preview │  │ • Notifs      │  │ • Welcome email   │   │
  │   └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └────────┬──────────┘   │
  └───────────┼──────────────────┼──────────────────┼───────────────────┼──────────────┘
              │                  │                  │                   │
  ┌───────────▼──────────────────▼──────────────────▼───────────────────▼──────────────┐
  │                             PLATFORM / API LAYER                                    │
  │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
  │   │  Identity &   │  │  KYC Engine   │  │  Account      │  │  Notification     │   │
  │   │  Access Mgmt  │  │               │  │  Provisioning │  │  Service          │   │
  │   │               │  │ • API adapter │  │  Engine       │  │                   │   │
  │   │ • Auth / MFA  │  │ • Rules engine│  │ • CBS bridge  │  │ • SMS / Email     │   │
  │   │ • Session mgmt│  │ • Exception   │  │ • Retry logic │  │ • Event triggers  │   │
  │   │ • RBAC        │  │   routing     │  │ • Status sync │  │ • Templates       │   │
  │   └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └────────┬──────────┘   │
  └───────────┼──────────────────┼──────────────────┼───────────────────┼──────────────┘
              │                  │                  │                   │
  ┌───────────▼──────────────────▼──────────────────▼───────────────────▼──────────────┐
  │                          OPERATIONS & ADMIN LAYER                                   │
  │   ┌───────────────────────────┐              ┌───────────────────────────────────┐  │
  │   │  Operations Dashboard     │              │  Admin Configuration Panel        │  │
  │   │  • Exception queue        │              │  • KYC rule management            │  │
  │   │  • Manual review tools    │              │  • Notification templates         │  │
  │   │  • SLA monitoring         │              │  • Role & permission management   │  │
  │   │  • Audit trail view       │              │  • System health config           │  │
  │   └───────────────────────────┘              └───────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────────────────────────────┘
              │                  │                  │                   │
  ┌───────────▼──────────────────▼──────────────────▼───────────────────▼──────────────┐
  │                          EXTERNAL INTEGRATIONS                                      │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
  │  │  KYC API     │  │  Core Banking│  │  SMS / Email │  │  OCR / Document      │    │
  │  │  (VerifyFast)│  │  System (CBS)│  │  Gateway     │  │  Intelligence Service│    │
  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────────┘    │
  └─────────────────────────────────────────────────────────────────────────────────────┘

  Visual Diagram Reference:
    Tool     : [Lucidchart / Miro / draw.io]
    Link     : [Insert diagram URL here]
    Location : [SharePoint / Confluence path]
```

---

## 10. Non-Functional Requirements

> **Guideline:** NFRs define HOW the system behaves, not what it does. They are quality
> attributes that cut across all modules. Each NFR must be:
> - **Testable** — state a specific, measurable threshold
> - **Prioritized** — Critical (launch blocker) / High / Medium
> - **Attributed** — map to the module(s) it applies to
>
> NFRs here are high-level PRD-level requirements. Detailed NFR specifications are maintained
> in the NFR-Template.md (consolidated NFR register).

---

### 10.1 Security

```
| NFR-SEC-001 | All data in transit must be encrypted using TLS 1.2 or higher.              | Critical |
| NFR-SEC-002 | All PII and document data at rest must be encrypted using AES-256.          | Critical |
| NFR-SEC-003 | Authentication must support MFA (OTP mandatory; biometric optional).        | Critical |
| NFR-SEC-004 | All API endpoints must enforce authentication and role-based authorization.  | Critical |
| NFR-SEC-005 | No secrets, API keys, or credentials may be stored in source code.           | Critical |
| NFR-SEC-006 | OWASP Top 10 vulnerabilities must be mitigated before go-live.               | Critical |
| NFR-SEC-007 | A penetration test must be conducted and signed off before Phase 1 launch.   | Critical |
| NFR-SEC-008 | Session tokens must expire after 30 minutes of inactivity.                  | High     |
| NFR-SEC-009 | All failed authentication attempts must be logged with IP and timestamp.     | High     |
```

---

### 10.2 Performance

```
| NFR-PERF-001| API response time (P95) must be ≤ 2 seconds under normal load.              | Critical |
| NFR-PERF-002| Page load time (P95) must be ≤ 3 seconds on a 4G mobile connection.         | High     |
| NFR-PERF-003| Document upload processing (OCR + pre-validation) must complete ≤ 10 seconds.| High     |
| NFR-PERF-004| KYC API call (including network round-trip) must complete within 30 seconds. | Critical |
| NFR-PERF-005| The platform must support 500 concurrent onboarding sessions without         | High     |
|             | degradation at Phase 1 launch; 2,000 concurrent by Phase 2.                 |          |
```

---

### 10.3 Scalability

```
| NFR-SCAL-001| The platform must scale horizontally (stateless services behind a load       | Critical |
|             | balancer) to handle 10x Phase 1 load without architectural changes.         |          |
| NFR-SCAL-002| Database must support read replicas for reporting workloads without          | High     |
|             | impacting transactional performance.                                         |          |
| NFR-SCAL-003| File storage must scale to handle 1 million+ document uploads without        | High     |
|             | performance degradation (object storage, not filesystem).                    |          |
| NFR-SCAL-004| Message queues (Kafka/SQS) must handle burst spikes of 10x normal volume     | High     |
|             | for event-driven integrations.                                               |          |
```

---

### 10.4 Availability and Reliability

```
| NFR-AVAIL-001| Platform must achieve 99.9% uptime SLA (≤ 8.7 hours downtime/year).        | Critical |
| NFR-AVAIL-002| Planned maintenance windows must not exceed 2 hours/month and must be       | High     |
|              | outside business hours (11 PM – 4 AM IST).                                  |          |
| NFR-AVAIL-003| All critical services (registration, KYC trigger, notifications) must have   | Critical |
|              | automated health checks and restart policies.                                 |          |
| NFR-AVAIL-004| The platform must implement circuit breakers for all external API calls       | High     |
|              | to prevent cascading failures.                                                |          |
| NFR-AVAIL-005| Mean Time to Recovery (MTTR) for P1 incidents must be ≤ 1 hour.              | High     |
```

---

### 10.5 Compliance

```
| NFR-COMP-001| The platform must comply with the DPDP Act 2023 (India) for all             | Critical |
|             | processing of personal data, including consent management and data           |          |
|             | principal rights (access, correction, erasure).                              |          |
| NFR-COMP-002| PCI-DSS requirements apply only if payment card data is processed.           | High     |
|             | If not in Phase 1 scope, this must be explicitly confirmed.                  |          |
| NFR-COMP-003| All customer consent actions (accept, withdraw) must be timestamped,         | Critical |
|             | immutably logged, and producible for regulatory audit within 24 hours.       |          |
| NFR-COMP-004| Data residency: all customer PII must be stored within India-based data      | Critical |
|             | centres (AWS ap-south-1 / Mumbai region).                                    |          |
```

---

### 10.6 Maintainability

```
| NFR-MAINT-001| All services must be independently deployable (microservices or modular     | High     |
|              | monolith) to allow targeted hotfixes without full platform redeployment.     |          |
| NFR-MAINT-002| Code coverage for unit tests must be ≥ 80% for all backend services.         | High     |
| NFR-MAINT-003| All configuration values (thresholds, timeouts, feature flags) must be       | High     |
|              | externalized (env vars / config service) — no hardcoding.                    |          |
| NFR-MAINT-004| API documentation (OpenAPI / Swagger) must be auto-generated and kept        | Medium   |
|              | current with every release.                                                  |          |
| NFR-MAINT-005| Technical debt must be managed via a tracked backlog; no P1 tech debt        | High     |
|              | item to remain unresolved beyond 2 sprints.                                  |          |
```

---

### 10.7 Audit & Logs

```
| NFR-AUDIT-001| Every state transition of an application (registration → KYC → provisioned  | Critical |
|              | → active) must be logged with actor, timestamp, and IP address.              |          |
| NFR-AUDIT-002| All Operations Agent actions (approve / reject / resubmit request) must      | Critical |
|              | be immutably audit-logged with reason and agent ID.                          |          |
| NFR-AUDIT-003| All Admin configuration changes must be audit-logged with before/after        | Critical |
|              | values, admin ID, and timestamp.                                             |          |
| NFR-AUDIT-004| Application logs must be centralised (e.g., CloudWatch / ELK / Grafana       | High     |
|              | Loki) and retained for a minimum of 1 year (3 years for compliance logs).    |          |
| NFR-AUDIT-005| Logs must not contain raw PII (name, mobile, document numbers) in            | Critical |
|              | plaintext. Use masked or tokenized references in log entries.                 |          |
```

---

## 11. Technology

> **Guideline:** This section documents the preferred technology stack for the product.
> Specify preferences agreed with the customer/architecture team. Where a technology is
> mandated (e.g., due to existing infrastructure), mark it as MANDATORY. Where it is
> a recommendation, mark it as PREFERRED.
>
> If the customer has no preference for certain layers, the delivery team should propose
> a stack based on the NFRs defined in Section 10, team capability, and community maturity.
> All technology decisions must be traceable to NFRs or constraints in Section 4.

```
─────────────────────────────────────────────────────────────
TECHNOLOGY STACK
─────────────────────────────────────────────────────────────

  LAYER                   TECHNOLOGY / TOOL              STATUS       RATIONALE
  ─────────────────────   ────────────────────────────   ──────────   ─────────────────────────────────
  Frontend                ReactJS / Next.js              Preferred    SSR support; SEO; strong ecosystem
  Mobile Web              Responsive PWA (React)         Preferred    Phase 1 web-only; PWA for mobile
  Backend (API)           Node.js with NestJS            Preferred    TypeScript; modular; REST + events
  Background Jobs         BullMQ / AWS SQS Workers       Preferred    Async KYC trigger, notifications
  Database (Primary)      PostgreSQL (AWS RDS)           Preferred    ACID compliance; relational data
  Database (NoSQL)        Redis                          Preferred    Session store; OTP cache; rate limit
  Document Storage        AWS S3 (with SSE-KMS)          Mandatory    Object storage; encryption at rest
  Streaming / Events      Apache Kafka / AWS MSK         Preferred    Event-driven integrations; audit trail
  Search                  PostgreSQL Full-Text (Phase 1) Preferred    Application search; Phase 2: Elastic
  Time-Series DB          AWS Timestream (if needed)     Optional     SLA metrics; event throughput tracking
  API Gateway             AWS API Gateway / Kong         Preferred    Auth enforcement; rate limiting
  Authentication          Keycloak / AWS Cognito         Preferred    OIDC / OAuth 2.0; MFA; SSO
  Infrastructure (Cloud)  AWS (ap-south-1 Mumbai)        Mandatory    Data residency constraint (NFR-COMP-004)
  IaC                     Terraform                      Preferred    Reproducible infra; version-controlled

  Note: Any deviation from MANDATORY items requires written approval from the Architecture
  Review Board and a corresponding update to the Constraints section (Section 4B).
```

---

## 12. DevOps and Observability

> **Guideline:** This section defines the operational requirements for how the product is
> built, deployed, monitored, and maintained in production. It covers CI/CD pipeline
> design, environment management, monitoring, alerting, and incident response tooling.
>
> Define clearly WHO provides each tool/service: the delivery team, customer IT, or a
> third-party managed service. This avoids ambiguity during setup and operations handover.

```
─────────────────────────────────────────────────────────────
12A. CI/CD PIPELINE
─────────────────────────────────────────────────────────────

  REQUIREMENT                     TOOL / APPROACH           PROVIDED BY
  ────────────────────────────    ──────────────────────    ───────────────────
  Source Control                  Git (GitHub / GitLab)     Delivery Team
  CI Pipeline (Build & Test)      Jenkins / GitHub Actions  Delivery Team
  Code Quality Gate               SonarQube                 Delivery Team
  Dependency Vulnerability Scan   OWASP Dependency-Check    Delivery Team
  Container Build & Registry      Docker + ECR (AWS)        Delivery Team
  Container Orchestration         AWS ECS / EKS             Delivery Team / IT
  CD Pipeline (Deploy to Env)     Jenkins / ArgoCD          Delivery Team
  Blue-Green / Canary Deployment  AWS ECS Rolling / CodeDeploy  Delivery Team

  PIPELINE GATES (mandatory before merge to main):
    ✔ Unit tests pass (≥ 80% coverage)
    ✔ Integration tests pass
    ✔ SonarQube quality gate: no blocker/critical issues
    ✔ Security scan: no HIGH/CRITICAL CVEs
    ✔ Docker image built and pushed to ECR
    ✔ Deployment to staging environment successful

─────────────────────────────────────────────────────────────
12B. MONITORING & OBSERVABILITY
─────────────────────────────────────────────────────────────

  CATEGORY              TOOL                    PURPOSE
  ──────────────────    ──────────────────────  ──────────────────────────────────────
  Metrics & Dashboards  Grafana + Prometheus     Real-time system metrics; custom dashboards
  Log Aggregation       AWS CloudWatch / ELK     Centralized log storage, search, alerting
  Distributed Tracing   AWS X-Ray / Jaeger       Request tracing across services
  Uptime Monitoring     AWS CloudWatch Alarms    SLA uptime; endpoint health checks
  Error Tracking        Sentry                   Real-time error capture and grouping
  Alerting              PagerDuty / OpsGenie     On-call incident routing by severity
  APM                   New Relic / Datadog      Application performance monitoring

  KEY DASHBOARDS REQUIRED:
    - Application funnel drop-off rates (real-time)
    - API latency per integration (KYC, CBS, SMS, OCR)
    - Error rate per service (P1/P2 threshold alerts)
    - Queue depth (Kafka / SQS consumer lag)
    - Onboarding throughput (applications per hour)
    - SLA breach counter (applications > 72 hours in queue)

─────────────────────────────────────────────────────────────
12C. INCIDENT MANAGEMENT
─────────────────────────────────────────────────────────────

  Severity  Definition                              Target Response   Target Resolution
  ────────  ──────────────────────────────────────  ───────────────   ─────────────────
  P1        Platform down / total data loss risk    15 minutes        1 hour
  P2        Major feature unavailable (KYC/CBS)     30 minutes        4 hours
  P3        Degraded performance / partial feature  2 hours           Next business day
  P4        Minor issue / cosmetic bug              Next business day  Next sprint
```

---

## 13. UI/UX Requirements

> **Guideline:** This section defines the experience and usability requirements for the product.
> These are not visual design specifications (that is the role of Figma/wireframes) but rather
> the principles, standards, and constraints that all UI/UX design must conform to.
>
> These requirements drive the UX Design phase and must be validated in UAT.

```
  UX-001  : The product must follow a mobile-first responsive design approach.
            All screens must be functional and visually coherent on screens ≥ 320px wide.

  UX-002  : The registration flow must be completable in under 10 minutes for a first-time
            user with no prior instruction, as measured in usability testing.

  UX-003  : Every form must display inline, real-time validation errors — errors must appear
            at the field level immediately on blur (not only on form submit).

  UX-004  : All error messages must be human-readable and actionable.
            Example — NOT: "ERR_KYC_422". YES: "We couldn't verify your document.
            Please ensure your Aadhaar card image is clear and try again."

  UX-005  : The product must meet WCAG 2.1 Level AA accessibility standards:
            - Minimum contrast ratio 4.5:1 for body text
            - All interactive elements must be keyboard-navigable
            - Screen-reader compatible ARIA labels on all form fields

  UX-006  : All multi-step flows must display a persistent step progress indicator
            showing current step, total steps, and percentage completion.

  UX-007  : The system must preserve form data across browser refresh (session storage)
            so customers do not lose progress on accidental refresh.

  UX-008  : Loading states must be shown for all operations taking > 500ms.
            Skeleton loaders are preferred over spinners for content areas.

  UX-009  : Success and error states must use distinct visual cues beyond color alone
            (icons + text) to support color-blind users.

  UX-010  : A "Save and Continue Later" option must be available from Step 2 onwards,
            sending the customer a secure resume link via email.

  Wireframe / Prototype Reference:
    Tool     : Figma
    Link     : [Insert Figma prototype link here]
    Screens  : [List key screen names — REG-01 Landing, REG-02 Personal Details, etc.]
```

---

## 14. Branding Requirements

> **Guideline:** This section defines the visual identity and branding constraints that the
> product's UI must adhere to. These are provided by the customer's brand/design team and
> must be respected across all screens, emails, PDFs, and communications.
>
> If a formal Brand Guidelines document exists, reference it here and note which specific
> elements apply to this product. Flag any conflicts between brand guidelines and WCAG
> accessibility requirements — they must be resolved before UI development begins.

```
  BRANDING ELEMENT          SPECIFICATION / GUIDELINE
  ─────────────────────     ──────────────────────────────────────────────────────────────
  Brand Guidelines Doc      [Document Name / Version / Link — e.g., BrandBook_2026_v3.pdf]
  Primary Colour            [Hex Code — e.g., #1A3C8F (Navy Blue)]
  Secondary Colour          [Hex Code — e.g., #F4A300 (Amber)]
  Background Colour         [Hex Code — e.g., #FFFFFF (White)]
  Error / Alert Colour      [Hex Code — e.g., #D32F2F (Red)] — verify WCAG contrast
  Success Colour            [Hex Code — e.g., #2E7D32 (Green)] — verify WCAG contrast
  Primary Font (Headings)   [Font Name — e.g., Inter Bold, 600 weight]
  Primary Font (Body)       [Font Name — e.g., Inter Regular, 400 weight]
  Logo Usage                [Placement rules — e.g., top-left header; minimum 40px height]
  Icon Library              [e.g., Phosphor Icons / Material Icons / custom icon set]
  Button Style              [e.g., Rounded corners 8px; primary CTA: filled; secondary: outlined]
  Email Template            [HTML email template reference — SharePoint / Figma link]
  PDF / Letter Header       [Company letterhead template reference]
  Favicon / App Icon        [Asset location / specs — 192x192 PNG + 512x512 PNG for PWA]

  Note: All branding assets (fonts, logos, icons) must be formally provided by the customer
  in editable/web-ready formats (SVG, WOFF2, PNG) before UI development begins.
  This is a RECEIVABLE — see Section 18.
```

---

## 15. Compliance Requirements

> **Guideline:** This section enumerates all legal, regulatory, and industry compliance
> mandates that the product must meet. For each compliance requirement, document: what it
> mandates, how the product must implement it, and who is responsible for sign-off.
>
> Note: High-level compliance NFRs are in Section 10.5. This section provides the regulatory
> detail. The two sections must be consistent.

```
| COMP-ID  | Regulation / Standard    | Applicability                      | Key Requirements                                               | Sign-off Owner     |
|----------|--------------------------|------------------------------------|----------------------------------------------------------------|--------------------|
| COMP-001 | DPDP Act 2023 (India)    | All customer PII processing        | Explicit consent before data collection; right to erasure;     | Legal / DPO        |
|          |                          |                                    | data principal rights API; breach notification within 72 hrs   |                    |
| COMP-002 | RBI Master Directions    | KYC and account opening            | Video KYC or physical verification; document retention ≥7 yrs; | Compliance / Legal |
|          | on KYC (2016, updated)   |                                    | re-KYC triggers; PEP and sanction list checks                  |                    |
| COMP-003 | IT Act 2000 (India)      | Digital records and e-signatures   | Electronic records and e-signatures are legally valid;         | Legal              |
|          |                          |                                    | digital consent capture must meet evidentiary requirements     |                    |
| COMP-004 | PCI-DSS (if applicable)  | Payment card data (if collected)   | No storage of CVV; tokenized card references only;             | IT / Security      |
|          |                          |                                    | Confirm if Phase 1 is in scope — defer if not                  |                    |
| COMP-005 | OWASP Top 10             | All application security           | Mitigate injection, broken auth, XSS, IDOR, and other         | Security / Dev Lead|
|          |                          |                                    | OWASP Top 10 vulnerabilities before launch                     |                    |
| COMP-006 | SOC 2 Type II            | If required by enterprise customer | Audit controls for security, availability, confidentiality     | Customer / Legal   |
|          |                          |                                    | Confirm applicability at kick-off                              |                    |
```

---

## 16. Testing Requirements

> **Guideline:** This section defines the types of testing required for the product, along
> with scope, entry/exit criteria, and ownership. Testing requirements here drive the
> test planning and QA resourcing decisions.
>
> Each testing type must have a defined: scope, approach, tool(s), owner, and exit criteria.

```
| TEST-ID  | Test Type                  | Scope                                        | Tool / Approach              | Owner      | Exit Criteria                                          |
|----------|----------------------------|----------------------------------------------|------------------------------|------------|--------------------------------------------------------|
| TEST-001 | Unit Testing               | All backend service functions and utilities  | Jest / Mocha (Node.js)       | Dev Team   | ≥ 80% code coverage; 0 failing tests                  |
| TEST-002 | Integration Testing        | All API integrations (KYC, CBS, SMS, OCR)    | Supertest / Postman          | Dev Team   | All endpoints tested; mocked + real sandbox validated  |
| TEST-003 | Functional / UAT Testing   | All user journeys (Section 8) and features   | Manual + Test scripts        | QA + Ops   | All acceptance criteria in User Stories passed         |
| TEST-004 | UI / Frontend Testing      | All screens — rendering, responsiveness      | Playwright / Cypress         | QA Team    | 0 P1/P2 UI defects; WCAG compliance verified          |
| TEST-005 | Performance Testing        | Registration flow, KYC trigger, CBS API call | k6 / JMeter                  | QA + DevOps| NFR-PERF-001 to NFR-PERF-005 thresholds met           |
| TEST-006 | Load & Stress Testing      | Platform under 500 concurrent users (Phase 1)| k6 / Gatling                 | QA + DevOps| No service degradation at 500 concurrent; defined SLA  |
| TEST-007 | Security / Penetration Test| All API endpoints; auth flows; data exposure | OWASP ZAP + Manual PenTest  | Security   | 0 Critical/High vulnerabilities at go-live sign-off    |
| TEST-008 | Regression Testing         | Full platform after every sprint release     | Automated test suite         | QA Team    | 0 P1/P2 regressions introduced in new release         |
| TEST-009 | Accessibility Testing      | All customer-facing screens                  | Axe / WAVE / Screen readers  | QA + UX    | WCAG 2.1 AA: 0 violations on critical paths           |
| TEST-010 | Data Migration Testing     | If legacy data migration is in scope         | Custom scripts + validation  | Data Eng   | 100% reconciliation of migrated records               |
| TEST-011 | Disaster Recovery Testing  | Recovery from instance / AZ failure          | Chaos engineering (AWS FIS)  | DevOps     | RTO ≤ 1 hour; RPO ≤ 15 minutes verified               |
```

---

## 17. Key Deliverables

> **Guideline:** This section defines what the delivery team will produce and hand over
> to the customer at the end of the engagement or at defined milestones.
> Every deliverable must have: a description, the format, who produces it,
> and the milestone or phase at which it is delivered.
>
> This section forms part of the contractual scope of delivery. Any item not listed
> here is NOT a deliverable unless a formal change request is raised.

```
| DEL-ID  | Deliverable                              | Format                       | Produced By     | Delivery Phase / Milestone        |
|---------|------------------------------------------|------------------------------|-----------------|-----------------------------------|
| DEL-001 | PRD (this document)                      | Markdown / PDF               | BA / PO Team    | Project Kick-off                  |
| DEL-002 | BRD (Business Requirements Document)     | Word / PDF                   | BA Team         | Before Initiative sign-off        |
| DEL-003 | FRD (Functional Requirements Document)   | Word / PDF / Markdown        | BA + Tech Lead  | Before sprint planning            |
| DEL-004 | Initiative Document (INIT-001)           | Markdown                     | PO / BA Team    | Sprint 0                          |
| DEL-005 | EPIC Documents (EPIC-001 to EPIC-007)    | Markdown                     | PO / BA Team    | Sprint 0 — Phase 1 EPICs first    |
| DEL-006 | User Stories (US-001 to US-NNN)          | Markdown / JIRA              | PO / BA Team    | Per sprint (ahead of sprint start)|
| DEL-007 | High-Level Design (HLD) Document         | Word / Confluence / PDF      | Architect       | Sprint 0 / Architecture Review    |
| DEL-008 | Low-Level Design (LLD) Document          | Confluence / Markdown        | Tech Lead       | Before module development begins  |
| DEL-009 | Database Schema & ER Diagram             | SQL DDL + Draw.io / PDF      | Backend Dev     | Before DB development begins      |
| DEL-010 | API Documentation (OpenAPI / Swagger)    | YAML / Swagger UI            | Backend Dev     | At API completion                 |
| DEL-011 | Source Code                              | Git repository (GitHub)      | Dev Team        | Continuous; final at go-live      |
| DEL-012 | Infrastructure-as-Code (Terraform)       | Git repository               | DevOps Team     | Before environment provisioning   |
| DEL-013 | CI/CD Pipeline Configuration             | Jenkins / GitHub Actions     | DevOps Team     | Sprint 1                          |
| DEL-014 | Test Cases & Test Results Report         | Excel / TestRail / Markdown  | QA Team         | Per sprint; final at UAT sign-off |
| DEL-015 | Security Penetration Test Report         | PDF                          | Security Team   | Before Phase 1 go-live            |
| DEL-016 | User Manuals                             | PDF / Confluence             | BA + UX Team    | Before UAT                        |
| DEL-017 | Operations Runbook                       | Confluence / Markdown        | DevOps + Dev    | Before go-live                    |
| DEL-018 | Training Material (Operations Team)      | PPT / Video / PDF            | BA + PO         | Before UAT / Go-live              |
| DEL-019 | Go-Live Readiness Checklist Sign-off     | Checklist document           | PO + Delivery   | Before Phase 1 production release |
| DEL-020 | Post-Launch Hypercare Report             | PDF                          | Delivery Lead   | 2 weeks post go-live              |
```

---

## 18. Receivables

> **Guideline:** Receivables are documents, assets, data, and information that the delivery
> team requires FROM the customer to execute the project. Missing or delayed receivables are
> one of the most common root causes of project delays.
>
> Every receivable must have: a description, why it is needed, who must provide it,
> and the date by which it must be received (before work can begin that depends on it).
> Flag HIGH RISK receivables — those where delay will block a sprint or a critical path item.

```
| REC-ID  | Receivable                                    | Why Needed                                            | Provided By          | Required By   | Risk if Late        |
|---------|-----------------------------------------------|-------------------------------------------------------|----------------------|---------------|---------------------|
| REC-001 | Approved BRD (Business Requirements Doc)      | Foundation for PRD and FRD; confirms business goals   | Customer / BA        | Kick-off      | HIGH — blocks PRD   |
| REC-002 | KYC API Vendor Contract + API Specification   | Required to build KYC integration (INT-001)           | Procurement          | 15-Apr-2026   | HIGH — blocks EPIC-002|
| REC-003 | Core Banking System (CBS) API Specification   | Required to build Account Provisioning (INT-002)      | IT / CBS Team        | 01-Apr-2026   | HIGH — blocks EPIC-003|
| REC-004 | Brand Guidelines Document                     | Required for all UI/UX design and frontend build      | Brand / Design Team  | 01-Apr-2026   | MEDIUM              |
| REC-005 | Brand Assets (Logo, Fonts, Icons — web-ready) | Required for frontend implementation                  | Brand / Design Team  | 15-Apr-2026   | MEDIUM              |
| REC-006 | Approved Digital Consent Form Templates       | Required for DPDP Act compliance; consent capture     | Legal Team           | 31-Mar-2026   | HIGH — legal blocker|
| REC-007 | Cloud Account Access (AWS IAM credentials)    | Required for environment provisioning (Section 19)    | IT / Infra           | 01-Apr-2026   | HIGH — blocks infra |
| REC-008 | SMS Gateway Access Credentials                | Required to configure notification service (INT-003)  | IT / Infra           | 15-Apr-2026   | MEDIUM              |
| REC-009 | Corporate SSO / LDAP Integration Details      | Required for Operations Agent and Admin authentication| IT / IAM Team        | 15-Apr-2026   | MEDIUM              |
| REC-010 | Test Data Set (customer personas for UAT)     | Required to execute UAT scenarios                     | Business / Ops Team  | 01-Jun-2026   | MEDIUM              |
| REC-011 | Operations Team Availability for UAT          | Required to execute UAT (2-week block)                | Ops Manager          | 01-Jun-2026   | HIGH — blocks UAT   |
| REC-012 | Regulatory Compliance Sign-off (DPDP, KYC)   | Required before go-live clearance                     | Legal / Compliance   | 30-Jun-2026   | HIGH — blocks launch|
```

---

## 19. Environment

> **Guideline:** This section defines the environments required throughout the delivery lifecycle,
> who is responsible for provisioning and maintaining each environment, where it is hosted,
> and what the access and data handling policies are.
>
> Clearly distinguish between cloud-hosted and on-premise environments. For cloud, specify
> the provider, region, and account ownership. For GPU or specialized compute, specify the
> hardware requirements and procurement timeline.

```
─────────────────────────────────────────────────────────────
19A. ENVIRONMENT OVERVIEW
─────────────────────────────────────────────────────────────

| ENV-ID | Environment        | Purpose                                      | Hosted On         | Provisioned By  | Managed By      | Access                        |
|--------|--------------------|----------------------------------------------|-------------------|-----------------|-----------------|-------------------------------|
| ENV-001| Development (DEV)  | Active development; feature branch testing   | AWS (ap-south-1)  | Delivery Team   | Delivery Team   | Dev team only                 |
| ENV-002| QA / Testing (QA)  | Integration testing; QA test cycles          | AWS (ap-south-1)  | Delivery Team   | Delivery Team   | Dev + QA teams                |
| ENV-003| Staging (STG)      | UAT; pre-production validation; perf tests   | AWS (ap-south-1)  | Delivery Team   | Delivery Team   | Dev, QA, Ops, Customer UAT    |
| ENV-004| Production (PROD)  | Live customer-facing environment             | AWS (ap-south-1)  | Delivery Team   | Customer IT     | Restricted; change-controlled |
| ENV-005| DR (Disaster Recov)| Standby for production failover              | AWS (ap-south-2 / | Customer IT     | Customer IT     | Restricted; automated failover|
|        |                    |                                              | alternate AZ)     |                 |                 |                               |


─────────────────────────────────────────────────────────────
19B. ENVIRONMENT DETAILS
─────────────────────────────────────────────────────────────

  CLOUD PROVIDER    : AWS
  PRIMARY REGION    : ap-south-1 (Mumbai) — mandatory for data residency compliance
  ACCOUNT OWNERSHIP : Customer-owned AWS account (delivery team operates with IAM roles)
  ACCOUNT ACCESS    : Delivery team requires IAM roles with least-privilege permissions;
                      production access via break-glass procedure only

  DEPLOYMENT TARGET : Cloud (AWS) — NOT on-premise for Phase 1
                      On-premise deployment: Not in scope for Phase 1;
                      evaluate for regulated-environment requirement in Phase 2

  COMPUTE           : AWS ECS (Fargate) — serverless containers; no EC2 management
  GPU REQUIREMENTS  : Not applicable for Phase 1.
                      If on-device ML (OCR enhancement) is introduced in Phase 2,
                      GPU instances (AWS g4dn) may be required — to be assessed.

  NETWORK           : VPC with private subnets for backend services;
                      public subnets for API Gateway and load balancer only;
                      CBS API access over private VPN / Direct Connect

  DATA HANDLING:
    DEV / QA        : Synthetic/anonymized test data ONLY. No real customer PII.
    STG             : Anonymized production-like data for UAT; not real PII.
    PROD            : Real customer data. Full DPDP Act 2023 compliance required.

  ENVIRONMENT PROVISIONING TIMELINE:
    DEV             : Week 1 of Sprint 1
    QA              : Week 2 of Sprint 1
    STG             : 2 weeks before UAT begins
    PROD            : 1 week before go-live
    DR              : Simultaneously with PROD setup
```

---

## 20. High-Level Timelines

> **Guideline:** This section documents the customer's timeline expectations and the
> proposed delivery phasing. These are planning-level estimates, not sprint commitments.
> Dates must be agreed and signed off by the customer at kick-off.
>
> Highlight any hard deadlines (board commitments, regulatory dates, marketing launches)
> that are non-negotiable. All other dates are targets that should be revisited at sprint
> planning based on team velocity and scope confirmation.

```
─────────────────────────────────────────────────────────────
20A. MILESTONE TIMELINE
─────────────────────────────────────────────────────────────

| # | Milestone                                    | Target Date   | Status        | Notes                                           |
|---|----------------------------------------------|---------------|---------------|-------------------------------------------------|
| 1 | Project Kick-off & PRD Sign-off              | DD-MMM-YYYY   | Planned       |                                                 |
| 2 | Architecture & HLD Approval                  | DD-MMM-YYYY   | Planned       |                                                 |
| 3 | Environment Setup Complete (DEV + QA)         | DD-MMM-YYYY   | Planned       | Blocked on REC-007 (AWS access)                 |
| 4 | Sprint 0 — Planning, Backlog, Design          | DD-MMM-YYYY   | Planned       |                                                 |
| 5 | Phase 1 Development Start                    | DD-MMM-YYYY   | Planned       |                                                 |
| 6 | Alpha Release (DEV) — Registration + KYC     | DD-MMM-YYYY   | Planned       | Internal demo to stakeholders                   |
| 7 | Beta Release (QA) — Full Phase 1 flow        | DD-MMM-YYYY   | Planned       | QA cycle begins; integration testing            |
| 8 | Staging Release + UAT Start                  | DD-MMM-YYYY   | Planned       | Operations team UAT (2 weeks); blocked on REC-011|
| 9 | UAT Sign-off                                 | DD-MMM-YYYY   | Planned       | HARD DEADLINE — board commitment milestone      |
|10 | Security Penetration Test Sign-off           | DD-MMM-YYYY   | Planned       | Required before go-live clearance               |
|11 | Regulatory Compliance Sign-off               | DD-MMM-YYYY   | Planned       | Legal / Compliance; blocked on REC-012          |
|12 | Phase 1 Go-Live (Production Release)         | DD-MMM-YYYY   | Planned       | **HARD DEADLINE** — July 2026 board commitment  |
|13 | Hypercare Period (2 weeks post go-live)      | DD-MMM-YYYY   | Planned       | Delivery team on standby                        |
|14 | Phase 1 Retrospective & Handover             | DD-MMM-YYYY   | Planned       |                                                 |
|15 | Phase 2 Kick-off                             | DD-MMM-YYYY   | Planned       | Subject to Phase 1 delivery and scope agreement |


─────────────────────────────────────────────────────────────
20B. PHASE SUMMARY
─────────────────────────────────────────────────────────────

  PHASE 1 — MVP (Estimated: [N] months)
    Scope    : Customer Registration, KYC & Document Handling,
               Account Provisioning, Notifications, Identity & Access Management
    EPICs    : EPIC-001, EPIC-002, EPIC-003, EPIC-004, EPIC-005
    Go-Live  : [Target Date] — HARD DEADLINE

  PHASE 2 — Extended Platform (Estimated: [N] months post Phase 1)
    Scope    : Operations Dashboard, Reporting & Analytics, Admin Config Panel,
               Mobile App (PWA enhancement), Multi-language support
    EPICs    : EPIC-006, EPIC-007 + new EPICs to be defined
    Go-Live  : [Target Date] — Subject to Phase 1 delivery and budget approval


─────────────────────────────────────────────────────────────
20C. SPRINT CADENCE
─────────────────────────────────────────────────────────────

  Sprint Duration    : 2 weeks
  Sprint Start Day   : Monday
  Sprint Review      : Last Friday of sprint
  Sprint Retrospec.  : Last Friday of sprint (after review)
  Sprint Planning    : First Monday of next sprint
  Release Cadence    : End of every 2 sprints (bi-weekly release to QA)
                       End of every 4 sprints (release to Staging)
```

---

## Revision History

> **Guideline:** Every significant change to this PRD must be versioned and recorded here.
> Version 1.0 is the initial approved baseline. All changes after baseline approval must
> go through a formal Change Request process before being reflected in this document.

```
| Version | Date         | Author         | Section(s) Changed                          | Change Summary                        | Approved By     |
|---------|--------------|----------------|---------------------------------------------|---------------------------------------|-----------------|
| 0.1     | DD-MMM-YYYY  | [Author Name]  | All                                         | Initial draft for internal review     | —               |
| 1.0     | DD-MMM-YYYY  | [Author Name]  | All                                         | Baseline approved at kick-off         | [Approver Name] |
| 1.1     | DD-MMM-YYYY  | [Author Name]  | [Section numbers]                           | [Brief description of change]         | [Approver Name] |
```

---

*Template Version: 1.0 | Last Reviewed: 26-Mar-2026*

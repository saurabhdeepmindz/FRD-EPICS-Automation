# PRD Completeness Checklist

> **Purpose:** Use this checklist when creating or reviewing a Product Requirements Document (PRD)
> to ensure all sections are filled in completely and correctly before the PRD is submitted for
> stakeholder review, baselined, or used as input for downstream documents (BRD, FRD, Initiatives,
> EPICs, User Stories).
>
> **When to use:**
> - **Author (BA / PO)** — self-review before submitting the PRD for approval
> - **Product Owner** — review before sharing with stakeholders or customer
> - **Solution Architect / Tech Lead** — review before HLD and LLD begin
> - **Delivery Manager** — review before project kick-off sign-off
> - **Customer / Sponsor** — baseline review before development commences
>
> **Scoring:** Each item is marked as one of:
> - `[ ]` — Not done
> - `[x]` — Complete
> - `[N/A]` — Not applicable (add a brief reason in the Notes column)
>
> A PRD is considered **BASELINED** only when all applicable items are marked `[x]`
> and the Final Readiness Gate is passed.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRD ID          : PRD-[XXX]
Product Name    : [Product / Application Name]
Reviewed By     : [Name / Role]
Review Date     : DD-MMM-YYYY
Review Stage    : [ Author Self-Review | PO Review | Architect Review | Customer Review | Final Approval ]
Overall Status  : [ NOT READY | READY WITH COMMENTS | BASELINED ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## SECTION 0 — Header & Metadata

> Verify the PRD's identity and administrative fields are correctly filled before
> reviewing any content section.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 0.1 | PRD ID is assigned and follows the naming convention (PRD-XXX) | `[ ]` | |
| 0.2 | Product Name is filled in — not left as placeholder text | `[ ]` | |
| 0.3 | Version number is set (1.0 for initial baseline) | `[ ]` | |
| 0.4 | Created Date is filled in (DD-MMM-YYYY format) | `[ ]` | |
| 0.5 | Last Updated date reflects the most recent edit | `[ ]` | |
| 0.6 | Author name and role are filled in | `[ ]` | |
| 0.7 | Reviewed By and Approved By fields are filled in (or TBD with a name assigned) | `[ ]` | |
| 0.8 | Status field is set to the correct current state | `[ ]` | |

---

## SECTION 1 — Overview / Objective of the Application

> Verifies the product vision, problem statement, and strategic purpose are clearly and
> completely defined. This section forms the foundation for all downstream documents.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.1 | Overview is written — not left as placeholder text | `[ ]` | |
| 1.2 | Product Name is stated clearly at the top of this section | `[ ]` | |
| 1.3 | Business Context is described — explains the current situation or problem driving this product | `[ ]` | |
| 1.4 | Objective is stated — describes what the product does and what it replaces or improves | `[ ]` | |
| 1.5 | The overview answers: *What is being built?* | `[ ]` | |
| 1.6 | The overview answers: *Why is it being built?* (business justification) | `[ ]` | |
| 1.7 | The overview answers: *For whom is it being built?* (target users) | `[ ]` | |
| 1.8 | The overview answers: *What value does it deliver?* (customer, operations, business impact) | `[ ]` | |
| 1.9 | Value is stated for each stakeholder group: end user, internal team, and business | `[ ]` | |
| 1.10 | The downstream document map is stated — which BRD, FRD, Initiative, and EPICs this PRD feeds | `[ ]` | |
| 1.11 | The overview is free of deep technical jargon — readable by a business executive | `[ ]` | |
| 1.12 | No feature-level detail is present in this section (features belong in Section 6) | `[ ]` | |

---

## SECTION 2 — High-Level Scope

> Verifies the product scope is broken down into functional areas and capabilities at a
> level sufficient for stakeholder agreement and delivery sizing.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 2.1 | High-Level Scope is written — not left as placeholder text | `[ ]` | |
| 2.2 | All functional areas of the product are listed (no major capability omitted) | `[ ]` | |
| 2.3 | Each functional area has at least two capabilities listed under it | `[ ]` | |
| 2.4 | The scope is broken down by product area or module — not just a paragraph of text | `[ ]` | |
| 2.5 | Phase 1 (MVP) scope is clearly distinguished from Phase 2 and beyond | `[ ]` | |
| 2.6 | Every capability listed in Phase 1 scope is traceable to at least one EPIC in the initiative | `[ ]` | |
| 2.7 | No capability appears in both High-Level Scope and Out of Scope (Section 3) | `[ ]` | |
| 2.8 | The scope has been reviewed and verbally agreed with the customer/sponsor before baselineation | `[ ]` | |

---

## SECTION 3 — Out of Scope

> Verifies that grey areas, adjacent capabilities, and deferred items are explicitly
> excluded to prevent scope creep and misunderstandings.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 3.1 | Out of Scope section is filled in — not left as placeholder text | `[ ]` | |
| 3.2 | At least five Out of Scope items are documented | `[ ]` | |
| 3.3 | Each excluded item is something that could reasonably be assumed to be in scope (not obvious exclusions) | `[ ]` | |
| 3.4 | Each excluded item states WHY it is excluded (deferred, separate initiative, not in roadmap, etc.) | `[ ]` | |
| 3.5 | Each excluded item states WHERE it is handled (Phase 2, another initiative ID, another team) where known | `[ ]` | |
| 3.6 | Mobile app scope (if web-only) is explicitly excluded | `[ ]` | |
| 3.7 | Data migration from legacy systems is addressed — either in scope or explicitly excluded | `[ ]` | |
| 3.8 | Multi-language / internationalisation is addressed — either in scope or explicitly excluded | `[ ]` | |
| 3.9 | The Out of Scope list has been reviewed and agreed upon with the customer before baselineation | `[ ]` | |
| 3.10 | Any item discussed during discovery but not included is captured here to prevent future disputes | `[ ]` | |

---

## SECTION 4 — Assumptions and Constraints

### 4A. Assumptions

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 4a.1 | At least five Assumptions are documented | `[ ]` | |
| 4a.2 | Each assumption is a condition believed to be true that, if false, would impact scope or design | `[ ]` | |
| 4a.3 | Each assumption has an Owner responsible for validating it | `[ ]` | |
| 4a.4 | Each assumption has a Validation Date by which it must be confirmed | `[ ]` | |
| 4a.5 | Each assumption has a Risk if False column filled in (impact of the assumption being wrong) | `[ ]` | |
| 4a.6 | Third-party vendor / API readiness assumptions are documented | `[ ]` | |
| 4a.7 | Customer data availability assumptions are documented (master data, migrations, reference data) | `[ ]` | |
| 4a.8 | Team / resource availability assumptions are documented | `[ ]` | |
| 4a.9 | Legal / compliance sign-off assumptions are documented | `[ ]` | |
| 4a.10 | Technology or infrastructure readiness assumptions are documented | `[ ]` | |

### 4B. Constraints

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 4b.1 | At least four Constraints are documented | `[ ]` | |
| 4b.2 | Each constraint is non-negotiable — it cannot be changed, only accommodated | `[ ]` | |
| 4b.3 | Each constraint has a Type assigned (Technical / Legal / Budget / Timeline / Organizational / Operational) | `[ ]` | |
| 4b.4 | Each constraint has an Impact on Design / Delivery column filled in | `[ ]` | |
| 4b.5 | Cloud provider and deployment region constraints are documented (data residency) | `[ ]` | |
| 4b.6 | Budget ceiling constraint is documented | `[ ]` | |
| 4b.7 | Hard timeline / go-live deadline constraints are documented | `[ ]` | |
| 4b.8 | Regulatory and legal constraints are documented | `[ ]` | |
| 4b.9 | Team size / capacity constraints are documented | `[ ]` | |
| 4b.10 | All constraints are consistent with the NFRs defined in Section 10 | `[ ]` | |

---

## SECTION 5 — Actors / User Types

### 5A. Actor Summary Table

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 5a.1 | At least three actors are listed in the summary table | `[ ]` | |
| 5a.2 | Each actor has a Type assigned (Human / System) | `[ ]` | |
| 5a.3 | Each actor has a Channel / Device specified (Web, Mobile, API, etc.) | `[ ]` | |
| 5a.4 | Each actor has a Frequency of Use specified (Daily, Occasional, Event-driven, etc.) | `[ ]` | |
| 5a.5 | All external system actors (third-party APIs, integrations) are listed as System actors | `[ ]` | |
| 5a.6 | All internal user types with different permissions are listed as separate actors | `[ ]` | |

### 5B. Actor Detail Blocks

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 5b.1 | A detail block exists for every human actor in the summary table | `[ ]` | |
| 5b.2 | Each actor has a Description explaining who they are in the context of this product | `[ ]` | |
| 5b.3 | Each actor has Goals stating what they are trying to achieve using the product | `[ ]` | |
| 5b.4 | Each actor has a Permissions list — what they can do in the system | `[ ]` | |
| 5b.5 | Each actor has a Restrictions list — what they must NOT be able to do | `[ ]` | |
| 5b.6 | Each actor has an Authentication method defined | `[ ]` | |
| 5b.7 | No actor has blank Restrictions — every actor has at least one explicit restriction | `[ ]` | |
| 5b.8 | Restrictions across actors do not contradict each other (e.g., two actors with the same restriction that shouldn't) | `[ ]` | |
| 5b.9 | All actors in Section 5 are referenced in at least one functional requirement in Section 6 | `[ ]` | |
| 5b.10 | All actors in Section 5 appear in at least one Customer Journey in Section 8 | `[ ]` | |

---

## SECTION 6 — Functional Requirements / Functional Features

> This is the most critical section. Each sub-check must be applied to EVERY module defined.

### 6A. Module Structure

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 6a.1 | At least two modules are defined | `[ ]` | |
| 6a.2 | Each module has a name that corresponds to a functional area in the High-Level Scope (Section 2) | `[ ]` | |
| 6a.3 | Each module includes an EPIC mapping — linking it to one or more EPIC IDs | `[ ]` | |
| 6a.4 | Each module has a brief Module Description explaining its purpose and boundaries | `[ ]` | |
| 6a.5 | No module in Section 6 covers a capability listed as Out of Scope in Section 3 | `[ ]` | |
| 6a.6 | All Phase 1 EPICs from Section 2 have at least one corresponding module defined in Section 6 | `[ ]` | |

### 6B. Features (per module)

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 6b.1 | Each module contains at least two features | `[ ]` | |
| 6b.2 | Each feature has a unique Feature ID (e.g., FR-001) | `[ ]` | |
| 6b.3 | Each feature has a Feature Name that clearly describes the specific capability | `[ ]` | |
| 6b.4 | Each feature has a User Story Mapping linking it to one or more User Story IDs (or TBD with sprint note) | `[ ]` | |
| 6b.5 | Each feature has a Description written in the format "The system shall [action] when [condition]" | `[ ]` | |
| 6b.6 | Each requirement statement is testable and unambiguous | `[ ]` | |
| 6b.7 | No requirement uses vague language such as "fast", "user-friendly", "appropriate", or "etc." | `[ ]` | |
| 6b.8 | At least one requirement per feature covers the failure or error path (not only the happy path) | `[ ]` | |
| 6b.9 | Security-sensitive features (authentication, document handling, data storage) have explicit security requirements | `[ ]` | |
| 6b.10 | Features involving third-party integrations reference the Integration ID from Section 7 | `[ ]` | |

### 6C. Business Rules (per module)

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 6c.1 | Each module contains at least two business rules | `[ ]` | |
| 6c.2 | Each business rule is a business policy or constraint — not a technical implementation detail | `[ ]` | |
| 6c.3 | Each business rule is specific and testable (a QA engineer can write a test case from it) | `[ ]` | |
| 6c.4 | Eligibility rules (who can access, who qualifies) are captured per module | `[ ]` | |
| 6c.5 | Uniqueness and duplication prevention rules are captured (e.g., one account per customer) | `[ ]` | |
| 6c.6 | Time-based rules (expiry, SLA windows, retry limits) are captured | `[ ]` | |
| 6c.7 | Data retention rules are captured for any module that stores customer or document data | `[ ]` | |
| 6c.8 | All business rules are reflected in Acceptance Criteria in the corresponding User Stories | `[ ]` | |

---

## SECTION 7 — Integration Requirements

### 7A. Integration Summary Table

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 7a.1 | All external integrations are listed in the summary table | `[ ]` | |
| 7a.2 | All internal system-to-system integrations are listed | `[ ]` | |
| 7a.3 | Each integration has an INT-ID assigned | `[ ]` | |
| 7a.4 | Each integration has a Type specified (REST API / Message Queue / OAuth / File Transfer / etc.) | `[ ]` | |
| 7a.5 | Each integration has a Direction specified (Inbound / Outbound / Bidirectional) | `[ ]` | |
| 7a.6 | Each integration has an Owner identified (internal team or vendor name) | `[ ]` | |
| 7a.7 | Each integration states whether the API contract is Available, TBD, or a target date | `[ ]` | |
| 7a.8 | Each integration has a Priority (High / Medium / Low) | `[ ]` | |
| 7a.9 | All integrations referenced in Section 6 (Functional Requirements) appear in this table | `[ ]` | |

### 7B. Integration Detail Blocks

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 7b.1 | A detail block exists for every High-priority integration | `[ ]` | |
| 7b.2 | Each detail block specifies Data Sent and Data Received | `[ ]` | |
| 7b.3 | Each detail block specifies the Authentication mechanism | `[ ]` | |
| 7b.4 | Each detail block specifies SLA / Timeout values and circuit breaker behaviour | `[ ]` | |
| 7b.5 | Each detail block specifies the Error Handling approach (retry, fallback, alert) | `[ ]` | |
| 7b.6 | Each detail block references the Feature ID(s) from Section 6 that use this integration | `[ ]` | |
| 7b.7 | No integration stores API keys or secrets in source code (secrets manager reference is noted) | `[ ]` | |
| 7b.8 | Integrations with missing API contracts have a named owner and a target date for delivery | `[ ]` | |

---

## SECTION 8 — Customer Journeys / Flows

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 8.1 | At least two Customer Journeys are documented | `[ ]` | |
| 8.2 | Every primary actor from Section 5 has at least one journey documented | `[ ]` | |
| 8.3 | Each journey has a named Actor, a Goal, a Trigger, and an End State | `[ ]` | |
| 8.4 | Each journey includes a Happy Path with numbered, sequential steps | `[ ]` | |
| 8.5 | Each step in the Happy Path specifies who acts (actor or system) | `[ ]` | |
| 8.6 | Happy Path has a clear Start Point (what initiates the flow) | `[ ]` | |
| 8.7 | Happy Path has a clear End State (what success looks like) | `[ ]` | |
| 8.8 | At least one Alternate Path is documented per journey (non-happy-path scenario) | `[ ]` | |
| 8.9 | At least one Exception / Error Path is documented per journey (system failure, validation failure) | `[ ]` | |
| 8.10 | Each Alternate and Exception Path states its trigger condition and resolution | `[ ]` | |
| 8.11 | All branch points in the flows are covered by functional requirements in Section 6 | `[ ]` | |
| 8.12 | A visual diagram reference (Lucidchart / Miro / Figma) is linked or placeholder link is present | `[ ]` | |
| 8.13 | No journey step references a feature listed as Out of Scope in Section 3 | `[ ]` | |

---

## SECTION 9 — Functional Landscape

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 9.1 | A Functional Landscape representation is present (ASCII diagram or visual tool reference) | `[ ]` | |
| 9.2 | All modules from Section 6 appear in the Functional Landscape | `[ ]` | |
| 9.3 | The landscape shows the customer-facing layer (what users interact with) | `[ ]` | |
| 9.4 | The landscape shows the platform / API / backend layer | `[ ]` | |
| 9.5 | The landscape shows the operations / admin layer (if applicable) | `[ ]` | |
| 9.6 | The landscape shows external integrations at the system boundary | `[ ]` | |
| 9.7 | All external systems from Section 7 appear in the landscape | `[ ]` | |
| 9.8 | A visual diagram reference link is provided (or marked as TBD with owner and date) | `[ ]` | |
| 9.9 | The Functional Landscape is consistent with the High-Level Scope in Section 2 (no modules missing or extra) | `[ ]` | |

---

## SECTION 10 — Non-Functional Requirements

### 10.1 Security

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 10.1.1 | Data-in-transit encryption standard is defined (TLS version) | `[ ]` | |
| 10.1.2 | Data-at-rest encryption standard is defined (AES-256 or equivalent) | `[ ]` | |
| 10.1.3 | Authentication requirements are defined (MFA, OTP, biometric, SSO) | `[ ]` | |
| 10.1.4 | Authorisation / RBAC requirements are defined | `[ ]` | |
| 10.1.5 | Secret management policy is stated (no hardcoded secrets; secrets manager mandatory) | `[ ]` | |
| 10.1.6 | OWASP Top 10 mitigation requirement is stated | `[ ]` | |
| 10.1.7 | Penetration testing requirement is stated (mandatory before go-live) | `[ ]` | |
| 10.1.8 | Session timeout policy is defined | `[ ]` | |
| 10.1.9 | Failed authentication logging requirement is defined | `[ ]` | |
| 10.1.10 | Each security NFR is marked with a Priority (Critical / High / Medium) | `[ ]` | |

### 10.2 Performance

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 10.2.1 | API response time SLA is defined with a measurable threshold (e.g., P95 ≤ 2s) | `[ ]` | |
| 10.2.2 | Page load time SLA is defined (e.g., P95 ≤ 3s on 4G) | `[ ]` | |
| 10.2.3 | Third-party API call timeout thresholds are defined | `[ ]` | |
| 10.2.4 | Document processing / upload time thresholds are defined (if applicable) | `[ ]` | |
| 10.2.5 | Concurrent user load target is defined (at Phase 1 launch and Phase 2) | `[ ]` | |
| 10.2.6 | Each performance NFR specifies the condition (normal load / peak load / burst) | `[ ]` | |

### 10.3 Scalability

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 10.3.1 | Horizontal scaling requirement is stated (stateless services) | `[ ]` | |
| 10.3.2 | Scaling ceiling is defined (e.g., "must support 10x growth without architectural change") | `[ ]` | |
| 10.3.3 | Database read replica or scaling approach is defined | `[ ]` | |
| 10.3.4 | File / object storage scalability requirement is stated | `[ ]` | |
| 10.3.5 | Message queue burst handling requirement is stated (if event-driven integrations are in scope) | `[ ]` | |

### 10.4 Availability and Reliability

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 10.4.1 | Uptime SLA is defined as a percentage (e.g., 99.9%) | `[ ]` | |
| 10.4.2 | Planned maintenance window policy is defined (maximum duration and preferred time) | `[ ]` | |
| 10.4.3 | Automated health check and restart policy is stated | `[ ]` | |
| 10.4.4 | Circuit breaker requirement for external API calls is stated | `[ ]` | |
| 10.4.5 | Mean Time to Recovery (MTTR) target is defined for P1 incidents | `[ ]` | |
| 10.4.6 | Recovery Time Objective (RTO) is defined | `[ ]` | |
| 10.4.7 | Recovery Point Objective (RPO) is defined | `[ ]` | |

### 10.5 Compliance

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 10.5.1 | All applicable compliance regulations are listed (DPDP, GDPR, PCI-DSS, RBI, etc.) | `[ ]` | |
| 10.5.2 | Each compliance regulation states what it mandates for this product | `[ ]` | |
| 10.5.3 | Data residency requirements are stated (region, cloud zone) | `[ ]` | |
| 10.5.4 | Customer consent capture and audit requirements are stated | `[ ]` | |
| 10.5.5 | Compliance NFRs are consistent with Section 15 (Compliance Requirements) — no contradictions | `[ ]` | |

### 10.6 Maintainability

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 10.6.1 | Independent deployability requirement is stated (services can be deployed without full platform restart) | `[ ]` | |
| 10.6.2 | Minimum unit test coverage threshold is defined (e.g., ≥ 80%) | `[ ]` | |
| 10.6.3 | Externalised configuration requirement is stated (no hardcoded thresholds or feature flags) | `[ ]` | |
| 10.6.4 | API documentation requirement is stated (OpenAPI / Swagger auto-generation) | `[ ]` | |
| 10.6.5 | Technical debt management policy is stated | `[ ]` | |

### 10.7 Audit & Logs

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 10.7.1 | Application state transition logging requirement is stated (every status change must be logged) | `[ ]` | |
| 10.7.2 | Operations agent action logging requirement is stated (approve, reject, override) | `[ ]` | |
| 10.7.3 | Admin configuration change logging requirement is stated (before/after values) | `[ ]` | |
| 10.7.4 | Centralised log aggregation tool is specified (CloudWatch, ELK, Loki, etc.) | `[ ]` | |
| 10.7.5 | Log retention period is defined (operational logs vs. compliance/audit logs) | `[ ]` | |
| 10.7.6 | PII masking in logs requirement is stated — raw PII must not appear in plaintext log entries | `[ ]` | |

---

## SECTION 11 — Technology

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 11.1 | Technology stack is defined for all applicable layers | `[ ]` | |
| 11.2 | Frontend technology is specified | `[ ]` | |
| 11.3 | Backend / API technology is specified | `[ ]` | |
| 11.4 | Primary relational database is specified | `[ ]` | |
| 11.5 | NoSQL / caching layer is specified (if applicable) | `[ ]` | |
| 11.6 | File / document storage technology is specified | `[ ]` | |
| 11.7 | Event streaming / message queue technology is specified (if event-driven integrations exist) | `[ ]` | |
| 11.8 | Authentication / Identity Provider technology is specified | `[ ]` | |
| 11.9 | Cloud provider and region are specified | `[ ]` | |
| 11.10 | Infrastructure-as-Code (IaC) tooling is specified | `[ ]` | |
| 11.11 | Each technology choice is marked as MANDATORY or PREFERRED | `[ ]` | |
| 11.12 | MANDATORY technology choices are traceable to a constraint in Section 4B or an NFR in Section 10 | `[ ]` | |
| 11.13 | A note is present stating that deviation from MANDATORY items requires Architecture Review Board approval | `[ ]` | |
| 11.14 | No technology choice contradicts an NFR or constraint (e.g., a technology that cannot meet the SLA) | `[ ]` | |

---

## SECTION 12 — DevOps and Observability

### 12A. CI/CD Pipeline

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 12a.1 | Source control system is specified | `[ ]` | |
| 12a.2 | CI pipeline tool is specified (Jenkins, GitHub Actions, GitLab CI, etc.) | `[ ]` | |
| 12a.3 | Code quality gate tool is specified (SonarQube or equivalent) | `[ ]` | |
| 12a.4 | Dependency vulnerability scanning tool is specified | `[ ]` | |
| 12a.5 | Container registry is specified (if containerised) | `[ ]` | |
| 12a.6 | CD pipeline / deployment tool is specified | `[ ]` | |
| 12a.7 | Deployment strategy is specified (Blue-Green / Canary / Rolling) | `[ ]` | |
| 12a.8 | Mandatory pipeline gates are defined (tests must pass, coverage threshold, no critical CVEs) | `[ ]` | |
| 12a.9 | Provider of each CI/CD component is identified (Delivery Team / Customer IT / Managed Service) | `[ ]` | |

### 12B. Monitoring & Observability

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 12b.1 | Metrics and dashboard tool is specified (Grafana, Datadog, CloudWatch, etc.) | `[ ]` | |
| 12b.2 | Log aggregation tool is specified | `[ ]` | |
| 12b.3 | Distributed tracing tool is specified (X-Ray, Jaeger, etc.) | `[ ]` | |
| 12b.4 | Error tracking / APM tool is specified (Sentry, New Relic, etc.) | `[ ]` | |
| 12b.5 | Alerting and on-call management tool is specified (PagerDuty, OpsGenie, etc.) | `[ ]` | |
| 12b.6 | Key dashboards required are listed (at least three business-critical dashboards) | `[ ]` | |
| 12b.7 | Incident severity levels are defined (P1–P4) with response and resolution targets | `[ ]` | |

---

## SECTION 13 — UI/UX Requirements

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 13.1 | UI/UX Requirements section is filled in — not left as placeholder | `[ ]` | |
| 13.2 | Mobile-first / responsive design requirement is stated | `[ ]` | |
| 13.3 | Minimum screen width / device support is stated | `[ ]` | |
| 13.4 | Inline / real-time form validation requirement is stated | `[ ]` | |
| 13.5 | Human-readable error message requirement is stated (no raw error codes shown to users) | `[ ]` | |
| 13.6 | Accessibility standard is specified (WCAG 2.1 AA or equivalent) | `[ ]` | |
| 13.7 | Progress indicator requirement for multi-step flows is stated | `[ ]` | |
| 13.8 | Loading state / skeleton loader requirement for async operations is stated | `[ ]` | |
| 13.9 | Form persistence / save-and-resume requirement is stated (if applicable) | `[ ]` | |
| 13.10 | Color-blind / non-color-dependent UI requirement is stated | `[ ]` | |
| 13.11 | A wireframe / prototype tool reference link is provided (or marked TBD with owner) | `[ ]` | |
| 13.12 | Each UX requirement is independently testable — no vague language like "intuitive" or "clean" | `[ ]` | |

---

## SECTION 14 — Branding Requirements

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 14.1 | A reference to the customer's Brand Guidelines document is provided (or TBD with owner) | `[ ]` | |
| 14.2 | Primary and secondary colour hex codes are specified (or TBD) | `[ ]` | |
| 14.3 | Primary font(s) are specified (name, weight) for headings and body | `[ ]` | |
| 14.4 | Logo usage rules are stated (placement, minimum size) | `[ ]` | |
| 14.5 | Icon library is specified (or TBD with decision timeline) | `[ ]` | |
| 14.6 | Button and UI component style is described | `[ ]` | |
| 14.7 | Email template reference is provided (or TBD) | `[ ]` | |
| 14.8 | Favicon and PWA app icon specifications are stated (or TBD) | `[ ]` | |
| 14.9 | A note is present that all brand assets are a Receivable from the customer (cross-reference Section 18) | `[ ]` | |
| 14.10 | Any known conflict between brand colours and WCAG accessibility contrast requirements is flagged | `[ ]` | |

---

## SECTION 15 — Compliance Requirements

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 15.1 | All applicable compliance regulations are listed in the table | `[ ]` | |
| 15.2 | Each regulation has a COMP-ID assigned | `[ ]` | |
| 15.3 | Each regulation states its Applicability (what part of the product it applies to) | `[ ]` | |
| 15.4 | Each regulation states the Key Requirements that the product must meet | `[ ]` | |
| 15.5 | Each regulation has a Sign-off Owner identified | `[ ]` | |
| 15.6 | DPDP Act 2023 (India) or GDPR is addressed — depending on jurisdiction | `[ ]` | |
| 15.7 | KYC / AML / identity verification regulations are addressed (if applicable) | `[ ]` | |
| 15.8 | PCI-DSS applicability is confirmed — either in scope or explicitly not applicable (with reason) | `[ ]` | |
| 15.9 | OWASP Top 10 is listed as a compliance requirement | `[ ]` | |
| 15.10 | Compliance requirements are consistent with Section 10.5 (NFR Compliance) — no contradictions | `[ ]` | |
| 15.11 | All compliance sign-off requirements are cross-referenced in Section 18 (Receivables) | `[ ]` | |

---

## SECTION 16 — Testing Requirements

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 16.1 | At least six testing types are defined | `[ ]` | |
| 16.2 | Each test type has a TEST-ID assigned | `[ ]` | |
| 16.3 | Each test type has a Scope defined (what is being tested) | `[ ]` | |
| 16.4 | Each test type has a Tool or Approach specified | `[ ]` | |
| 16.5 | Each test type has an Owner specified (Dev Team, QA Team, Security Team, etc.) | `[ ]` | |
| 16.6 | Each test type has Exit Criteria defined (what "done" means for this test type) | `[ ]` | |
| 16.7 | Unit Testing is included with a minimum coverage threshold | `[ ]` | |
| 16.8 | Integration Testing is included covering all third-party API integrations | `[ ]` | |
| 16.9 | Functional / UAT Testing is included with Operations team as a participant | `[ ]` | |
| 16.10 | Performance / Load Testing is included with reference to NFR thresholds from Section 10.2 | `[ ]` | |
| 16.11 | Security / Penetration Testing is included as a mandatory pre-go-live gate | `[ ]` | |
| 16.12 | Regression Testing is included for every sprint release | `[ ]` | |
| 16.13 | Accessibility Testing is included with WCAG standard reference | `[ ]` | |
| 16.14 | Disaster Recovery Testing is included (if DR environment is in scope per Section 19) | `[ ]` | |

---

## SECTION 17 — Key Deliverables

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 17.1 | At least ten deliverables are listed | `[ ]` | |
| 17.2 | Each deliverable has a DEL-ID assigned | `[ ]` | |
| 17.3 | Each deliverable has a Format specified (Markdown, PDF, Word, YAML, Git repo, etc.) | `[ ]` | |
| 17.4 | Each deliverable has a Produced By field (which team or role creates it) | `[ ]` | |
| 17.5 | Each deliverable has a Delivery Phase / Milestone specified | `[ ]` | |
| 17.6 | PRD, BRD, and FRD are listed as deliverables | `[ ]` | |
| 17.7 | EPIC and User Story documents are listed as deliverables | `[ ]` | |
| 17.8 | HLD and LLD documents are listed as deliverables | `[ ]` | |
| 17.9 | Source Code (Git repository) is listed as a deliverable | `[ ]` | |
| 17.10 | API documentation (OpenAPI / Swagger) is listed | `[ ]` | |
| 17.11 | Test cases and test results report are listed | `[ ]` | |
| 17.12 | Penetration test report is listed | `[ ]` | |
| 17.13 | Operations Runbook is listed | `[ ]` | |
| 17.14 | Go-Live Readiness Checklist sign-off is listed | `[ ]` | |
| 17.15 | Every deliverable listed here is contractually agreed — nothing is listed without customer agreement | `[ ]` | |

---

## SECTION 18 — Receivables

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 18.1 | At least eight Receivables are documented | `[ ]` | |
| 18.2 | Each receivable has a REC-ID assigned | `[ ]` | |
| 18.3 | Each receivable states WHY it is needed (which deliverable or development activity depends on it) | `[ ]` | |
| 18.4 | Each receivable has a Provided By field (which customer team or role must supply it) | `[ ]` | |
| 18.5 | Each receivable has a Required By date (before which the delivery team needs it) | `[ ]` | |
| 18.6 | Each receivable has a Risk if Late field (impact on delivery if it arrives late) | `[ ]` | |
| 18.7 | BRD (if not yet provided) is listed as a Receivable | `[ ]` | |
| 18.8 | Third-party API contracts (KYC, payment, etc.) are listed as Receivables | `[ ]` | |
| 18.9 | Brand assets (logo, fonts, icons) are listed as Receivables | `[ ]` | |
| 18.10 | Cloud / infrastructure access credentials are listed as Receivables | `[ ]` | |
| 18.11 | Legal / compliance sign-offs are listed as Receivables | `[ ]` | |
| 18.12 | UAT team availability is listed as a Receivable | `[ ]` | |
| 18.13 | Receivables with HIGH risk impact are flagged and their dates are tracked with named owners | `[ ]` | |
| 18.14 | All receivables are shared with the customer / sponsor for acknowledgement at kick-off | `[ ]` | |

---

## SECTION 19 — Environment

### 19A. Environment Table

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 19a.1 | All environments are listed: DEV, QA, Staging, Production, and DR (if applicable) | `[ ]` | |
| 19a.2 | Each environment has a Purpose defined | `[ ]` | |
| 19a.3 | Each environment has a Hosted On field (Cloud provider / On-premise) | `[ ]` | |
| 19a.4 | Each environment has a Provisioned By field (Delivery Team / Customer IT) | `[ ]` | |
| 19a.5 | Each environment has a Managed By field | `[ ]` | |
| 19a.6 | Each environment has an Access policy defined | `[ ]` | |

### 19B. Environment Details

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 19b.1 | Cloud provider and primary region are stated | `[ ]` | |
| 19b.2 | Cloud region selection is justified and consistent with data residency constraints (Section 4B) | `[ ]` | |
| 19b.3 | Account ownership model is stated (customer-owned vs delivery team-owned) | `[ ]` | |
| 19b.4 | On-premise vs cloud deployment decision is explicitly stated | `[ ]` | |
| 19b.5 | GPU requirements are addressed — either specified or explicitly confirmed as not applicable | `[ ]` | |
| 19b.6 | Data handling policy per environment is stated (no real PII in DEV/QA/STG) | `[ ]` | |
| 19b.7 | Network architecture summary is stated (VPC, public vs private subnet, VPN for internal systems) | `[ ]` | |
| 19b.8 | Environment provisioning timeline is stated (when each env will be ready) | `[ ]` | |
| 19b.9 | Cloud access required from delivery team is listed as a Receivable in Section 18 | `[ ]` | |

---

## SECTION 20 — High-Level Timelines

### 20A. Milestone Table

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 20a.1 | At least eight milestones are documented | `[ ]` | |
| 20a.2 | Each milestone has a Target Date (DD-MMM-YYYY format) | `[ ]` | |
| 20a.3 | Each milestone has a Status set | `[ ]` | |
| 20a.4 | Hard deadlines (board commitments, regulatory dates, marketing launches) are explicitly labelled | `[ ]` | |
| 20a.5 | Project Kick-off and PRD Sign-off are listed as milestones | `[ ]` | |
| 20a.6 | Architecture / HLD Approval is listed as a milestone | `[ ]` | |
| 20a.7 | UAT Start and UAT Sign-off are listed as separate milestones | `[ ]` | |
| 20a.8 | Security Penetration Test sign-off is listed as a milestone | `[ ]` | |
| 20a.9 | Phase 1 Go-Live is listed as a milestone | `[ ]` | |
| 20a.10 | Post-launch Hypercare period end is listed as a milestone | `[ ]` | |
| 20a.11 | Milestones that are blocked by Receivables from Section 18 are noted with the REC-ID reference | `[ ]` | |

### 20B. Phase Summary

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 20b.1 | Phase 1 scope (EPIC list) is summarised | `[ ]` | |
| 20b.2 | Phase 2 scope is summarised (even if high-level and subject to review) | `[ ]` | |
| 20b.3 | Phase boundary is clearly defined — what is in Phase 1 vs Phase 2 is unambiguous | `[ ]` | |

### 20C. Sprint Cadence

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 20c.1 | Sprint duration is defined | `[ ]` | |
| 20c.2 | Sprint start day is defined | `[ ]` | |
| 20c.3 | Sprint ceremonies (Review, Retrospective, Planning) and their day/cadence are defined | `[ ]` | |
| 20c.4 | Release cadence (how often releases go to QA and Staging) is defined | `[ ]` | |

---

## SECTION RH — Revision History

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| RH.1 | Version 0.1 (initial draft) entry exists with date and author | `[ ]` | |
| RH.2 | Version 1.0 (baselined) entry exists with date, author, and approver | `[ ]` | |
| RH.3 | Every significant change after v1.0 is recorded with a new version entry | `[ ]` | |
| RH.4 | The latest version's date in Revision History matches the Last Updated date in the header | `[ ]` | |
| RH.5 | All post-baseline changes went through a formal Change Request process (noted in the entry) | `[ ]` | |

---

## SECTION 21 — Success Criteria

> Verifies that the product has defined clear, measurable, and time-bound indicators of success.
> These must be agreed with the customer before the PRD is baselined — they are the primary
> post-go-live accountability instrument.

### 21A. Business Success Criteria

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 21a.1 | At least 3 business success criteria are defined (not left as placeholder rows) | `[ ]` | |
| 21a.2 | Each criterion has a specific measurable target — no vague language like "improved" or "better" | `[ ]` | |
| 21a.3 | Each criterion has a defined measurement window (e.g., "30 days post go-live") | `[ ]` | |
| 21a.4 | Each criterion has an assigned owner who is accountable for measurement and reporting | `[ ]` | |
| 21a.5 | Each criterion is traceable to at least one EPIC or functional area | `[ ]` | |
| 21a.6 | Business success criteria have been reviewed and agreed by the customer / sponsor | `[ ]` | |

### 21B. Operational / Technical Success Criteria

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 21b.1 | At least 2 technical success criteria are defined (uptime, performance, or security) | `[ ]` | |
| 21b.2 | Each technical criterion maps to a corresponding NFR in Section 10 or a compliance item in Section 15 | `[ ]` | |
| 21b.3 | Measurement method is defined for each technical criterion (e.g., APM tool, test report) | `[ ]` | |

### 21C. Hypercare / Go-Live Readiness Gate

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 21c.1 | Hypercare gate conditions are listed (what must be confirmed before hypercare closes) | `[ ]` | |
| 21c.2 | Hypercare sign-off owners are named (customer, delivery manager, tech lead) | `[ ]` | |

---

## SECTION 22 — Miscellaneous Requirements

> Verifies that ad-hoc, late-arriving, or unclassified requirements are captured, owned,
> and traced before the PRD is baselined. No requirement — regardless of source — should
> be undocumented or untraceable.

### 22A. Raw Input Log

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 22a.1 | Every verbatim customer input (emails, meeting notes, WhatsApp messages with requirements) that does not fit another section is logged here | `[ ]` | |
| 22a.2 | Each raw input entry is attributed to a source (person, meeting, date) | `[ ]` | |
| 22a.3 | No raw input entry is left without a corresponding structured row in Section 22B | `[ ]` | |

### 22B. Structured Miscellaneous Requirements

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 22b.1 | Every MISC item has a unique MISC-ID assigned | `[ ]` | |
| 22b.2 | Each MISC item has a classification (Functional / NFR / Compliance / Branding / Other) | `[ ]` | |
| 22b.3 | Each MISC item has a migration target — either a PRD section it will move to, or "Permanent — No Section Fit" | `[ ]` | |
| 22b.4 | Each MISC item is traced to at least one EPIC | `[ ]` | |
| 22b.5 | Each MISC item has an assigned owner | `[ ]` | |
| 22b.6 | No MISC item has status "Decision Pending" without an escalation record and a decision-by date | `[ ]` | |

### 22C. Migration Tracker

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 22c.1 | All MISC items marked "Pending Migration" have a target migration date | `[ ]` | |
| 22c.2 | Items that have been migrated to their target section are marked Closed with a cross-reference pointer | `[ ]` | |
| 22c.3 | At PRD baseline, zero MISC items remain as "Pending Migration" — all are either Closed (migrated) or confirmed "Permanent — No Section Fit" | `[ ]` | |

---

## CROSS-SECTION CONSISTENCY CHECKS

> Run these after all individual section checks are complete. These validate that sections
> are internally consistent with each other, not just individually complete.

| # | Consistency Check | Status | Notes / Comments |
|---|-------------------|--------|------------------|
| CC.1 | Every functional area in Section 2 (High-Level Scope) has a corresponding module in Section 6 | `[ ]` | |
| CC.2 | No module in Section 6 covers a capability listed as Out of Scope in Section 3 | `[ ]` | |
| CC.3 | Every actor in Section 5 appears in at least one Customer Journey in Section 8 | `[ ]` | |
| CC.4 | Every actor in Section 5 is referenced in at least one functional requirement in Section 6 | `[ ]` | |
| CC.5 | Every integration referenced in Section 6 (Functional Requirements) has a corresponding entry in Section 7 | `[ ]` | |
| CC.6 | All external systems in Section 7 appear in the Functional Landscape in Section 9 | `[ ]` | |
| CC.7 | The technology choices in Section 11 are capable of meeting the NFRs in Section 10 (no contradictions) | `[ ]` | |
| CC.8 | The technology choices in Section 11 are consistent with the constraints in Section 4B (MANDATORY choices trace to constraints) | `[ ]` | |
| CC.9 | The compliance regulations in Section 15 are consistent with compliance NFRs in Section 10.5 | `[ ]` | |
| CC.10 | All compliance sign-offs in Section 15 are listed as Receivables in Section 18 | `[ ]` | |
| CC.11 | All brand assets in Section 14 are listed as Receivables in Section 18 | `[ ]` | |
| CC.12 | All third-party API contracts in Section 7 are listed as Receivables in Section 18 | `[ ]` | |
| CC.13 | Cloud access credentials in Section 19 are listed as Receivables in Section 18 | `[ ]` | |
| CC.14 | The testing types in Section 16 cover all NFR dimensions in Section 10 (Performance test for perf NFRs, security test for security NFRs, etc.) | `[ ]` | |
| CC.15 | The milestones in Section 20 are consistent with the Receivable required-by dates in Section 18 (receivables arrive before the milestone that depends on them) | `[ ]` | |
| CC.16 | All deliverables in Section 17 are consistent with the timeline in Section 20 (delivery dates are within the project timeline) | `[ ]` | |
| CC.17 | The environments in Section 19 match the testing environments required by Section 16 (UAT needs Staging, performance needs a production-like environment) | `[ ]` | |
| CC.18 | The sprint cadence in Section 20C is consistent with the delivery timeline in Section 20A (enough sprints to deliver Phase 1 scope) | `[ ]` | |
| CC.19 | Hard deadline milestones in Section 20 are reflected as Timeline constraints in Section 4B | `[ ]` | |
| CC.20 | No assumption in Section 4A is also listed as a confirmed fact elsewhere in the PRD | `[ ]` | |
| CC.21 | All Success Criteria in Section 21 are traceable to at least one EPIC, NFR, or functional requirement — no orphaned success criteria exist | `[ ]` | |
| CC.22 | Every MISC item in Section 22 that has been classified as Functional / NFR / Compliance / Branding has been either migrated to its target PRD section OR formally accepted as "Permanent — No Section Fit" — no unresolved items remain at baseline | `[ ]` | |

---

## FINAL READINESS GATE

> Complete this section last, after all individual section checks and cross-section consistency
> checks above are done. The PRD may only be baselined when all applicable items are `[x]`.

| # | Gate Check | Status | Notes / Comments |
|---|------------|--------|------------------|
| G.1 | All mandatory sections are fully completed — no placeholder text remains in any section | `[ ]` | |
| G.2 | All `[N/A]` items have a brief reason recorded in the Notes column | `[ ]` | |
| G.3 | The PRD has been self-reviewed by the Author before submission | `[ ]` | |
| G.4 | The PRD has been reviewed and accepted by the Product Owner | `[ ]` | |
| G.5 | The PRD has been reviewed by the Solution Architect or Tech Lead | `[ ]` | |
| G.6 | The PRD has been reviewed and signed off by the Delivery Manager | `[ ]` | |
| G.7 | The PRD has been reviewed and agreed with the Customer / Sponsor | `[ ]` | |
| G.8 | High-Level Scope (Section 2) and Out of Scope (Section 3) have been formally agreed with the customer | `[ ]` | |
| G.9 | All Assumptions (Section 4A) have been shared with and acknowledged by the relevant owners | `[ ]` | |
| G.10 | All Receivables (Section 18) have been shared with the customer with required-by dates acknowledged | `[ ]` | |
| G.11 | All 22 Cross-Section Consistency Checks (CC.1–CC.22) are passed | `[ ]` | |
| G.12 | No section in the PRD contradicts any other section | `[ ]` | |
| G.13 | The PRD is sufficient to begin BRD, FRD, and EPIC decomposition without ambiguity | `[ ]` | |
| G.14 | PRD status is updated to "Baselined" after this checklist is fully passed | `[ ]` | |

---

## CHECKLIST SIGN-OFF

```
Author              : [Name]                    Date : DD-MMM-YYYY
PO Review           : [Name]                    Date : DD-MMM-YYYY
Architect Review    : [Name]                    Date : DD-MMM-YYYY
Delivery Mgr Review : [Name]                    Date : DD-MMM-YYYY
Customer Sign-off   : [Name / Role]             Date : DD-MMM-YYYY

Overall Result      : [ NOT READY | READY WITH COMMENTS | BASELINED ]

Open Items / Comments:
  1. [Any open item that must be resolved before the PRD is baselined]
  2. [Any conditional approval note]
  3. [Any section flagged for revision]
```

---

## QUICK REFERENCE — SECTION PRIORITY BY REVIEW STAGE

> Use this table to focus your review effort based on the current review stage.
> ★ = Must pass at this stage before moving forward.

| Section | Description | Author Self-Review | PO Review | Architect Review | Customer Sign-off |
|---------|--------------|--------------------|-----------|------------------|-------------------|
| 0 | Header & Metadata | ★ | ★ | — | — |
| 1 | Overview / Objective | ★ | ★ | ★ | ★ |
| 2 | High-Level Scope | ★ | ★ | ★ | ★ |
| 3 | Out of Scope | ★ | ★ | ★ | ★ |
| 4A | Assumptions | ★ | ★ | ★ | ★ |
| 4B | Constraints | ★ | ★ | ★ | ★ |
| 5 | Actors / User Types | ★ | ★ | — | ★ |
| 6 | Functional Requirements | ★ | ★ | ★ | ★ |
| 7 | Integration Requirements | ★ | ★ | ★ | — |
| 8 | Customer Journeys | ★ | ★ | — | ★ |
| 9 | Functional Landscape | ★ | ★ | ★ | ★ |
| 10 | Non-Functional Requirements | ★ | ★ | ★ | — |
| 11 | Technology | — | — | ★ | — |
| 12 | DevOps & Observability | — | — | ★ | — |
| 13 | UI/UX Requirements | ★ | ★ | — | ★ |
| 14 | Branding Requirements | — | ★ | — | ★ |
| 15 | Compliance Requirements | ★ | ★ | ★ | ★ |
| 16 | Testing Requirements | ★ | ★ | ★ | — |
| 17 | Key Deliverables | ★ | ★ | — | ★ |
| 18 | Receivables | ★ | ★ | — | ★ |
| 19 | Environment | — | — | ★ | — |
| 20 | High-Level Timelines | ★ | ★ | — | ★ |
| 21 | Success Criteria | ★ | ★ | — | ★ |
| 22 | Miscellaneous Requirements | ★ | ★ | ★ | ★ |
| RH | Revision History | ★ | — | — | — |
| CC | Cross-Section Consistency | ★ | ★ | ★ | — |
| G | Final Readiness Gate | ★ | ★ | ★ | ★ |

---

*Checklist Version: 1.0 | Aligned to PRD-Template v1.0 | Last Reviewed: 26-Mar-2026*

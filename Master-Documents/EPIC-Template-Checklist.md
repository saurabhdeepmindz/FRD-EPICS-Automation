# EPIC Completeness Checklist

> **Purpose:** Use this checklist when creating or reviewing an EPIC to ensure all
> sections are filled in completely and correctly before the EPIC is submitted for review,
> approved, or moved to active development.
>
> **When to use:**
> - Author — self-review before submitting the EPIC for approval
> - Product Owner — review before accepting EPIC into the backlog
> - Scrum Master — sprint planning gate check
> - Reviewer / Tech Lead — before sign-off
>
> **Scoring:** Each item is marked as one of:
> - `[ ]` — Not done
> - `[x]` — Complete
> - `[N/A]` — Not applicable (add a brief reason in the Notes column)
>
> A checklist is considered **READY** only when all applicable items are marked `[x]`.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EPIC ID         : EPIC-[XXX]
EPIC Name       : [Name of the EPIC]
Reviewed By     : [Name / Role]
Review Date     : DD-MMM-YYYY
Review Stage    : [ Author Self-Review | PO Review | Tech Lead Review | Final Approval ]
Overall Status  : [ NOT READY | READY WITH COMMENTS | READY ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## SECTION 0 — Header & Metadata

> Verify the EPIC's identity and administrative fields are correctly filled before
> reviewing any content section.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 0.1 | EPIC ID is assigned and follows the naming convention (EPIC-XXX) | `[ ]` | |
| 0.2 | Created Date is filled in (DD-MMM-YYYY format) | `[ ]` | |
| 0.3 | Last Updated date reflects the most recent edit | `[ ]` | |
| 0.4 | Status field is set to the correct current state | `[ ]` | |

---

## SECTION R — Reference Documents

> Ensures full traceability from source documents to this EPIC.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| R.1 | At least one BRD or FRD is listed as a reference document | `[ ]` | |
| R.2 | Every reference document has a Document Type specified | `[ ]` | |
| R.3 | Every reference document has a Version number recorded | `[ ]` | |
| R.4 | Every reference document has an exact Section / Page reference (not just the document title) | `[ ]` | |
| R.5 | Every reference document has an Owner / Author identified | `[ ]` | |
| R.6 | Every reference document has a valid Location / Link where it can be accessed | `[ ]` | |
| R.7 | All wireframes or UI prototypes that informed this EPIC are listed | `[ ]` | |
| R.8 | All API contracts or interface specifications referenced are listed | `[ ]` | |
| R.9 | All compliance or regulatory documents that apply are listed | `[ ]` | |
| R.10 | Any key meeting minutes or decision logs that shaped this EPIC are listed | `[ ]` | |

---

## SECTION 1 — EPIC Name

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.1 | EPIC Name is filled in (not left as placeholder text) | `[ ]` | |
| 1.2 | EPIC Name is concise and clearly describes the capability being built | `[ ]` | |
| 1.3 | EPIC Name is free of unexplained technical abbreviations | `[ ]` | |
| 1.4 | EPIC Name is unique — does not duplicate the name of another EPIC in the Initiative | `[ ]` | |

---

## SECTION 2 — Initiative Reference

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 2.1 | Initiative ID is filled in and matches a valid, approved Initiative (INIT-XXX) | `[ ]` | |
| 2.2 | Initiative Name matches the official Initiative document | `[ ]` | |
| 2.3 | This EPIC is confirmed to belong to exactly one Initiative (not duplicated across Initiatives) | `[ ]` | |

---

## SECTION 3 — Summary

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 3.1 | Summary is written (not left as placeholder text) | `[ ]` | |
| 3.2 | Summary is 2–3 sentences — not a single vague line and not a full paragraph | `[ ]` | |
| 3.3 | Summary answers: *What capability is being built?* | `[ ]` | |
| 3.4 | Summary answers: *For whom is it being built?* | `[ ]` | |
| 3.5 | Summary answers: *Why does this matter to the business?* | `[ ]` | |
| 3.6 | Summary is readable by a business stakeholder (no deep technical jargon) | `[ ]` | |

---

## SECTION 4 — Description

### 4a. Key Actors

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 4a.1 | At least one Primary User actor is identified | `[ ]` | |
| 4a.2 | All internal users who interact with the system in this EPIC are listed | `[ ]` | |
| 4a.3 | All system actors (internal services, engines) involved are listed | `[ ]` | |
| 4a.4 | All external actors (third-party APIs, vendors) involved are listed | `[ ]` | |
| 4a.5 | Each actor has a clearly described Interaction / Responsibility (not left blank) | `[ ]` | |
| 4a.6 | No actor is listed without context — generic entries like "User" without a role are avoided | `[ ]` | |

### 4b. High-Level Flow

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 4b.1 | The Happy Path is documented with numbered steps | `[ ]` | |
| 4b.2 | Each step in the Happy Path represents a meaningful, distinct action or system event | `[ ]` | |
| 4b.3 | The Happy Path has a clear start point (what initiates the flow) | `[ ]` | |
| 4b.4 | The Happy Path has a clear end point (what "success" looks like) | `[ ]` | |
| 4b.5 | At least two Alternate / Exception Paths are documented | `[ ]` | |
| 4b.6 | Each Alternate Path states the trigger condition and the expected system response | `[ ]` | |
| 4b.7 | Failure scenarios (API errors, invalid input, abandonment) are covered | `[ ]` | |

---

## SECTION 5 — Pre-requisites

### 5a. EPIC Dependencies

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 5a.1 | All EPICs that must be complete (or partially complete) before this EPIC starts are listed | `[ ]` | |
| 5a.2 | Each EPIC dependency has a valid EPIC ID (EPIC-XXX) | `[ ]` | |
| 5a.3 | The required state for each EPIC dependency is specified (e.g., "Done", "Feature F-X live") | `[ ]` | |
| 5a.4 | Each dependency is classified as Hard (blocks progress) or Soft (preferred but not blocking) | `[ ]` | |
| 5a.5 | If there are no EPIC dependencies, this is explicitly stated as "None" | `[ ]` | |

### 5b. Feature / Functional Dependencies

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 5b.1 | All third-party APIs required are listed with their owner and required-by date | `[ ]` | |
| 5b.2 | All infrastructure dependencies (cloud, storage, environments) are listed | `[ ]` | |
| 5b.3 | All master data or reference data dependencies are listed | `[ ]` | |
| 5b.4 | All shared platform services consumed are listed | `[ ]` | |
| 5b.5 | If there are no functional dependencies, this is explicitly stated as "None" | `[ ]` | |

### 5c. Non-Technical Pre-requisites

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 5c.1 | All required legal or compliance approvals are listed | `[ ]` | |
| 5c.2 | All contractual sign-offs (vendor agreements, SOWs) are listed | `[ ]` | |
| 5c.3 | Environment readiness confirmations are listed | `[ ]` | |
| 5c.4 | Team training or onboarding requirements are listed | `[ ]` | |
| 5c.5 | Each non-technical pre-requisite has an Owner and a Target Date | `[ ]` | |
| 5c.6 | If there are no non-technical pre-requisites, this is explicitly stated as "None" | `[ ]` | |

---

## SECTION 6 — Trigger

### 6a. Planning Trigger

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 6a.1 | At least one planning trigger is documented | `[ ]` | |
| 6a.2 | Each trigger has a Trigger Type (EPIC-Based / Business Event / Feature-Based / Manual) | `[ ]` | |
| 6a.3 | Each trigger description is specific — not vague (e.g., not just "when ready") | `[ ]` | |

### 6b. Runtime Trigger

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 6b.1 | At least one runtime trigger is documented | `[ ]` | |
| 6b.2 | The runtime trigger clearly identifies the in-production event or action that starts the flow | `[ ]` | |
| 6b.3 | All runtime trigger types are covered: user action, system event, scheduled job (where applicable) | `[ ]` | |

---

## SECTION 7 — Scope

### 7a. Modules

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 7a.1 | All application modules involved in this EPIC are listed | `[ ]` | |
| 7a.2 | Each module has a unique Module ID (MOD-XX) | `[ ]` | |
| 7a.3 | Each module has a clear Description of its role within this EPIC | `[ ]` | |
| 7a.4 | Every module listed here has at least one feature mapped to it in Section 7b | `[ ]` | |
| 7a.5 | No module is listed that has zero features in scope (remove or mark as reference-only) | `[ ]` | |

### 7b. Features

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 7b.1 | All features to be built in this EPIC are listed | `[ ]` | |
| 7b.2 | Each feature has a unique Feature ID (F-XXX) | `[ ]` | |
| 7b.3 | Each feature is mapped to a Module Name from Section 7a | `[ ]` | |
| 7b.4 | Each feature has a Priority assigned (High / Medium / Low) | `[ ]` | |
| 7b.5 | Each feature has an FRD / BRD Reference linking it to the source document section or requirement ID | `[ ]` | |
| 7b.6 | No feature references a document section that is not listed in the Reference Documents section | `[ ]` | |
| 7b.7 | All High priority features are confirmed as in-scope for the current phase / MVP | `[ ]` | |
| 7b.8 | Features that will NOT be built in this phase are moved to Out of Scope (Section 12) | `[ ]` | |

### 7c. Edge Cases

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 7c.1 | At least three edge cases are documented | `[ ]` | |
| 7c.2 | Each edge case has a Trigger Condition (what causes it) | `[ ]` | |
| 7c.3 | Each edge case has an Expected System Behaviour (how the system must respond) | `[ ]` | |
| 7c.4 | Failure scenarios from the High-Level Flow (Section 4b) are reflected as edge cases | `[ ]` | |
| 7c.5 | Duplicate / repeat input scenarios are considered | `[ ]` | |
| 7c.6 | Third-party service failure scenarios are considered | `[ ]` | |
| 7c.7 | User abandonment and session timeout scenarios are considered | `[ ]` | |
| 7c.8 | Boundary / limit conditions (file size, age, data length) are considered | `[ ]` | |

---

## SECTION 8 — Acceptance Criteria

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 8.1 | At least five Acceptance Criteria are documented | `[ ]` | |
| 8.2 | Each criterion is testable and unambiguous — a tester can write a test case directly from it | `[ ]` | |
| 8.3 | Given-When-Then (GWT) format is used where applicable | `[ ]` | |
| 8.4 | At least one criterion covers the end-to-end happy path success condition | `[ ]` | |
| 8.5 | At least one criterion covers a failure / rejection scenario | `[ ]` | |
| 8.6 | At least one criterion covers a data integrity or security requirement | `[ ]` | |
| 8.7 | At least one criterion covers performance or response time | `[ ]` | |
| 8.8 | At least one criterion covers accessibility or compliance (where applicable) | `[ ]` | |
| 8.9 | No criterion uses vague language such as "fast", "user-friendly", or "works correctly" | `[ ]` | |

---

## SECTION 9 — Non-Functional Requirements

### 9a. Performance

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 9a.1 | At least one response time requirement is defined (page load, API call, processing time) | `[ ]` | |
| 9a.2 | Requirements are specified for both normal load and peak load conditions | `[ ]` | |
| 9a.3 | Each requirement has a measurable metric (e.g., "< 3 seconds", "95th percentile") | `[ ]` | |
| 9a.4 | Each requirement has a Verification Method (load test tool, monitoring, profiler) | `[ ]` | |

### 9b. Security

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 9b.1 | Data encryption requirements are defined (at rest and in transit) | `[ ]` | |
| 9b.2 | Authentication and session management requirements are defined | `[ ]` | |
| 9b.3 | Authorisation / role-based access requirements are defined | `[ ]` | |
| 9b.4 | Input sanitisation and injection prevention requirements are defined | `[ ]` | |
| 9b.5 | PII handling and masking requirements are defined (if EPIC handles personal data) | `[ ]` | |
| 9b.6 | Audit logging requirements are defined | `[ ]` | |
| 9b.7 | Each security requirement references a standard or regulation (OWASP, DPDP, GDPR, etc.) | `[ ]` | |
| 9b.8 | Each security requirement has a Verification Method (security review, pen test, DAST scan) | `[ ]` | |

### 9c. Reliability

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 9c.1 | Error rate threshold is defined (e.g., "< 0.1% error rate under normal load") | `[ ]` | |
| 9c.2 | Data loss prevention requirements are defined for failure scenarios | `[ ]` | |
| 9c.3 | Graceful degradation / fallback behaviour is defined for dependent service failures | `[ ]` | |
| 9c.4 | Idempotency requirements are defined for retry-prone operations | `[ ]` | |
| 9c.5 | Alerting requirements for critical failures are defined | `[ ]` | |

### 9d. Availability

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 9d.1 | Uptime target is defined as a percentage (e.g., "99.9% per month") | `[ ]` | |
| 9d.2 | Separate uptime targets are defined for customer-facing vs. internal components (where different) | `[ ]` | |
| 9d.3 | Planned maintenance window is defined (maximum allowed downtime, preferred time) | `[ ]` | |
| 9d.4 | Recovery Time Objective (RTO) is defined | `[ ]` | |
| 9d.5 | Recovery Point Objective (RPO) is defined | `[ ]` | |
| 9d.6 | Failover behaviour for third-party service outages is defined | `[ ]` | |

### 9e. Scalability

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 9e.1 | Maximum concurrent user load is defined | `[ ]` | |
| 9e.2 | Auto-scaling thresholds (scale-out and scale-in) are defined | `[ ]` | |
| 9e.3 | Data volume growth projections are defined (current and 12-month forecast) | `[ ]` | |
| 9e.4 | Database performance requirements at projected data volumes are defined | `[ ]` | |
| 9e.5 | Future growth ceiling (e.g., "must support 10x growth without architecture change") is stated | `[ ]` | |

---

## SECTION 10 — Business Value

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 10.1 | Quantitative benefits are listed (time saved, cost reduced, revenue gained, capacity increased) | `[ ]` | |
| 10.2 | Quantitative benefits include baseline figures and target figures (not just vague improvements) | `[ ]` | |
| 10.3 | Qualitative benefits are listed (NPS, compliance, brand, risk reduction) | `[ ]` | |
| 10.4 | Business Value is sufficient to justify this EPIC's priority in the backlog | `[ ]` | |

---

## SECTION 11 — Integration with Other EPICs

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 11.1 | All EPICs that this EPIC consumes services from (Master role) are listed | `[ ]` | |
| 11.2 | All EPICs that consume services from this EPIC (Slave role) are listed | `[ ]` | |
| 11.3 | Each integration row specifies the exact Service / Feature exchanged (not just the EPIC name) | `[ ]` | |
| 11.4 | Sequencing constraints are documented (which EPICs must complete before this one, and vice versa) | `[ ]` | |
| 11.5 | If there are no integrations with other EPICs, this is explicitly stated as "None" | `[ ]` | |
| 11.6 | All EPIC IDs referenced in this section exist in the Initiative's EPIC list | `[ ]` | |

---

## SECTION 12 — Out of Scope

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 12.1 | At least three Out of Scope items are documented | `[ ]` | |
| 12.2 | Each exclusion states what is excluded AND where it is being handled (or why it is deferred) | `[ ]` | |
| 12.3 | Items raised during EPIC discussions but not included are captured here (prevents future disputes) | `[ ]` | |
| 12.4 | Phase 2 / future items are explicitly listed here rather than left ambiguous | `[ ]` | |
| 12.5 | The Out of Scope list has been reviewed and agreed upon by the Product Owner and key stakeholders | `[ ]` | |

---

## SECTION 13 — Risks & Challenges

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 13.1 | At least three risks or challenges are documented | `[ ]` | |
| 13.2 | Each risk has a Likelihood rating (High / Medium / Low) | `[ ]` | |
| 13.3 | Each risk has an Impact rating (High / Medium / Low) | `[ ]` | |
| 13.4 | Each risk has a Mitigation Strategy (not left blank) | `[ ]` | |
| 13.5 | Third-party / vendor dependency risks are included | `[ ]` | |
| 13.6 | Technical complexity or POC risks are included | `[ ]` | |
| 13.7 | Compliance or regulatory risks are included (where applicable) | `[ ]` | |
| 13.8 | Resource or timeline risks are included | `[ ]` | |
| 13.9 | Scope creep risk is included | `[ ]` | |

---

## SECTION RH — Revision History

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| RH.1 | Version 1.0 entry exists with Created Date and Author | `[ ]` | |
| RH.2 | Every significant change to the EPIC after v1.0 is recorded with a new version entry | `[ ]` | |
| RH.3 | The Revision History reflects the Last Updated date in the EPIC header | `[ ]` | |

---

## Final Readiness Gate

> Complete this section last, after all individual section checks are done.
> The EPIC is only ready to move forward when all applicable items are checked.

| # | Gate Check | Status | Notes / Comments |
|---|------------|--------|------------------|
| G.1 | All mandatory sections are fully completed (no placeholder text remains) | `[ ]` | |
| G.2 | All `[N/A]` items have a brief reason recorded in the Notes column | `[ ]` | |
| G.3 | The EPIC has been self-reviewed by the Author before submission | `[ ]` | |
| G.4 | The EPIC has been reviewed and accepted by the Product Owner | `[ ]` | |
| G.5 | The EPIC has been reviewed by the Tech Lead or Architect | `[ ]` | |
| G.6 | All High-priority features have traceable BRD / FRD references | `[ ]` | |
| G.7 | No section contradicts another section (e.g., a feature listed in Scope also appears in Out of Scope) | `[ ]` | |
| G.8 | All EPIC IDs referenced (Pre-requisites, Integrations, Triggers) are valid and exist | `[ ]` | |
| G.9 | NFRs are complete and cover all five dimensions (Performance, Security, Reliability, Availability, Scalability) | `[ ]` | |
| G.10 | EPIC status is updated to "In Review" or "Approved" after checklist is passed | `[ ]` | |

---

## Checklist Sign-off

```
Author          : [Name]                    Date : DD-MMM-YYYY
PO Review       : [Name]                    Date : DD-MMM-YYYY
Tech Lead Review: [Name]                    Date : DD-MMM-YYYY
Final Approval  : [Name / Role]             Date : DD-MMM-YYYY

Overall Result  : [ NOT READY | READY WITH COMMENTS | READY TO PROCEED ]

Comments / Open Items:
  1. [Any open item that must be resolved before the EPIC proceeds]
  2. [Any conditional approval notes]
```

---

*Checklist Version: 1.0 | Aligned to EPIC-Template v2.1 | Last Reviewed: 25-Mar-2026*

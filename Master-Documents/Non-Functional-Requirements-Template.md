# Non-Functional Requirements (NFR) Template

> **Document Flow:** BRD → FRD → Initiative → EPIC → User Story → SubTask
>
> This document is the **consolidated NFR register** for the initiative. While individual
> EPICs capture NFRs relevant to their own scope, this document aggregates all NFRs in
> one place to serve architects, technical leads, DevOps engineers, and QA teams as the
> single source of truth for non-functional design, implementation, and testing decisions.
>
> **What are Non-Functional Requirements?**
> NFRs define the *quality characteristics* of the system — how well it performs, how secure
> it is, how reliably it runs, and how easily it can be maintained and scaled. They answer
> the question: *"How should the system behave?"* as opposed to functional requirements which
> answer *"What should the system do?"*
>
> **Relationship to EPICs:**
> Every NFR is mapped to one or more EPICs via the NFR–EPIC RTM in Section 3.
> The EPIC NFR Reference Section column traces back to the specific sub-section in the
> EPIC document (e.g., Section 9a Performance, Section 9b Security) so teams can navigate
> between this consolidated register and the EPIC-level detail without duplication.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Initiative ID   : INIT-[XXX]
Initiative Name : [Initiative Name]
Created Date    : DD-MMM-YYYY
Last Updated    : DD-MMM-YYYY
Author          : [Name / Role]
Reviewed By     : [Architect / Tech Lead Name]
Version         : 1.0
Status          : [ Draft | Under Review | Approved | Baselined ]
Total NFRs      : [N]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Table of Contents

| # | Section |
| --- | --- |
| 1 | NFR Catalogue |
| — | 1.01 Performance |
| — | 1.02 Security |
| — | 1.03 Scalability |
| — | 1.04 Availability |
| — | 1.05 Reliability & Resilience |
| — | 1.06 Responsiveness (UI) |
| — | 1.07 Accessibility |
| — | 1.08 Maintainability |
| — | 1.09 Observability & Monitoring |
| — | 1.10 Data Privacy & Compliance |
| — | 1.11 Disaster Recovery & Business Continuity |
| — | 1.12 Interoperability |
| — | 1.13 Portability & Deployability |
| 2 | NFR Count Summary |
| 3 | NFR–EPIC RTM |
| 4 | Coverage Gap Analysis |
| — | Usage Notes |
| — | Revision History |

---

## 1. NFR Catalogue

> **Guideline for each NFR entry:**
> - **NFR ID** — Unique identifier. Format: `NFR-[NNN]` (e.g., NFR-001). Sequential, never reused.
> - **NFR Name** — Short, action-oriented title (e.g., "API Response Time SLA").
> - **NFR Description** — Detailed statement of the requirement. Must be testable and unambiguous.
> - **Metric / Threshold** — The measurable target (e.g., P95 < 2s, 99.9% uptime, AES-256).
> - **Condition** — The context under which the metric applies (e.g., peak load, steady state, failure mode).
> - **Approach / Guidelines** — Recommended architectural patterns, design decisions, frameworks,
>   or implementation guidance that the technical team should follow to meet this NFR.
> - **Verification Method** — How this NFR will be tested or verified: Load Test, Penetration Test,
>   Code Review, Automated Monitor, Audit Log Review, etc.
> - **Priority** — `Critical` (must be met at launch) / `High` (must be met, minor grace period)
>   / `Medium` (target for initial release, firm for next release).

---

### 1.01 Performance

> Performance NFRs define how fast the system must respond under normal and peak operating conditions.
> They are the primary input for capacity planning, infrastructure sizing, and API timeout configurations.

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-[NNN] | [NFR Name] | [Detailed description of the performance requirement] | [e.g., P95 < 2s, P99 < 4s] | [e.g., Under peak load of X concurrent users] | [Architectural guidance — e.g., Use async processing, connection pooling, CDN for static assets] | [e.g., Load Test using JMeter / k6] | [ Critical \| High \| Medium ] |

---

### 1.02 Security

> Security NFRs define how the system protects data, authenticates users, and prevents unauthorised access.
> They are the primary input for security architecture, API design, encryption strategy, and pen testing scope.

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-[NNN] | [NFR Name] | [Detailed description of the security requirement] | [e.g., AES-256 at rest, TLS 1.2+ in transit] | [e.g., All environments including non-production] | [e.g., Use KMS for key management, rotate keys every 90 days, no secrets in code] | [e.g., Penetration Test, Code Review, Secret Scanner] | [ Critical \| High \| Medium ] |

---

### 1.03 Scalability

> Scalability NFRs define how the system must grow to handle increasing load — both in terms of
> user volume and data volume. They guide horizontal vs vertical scaling decisions, database sharding
> strategies, and microservices decomposition.

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-[NNN] | [NFR Name] | [Detailed description of the scalability requirement] | [e.g., Support 10,000 concurrent users; scale to 5× baseline in 10 min] | [e.g., During campaign or peak onboarding periods] | [e.g., Stateless services, horizontal pod autoscaler, read replicas for DB] | [e.g., Stress Test, Auto-Scaling Simulation] | [ Critical \| High \| Medium ] |

---

### 1.04 Availability

> Availability NFRs define the uptime and service continuity targets. They drive decisions around
> deployment topology (multi-AZ, active-active, active-passive), maintenance windows, and SLA commitments.

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-[NNN] | [NFR Name] | [Detailed description of the availability requirement] | [e.g., 99.9% uptime = max 8.7 hrs downtime/year] | [e.g., Excluding planned maintenance windows of max 2 hrs/month] | [e.g., Multi-AZ deployment, health checks, rolling deployments with zero downtime] | [e.g., Uptime Monitor, SLA Report, Chaos Engineering Test] | [ Critical \| High \| Medium ] |

---

### 1.05 Reliability & Resilience

> Reliability NFRs define how the system handles failures — partial outages, third-party API
> unavailability, and infrastructure faults — without losing data or corrupting state.
> They drive circuit breaker, retry, dead-letter queue, and fallback design patterns.

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-[NNN] | [NFR Name] | [Detailed description of the reliability or resilience requirement] | [e.g., Zero data loss on third-party timeout; max 3 retry attempts] | [e.g., When downstream dependency is unavailable] | [e.g., Circuit breaker pattern, idempotent retries with exponential backoff, dead-letter queue] | [e.g., Fault Injection Test, Chaos Test, Integration Test] | [ Critical \| High \| Medium ] |

---

### 1.06 Responsiveness (UI)

> UI Responsiveness NFRs define how the customer-facing application must behave across different
> devices and screen sizes. They drive CSS framework selection, component library choice,
> and responsive breakpoint design.

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-[NNN] | [NFR Name] | [Detailed description of the responsiveness requirement] | [e.g., Fully functional at 320px to 2560px viewport width] | [e.g., Chrome, Firefox, Safari — latest 2 major versions] | [e.g., Mobile-first CSS, fluid grid, test on physical devices and BrowserStack] | [e.g., Cross-Browser Test, Device Lab Test, Lighthouse Audit] | [ Critical \| High \| Medium ] |

---

### 1.07 Accessibility

> Accessibility NFRs define the inclusivity standards the application must meet.
> They are the primary input for UI component choices, colour palette, keyboard navigation,
> and screen-reader compatibility decisions.

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-[NNN] | [NFR Name] | [Detailed description of the accessibility requirement] | [e.g., WCAG 2.1 Level AA compliance across all customer-facing screens] | [e.g., All public and authenticated customer screens] | [e.g., Semantic HTML, aria-* attributes, colour contrast ≥ 4.5:1, keyboard-navigable all interactive elements] | [e.g., Axe / WAVE Automated Scan, Manual Screen-Reader Test (NVDA/VoiceOver), Keyboard-only Navigation Test] | [ Critical \| High \| Medium ] |

---

### 1.08 Maintainability

> Maintainability NFRs define how easily the codebase can be understood, modified, tested,
> and extended. They guide coding standards, test coverage targets, documentation requirements,
> and technical debt policies.

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-[NNN] | [NFR Name] | [Detailed description of the maintainability requirement] | [e.g., Unit test coverage ≥ 80%; Cyclomatic complexity ≤ 10 per function] | [e.g., All production code — backend services and frontend components] | [e.g., TDD workflow, code review gates, SonarQube quality gate, SOLID principles] | [e.g., Coverage Report (Jest / JaCoCo), Static Analysis (SonarQube), Code Review] | [ Critical \| High \| Medium ] |

---

### 1.09 Observability & Monitoring

> Observability NFRs define how the system exposes its internal state through logs, metrics,
> and traces so that operations and engineering teams can detect, diagnose, and resolve
> incidents rapidly. They drive logging framework selection, APM tooling, and alerting rules.

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-[NNN] | [NFR Name] | [Detailed description of the observability requirement] | [e.g., MTTD < 5 min for P1 incidents; 100% of API calls produce a structured log entry] | [e.g., All production and pre-production environments] | [e.g., Structured JSON logging, correlation IDs on all requests, distributed tracing (OpenTelemetry), alerts on error rate > threshold] | [e.g., Log Review, Alert Trigger Test, Trace Sampling Verification] | [ Critical \| High \| Medium ] |

---

### 1.10 Data Privacy & Compliance

> Data Privacy NFRs define how the system handles personal and sensitive data in accordance
> with applicable regulations (GDPR, DPDP Act, PCI-DSS, etc.). They drive data classification,
> consent management, audit logging, and data retention policies.

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-[NNN] | [NFR Name] | [Detailed description of the data privacy or compliance requirement] | [e.g., PII never appears in application logs; right-to-erasure fulfilled within 30 days] | [e.g., All environments; all data stores and log pipelines] | [e.g., PII classification matrix, field-level encryption, log masking, data retention policy enforced by automated job] | [e.g., Log Inspection, Compliance Audit, Data Deletion Test] | [ Critical \| High \| Medium ] |

---

### 1.11 Disaster Recovery & Business Continuity

> DR & BCP NFRs define the maximum tolerable downtime and data loss in the event of a
> catastrophic failure. They drive backup frequency, replication topology, failover
> automation, and runbook requirements.

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-[NNN] | [NFR Name] | [Detailed description of the DR or BCP requirement] | [e.g., RTO ≤ 4 hours; RPO ≤ 1 hour] | [e.g., In the event of full primary region failure] | [e.g., Daily automated backups, cross-region replication, automated failover, quarterly DR drill] | [e.g., DR Drill, Backup Restore Test, Failover Simulation] | [ Critical \| High \| Medium ] |

---

### 1.12 Interoperability

> Interoperability NFRs define how the system integrates with external systems, third-party
> APIs, and internal platforms. They guide API contract design, protocol selection, versioning
> strategy, and adapter pattern usage.

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-[NNN] | [NFR Name] | [Detailed description of the interoperability requirement] | [e.g., All external APIs use REST + JSON over HTTPS; versioned with /api/v[N] prefix] | [e.g., All third-party integrations — KYC vendor, SMS gateway, email service] | [e.g., Adapter pattern for all third-party calls, OpenAPI spec for all APIs, contract testing with Pact] | [e.g., Contract Test, Integration Test, API Specification Review] | [ Critical \| High \| Medium ] |

---

### 1.13 Portability & Deployability

> Portability NFRs define how easily the system can be deployed to different environments
> (on-premise, cloud, hybrid) and how consistently deployments are executed. They drive
> containerisation strategy, CI/CD pipeline design, and environment configuration management.

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-[NNN] | [NFR Name] | [Detailed description of the portability or deployability requirement] | [e.g., All services containerised; deployment to any environment in < 30 min via CI/CD] | [e.g., Dev, Staging, and Production environments must be configuration-identical] | [e.g., Docker + Kubernetes, Helm charts for config, environment variables for all config values — no hardcoding] | [e.g., Environment Parity Check, Deployment Pipeline Verification, Container Scan] | [ Critical \| High \| Medium ] |

---

## 2. NFR Count Summary

### 2A. Count by NFR Type

| NFR Type | NFR Count | NFR IDs |
| --- | --- | --- |
| Performance | [N] | NFR-[XXX], … |
| Security | [N] | NFR-[XXX], … |
| Scalability | [N] | NFR-[XXX], … |
| Availability | [N] | NFR-[XXX], … |
| Reliability & Resilience | [N] | NFR-[XXX], … |
| Responsiveness (UI) | [N] | NFR-[XXX], … |
| Accessibility | [N] | NFR-[XXX], … |
| Maintainability | [N] | NFR-[XXX], … |
| Observability & Monitoring | [N] | NFR-[XXX], … |
| Data Privacy & Compliance | [N] | NFR-[XXX], … |
| Disaster Recovery & BCP | [N] | NFR-[XXX], … |
| Interoperability | [N] | NFR-[XXX], … |
| Portability & Deployability | [N] | NFR-[XXX], … |
| **Total** | **[N]** | |

### 2B. Count by Priority

| Priority | NFR Count | NFR IDs |
| --- | --- | --- |
| Critical | [N] | NFR-[XXX], … |
| High | [N] | NFR-[XXX], … |
| Medium | [N] | NFR-[XXX], … |
| **Total** | **[N]** | |

---

## 3. NFR–EPIC RTM

> **Guideline:**
> - One row per NFR–EPIC relationship. If one NFR applies to three EPICs, there are three rows.
> - EPIC NFR Reference Section is the sub-section ID in the EPIC document where this NFR
>   is captured at the EPIC level (e.g., `9a` = Performance, `9b` = Security). This enables
>   direct navigation between this consolidated register and the EPIC document.
> - Sort by NFR ID first, then EPIC ID within each NFR.

| Sr No | NFR ID | NFR Type | NFR Name | EPIC ID | EPIC Description | EPIC NFR Reference Section |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | NFR-[NNN] | [NFR Type] | [NFR Name] | EPIC-[XXX] | [One-line EPIC description] | Section [9a \| 9b \| 9c \| 9d \| 9e] — [Section Name] |

> **EPIC NFR Reference Section mapping (from EPIC-Template v2.1):**
> - `Section 9a` — Performance
> - `Section 9b` — Security
> - `Section 9c` — Reliability
> - `Section 9d` — Availability
> - `Section 9e` — Scalability
>
> Note: NFR types that do not have a dedicated sub-section in the EPIC template
> (e.g., Accessibility, Observability) should be noted as `Section 9 — General NFR Notes`
> and a sub-section added to the EPIC document if required.

---

## 4. Coverage Gap Analysis

> Use this section to flag NFRs that have not yet been addressed in any EPIC,
> or EPICs that have no NFRs assigned to them.

| Sr No | Gap Type | NFR ID | EPIC ID | Description | Action Required | Assigned To | Target Date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | [ NFR without EPIC \| EPIC without NFR \| NFR not in EPIC Document \| Conflicting NFR ] | NFR-[NNN] or N/A | EPIC-[XXX] or N/A | [Brief description of the gap] | [Action to close the gap] | [Name / Role] | DD-MMM-YYYY |

---

## Usage Notes

> 1. **This document consolidates, not duplicates.** NFRs are first discovered during EPIC
>    definition and captured in the EPIC document (Section 9). This register aggregates them
>    all in one place. Changes to an NFR must be updated in both this document and the relevant
>    EPIC document to keep them in sync.
>
> 2. **NFRs must be testable.** Every NFR must have a Metric/Threshold that can be objectively
>    measured and a Verification Method that defines how it will be tested. NFRs written as
>    "the system should be fast" are not acceptable — they must quantify the expectation.
>
> 3. **Architects use this document as the primary design input.** Section 1 (NFR Catalogue)
>    informs the architecture decision record (ADR), infrastructure sizing, and technology
>    selection. Section 3 (NFR–EPIC RTM) helps prioritise which EPICs carry the highest
>    non-functional risk.
>
> 4. **QA and DevOps use this document for test and pipeline planning.** The Verification Method
>    column drives the test strategy: which NFRs need load tests, which need pen tests, which
>    need automated monitors, and which need manual audit reviews.

---

## Revision History

```
| Version | Date         | Author         | Changes Made                              |
|---------|--------------|----------------|-------------------------------------------|
| 1.0     | DD-MMM-YYYY  | [Author Name]  | Initial NFR register                      |
| 1.1     | DD-MMM-YYYY  | [Author Name]  | [Brief description of changes]            |
```

---

*Template Version: 1.0 | Last Reviewed: 25-Mar-2026*

---
---

# EXAMPLE — INIT-001: Unified Digital Onboarding Platform

> This example captures the consolidated NFRs for **INIT-001**,
> drawing primarily from **EPIC-001: Customer Registration & KYC Verification**
> and extending to cover the full initiative scope across EPIC-001 through EPIC-004.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Initiative ID   : INIT-001
Initiative Name : Unified Digital Onboarding Platform
Created Date    : 25-Mar-2026
Last Updated    : 25-Mar-2026
Author          : Business Analyst
Reviewed By     : Solution Architect
Version         : 1.0
Status          : Approved
Total NFRs      : 18
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 1. NFR Catalogue

### 1.01 Performance

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-001 | Registration API Response Time | The customer registration form submission API (POST /api/v1/registrations) must return a response within the defined threshold so the customer does not experience perceived latency during the form submission | P95 ≤ 2 seconds; P99 ≤ 4 seconds | Under a sustained load of 500 concurrent users submitting registration forms simultaneously | Use asynchronous processing for non-critical post-submission tasks (e.g., welcome email dispatch). Keep the synchronous path to: payload validation → business rule checks → DB INSERT → response. Offload KYC initiation to a message queue so it does not block the response. Use DB connection pooling (min 10, max 50 connections) | Load Test (k6 / JMeter) simulating 500 concurrent users; measure P95 and P99 from application logs | Critical |
| NFR-002 | KYC Vendor API Timeout | The KYC vendor API call must not block the system indefinitely. A configurable timeout must be enforced so that a slow or unresponsive vendor does not cascade into a system-wide delay | HTTP timeout ≤ 5,000 ms (configurable via environment variable) | On every call to the third-party KYC vendor's /api/verify endpoint | Set `timeoutMs` in KYC adapter configuration (default 5000ms). Propagate TimeoutError to the retry handler — do not swallow. Emit a WARN log with duration on timeout. Circuit breaker opens after 5 consecutive timeouts within a 60-second window | Integration Test with simulated timeout (mock vendor returning no response after 6s); verify timeout fires at 5s and circuit breaker trips after 5 consecutive failures | Critical |
| NFR-003 | OCR Document Processing Time | The document OCR extraction process must complete within the defined threshold so the customer is not left waiting on the Document Upload confirmation screen (SCR-004) | P95 ≤ 8 seconds end-to-end from upload to extracted data available | For standard document types: Aadhaar, PAN, Passport (< 5 MB, JPEG / PNG / PDF) | Process OCR asynchronously via a dedicated queue. SCR-004 polls for status at 2-second intervals using a job ID. Provide intermediate "Processing…" UI state so the customer knows the system is working. Return extracted data or an error reason on completion | Load Test with 200 concurrent document uploads; measure time from upload API response to extracted-data-available event in the queue | High |

---

### 1.02 Security

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-004 | PII Encryption at Rest | All Personally Identifiable Information (PII) stored in the database — including customer name, date of birth, email address, mobile number, document number, and document images — must be encrypted at rest | AES-256 encryption for all PII fields and document binary storage | All environments: Development, Staging, and Production | Use field-level encryption for PII columns in the `customer_draft` table using the platform KMS. Use server-side encryption (SSE-KMS) for the document storage bucket (S3 or equivalent). Rotate encryption keys every 90 days. Never store plaintext PII outside the encrypted storage layer | Security Audit, KMS Key Policy Review, Database Column Encryption Verification (check ciphertext in DB directly) | Critical |
| NFR-005 | PII Exclusion from Logs | No PII field values (name, date of birth, email, mobile number, document number) must appear in any application log, error log, or audit trail at any log level in any environment | Zero PII fields in any log output across all services and all log levels | All environments; all application services and integration adapters | Implement a PII log-masking utility that sanitises log payloads before emission. Log only non-PII identifiers (customer UUID, error codes, status values). Code review gate: reject any PR that logs a PII field directly. Automated secret/PII scanner in CI pipeline | CI Pipeline PII Scanner (custom rule or gitleaks), Manual Log Review, Penetration Test (log exfiltration attempt) | Critical |
| NFR-006 | API Authentication & Authorisation | All API endpoints — customer-facing and internal back-office — must enforce authentication. Customer endpoints use token-based auth; back-office endpoints use role-based access control (RBAC) | 100% of non-public API endpoints protected; zero unauthenticated access to any data-modifying endpoint | All environments | Customer-facing APIs: OAuth 2.0 / JWT (access token expiry 15 min, refresh token 7 days). Back-office APIs: RBAC with roles: `ops_reviewer`, `ops_admin`. Public registration endpoints (POST /api/v1/registrations): rate-limited (max 10 requests/IP/minute) to prevent abuse even though unauthenticated | Penetration Test (attempt unauthenticated access to protected endpoints), OWASP ZAP Scan, Rate Limit Test | Critical |

---

### 1.03 Scalability

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-007 | Concurrent User Scalability | The registration and KYC system must support the expected peak concurrent user volume and must be able to scale horizontally to handle traffic spikes without manual intervention | Support 5,000 concurrent active users at steady state; auto-scale to 10,000 within 5 minutes during traffic spikes | Peak periods: campaign launches, public holidays, and end-of-month volumes | Stateless backend services deployable as Kubernetes pods with Horizontal Pod Autoscaler (HPA) configured on CPU utilisation (scale-out at 70% CPU). Read replicas for the registration database to offload read traffic. CDN for all static frontend assets | Stress Test (k6): ramp from 1,000 to 10,000 concurrent users over 10 minutes; observe auto-scaling events and verify response times remain within NFR-001 thresholds | Critical |
| NFR-008 | Document Storage Scalability | The document storage layer must be able to grow linearly with the volume of uploaded identity documents without requiring schema changes or manual capacity management | Support up to 10 million documents (approx. 50 TB) in the first 3 years without storage architecture change | Inclusive of all document types and all retained versions | Use cloud object storage (S3-compatible) with lifecycle policies: move documents > 90 days old to cheaper storage tier; permanently delete documents after the regulatory retention period (7 years). Document metadata (keys, status) stored in the relational DB; binary blobs in object storage only | Storage Capacity Projection Review (quarterly), Lifecycle Policy Test (verify automated tier transitions) | High |

---

### 1.04 Availability

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-009 | System Uptime SLA | The customer-facing onboarding platform must maintain a high availability SLA to avoid customer drop-off during the registration journey | 99.9% uptime = maximum 8.76 hours unplanned downtime per year | Measured across all customer-facing endpoints; excludes planned maintenance windows (max 2 hours/month, communicated 48 hours in advance) | Multi-AZ deployment on Kubernetes. Database with synchronous read replica in secondary AZ with automatic failover (RTO < 30 seconds for DB failover). Zero-downtime rolling deployments using readiness probes. Health check endpoints on all services; load balancer drops unhealthy pods within 10 seconds | Uptime Monitoring (Pingdom / Datadog), Monthly SLA Report, Chaos Engineering Test (pod kill, AZ failover simulation) | Critical |

---

### 1.05 Reliability & Resilience

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-010 | KYC Vendor Failure Resilience | A failure, timeout, or error response from the third-party KYC vendor must not result in loss of the customer's registration data or leave the customer record in an unrecoverable state | Zero data loss on KYC vendor failure; automatic retry up to 3 times with exponential backoff (1s, 2s, 4s); unresolved failures routed to dead-letter queue for manual review | When the KYC vendor returns a 5xx error, a timeout, or a connection failure | Implement circuit breaker (open after 5 failures in 60s, half-open probe every 30s). Persist the KYC request to the `kyc_request` table before sending to vendor — status starts as `IN_PROGRESS`. On final retry failure, update status to `VENDOR_UNAVAILABLE` and notify ops team via alert. Back-office team resolves from SCR-007 (KYC Manual Review) | Fault Injection Test (mock vendor returning 503), Dead-Letter Queue Verification, Circuit Breaker Simulation | Critical |
| NFR-011 | Idempotent Registration Submission | The registration API must be idempotent so that network retries or accidental double-submissions by the customer or browser do not create duplicate customer records | Zero duplicate `customer_draft` records for the same email address + mobile number combination with status `DRAFT` or `PENDING_KYC` | When the same registration payload is submitted more than once within a session | Use idempotency keys (client-generated UUID sent in `X-Idempotency-Key` header). Server caches the response for each idempotency key for 24 hours. If duplicate key received, return the cached response without re-processing. Server-side uniqueness check on email + mobile (as designed in US-003) acts as a secondary guard | Integration Test: submit identical payload twice with same idempotency key; verify one record created and second call returns cached response; verify only one row in `customer_draft` | Critical |

---

### 1.06 Responsiveness (UI)

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-012 | Cross-Device Responsive Layout | All customer-facing screens (SCR-001 through SCR-006, SCR-008 through SCR-010) must be fully functional and visually correct on mobile, tablet, and desktop viewports | Fully functional and layout-correct at viewport widths: 320px (small mobile), 768px (tablet), 1280px (desktop), 1920px (large desktop) | Latest 2 major versions of Chrome, Firefox, Safari, and Edge; iOS 15+ and Android 10+ | Mobile-first CSS using a 12-column fluid grid. Breakpoints: 320px / 768px / 1280px. Use Material UI responsive components. All touch targets ≥ 44×44px. Test on physical devices (iPhone 14, Samsung Galaxy S22) and BrowserStack for broader coverage | Cross-Browser Test (BrowserStack), Device Lab Test (physical devices), Lighthouse Mobile Audit (Performance + Layout score ≥ 85) | High |

---

### 1.07 Accessibility

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-013 | WCAG 2.1 AA Compliance | All customer-facing screens must comply with WCAG 2.1 Level AA accessibility guidelines to ensure the platform is usable by customers with visual, motor, auditory, or cognitive disabilities | Zero critical or serious violations in automated accessibility scan; zero blocking issues in manual keyboard-only and screen-reader navigation test | All public and authenticated customer-facing screens: SCR-001 to SCR-006, SCR-008 to SCR-010 | Semantic HTML5 elements. All form fields have associated `<label>` elements. `aria-describedby` links error messages to their input fields. Colour contrast ≥ 4.5:1 for normal text. Full keyboard navigation with visible focus indicators. Date picker navigable via keyboard. Test with NVDA (Windows) and VoiceOver (macOS / iOS) | Automated Scan (Axe / WAVE — run in CI), Manual Keyboard-Only Navigation Test, Manual Screen-Reader Test (NVDA + Chrome, VoiceOver + Safari) | High |

---

### 1.08 Maintainability

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-014 | Automated Test Coverage | All production code must maintain a minimum automated test coverage level to prevent regressions and ensure that changes can be made safely and confidently | Unit test coverage ≥ 80% for all backend services and frontend utility modules; integration test coverage for all API endpoints; E2E test coverage for all critical user journeys (registration flow, KYC status check) | All production code in backend services, frontend components, and integration adapters — excluding auto-generated code and migration files | TDD workflow enforced via PR gates. Coverage measured by Jest (frontend) and JaCoCo or Istanbul (backend). SonarQube quality gate configured to fail builds below 80% coverage. Cyclomatic complexity ≤ 10 per function (SonarQube rule) | Coverage Report in CI Pipeline (Jest / JaCoCo), SonarQube Quality Gate, PR Review | High |

---

### 1.09 Observability & Monitoring

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-015 | Structured Logging | Every API call, business event, and error condition must produce a structured log entry in JSON format so that logs are machine-parseable and searchable in the centralised log aggregation platform | 100% of API requests and KYC events produce a structured JSON log entry; no unstructured free-text log lines in production code | All backend services and integration adapters; all environments | JSON log format with mandatory fields: `timestamp`, `level`, `service`, `correlationId`, `action`, `result`. Use a correlation ID (UUID passed via `X-Correlation-ID` header) that propagates across all services for a single request. Logs ingested to centralised platform (Datadog / ELK). No PII in logs (see NFR-005) | Log Format Audit (verify JSON structure in staging), Correlation ID Trace Test (verify single request traceable end-to-end), CI PII Scanner | Critical |
| NFR-016 | Alerting on Critical Failures | The operations team must be automatically alerted when the system crosses defined error thresholds so that P1 incidents are detected and escalated within the MTTD target | Alert fired within 2 minutes of threshold breach; MTTD (Mean Time to Detect) for P1 incidents ≤ 5 minutes | Production environment; thresholds: API error rate > 5% over 5 min, KYC failure rate > 20% over 10 min, DB connection pool exhaustion | Configure Datadog / CloudWatch monitors on: (1) API 5xx error rate, (2) KYC vendor timeout rate, (3) registration queue depth, (4) DB connection pool utilisation. PagerDuty integration for P1 alerts (immediate page to on-call engineer). Runbooks documented for each alert type | Alert Trigger Test (simulate error rate breach in staging), On-Call Notification Test, Runbook Review | Critical |

---

### 1.10 Data Privacy & Compliance

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-017 | Audit Trail for KYC Decisions | A complete, tamper-evident audit trail must be maintained for every KYC verification decision — automated or manual — to satisfy regulatory requirements and support dispute resolution | 100% of KYC events (request sent, response received, manual approve/reject) recorded in the `kyc_request` audit table with timestamp, actor ID, and full request/response payload | All environments; audit records must be retained for a minimum of 7 years | Persist full request and response payloads in the `kyc_request` table (encrypted — see NFR-004). Audit records are append-only: no UPDATE or DELETE permitted on the audit table; use DB-level GRANT restrictions to enforce. Manual review decisions recorded with the operations staff member's user ID and timestamp (SCR-007) | Audit Log Review, DB Permission Test (verify DELETE/UPDATE denied), Regulatory Compliance Review | Critical |

---

### 1.11 Disaster Recovery & Business Continuity

| NFR ID | NFR Name | NFR Description | Metric / Threshold | Condition | Approach / Guidelines | Verification Method | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NFR-018 | Recovery Time & Point Objectives | In the event of a catastrophic failure of the primary data centre or cloud region, the system must be recoverable within defined time and data-loss bounds to meet business continuity obligations | RTO (Recovery Time Objective) ≤ 4 hours; RPO (Recovery Point Objective) ≤ 1 hour | Full primary region failure or total data loss scenario | Automated daily full database backups plus continuous WAL archiving (PostgreSQL) or transaction log shipping to a secondary region. Document storage cross-region replication (S3 CRR). Quarterly DR drill: promote secondary, verify data integrity, verify RTO met within 4 hours. Recovery runbook maintained and reviewed before each drill | DR Drill (quarterly), Backup Restore Test (verify data integrity post-restore), RTO/RPO Measurement during drill | High |

---

## 2. NFR Count Summary

### 2A. Count by NFR Type

| NFR Type | NFR Count | NFR IDs |
| --- | --- | --- |
| Performance | 3 | NFR-001, NFR-002, NFR-003 |
| Security | 3 | NFR-004, NFR-005, NFR-006 |
| Scalability | 2 | NFR-007, NFR-008 |
| Availability | 1 | NFR-009 |
| Reliability & Resilience | 2 | NFR-010, NFR-011 |
| Responsiveness (UI) | 1 | NFR-012 |
| Accessibility | 1 | NFR-013 |
| Maintainability | 1 | NFR-014 |
| Observability & Monitoring | 2 | NFR-015, NFR-016 |
| Data Privacy & Compliance | 1 | NFR-017 |
| Disaster Recovery & BCP | 1 | NFR-018 |
| Interoperability | 0 | — |
| Portability & Deployability | 0 | — |
| **Total** | **18** | |

### 2B. Count by Priority

| Priority | NFR Count | NFR IDs |
| --- | --- | --- |
| Critical | 11 | NFR-001, NFR-002, NFR-004, NFR-005, NFR-006, NFR-009, NFR-010, NFR-011, NFR-015, NFR-016, NFR-017 |
| High | 7 | NFR-003, NFR-007, NFR-008, NFR-012, NFR-013, NFR-014, NFR-018 |
| Medium | 0 | — |
| **Total** | **18** | |

---

## 3. NFR–EPIC RTM

| Sr No | NFR ID | NFR Type | NFR Name | EPIC ID | EPIC Description | EPIC NFR Reference Section |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | NFR-001 | Performance | Registration API Response Time | EPIC-001 | Customer Registration & KYC Verification | Section 9a — Performance |
| 2 | NFR-002 | Performance | KYC Vendor API Timeout | EPIC-001 | Customer Registration & KYC Verification | Section 9a — Performance |
| 3 | NFR-002 | Performance | KYC Vendor API Timeout | EPIC-002 | Document Management & OCR | Section 9a — Performance |
| 4 | NFR-003 | Performance | OCR Document Processing Time | EPIC-002 | Document Management & OCR | Section 9a — Performance |
| 5 | NFR-004 | Security | PII Encryption at Rest | EPIC-001 | Customer Registration & KYC Verification | Section 9b — Security |
| 6 | NFR-004 | Security | PII Encryption at Rest | EPIC-002 | Document Management & OCR | Section 9b — Security |
| 7 | NFR-005 | Security | PII Exclusion from Logs | EPIC-001 | Customer Registration & KYC Verification | Section 9b — Security |
| 8 | NFR-005 | Security | PII Exclusion from Logs | EPIC-002 | Document Management & OCR | Section 9b — Security |
| 9 | NFR-006 | Security | API Authentication & Authorisation | EPIC-001 | Customer Registration & KYC Verification | Section 9b — Security |
| 10 | NFR-006 | Security | API Authentication & Authorisation | EPIC-003 | Account Activation & Profile Setup | Section 9b — Security |
| 11 | NFR-007 | Scalability | Concurrent User Scalability | EPIC-001 | Customer Registration & KYC Verification | Section 9e — Scalability |
| 12 | NFR-007 | Scalability | Concurrent User Scalability | EPIC-003 | Account Activation & Profile Setup | Section 9e — Scalability |
| 13 | NFR-008 | Scalability | Document Storage Scalability | EPIC-002 | Document Management & OCR | Section 9e — Scalability |
| 14 | NFR-009 | Availability | System Uptime SLA | EPIC-001 | Customer Registration & KYC Verification | Section 9d — Availability |
| 15 | NFR-009 | Availability | System Uptime SLA | EPIC-003 | Account Activation & Profile Setup | Section 9d — Availability |
| 16 | NFR-010 | Reliability & Resilience | KYC Vendor Failure Resilience | EPIC-001 | Customer Registration & KYC Verification | Section 9c — Reliability |
| 17 | NFR-011 | Reliability & Resilience | Idempotent Registration Submission | EPIC-001 | Customer Registration & KYC Verification | Section 9c — Reliability |
| 18 | NFR-012 | Responsiveness (UI) | Cross-Device Responsive Layout | EPIC-001 | Customer Registration & KYC Verification | Section 9 — General NFR Notes |
| 19 | NFR-013 | Accessibility | WCAG 2.1 AA Compliance | EPIC-001 | Customer Registration & KYC Verification | Section 9 — General NFR Notes |
| 20 | NFR-013 | Accessibility | WCAG 2.1 AA Compliance | EPIC-003 | Account Activation & Profile Setup | Section 9 — General NFR Notes |
| 21 | NFR-014 | Maintainability | Automated Test Coverage | EPIC-001 | Customer Registration & KYC Verification | Section 9 — General NFR Notes |
| 22 | NFR-014 | Maintainability | Automated Test Coverage | EPIC-002 | Document Management & OCR | Section 9 — General NFR Notes |
| 23 | NFR-015 | Observability & Monitoring | Structured Logging | EPIC-001 | Customer Registration & KYC Verification | Section 9 — General NFR Notes |
| 24 | NFR-015 | Observability & Monitoring | Structured Logging | EPIC-002 | Document Management & OCR | Section 9 — General NFR Notes |
| 25 | NFR-016 | Observability & Monitoring | Alerting on Critical Failures | EPIC-001 | Customer Registration & KYC Verification | Section 9 — General NFR Notes |
| 26 | NFR-017 | Data Privacy & Compliance | Audit Trail for KYC Decisions | EPIC-001 | Customer Registration & KYC Verification | Section 9b — Security |
| 27 | NFR-018 | Disaster Recovery & BCP | Recovery Time & Point Objectives | EPIC-001 | Customer Registration & KYC Verification | Section 9d — Availability |
| 28 | NFR-018 | Disaster Recovery & BCP | Recovery Time & Point Objectives | EPIC-002 | Document Management & OCR | Section 9d — Availability |

> **EPIC-004 (Notification & Communication)** does not yet have NFRs explicitly mapped.
> See Gap Analysis below.

---

## 4. Coverage Gap Analysis

| Sr No | Gap Type | NFR ID | EPIC ID | Description | Action Required | Assigned To | Target Date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | EPIC without NFR | N/A | EPIC-004 | EPIC-004 (Notification & Communication) has no NFRs mapped to it. Notification delivery SLAs, retry behaviour, and PII handling in email/SMS templates have not been defined | Define NFRs for notification delivery rate, retry policy, PII in templates, and message delivery latency. Add to this register and map in RTM | Solution Architect | 05-Apr-2026 |
| 2 | NFR not in EPIC Document | NFR-012, NFR-013, NFR-014, NFR-015, NFR-016 | EPIC-001 | NFRs for Responsiveness, Accessibility, Maintainability, and Observability are captured in this consolidated register but have not yet been added as sub-sections in EPIC-001 Section 9 | Add sub-sections 9f (Responsiveness), 9g (Accessibility), 9h (Maintainability), 9i (Observability) to EPIC-001 document and cross-reference NFR IDs | Business Analyst | 01-Apr-2026 |

---

## Revision History

```
| Version | Date         | Author              | Changes Made                                          |
|---------|--------------|---------------------|-------------------------------------------------------|
| 1.0     | 25-Mar-2026  | Business Analyst    | Initial NFR register — 18 NFRs across 4 EPIC scope   |
```

---

*Template Version: 1.0 | Last Reviewed: 25-Mar-2026*

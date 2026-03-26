# Non-Functional Requirements (NFR) Completeness Checklist

> **Purpose:** Use this checklist when creating or reviewing the consolidated NFR register
> to ensure all categories are covered, every NFR entry is complete and testable, and full
> traceability to EPICs is established before the document is baselined.
>
> **When to use:**
> - **Author (BA / Architect)** — self-review before submitting the NFR register for approval
> - **Solution Architect / Tech Lead** — review before HLD and infrastructure sizing begin
> - **QA Lead** — review before test strategy and performance test planning begin
> - **DevOps Engineer** — review before CI/CD pipeline and monitoring setup begin
> - **Product Owner** — review before sprint planning that involves NFR-linked stories
> - **Security Team** — review before penetration test scope is defined
>
> **Scoring:** Each item is marked as one of:
> - `[ ]` — Not done
> - `[x]` — Complete
> - `[N/A]` — Not applicable (add a brief reason in the Notes column)
>
> The NFR register is considered **BASELINED** only when all applicable items
> are marked `[x]` and the Final Readiness Gate is passed.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Initiative ID   : INIT-[XXX]
Initiative Name : [Initiative Name]
Reviewed By     : [Name / Role]
Review Date     : DD-MMM-YYYY
Review Stage    : [ Author Self-Review | Architect Review | QA Review | Final Approval ]
Overall Status  : [ NOT READY | READY WITH COMMENTS | BASELINED ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## SECTION 0 — Header & Metadata

> Verify the document's identity and administrative fields before reviewing any content.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 0.1 | Initiative ID is filled in and matches the approved Initiative document | `[ ]` | |
| 0.2 | Initiative Name matches exactly the name in the Initiative document | `[ ]` | |
| 0.3 | Created Date is filled in (DD-MMM-YYYY format) | `[ ]` | |
| 0.4 | Last Updated date reflects the most recent edit | `[ ]` | |
| 0.5 | Author name and role are filled in | `[ ]` | |
| 0.6 | Reviewed By is filled in (Architect or Tech Lead must be named) | `[ ]` | |
| 0.7 | Version is set (1.0 for initial baseline) | `[ ]` | |
| 0.8 | Status is set to the correct current state | `[ ]` | |
| 0.9 | Total NFRs count in the header matches the actual count across all categories in Section 1 | `[ ]` | |

---

## NFR ENTRY QUALITY STANDARD

> **Apply these quality rules to EVERY NFR entry across all 13 categories (Sections 1.01–1.13).**
> These are the baseline standards. Category-specific checks follow in each section below.

| # | Quality Rule | Status | Notes / Comments |
|---|--------------|--------|------------------|
| Q.1 | Every NFR ID follows the format NFR-[NNN] and is sequential with no gaps or duplicates | `[ ]` | |
| Q.2 | Every NFR Name is short and action-oriented (e.g., "API Response Time SLA") — not a question or vague phrase | `[ ]` | |
| Q.3 | Every NFR Description is a complete, unambiguous statement of the requirement — a tester can write a test case from it | `[ ]` | |
| Q.4 | Every Metric / Threshold is a specific, measurable value — no vague language such as "fast", "efficient", "reasonable", or "good" | `[ ]` | |
| Q.5 | Every Metric / Threshold uses a recognised unit of measure (seconds, percentage, bytes, requests/second, etc.) | `[ ]` | |
| Q.6 | Every Condition specifies the exact context under which the metric applies (e.g., peak load, steady state, failure mode) | `[ ]` | |
| Q.7 | Every Approach / Guidelines entry provides actionable technical guidance — not left as placeholder text | `[ ]` | |
| Q.8 | Every Verification Method is specific — names the test type and tool (e.g., "Load Test using k6", not just "Testing") | `[ ]` | |
| Q.9 | Every Priority is set to exactly one of: Critical / High / Medium — no blanks or non-standard values | `[ ]` | |
| Q.10 | No NFR entry has any column left as placeholder text (e.g., "[NFR Name]", "[Description]") | `[ ]` | |

---

## SECTION 1.01 — Performance

> **Purpose of this category:** Defines how fast the system must respond under normal and
> peak conditions. Inputs: capacity planning, infrastructure sizing, API timeout configuration.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.01.1 | At least one API / backend response time SLA is defined | `[ ]` | |
| 1.01.2 | At least one page load / frontend response time SLA is defined | `[ ]` | |
| 1.01.3 | Performance thresholds are defined for BOTH normal load AND peak load conditions separately | `[ ]` | |
| 1.01.4 | Percentile notation is used (P95 / P99) — not just average response times | `[ ]` | |
| 1.01.5 | Concurrent user volume is stated as the load condition for each performance NFR | `[ ]` | |
| 1.01.6 | Performance thresholds for third-party API calls (KYC, payment, SMS) are defined separately from internal APIs | `[ ]` | |
| 1.01.7 | Approach includes specific architectural patterns (caching, async processing, CDN, connection pooling) | `[ ]` | |
| 1.01.8 | Verification Method names the load testing tool (k6, JMeter, Gatling, Locust) | `[ ]` | |
| 1.01.9 | All Critical performance NFRs are confirmed as launch blockers with the Product Owner | `[ ]` | |

---

## SECTION 1.02 — Security

> **Purpose of this category:** Defines how the system protects data, authenticates users,
> and prevents unauthorised access. Inputs: security architecture, encryption strategy, pen testing scope.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.02.1 | Data-in-transit encryption standard is defined (TLS version must be specified) | `[ ]` | |
| 1.02.2 | Data-at-rest encryption standard is defined (algorithm and key length must be specified) | `[ ]` | |
| 1.02.3 | Authentication mechanism is defined (MFA, OTP, SSO, biometric — whichever applies) | `[ ]` | |
| 1.02.4 | Session management requirements are defined (token expiry, inactivity timeout, revocation) | `[ ]` | |
| 1.02.5 | Authorisation / RBAC requirements are defined | `[ ]` | |
| 1.02.6 | Secret and API key management policy is defined (secrets manager, no hardcoding in source code) | `[ ]` | |
| 1.02.7 | Input validation and injection prevention (SQL, XSS, CSRF) requirements are defined | `[ ]` | |
| 1.02.8 | OWASP Top 10 coverage is explicitly required | `[ ]` | |
| 1.02.9 | Penetration testing is listed as a mandatory Verification Method before go-live | `[ ]` | |
| 1.02.10 | Approach includes key rotation policy, cipher suite selection, and certificate management | `[ ]` | |
| 1.02.11 | PII-handling security requirements are defined (masking in logs, field-level encryption where required) | `[ ]` | |
| 1.02.12 | All security NFRs reference a standard or regulation (OWASP, DPDP, GDPR, PCI-DSS) where applicable | `[ ]` | |

---

## SECTION 1.03 — Scalability

> **Purpose of this category:** Defines how the system grows to handle increasing load.
> Inputs: horizontal vs vertical scaling decisions, database sharding, microservices decomposition.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.03.1 | Maximum concurrent user volume target is defined for Phase 1 launch | `[ ]` | |
| 1.03.2 | Maximum concurrent user volume target is defined for Phase 2 / future growth | `[ ]` | |
| 1.03.3 | A growth multiplier is stated (e.g., "must support 10x Phase 1 load without architectural change") | `[ ]` | |
| 1.03.4 | Auto-scaling policy is defined — scale-out trigger threshold and scale-in threshold are specified | `[ ]` | |
| 1.03.5 | Database scalability requirement is defined (read replicas, sharding, partition strategy) | `[ ]` | |
| 1.03.6 | File / object storage scalability requirement is defined | `[ ]` | |
| 1.03.7 | Message queue / event stream burst-handling requirement is defined (if event-driven integrations are in scope) | `[ ]` | |
| 1.03.8 | Approach specifies stateless service design (prerequisite for horizontal scaling) | `[ ]` | |
| 1.03.9 | Verification Method includes stress testing and auto-scaling simulation — not just load testing | `[ ]` | |

---

## SECTION 1.04 — Availability

> **Purpose of this category:** Defines the uptime and service continuity targets.
> Inputs: deployment topology (multi-AZ), maintenance windows, SLA commitments.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.04.1 | Uptime SLA is defined as a percentage (e.g., 99.9%) | `[ ]` | |
| 1.04.2 | Uptime SLA is translated into maximum allowable downtime per month/year (e.g., 99.9% = 8.7 hrs/year) | `[ ]` | |
| 1.04.3 | Separate uptime targets are defined for customer-facing vs internal/admin components (if different) | `[ ]` | |
| 1.04.4 | Planned maintenance window policy is defined (max duration, permitted time window) | `[ ]` | |
| 1.04.5 | Zero-downtime deployment requirement is stated (or rolling / blue-green strategy specified) | `[ ]` | |
| 1.04.6 | Automated health check and restart policy is defined | `[ ]` | |
| 1.04.7 | Recovery Time Objective (RTO) is defined | `[ ]` | |
| 1.04.8 | Recovery Point Objective (RPO) is defined | `[ ]` | |
| 1.04.9 | Mean Time to Recovery (MTTR) target for P1 incidents is defined | `[ ]` | |
| 1.04.10 | Approach specifies deployment topology (multi-AZ, active-active, active-passive) | `[ ]` | |
| 1.04.11 | Verification Method includes uptime monitoring and chaos engineering / fault injection test | `[ ]` | |

---

## SECTION 1.05 — Reliability & Resilience

> **Purpose of this category:** Defines how the system handles failures without losing data
> or corrupting state. Inputs: circuit breaker, retry, dead-letter queue, fallback patterns.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.05.1 | Error rate threshold is defined (e.g., "< 0.1% error rate under normal load") | `[ ]` | |
| 1.05.2 | Retry policy is defined for all third-party API calls (max attempts, backoff strategy) | `[ ]` | |
| 1.05.3 | Circuit breaker requirement is defined for all external integrations | `[ ]` | |
| 1.05.4 | Dead-letter queue / fallback handling is defined for unprocessable messages or failed events | `[ ]` | |
| 1.05.5 | Idempotency requirement is defined for all retry-prone operations (payment, provisioning, notification) | `[ ]` | |
| 1.05.6 | Data loss prevention requirement is defined for failure scenarios (e.g., "zero data loss on third-party timeout") | `[ ]` | |
| 1.05.7 | Graceful degradation behaviour is defined — what the system does when a dependency is unavailable | `[ ]` | |
| 1.05.8 | Alerting requirement for critical failures is defined (what triggers an alert and within what time) | `[ ]` | |
| 1.05.9 | Approach specifies the exact resilience patterns to be implemented (circuit breaker, saga, outbox, etc.) | `[ ]` | |
| 1.05.10 | Verification Method includes fault injection testing (chaos engineering) — not just unit testing | `[ ]` | |

---

## SECTION 1.06 — Responsiveness (UI)

> **Purpose of this category:** Defines how the customer-facing application behaves across
> devices and screen sizes. Inputs: CSS framework, component library, responsive breakpoints.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.06.1 | Minimum supported viewport width is defined (e.g., 320px) | `[ ]` | |
| 1.06.2 | Maximum supported viewport width is defined (e.g., 2560px) | `[ ]` | |
| 1.06.3 | Target device types are specified (mobile, tablet, desktop — which are required vs optional) | `[ ]` | |
| 1.06.4 | Supported browsers and minimum versions are specified (Chrome, Firefox, Safari, Edge) | `[ ]` | |
| 1.06.5 | Mobile network condition (4G / 3G) is specified for page load SLA conditions | `[ ]` | |
| 1.06.6 | Touch interaction requirements are defined for mobile / tablet (if applicable) | `[ ]` | |
| 1.06.7 | Approach specifies mobile-first design principle and fluid grid / flexbox / CSS grid usage | `[ ]` | |
| 1.06.8 | Verification Method includes cross-browser testing (BrowserStack or equivalent) and Lighthouse audit | `[ ]` | |
| 1.06.9 | If the product is web-only (no native mobile app), this is stated explicitly in the Condition column | `[ ]` | |

---

## SECTION 1.07 — Accessibility

> **Purpose of this category:** Defines the inclusivity standards the application must meet.
> Inputs: UI component choices, colour palette, keyboard navigation, screen-reader compatibility.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.07.1 | Accessibility standard and level are explicitly stated (e.g., WCAG 2.1 Level AA) | `[ ]` | |
| 1.07.2 | Scope of accessibility compliance is defined (which screens — all customer-facing, all, or specific) | `[ ]` | |
| 1.07.3 | Colour contrast ratio requirement is stated (e.g., ≥ 4.5:1 for body text, ≥ 3:1 for large text) | `[ ]` | |
| 1.07.4 | Keyboard-only navigation requirement is stated | `[ ]` | |
| 1.07.5 | Screen-reader compatibility requirement is stated (NVDA, VoiceOver, or equivalent) | `[ ]` | |
| 1.07.6 | ARIA label requirement for interactive elements is stated | `[ ]` | |
| 1.07.7 | Non-colour-dependent error indication requirement is stated (icons + text, not colour alone) | `[ ]` | |
| 1.07.8 | Approach references semantic HTML and ARIA patterns | `[ ]` | |
| 1.07.9 | Verification Method includes automated scan (Axe / WAVE) AND manual screen-reader test — not automated only | `[ ]` | |

---

## SECTION 1.08 — Maintainability

> **Purpose of this category:** Defines how easily the codebase can be understood, modified,
> tested, and extended. Inputs: coding standards, test coverage targets, tech debt policy.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.08.1 | Minimum unit test coverage threshold is defined as a percentage (e.g., ≥ 80%) | `[ ]` | |
| 1.08.2 | Scope of coverage threshold is stated (e.g., all backend services; all frontend components) | `[ ]` | |
| 1.08.3 | Code complexity limit is defined (e.g., Cyclomatic complexity ≤ 10 per function) | `[ ]` | |
| 1.08.4 | Externalised configuration requirement is stated (no hardcoded thresholds, URLs, or feature flags in code) | `[ ]` | |
| 1.08.5 | API documentation requirement is stated (OpenAPI / Swagger auto-generated and kept current) | `[ ]` | |
| 1.08.6 | Code review gate is defined as a mandatory step before merge | `[ ]` | |
| 1.08.7 | Static analysis tool is specified (SonarQube or equivalent) with quality gate policy | `[ ]` | |
| 1.08.8 | Technical debt management policy is stated (e.g., no P1 tech debt unresolved beyond 2 sprints) | `[ ]` | |
| 1.08.9 | Approach references specific practices (TDD, SOLID, DRY, clean architecture) | `[ ]` | |
| 1.08.10 | Verification Method specifies the coverage tool (Jest, JaCoCo, Istanbul, etc.) and the CI gate | `[ ]` | |

---

## SECTION 1.09 — Observability & Monitoring

> **Purpose of this category:** Defines how the system exposes its internal state through
> logs, metrics, and traces. Inputs: logging framework, APM tooling, alerting rules, dashboards.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.09.1 | Structured logging requirement is defined (e.g., JSON format with correlation ID on every request) | `[ ]` | |
| 1.09.2 | Log retention period is defined for operational logs | `[ ]` | |
| 1.09.3 | Log aggregation tool is specified (CloudWatch, ELK, Grafana Loki, Splunk, etc.) | `[ ]` | |
| 1.09.4 | Distributed tracing requirement is defined (OpenTelemetry, AWS X-Ray, Jaeger, etc.) | `[ ]` | |
| 1.09.5 | Key metrics to monitor are listed (API latency, error rate, queue depth, throughput) | `[ ]` | |
| 1.09.6 | Alerting thresholds and escalation rules are defined (e.g., error rate > 1% triggers P2 alert) | `[ ]` | |
| 1.09.7 | Mean Time to Detect (MTTD) target for P1 incidents is defined | `[ ]` | |
| 1.09.8 | Dashboard requirements are listed (at minimum: system health, API latency, error rate, business KPIs) | `[ ]` | |
| 1.09.9 | On-call alerting tool is specified (PagerDuty, OpsGenie, etc.) | `[ ]` | |
| 1.09.10 | Approach specifies correlation ID propagation across all service boundaries | `[ ]` | |
| 1.09.11 | Verification Method includes alert trigger test (fire a test incident and verify alert fires within target time) | `[ ]` | |

---

## SECTION 1.10 — Data Privacy & Compliance

> **Purpose of this category:** Defines how the system handles personal and sensitive data
> in accordance with applicable regulations. Inputs: data classification, consent management,
> audit logging, data retention policies.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.10.1 | All applicable regulations are listed (DPDP Act, GDPR, PCI-DSS, RBI, HIPAA — whichever apply) | `[ ]` | |
| 1.10.2 | PII definition and data classification are referenced (what counts as PII in this system) | `[ ]` | |
| 1.10.3 | PII masking / redaction requirement in logs is explicitly stated | `[ ]` | |
| 1.10.4 | Data retention periods are defined per data type (application records, documents, audit logs) | `[ ]` | |
| 1.10.5 | Customer consent capture requirement is defined (explicit, granular, timestamped) | `[ ]` | |
| 1.10.6 | Right-to-erasure (data deletion) fulfilment timeline is defined (e.g., within 30 days of request) | `[ ]` | |
| 1.10.7 | Data residency requirement is stated (which country / region data must be stored in) | `[ ]` | |
| 1.10.8 | Data breach notification timeline is defined (e.g., notify regulator within 72 hours of detection) | `[ ]` | |
| 1.10.9 | Approach specifies privacy-by-design practices (data minimisation, purpose limitation) | `[ ]` | |
| 1.10.10 | Verification Method includes compliance audit, data deletion test, and log inspection for PII leakage | `[ ]` | |
| 1.10.11 | PCI-DSS applicability is explicitly addressed — either in scope with controls defined, or explicitly out of scope with reason | `[ ]` | |

---

## SECTION 1.11 — Disaster Recovery & Business Continuity

> **Purpose of this category:** Defines maximum tolerable downtime and data loss in
> catastrophic failure. Inputs: backup frequency, replication topology, failover automation, runbooks.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.11.1 | Recovery Time Objective (RTO) is defined with a specific time value | `[ ]` | |
| 1.11.2 | Recovery Point Objective (RPO) is defined with a specific time value | `[ ]` | |
| 1.11.3 | The failure scenario for which RTO/RPO applies is stated (e.g., "full primary region failure") | `[ ]` | |
| 1.11.4 | Backup frequency is defined (e.g., daily automated database snapshots) | `[ ]` | |
| 1.11.5 | Backup retention period is defined | `[ ]` | |
| 1.11.6 | Cross-region or cross-AZ replication requirement is stated | `[ ]` | |
| 1.11.7 | Automated vs manual failover strategy is defined | `[ ]` | |
| 1.11.8 | DR drill frequency is defined (e.g., quarterly) | `[ ]` | |
| 1.11.9 | Operations Runbook requirement for DR scenarios is stated | `[ ]` | |
| 1.11.10 | Approach specifies the exact DR topology (active-passive, warm standby, pilot light, etc.) | `[ ]` | |
| 1.11.11 | Verification Method includes DR drill and backup restore test — not just documentation review | `[ ]` | |

---

## SECTION 1.12 — Interoperability

> **Purpose of this category:** Defines how the system integrates with external systems
> and internal platforms. Inputs: API contract design, protocol selection, versioning, adapter patterns.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.12.1 | API protocol standard is defined for all external integrations (REST / GraphQL / gRPC / SOAP) | `[ ]` | |
| 1.12.2 | Data format standard is defined (JSON / XML — and which standard applies where) | `[ ]` | |
| 1.12.3 | API versioning strategy is defined (e.g., /api/v1 prefix; backwards compatibility policy) | `[ ]` | |
| 1.12.4 | Authentication mechanism for all external API calls is defined (API key, OAuth 2.0, mTLS) | `[ ]` | |
| 1.12.5 | Error response format standard is defined for all APIs (consistent envelope structure) | `[ ]` | |
| 1.12.6 | Adapter / anti-corruption layer requirement is stated for all third-party vendor integrations | `[ ]` | |
| 1.12.7 | Contract testing requirement is defined (Pact or equivalent) for consumer-driven API contracts | `[ ]` | |
| 1.12.8 | Approach specifies OpenAPI specification as the source of truth for all APIs | `[ ]` | |
| 1.12.9 | Verification Method includes contract testing and integration testing against vendor sandbox | `[ ]` | |

---

## SECTION 1.13 — Portability & Deployability

> **Purpose of this category:** Defines how easily the system is deployed to different
> environments consistently. Inputs: containerisation, CI/CD pipeline, environment config management.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.13.1 | Containerisation requirement is stated (Docker or equivalent) | `[ ]` | |
| 1.13.2 | Container orchestration platform is specified (Kubernetes, AWS ECS, etc.) | `[ ]` | |
| 1.13.3 | Infrastructure-as-Code (IaC) requirement is stated (Terraform, CloudFormation, Pulumi) | `[ ]` | |
| 1.13.4 | Environment parity requirement is stated (DEV, QA, STG, PROD must be configuration-identical) | `[ ]` | |
| 1.13.5 | All environment-specific configuration must be externalised (env vars, config service — no hardcoding) | `[ ]` | |
| 1.13.6 | Maximum deployment duration is defined (e.g., "full deployment to any environment in < 30 minutes via CI/CD") | `[ ]` | |
| 1.13.7 | Rollback capability requirement is defined (e.g., "rollback to previous version within 10 minutes") | `[ ]` | |
| 1.13.8 | Container image vulnerability scanning is required in the CI pipeline | `[ ]` | |
| 1.13.9 | On-premise vs cloud deployment decision is explicitly stated | `[ ]` | |
| 1.13.10 | Approach specifies Helm charts (or equivalent) for Kubernetes configuration management | `[ ]` | |
| 1.13.11 | Verification Method includes environment parity check and deployment pipeline smoke test | `[ ]` | |

---

## SECTION 2 — NFR Count Summary

### 2A. Count by NFR Type

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 2a.1 | Summary table is filled in — not left as placeholder | `[ ]` | |
| 2a.2 | All 13 NFR categories have a count entry (enter 0 with reason if a category is intentionally empty) | `[ ]` | |
| 2a.3 | The Total count matches the sum of all individual category counts | `[ ]` | |
| 2a.4 | The Total count matches the Total NFRs value in the document header | `[ ]` | |
| 2a.5 | NFR IDs listed per category match the actual NFR IDs in Section 1 | `[ ]` | |
| 2a.6 | No category with zero NFRs is left without a documented reason | `[ ]` | |

### 2B. Count by Priority

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 2b.1 | Priority summary table is filled in for Critical, High, and Medium | `[ ]` | |
| 2b.2 | The total across all priorities matches the total from Section 2A | `[ ]` | |
| 2b.3 | At least one NFR is marked Critical (if zero Critical NFRs, this must be explicitly justified) | `[ ]` | |
| 2b.4 | All Critical NFRs have been reviewed and confirmed as launch blockers with the Product Owner | `[ ]` | |

---

## SECTION 3 — NFR–EPIC RTM

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 3.1 | Every NFR from Section 1 appears at least once in the RTM | `[ ]` | |
| 3.2 | Every EPIC in the Initiative appears at least once in the RTM | `[ ]` | |
| 3.3 | Each row specifies the NFR ID correctly matching an entry in Section 1 | `[ ]` | |
| 3.4 | Each row specifies the EPIC ID correctly matching an approved EPIC in the Initiative backlog | `[ ]` | |
| 3.5 | Each row specifies the NFR Type matching the category in Section 1 | `[ ]` | |
| 3.6 | Each row specifies the EPIC NFR Reference Section (e.g., 9a, 9b, 9c, 9d, 9e) | `[ ]` | |
| 3.7 | NFRs that apply to ALL EPICs (platform-wide) are mapped to every EPIC — not just one | `[ ]` | |
| 3.8 | The RTM is sorted by NFR ID first, then EPIC ID within each NFR group | `[ ]` | |
| 3.9 | No EPIC in the RTM is referenced that does not exist in the Initiative's EPIC register | `[ ]` | |
| 3.10 | The EPIC NFR Reference Section column values are consistent with the EPIC template structure (9a = Performance, 9b = Security, 9c = Reliability, 9d = Availability, 9e = Scalability) | `[ ]` | |

---

## SECTION 4 — Coverage Gap Analysis

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 4.1 | Section is completed — not left as placeholder | `[ ]` | |
| 4.2 | All EPICs without any NFR mapped are flagged here | `[ ]` | |
| 4.3 | All NFRs not yet assigned to any EPIC are flagged here | `[ ]` | |
| 4.4 | NFRs that exist in the consolidated register but are not yet documented in the relevant EPIC document (Section 9) are flagged | `[ ]` | |
| 4.5 | Conflicting NFRs (e.g., two NFRs with contradictory thresholds for the same system behaviour) are flagged | `[ ]` | |
| 4.6 | Each gap has an Action Required filled in — not left blank | `[ ]` | |
| 4.7 | Each gap has an Assigned To owner identified | `[ ]` | |
| 4.8 | Each gap has a Target Date for resolution | `[ ]` | |
| 4.9 | If there are no gaps, this is explicitly stated as "No gaps identified at this time" — not left as an empty table | `[ ]` | |
| 4.10 | All gaps identified here are tracked in the project risk register or backlog | `[ ]` | |

---

## SECTION RH — Revision History

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| RH.1 | Version 1.0 entry exists with Created Date and Author name | `[ ]` | |
| RH.2 | Every significant change after v1.0 is recorded with a new version entry | `[ ]` | |
| RH.3 | The latest version's date in Revision History matches the Last Updated date in the header | `[ ]` | |
| RH.4 | Post-baseline changes reference a Change Request number or approver sign-off | `[ ]` | |

---

## CROSS-SECTION CONSISTENCY CHECKS

> Run these after all individual section checks above are complete. These verify that
> sections are consistent with each other — not just individually complete.

| # | Consistency Check | Status | Notes / Comments |
|---|-------------------|--------|------------------|
| CC.1 | The Total NFRs count in the header matches the count in Section 2A | `[ ]` | |
| CC.2 | Every NFR ID in Section 2A exists in Section 1 (no phantom IDs in the summary) | `[ ]` | |
| CC.3 | Every NFR ID in Section 3 (RTM) exists in Section 1 (no phantom IDs in the RTM) | `[ ]` | |
| CC.4 | Every NFR in Section 1 is mapped to at least one EPIC in Section 3 (no unmapped NFRs) | `[ ]` | |
| CC.5 | Every EPIC listed in Section 3 appears in the Initiative's official EPIC register | `[ ]` | |
| CC.6 | Critical NFRs in Section 1 are mapped to at least one EPIC in Section 3 — no Critical NFR is orphaned | `[ ]` | |
| CC.7 | The NFR Type for each row in Section 3 matches the category the NFR belongs to in Section 1 | `[ ]` | |
| CC.8 | The EPIC NFR Reference Section in Section 3 is consistent with the EPIC document (the referenced section actually exists in the EPIC document) | `[ ]` | |
| CC.9 | NFRs listed in Section 4 (Gap Analysis) as "NFR without EPIC" have no corresponding rows in Section 3 — no contradiction | `[ ]` | |
| CC.10 | Performance NFRs in Section 1.01 are consistent with performance NFRs stated in the PRD (Section 10.2) — no contradictions | `[ ]` | |
| CC.11 | Security NFRs in Section 1.02 are consistent with security NFRs stated in the PRD (Section 10.1) — no contradictions | `[ ]` | |
| CC.12 | Compliance NFRs in Section 1.10 are consistent with compliance requirements in the PRD (Section 15) — no contradictions | `[ ]` | |
| CC.13 | Availability RTO/RPO in Section 1.04 matches the RTO/RPO defined in the DR section (Section 1.11) — no contradiction | `[ ]` | |

---

## FINAL READINESS GATE

> Complete this section last, after all individual section checks and cross-section
> consistency checks are done. The NFR register may only be baselined when all
> applicable items are marked `[x]`.

| # | Gate Check | Status | Notes / Comments |
|---|------------|--------|------------------|
| G.1 | All 13 NFR categories in Section 1 are addressed — categories intentionally left empty have a documented reason | `[ ]` | |
| G.2 | All mandatory columns are complete for every NFR row — no placeholder text remains | `[ ]` | |
| G.3 | All `[N/A]` items have a brief reason recorded in the Notes column | `[ ]` | |
| G.4 | Every NFR has a measurable Metric / Threshold — no vague language anywhere in the document | `[ ]` | |
| G.5 | Every NFR has a named Verification Method with a specific tool or test type | `[ ]` | |
| G.6 | The document has been self-reviewed by the Author before submission | `[ ]` | |
| G.7 | The document has been reviewed and approved by the Solution Architect or Tech Lead | `[ ]` | |
| G.8 | The document has been reviewed by the QA Lead (Verification Methods are feasible and complete) | `[ ]` | |
| G.9 | The document has been reviewed by the Security team (Section 1.02 and 1.10 are complete) | `[ ]` | |
| G.10 | The document has been reviewed and accepted by the Product Owner | `[ ]` | |
| G.11 | All Critical NFRs confirmed as launch blockers by the Product Owner | `[ ]` | |
| G.12 | All 13 Cross-Section Consistency Checks (CC.1–CC.13) are passed | `[ ]` | |
| G.13 | The NFR register is consistent with the PRD NFR sections (Sections 10.1–10.7) — no contradictions | `[ ]` | |
| G.14 | The NFR register has been shared with the DevOps team for infrastructure and pipeline planning | `[ ]` | |
| G.15 | NFR document status is updated to "Baselined" after this checklist is fully passed | `[ ]` | |

---

## CHECKLIST SIGN-OFF

```
Author              : [Name]                    Date : DD-MMM-YYYY
Architect Review    : [Name]                    Date : DD-MMM-YYYY
QA Lead Review      : [Name]                    Date : DD-MMM-YYYY
Security Review     : [Name]                    Date : DD-MMM-YYYY
PO Review           : [Name]                    Date : DD-MMM-YYYY
Final Approval      : [Name / Role]             Date : DD-MMM-YYYY

Overall Result      : [ NOT READY | READY WITH COMMENTS | BASELINED ]

Open Items / Comments:
  1. [Any open item that must be resolved before the NFR register is baselined]
  2. [Any conditional approval note]
  3. [Any NFR category flagged for revision]
```

---

## QUICK REFERENCE — NFR CATEGORY COVERAGE BY REVIEWER

> Use this table to focus review effort based on role. ★ = primary reviewer for this category.

| NFR Category | Author | Architect | QA Lead | Security | DevOps | PO |
|--------------|--------|-----------|---------|----------|--------|----|
| 1.01 Performance | ★ | ★ | ★ | — | ★ | ★ |
| 1.02 Security | ★ | ★ | ★ | ★ | — | — |
| 1.03 Scalability | ★ | ★ | ★ | — | ★ | ★ |
| 1.04 Availability | ★ | ★ | — | — | ★ | ★ |
| 1.05 Reliability & Resilience | ★ | ★ | ★ | — | ★ | — |
| 1.06 Responsiveness (UI) | ★ | — | ★ | — | — | ★ |
| 1.07 Accessibility | ★ | — | ★ | — | — | ★ |
| 1.08 Maintainability | ★ | ★ | ★ | — | ★ | — |
| 1.09 Observability & Monitoring | ★ | ★ | ★ | — | ★ | — |
| 1.10 Data Privacy & Compliance | ★ | ★ | ★ | ★ | — | ★ |
| 1.11 Disaster Recovery & BCP | ★ | ★ | — | — | ★ | ★ |
| 1.12 Interoperability | ★ | ★ | ★ | ★ | — | — |
| 1.13 Portability & Deployability | ★ | ★ | — | — | ★ | — |
| Section 2 — NFR Count Summary | ★ | — | — | — | — | — |
| Section 3 — NFR–EPIC RTM | ★ | ★ | — | — | — | ★ |
| Section 4 — Gap Analysis | ★ | ★ | ★ | ★ | ★ | ★ |

---

*Checklist Version: 1.0 | Aligned to NFR-Template v1.0 | Last Reviewed: 26-Mar-2026*

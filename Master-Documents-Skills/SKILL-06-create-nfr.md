---
description: Consolidate NFRs from PRD and EPICs into a complete Non-Functional Requirements document using the NFR-Template, validate completeness with the NFR checklist
---

# `/create-nfr` — Non-Functional Requirements Creator

> Extract NFRs from the PRD and EPICs, consolidate them into a complete Non-Functional Requirements document using the NFR-Template, and validate with the NFR checklist.

You are a solutions architect and non-functional requirements specialist. Your job is to gather all performance, security, scalability, reliability, compliance, and operational requirements scattered across the PRD and EPICs, and produce a single, authoritative NFR document with measurable targets.

---

## Reference Documents

| # | Document | Purpose |
|---|----------|---------|
| T1 | `Master-Documents/Non-Functional-Requirements-Template.md` | Write the NFR document |
| T2 | `Master-Documents/NFR-Template-Checklist.md` | Validate NFR completeness |

**Input required:**
- Approved PRD (especially Section 10 — NFRs)
- Approved EPICs (especially Section 9 — NFRs per EPIC)

---

## Your Process

### Step 1: Extract NFRs from PRD

Open the project PRD and read Section 10 (Non-Functional Requirements). Extract every stated or implied NFR across these categories:

| Category | What to Look For |
|----------|-----------------|
| Security | Auth mechanisms, encryption, data privacy, vulnerability scanning |
| Performance | Response time targets, throughput, latency budgets |
| Scalability | Concurrent users, data volume growth, horizontal scaling |
| Availability | Uptime SLA, RTO, RPO, maintenance windows |
| Reliability | Error rates, fault tolerance, failover strategy |
| Compliance | GDPR, HIPAA, PCI-DSS, SOC2, WCAG, or local regulations |
| Maintainability | Code standards, test coverage, documentation requirements |
| Audit & Logging | What must be logged, retention period, audit trail requirements |

---

### Step 2: Extract NFRs from EPICs

Open each EPIC and read Section 9 (Non-Functional Requirements). Extract any EPIC-specific NFR that is not already captured from the PRD.

Note the EPIC source for each NFR — this maintains traceability.

---

### Step 3: Identify Gaps via Stakeholder Questions

For any NFR category that has no data from Step 1 or Step 2, ask the customer / architect the following:

**Performance:**
- What is the maximum acceptable response time for critical operations?
- How many concurrent users must the system support at peak?
- What is the expected data volume (records, file sizes, throughput)?

**Availability:**
- What is the required uptime SLA (99%, 99.9%, 99.99%)?
- What are the RTO (Recovery Time Objective) and RPO (Recovery Point Objective)?

**Security:**
- What authentication mechanism is required (SSO, MFA, OAuth)?
- Is data encryption required at rest and in transit?
- Are there penetration testing or vulnerability scanning requirements?

**Compliance:**
- Which regulatory frameworks apply (GDPR, HIPAA, PCI-DSS, local laws)?
- Are there data residency requirements (data must stay in a specific region)?

**Scalability:**
- Expected growth rate (users/data) over 12 and 36 months?
- Auto-scaling required, or is manual scaling acceptable?

---

### Step 4: Write the NFR Document

Open `Master-Documents/Non-Functional-Requirements-Template.md`. Fill all sections:

| Section | Content |
|---------|---------|
| Header | NFR Doc ID, project, version, dates, author, status |
| 1. Security | Authentication, authorisation, encryption, OWASP compliance, penetration testing |
| 2. Performance | Response time targets (p50/p95/p99), throughput (req/sec), latency budgets per operation |
| 3. Scalability | Concurrent user targets, data growth projections, horizontal/vertical scaling strategy |
| 4. Availability & Reliability | SLA uptime %, RTO, RPO, failover strategy, health checks |
| 5. Compliance | Regulatory frameworks, data residency, audit requirements, retention policies |
| 6. Maintainability | Code coverage targets, dependency management, documentation standards |
| 7. Audit & Logging | Events to log, log format, retention period, alerting thresholds |
| 8. Disaster Recovery | Backup frequency, restore procedures, DR testing schedule |
| 9. DevOps & Observability | CI/CD pipeline requirements, monitoring, alerting, on-call |
| 10. Usability / Accessibility | WCAG level, browser support matrix, accessibility testing |
| 11. Internationalisation | Languages, locales, timezone handling, character encoding |
| 12. Data Integrity | Validation rules, consistency guarantees, deduplication |
| 13. Integration NFRs | SLA for external dependencies, circuit breaker, timeout policies |
| Traceability Table | Map each NFR to source (PRD section / EPIC ID) |
| Revision History | Initial entry |

**NFR entry format (for each requirement):**
```
NFR-[Category]-[NN]: [Requirement statement]
  Target   : [Measurable target — e.g., "< 2s at p95 under 1,000 concurrent users"]
  Source   : [PRD-Section-10.2 / EPIC-003]
  Priority : [P0 / P1 / P2]
  Verified By: [Load test / Security audit / Compliance review]
```

Save the NFR document as:
```
Project-Documents/NFR-[ProjectCode].md
```

---

### Step 5: Run the NFR Checklist

Run `Master-Documents/NFR-Template-Checklist.md` against the completed NFR document.

- All 13 category checks and cross-section consistency checks must pass.
- The Readiness Gate at the end of the checklist must be satisfied before the NFR document is baselined.
- Common gaps: NFRs without measurable targets, missing compliance mapping, no audit log specification, no DR plan.

---

## Output Checklist (Definition of Done)

- [ ] All NFRs extracted from PRD Section 10 and all EPIC Section 9s
- [ ] All 13 NFR categories addressed with at least one requirement each
- [ ] Every NFR has a measurable target (not "fast", not "secure" — specific numbers/levels)
- [ ] Every NFR has a source (PRD section or EPIC ID)
- [ ] Traceability table maps every NFR to its source
- [ ] Compliance frameworks identified and mapped to specific NFRs
- [ ] NFR-Template-Checklist passes with Readiness Gate satisfied
- [ ] NFR document status set and revision history entry added
- [ ] File saved to `Project-Documents/NFR-[ProjectCode].md`

---

## Flow Diagram

```
┌────────────────────────┐    ┌────────────────────────┐
│  Extract NFRs from PRD  │    │  Extract NFRs from EPICs│
│  (Section 10)           │    │  (Section 9 each EPIC)  │
└──────────┬─────────────┘    └────────────┬────────────┘
           │                               │
           └─────────────┬─────────────────┘
                         ▼
              ┌──────────────────────┐
              │  Identify NFR gaps   │
              │  Ask stakeholders    │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │  Write NFR Document  │
              │  (all 13 categories) │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │  Run NFR Checklist   │── Gaps found? ──┐
              └──────────┬───────────┘                 │
                         │ All checks pass              │
                         ▼                             │
              ┌──────────────────────┐                 │
              │  NFR Complete ✅     │◄────────────────┘
              └──────────────────────┘
```

---

## Rules

- NEVER write NFRs without reading both the PRD and all EPICs — each may have additional constraints.
- NEVER accept vague NFRs — every requirement must have a measurable, verifiable target.
- NFRs are not aspirational — they are contractual; if a target cannot be met, escalate immediately.
- Compliance NFRs must cite the specific regulation article/section, not just the regulation name.
- All NFRs must be verified by a defined method (load test, security audit, static analysis, etc.).

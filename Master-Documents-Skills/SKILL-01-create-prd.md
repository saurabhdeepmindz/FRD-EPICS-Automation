---
description: Create a complete Product Requirements Document (PRD) by gathering requirements, running gap analysis, and filling the PRD-Template incrementally
---

# `/create-prd` — PRD Creator

> Gather requirements from the customer, identify gaps, and produce a complete PRD using the PRD-Template.

You are a senior product manager. Your job is to transform raw requirements (text, documents, or conversation) into a well-structured, complete PRD using the organisation's standard template.

---

## Reference Documents

| # | Document | Purpose |
|---|----------|---------|
| T1 | `Master-Documents/PRD-Template-Checklist.md` | Completeness checklist — run BEFORE and AFTER writing |
| T2 | `Master-Documents/PRD-Template.md` | The canonical PRD structure to fill |

---

## Your Process

### Step 1: Collect Raw Requirements

Ask the customer to share one or more of the following:
- Raw text describing what they want to build
- An existing BRD, SOW, or meeting notes
- A verbal description of the product vision

If nothing has been provided, ask these 5 seed questions:
1. What is the product / application name and its primary purpose?
2. Who are the primary users (actors) and what are their roles?
3. What are the top 5–10 functional capabilities expected?
4. Are there any known integrations, compliance, or NFR constraints?
5. What is the target delivery timeline and environment (web / mobile / API)?

---

### Step 2: Run the PRD Checklist (Gap Analysis Pass 1)

Load `Master-Documents/PRD-Template-Checklist.md`.

For every checklist item that CANNOT be answered from the information collected, mark it as a **gap** and ask the customer for the required information.

Group gaps by PRD section to keep the conversation focused. Example:

```
Section 1 — Overview:
  GAP: What problem does this product solve for the business?

Section 5 — Actors:
  GAP: Are there admin / super-admin roles beyond the end user?

Section 7 — Integrations:
  GAP: Which third-party systems must be integrated (payment, SSO, ERP)?
```

Collect all gap answers before writing the PRD.

---

### Step 3: Write the PRD Incrementally

Open `Master-Documents/PRD-Template.md`. Fill each section in order, section by section:

1. **Header block** — PRD ID, Product Name, Version, Dates, Author, Status
2. **Section 1** — Overview / Objective
3. **Section 2** — High-Level Scope
4. **Section 3** — Out of Scope
5. **Section 4** — Assumptions and Constraints
6. **Section 5** — Actors / User Types
7. **Section 6** — Functional Requirements (per module)
8. **Section 7** — Integration Requirements
9. **Section 8** — Customer Journeys / Flows
10. **Section 9** — Functional Landscape
11. **Section 10** — Non-Functional Requirements (Security, Performance, Scalability, Availability, Compliance, Maintainability, Audit)
12. **Section 11–19** — Technology, DevOps, UI/UX, Branding, Compliance, Testing, Deliverables, Receivables, Environment
13. **Section 20** — High-Level Timelines
14. **Section 21** — Success Criteria (business KPIs + technical/operational targets + hypercare/go-live readiness gate)
15. **Section 22** — Miscellaneous Requirements (raw input log with verbatim customer inputs, structured MISC table with EPIC trace, migration tracker)
16. **Revision History** — Initial entry

> **Rule:** Do NOT leave any section blank. If information is unknown, write:
> `TBD — [reason / who will provide this]`

---

### Step 4: Run the PRD Checklist (Validation Pass 2)

Re-run `Master-Documents/PRD-Template-Checklist.md` against the draft PRD.

- All checklist items must be satisfied.
- If gaps remain, return to the customer with targeted questions.
- Repeat until the checklist is fully green.

---

### Step 5: Finalise and Save

1. Set PRD `Status` to **Draft** (first pass) or **Under Review** (if reviewed by stakeholder).
2. Save the completed PRD as:
   ```
   Project-Documents/PRD-[ProjectCode].md
   ```
3. Confirm with the customer that the PRD is approved before proceeding to EPICs.

---

## Output Checklist (Definition of Done)

- [ ] All 22 PRD sections populated (no blank sections)
- [ ] Success Criteria (Section 21) are measurable, time-bound, and agreed with the customer
- [ ] Miscellaneous Requirements (Section 22) are all classified, owned, and EPIC-traced
- [ ] PRD-Template-Checklist passes with zero open gaps
- [ ] Functional modules and features are numbered and traceable
- [ ] NFRs are defined with measurable targets
- [ ] Actors / User Types are enumerated
- [ ] Integration requirements listed
- [ ] Customer Journeys documented
- [ ] PRD status set and revision history entry added
- [ ] File saved to `Project-Documents/PRD-[ProjectCode].md`

---

## Flow Diagram

```
┌──────────────────────┐
│  Collect Requirements│
│  (text / doc / Q&A)  │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Run PRD Checklist    │  ◄─── Gap found?
│ (Pass 1 — Gap Scan)  │          │
└──────────┬───────────┘          │
           │ Gaps identified       │
           ▼                      │
┌──────────────────────┐          │
│ Ask customer for     │──────────┘
│ missing information  │
└──────────┬───────────┘
           │ All gaps filled
           ▼
┌──────────────────────┐
│ Write PRD            │
│ (section by section) │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Run PRD Checklist    │  ◄─── Still gaps?
│ (Pass 2 — Validate)  │          │
└──────────┬───────────┘          │
           │ All checks pass       │
           ▼                      │
┌──────────────────────┐          │
│  PRD Complete ✅     │          │
│  Save + Notify       │◄─────────┘
└──────────────────────┘
```

---

## Rules

- NEVER skip the two checklist passes.
- NEVER proceed to EPICs unless the PRD checklist is fully satisfied.
- Ask questions in batches — not one at a time.
- Use the exact section numbering from PRD-Template.md.
- All NFRs must include measurable targets (e.g., "response time < 2s at p95").
- Mark every TBD item with the owner who must resolve it.

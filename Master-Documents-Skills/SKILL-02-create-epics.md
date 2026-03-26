---
description: Derive EPICs from the PRD, create an EPIC list, write each EPIC using the EPIC-Template, validate completeness, and maintain the PRD-EPICs RTM
---

# `/create-epics` — EPIC Creator

> Derive EPICs from an approved PRD, write each EPIC using the EPIC-Template, validate completeness, and build the PRD-EPICs Requirements Traceability Matrix (RTM).

You are a senior business analyst and product owner. Your job is to read the approved PRD and decompose it into a structured set of EPICs that together cover 100% of the functional scope.

---

## Reference Documents

| # | Document | Purpose |
|---|----------|---------|
| T1 | `Master-Documents/EPIC-List-Template.md` | Enumerate all EPICs for the project |
| T2 | `Master-Documents/EPIC-Template.md` | Write each individual EPIC |
| T3 | `Master-Documents/EPIC-Template-Checklist.md` | Validate each EPIC for completeness |
| T4 | `Master-Documents/PRD-EPICs-RTM-Template.md` | Traceability from PRD sections → EPICs |

**Input required:** An approved (or baselined) PRD from `Project-Documents/PRD-[ProjectCode].md`.

---

## Your Process

### Step 1: Read and Analyse the PRD

Open the project PRD. Identify:
- All functional modules (Section 6)
- All integration requirements (Section 7)
- All customer journeys (Section 8)
- Key NFRs that require dedicated capability work (Section 10)
- UI/UX requirements that constitute a distinct body of work (Section 13)

---

### Step 2: Identify and List All EPICs

Create the EPIC list using `Master-Documents/EPIC-List-Template.md`.

**EPIC identification rules:**
- One EPIC per major feature set or capability cluster (not per screen, not per API endpoint)
- Each EPIC must be independently deliverable
- Cross-cutting concerns (auth, notifications, admin panel) each get their own EPIC
- Integration with each external system gets its own EPIC
- NFRs that require infrastructure work (e.g., logging, caching, rate-limiting) may each get a dedicated EPIC

**Naming convention:** `EPIC-[001] — [Short Capability Name]`

Save the EPIC list as:
```
Project-Documents/EPIC-List-[ProjectCode].md
```

---

### Step 3: Write Each EPIC

For each EPIC in the list, open `Master-Documents/EPIC-Template.md` and fill all sections:

| Section | Content |
|---------|---------|
| Header | EPIC ID, dates, status |
| Reference Documents | PRD sections, wireframes, API contracts that feed this EPIC |
| 1. EPIC Name | Clear, capability-oriented name |
| 2. Initiative Reference | Parent initiative (if applicable) |
| 3. Summary | 2–4 sentence summary of what this EPIC delivers |
| 4. Description | 4a. Key Actors, 4b. High-Level Flow |
| 5. Pre-requisites | EPICs or infrastructure that must exist first |
| 6. Trigger | What initiates this EPIC's functionality |
| 7. Scope | 7a. Modules, 7b. Features, 7c. Edge Cases |
| 8. Acceptance Criteria | Measurable, testable conditions for "done" |
| 9. NFRs | Performance, Security, Reliability, Availability, Scalability targets |
| 10. Business Value | Quantified or qualified business impact |
| 11. Integration with Other EPICs | Dependencies and data handoffs |
| 12. Out of Scope | Explicit exclusions to prevent scope creep |
| 13. Risks & Challenges | Known risks and mitigation approach |
| Revision History | Initial entry |

Save each EPIC as:
```
Project-Documents/EPICs/EPIC-[001]-[ShortName].md
```

---

### Step 4: Validate Each EPIC

Run `Master-Documents/EPIC-Template-Checklist.md` against each EPIC.

- Every checklist item must pass before the EPIC is marked **Approved**.
- If gaps are found, fill them before proceeding.
- Common gaps: missing acceptance criteria, vague scope, no NFR targets, missing pre-requisites.

---

### Step 5: Build / Update the PRD-EPICs RTM

Open `Master-Documents/PRD-EPICs-RTM-Template.md`. For every PRD section and feature, map it to one or more EPIC IDs.

- Every PRD functional requirement must trace to at least one EPIC.
- Flag any PRD requirement with NO EPIC mapping as a **coverage gap**.
- Save the RTM as:
  ```
  Project-Documents/RTM/PRD-EPICs-RTM-[ProjectCode].md
  ```

---

## Output Checklist (Definition of Done)

- [ ] EPIC list created — all EPICs named and numbered
- [ ] Every PRD functional requirement maps to at least one EPIC (no coverage gaps)
- [ ] Each EPIC document has all 13 sections completed (no blank sections)
- [ ] EPIC-Template-Checklist passes for every EPIC
- [ ] PRD-EPICs RTM populated with zero unmapped PRD requirements
- [ ] All EPICs saved to `Project-Documents/EPICs/`
- [ ] RTM saved to `Project-Documents/RTM/`

---

## Flow Diagram

```
┌─────────────────────┐
│  Read Approved PRD   │
│  (Sections 6,7,8,10) │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Identify EPICs      │
│  Build EPIC List     │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Write EPIC (loop)   │◄──────────────────┐
│  Using EPIC-Template │                   │
└──────────┬──────────┘                   │
           ▼                              │
┌─────────────────────┐                   │
│  Run EPIC Checklist  │── Gaps found? ───┘
└──────────┬──────────┘
           │ All EPICs pass
           ▼
┌─────────────────────┐
│  Update PRD-EPICs   │
│  RTM                │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  EPICs Complete ✅   │
└─────────────────────┘
```

---

## Rules

- NEVER write EPICs before the PRD is approved.
- NEVER combine unrelated capabilities into a single EPIC.
- Every EPIC must have measurable Acceptance Criteria — not "system works correctly".
- The PRD-EPICs RTM must be 100% coverage before proceeding to Screens / User Stories.
- EPIC IDs are permanent — never reuse a deleted EPIC's ID.

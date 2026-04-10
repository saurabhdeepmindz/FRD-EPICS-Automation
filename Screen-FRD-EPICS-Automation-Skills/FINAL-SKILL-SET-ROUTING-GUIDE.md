# Skill Set Routing Guide [v2.0 — TBD-Future Enabled]

## Two Scenarios Supported

| Scenario | Primary Input | Skill Set to Use |
|----------|--------------|-----------------|
| **A — PRD-First** | Customer provides a PRD document | SKILL-01 → SKILL-02 → SKILL-04 → SKILL-05 |
| **B — Screen-First** | Customer provides Figma screens | **SKILL-00 → SKILL-01-S → SKILL-02-S → SKILL-04 → SKILL-05** |

---

## Scenario B — Screen-First Workflow (Module-by-Module)

Processing is strictly module-by-module. Never process multiple modules in one execution.

```
For each module (repeat until all modules complete):

  Figma screens for this module
        ↓
    SKILL-00   Screen Analysis & Inventory (per module)
        ↓       → Screen Analysis Report
                → Screen Summary Cards JSON (handoff packet)
                → Navigation Map
    SKILL-01-S  Create FRD from Screen Analysis (per module)
        ↓       → FRD module section appended to living FRD document
                → FRD Handoff Packet JSON
                → TBD-Future Integration Registry updated
    SKILL-02-S  Create EPICs from Screen Analysis (per module)
        ↓       → EPIC documents
                → EPIC Handoff Packet JSON
                → Module-FRD-EPICs RTM updated
    SKILL-04    Create User Stories (per module)
        ↓       → User Story documents
                → Master RTM extended
    SKILL-05    Create SubTasks (per module)
                → SubTask documents with TBD-Future stubs
                → Master RTM complete for this module

After all modules complete:
  TBD-Future Integration Registry → all entries resolved ✅

Optional (any time after SKILL-01-S for any module):
  SKILL-01-P  Create PRD from Screens
              → 22-section enterprise PRD
              → Section 6 imported from FRD — Feature IDs preserved
```

---

## PRD Ordering Flexibility

The enterprise PRD (SKILL-01-P) is NOT in the critical path. It can be created at any of these points:

| Ordering | When | Use When |
|----------|------|---------|
| A — PRD before EPICs | After SKILL-01-S for all modules | Governance or contract requires PRD before development |
| B — PRD after SubTasks | After SKILL-05 for all modules | Team needs to start development immediately |
| C — PRD per module | After SKILL-01-S for each module | Incremental delivery to stakeholders |

The RTM chain is unbroken in all orderings because Feature IDs originate in the FRD (SKILL-01-S) and the PRD only imports them — it does not create new ones.

---

## Two Different PRD Types — Do Not Confuse Them

| | `SKILL-01-P` | `/prd` command |
|---|---|---|
| What it creates | 22-section enterprise business PRD | `sprints/vN/PRD.md` + `TASKS.md` |
| Purpose | Business stakeholder document / contract | Sprint execution plan for AI agent |
| Consumed by | Business stakeholders / governance | `/dev` command |
| When to run | Once per project (optional) | Once per sprint (repeated) |
| Input | Screen Analysis + FRD | SubTasks from SKILL-05 |

---

## Per-Sprint Execution (Phase 2 — After All Analysis Complete)

```
/prd → reads SKILL-05 SubTasks → selects SubTasks for this sprint
     → creates sprints/vN/PRD.md + sprints/vN/TASKS.md
     ↓
/dev → picks highest priority task from TASKS.md
     → TDD → implement (using stub for TBD-Future integrations)
     → security scan → commit → mark task done
     ↓
repeat /dev until all tasks in TASKS.md complete
     ↓
/prd → next sprint → selects next batch of SubTasks
```

**When calling /prd, instruct it:** "Read the SubTasks from `Project-Documents/SubTasks/`. This is Sprint v[N]. Select [module/feature] SubTasks. Use SubTask Name as task title, Algorithm steps as implementation guidance, Acceptance Criteria as done condition, Source File Name as Files field."

---

## Context Management — What Each Skill Receives

Never inject full documents into downstream skill calls. Use compact handoff packets.

| Skill | Receives | Does NOT receive |
|-------|---------|-----------------|
| SKILL-00 | Screen images, BA text, audio transcripts, click-through flows | Nothing from previous skills |
| SKILL-01-S | Screen Summary Cards JSON, Compact Module Index | Full Screen Analysis Report |
| SKILL-02-S | FRD Handoff Packet JSON, Compact Module Index, TBD-Future Registry rows | Full FRD document |
| SKILL-04 | EPIC Handoff Packet JSON, FRD Handoff Packet JSON, Screen Summary Cards | Full EPIC documents |
| SKILL-05 | Full current User Story, parent Handoff Packets (compact), RTM rows | Full FRD, full EPIC documents |

**Context budget per skill call: ~15,000 tokens maximum. This is bounded and does not grow with project size.**

---

## Files That Are Identical in Both Scenarios

SKILL-04 (User Stories) and SKILL-05 (SubTasks) are identical in both Scenario A and Scenario B. By the time these run, the FRD and EPICs exist regardless of whether the original input was a PRD or screen images. Do not create separate versions.

---

## TBD-Future Integration Pattern

### What TBD-Future means

TBD-Future marks a cross-module integration that has been identified from screen evidence but whose formal interface cannot be confirmed because the referenced module has not yet been processed through the skill chain.

TBD-Future is NOT a gap or error. It is a planned placeholder. It signals: "we know this integration exists, we have an assumed interface, and it will be formally confirmed when the referenced module is processed."

### TBD-Future status values

| Classification | Meaning |
|---------------|---------|
| `INTERNAL-TBD-Future` | Integration with a module not yet processed |
| `EXTERNAL-TBD-Future` | Integration with an external system not yet named/confirmed |
| `INTERNAL-CONFIRMED` | Integration with an already-approved module |
| `EXTERNAL-CONFIRMED` | Integration with a named, confirmed external system |

### Feature / Story / SubTask status values

| Status | Meaning | Can Proceed? |
|--------|---------|-------------|
| `CONFIRMED` | All integrations confirmed | Yes |
| `CONFIRMED-PARTIAL` | TBD-Future integrations present — scope confirmed | Yes |
| `DRAFT` | Unresolved question about own scope | No — resolve first |

### Required fields for every TBD-Future entry

Every TBD-Future integration signal, at every level, must have all four of these fields. "TBD" alone is never acceptable:

1. **Integration Name** — the name of the assumed integration
2. **Referenced Module** — MOD-ID for INTERNAL, assumed system name for EXTERNAL
3. **Assumed Interface** — class name + method name + arguments + return type
4. **Resolution Trigger** — when the referenced module reaches which stage

### Where TBD-Future appears

| Skill | Where |
|-------|-------|
| SKILL-00 | Section 4M — Integration Signals (classified) |
| SKILL-01-S | Feature Integration Signals field + Section 9 TBD-Future Registry |
| SKILL-02-S | Integration Domains section of each EPIC |
| SKILL-04 | Section 21 Integrations + Algorithm Outline TBD-Future steps + Traceability Header |
| SKILL-05 | Integration Points section + Algorithm steps + Traceability Header + QA-07 stub tests |
| SKILL-01-P | Section 7 Integrations table |

### Stub implementation pattern

When a SubTask has a TBD-Future integration, the developer implements a stub:

```
Create [ServiceName]Stub implementing [ServiceName] interface:
  - Returns valid assumed response for known test IDs
  - Returns null / throws NotFoundException for unknown IDs
  - Replace with real service when referenced module is confirmed
```

Stubs allow development to proceed immediately. They are not a workaround — they are a first-class design pattern enabling parallel module development.

### TBD-Future resolution lifecycle

```
Step 1:  Integration identified → classified TBD-Future in SKILL-00
Step 2:  TBD-Future propagates through FRD → EPIC → Story → SubTask
         with assumed interface and stub guidance at each level
Step 3:  Development proceeds using stubs (CONFIRMED-PARTIAL artifacts)
Step 4:  Referenced module uploaded and processed through SKILL-00 to SKILL-05
Step 5:  When referenced module's SubTasks approved:
           System identifies all TBD-Future entries with that module ref
           Resolution notification issued — lists every artifact to update
Step 6:  For each TBD-Future entry:
           Confirm assumed interface OR update with actual interface
           Update SubTask Integration Point (class, method, return type)
           Update Algorithm step (remove stub guidance)
           Update Traceability Header (status → RESOLVED, date)
           Replace QA-07 stub test with real integration test
Step 7:  Status changes: CONFIRMED-PARTIAL → CONFIRMED
Step 8:  RTM TBD-Future column: ☐ → ✅ with resolution date
```

### RTM TBD-Future columns

The Master RTM carries TBD-Future tracking columns from FRD through to SubTask:

| ... | Feature Status | Integration Status | TBD-Future Ref | Registry ID | Resolved | Resolution Date |
|-----|---------------|-------------------|----------------|-------------|---------|----------------|
| ... | CONFIRMED-PARTIAL | TBD-Future | MOD-03 | TBD-001 | ☐ | — |
| ... | CONFIRMED | CONFIRMED | — | — | ✅ | 2025-04-15 |

---

## Complete File Inventory — Scenario B

| File | Version | Purpose |
|------|---------|---------|
| `SKILL-00-screen-analysis.md` | v2.0 | Screen analysis with TBD-Future classification |
| `SKILL-01-S-create-frd-from-screens.md` | v2.0 | FRD from screens with TBD-Future registry |
| `SKILL-01-P-create-prd-from-screens.md` | v2.0 | Enterprise PRD — optional |
| `SKILL-02-S-create-epics-from-screens.md` | v2.0 | EPICs with TBD-Future integration domains |
| `SKILL-04-create-user-stories-v2.md` | v2.0 | User Stories with TBD-Future in Section 21 |
| `SKILL-05-create-subtasks-v2.md` | v2.0 | SubTasks with TBD-Future stubs |
| `SKILL-SET-ROUTING-GUIDE.md` | v2.0 | This file — routing, context, TBD-Future lifecycle |

---

## The RTM Chain — Confirmed End to End

```
SCR-ID (SKILL-00)
  ↓
MOD-ID + F-ID + TBD-Future Classification (SKILL-01-S)
  ↓
F-ID + EPIC-ID + TBD-Future Integration Domains (SKILL-02-S)
  ↓
F-ID + EPIC-ID + US-ID + TBD-Future in Section 21 (SKILL-04)
  ↓
US-ID + ST-ID + Source File + TBD-Future Stubs (SKILL-05)
  ↓
Source File Header: MOD + F + EPIC + US + ST + SCR + TC-IDs + TBD-Future Dependencies
  ↓
Test Cases: stub tests (QA-07) → real integration tests after resolution
  ↓
TBD-Future resolved → all entries ✅ → full chain CONFIRMED
```

---

## Rules That Apply Across All Skills

- NEVER process multiple modules in one skill execution.
- NEVER inject full documents into downstream skill calls — use handoff packets.
- NEVER classify an integration signal without one of the four TBD-Future statuses.
- NEVER write bare "TBD" for an integration — always provide assumed interface.
- NEVER block CONFIRMED-PARTIAL features, stories, or SubTasks from progressing.
- NEVER block any artifact due to TBD-Future integrations — stubs enable parallel progress.
- Feature IDs originate in the FRD and never change through any downstream artifact.
- The PRD is optional and can be created at any point after the first module's FRD is approved.
- SKILL-04 and SKILL-05 are identical for Scenario A and Scenario B.
- TBD-Future Resolution is a formal process — not an informal update.

---
description: Create the FRD Feature List from an approved Screen Analysis Report (Screen-First workflow). Identifies Modules, defines Features with Feature IDs, classifies integrations as CONFIRMED or TBD-Future, and builds the Module-FRD RTM.
---

# `/create-frd-from-screens` — SKILL-01-S: FRD Creator (Screen-First) [v2.0 — TBD-Future Enabled]

> Create the Feature Requirements Document (FRD) using the Screen Analysis Report as the primary source. Every feature receives a Feature ID that propagates through the entire RTM. Integration signals are carried forward with TBD-Future classification where cross-module dependencies are not yet resolved. Features with TBD-Future integrations receive CONFIRMED-PARTIAL status and are NOT blocked from proceeding to EPIC generation.

You are a senior business analyst. You have a completed Screen Analysis Report from SKILL-00. Your job is to translate screen-level observations into a structured FRD with Feature IDs, priorities, and acceptance criteria — handling TBD-Future integrations as first-class entries, not gaps.

---

## Prerequisites — What Must Exist Before This Skill Runs

| Prerequisite | Location | Status Required |
|-------------|----------|-----------------|
| Screen images catalogued | `Project-Documents/Screens/Raw/` | Complete |
| Screen Inventory for current module | `Project-Documents/Screens/Screen-Inventory-[ProjectCode]-[ModuleID].md` | Complete |
| Screen Analysis Report for current module | `Project-Documents/Screens/Screen-Analysis-Report-[ProjectCode]-[ModuleID].md` | Complete & Reviewed |
| Screen Summary Cards JSON | `Project-Documents/Screens/Screen-Summary-Cards-[ProjectCode]-[ModuleID].json` | Generated |
| Assumptions Log reviewed | Section 10 of Screen Analysis Report | Reviewed |
| Open Questions shared with customer | Section 11 of Screen Analysis Report | Critical ones resolved |
| Compact Module Index (if not first module) | `Project-Documents/FRD/Module-Index-[ProjectCode].json` | Populated |

---

## Context Management — What This Skill Receives

This skill operates in module-scoped mode. The context assembled for each execution is:

```
Screen Summary Cards JSON — current module only     ~120 tokens per screen
Compact Module Index — previously approved modules  ~50 tokens per module
Running FRD TBD-Future Registry (if exists)         ~60 tokens per entry
Skill-01-S instructions                             ~5,000 tokens
```

The full Screen Analysis Report is NOT injected into context. The Screen Summary Cards JSON is the machine-readable handoff from SKILL-00.

---

## Feature Status Definitions

| Status | Meaning | Can Proceed to EPICs? |
|--------|---------|----------------------|
| `CONFIRMED` | Feature fully defined, all integrations resolved | Yes |
| `CONFIRMED-PARTIAL` | Feature scope confirmed, one or more integrations are TBD-Future | Yes — TBD-Future does not block progression |
| `DRAFT` | Feature has unresolved Open Questions about its own scope or behaviour | No — must resolve Open Questions first |

**Critical rule:** TBD-Future integrations do NOT make a feature DRAFT. They make it CONFIRMED-PARTIAL. Only unresolved questions about the feature's OWN scope or behaviour make it DRAFT.

---

## Reference Documents

| # | Document | Purpose |
|---|----------|---------|
| T1 | `Master-Documents/Module-List-Template.md` | Enumerate all system modules |
| T2 | `Master-Documents/FRD-Template.md` | Document features per module |
| T3 | `Master-Documents/FRD-Checklist.md` | Validate FRD completeness |
| T4 | `Master-Documents/Module-FRD-RTM-Template.md` | Traceability: Module → Features |

---

## Your Process

---

### Step 1: Confirm Module Identity

Open the Screen Summary Cards JSON and Screen Analysis Report Section 4 (Module Identification).

**Confirm for this module:**

| Field | Description | Example |
|-------|-------------|---------|
| Module ID | `MOD-[NN]` | `MOD-02` |
| Module Name | Clear capability name | `Task Assignment & Workflow Management` |
| Module Description | 2–3 sentences from screen analysis | Synthesised from per-screen analyses |
| Package / Namespace Name | Exact code package name | `task_management` |
| Screen IDs | All screens in this module | `SCR-15` |
| Primary Actors | Who uses this module | `Admin` |
| Integration Domains | From Screen Analysis Section 9 — classified | `NotificationService [EXTERNAL-CONFIRMED], ProfessionalProfileService [INTERNAL-TBD-Future MOD-03]` |
| Module Priority | MoSCoW | `Must Have` |

**Update Compact Module Index** with this module's entry:
```json
{
  "moduleId": "MOD-02",
  "moduleName": "Task Assignment & Workflow Management",
  "packageName": "task_management",
  "status": "In Progress",
  "screenIds": ["SCR-15"],
  "integrationDomains": [
    {"name": "NotificationService", "status": "EXTERNAL-CONFIRMED"},
    {"name": "ProfessionalProfileService", "status": "INTERNAL-TBD-Future", "refModule": "MOD-03"}
  ]
}
```

---

### Step 2: Decompose Each Screen into Features

For each screen in the Screen Summary Cards JSON, translate screen elements into features.

**How to extract Features from Screen Analysis:**

| Screen Element | Becomes a Feature |
|---------------|------------------|
| A form with fields and a submit button | Feature: "[Actor] submits [form name]" |
| A data display section (cards, tables) | Feature: "System displays [data name] to [actor]" |
| An alert or banner with a CTA | Feature: "System alerts admin to [condition] with action" |
| A Quick Actions panel | Feature: "[Actor] accesses quick actions from dashboard" |
| A file upload control | Feature: "[Actor] uploads [file type]" |
| A toggle / checkbox | Feature: "[Actor] controls [setting name]" |
| A tag input | Feature: "[Actor] manages [tag type] tags" |
| An email dispatch button | Feature: "System sends [email type] to [recipient]" |
| A dropdown populated from data | Feature: "System provides [dropdown name] selection from [source]" |

**For each Feature, capture:**

| Field | Description | Source |
|-------|-------------|--------|
| Feature ID | `F-[MOD-NN]-[NN]` | Assigned sequentially |
| Feature Name | Short action-oriented name | Derived from screen element |
| Feature Description | 2–4 sentences: full behaviour | Synthesised from screen analysis |
| Module Reference | Parent Module ID | Step 1 |
| Screen Reference | Screen ID(s) | Screen Inventory |
| Primary Actor | Who triggers this feature | Screen analysis Section 4A |
| Trigger | What initiates this feature | Screen analysis Section 4F |
| Pre-conditions | What must be true before execution | Business rules + navigation map |
| Post-conditions | What is true after success | Inferred from feature purpose |
| Business Rules | Named rules — each gets a BR-ID | Screen analysis Section 4K |
| Validations | Field-level validation rules | Screen analysis Section 4L |
| Integration Signals | From Section 9 of Screen Analysis — with TBD-Future classification | See format below |
| Acceptance Criteria | Plain English business-level | Derived from screen behaviour |
| Priority | MoSCoW | Inferred from screen prominence |
| Status | CONFIRMED / CONFIRMED-PARTIAL / DRAFT | See Status Definitions above |
| Assumption References | ASM-IDs affecting this feature | From Assumptions Log |
| Open Question References | OQ-IDs affecting this feature | From Open Questions Log |
| Downstream Epic Candidate | Which Epic this feature feeds | Initial assessment |

---

### Step 3: Document Integration Signals per Feature

**Integration Signal format in FRD Feature:**

```
Feature: F-02-07 — Task Submission & Notification

Integration Signals:

  Signal 1:
    Integration Name:     Notification Service
    Classification:       EXTERNAL-CONFIRMED
    Used For:             Triggers immediate notification to assigned professional
    Assumed Interface:    sendTaskAssignmentNotification(professionalId, taskId)
    Resolution:           N/A — confirmed

  Signal 2:
    Integration Name:     Professional Profile Service
    Classification:       INTERNAL-TBD-Future
    Used For:             Validates assignee exists and is active
    Referenced Module:    MOD-03 — Professionals (not yet processed)
    Assumed Interface:    getProfessionalById(professionalId) returning 
                          Professional entity with status field
    Resolution Trigger:   MOD-03 FRD approved
    Status:               TBD-Future
    Impact on Feature:    Step 4 of feature flow uses TBD-Future interface.
                          Placeholder logic applies until resolved.

  Signal 3:
    Integration Name:     Audit Log Service
    Classification:       INTERNAL-CONFIRMED
    Used For:             Records admin task assignment action
    Assumed Interface:    logAdminAction(adminId, action, entityId)
    Resolution:           N/A — confirmed
```

**Feature Status determination:**

```
If ALL integration signals are CONFIRMED → Feature Status = CONFIRMED
If ANY integration signal is TBD-Future AND no OQ blocks feature scope → CONFIRMED-PARTIAL
If any OQ is unresolved about the feature's OWN scope or behaviour → DRAFT
```

---

### Step 4: Maintain the TBD-Future Integration Registry

The FRD contains a dedicated Section 9: TBD-Future Integration Registry. This is a consolidated, living table of all cross-module integrations pending resolution across ALL features in the FRD.

**Registry format:**

| Registry ID | Integration Name | Classification | Referenced Module | Appears In Features | Resolution Trigger | Resolved? |
|------------|-----------------|---------------|------------------|--------------------|--------------------|----------|
| `TBD-001` | Professional Profile Service | INTERNAL-TBD-Future | MOD-03 | F-02-02, F-02-07 | MOD-03 FRD approved | ☐ |
| `TBD-002` | File Storage Service | EXTERNAL-TBD-Future | N/A — system TBD | F-03-01 | Tech stack confirmed | ☐ |

**Registry rules:**
- Every TBD-Future integration signal from any feature is logged here
- The same integration appearing in multiple features gets ONE registry entry with all Feature IDs listed
- When a module is approved and its interfaces confirmed, the registry entry is updated and marked resolved
- Resolved entries are NOT deleted — they are marked ✅ with the resolution date and confirmed interface

---

### Step 5: Write the FRD Document — Module Section

The FRD is a living document that grows module by module. When processing Module 2, the Module 1 section is already in the FRD as Approved. This execution appends the Module 2 section.

**FRD Document Structure (Screen-First, Module-by-Module):**

```
FRD — [Project Name] — Screen-First Edition — Living Document
├── Section 1: Document Control (version, approvers, date, last updated)
├── Section 2: Purpose & Scope
├── Section 3: Module Overview (grows as modules are processed)
│     ├── MOD-01: [Module Name] — Status: Approved
│     ├── MOD-02: [Module Name] — Status: In Review
│     └── ...
├── Section 4: Feature List by Module ← INDEX/CATALOG TABLE
│     ├── MOD-01: [Module Name] — Status: Approved
│     │     ├── F-01-01: [Feature] — CONFIRMED
│     │     └── ...
│     ├── MOD-02: [Module Name] — Status: In Review
│     │     ├── F-02-01: [Feature] — CONFIRMED
│     │     ├── F-02-07: [Feature] — CONFIRMED-PARTIAL [TBD-001]
│     │     └── ...
│     └── ...
├── Section 4-Detail: Per-Feature Detail Blocks ← MANDATORY, ONE BLOCK PER FEATURE
│     ├── #### F-01-01: [Feature Name]
│     │     └── 9 mandatory attributes (Description, Screen Reference, Trigger,
│     │         Pre-Conditions, Post-Conditions, Business Rules, Validations,
│     │         Integration Signals, Acceptance Criteria)
│     ├── #### F-01-02: [Feature Name]
│     │     └── 9 mandatory attributes
│     └── ... one detail block per Feature ID — NO EXCEPTIONS
├── Section 5: Feature Priority Summary (MoSCoW — updates per module)
├── Section 6: Consolidated Business Rules
├── Section 7: Consolidated Validations
├── Section 8: Assumptions Log
├── Section 9: TBD-Future Integration Registry ← LIVING TABLE
├── Section 10: Open Questions Log
└── Section 11: Out of Scope Features
```

**Section 4 vs Section 4-Detail — both are required, both are different.**

| Section | Shape | Purpose |
|---|---|---|
| **Section 4** | A markdown table — one row per feature, columns: Feature ID, Feature Name, Status, Priority, Screen Ref, etc. | Catalog / quick-reference index. |
| **Section 4-Detail** | A heading block per feature: `#### F-XX-XX: Feature Name` followed by all 9 mandatory attributes as bullet lines. | The authoritative feature definition. Downstream skills (SKILL-02-S, SKILL-04, SKILL-06, SKILL-07) and the artifact tree consume this. |

It is **not acceptable** to substitute the Section 4 table for Section 4-Detail. The table cannot carry multi-line descriptions, business rules, or acceptance criteria — those belong in Section 4-Detail's heading blocks. Any feature that appears in Section 4 but is missing from Section 4-Detail is a hard validation failure (see Step 7).

**Mandatory per-feature detail block format (Section 4-Detail):**

Every feature in this module — without exception — MUST be emitted in this exact heading format:

```markdown
#### F-XX-XX: [Feature Name]

- **Description:** 2–4 sentences describing the full behaviour of this feature, synthesised from the screen analysis. Must be specific enough that a developer can implement without re-reading the screen.
- **Screen Reference:** SCR-NN — Screen Title (use the em-dash + title format defined in Rules below)
- **Trigger:** What action initiates this feature (e.g. "Admin clicks Save" / "System detects file uploaded").
- **Pre-Conditions:**
  - Condition 1 that must be true before the feature can execute
  - Condition 2
  - ... (one bullet per pre-condition; minimum 1)
- **Post-Conditions:**
  - State 1 that is true after successful completion
  - State 2
  - ... (one bullet per post-condition; minimum 1)
- **Business Rules:**
  - BR-01: Named rule with explicit logic
  - BR-02: ...
  - ... (every rule prefixed with `BR-NN:`; minimum 1)
- **Validations:**
  - Field-level validation rule 1 (e.g. "Email field: RFC 5322 format, max 254 chars, required")
  - Validation rule 2
  - ... (minimum 1; if the feature has no inputs, write "N/A — read-only feature, no input validations")
- **Integration Signals:**
  - Signal 1: [Name] — [EXTERNAL-CONFIRMED | INTERNAL-CONFIRMED | EXTERNAL-TBD-Future | INTERNAL-TBD-Future] — Used for: [purpose] — Assumed Interface: `[signature]` — Resolution: [N/A — confirmed | TBD-Future ref TBD-NNN]
  - ... (minimum 1; if the feature has no integrations, write "N/A — self-contained feature, no integration dependencies")
- **Acceptance Criteria:**
  - AC-01: Plain-English business-level criterion (Given/When/Then is acceptable but not required)
  - AC-02: ...
  - ... (every criterion prefixed with `AC-NN:`; minimum 2)
```

**Hard rules — these are non-negotiable:**

1. The heading line must be exactly `#### F-XX-XX: [Feature Name]` (four hashes, space, feature ID, colon, space, name). No bold wrapping, no em-dash, no parentheses.
2. All 9 attribute labels must appear, in the order shown, prefixed with `- **Label:**` (bold-wrapped label, colon).
3. No attribute may be omitted. If genuinely not applicable, write a 1-line rationale starting with `N/A —` (e.g. `N/A — read-only feature, no input validations`). Bare empty bullets, dashes, or "TBD" are not acceptable substitutes.
4. The block ends at the next `#### F-XX-XX:` heading or the next `## Section` heading.
5. The number of `#### F-XX-XX:` blocks in Section 4-Detail must equal the number of distinct Feature IDs in Section 4's table — no more, no less. Pre-existing approved modules' detail blocks are carried forward unchanged.

**Approved module sections are locked.** They cannot be edited without explicitly unlocking. Unlocking resets section status to Draft and requires re-approval.

Save as:
```
Project-Documents/FRD/FRD-[ProjectCode]-Screen-First.md
```

---

### Step 6: Generate the FRD Handoff Packet (JSON)

After the FRD module section is produced, generate the compact FRD Handoff Packet for this module. This JSON travels into SKILL-02-S — the full FRD document does NOT.

**The `features[]` array carries the SAME 9 mandatory attributes captured in Section 4-Detail's heading blocks** — they are two views of the same data. The artifact tree, downstream skills, and orchestrator validation all cross-check the markdown blocks against this JSON.

```json
{
  "moduleId": "MOD-02",
  "moduleName": "Task Assignment & Workflow Management",
  "packageName": "task_management",
  "features": [
    {
      "featureId": "F-02-07",
      "featureName": "Task Submission & Notification",
      "priority": "Must Have",
      "status": "CONFIRMED-PARTIAL",
      "description": "Admin assigns a task to a professional from the assignment screen. The system persists the task, dispatches a notification, and writes an audit-log entry. Must Have for the Module-02 release because it gates downstream workflow handoffs.",
      "screenRef": "SCR-15",
      "trigger": "Admin clicks Assign Task Now",
      "preConditions": ["Admin authenticated", "All mandatory fields complete"],
      "postConditions": ["Task persisted", "Notification dispatched"],
      "businessRules": ["BR-01: Due date must be future", "BR-02: Professional must be active"],
      "validations": ["VAL-01: Due date >= today", "VAL-02: Professional dropdown selection required"],
      "integrationSignals": [
        {"name": "NotificationService", "status": "EXTERNAL-CONFIRMED", "assumedInterface": "sendTaskAssignmentNotification(professionalId, taskId)"},
        {"name": "ProfessionalProfileService", "status": "INTERNAL-TBD-Future", "refModule": "MOD-03", "assumedInterface": "getProfessionalById(professionalId)", "registryId": "TBD-001"},
        {"name": "AuditLogService", "status": "INTERNAL-CONFIRMED", "assumedInterface": "logAdminAction(adminId, action, entityId)"}
      ],
      "acceptanceCriteria": [
        "AC-01: Given the admin is on SCR-15 — Assign Task Screen with all mandatory fields filled, when Assign Task Now is clicked, then the task is persisted and the assigned professional receives a notification.",
        "AC-02: Given the due date is in the past, when Assign Task Now is clicked, then validation VAL-01 fires and the form is not submitted."
      ]
    }
  ],
  "tbdFutureRegistryIds": ["TBD-001"],
  "sourceScreenIds": ["SCR-15"],
  "sourceReportVersion": "v1.0"
}
```

**JSON contract — every entry in `features[]` MUST carry all of these 9 attribute keys, even if value is "N/A":**

`description`, `screenRef`, `trigger`, `preConditions`, `postConditions`, `businessRules`, `validations`, `integrationSignals`, `acceptanceCriteria`.

These are in addition to the bookkeeping fields `featureId`, `featureName`, `priority`, `status`. Missing or empty-array values for any of the 9 mandatory attributes are a validation failure.

Save as:
```
Project-Documents/FRD/FRD-Handoff-[ProjectCode]-[ModuleID].json
```

---

### Step 7: Validate the FRD Module Section

**Standard checks:**
- [ ] Every screen references at least one Feature — no orphan screens
- [ ] Every Feature has a unique Feature ID
- [ ] Every Feature has a Priority
- [ ] Out of Scope explicitly documented

**Per-feature 9-attribute coverage (Section 4-Detail) — MANDATORY:**
- [ ] The number of `#### F-XX-XX:` heading blocks in Section 4-Detail equals the number of distinct Feature IDs in this module
- [ ] Every feature's detail block contains a non-empty **Description** line
- [ ] Every feature's detail block contains a non-empty **Screen Reference** line, formatted as `SCR-NN — Screen Title`
- [ ] Every feature's detail block contains a non-empty **Trigger** line
- [ ] Every feature's detail block contains at least one **Pre-Condition** bullet
- [ ] Every feature's detail block contains at least one **Post-Condition** bullet
- [ ] Every feature's detail block contains at least one **Business Rule** bullet, prefixed `BR-NN:`
- [ ] Every feature's detail block contains at least one **Validation** bullet (or `N/A — ...` rationale)
- [ ] Every feature's detail block contains at least one **Integration Signal** bullet (or `N/A — ...` rationale)
- [ ] Every feature's detail block contains at least two **Acceptance Criteria** bullets, prefixed `AC-NN:`
- [ ] Bare `TBD`, empty bullets, or naked dashes are NOT present in any attribute slot
- [ ] The 9 attribute keys in the Handoff Packet `features[]` JSON match the markdown blocks for every feature

**TBD-Future specific checks:**
- [ ] Every integration signal has one of the four classifications
- [ ] Every INTERNAL-TBD-Future signal references a module ID
- [ ] Every TBD-Future signal has an assumed interface documented
- [ ] Every TBD-Future signal has a resolution trigger
- [ ] Every feature with TBD-Future signals is marked CONFIRMED-PARTIAL (not DRAFT)
- [ ] TBD-Future Integration Registry updated with all new entries
- [ ] FRD Handoff Packet JSON generated for this module
- [ ] No feature is marked DRAFT solely due to TBD-Future integrations

**If ANY check above fails, the FRD module section is NOT ready for sign-off. Re-emit the missing/incomplete blocks before proceeding to Step 8.**

---

### Step 8: Obtain Customer Sign-Off for This Module Section

Before proceeding to SKILL-02-S for this module:
- Walk customer through the module's features
- Confirm Must Have features
- Resolve any Open Questions that made features DRAFT
- Confirm all TBD-Future integration assumptions are reasonable
- Get approval for the module section
- Update module status to Approved in the FRD

**No EPIC may be written for a Feature with DRAFT status.**
**EPICs MAY be written for Features with CONFIRMED-PARTIAL status.**

---

### Step 9: Build / Update the Module-FRD RTM

Extend or create the Module-FRD RTM with this module's features.

| Module ID | Module Name | Package | Feature ID | Feature Name | Priority | Status | Screen Ref | Integration Status | TBD-Future Ref | Epic Candidate |
|-----------|-------------|---------|------------|-------------|----------|--------|------------|-------------------|----------------|----------------|
| MOD-02 | Task Management | task_management | F-02-07 | Task Submission & Notification | Must Have | CONFIRMED-PARTIAL | SCR-15 | TBD-Future | TBD-001 | EPIC-02 |

Save as:
```
Project-Documents/RTM/Module-FRD-RTM-[ProjectCode].md
```

---

## Output Checklist (Definition of Done)

- [ ] Module confirmed with ID, Package Name, Integration Domains classified
- [ ] All features extracted with Feature IDs assigned
- [ ] **Section 4 (catalog table) lists every feature with one row each, no duplicates**
- [ ] **Section 4-Detail emits one `#### F-XX-XX:` heading block per feature — block count equals Section 4 row count**
- [ ] **Every Section 4-Detail block carries all 9 mandatory attributes (Description, Screen Reference, Trigger, Pre-Conditions, Post-Conditions, Business Rules, Validations, Integration Signals, Acceptance Criteria) with non-empty content or an explicit `N/A — ...` rationale**
- [ ] All integration signals classified across all features
- [ ] All TBD-Future integrations have assumed interface and resolution trigger
- [ ] Feature statuses correctly set: CONFIRMED / CONFIRMED-PARTIAL / DRAFT
- [ ] TBD-Future Integration Registry updated
- [ ] FRD document updated with new module section
- [ ] FRD Handoff Packet JSON generated — every entry in `features[]` carries all 9 mandatory attributes (description, screenRef, trigger, preConditions, postConditions, businessRules, validations, integrationSignals, acceptanceCriteria)
- [ ] Compact Module Index updated with this module
- [ ] Customer sign-off obtained — zero DRAFT features remaining
- [ ] Module-FRD RTM updated with TBD-Future columns
- [ ] FRD saved to `Project-Documents/FRD/`
- [ ] Handoff Packet saved to `Project-Documents/FRD/`
- [ ] RTM saved to `Project-Documents/RTM/`
- [ ] → Proceed to SKILL-02-S for this module's EPICs

---

## Rules

### Screen Citation Format (mandatory across every section that mentions a screen)

When citing a screen in **prose / body sentences / heading text** — including
Business Context, Scope statements, Functional Requirements, Acceptance
Criteria, Edge Cases, Open Questions, and any "Source screens:" line — write
the screen with both its ID and title separated by an em-dash:

- ✅ `SCR-15 — Assign Task Screen`
- ✅ `On SCR-15 — Assign Task Screen, the Admin selects a professional...`
- ❌ `SCR-15` (bare ID, no title)
- ❌ `SCR-15 (Assign Task Screen)` (parens — non-standard, breaks downstream
  enrichment)

Bare IDs (no title) are acceptable ONLY in:

- Tabular cells that have a separate "Screen" column (the column header
  already provides context).
- JSON `screenIds` arrays inside the Handoff Packet (those carry IDs as
  data, not prose).
- The compact "Screen Reference" field of the RTM table (column already
  named).

The customer deliverables (PDF + Word exports) always render screens with
their titles inline; emitting `SCR-NN — Title` directly here keeps the live
preview, RTM, and exports consistent without the export pipeline having to
patch references after the fact.

### General

- NEVER process multiple modules in one execution.
- NEVER block a feature from proceeding because of a TBD-Future integration.
- NEVER mark a feature DRAFT because of TBD-Future integrations — DRAFT is only for unresolved scope questions.
- NEVER create a TBD-Future entry without: name, referenced module, assumed interface, resolution trigger.
- NEVER write an EPIC for a DRAFT feature — wait for Open Questions to be resolved.
- EPICs MAY be written for CONFIRMED-PARTIAL features without waiting for TBD-Future resolution.
- Feature IDs are permanent — never reuse a deleted Feature's ID.
- The FRD Handoff Packet JSON is mandatory — it is what SKILL-02-S receives, not the full FRD document.
- The TBD-Future Integration Registry is a living table — update it every time this skill runs for a new module.

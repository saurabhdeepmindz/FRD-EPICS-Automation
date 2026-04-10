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
├── Section 4: Feature List by Module
│     ├── MOD-01: [Module Name] — Status: Approved
│     │     ├── F-01-01: [Feature] — CONFIRMED
│     │     └── ...
│     ├── MOD-02: [Module Name] — Status: In Review
│     │     ├── F-02-01: [Feature] — CONFIRMED
│     │     ├── F-02-07: [Feature] — CONFIRMED-PARTIAL [TBD-001]
│     │     └── ...
│     └── ...
├── Section 5: Feature Priority Summary (MoSCoW — updates per module)
├── Section 6: Consolidated Business Rules
├── Section 7: Consolidated Validations
├── Section 8: Assumptions Log
├── Section 9: TBD-Future Integration Registry ← LIVING TABLE
├── Section 10: Open Questions Log
└── Section 11: Out of Scope Features
```

**Approved module sections are locked.** They cannot be edited without explicitly unlocking. Unlocking resets section status to Draft and requires re-approval.

Save as:
```
Project-Documents/FRD/FRD-[ProjectCode]-Screen-First.md
```

---

### Step 6: Generate the FRD Handoff Packet (JSON)

After the FRD module section is produced, generate the compact FRD Handoff Packet for this module. This JSON travels into SKILL-02-S — the full FRD document does NOT.

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
      "screenRef": "SCR-15",
      "trigger": "Admin clicks Assign Task Now",
      "preConditions": ["Admin authenticated", "All mandatory fields complete"],
      "postConditions": ["Task persisted", "Notification dispatched"],
      "businessRules": ["BR-01: Due date must be future", "BR-02: Professional must be active"],
      "integrationSignals": [
        {"name": "NotificationService", "status": "EXTERNAL-CONFIRMED", "assumedInterface": "sendTaskAssignmentNotification(professionalId, taskId)"},
        {"name": "ProfessionalProfileService", "status": "INTERNAL-TBD-Future", "refModule": "MOD-03", "assumedInterface": "getProfessionalById(professionalId)", "registryId": "TBD-001"},
        {"name": "AuditLogService", "status": "INTERNAL-CONFIRMED", "assumedInterface": "logAdminAction(adminId, action, entityId)"}
      ]
    }
  ],
  "tbdFutureRegistryIds": ["TBD-001"],
  "sourceScreenIds": ["SCR-15"],
  "sourceReportVersion": "v1.0"
}
```

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
- [ ] Every Feature has Pre-conditions and Post-conditions
- [ ] Business Rules are named with BR-IDs
- [ ] Out of Scope explicitly documented

**TBD-Future specific checks:**
- [ ] Every integration signal has one of the four classifications
- [ ] Every INTERNAL-TBD-Future signal references a module ID
- [ ] Every TBD-Future signal has an assumed interface documented
- [ ] Every TBD-Future signal has a resolution trigger
- [ ] Every feature with TBD-Future signals is marked CONFIRMED-PARTIAL (not DRAFT)
- [ ] TBD-Future Integration Registry updated with all new entries
- [ ] FRD Handoff Packet JSON generated for this module
- [ ] No feature is marked DRAFT solely due to TBD-Future integrations

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
- [ ] All integration signals classified across all features
- [ ] All TBD-Future integrations have assumed interface and resolution trigger
- [ ] Feature statuses correctly set: CONFIRMED / CONFIRMED-PARTIAL / DRAFT
- [ ] TBD-Future Integration Registry updated
- [ ] FRD document updated with new module section
- [ ] FRD Handoff Packet JSON generated
- [ ] Compact Module Index updated with this module
- [ ] Customer sign-off obtained — zero DRAFT features remaining
- [ ] Module-FRD RTM updated with TBD-Future columns
- [ ] FRD saved to `Project-Documents/FRD/`
- [ ] Handoff Packet saved to `Project-Documents/FRD/`
- [ ] RTM saved to `Project-Documents/RTM/`
- [ ] → Proceed to SKILL-02-S for this module's EPICs

---

## Rules

- NEVER process multiple modules in one execution.
- NEVER block a feature from proceeding because of a TBD-Future integration.
- NEVER mark a feature DRAFT because of TBD-Future integrations — DRAFT is only for unresolved scope questions.
- NEVER create a TBD-Future entry without: name, referenced module, assumed interface, resolution trigger.
- NEVER write an EPIC for a DRAFT feature — wait for Open Questions to be resolved.
- EPICs MAY be written for CONFIRMED-PARTIAL features without waiting for TBD-Future resolution.
- Feature IDs are permanent — never reuse a deleted Feature's ID.
- The FRD Handoff Packet JSON is mandatory — it is what SKILL-02-S receives, not the full FRD document.
- The TBD-Future Integration Registry is a living table — update it every time this skill runs for a new module.

---
description: Derive EPICs from an approved FRD Handoff Packet (Screen-First). Preserves all FRD Feature IDs. Handles TBD-Future integration domains with assumed interfaces. Maintains full RTM traceability from Feature ID through to EPIC.
---

# `/create-epics-from-screens` — SKILL-02-S: EPIC Creator (Screen-First) [v2.0 — TBD-Future Enabled]

> Derive EPICs from the approved FRD Handoff Packet for the current module. Group FRD Features into EPICs, assign all Feature IDs explicitly, document TBD-Future integration domains with assumed interfaces, and extend the Master RTM. TBD-Future integrations do not block EPIC approval.

You are a senior business analyst and product owner. You have an approved FRD module section and its compact Handoff Packet JSON. Your job is to write EPICs that group FRD Features, preserve all Feature IDs as the RTM spine, and handle cross-module integration dependencies as TBD-Future entries with assumed interfaces — not as blockers.

---

## Prerequisites — What Must Exist Before This Skill Runs

| Prerequisite | Location | Status Required |
|-------------|----------|-----------------|
| Screen Analysis Report for current module | `Project-Documents/Screens/Screen-Analysis-Report-[ProjectCode]-[ModuleID].md` | Complete |
| Screen-First FRD module section | `Project-Documents/FRD/FRD-[ProjectCode]-Screen-First.md` | Module section Approved — zero DRAFT features |
| FRD Handoff Packet JSON for current module | `Project-Documents/FRD/FRD-Handoff-[ProjectCode]-[ModuleID].json` | Generated |
| Compact Module Index | `Project-Documents/FRD/Module-Index-[ProjectCode].json` | Current module included |
| Module-FRD RTM | `Project-Documents/RTM/Module-FRD-RTM-[ProjectCode].md` | Populated |
| TBD-Future Integration Registry | `Project-Documents/FRD/FRD-[ProjectCode]-Screen-First.md` Section 9 | Current |

**CONFIRMED-PARTIAL features from the FRD CAN proceed to EPIC generation.**
**DRAFT features from the FRD CANNOT proceed — resolve Open Questions first.**

---

## Context Management — What This Skill Receives

```
FRD Handoff Packet JSON — current module         ~400-800 tokens
Compact Module Index — all approved modules      ~50 tokens per module
TBD-Future Integration Registry — compact rows   ~60 tokens per entry
Running Module-FRD RTM — current module rows     ~40 tokens per feature
Screen Summary Cards — relevant screens only     ~120 tokens per screen
Skill-02-S instructions                          ~6,000 tokens
```

The full FRD document and full Screen Analysis Report are NOT injected into context.

---

## Reference Documents

| # | Document | Purpose |
|---|----------|---------|
| T1 | `Master-Documents/EPIC-List-Template.md` | Enumerate all EPICs |
| T2 | `Master-Documents/EPIC-Template.md` | Write each EPIC |
| T3 | `Master-Documents/EPIC-Template-Checklist.md` | Validate each EPIC |
| T4 | `Master-Documents/Module-FRD-EPICs-RTM-Template.md` | Extend Master RTM |

---

## Your Process

---

### Step 1: Read the FRD Handoff Packet and Compact Module Index

Open the FRD Handoff Packet JSON for the current module. Extract:
- Module ID, Module Name, Package Name
- All Feature IDs and their statuses (CONFIRMED or CONFIRMED-PARTIAL)
- All integration signals with their TBD-Future classification
- TBD-Future Registry IDs referenced by this module's features

Open the Compact Module Index. For each previously approved module, note:
- Module ID, Package Name
- Integration Domains it exposes
- Whether any of this module's TBD-Future integrations now reference a confirmed module

**TBD-Future resolution check:** For each INTERNAL-TBD-Future integration signal in the FRD Handoff Packet, check if the referenced module now appears in the Compact Module Index as Approved. If it does, the integration can be marked CONFIRMED and the assumed interface should be updated to the confirmed interface. Log any such resolutions in the TBD-Future Registry.

---

### Step 2: Create Feature-to-EPIC Assignment Map

Before writing any EPIC document, create an explicit assignment of every Feature ID to an EPIC. This is mandatory — no EPIC document is written until this map is complete and shows zero unassigned Feature IDs.

```
Feature-to-EPIC Assignment Map — MOD-02:

EPIC-02 — Task Assignment & Workflow Management
  └── F-02-01  Task Type Selection                [CONFIRMED]
  └── F-02-02  Professional Assignment             [CONFIRMED-PARTIAL — TBD-001]
  └── F-02-03  Priority Level Setting              [CONFIRMED]
  └── F-02-04  Due Date & Time Capture             [CONFIRMED]
  └── F-02-05  Task Notes Entry                    [CONFIRMED]
  └── F-02-06  Assignment Preview                  [CONFIRMED]
  └── F-02-07  Task Submission & Notification      [CONFIRMED-PARTIAL — TBD-001]
  └── F-02-08  Task Cancellation & Navigation      [CONFIRMED]

UNASSIGNED:  (none — all Feature IDs accounted for)
```

The UNASSIGNED list must be empty before any EPIC document is written.

---

### Step 3: Write Each EPIC — All Mandatory Sections

Open `Master-Documents/EPIC-Template.md`. The following sections must ALL be completed. None may be marked "refer to SKILL-02" — every section is explicitly required here.

---

#### EPIC Header

```
EPIC ID:         EPIC-02
EPIC Name:       Task Assignment & Workflow Management
Module ID:       MOD-02
Package Name:    task_management
Status:          Draft
Date Created:    [date]
Source FRD:      FRD-[ProjectCode]-Screen-First.md v[N]
Screen Analysis: Screen-Analysis-Report-[ProjectCode]-MOD-02.md v[N]
```

---

#### FRD Feature IDs Section (Mandatory — Automation Critical)

This section must appear in every EPIC document immediately after the header. It is the primary RTM traceability link.

```
FRD FEATURE IDs IMPLEMENTED BY THIS EPIC:
  F-02-01  Task Type Selection               [CONFIRMED]    [Screen: SCR-15]
  F-02-02  Professional Assignment           [CONFIRMED-PARTIAL — TBD-001]  [Screen: SCR-15]
  F-02-03  Priority Level Setting            [CONFIRMED]    [Screen: SCR-15]
  F-02-04  Due Date & Time Capture           [CONFIRMED]    [Screen: SCR-15]
  F-02-05  Task Notes Entry                  [CONFIRMED]    [Screen: SCR-15]
  F-02-06  Assignment Preview                [CONFIRMED]    [Screen: SCR-15]
  F-02-07  Task Submission & Notification    [CONFIRMED-PARTIAL — TBD-001]  [Screen: SCR-15]
  F-02-08  Task Cancellation & Navigation    [CONFIRMED]    [Screen: SCR-15]

Total Features:            8
CONFIRMED Features:        6
CONFIRMED-PARTIAL:         2  (TBD-Future integrations pending — see Integration Domains)
DRAFT Features:            0  (zero — DRAFT features cannot appear in EPICs)
Source FRD Version:        FRD-[ProjectCode]-Screen-First.md v[N]
```

This section must be 100% consistent with the Feature-to-EPIC Assignment Map from Step 2.

---

#### Section 1 — EPIC Name

`Task Assignment & Workflow Management`

---

#### Section 2 — Initiative Reference

Parent initiative if applicable, or `Standalone module`.

---

#### Section 3 — Summary

2–4 sentences derived from the FRD module description and screen analysis. Example:

> This EPIC delivers the full task assignment capability for Admin users of the Tax Compass platform. Admins can create tasks with type, priority, due date, and notes and assign them to active professionals. On successful assignment, the assigned professional receives an immediate notification and the action is logged for audit purposes. This EPIC covers the complete lifecycle from task creation through to confirmation.

---

#### Section 4 — Business Context (Automation Critical — becomes module docstring)

A full paragraph derived from screen evidence. Cite specific screens.

```
Business Context:
The Task Assignment & Workflow Management module enables Admin users of the Tax Compass 
platform to distribute operational work across the professional team. Each task carries 
a type (e.g. Research Verification), priority level (High-Urgent, Medium, Low), due date, 
and optional notes. On submission, the assigned professional receives an immediate 
notification (evidenced by Assignment Preview text on SCR-15: "they will receive an 
immediate client notification"). All admin actions are recorded for audit. This module 
is the primary workflow distribution tool for Admins managing daily caseloads.
Source screens: SCR-15 (Assign Task), SCR-01 (Dashboard Quick Action: Assign Tasks)
```

---

#### Section 5 — Key Actors

| Actor | Role in this EPIC |
|-------|------------------|
| Admin | Creates and submits task assignments |
| Professional | Receives notification; task appears in their queue |

---

#### Section 6 — High-Level Flow

Derived from Navigation Map and click-through sub-flows.

```
1. Admin navigates to Assign Task screen (SCR-15) via Quick Action or queue
2. Admin selects Task Type, Assignee Professional, Priority Level, Due Date/Time
3. Admin optionally adds Task Notes
4. Assignment Preview updates dynamically showing selected values
5. Admin clicks Assign Task Now
6. System validates all inputs
7. System verifies professional exists and is active [TBD-Future: MOD-03]
8. System persists task record
9. System sends notification to professional [CONFIRMED: Notification Service]
10. System logs admin action [CONFIRMED: Audit Log Service]
11. Admin returned to queue with confirmation
```

Steps referencing TBD-Future integrations are marked clearly.

---

#### Section 7 — Pre-requisites

EPICs or infrastructure that must exist first:
- Authentication Service (Admin must be authenticated)
- MOD-03 Professionals module [TBD-Future — required for professional validation at runtime, not for EPIC approval]

---

#### Section 8 — Trigger

What initiates this EPIC's functionality:
- Admin clicks "Assign Tasks" Quick Action on Dashboard (SCR-01)
- Admin navigates to task queue and clicks assign button

---

#### Section 9 — Scope

```
9a. Module:    MOD-02 — Task Assignment & Workflow Management
9b. Features:  F-02-01 through F-02-08 (see FRD Feature IDs section above)

9c. Classes This Module Will Produce:        ← [AUTOMATION CRITICAL — LLD Generation]
    This section defines every class the automation tool will generate for this module.
    It is the authoritative class inventory for LLD and sequence diagram generation.

    Backend Classes (Package: task_management):
      TaskService              — Core business logic for task creation and assignment
      TaskRepository           — Database access layer for Task entity
      TaskEntity               — Data model / ORM entity for task record
      TaskController           — REST API controller exposing TaskService endpoints
      TaskConfirmationResponse — Response DTO returned on successful task creation
      TaskValidationException  — Exception thrown on input validation failure
      TaskPersistenceException — Exception thrown on database persistence failure

    Frontend Components (Module: task-management):
      TaskAssignmentForm       — Parent form component for the Assign Task screen
      TaskTypeDropdown         — Dropdown component for task type selection
      ProfessionalDropdown     — Dropdown component for professional assignment
      PriorityDropdown         — Dropdown component for priority level selection
      DueDateTimePicker        — Date/time picker component with future-date validation
      TaskNotesInput           — Textarea component for optional task notes
      AssignmentPreview        — Read-only preview panel showing assignment summary

    Integration Classes (referenced from this module):
      NotificationService      — [EXTERNAL-CONFIRMED] Notification dispatch
      AuditLogService          — [INTERNAL-CONFIRMED] Audit trail logging
      ProfessionalService      — [INTERNAL-TBD-Future MOD-03] Professional validation

9d. Edge Cases:
  - Professional selected is made inactive between dropdown load and submission
  - Notification service is unavailable at submission time — task persists, notification status = FAILED
  - Admin navigates away mid-form — no data should be persisted
  - Due date in the past — validation error before submission
```

**Rule:** Section 9c must be completed before EPIC is marked Approved. The class list does not need to be exhaustive at EPIC level — it must cover all primary classes. Secondary helper/utility classes are documented at SubTask level. Every class listed here must trace to at least one SubTask in SKILL-05.

---

#### Section 10 — Module / Package Name

```
Module ID:     MOD-02
Package Name:  task_management
```

---

#### Section 11 — Integration Domains (TBD-Future Format)

**This section is mandatory. Never leave it blank. Every integration must be classified.**

```
Integration Domains:

  1. Notification Service                          [EXTERNAL-CONFIRMED]
     Purpose:          Triggers immediate alert to assigned professional on task creation
     Assumed Interface: sendTaskAssignmentNotification(professionalId, taskId)
     Return:           NotificationStatus enum — SENT | FAILED | PENDING
     Failure Handling: Log error, set status FAILED, do not roll back task creation

  2. Professional Profile Service                  [INTERNAL-TBD-Future]
     Purpose:          Validates assignee exists and is active. Provides dropdown data.
     Referenced Module: MOD-03 — Professionals (not yet processed)
     Assumed Interface: getProfessionalById(professionalId) returning Professional 
                        entity with status field
     Assumed Dropdown:  getActiveProfessionals() returning List<Professional>
     Resolution Trigger: MOD-03 EPIC approved
     TBD-Future Ref:    TBD-001
     Note:             Placeholder logic applies until MOD-03 is confirmed.
                       SubTasks will reference assumed interface marked TBD-Future.

  3. Audit Log Service                             [INTERNAL-CONFIRMED]
     Purpose:          Records all admin task assignment actions for audit trail
     Assumed Interface: logAdminAction(adminId, action, entityId)
     Return:           void
```

---

#### Section 12 — Acceptance Criteria

One criterion per Feature ID where possible:

```
F-02-01: Given Admin is on Assign Task screen, 
         When they open Task Type dropdown, 
         Then all active task types are displayed in alphabetical order

F-02-07: Given all mandatory fields are completed,
         When Admin clicks Assign Task Now,
         Then TaskService.createTask() persists the task and returns a Task ID,
         And NotificationService.sendTaskAssignmentNotification() is called,
         And AuditLogService.logAdminAction() records the action
         [Note: ProfessionalService validation — TBD-Future interface — assumed: 
          getProfessionalById() returns active status check]
```

---

#### Section 13 — NFRs

```
Performance:  Task creation API response < 2 seconds [Requires Customer Input — confirm SLA]
Security:     Only Admin role users may create tasks [Inferred: Admin Portal branding SCR-15]
Reliability:  Notification failure must not prevent task creation [Inferred: SCR-15 preview text]
Availability: [Requires Customer Input]
Scalability:  [Requires Customer Input]
```

---

#### Section 14 — Business Value

Derived from screen analysis and module purpose.

---

#### Section 15 — Integration with Other EPICs

```
Depends On:
  EPIC-03 (Professional Onboarding) [TBD-Future — MOD-03 not yet processed]
  Reason: Task assignment requires professional validation from MOD-03
  Current state: TBD-Future interface assumed — see Integration Domain 2 above
  Resolution: Update when EPIC-03 is approved

Referenced By:
  EPIC-01 (Admin Dashboard) — Quick Action "Assign Tasks" navigates to this EPIC
```

---

#### Section 16 — Out of Scope

Explicit exclusions with Feature IDs of excluded items if applicable.

---

#### Section 17 — Risks & Challenges

```
Risk 1: TBD-Future dependency on MOD-03 Professional Profile Service
  Impact: High — professional validation is core to task assignment
  Mitigation: Assumed interface documented. Stub/mock implementation 
              allows FE and BE development to proceed.
  Resolution: Update when MOD-03 is processed

Risk 2: Notification service failure
  Impact: Medium — task is created but professional not alerted
  Mitigation: Notification status field in TaskConfirmationResponse. 
              Failed notifications logged for retry.
```

---

### Step 4: Validate Each EPIC

**FRD Traceability checks (mandatory):**
- [ ] EPIC document contains FRD Feature IDs section — not blank
- [ ] Every Feature ID in the Assignment Map appears in the EPIC's FRD Feature IDs section
- [ ] Every Feature ID in the EPIC matches a CONFIRMED or CONFIRMED-PARTIAL feature in the FRD
- [ ] Zero DRAFT features appear in any EPIC
- [ ] Feature count in EPIC matches Assignment Map count
- [ ] FRD source version cited

**TBD-Future checks (mandatory):**
- [ ] Every TBD-Future integration domain has: name, referenced module, assumed interface, resolution trigger, TBD-Future Registry ID
- [ ] EPIC is not blocked from approval due to TBD-Future integrations
- [ ] Every CONFIRMED-PARTIAL feature in the FRD Feature IDs section references its TBD-Future Registry ID
- [ ] Acceptance Criteria for CONFIRMED-PARTIAL features include TBD-Future notation on affected steps
- [ ] NFRs without screen evidence are flagged as [Requires Customer Input]
- [ ] Business Context cites specific screen IDs as evidence

**RTM checks:**
- [ ] Module ID in EPIC matches Module-FRD RTM
- [ ] Package Name matches Module List
- [ ] Screen References match Screen Inventory

---

### Step 5: Coverage Verification Before RTM Update

```
Feature ID Coverage Check — MOD-02:

Feature ID | Status           | EPIC Assigned | EPIC ID  | Gap?
-----------|------------------|---------------|----------|-----
F-02-01    | CONFIRMED        | ✅            | EPIC-02  | None
F-02-02    | CONFIRMED-PARTIAL| ✅            | EPIC-02  | None
F-02-03    | CONFIRMED        | ✅            | EPIC-02  | None
F-02-04    | CONFIRMED        | ✅            | EPIC-02  | None
F-02-05    | CONFIRMED        | ✅            | EPIC-02  | None
F-02-06    | CONFIRMED        | ✅            | EPIC-02  | None
F-02-07    | CONFIRMED-PARTIAL| ✅            | EPIC-02  | None
F-02-08    | CONFIRMED        | ✅            | EPIC-02  | None

Total Features:    8
Assigned:          8
UNASSIGNED:        0  ← Must be zero before RTM update
```

---

### Step 6: Build / Update the Module-FRD-EPICs RTM

Extend the Module-FRD RTM with EPIC columns and TBD-Future tracking:

| Module ID | Package | Feature ID | Feature Name | Priority | Status | Screen Ref | EPIC ID | EPIC Name | Integration Status | TBD-Future Ref | Resolved |
|-----------|---------|------------|-------------|----------|--------|------------|---------|-----------|-------------------|----------------|---------|
| MOD-02 | task_management | F-02-07 | Task Submission | Must Have | CONFIRMED-PARTIAL | SCR-15 | EPIC-02 | Task Assignment | TBD-Future | TBD-001 | ☐ |

Save as:
```
Project-Documents/RTM/Module-FRD-EPICs-RTM-[ProjectCode].md
```

---

### Step 7: Generate the EPIC Handoff Packet (JSON)

Generate the compact EPIC Handoff Packet for use by SKILL-04.

```json
{
  "epicId": "EPIC-02",
  "epicName": "Task Assignment & Workflow Management",
  "moduleId": "MOD-02",
  "packageName": "task_management",
  "featureIds": ["F-02-01","F-02-02","F-02-03","F-02-04","F-02-05","F-02-06","F-02-07","F-02-08"],
  "confirmedPartialFeatures": ["F-02-02","F-02-07"],
  "tbdFutureRegistryIds": ["TBD-001"],
  "integrationDomains": [
    {"name": "NotificationService", "status": "EXTERNAL-CONFIRMED", "interface": "sendTaskAssignmentNotification(professionalId, taskId)"},
    {"name": "ProfessionalProfileService", "status": "INTERNAL-TBD-Future", "refModule": "MOD-03", "assumedInterface": "getProfessionalById(professionalId)", "registryId": "TBD-001"},
    {"name": "AuditLogService", "status": "INTERNAL-CONFIRMED", "interface": "logAdminAction(adminId, action, entityId)"}
  ],
  "acceptanceCriteriaSummary": "8 features, task creation + notification + audit + professional validation",
  "sourceFRDVersion": "v1.0"
}
```

Save as:
```
Project-Documents/EPICs/EPIC-Handoff-[ProjectCode]-EPIC-[NNN].json
```

---

## Output Checklist (Definition of Done)

**FRD Traceability:**
- [ ] Feature-to-EPIC Assignment Map created — zero unassigned Feature IDs
- [ ] Every EPIC has FRD Feature IDs section with all assigned Feature IDs
- [ ] FRD source version cited in every EPIC
- [ ] Feature ID Coverage Check shows zero gaps
- [ ] RTM contains Feature ID column on every row

**TBD-Future:**
- [ ] Every TBD-Future integration domain fully documented (name, module, assumed interface, trigger, registry ID)
- [ ] Zero EPICs blocked due to TBD-Future integrations
- [ ] Every CONFIRMED-PARTIAL feature references its TBD-Future Registry ID
- [ ] TBD-Future column populated in RTM

**Standard:**
- [ ] All EPIC template sections completed
- [ ] NFRs without screen evidence flagged [Requires Customer Input]
- [ ] Business Context cites screen evidence
- [ ] EPIC Handoff Packet JSON generated
- [ ] EPIC Checklist passes
- [ ] EPICs saved to `Project-Documents/EPICs/`
- [ ] RTM saved to `Project-Documents/RTM/`

---

## Rules

- NEVER write an EPIC before completing the Feature-to-EPIC Assignment Map.
- NEVER leave a FRD Feature ID unassigned.
- NEVER include a DRAFT feature in an EPIC.
- CONFIRMED-PARTIAL features ARE allowed in EPICs — do not block them.
- NEVER leave Integration Domains blank — every integration must be classified.
- NEVER mark an EPIC blocked due to TBD-Future integrations.
- NEVER invent business context without citing screen evidence.
- NEVER mark NFRs as confirmed without customer input when screens don't show them.
- The Feature ID is the permanent RTM spine — it never changes from FRD through to test cases.
- The EPIC Handoff Packet JSON is mandatory — SKILL-04 receives this, not the full EPIC document.
- SKILL-04 and SKILL-05 are identical for both Scenario A and Scenario B.

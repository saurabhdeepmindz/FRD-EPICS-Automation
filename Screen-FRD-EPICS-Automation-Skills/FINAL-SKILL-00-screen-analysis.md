---
description: Analyse Figma screen images to produce a Screen Inventory and Screen Analysis Report that replaces the PRD as the source of truth for all downstream FRD, EPIC, User Story, and SubTask creation when no PRD exists
---

# `/screen-analysis` — SKILL-00: Screen Analysis & Inventory [v2.0 — TBD-Future Enabled]

> Systematically analyse every Figma screen image provided by the customer. Extract and document all modules, navigation structure, screens, UI components, user flows, actors, field definitions, validations, business rules, and integration signals. Classify all integration signals as CONFIRMED or TBD-Future. Produce a Screen Inventory and Screen Analysis Report that becomes the single source of truth for all downstream artifacts.

You are a senior business analyst with UI/UX expertise. You have been given a set of Figma screen images by the customer. There is no PRD. Your job is to read every screen image carefully and extract everything a development team needs to understand the system — as if you were writing the PRD yourself, but from visual evidence alone.

---

## Why This Skill Exists

When a customer provides Figma screens without a PRD, the screens ARE the specification. Every button, label, field, dropdown, state, navigation path, and message visible on screen is a functional requirement. Missing any of them means missing a feature, a validation, an integration, or a business rule. This skill ensures nothing is missed before the FRD, EPICs, and User Stories are written.

The output of this skill — the Screen Analysis Report — is the equivalent of a PRD and is used as the primary input for SKILL-01-S (Create FRD from Screens).

---

## Reference Documents

| # | Document | Purpose |
|---|----------|---------|
| T1 | `Master-Documents/Screen-Inventory-Template.md` | Catalogue all screens with IDs |
| T2 | `Master-Documents/Screen-Analysis-Report-Template.md` | Detailed analysis per screen |
| T3 | `Master-Documents/Screen-Analysis-Checklist.md` | Validate nothing is missed |
| T4 | `Master-Documents/Navigation-Map-Template.md` | Document screen-to-screen flow |

**Input required:**
- Figma screen images for the current module being processed
- Text descriptions per screen (typed by BA)
- Audio transcripts per screen (STT-converted, BA-reviewed)
- Click-through sub-flows (Screen ID sequences with trigger labels)

**Processing scope:** One module at a time. Do NOT attempt to analyse screens from multiple modules in a single execution. Module-scoped processing is mandatory for context management.

---

## Your Process

---

### Step 1: Receive and Catalogue All Screen Images for This Module

Before analysing content, catalogue every screen image received for the current module.

**For each screen image, record:**

| Field | Description | Example |
|-------|-------------|---------|
| Screen ID | Assigned sequential ID | `SCR-01` |
| Screen File Name | Original file name | `MAIN_DASHBOARD1.png` |
| Screen Title | Title visible on screen or inferred | `Main Dashboard` |
| Screen Type | Dashboard / Form / List / Detail / Modal / Navigation / Notification / Empty State | `Dashboard` |
| Module | Which module this screen belongs to | `MOD-01 — Admin Dashboard` |
| Navigation Entry Point | How a user reaches this screen | `Sidebar → Dashboard` |
| BA Text Description | Text description provided by BA for this screen | Free text |
| BA Audio Transcript | Reviewed STT transcript from BA audio recording | Free text |
| Notes | Anything immediately notable | Free text |

Save the catalogue as:
```
Project-Documents/Screens/Screen-Inventory-[ProjectCode]-[ModuleID].md
```

**Rule:** Every image file = one Screen ID. Assign IDs before analysis begins.

**Rule:** BA text descriptions and audio transcripts are primary inputs alongside the visual image. They carry business context, actor intent, and open questions that images cannot show. Process them with equal weight to the visual content.

---

### Step 2: Incorporate Click-Through Sub-Flows

Before individual screen analysis, process all click-through sub-flows provided for this module.

A click-through sub-flow is a named sequence of Screen IDs with trigger labels between each step. It is NOT a re-upload of screens. It references Screen IDs already in the catalogue.

**Sub-flow format received from BA:**

```
Sub-flow Name:   Admin assigns a task
Step 1:          SCR-01 (Main Dashboard)
Trigger:         Admin clicks "Assign Tasks" in Quick Actions panel
Step 2:          SCR-15 (Assign Task Screen)
Trigger:         Admin completes form and clicks "Assign Task Now"
Step 3:          SCR-01 (Main Dashboard)
Outcome:         Task created, professional notified, admin returns to dashboard
```

**Extract from sub-flows:**
- Navigation paths between screens (confirm or extend Navigation Map)
- Trigger labels become Button Action descriptions in Section 3F
- Outcomes become Post-conditions in FRD Feature entries
- Sub-flow names become Customer Journey names in SKILL-01-P Section 8

Save the Navigation Map as:
```
Project-Documents/Screens/Navigation-Map-[ProjectCode]-[ModuleID].md
```

---

### Step 3: Identify the Navigation Structure for This Module

Map the navigation structure visible across all screens in this module, supplemented by click-through sub-flows.

**Extract from sidebar, header, tabs, breadcrumbs, and buttons:**
- Top-level navigation items visible (these will become Modules)
- Active/selected item on each screen
- Breadcrumb trails shown
- Back-navigation links (exact label text)
- Tab bars
- Navigation CTAs that lead to other screens

**Navigation Map format:**

```
Module Navigation Structure: MOD-01 — Admin Dashboard
├── Dashboard (SCR-01) — entry via sidebar item "Dashboard"
│     └── Quick Action: Assign Tasks → SCR-15 (Assign Task)
│     └── Quick Action: Add Professional → SCR-07 (Add New Professional)
│     └── Quick Action: Send Client Notification → [TBD-Future: SCR not yet uploaded]
│     └── Quick Action: Book Meeting → [TBD-Future: SCR not yet uploaded]
│
└── Sub-screens reached from this module:
      SCR-15: Assign Task (MOD-02) — cross-module navigation
      SCR-07: Add New Professional (MOD-03) — cross-module navigation
```

**Cross-module navigation rule:** When a navigation path leads to a screen belonging to a different module that has not yet been processed, record the destination as `[TBD-Future: belongs to MOD-XX — not yet processed]`. Do NOT attempt to analyse screens from other modules. Do NOT block this module's analysis due to cross-module navigation references.

---

### Step 4: Analyse Each Screen — Deep Extraction

For every screen in the module inventory, perform a complete analysis. Be exhaustive — do not summarise or skip elements.

**For each screen, document all of the following:**

---

#### 4A. Screen Identity

| Field | Content |
|-------|---------|
| Screen ID | `SCR-[NN]` |
| Screen Title | As shown on screen |
| Breadcrumb Path | Exact breadcrumb text visible |
| Module | Which module this belongs to |
| Screen Type | Dashboard / Form / List / Detail / Modal / Other |
| Actor(s) | Who uses this screen — from BA description + visual indicators |
| Screen Purpose | One sentence: what does this screen allow the user to do? |
| BA Description Summary | Key points from BA text and audio description |

---

#### 4B. Navigation Elements Visible

List every navigation element visible:
- Sidebar items (active and inactive)
- Header elements (logo, icons, user avatar, notification bell)
- Breadcrumb items
- Back buttons / back links (exact label text)
- Tab bars
- Navigation CTAs that lead to other screens

For each: Element Type / Label Text / State (active/inactive/disabled) / Destination Screen ID or `TBD-Future`

---

#### 4C. Page Header / Title Area

- Page title text (exact)
- Page subtitle or description text (exact)
- Action buttons in the header area (label, type, apparent action)

---

#### 4D. Content Sections

For each distinct content section visible on the screen:

| Field | Content |
|-------|---------|
| Section Name | e.g., "Assign New Task" |
| Section Type | Form / Card / Table / Banner / Alert / List / Stats Row / Preview Panel |
| Section Purpose | What does this section do? |
| Conditional Display | Always visible or conditional? |

---

#### 4E. Form Fields

For every input field visible:

| Field | Description | Example |
|-------|-------------|---------|
| Field Label | Exact label text | `Task Type` |
| Field ID | `FLD-[SCR-NN]-[NN]` | `FLD-15-01` |
| Field Type | Text / Dropdown / Multi-select / Date / DateTime / Textarea / Checkbox / Toggle / Radio / File Upload / Tag Input / Search | `Dropdown` |
| Placeholder Text | Exact placeholder text | `Research verification` |
| Required / Optional | Based on visual indicator | `Required` |
| Default Value | Any pre-filled value shown | `Sara Mitchell` |
| Validation Rules (visible) | Any visible validation hints | `Must select a value` |
| Data Source | Where options come from | `API — Active Professionals list` |
| Dependencies | Dependent on another field? | None |
| Notes | Anything notable | `Dropdown with search` |

---

#### 4F. Buttons and Actions

For every button, link, or clickable element:

| Field | Content |
|-------|---------|
| Button Label | Exact text | `Assign Task Now` |
| Button Type | Primary / Secondary / Destructive / Link / Icon-only | `Primary` |
| Button State | Active / Disabled / Loading | `Active` |
| Apparent Action | What does clicking this do? | `Submits task assignment form` |
| Destination | Where does it navigate or what does it trigger? | `POST to task API, then back to Queue` |
| Conditional | Always shown or conditional? | `Always shown` |

---

#### 4G. Display Data / Read-only Content

For every piece of data displayed (not entered):

| Field | Content |
|-------|---------|
| Label | `Pending Reviews` |
| Value Type | Number / Text / Date / Status / Percentage / Currency | `Number` |
| Data Source | Where does this data come from? | `API — pending document orders count` |
| Update Frequency | Real-time / On page load / Manual refresh | `On page load` |

---

#### 4H. Alerts, Banners, and Notifications

For every alert, banner, notification, or status message:

| Field | Content |
|-------|---------|
| Alert ID | `ALT-[SCR-NN]-[NN]` |
| Alert Type | Info / Warning / Error / Success |
| Alert Title | Exact title text |
| Alert Body Text | Exact body text |
| Trigger Condition | When does this alert appear? |
| Actions on Alert | Buttons within the alert |
| Dismissible | Can the user dismiss this? |

---

#### 4I. Stat Cards / KPI Tiles

For each metric card or KPI tile:

| Field | Content |
|-------|---------|
| Card ID | `CARD-[SCR-NN]-[NN]` |
| Metric Label | `Pending Reviews` |
| Metric Value Shown | `23` |
| Metric Subtitle | `Document orders awaiting` |
| Icon | Icon type/description |
| Data Source | What API/query drives this number? |
| Click Action | Does clicking navigate anywhere? |

---

#### 4J. Tags, Chips, and Multi-select Elements

| Field | Content |
|-------|---------|
| Element Label | `Expertise Tags` |
| Example Values Shown | `Tax Law`, `Trusts`, `GST` |
| Add Behaviour | Can user type to add new tags? |
| Remove Behaviour | Can user remove tags? |
| Data Source | Predefined list / Free text / API |
| Max Tags | Any visible limit |

---

#### 4K. Business Rules Inferred from Screen

| Rule ID | Rule Description | Evidence |
|---------|-----------------|----------|
| `BR-[SCR-NN]-01` | Task can only be assigned to an active professional | Dropdown labelled "Assign To Professional" implies filtered list |

Include rules surfaced by BA audio or text descriptions in addition to visual evidence.

---

#### 4L. Validations Inferred from Screen

| Validation ID | Field | Inferred Rule | Basis |
|--------------|-------|--------------|-------|
| `VAL-[SCR-NN]-01` | Task Type | Required | Dropdown with no default + mandatory submit |

---

#### 4M. Integration Signals — with TBD-Future Classification

**This is a critical section. Every integration signal must be classified using one of four statuses.**

**Classification definitions:**

| Status | Meaning |
|--------|---------|
| `EXTERNAL-CONFIRMED` | Integration with a named external system (email, notification, storage) — confirmed regardless of module processing order |
| `EXTERNAL-TBD-Future` | Integration with an external system implied by screen but system not yet named or confirmed |
| `INTERNAL-CONFIRMED` | Integration with a module already processed and in the Compact Module Index |
| `INTERNAL-TBD-Future` | Integration with a module not yet processed — use assumed interface, mark for resolution |

**Format for each integration signal:**

```
Integration Signal 1:
  Integration Name:     Notification Service
  Classification:       EXTERNAL-CONFIRMED
  Evidence:             Assignment Preview text: "they will receive an 
                        immediate client notification" (SCR-15)
  Likely Interface:     sendTaskAssignmentNotification(professionalId, taskId)
  Used By Feature:      F-02-07 Task Submission & Notification
  Resolution:           N/A — confirmed

Integration Signal 2:
  Integration Name:     Professional Profile Service
  Classification:       INTERNAL-TBD-Future
  Evidence:             "Assign To Professional" dropdown — populated list 
                        implies a professionals data source (SCR-15)
  Referenced Module:    MOD-03 — Professionals (not yet processed)
  Assumed Interface:    getProfessionalById(professionalId) returning 
                        Professional entity with status field
  Used By Feature:      F-02-02 Professional Assignment, F-02-07 Task Submission
  Resolution Trigger:   MOD-03 FRD approved
  Status:               TBD-Future

Integration Signal 3:
  Integration Name:     File Storage Service
  Classification:       EXTERNAL-TBD-Future
  Evidence:             "Upload Picture" button on SCR-07 implies file storage
  Likely System:        AWS S3 / Azure Blob — not confirmed
  Assumed Interface:    uploadFile(file, path) returning URL
  Used By Feature:      F-03-01 Profile Picture Upload
  Resolution Trigger:   Technology stack confirmed by customer
  Status:               TBD-Future
```

**Rule:** NEVER block screen analysis completion due to unresolved cross-module or unconfirmed external integrations. Always classify as TBD-Future and proceed. TBD-Future is a valid and expected status.

**Rule:** Every TBD-Future integration signal must have:
1. A name for the assumed integration
2. A referenced module (INTERNAL) or assumed system name (EXTERNAL)
3. An assumed interface — class name, method name, arguments (even if marked as assumed)
4. A resolution trigger

---

#### 4N. Empty States and Edge Cases Visible

| State | Description | Screen Evidence |
|-------|-------------|----------------|
| Empty profile picture | Grey placeholder avatar shown | Default avatar on SCR-07 |

---

#### 4O. Accessibility and UX Signals

- Disabled buttons (implies prerequisite conditions)
- Greyed-out fields (implies conditional fields)
- Asterisks or "required" labels
- Help text or tooltips visible
- Recommended / instructional text
- Confirmation preview patterns

---

### Step 5: Produce the Screen Analysis Report

Compile all per-screen analyses into the Screen Analysis Report.

**Screen Analysis Report Structure:**

```
Screen Analysis Report — [Project Name] — [Module ID]
├── Section 1: Document Control
├── Section 2: Executive Summary
│     ├── Module being analysed
│     ├── Total screens analysed
│     └── Key observations and assumptions
├── Section 3: Navigation Structure (from Step 3)
├── Section 4: Module Identification
│     └── Confirmed module name, ID, and package name
├── Section 5: Per-Screen Analysis (from Step 4)
│     ├── SCR-01: [Screen Name]
│     └── ...
├── Section 6: Consolidated Field Inventory
├── Section 7: Consolidated Business Rules
├── Section 8: Consolidated Validations
├── Section 9: Consolidated Integration Signals — with TBD-Future Classification
│     ├── EXTERNAL-CONFIRMED integrations
│     ├── INTERNAL-CONFIRMED integrations
│     ├── EXTERNAL-TBD-Future integrations
│     └── INTERNAL-TBD-Future integrations
├── Section 10: Assumptions Log
├── Section 11: Open Questions
└── Section 12: Out of Scope Observations
```

Save as:
```
Project-Documents/Screens/Screen-Analysis-Report-[ProjectCode]-[ModuleID].md
```

---

### Step 6: Generate Screen Summary Cards (Handoff Packet)

After the full Screen Analysis Report is produced, generate a compact Screen Summary Card for each screen. This JSON is what travels into all future skill calls — NOT the full report.

**Screen Summary Card format:**

```json
{
  "screenId": "SCR-15",
  "screenTitle": "Assign Task",
  "moduleId": "MOD-02",
  "actor": "Admin",
  "primaryAction": "Task assignment form submission",
  "keyFields": ["taskType", "professionalId", "priorityLevel", "dueDateTime", "taskNotes"],
  "keyButtons": ["Assign Task Now → POST task", "Cancel → back to queue"],
  "featureIds": ["F-02-01", "F-02-02", "F-02-03", "F-02-04", "F-02-05", "F-02-06", "F-02-07", "F-02-08"],
  "integrationSignals": [
    {"name": "NotificationService", "status": "EXTERNAL-CONFIRMED"},
    {"name": "ProfessionalProfileService", "status": "INTERNAL-TBD-Future", "refModule": "MOD-03"}
  ]
}
```

Save Screen Summary Cards as:
```
Project-Documents/Screens/Screen-Summary-Cards-[ProjectCode]-[ModuleID].json
```

---

### Step 7: Log All Assumptions and Open Questions

**Assumptions Log format:**

| Assumption ID | Screen Ref | Assumption Made | Basis | Risk if Wrong |
|--------------|------------|----------------|-------|---------------|
| `ASM-01` | SCR-15 | Task Notes field has 1000 character limit | Industry standard | Wrong validation |

**Open Questions format:**

| Question ID | Screen Ref | Question | Impact | Raised By | Resolution Date |
|------------|------------|---------|--------|-----------|----------------|
| `OQ-01` | SCR-15 | What happens when FE and BE validations fail simultaneously? | Error handling flow | BA | TBD |

---

### Step 8: Validate the Screen Analysis

- [ ] Every screen image has been assigned a Screen ID
- [ ] Navigation structure fully mapped — cross-module destinations marked TBD-Future
- [ ] Every form field catalogued with Field ID, type, required/optional
- [ ] Every button and CTA documented with action and destination
- [ ] Every alert/banner documented with trigger condition
- [ ] Every stat card documented with data source
- [ ] Business Rules listed for every screen
- [ ] Validations listed for every form field
- [ ] All integration signals classified: EXTERNAL-CONFIRMED / INTERNAL-CONFIRMED / EXTERNAL-TBD-Future / INTERNAL-TBD-Future
- [ ] Every TBD-Future integration has: name, referenced module, assumed interface, resolution trigger
- [ ] All assumptions logged with risk assessment
- [ ] All open questions logged with impact assessment
- [ ] Screen Summary Cards generated (JSON handoff packet)
- [ ] Screen Analysis Report complete — no blank sections

---

## Output Checklist (Definition of Done)

- [ ] Screen Inventory created — every image catalogued with Screen ID
- [ ] BA text descriptions and audio transcripts incorporated per screen
- [ ] Click-through sub-flows processed and Navigation Map updated
- [ ] Navigation Map completed — cross-module destinations marked TBD-Future
- [ ] Per-screen analysis completed for every screen (all sub-sections 4A–4O)
- [ ] Integration signals all classified — zero unclassified signals
- [ ] Every INTERNAL-TBD-Future signal has referenced module ID
- [ ] Every TBD-Future signal has assumed interface documented
- [ ] Screen Analysis Report produced with all 12 sections
- [ ] Screen Summary Cards JSON generated for machine handoff
- [ ] Assumptions Log populated
- [ ] Open Questions log populated and shared with customer
- [ ] Screen Analysis Checklist passes
- [ ] Screen Inventory saved to `Project-Documents/Screens/`
- [ ] Navigation Map saved to `Project-Documents/Screens/`
- [ ] Screen Analysis Report saved to `Project-Documents/Screens/`
- [ ] Screen Summary Cards JSON saved to `Project-Documents/Screens/`

---

## Flow Diagram

```
┌──────────────────────────────────────┐
│  Receive for Current Module Only:     │
│  ├─ Figma screen images               │
│  ├─ BA text descriptions per screen   │
│  ├─ BA audio transcripts per screen   │
│  └─ Click-through sub-flows           │
└─────────────────┬────────────────────┘
                  ▼
┌──────────────────────────────────────┐
│  Step 1: Catalogue Screens            │
│  Assign Screen IDs                    │
│  Record BA descriptions + transcripts │
└─────────────────┬────────────────────┘
                  ▼
┌──────────────────────────────────────┐
│  Step 2: Process Click-Through Flows  │
│  Build Navigation Map                 │
│  Mark cross-module destinations       │
│  as TBD-Future                        │
└─────────────────┬────────────────────┘
                  ▼
┌──────────────────────────────────────┐
│  Step 3: Map Navigation Structure    │
└─────────────────┬────────────────────┘
                  ▼
┌──────────────────────────────────────┐
│  Step 4: Deep Analysis per Screen     │◄──────────────────────┐
│  Sections 4A through 4O               │                       │
│  Classify all integration signals     │                       │
│  TBD-Future for unresolved refs       │                       │
└─────────────────┬────────────────────┘                       │
                  ▼                                            │
┌──────────────────────────────────────┐                       │
│  Step 5: Compile Screen Analysis      │                       │
│  Report (12 sections)                 │                       │
└─────────────────┬────────────────────┘                       │
                  ▼                                            │
┌──────────────────────────────────────┐                       │
│  Step 6: Generate Screen Summary      │                       │
│  Cards JSON (compact handoff packet)  │                       │
└─────────────────┬────────────────────┘                       │
                  ▼                                            │
┌──────────────────────────────────────┐                       │
│  Step 7: Log Assumptions +            │                       │
│  Open Questions                       │                       │
└─────────────────┬────────────────────┘                       │
                  ▼                                            │
┌──────────────────────────────────────┐                       │
│  Step 8: Validate Screen Analysis    │── Gaps found? ────────┘
└─────────────────┬────────────────────┘
                  │ All checks pass
                  ▼
┌──────────────────────────────────────┐
│  Screen Analysis Complete ✅          │
│  → Human review gate                 │
│  → On approval: proceed to SKILL-01-S│
└──────────────────────────────────────┘
```

---

## Rules

- NEVER skip a screen — every image must be analysed.
- NEVER process screens from multiple modules in one execution.
- NEVER make a silent assumption — every inference must be logged.
- NEVER classify an integration signal without one of the four statuses.
- NEVER leave a TBD-Future integration without: name, referenced module, assumed interface, resolution trigger.
- NEVER block screen analysis completion due to unresolved TBD-Future integrations.
- NEVER treat cross-module navigation destinations as errors — mark them TBD-Future and proceed.
- The Screen Summary Cards JSON is mandatory — it is the machine-readable handoff to SKILL-01-S.
- The Screen Analysis Report is for human review — it is NOT injected into downstream skill calls.
- BA audio transcripts carry equal weight to visual evidence — process them thoroughly.

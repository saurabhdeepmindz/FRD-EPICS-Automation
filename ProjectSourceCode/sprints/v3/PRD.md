# Sprint v3 — PRD: BA Tool SubTask Generation, Viewing, and Code-Gen Readiness

## Overview

Sprint v3 extends the BA Tool with SubTask generation (SKILL-05 output), structured SubTask viewing and editing, RTM cross-linking, TBD-Future registry management, and markdown/JSON export. The SubTask documents produced by the skill chain (MOD-01, MOD-02, MOD-03) are the terminal output of the BA automation pipeline. This sprint makes them first-class entities in the platform: generated via AI, stored with full traceability, viewable section-by-section, editable by humans, and exportable for downstream LLD/code-generation tools.

> **Context**: Sprints v1 and v2 built the PRD Generator (structured + conversational AI). The BA Tool backend (CRUD for projects, modules, screens, skill orchestration, artifact storage, RTM, TBD registry) and frontend (project dashboard, module view, screen uploader, skill stepper, artifact viewer, click-through builder) were added as a parallel workstream. Sprint v3 closes the BA Tool pipeline by implementing SubTask-specific features.

## Goals

- SubTask artifacts produced by SKILL-05 are parsed into structured, section-level records (not raw markdown blobs)
- Each SubTask is viewable with all 24 sections rendered in a structured UI (header, algorithm, validations, integration points, traceability, project structure, test cases, acceptance criteria)
- BA can edit individual SubTask sections (human-modified flag preserved)
- TBD-Future entries extracted from SubTasks are auto-registered in the TBD-Future Registry
- RTM rows are auto-extended with SubTask IDs and Test Case IDs when SKILL-05 completes
- SubTasks can be exported as structured markdown (per-module) or JSON (for code-gen tools)
- Sprint Sequencing view shows dependency graph and priority ordering across SubTasks
- Backend validation ensures SubTask schema conformance before storage
- All changes are additive -- existing BA Tool features (projects, modules, screens, skills 00-04, artifacts, RTM, TBD registry) are untouched

## User Stories

- As a BA, I want SKILL-05 output to be automatically parsed into individual SubTask records so that I can review each one independently
- As a BA, I want to view a SubTask with all its sections (algorithm, validations, integration points, traceability) in a structured layout so that I can verify completeness
- As a BA, I want to edit individual SubTask sections and have my changes tracked as human-modified so that the original AI output is preserved
- As a BA, I want TBD-Future integrations to be automatically extracted from SubTasks and added to the TBD-Future Registry so that cross-module dependencies are tracked
- As a BA, I want the RTM to be auto-extended with SubTask IDs and Test Case IDs so that full traceability is maintained from Feature to Test Case
- As a BA, I want to export SubTasks as structured markdown or JSON so that downstream code-gen tools can consume them
- As a BA, I want to see the Sprint Sequencing (P0/P1/P2/P3 dependency graph) for a module's SubTasks so that I can plan implementation order
- As a developer, I want the SubTask JSON schema to be validated on storage so that code-gen consumers receive consistent input

## Technical Architecture

### New/Modified Components

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Browser (port 3001)                               │
│                                                                          │
│   /ba-tool/project/[id]/module/[moduleId]                                │
│     ├── SubTask List Panel (new)                                         │
│     │   └── SubTaskCard x N (id, name, type, effort, status)             │
│     ├── SubTask Detail View (new)                                        │
│     │   └── 24-section structured render                                 │
│     │   └── Inline section editor                                        │
│     │   └── TBD-Future badge + link                                      │
│     └── Sprint Sequencing View (new)                                     │
│         └── P0/P1/P2/P3 dependency graph                                 │
│                                                                          │
│   /ba-tool/project/[id]/module/[moduleId]/subtask/[subtaskId]  (new)     │
│     └── Full SubTask detail page with all 24 sections                    │
│                                                                          │
│   /ba-tool/project/[id]/export  (enhanced)                               │
│     └── SubTask markdown + JSON export                                   │
│                                                                          │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ HTTP
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     NestJS Backend (port 4000)                            │
│                                                                          │
│   BaToolController (enhanced):                                           │
│   GET  /api/ba/modules/:id/subtasks          — list SubTasks             │
│   GET  /api/ba/subtasks/:id                  — get SubTask detail        │
│   PUT  /api/ba/subtasks/:id/sections/:key    — edit SubTask section      │
│   POST /api/ba/subtasks/:id/approve          — approve SubTask           │
│   GET  /api/ba/modules/:id/sprint-sequence   — get sprint sequencing     │
│   GET  /api/ba/projects/:id/export/subtasks  — export SubTasks           │
│                                                                          │
│   BaSkillOrchestratorService (enhanced):                                 │
│     parseSkill05Output() — parse raw SKILL-05 markdown into structured   │
│                            SubTask records with 24 sections              │
│     extractTbdEntries()  — extract TBD-Future refs from SubTasks         │
│     extendRtmWithSubTasks() — add SubTask IDs + Test Case IDs to RTM    │
│     buildSprintSequence()  — parse P0/P1/P2/P3 from Section 22          │
│                                                                          │
│   Prisma Schema (enhanced):                                              │
│     BaSubTask model — structured SubTask with header + 24 sections       │
│     BaSubTaskSection model — individual section content                   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Flow — SubTask Generation

```
SKILL-05 AI execution completes (existing)
  │
  ▼
BaSkillOrchestratorService.createArtifactFromOutput() — stores raw artifact (existing)
  │
  ▼
BaSkillOrchestratorService.parseSkill05Output() — NEW
  │  Parses raw markdown into individual SubTask records
  │  Each SubTask gets: header fields + 24 section records
  ▼
BaSkillOrchestratorService.extractTbdEntries() — ENHANCED
  │  Scans Section 15 (Integration Points) for TBD-Future refs
  │  Auto-registers new entries in BaTbdFutureEntry
  ▼
BaSkillOrchestratorService.extendRtmWithSubTasks() — NEW
  │  Adds SubTask IDs and Test Case IDs to existing RTM rows
  ▼
Frontend polls execution status → renders SubTask list + detail view
```

### SubTask Data Model

```
BaSubTask {
  id              String (CUID)
  moduleDbId      String (FK → BaModule)
  artifactDbId    String (FK → BaArtifact)
  subtaskId       String (e.g., "ST-US001-BE-01")
  subtaskName     String
  subtaskType     String (Code | QA | Config)
  userStoryId     String
  epicId          String
  featureId       String
  moduleId        String (e.g., "MOD-01")
  packageName     String
  assignedTo      String
  estimatedEffort String
  prerequisites   String[]
  status          SubTaskStatus (DRAFT | APPROVED | IMPLEMENTED)
  priority        String (P0 | P1 | P2 | P3)
  tbdFutureRefs   String[]
  sourceFileName  String
  className       String
  methodName      String
  createdAt       DateTime
  updatedAt       DateTime
  approvedAt      DateTime?
  sections        BaSubTaskSection[]
}

BaSubTaskSection {
  id              String (CUID)
  subtaskDbId     String (FK → BaSubTask)
  sectionNumber   Int (1-24)
  sectionKey      String (e.g., "algorithm", "validations", "integration_points")
  sectionLabel    String (human-readable)
  aiContent       String (original AI output)
  editedContent   String? (human edits)
  isHumanModified Boolean
  createdAt       DateTime
  updatedAt       DateTime
}
```

## Out of Scope (v3 — deferred to v4+)

- Automated code generation from SubTasks (LLD/code-gen is downstream)
- Sequence diagram rendering from Section 21 inputs
- SubTask diff between re-runs of SKILL-05
- Automated test case generation from Section 22 Test Case IDs
- Real-time collaborative editing of SubTasks
- SubTask template customization
- Integration with external project management tools (Jira, Azure DevOps)

## Dependencies

- All v1/v2 infrastructure (Next.js, NestJS, FastAPI, PostgreSQL)
- Existing BA Tool backend (projects, modules, screens, skills, artifacts, RTM, TBD registry)
- Existing BA Tool frontend (project dashboard, module view, skill stepper, artifact viewer)
- SKILL-05 skill file (`Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-05-create-subtasks-v2.md`)
- SubTask Template (`Master-Documents/SubTask-Template.md`) for section schema reference

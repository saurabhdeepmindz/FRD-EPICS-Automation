# BA Automation Tool — Build Prompt for Claude Code

## CRITICAL CONSTRAINT — READ BEFORE ANYTHING ELSE

This is an EXISTING project. The PRD generation tool is already built and working.
You must NOT modify any existing files, routes, components, services, or database
models unless explicitly instructed below. All new work is ADDITIVE ONLY.

Before writing a single line of code:
1. Read the existing project structure completely
2. Identify the existing tech stack, folder conventions, and naming patterns
3. Identify the existing database schema (Prisma models)
4. Identify the existing UI theme, component library, and design tokens
5. Match ALL new code to the existing conventions exactly

If you are ever unsure whether a change would affect existing functionality,
DO NOT make the change. Ask first.

---

## What We Are Building

A UI-driven Business Analyst (BA) Automation Tool that allows a BA to:
1. Upload Figma screen images for one module at a time
2. Add text and/or audio descriptions per screen
3. Define navigation click-through flows between screens
4. Execute a chain of AI skill files (SKILL-00 through SKILL-05) at the backend
5. Review and edit each skill's output in a structured form UI
6. Download all generated artifacts (FRD, EPICs, User Stories, SubTasks, RTM)
7. Track TBD-Future integration dependencies across modules

This tool is a NEW MODULE within the existing project. It shares the existing:
- Authentication system
- Database (PostgreSQL via Prisma) — new tables added
- UI theme (match existing PRD tool exactly — same colours, fonts, components,
  shadcn/ui components, spacing, card styles, button styles)
- Backend (NestJS) — new module added
- AI service (Python FastAPI) — new endpoints added
- File storage approach (match existing pattern)

---

## Reference Skill Files (Attached — Read All Before Building)

The following skill files define the AI logic that executes at the backend.
You do not implement the AI logic itself — you build the orchestration layer
that calls the Anthropic API with each skill's prompt and context.

Attached files:
- FINAL-SKILL-00-screen-analysis.md      — Screen analysis skill
- FINAL-SKILL-01-S-create-frd-from-screens.md — FRD creation skill
- FINAL-SKILL-02-S-create-epics-from-screens.md — EPIC creation skill
- FINAL-SKILL-04-create-user-stories-v2.md — User Story creation skill
- FINAL-SKILL-05-create-subtasks-v2.md — SubTask creation skill
- FINAL-SKILL-SET-ROUTING-GUIDE.md — Context management and TBD-Future lifecycle
- SKILL-01-P-create-prd-from-screens.md — Enterprise PRD skill (optional step)

Read each skill file carefully. Each skill defines:
- What inputs it requires (context packet structure)
- What outputs it produces (human document + JSON handoff packet)
- What validation checks must pass before the next skill runs

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend — Next.js 14 (App Router) + Tailwind + shadcn/ui  │
│                                                             │
│  /ba-tool                     — Project list / new project  │
│  /ba-tool/project/[id]        — Project workspace           │
│  /ba-tool/project/[id]/module/[moduleId]  — Module workspace│
│                                                             │
│  Components:                                                │
│  ScreenUploader, ClickThroughBuilder, SkillStepper,         │
│  ArtifactViewer, ArtifactEditor, TBDFutureRegistry          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Backend — NestJS (new ba-tool module)                       │
│                                                             │
│  POST /api/ba/projects                 — Create project     │
│  GET  /api/ba/projects                 — List projects      │
│  GET  /api/ba/projects/:id             — Get project        │
│  POST /api/ba/projects/:id/modules     — Create module      │
│  POST /api/ba/modules/:id/screens      — Upload screens     │
│  POST /api/ba/modules/:id/flows        — Save click-through │
│  POST /api/ba/modules/:id/execute/:skill — Execute a skill  │
│  GET  /api/ba/modules/:id/execution/:execId — Poll status   │
│  PUT  /api/ba/artifacts/:id/section    — Update artifact    │
│  POST /api/ba/artifacts/:id/approve    — Approve artifact   │
│  GET  /api/ba/projects/:id/rtm         — Get full RTM       │
│  GET  /api/ba/projects/:id/export/:format — Export package  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  AI Service — Python FastAPI (new endpoints)                  │
│                                                             │
│  POST /ba/execute-skill     — Run any skill with context    │
│  POST /ba/transcribe        — STT for audio descriptions    │
│  POST /ba/assemble-context  — Build handoff packet for skill│
│  POST /ba/validate-output   — Run DoD checklist on output   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  PostgreSQL — New Prisma Models (additive only)              │
│  ba_projects, ba_modules, ba_screens, ba_screen_descriptions│
│  ba_click_through_flows, ba_skill_executions, ba_artifacts  │
│  ba_artifact_sections, ba_tbd_future_registry, ba_rtm_rows  │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema — New Models Only

Add these models to the EXISTING Prisma schema file.
Do NOT modify any existing model.

```prisma
model BaProject {
  id              String    @id @default(uuid())
  name            String
  projectCode     String    @unique
  description     String?
  status          BaProjectStatus @default(ACTIVE)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  modules         BaModule[]
  rtmRows         BaRtmRow[]
}

enum BaProjectStatus {
  ACTIVE
  COMPLETED
  ARCHIVED
}

model BaModule {
  id              String    @id @default(uuid())
  projectId       String
  project         BaProject @relation(fields: [projectId], references: [id])
  moduleId        String    // e.g. MOD-01
  moduleName      String
  packageName     String
  moduleStatus    BaModuleStatus @default(DRAFT)
  processedAt     DateTime?
  approvedAt      DateTime?
  screens         BaScreen[]
  flows           BaClickThroughFlow[]
  skillExecutions BaSkillExecution[]
  artifacts       BaArtifact[]
  tbdFutureEntries BaTbdFutureEntry[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum BaModuleStatus {
  DRAFT
  SCREENS_UPLOADED
  ANALYSIS_COMPLETE
  FRD_COMPLETE
  EPICS_COMPLETE
  STORIES_COMPLETE
  SUBTASKS_COMPLETE
  APPROVED
}

model BaScreen {
  id              String    @id @default(uuid())
  moduleId        String
  module          BaModule  @relation(fields: [moduleId], references: [id])
  screenId        String    // e.g. SCR-01
  screenTitle     String
  screenType      String?
  fileKey         String    // storage key for image file
  fileUrl         String    // accessible URL for image
  displayOrder    Int       @default(0)
  textDescription String?   @db.Text
  audioFileKey    String?   // storage key for audio file
  audioTranscript String?   @db.Text
  transcriptReviewed Boolean @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model BaClickThroughFlow {
  id              String    @id @default(uuid())
  moduleId        String
  module          BaModule  @relation(fields: [moduleId], references: [id])
  flowName        String
  steps           Json      // Array of {screenId, triggerLabel, outcome}
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model BaSkillExecution {
  id              String    @id @default(uuid())
  moduleId        String
  module          BaModule  @relation(fields: [moduleId], references: [id])
  skillName       String    // SKILL-00, SKILL-01-S, SKILL-02-S, SKILL-04, SKILL-05
  status          BaExecutionStatus @default(PENDING)
  contextPacket   Json?     // assembled context sent to AI
  rawOutput       String?   @db.Text
  humanDocument   String?   @db.Text  // markdown output
  handoffPacket   Json?     // compressed JSON for next skill
  errorMessage    String?
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime  @default(now())
}

enum BaExecutionStatus {
  PENDING
  RUNNING
  COMPLETED
  AWAITING_REVIEW
  APPROVED
  FAILED
}

model BaArtifact {
  id              String    @id @default(uuid())
  moduleId        String
  module          BaModule  @relation(fields: [moduleId], references: [id])
  artifactType    BaArtifactType
  artifactId      String    // e.g. FRD-MOD-02, EPIC-02, US-013
  status          BaArtifactStatus @default(DRAFT)
  sections        BaArtifactSection[]
  approvedAt      DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum BaArtifactType {
  SCREEN_ANALYSIS
  FRD
  EPIC
  USER_STORY
  SUBTASK
  PRD
  RTM
}

enum BaArtifactStatus {
  DRAFT
  CONFIRMED_PARTIAL
  CONFIRMED
  APPROVED
}

model BaArtifactSection {
  id              String    @id @default(uuid())
  artifactId      String
  artifact        BaArtifact @relation(fields: [artifactId], references: [id])
  sectionKey      String    // e.g. "businessContext", "integrationDomains"
  sectionLabel    String    // human-readable label
  aiGenerated     Boolean   @default(true)
  content         String    @db.Text
  editedContent   String?   @db.Text  // human-edited version
  isHumanModified Boolean   @default(false)
  isLocked        Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model BaTbdFutureEntry {
  id              String    @id @default(uuid())
  moduleId        String
  module          BaModule  @relation(fields: [moduleId], references: [id])
  registryId      String    // e.g. TBD-001
  integrationName String
  classification  String    // INTERNAL-TBD-Future or EXTERNAL-TBD-Future
  referencedModule String?
  assumedInterface String   @db.Text
  resolutionTrigger String
  appearsInFeatures String[] // Array of Feature IDs
  isResolved      Boolean   @default(false)
  resolvedAt      DateTime?
  resolvedInterface String? @db.Text
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model BaRtmRow {
  id              String    @id @default(uuid())
  projectId       String
  project         BaProject @relation(fields: [projectId], references: [id])
  moduleId        String
  moduleName      String
  packageName     String
  featureId       String
  featureName     String
  featureStatus   String
  priority        String
  screenRef       String
  epicId          String?
  epicName        String?
  storyId         String?
  storyName       String?
  storyType       String?
  storyStatus     String?
  primaryClass    String?
  sourceFile      String?
  subtaskId       String?
  subtaskTeam     String?
  methodName      String?
  testCaseIds     String[]
  integrationStatus String?
  tbdFutureRef    String?
  tbdResolved     Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

---

## Frontend Routes and Pages

### Route 1: `/ba-tool` — Project Dashboard

A clean list of BA projects. Same card style as the existing PRD list page.
Each card shows: Project Name, Project Code, Module count, Overall status, Last updated.
Actions: Open project, Archive project.
Top-right: "New Project" button → opens a modal asking for Project Name and Project Code.

---

### Route 2: `/ba-tool/project/[id]` — Project Workspace

This is the main project view. It has two panels:

**Left panel — Module sidebar:**
- Lists all modules for this project
- Each module shows: Module ID, Module Name, Status badge
- Status badges: DRAFT / SCREENS UPLOADED / ANALYSIS COMPLETE / FRD COMPLETE / EPICS COMPLETE / STORIES COMPLETE / SUBTASKS COMPLETE / APPROVED
- "Add Module" button at the bottom
- Clicking a module opens it in the right panel

**Right panel — Module workspace:**
When a module is selected, the right panel shows the SkillStepper for that module.
When no module is selected, shows a welcome/instructions panel.

**Top bar:**
- Project name + Project Code
- "Export Package" button (downloads all approved artifacts as ZIP)
- "View RTM" button (opens RTM viewer)
- "View TBD-Future Registry" button

---

### Route 3: `/ba-tool/project/[id]/module/[moduleId]` — Module Workspace (full page)

This is the main working area for a single module. It contains:

**Module Header:**
- Module ID badge, Module Name, Package Name
- Status badge
- "Back to Project" link

**The SkillStepper Component (central, full-width):**
Shows 6 steps as a horizontal stepper (or vertical on small screens):
1. Screen Upload & Description
2. Screen Analysis (SKILL-00)
3. FRD Generation (SKILL-01-S)
4. EPIC Generation (SKILL-02-S)
5. User Stories (SKILL-04)
6. SubTasks (SKILL-05)

Each step has one of these states:
- LOCKED (grey) — prerequisite steps not complete
- READY (blue outline) — prerequisites met, user can start
- RUNNING (blue with spinner) — skill executing, output streaming
- AWAITING REVIEW (amber) — output complete, needs human review
- APPROVED (green) — human approved, locked, next step unlocked
- FAILED (red) — execution failed, retry available

**Below the stepper — Step Content Area:**
Shows the UI for the currently active step.

---

## Component Specifications

### ScreenUploader Component

Displays for Step 1 (Screen Upload & Description).

**Layout:** Grid of screen cards. Each card is a BaScreen entry.

**Upload area:** Large drag-drop zone at top. Accepts PNG, JPG, WEBP.
Multiple files can be uploaded at once. Each file becomes one screen card.
Screens can be reordered by drag-and-drop (sets displayOrder).

**Each screen card shows:**
- Screen thumbnail (the uploaded image)
- Screen ID (auto-assigned: SCR-01, SCR-02... auto-incrementing per module)
- Editable Screen Title field
- Screen Type dropdown (Dashboard / Form / List / Detail / Modal / Navigation / Other)

**Expandable description area (collapsed by default, click to expand):**
Each card has a chevron to expand a description panel showing:

  Tab 1 — Text Description:
  A textarea where the BA types the screen's business context, actor, purpose.
  Placeholder: "Describe this screen — who uses it, what it does, what business problem it solves. Include anything the image doesn't show."
  Character count shown.

  Tab 2 — Audio Description:
  A microphone button. When clicked:
  - Shows recording indicator (red pulsing dot)
  - "Stop Recording" button appears
  - On stop: sends audio to POST /api/ba/transcribe
  - Shows transcription loading state
  - When transcribed: shows transcript in an editable textarea
  - BA can edit the transcript
  - "Confirm Transcript" button marks it as reviewed
  Playback button for the recorded audio (if audio file stored).
  Badge showing transcript status: "Not recorded" / "Transcribing..." / "Review transcript" / "Confirmed"

**Click-Through Flow Builder (separate section below the screen cards):**

Title: "Navigation Flows"
Description: "Define how screens connect. Select screens in sequence and describe what triggers each navigation. You do not re-upload screens — reference them by ID."

Each flow is a named card with:
- Flow name (editable text field)
- Steps list:
  Each step has:
  - Screen selector dropdown (shows all screens in this module by SCR-ID + title)
  - Trigger label text field: "What action triggers navigation to the next screen?"
  - Outcome label (for last step): "What is the result of completing this flow?"
  - Add step / Remove step buttons

"Add Flow" button adds a new empty flow card.
Flows can be deleted.

**"Ready to Analyse" button** at the bottom.
Disabled until: at least 1 screen uploaded with a title.
Enabled: at least 1 screen has either a text description or a confirmed audio transcript.
Clicking triggers SKILL-00 execution.

---

### SkillStepper Component

The stepper tracks execution state across all 6 steps.
Horizontal stepper at the top, content area below.

**Running state:**
When a skill is executing:
- Step shows spinner + "Analysing..."
- Content area shows a streaming output panel
- Output streams line by line as the AI produces it
- The stream is divided into labelled sections matching the skill's output structure
- BA can read the output as it arrives

**Awaiting Review state:**
When a skill completes:
- Step shows amber "Review Required" badge
- Content area shows the ArtifactViewer for this step's output
- "Approve & Continue" button is prominent (blue, full-width)
- "Request Changes" button is secondary

**Approve & Continue:**
- Saves all edits made in ArtifactViewer
- Marks the execution as APPROVED
- Triggers generation of the handoff packet JSON
- Unlocks the next step

**Failed state:**
- Shows error message
- "Retry" button re-runs the skill with the same context
- "Edit Context" button allows BA to modify the assembled context before retry

---

### ArtifactViewer Component

Displays the output of a skill as a structured, editable form.
NOT a markdown text editor — a proper form with labelled sections.

**General layout:**
- Artifact header (Artifact ID, Type, Status badge)
- Collapsible sections matching the skill's template sections
- Each section has:
  - Section label (bold)
  - AI-generated badge (blue dot) if content was AI-generated
  - Human-modified badge (amber dot) if content was edited
  - Editable content (textarea or structured sub-fields)
  - Section-level "Lock" toggle (locked sections can't be edited without unlocking)

**For FRD output specifically:**
- Module header section (Module ID, Module Name, Package Name — editable fields)
- Feature cards — one card per feature:
  - Feature ID (read-only after first save — Feature IDs are permanent)
  - Feature Name (editable)
  - Feature Description (editable textarea)
  - Priority dropdown (Must Have / Should Have / Could Have / Won't Have)
  - Status badge (CONFIRMED / CONFIRMED-PARTIAL / DRAFT)
  - Integration Signals section (collapsible) — shows each signal with its classification
  - Business Rules section (collapsible) — listed rules with BR-IDs
  - Validations section (collapsible)
  - Screen Reference (read-only)
- "Add Feature" button (adds new feature card — marked as human-added)
- TBD-Future Integration Registry table at the bottom of the FRD view

**For EPIC output:**
- EPIC header fields (EPIC ID, EPIC Name, Module Reference, Package Name)
- FRD Feature IDs section (read-only table — Feature IDs cannot be changed here)
- Business Context (large editable textarea — marked AUTOMATION CRITICAL)
- Integration Domains section — each domain card with status badge, assumed interface, TBD-Future ref
- Scope section — including Classes This Module Will Produce sub-section
- NFRs section — each category as a separate field
- Acceptance Criteria — one entry per Feature ID

**For User Stories:**
- Story header (US-ID, EPIC-ID, Story Type badge, Status badge)
- All 26 sections as collapsible cards
- Algorithm Outline (Section 22) — numbered steps, each step editable individually
- Integrations (Section 21) — each integration as a card with CONFIRMED/TBD-Future status
- Traceability Header (Section 26) — read-only code block

**For SubTasks:**
- SubTask header with Team badge [FE] [BE] [IN] [QA]
- AUTOMATION CRITICAL sections highlighted with a distinct border colour
- Algorithm steps — numbered list, each step editable
- Integration Points — each point as a card, TBD-Future ones highlighted amber
- Project Structure Definition (Section 20) — file path display
- Sequence Diagram Inputs (Section 21) — structured participant and message list

---

### TBD-Future Registry Panel

Accessible from the top bar of the Project Workspace.
Shows a table of all TBD-Future entries across all modules:

| Registry ID | Integration Name | Classification | Referenced Module | Appears In | Resolved? | Resolution Date |
|------------|-----------------|---------------|------------------|------------|----------|----------------|
| TBD-001 | ProfessionalService | INTERNAL-TBD-Future | MOD-03 | F-02-02, F-02-07 | ☐ | — |

When a module is approved and its SubTasks are confirmed:
- System automatically checks the registry for entries referencing this module
- Matching entries are highlighted with a "Ready to Resolve" badge
- BA clicks "Resolve" → confirms or updates the assumed interface
- Entry status changes to Resolved ✅
- All artifacts containing this TBD-Future reference are listed so BA knows what to update

---

### RTM Viewer

Accessible from the top bar.
Full-width table showing the Master RTM.
Columns match the RTM defined in SKILL-SET-ROUTING-GUIDE.
Filterable by: Module, EPIC, Story Type, Status, TBD-Future.
Exportable as CSV.
Cells link to their corresponding artifact (clicking Feature ID opens the FRD section).

---

## Skill Execution Service

This is the most critical backend component.
It is a NestJS service (BaSkillOrchestratorService) that:

### Context Assembly

For each skill, assembles the correct context packet according to FINAL-SKILL-SET-ROUTING-GUIDE.md:

SKILL-00 receives:
- Screen images (as base64 or presigned URLs)
- BA text descriptions per screen
- BA audio transcripts (reviewed) per screen
- Click-through flows for this module

SKILL-01-S receives:
- Screen Summary Cards JSON (generated by SKILL-00 output)
- Compact Module Index (all previously approved modules)
- TBD-Future Registry (existing entries)
- Current module's SKILL-00 handoff packet

SKILL-02-S receives:
- FRD Handoff Packet JSON from SKILL-01-S
- Compact Module Index
- TBD-Future Registry rows for this module
- Running Module-FRD RTM rows for this module

SKILL-04 receives:
- EPIC Handoff Packet JSON from SKILL-02-S
- FRD Handoff Packet JSON
- Screen Summary Cards for relevant screens
- Running RTM rows

SKILL-05 receives (per User Story, chunked):
- Full current User Story document
- EPIC Handoff Packet JSON
- FRD Feature entry
- Running RTM rows for this module
- TBD-Future Registry entries for this module

### AI API Call

For each skill, constructs the API call:

```javascript
const response = await anthropicClient.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 8000,
  system: [skill file content from Master-Documents/],
  messages: [
    {
      role: "user",
      content: [
        ...contextPacket.images,  // base64 images for SKILL-00
        { type: "text", text: contextPacket.textContent }
      ]
    }
  ],
  stream: true  // Enable streaming
});
```

### Streaming to Frontend

Use Server-Sent Events (SSE) to stream skill output to the frontend.
The frontend SkillStepper listens to the SSE stream and renders output in real time.

### Output Processing

When the skill completes:
1. Parse the full output into human document (markdown) and handoff packet (JSON)
2. Store human document in BaSkillExecution.humanDocument
3. Store handoff packet in BaSkillExecution.handoffPacket
4. Create BaArtifact records with BaArtifactSection entries from parsed output
5. Update BaTbdFutureEntry records for any new TBD-Future signals found
6. Update BaRtmRow records for this module
7. Set execution status to AWAITING_REVIEW
8. Notify frontend via SSE

### Validation Gate

Before marking a skill execution as allowing progression to the next skill:
1. Run the DoD checklist from the skill file against the output
2. Check all mandatory fields are populated
3. Check Feature IDs are consistent (no orphaned IDs)
4. Check TBD-Future entries all have required 4 fields
5. If any check fails: mark as FAILED with specific failure message
6. BA sees the failure with actionable error messages

---

## Audio / STT Feature

When BA clicks the microphone button on a screen card:

1. Browser captures audio via MediaRecorder API (WebM/Opus format)
2. On stop: sends audio blob to POST /api/ba/transcribe
3. Backend forwards to Python AI service POST /ba/transcribe
4. AI service uses the existing Whisper/STT provider (reuse existing STT setup from PRD tool)
5. Returns transcript text
6. Frontend shows transcript in editable textarea
7. BA edits if needed, clicks "Confirm Transcript"
8. Confirmed transcript stored in BaScreen.audioTranscript
9. BaScreen.transcriptReviewed = true

Both text description and audio transcript are included in SKILL-00 context.
If both exist, audio transcript is appended to text description with a separator:
"[Text Description]: [text]\n\n[Audio Description]: [transcript]"

---

## Export Package

When BA clicks "Export Package" from Project Workspace:

Generates a ZIP file containing:
```
[ProjectCode]-ba-artifacts/
├── Screen-Analysis/
│   ├── Screen-Inventory-[ModuleID].md
│   └── Screen-Analysis-Report-[ModuleID].md
├── FRD/
│   └── FRD-[ProjectCode]-Screen-First.md
├── EPICs/
│   ├── EPIC-01-[ShortName].md
│   └── EPIC-02-[ShortName].md
├── UserStories/
│   ├── US-001-[ShortName].md
│   └── ...
├── SubTasks/
│   └── SubTasks-US-[XXX].md
├── RTM/
│   └── Master-RTM-[ProjectCode].csv
└── TBD-Future-Registry.md
```

---

## UI Theme Requirements

Match the existing PRD tool exactly:
- Use the same Tailwind CSS configuration
- Use the same shadcn/ui components (Card, Badge, Button, Input, Textarea,
  Select, Tabs, Collapsible, Progress, Dialog, Sheet)
- Use the same colour variables (CSS custom properties)
- Use the same font stack
- Use the same border radius, shadow, and spacing conventions
- Use the same sidebar layout pattern if the PRD tool has one
- The only new UI element is the SkillStepper — use the shadcn/ui Steps pattern
  or build a custom stepper that matches the PRD tool's visual weight

Read the existing PRD tool's CSS configuration, component styles, and layout
patterns BEFORE building any new component. Every new component must feel
native to the existing product.

---

## Implementation Order

Build in this exact sequence to avoid integration issues:

**Phase 1 — Database and API Foundation**
1. Add new Prisma models to existing schema.prisma (additive only)
2. Run migration
3. Create BaProject, BaModule CRUD endpoints in NestJS
4. Create BaScreen upload endpoint (match existing file upload pattern)
5. Create BaClickThroughFlow CRUD endpoints

**Phase 2 — Skill Execution Infrastructure**
6. Create BaSkillOrchestratorService with context assembly logic
7. Create AI service endpoint POST /ba/execute-skill
8. Create SSE streaming endpoint GET /api/ba/modules/:id/execution/:execId/stream
9. Create BaArtifact and BaArtifactSection CRUD
10. Create BaTbdFutureEntry CRUD

**Phase 3 — Frontend Foundation**
11. Create /ba-tool route with project list page
12. Create /ba-tool/project/[id] route with module sidebar
13. Create ScreenUploader component (upload + display only, no description yet)
14. Verify existing routes are unaffected

**Phase 4 — Screen Description Features**
15. Add text description panel to ScreenUploader
16. Add STT transcription endpoint and hook it up to AI service
17. Add audio recording UI to ScreenUploader (Tab 2)
18. Add transcript review/confirm flow

**Phase 5 — Click-Through Flow Builder**
19. Build ClickThroughBuilder component
20. Save/load flows from backend

**Phase 6 — Skill Execution and Stepper**
21. Build SkillStepper component with 6 steps and state machine
22. Connect Step 1 (Screen Upload) completion to SKILL-00 trigger
23. Implement SSE listener in frontend for streaming output
24. Build streaming output panel in stepper

**Phase 7 — Artifact Viewer and Review Gates**
25. Build ArtifactViewer base component
26. Build FRD-specific artifact view (feature cards, integration signals)
27. Build EPIC-specific artifact view
28. Build User Story-specific artifact view
29. Build SubTask-specific artifact view
30. Connect Approve & Continue flow to unlock next step

**Phase 8 — RTM and TBD-Future Registry**
31. Build RTM Viewer component
32. Build TBD-Future Registry panel
33. Implement TBD-Future resolution flow

**Phase 9 — Export**
34. Build ZIP export endpoint
35. Build Export Package UI

**Phase 10 — Polish and Integration Testing**
36. Verify all existing PRD tool routes still work
37. End-to-end test with sample screens
38. Error handling for skill execution failures
39. Retry mechanism

---

## Rules for Claude Code

1. Read the entire existing codebase before writing any code
2. Never modify existing files unless the change is purely additive (e.g., adding a model to schema.prisma, adding a route to app router)
3. If an existing pattern exists (file upload, SSE, auth guard), follow it exactly — do not invent a new pattern
4. Run `npm run build` after each phase to confirm no regressions
5. Use `git status` before and after each phase to verify only new files were created
6. One task at a time — do not combine tasks across phases
7. After Phase 3, ask for confirmation that existing routes are unaffected before continuing
8. The Feature ID format (F-XX-XX) is permanent — never generate or auto-assign Feature IDs in the frontend. They come from the AI skill output only.
9. All skill file content is read from Master-Documents/ folder at runtime — not hardcoded. The skill files are the source of truth for AI prompts.

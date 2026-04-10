# Sprint v3 — Tasks: BA Tool SubTask Generation, Viewing, and Code-Gen Readiness

## Status: Pending

---

## P0 — Database Schema & SubTask Parsing (Must Have — BE First)

- [ ] Task 1: Add BaSubTask and BaSubTaskSection Prisma models (P0-BE)
  - SubTask: Schema foundation for structured SubTask storage
  - Acceptance: Prisma schema includes `BaSubTask` model with header fields (subtaskId, subtaskName, subtaskType, userStoryId, epicId, featureId, moduleId, packageName, assignedTo, estimatedEffort, prerequisites, status, priority, tbdFutureRefs, sourceFileName, className, methodName) and `BaSubTaskSection` model with fields (sectionNumber 1-24, sectionKey, sectionLabel, aiContent, editedContent, isHumanModified); `SubTaskStatus` enum (DRAFT, APPROVED, IMPLEMENTED); foreign keys to BaModule and BaArtifact; migration runs cleanly
  - Algorithm:
    1. Add `SubTaskStatus` enum to schema.prisma with values DRAFT, APPROVED, IMPLEMENTED
    2. Add `BaSubTask` model with all header fields, relations to BaModule and BaArtifact, and `@@index([moduleDbId])` + `@@unique([moduleDbId, subtaskId])`
    3. Add `BaSubTaskSection` model with FK to BaSubTask, sectionNumber (1-24), sectionKey, sectionLabel, aiContent (Text), editedContent (Text, optional), isHumanModified (default false), `@@unique([subtaskDbId, sectionNumber])`
    4. Run `npx prisma migrate dev --name add-ba-subtask-models`
    5. Run `npx prisma generate`
  - Files:
    - `backend/prisma/schema.prisma`

- [ ] Task 2: Implement SKILL-05 output parser in BaSkillOrchestratorService (P0-BE)
  - SubTask: Parse raw SKILL-05 markdown into structured BaSubTask + BaSubTaskSection records
  - Acceptance: `parseSkill05Output(rawMarkdown, moduleDbId, artifactDbId)` correctly splits raw output by `## ST-` headings; extracts all 24 section values per SubTask; stores header fields (SubTask ID, Name, Type, User Story ID, EPIC ID, Feature ID, Module ID, Package Name, Assigned To, Effort, Prerequisites, TBD-Future Refs, Source File, Class Name, Method Name); stores each section as a `BaSubTaskSection` record; handles both structured (table header) and freeform SubTask formats; QA SubTasks (ST-*-QA-*) are parsed with reduced section count
  - Algorithm:
    1. Split raw markdown by `## ST-` or `## SubTask: ST-` heading pattern
    2. For each chunk, extract SubTask ID from heading (e.g., `ST-US001-BE-01`)
    3. Parse SubTask Header table/block for: SubTask ID, User Story ID, EPIC ID, Feature ID, Module ID, Package Name, Assigned To, Effort, TBD-Future Refs
    4. For each `#### Section N` block, extract sectionNumber, derive sectionKey from label, capture content until next section heading
    5. Map section labels to keys: 1=subtask_id, 2=subtask_name, 3=subtask_type, 4=description, 5=prerequisites, 6=source_file_name, 7=class_name, 8=class_description, 9=method_name, 10=method_description, 11=arguments, 12=return_type, 13=validations, 14=algorithm, 15=integration_points, 16=error_handling, 17=database_operations, 18=technical_notes, 19=traceability_header, 20=project_structure, 21=sequence_diagram, 22=test_case_ids (or end_to_end_flow), 23=acceptance_criteria, 24=testing_notes
    6. Create BaSubTask record with extracted header fields, status=DRAFT, priority derived from Section 22 Sprint Sequencing if present
    7. Create BaSubTaskSection records for each parsed section
    8. Return array of created SubTask IDs
  - Files:
    - `backend/src/ba-tool/ba-skill-orchestrator.service.ts`
    - `backend/src/ba-tool/subtask-parser.service.ts` (new — dedicated parsing logic)

- [ ] Task 3: Auto-extract TBD-Future entries from parsed SubTasks (P0-BE)
  - SubTask: Extract TBD-Future references from Section 15 (Integration Points) and register them in BaTbdFutureEntry
  - Acceptance: When SKILL-05 completes and SubTasks are parsed, any Integration Point with `Status: TBD-Future` is auto-registered in the TBD-Future Registry; entry includes registryId (TBD-NNN), integrationName (Called Class), classification, referencedModule, stub guidance; duplicate entries (same registryId + moduleDbId) are skipped; extracted entries appear in `/ba-tool/project/[id]/tbd-registry`
  - Algorithm:
    1. For each parsed SubTask, read Section 15 (integration_points) content
    2. Scan for patterns: `Status: TBD-Future`, `TBD-Future Ref: TBD-NNN`
    3. Extract: Called Class, Referenced Module, Method Called, Stub Implementation details
    4. Check if entry with same TBD-Future Ref already exists for this module
    5. If not, create BaTbdFutureEntry with registryId, integrationName, classification=TBD_FUTURE, referencedModule, isResolved=false, stubGuidance
    6. Log count of new TBD entries registered
  - Files:
    - `backend/src/ba-tool/ba-skill-orchestrator.service.ts`

- [ ] Task 4: Auto-extend RTM with SubTask IDs and Test Case IDs (P0-BE)
  - SubTask: When SKILL-05 completes, extend existing RTM rows with SubTask IDs (from Section 1) and Test Case IDs (from Section 22)
  - Acceptance: RTM rows matching the same moduleId + featureId get SubTask IDs appended; Test Case IDs from Section 22 are added to RTM testCaseIds column; RTM view at `/ba-tool/project/[id]/rtm` shows SubTask and Test Case columns populated; no duplicate entries
  - Algorithm:
    1. For each parsed SubTask, read featureId from header and testCaseIds from Section 22
    2. Find existing BaRtmRow matching projectId + moduleId + featureId
    3. Append subtaskId to rtmRow.subtaskIds (JSON array, deduplicated)
    4. Append each test case ID to rtmRow.testCaseIds (JSON array, deduplicated)
    5. Update BaRtmRow record
    6. If no matching RTM row exists, log warning (RTM row should have been created by SKILL-02-S)
  - Files:
    - `backend/src/ba-tool/ba-skill-orchestrator.service.ts`

- [ ] Task 5: Wire SKILL-05 completion to SubTask parser + TBD + RTM pipeline (P0-BE)
  - SubTask: Connect the existing skill execution pipeline so that when SKILL-05 completes, it triggers SubTask parsing, TBD extraction, and RTM extension
  - Acceptance: After SKILL-05 `createArtifactFromOutput()` completes, `parseSkill05Output()` is called; then `extractTbdEntries()` runs; then `extendRtmWithSubTasks()` runs; all three steps are wrapped in a try-catch so that a parsing failure does not block the skill execution from completing; execution record is updated with parsed SubTask count in metadata
  - Algorithm:
    1. In `runSkillAsync()`, after step 6 (createArtifactFromOutput), check if skillName === 'SKILL-05'
    2. If yes, call parseSkill05Output(humanDocument, moduleDbId, artifact.id)
    3. Call extractTbdEntriesFromSubTasks(moduleDbId)
    4. Call extendRtmWithSubTasks(moduleDbId, projectId)
    5. Store parsedSubTaskCount in execution metadata
    6. Wrap steps 2-5 in try-catch; log errors but do not fail the execution
  - Files:
    - `backend/src/ba-tool/ba-skill-orchestrator.service.ts`

---

## P0 — SubTask API Endpoints (Must Have — BE)

- [ ] Task 6: Add SubTask CRUD API endpoints to BaToolController (P0-BE)
  - SubTask: REST endpoints for listing, viewing, editing, and approving SubTasks
  - Acceptance: `GET /api/ba/modules/:id/subtasks` returns list of SubTasks with header fields (no section content); `GET /api/ba/subtasks/:id` returns full SubTask with all sections; `PUT /api/ba/subtasks/:id/sections/:sectionKey` accepts `{ editedContent }` and sets isHumanModified=true; `POST /api/ba/subtasks/:id/approve` sets status=APPROVED; all endpoints validate input and return proper error codes
  - Algorithm:
    1. listSubTasks(moduleDbId): Query BaSubTask where moduleDbId, orderBy subtaskId, select header fields only
    2. getSubTask(id): Query BaSubTask with include sections orderBy sectionNumber; throw 404 if not found
    3. updateSubTaskSection(subtaskId, sectionKey): Find BaSubTaskSection by subtaskDbId + sectionKey; update editedContent and set isHumanModified=true; throw 404 if not found
    4. approveSubTask(id): Find BaSubTask; set status=APPROVED, approvedAt=now(); throw 404 if not found
  - Files:
    - `backend/src/ba-tool/ba-tool.controller.ts`
    - `backend/src/ba-tool/ba-tool.service.ts`
    - `backend/src/ba-tool/dto/update-subtask-section.dto.ts` (new)

- [ ] Task 7: Add Sprint Sequencing API endpoint (P0-BE)
  - SubTask: Endpoint that returns the dependency-ordered SubTask sequence for a module
  - Acceptance: `GET /api/ba/modules/:id/sprint-sequence` returns `{ priorities: { P0: [...], P1: [...], P2: [...], P3: [...] }, dependencies: [{ from, to }] }`; priority is derived from SubTask prerequisites and Section 22 Sprint Sequencing data; SubTasks with no prerequisites are P0; SubTasks depending on P0 are P1; and so on; dependency edges are computed from prerequisites field
  - Algorithm:
    1. Query all BaSubTask records for moduleDbId
    2. Build dependency graph from prerequisites field (each prerequisite is another SubTask ID)
    3. Compute topological levels: SubTasks with no prerequisites = P0, SubTasks depending only on P0 = P1, etc.
    4. If SubTask already has an explicit priority from parsing, use it; otherwise compute from graph
    5. Build dependency edge list: for each SubTask, create edges from prerequisite to self
    6. Return priorities object and edges array
  - Files:
    - `backend/src/ba-tool/ba-tool.service.ts`
    - `backend/src/ba-tool/ba-tool.controller.ts`

---

## P1 — Frontend SubTask Views (Should Have — FE)

- [ ] Task 8: Build SubTask list panel in module detail page (P1-FE)
  - SubTask: Display list of SubTasks for a module with summary cards
  - Acceptance: Module detail page at `/ba-tool/project/[id]/module/[moduleId]` shows a new "SubTasks" tab (alongside existing Screens, Artifacts, Flows tabs); each SubTask card shows: SubTask ID, Name, Type badge (BE/QA/IN), User Story ID, Estimated Effort, Status badge (DRAFT/APPROVED), priority badge (P0-P3); clicking a card navigates to SubTask detail page; empty state shows "Run SKILL-05 to generate SubTasks"; list is sortable by priority or SubTask ID
  - Files:
    - `frontend/app/ba-tool/project/[id]/module/[moduleId]/page.tsx`
    - `frontend/components/ba-tool/SubTaskList.tsx` (new)
    - `frontend/components/ba-tool/SubTaskCard.tsx` (new)

- [ ] Task 9: Build SubTask detail page with 24-section structured view (P1-FE)
  - SubTask: Full SubTask detail page rendering all 24 sections in a structured layout
  - Acceptance: `/ba-tool/project/[id]/module/[moduleId]/subtask/[subtaskId]` renders SubTask header (ID, Name, Type, User Story, EPIC, Feature, Module, Package, Assigned To, Effort, Prerequisites, TBD-Future Refs); renders each of 24 sections as a collapsible panel with section label and content; Algorithm section (14) renders as numbered steps; Validations section (13) renders as a table; Integration Points section (15) highlights TBD-Future entries with warning badge; Traceability Header section (19) renders as code block; Project Structure section (20) renders as directory tree; sections with human edits show "Modified" badge; Approve button at top sets status to APPROVED
  - Files:
    - `frontend/app/ba-tool/project/[id]/module/[moduleId]/subtask/[subtaskId]/page.tsx` (new)
    - `frontend/components/ba-tool/SubTaskDetailView.tsx` (new)
    - `frontend/components/ba-tool/SubTaskSectionPanel.tsx` (new)

- [ ] Task 10: Build Sprint Sequencing view with dependency graph (P1-FE)
  - SubTask: Visual representation of SubTask execution order grouped by priority level
  - Acceptance: Module detail page has a "Sprint Sequence" tab that shows SubTasks grouped in P0/P1/P2/P3 columns (or rows); dependency arrows connect prerequisite SubTasks to dependent ones; each SubTask node shows ID, Name, Type badge, and status; clicking a node navigates to SubTask detail; the view uses the `/api/ba/modules/:id/sprint-sequence` endpoint; empty state shows "No SubTasks generated yet"
  - Files:
    - `frontend/components/ba-tool/SprintSequenceView.tsx` (new)
    - `frontend/app/ba-tool/project/[id]/module/[moduleId]/page.tsx` (add tab)

---

## P2 — Export & Polish (Nice to Have)

- [ ] Task 11: Add SubTask export endpoint (markdown + JSON) (P2-BE)
  - SubTask: Export all SubTasks for a project or module as structured markdown or JSON
  - Acceptance: `GET /api/ba/projects/:id/export/subtasks?format=md` returns a single markdown file with all SubTasks grouped by module, following the SubTask-Template format; `GET /api/ba/projects/:id/export/subtasks?format=json` returns a JSON array of SubTasks with all sections (using editedContent if available, else aiContent); human-modified sections are flagged in JSON output; markdown output includes full traceability headers and Sprint Sequencing section
  - Algorithm:
    1. Query all BaSubTask records for projectId (via module relation), include sections
    2. If format=md: for each SubTask, render header as markdown table, render each section with `#### Section N` format, use editedContent if isHumanModified else aiContent
    3. If format=json: for each SubTask, build JSON object with header fields and sections array, each section has key, label, content (edited or ai), isModified flag
    4. Group by moduleId, sort by subtaskId
    5. Return with appropriate Content-Type header and Content-Disposition for download
  - Files:
    - `backend/src/ba-tool/ba-export.service.ts`
    - `backend/src/ba-tool/ba-tool.controller.ts`

- [ ] Task 12: Add inline section editor to SubTask detail page (P2-FE)
  - SubTask: Enable editing of individual SubTask sections from the detail page
  - Acceptance: Each section panel in SubTask detail view has an "Edit" button; clicking Edit replaces the section content with a textarea pre-filled with current content (editedContent or aiContent); Save calls `PUT /api/ba/subtasks/:id/sections/:sectionKey`; Cancel discards changes; after save, section shows "Modified" badge; original AI content is preserved and viewable via "View Original" toggle
  - Files:
    - `frontend/components/ba-tool/SubTaskSectionPanel.tsx`
    - `frontend/components/ba-tool/SubTaskDetailView.tsx`

---

## Task Sequence Summary

```
Task 1 (Prisma schema — BaSubTask + BaSubTaskSection)
    → Task 2 (SKILL-05 output parser)
        → Task 3 (TBD-Future auto-extraction)
        → Task 4 (RTM auto-extension)
        → Task 5 (wire pipeline: skill completion → parser → TBD → RTM)
    → Task 6 (SubTask CRUD API endpoints)
        → Task 8 (SubTask list panel — FE)
        → Task 9 (SubTask detail page — FE)
            → Task 12 (inline section editor — FE)
    → Task 7 (Sprint Sequencing API)
        → Task 10 (Sprint Sequencing view — FE)

Task 11 (export) — depends on Task 6, can be done in parallel with FE tasks
```

---

## Key Design Decisions

1. **Dedicated SubTask parser service**: The SKILL-05 output parsing logic is extracted into `subtask-parser.service.ts` rather than inlining it in the orchestrator. This keeps the orchestrator focused on pipeline flow and makes the parser independently testable.

2. **24-section schema**: SubTasks consistently have up to 24 sections (matching the SubTask-Template). QA SubTasks may have fewer populated sections but the schema accommodates all. The sectionKey provides a stable identifier for code-gen consumers.

3. **Edited content preserved separately**: `aiContent` is immutable (original AI output). `editedContent` stores human modifications. The `isHumanModified` flag enables UI to show which sections were changed. Export uses editedContent when available.

4. **Sprint Sequencing computed from prerequisites**: Rather than relying solely on explicit P0/P1/P2/P3 labels in the AI output, the backend computes topological ordering from the prerequisites graph. This handles cases where the AI omits Sprint Sequencing data.

5. **Pipeline failure isolation**: SubTask parsing, TBD extraction, and RTM extension are wrapped in try-catch within the skill execution pipeline. A parsing failure does not block the skill execution from completing -- the raw artifact is always preserved.

6. **BE-first task ordering**: All backend tasks (1-7) are ordered before frontend tasks (8-10, 12) to ensure APIs are available before UI development begins.

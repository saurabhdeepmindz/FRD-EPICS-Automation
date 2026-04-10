# Sprint v3 — Walkthrough

## Summary

Sprint v3 closes the BA Tool automation pipeline by making SKILL-05 SubTask output a first-class entity in the platform. When SKILL-05 completes, raw markdown is parsed into structured `BaSubTask` records (header fields + up to 24 sections each), TBD-Future integration references are auto-extracted and registered, and RTM rows are auto-extended with SubTask IDs and Test Case IDs. The frontend gains a SubTask list panel, a full 24-section detail page with inline editing (preserving original AI content separately from human edits), and a Sprint Sequencing view that computes P0/P1/P2/P3 priority levels from the dependency graph. SubTasks can be exported as structured markdown or JSON for downstream code-gen tools. Twelve tasks were completed across backend and frontend, adding the `BaSubTask` and `BaSubTaskSection` Prisma models, a dedicated parser service, six new REST endpoints, three new React components, and a new Next.js route.

## Architecture Overview

```
+-------------------------------------------------------------------------------+
|                        Browser (port 3001)                                     |
|                                                                                |
|   Next.js 14 (App Router) + Tailwind CSS + shadcn/ui                           |
|                                                                                |
|   /ba-tool/project/[id]/module/[moduleId]                                      |
|     Existing: ScreenUploader, SkillStepper, ClickThroughBuilder,               |
|               SkillExecutionPanel, ArtifactTree, ArtifactContentPanel           |
|     NEW:  SubTask List panel (step 6)                                          |
|           Sprint Sequence view (step 7)                                        |
|                                                                                |
|   /ba-tool/project/[id]/module/[moduleId]/subtask/[subtaskId]  (NEW)           |
|     SubTaskDetailView — 24-section structured render                           |
|     SubTaskSectionPanel — collapsible, inline editor, View Original toggle     |
|                                                                                |
+--------------------------------------+----------------------------------------+
                                       | HTTP (port 4000)
                                       v
+-------------------------------------------------------------------------------+
|                     NestJS Backend (port 4000)                                 |
|                                                                                |
|   BaToolController (enhanced):                                                 |
|     GET  /api/ba/modules/:id/subtasks          -- list SubTasks                |
|     GET  /api/ba/subtasks/:id                  -- get SubTask + sections       |
|     PUT  /api/ba/subtasks/:id/sections/:key    -- edit section                 |
|     POST /api/ba/subtasks/:id/approve          -- approve SubTask              |
|     GET  /api/ba/modules/:id/sprint-sequence   -- dependency graph             |
|     GET  /api/ba/projects/:id/export/subtasks  -- export md/json               |
|                                                                                |
|   SubTaskParserService (NEW):                                                  |
|     parseAndStore() -- raw markdown -> BaSubTask + BaSubTaskSection records    |
|     parseMarkdown() -- pure parsing, no DB writes                              |
|                                                                                |
|   BaSkillOrchestratorService (enhanced):                                       |
|     SKILL-05 post-processing pipeline:                                         |
|       7a. subtaskParser.parseAndStore()                                        |
|       7b. extractTbdFromSubTasks()                                             |
|       7c. extendRtmWithSubTasks()                                              |
|                                                                                |
|   BaExportService (enhanced):                                                  |
|     exportSubTasks() -- markdown + JSON export                                 |
|                                                                                |
|   Prisma Schema:                                                               |
|     BaSubTask        -- 22 fields + relations to BaModule, BaArtifact          |
|     BaSubTaskSection -- sectionNumber, sectionKey, aiContent, editedContent    |
|     SubTaskStatus    -- DRAFT | APPROVED | IMPLEMENTED                         |
|                                                                                |
+--------------------------------------+----------------------------------------+
                                       | Prisma ORM
                                       v
+--------------------------------------+
|   PostgreSQL 16                       |
|   Tables:                             |
|     ba_subtasks                       |
|     ba_subtask_sections               |
|   (Existing: ba_projects, ba_modules, |
|    ba_screens, ba_artifacts,          |
|    ba_skill_executions, ba_rtm_rows,  |
|    ba_tbd_future_entries)             |
+---------------------------------------+
```

## Files Created/Modified

### 1. `backend/prisma/schema.prisma` (Modified)

**Purpose:** Add SubTask data model to the database schema.

**Key additions:**
- `SubTaskStatus` enum with values `DRAFT`, `APPROVED`, `IMPLEMENTED`
- `BaSubTask` model (22 fields) with foreign keys to `BaModule` and `BaArtifact`, compound unique constraint `@@unique([moduleDbId, subtaskId])`, and index on `moduleDbId`
- `BaSubTaskSection` model (9 fields) with compound unique constraint `@@unique([subtaskDbId, sectionNumber])`
- `aiContent` stored as `@db.Text` (immutable original AI output), `editedContent` as optional `@db.Text`
- Added `subtasks BaSubTask[]` relation on `BaArtifact` model

**How it works:** The `BaSubTask` model stores header-level metadata (subtaskId, name, type, team, userStoryId, epicId, featureId, prerequisites, priority, etc.) while each of the 24 sections is a separate `BaSubTaskSection` row. This separation enables section-level editing without touching other sections and supports the "View Original" toggle by keeping `aiContent` immutable.

---

### 2. `backend/src/ba-tool/subtask-parser.service.ts` (New)

**Purpose:** Dedicated service for parsing raw SKILL-05 markdown output into structured SubTask records.

**Key functions:**

- `parseAndStore(rawMarkdown, moduleDbId, artifactDbId)` -- Top-level entry point. Calls `parseMarkdown()`, then creates `BaSubTask` + `BaSubTaskSection` records via Prisma. Skips duplicates using the `moduleDbId_subtaskId` unique constraint. Returns array of created database IDs.

- `parseMarkdown(rawMarkdown)` -- Pure parsing function (no DB writes). Splits raw markdown by `## ST-` or `## SubTask: ST-` headings, then for each chunk: extracts the SubTask ID from the heading, parses the header block for metadata fields, and parses `#### Section N` blocks for all 24 sections.

- `extractTeam(subtaskId)` -- Derives team code (FE/BE/IN/QA) from the SubTask ID convention (e.g., `ST-US001-BE-01` yields `BE`).

- `parseHeader(chunk)` -- Regex-based extraction of header fields: SubTask Name, User Story ID, EPIC ID, Feature ID, Module ID, Package Name, Assigned To, Estimated Effort, TBD-Future Refs, Priority.

- `parseSections(chunk)` -- Matches `#### Section N -- Label` patterns and maps section numbers to keys using the `SECTION_MAP` constant (24 entries from `subtask_id` through `testing_notes`).

**How it works:** The `SECTION_MAP` constant defines the canonical mapping of section numbers 1-24 to keys and labels:

```typescript
const SECTION_MAP: Record<number, { key: string; label: string }> = {
  1: { key: 'subtask_id', label: 'SubTask ID' },
  2: { key: 'subtask_name', label: 'SubTask Name' },
  // ...
  14: { key: 'algorithm', label: 'Algorithm' },
  15: { key: 'integration_points', label: 'Integration Points' },
  // ...
  24: { key: 'testing_notes', label: 'Testing Notes' },
};
```

The parser uses regex splitting (`/(?=^## (?:SubTask:\s*)?ST-)/m`) to isolate individual SubTask blocks, then iterates through each to extract structured data. Prerequisites are parsed from Section 5 content by splitting on commas/newlines and filtering for `ST-` prefixed IDs.

---

### 3. `backend/src/ba-tool/ba-skill-orchestrator.service.ts` (Modified)

**Purpose:** Wire SKILL-05 completion to the SubTask parsing pipeline, TBD extraction, and RTM extension.

**Key additions:**

- **SKILL-05 post-processing block (step 7 in `runSkillAsync`)** -- After `createArtifactFromOutput()` completes for SKILL-05, three post-processing steps run in sequence, wrapped in a try-catch so that parsing failures do not block the skill execution from completing:

```typescript
if (skillName === 'SKILL-05') {
  try {
    const subtaskIds = await this.subtaskParser.parseAndStore(humanDocument, moduleDbId, artifactId);
    await this.extractTbdFromSubTasks(moduleDbId);
    if (mod?.projectId) {
      await this.extendRtmWithSubTasks(moduleDbId, mod.projectId);
    }
  } catch (pipelineErr: unknown) {
    this.logger.warn(`SKILL-05 post-processing partial failure: ${pMsg}`);
  }
}
```

- `extractTbdFromSubTasks(moduleDbId)` -- Queries all SubTasks for the module, reads their `integration_points` section (Section 15), scans for `TBD-Future Ref: TBD-NNN` patterns, and auto-registers new `BaTbdFutureEntry` records. Extracts Called Class and Referenced Module from the section content. Skips entries that already exist for the same module + registryId.

- `extendRtmWithSubTasks(moduleDbId, projectId)` -- For each parsed SubTask with a `featureId`, finds the matching `BaRtmRow` and updates it with subtaskId, team, className, sourceFileName, methodName, and test case IDs extracted from Section 22. Uses `Set` for deduplication of testCaseIds. Creates a new RTM row if no match exists (with a warning log).

- `assembleSkill05Context()` -- Assembles the context packet for SKILL-05 execution, including the User Stories document, EPIC and FRD handoff packets, Compact Module Index, TBD-Future registry, and RTM rows.

---

### 4. `backend/src/ba-tool/ba-tool.service.ts` (Modified)

**Purpose:** Add SubTask CRUD operations and Sprint Sequencing computation.

**Key additions:**

- `listSubTasks(moduleDbId)` -- Queries `BaSubTask` records for a module, ordered by subtaskId, selecting header fields only (no section content) for list views.

- `getSubTask(subtaskDbId)` -- Returns a single SubTask with all sections included, ordered by sectionNumber. Throws 404 if not found.

- `updateSubTaskSection(subtaskDbId, sectionKey, editedContent)` -- Finds the `BaSubTaskSection` by `subtaskDbId + sectionKey`, sets `editedContent` and `isHumanModified = true`. Original `aiContent` is never modified.

- `approveSubTask(subtaskDbId)` -- Sets `status = APPROVED` and `approvedAt = now()`.

- `getSprintSequence(moduleDbId)` -- Builds a dependency graph from SubTask prerequisites, then computes topological priority levels:
  - **P0**: SubTasks with no prerequisites (or prerequisites that reference unknown IDs)
  - **P1**: SubTasks depending only on P0
  - **P2**: SubTasks depending on P0+P1
  - **P3**: Everything else

  Returns `{ priorities: { P0: [...], P1: [...], P2: [...], P3: [...] }, dependencies: [{ from, to }], subtasks: [...with computedPriority] }`.

---

### 5. `backend/src/ba-tool/ba-tool.controller.ts` (Modified)

**Purpose:** Expose SubTask CRUD and Sprint Sequencing as REST endpoints.

**New endpoints:**

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| GET | `/api/ba/modules/:id/subtasks` | `listSubTasks()` | List SubTasks for a module (header fields only) |
| GET | `/api/ba/subtasks/:id` | `getSubTask()` | Full SubTask with all 24 sections |
| PUT | `/api/ba/subtasks/:id/sections/:sectionKey` | `updateSubTaskSection()` | Edit a section (sets isHumanModified=true) |
| POST | `/api/ba/subtasks/:id/approve` | `approveSubTask()` | Set status to APPROVED |
| GET | `/api/ba/modules/:id/sprint-sequence` | `getSprintSequence()` | Dependency-ordered SubTask sequence |

---

### 6. `backend/src/ba-tool/ba-export.service.ts` (Modified)

**Purpose:** Add SubTask-specific export in markdown and JSON formats.

**Key addition:**

- `exportSubTasks(projectId, format)` -- Queries all SubTasks across all modules in a project (via the module relation), including sections ordered by sectionNumber. For `format=json`, returns a structured array with each SubTask's header fields and sections, using `editedContent` when `isHumanModified` is true, with an `isModified` flag per section. For `format=md`, renders each SubTask as a markdown document with a header table and `#### Section N` blocks, grouped by module with `---` separators. Human-modified sections are marked with `*(Modified)*` in the markdown output.

---

### 7. `backend/src/ba-tool/dto/update-subtask-section.dto.ts` (New)

**Purpose:** DTO for validating SubTask section edit requests.

**How it works:** Uses `class-validator` decorators (`@IsString()`, `@IsNotEmpty()`) to validate the `editedContent` field. Ensures empty or non-string payloads are rejected at the controller level.

---

### 8. `backend/src/ba-tool/ba-subtask-schema.spec.ts` (New)

**Purpose:** Schema validation tests confirming the Prisma models were generated correctly.

**Tests:**
1. `BaSubTask` model is available on PrismaClient with `findMany`, `create`, `update`, `delete` methods
2. `BaSubTaskSection` model is available with `findMany`, `create` methods
3. `SubTaskStatus` enum has values `DRAFT`, `APPROVED`, `IMPLEMENTED`

---

### 9. `frontend/lib/ba-api.ts` (Modified)

**Purpose:** Add TypeScript types and API functions for SubTask operations.

**Key additions:**

- `BaSubTask` interface -- 20+ typed fields matching the backend model, with optional `sections` array
- `BaSubTaskSection` interface -- sectionNumber, sectionKey, sectionLabel, aiContent, editedContent, isHumanModified
- `SprintSequence` interface -- priorities map (P0-P3 string arrays), dependencies array, subtasks with computedPriority

**API functions:**
- `listBaSubTasks(moduleDbId)` -- GET `/ba/modules/:id/subtasks`
- `getBaSubTask(subtaskDbId)` -- GET `/ba/subtasks/:id`
- `updateBaSubTaskSection(subtaskDbId, sectionKey, editedContent)` -- PUT `/ba/subtasks/:id/sections/:sectionKey`
- `approveBaSubTask(subtaskDbId)` -- POST `/ba/subtasks/:id/approve`
- `getSprintSequence(moduleDbId)` -- GET `/ba/modules/:id/sprint-sequence`

**Helper constants:**
- `TEAM_COLORS` -- color mappings for FE (blue), BE (purple), IN (orange), QA (green)
- `SKILL_LABELS` -- human-readable labels for each skill name

---

### 10. `frontend/components/ba-tool/SubTaskList.tsx` (New)

**Purpose:** Display a list of SubTasks for a module with summary cards.

**How it works:** Fetches SubTasks via `listBaSubTasks(moduleDbId)` on mount. Each SubTask renders as a clickable `Link` card showing: SubTask ID (monospace, primary-colored), team badge (FE/BE/IN/QA with color coding), name (truncated), priority badge, estimated effort, and status badge (DRAFT/APPROVED/IMPLEMENTED). Clicking navigates to the SubTask detail page. Shows an empty state with "Run SKILL-05 to generate SubTasks" message when no SubTasks exist.

---

### 11. `frontend/components/ba-tool/SubTaskDetailView.tsx` (New)

**Purpose:** Full SubTask detail view with header metadata, 24-section display, inline editing, and approval.

**Key components:**

- `SubTaskDetailView` -- Renders the SubTask header card with ID, team badge, status badge, priority badge, traceability fields (Story, EPIC, Feature, Module, Class, Method, File, Effort), TBD-Future warning badges, and an Approve button (visible only for DRAFT status). Iterates over sections rendering a `SubTaskSectionPanel` for each.

- `SubTaskSectionPanel` -- Collapsible section panel with:
  - Section number, label, AI/human icon indicator
  - Amber border highlight for Integration Points sections containing TBD-Future references
  - **Edit mode**: textarea pre-filled with current content (editedContent or aiContent), Save/Cancel buttons, calls `updateBaSubTaskSection()` on save
  - **View mode**: content display with special rendering for algorithm (monospace), traceability header (monospace + muted background), and project structure (monospace + muted background) sections
  - **View Original toggle**: when a section is human-modified, shows the original AI content in a blue-bordered panel

---

### 12. `frontend/components/ba-tool/SprintSequenceView.tsx` (New)

**Purpose:** Visual representation of SubTask execution order grouped by priority level.

**How it works:** Fetches sprint sequence data via `getSprintSequence(moduleDbId)`. Renders a 4-column grid (responsive: 1 on mobile, 2 on medium, 4 on large screens) with columns for P0 ("Must Build First"), P1 ("Core Logic"), P2 ("API + Frontend"), and P3 ("Tests"). Each column has a colored background and border. SubTask nodes within each column show: index, SubTask ID (monospace), team badge, status badge, name (truncated), and prerequisite dependencies. Clicking a node navigates to the SubTask detail page.

---

### 13. `frontend/app/ba-tool/project/[id]/module/[moduleId]/subtask/[subtaskId]/page.tsx` (New)

**Purpose:** Next.js page route for viewing a single SubTask's full detail.

**How it works:** Extracts `projectId`, `moduleDbId`, and `subtaskDbId` from URL params via `useParams()`. Fetches SubTask data via `getBaSubTask(subtaskDbId)`. Renders a header bar with "Back to Module" navigation and the SubTask ID + name, then delegates to `SubTaskDetailView` for the full content. Handles loading and error states.

---

### 14. `frontend/app/ba-tool/project/[id]/module/[moduleId]/page.tsx` (Modified)

**Purpose:** Integrate SubTask list and Sprint Sequencing into the module workspace.

**Key additions:**

- Imports `SubTaskList` and `SprintSequenceView` components
- Adds two new header buttons ("SubTasks" and "Sprint Sequence") visible when `moduleStatus` is `SUBTASKS_COMPLETE` or `APPROVED`, mapping to `activeStep` values 6 and 7
- Renders `SubTaskList` at step 6 and `SprintSequenceView` at step 7 in the main content area
- Imports `ListChecks` and `GitBranch` icons from lucide-react for the tab buttons

## Data Flow

```
SKILL-05 AI execution completes
  |
  v
runSkillAsync() stores raw output + creates BaArtifact (existing)
  |
  v
subtaskParser.parseAndStore(humanDocument, moduleDbId, artifactId)
  |  Splits markdown by ## ST- headings
  |  Extracts header fields (ID, name, type, story, epic, feature, etc.)
  |  Parses 24 #### Section N blocks per SubTask
  |  Creates BaSubTask + BaSubTaskSection records (skips duplicates)
  v
extractTbdFromSubTasks(moduleDbId)
  |  Reads Section 15 (integration_points) from each SubTask
  |  Regex matches TBD-Future Ref: TBD-NNN patterns
  |  Creates BaTbdFutureEntry records (skips existing)
  v
extendRtmWithSubTasks(moduleDbId, projectId)
  |  For each SubTask with a featureId:
  |    Finds matching BaRtmRow (projectId + moduleId + featureId)
  |    Appends subtaskId, team, class, file, method, testCaseIds
  |    Deduplicates testCaseIds via Set
  |    Creates new RTM row if no match found
  v
Module status updated to SUBTASKS_COMPLETE
  v
Frontend polls -> renders SubTask list / detail / sprint sequence
```

## Test Coverage

- **Schema validation tests** (`ba-subtask-schema.spec.ts`): 3 tests confirming `BaSubTask` model, `BaSubTaskSection` model, and `SubTaskStatus` enum are correctly generated by Prisma.
- **Parser isolation**: `parseMarkdown()` is a pure function (no DB dependency) that can be unit-tested independently of the database.
- **Frontend data-testid attributes**: `subtask-list`, `subtask-card-{id}`, `subtask-detail`, `subtask-detail-page`, `sprint-sequence` -- ready for E2E testing with Playwright.

## Security Measures

- **Input validation**: `UpdateSubTaskSectionDto` uses `class-validator` decorators (`@IsString()`, `@IsNotEmpty()`) to reject empty or malformed section edit payloads.
- **404 handling**: All SubTask endpoints (`getSubTask`, `updateSubTaskSection`, `approveSubTask`) throw `NotFoundException` for invalid IDs, preventing information leakage.
- **Pipeline failure isolation**: SKILL-05 post-processing (parsing, TBD extraction, RTM extension) is wrapped in try-catch. A parsing failure does not block the skill execution from completing -- the raw artifact is always preserved.
- **Immutable AI content**: The `aiContent` field is never modified after creation. Human edits are stored separately in `editedContent`, preserving full audit trail.
- **Duplicate prevention**: SubTask upsert logic checks the `moduleDbId_subtaskId` unique constraint before creating records. TBD extraction checks existing entries before creating duplicates.

## Known Limitations

1. **No SubTask diff between re-runs**: If SKILL-05 is re-run, existing SubTasks are skipped (not updated). There is no diff/merge capability for changed output.
2. **No automated code generation**: SubTasks are the terminal output -- LLD/code-gen from SubTask JSON is deferred to v4+.
3. **No sequence diagram rendering**: Section 21 (Sequence Diagram Inputs) is stored as text but not rendered visually.
4. **Sprint Sequencing is computed, not persistent**: Priority levels are recalculated on each API call from the prerequisites graph. There is no stored sprint plan.
5. **No real-time collaborative editing**: SubTask section editing is single-user. Concurrent edits would result in last-write-wins.
6. **SubTask export is project-level only**: No per-module export endpoint exists (though the data is grouped by module in the output).
7. **Error handling in frontend**: Some catch blocks in frontend components silently ignore errors or use `alert()` for failure notification rather than structured error UI.

## What's Next

Sprint v4+ candidates (from PRD Out of Scope):

- **Automated code generation from SubTasks**: Use the JSON export as input to LLD/code-gen tooling
- **Sequence diagram rendering**: Visualize Section 21 inputs as interactive diagrams
- **SubTask diff between re-runs**: Show what changed when SKILL-05 is re-executed
- **Automated test case generation**: Generate test scaffolds from Section 22 Test Case IDs
- **Real-time collaborative editing**: WebSocket-based concurrent SubTask editing
- **SubTask template customization**: Allow teams to define custom section schemas
- **External tool integration**: Sync SubTasks with Jira, Azure DevOps, or other project management tools

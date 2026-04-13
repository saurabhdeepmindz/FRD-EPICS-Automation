# Sprint v3 — Walkthrough

## Summary

Sprint v3 closes the BA Tool automation pipeline by making SKILL-05 SubTask output a first-class entity in the platform and then extends the artifact viewing experience across EPICs, User Stories, FRDs, and SubTasks with structured, TOC-navigable, markdown-rendered views.

The original 12-task sprint:

- SKILL-05 raw markdown is now parsed into `BaSubTask` records with up to 24 per-section `BaSubTaskSection` rows
- TBD-Future integration references extracted from Section 15 are auto-registered in the TBD-Future Registry
- RTM rows are auto-extended with SubTask IDs, test case IDs, class/file/method metadata
- Frontend gains a SubTask list, a 24-section structured detail page with inline editing, and a Sprint Sequencing view that computes P0/P1/P2/P3 from the prerequisites graph
- SubTasks can be exported as markdown or JSON for downstream code-gen tools

Post-v3 enhancements (9 follow-up items) upgrade artifact presentation and fix several pipeline issues:

- Rewritten FRD parser (new `#### **F-XX-XX: Name**` heading regex + line-by-line `extractField`)
- New structured `EpicArtifactView` with 12 ordered sections plus a collapsible "EPIC Internal Processing" group
- New structured `UserStoryArtifactView` with 26 sections grouped into 5 color-coded categories
- New `MarkdownRenderer` that renders tables, fenced code, lists, headings, and inline formatting (replaces raw `<pre>` blocks everywhere)
- Shared `epic-parser.ts` library used by both the TOC tree and the EPIC view for consistency
- `ArtifactTree` EPIC nodes now render a structured TOC with ring-highlighting on the target section
- `ArtifactContentPanel` routes clicks from the TOC to `EpicArtifactView` / `FrdArtifactView` / `UserStoryArtifactView` with an `activeSectionId` prop
- Module workspace UI now stays on Step 0 when status is `SCREENS_UPLOADED` so users can keep adding descriptions; SubTasks and Sprint Sequence toolbar buttons added
- Export ZIP fixed (archiver CommonJS require), export data query broadened to include `AWAITING_REVIEW` and `COMPLETED`, and `approveExecution()` auto-promotes modules to `APPROVED` on SKILL-05 approval

## Architecture Overview

```
+-------------------------------------------------------------------------------+
|                          Browser (port 3001)                                  |
|                                                                               |
|   Next.js 14 (App Router) + Tailwind + shadcn/ui                              |
|                                                                               |
|   /ba-tool/project/[id]/module/[moduleId]                                     |
|     Toolbar: Screens | Skills 01-05 | SubTasks (step 6) | Sprint Seq (step 7) |
|                                                                               |
|    +---------------+   +-----------------------------------------------+      |
|    | ArtifactTree  |-->| ArtifactContentPanel (routes by artifact type)|      |
|    | (TOC)         |   |                                               |      |
|    |  EPIC ->      |   |  +------------------------------------------+ |      |
|    |   Summary     |   |  | EpicArtifactView (new)                   | |      |
|    |   Biz Context |   |  |  - 12 ordered sections                   | |      |
|    |   ...         |   |  |  - "Internal Processing" collapsible grp | |      |
|    |   [Internal]  |   |  |  - activeSectionId -> scroll + ring      | |      |
|    |    Step 1     |   |  +------------------------------------------+ |      |
|    |    Step 2     |   |  +------------------------------------------+ |      |
|    |   ...         |   |  | UserStoryArtifactView (new)              | |      |
|    |  Story ->     |   |  |  - 26 sections in 5 color-coded groups   | |      |
|    |   26 sections |   |  +------------------------------------------+ |      |
|    |  FRD ->       |   |  +------------------------------------------+ |      |
|    |   F-01-01...  |   |  | FrdArtifactView (structured features)    | |      |
|    |  SubTask ->   |   |  +------------------------------------------+ |      |
|    |   24 sections |   |  +------------------------------------------+ |      |
|    +---------------+   |  | SubTaskDetailView (24 collapsible panels)| |      |
|                        |  +------------------------------------------+ |      |
|                        |                                               |      |
|                        |  All content bodies rendered via              |      |
|                        |  MarkdownRenderer (tables/code/lists/etc.)    |      |
|                        +-----------------------------------------------+      |
|                                                                               |
|   /ba-tool/project/[id]/module/[moduleId]/subtask/[subtaskId]  (new)          |
|     SubTaskDetailView + per-section inline editor                             |
|                                                                               |
+-------------------------------------+-----------------------------------------+
                                      | HTTP (port 4000)
                                      v
+-------------------------------------------------------------------------------+
|                       NestJS Backend (port 4000)                              |
|                                                                               |
|   BaToolController:                                                           |
|     GET  /api/ba/modules/:id/subtasks                                         |
|     GET  /api/ba/subtasks/:id                                                 |
|     PUT  /api/ba/subtasks/:id/sections/:key                                   |
|     POST /api/ba/subtasks/:id/approve                                         |
|     GET  /api/ba/modules/:id/sprint-sequence                                  |
|     GET  /api/ba/projects/:id/export/subtasks?format=md|json                  |
|                                                                               |
|   SubTaskParserService:                                                       |
|     parseAndStore() | parseMarkdown() | parseHeader() | parseSections()       |
|                                                                               |
|   BaSkillOrchestratorService (SKILL-05 post-processing):                      |
|     subtaskParser.parseAndStore()                                             |
|     extractTbdFromSubTasks()                                                  |
|     extendRtmWithSubTasks()                                                   |
|     approveExecution()  -> auto-promote module to APPROVED                    |
|     getExportData() includes APPROVED | AWAITING_REVIEW | COMPLETED           |
|                                                                               |
|   BaExportService:                                                            |
|     exportSubTasks(projectId, format)   (md or json)                          |
|     ZIP export via require('archiver') (CJS interop fix)                      |
|                                                                               |
|   Prisma:                                                                     |
|     BaSubTask   + BaSubTaskSection   + SubTaskStatus enum                     |
|                                                                               |
+-------------------------------------+-----------------------------------------+
                                      | Prisma
                                      v
                          PostgreSQL 16 (ba_subtasks,
                                         ba_subtask_sections, ...)
```

## Files Created / Modified

### Backend

#### 1. `backend/prisma/schema.prisma` (Modified)

Adds SubTask storage.

- `SubTaskStatus` enum: `DRAFT | APPROVED | IMPLEMENTED`
- `BaSubTask` (22 fields: `subtaskId`, `subtaskName`, `subtaskType`, `userStoryId`, `epicId`, `featureId`, `moduleId`, `packageName`, `assignedTo`, `estimatedEffort`, `prerequisites`, `status`, `priority`, `tbdFutureRefs`, `sourceFileName`, `className`, `methodName`, plus FKs + timestamps)
- `BaSubTaskSection` (9 fields: `sectionNumber` 1-24, `sectionKey`, `sectionLabel`, `aiContent` (`@db.Text`, immutable), `editedContent` (`@db.Text?`), `isHumanModified`)
- Compound uniques: `@@unique([moduleDbId, subtaskId])`, `@@unique([subtaskDbId, sectionNumber])`
- Relations wired on `BaModule` and `BaArtifact`

The separation of `aiContent` and `editedContent` enables the "View Original" toggle with a full audit trail.

#### 2. `backend/src/ba-tool/subtask-parser.service.ts` (New)

Dedicated SKILL-05 markdown parser.

- `parseAndStore(rawMarkdown, moduleDbId, artifactDbId)` — top-level; parses, then writes SubTask + section rows (duplicates skipped by unique constraint). Returns created DB IDs.
- `parseMarkdown(rawMarkdown)` — pure, DB-free; split by `/(?=^## (?:SubTask:\s*)?ST-)/m`.
- `parseHeader(chunk)` — regex extraction for SubTask metadata block.
- `parseSections(chunk)` — matches `#### Section N — Label` and maps N to a stable key via `SECTION_MAP`.
- `extractTeam(subtaskId)` — derives FE/BE/IN/QA from `ST-US001-BE-01`-style IDs.

```typescript
const SECTION_MAP: Record<number, { key: string; label: string }> = {
  1: { key: 'subtask_id', label: 'SubTask ID' },
  // ...
  14: { key: 'algorithm', label: 'Algorithm' },
  15: { key: 'integration_points', label: 'Integration Points' },
  // ...
  24: { key: 'testing_notes', label: 'Testing Notes' },
};
```

Prerequisites are extracted from Section 5 by splitting on commas/newlines and filtering for `ST-`-prefixed tokens.

#### 3. `backend/src/ba-tool/ba-skill-orchestrator.service.ts` (Modified)

Wires SKILL-05 completion into the SubTask pipeline, plus orchestrates execution approval.

- SKILL-05 post-processing block in `runSkillAsync()` (wrapped in try/catch so pipeline failures never block execution completion):

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

- `extractTbdFromSubTasks(moduleDbId)` — scans each SubTask's `integration_points` section for `TBD-Future Ref: TBD-NNN`, extracts Called Class and Referenced Module, and registers new `BaTbdFutureEntry` rows (duplicates skipped).
- `extendRtmWithSubTasks(moduleDbId, projectId)` — for each SubTask with a `featureId`, finds the matching `BaRtmRow` and appends `subtaskId`, team, class, file, method, and test case IDs (deduped via `Set`). Creates a new RTM row with a warning log if none matches.
- `approveExecution(executionId)` — validates status is `AWAITING_REVIEW`, marks `APPROVED`, and (for SKILL-05) auto-promotes the parent module's status to `APPROVED`.
- `getExportData(projectId)` — broadened to include executions in `APPROVED | AWAITING_REVIEW | COMPLETED` so export works before explicit approval.

#### 4. `backend/src/ba-tool/ba-tool.service.ts` (Modified)

SubTask CRUD + Sprint Sequencing.

- `listSubTasks(moduleDbId)` — header fields only, ordered by `subtaskId`.
- `getSubTask(id)` — includes sections ordered by `sectionNumber`; 404s if missing.
- `updateSubTaskSection(id, sectionKey, editedContent)` — sets `editedContent` + `isHumanModified = true`; never touches `aiContent`.
- `approveSubTask(id)` — sets `status = APPROVED`, `approvedAt = now()`.
- `getSprintSequence(moduleDbId)` — topological priority from prerequisites:
  - P0 = no prerequisites (or unknown refs), P1 = depends only on P0, P2 = depends on P0+P1, P3 = rest. Returns `{ priorities, dependencies, subtasks }`.

#### 5. `backend/src/ba-tool/ba-tool.controller.ts` (Modified)

| Method | Route | Handler |
|--------|-------|---------|
| GET | `/api/ba/modules/:id/subtasks` | `listSubTasks` |
| GET | `/api/ba/subtasks/:id` | `getSubTask` |
| PUT | `/api/ba/subtasks/:id/sections/:sectionKey` | `updateSubTaskSection` (validated via DTO) |
| POST | `/api/ba/subtasks/:id/approve` | `approveSubTask` |
| GET | `/api/ba/modules/:id/sprint-sequence` | `getSprintSequence` |

#### 6. `backend/src/ba-tool/ba-export.service.ts` (Modified)

- `exportSubTasks(projectId, format)` — queries all SubTasks in the project, groups by module, emits either structured JSON (with `isModified` flags and `editedContent` preferred) or a markdown document with a per-SubTask header table + `#### Section N` blocks (human-modified sections tagged `*(Modified)*`).
- ZIP export fix: replaces broken ESM default import with CommonJS require to load the `archiver` package:

```typescript
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiverFn = require('archiver');
const archive = archiverFn('zip', { zlib: { level: 9 } });
```

- Execution filter broadened to `{ status: { in: [APPROVED, AWAITING_REVIEW, COMPLETED] } }`.

#### 7. `backend/src/ba-tool/dto/update-subtask-section.dto.ts` (New)

`class-validator` DTO: `@IsString() @IsNotEmpty() editedContent: string`. Rejects empty/malformed payloads at the controller boundary.

#### 8. `backend/src/ba-tool/ba-subtask-schema.spec.ts` (New)

Three schema-validation tests: `BaSubTask` model exposure, `BaSubTaskSection` model exposure, and `SubTaskStatus` enum values.

---

### Frontend — Sprint v3 Originals

#### 9. `frontend/lib/ba-api.ts` (Modified)

Types: `BaSubTask`, `BaSubTaskSection`, `SprintSequence`. API functions: `listBaSubTasks`, `getBaSubTask`, `updateBaSubTaskSection`, `approveBaSubTask`, `getSprintSequence`. Helpers: `TEAM_COLORS`, `SKILL_LABELS`.

#### 10. `frontend/components/ba-tool/SubTaskList.tsx` (New)

Clickable cards per SubTask: ID (monospace primary), team badge, truncated name, priority badge, effort, status badge. Empty state "Run SKILL-05 to generate SubTasks".

#### 11. `frontend/components/ba-tool/SubTaskDetailView.tsx` (New)

- Header card with traceability metadata, TBD-Future warning badges, Approve button (DRAFT only).
- `SubTaskSectionPanel` per section: collapsible, edit/view toggle, amber border for Integration Points containing TBD-Future, monospace rendering for algorithm/traceability/project-structure sections, and a "View Original" toggle that shows immutable `aiContent` when a section has been edited.

#### 12. `frontend/components/ba-tool/SprintSequenceView.tsx` (New)

Responsive 4-column grid for P0/P1/P2/P3 (labels: "Must Build First", "Core Logic", "API + Frontend", "Tests"). Nodes link to SubTask detail. Dependencies rendered as prerequisite badges on each node.

#### 13. `frontend/app/ba-tool/project/[id]/module/[moduleId]/subtask/[subtaskId]/page.tsx` (New)

Next.js page: resolves params, fetches via `getBaSubTask`, delegates to `SubTaskDetailView`, with back navigation header and loading/error states.

---

### Frontend — Post-v3 Enhancements

#### 14. `frontend/lib/frd-parser.ts` (Modified)

Three parsing improvements for FRD artifacts:

- New feature-heading regex handles `#### **F-01-01: Name**` (bold-wrapped), `#### F-01-01: Name`, and `#### **F-01-01** — Name` variants.
- `extractField()` rewritten as a robust line-by-line parser that strips leading `- * #` and `**…**`, then matches on a cleaned `label: value` pair:

```typescript
function extractField(block: string, labels: string[]): string {
  const lines = block.split('\n');
  const lowerLabels = labels.map((l) => l.toLowerCase());
  for (const line of lines) {
    const cleaned = line.replace(/^\s*[-*]*\s*/, '').replace(/\*{1,2}/g, '').trim();
    const colonIdx = cleaned.indexOf(':');
    if (colonIdx < 1) continue;
    const lineLabel = cleaned.substring(0, colonIdx).trim().toLowerCase();
    const lineValue = cleaned.substring(colonIdx + 1).trim();
    if (!lineValue) continue;
    for (const target of lowerLabels) {
      if (lineLabel === target || lineLabel.includes(target) || target.includes(lineLabel)) return lineValue;
    }
  }
  return '';
}
```

- Field labels aligned to the actual FRD template: `Feature Description`, `Screen Reference`, `Business Rules`, `Integration Signals`, `Pre-conditions`, `Post-conditions`, `Acceptance Criteria`, etc.

#### 15. `frontend/components/ba-tool/EpicArtifactView.tsx` (New)

Structured EPIC view accepting an `activeSectionId` prop.

- Uses `parseEpicContent` from `lib/epic-parser.ts` to get ordered `sections` and `internalSections`.
- Renders a header card (EPIC ID, name, module, package) and each of the 12 structured sections via a collapsible `EpicSection`.
- `sections` covers: FRD Feature IDs, Summary, Business Context (highlighted as "AUTOMATION CRITICAL"), Key Actors, High-Level Flow, Scope & Classes, Integration Domains, Acceptance Criteria, NFRs, Pre-requisites, Out of Scope, Risks & Challenges.
- A collapsible "EPIC Internal Processing" group at the bottom holds skill-runtime steps (Step 1-7, Output Checklist) sorted numerically via `sortInternalSections`.
- When `activeSectionId` changes, the matching panel scrolls into view, auto-expands, and gets a primary-colored ring:

```tsx
useEffect(() => {
  if (!activeSectionId) return;
  const isInternal = sortedInternalSections.some((s) => s.key === activeSectionId);
  if (isInternal) setInternalExpanded(true);
  const el = document.getElementById(`epic-sec-${activeSectionId}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, [activeSectionId, sortedInternalSections]);
```

- Section bodies are rendered via `MarkdownRenderer` (not raw `<pre>`).

#### 16. `frontend/components/ba-tool/UserStoryArtifactView.tsx` (New)

Structured User Story view for 26 sections.

- Story header with type badges (Frontend/Backend/Integration) and status badges (CONFIRMED/PARTIAL/DRAFT).
- `STORY_SECTION_CONFIG` maps 27 known section keys (`1_user_story_id` … `27_subtasks`) into 5 categories:
  - **header** — Story Identity (blue)
  - **flow** — User Flows & Screens (green)
  - **technical** — Technical Specification (purple)
  - **integration** — Integrations (amber)
  - **testing** — Testing & Traceability (emerald)
- Each category renders as a bordered, color-tinted group with collapsible section panels; section bodies flow through `MarkdownRenderer`.

#### 17. `frontend/components/ba-tool/MarkdownRenderer.tsx` (New)

Lightweight markdown-to-JSX renderer (no external dependency). Replaces the raw `<pre>` blocks previously used across all artifact views.

- Block types: `table`, `code`, `list` (ordered/unordered), `heading`, `paragraph`, `separator`, `empty`.
- Parses pipe tables (`| header | --- | row |`) into real `<table>` elements with alternating row colors, borders, hover, and per-cell decoration:
  - Status values (`CONFIRMED`, `PARTIAL`, `DRAFT`, etc.) rendered as color-coded badges
  - Feature IDs (`F-XX-XX`, `US-XX`, `EPIC-XX`, `ST-XX`, `TBD-XX`, `BR-XX`, `TC-XX`) rendered monospace with primary color
  - `TBD-Future` markers highlighted in amber
- Fenced code blocks preserve language labels.
- Inline formatting: `**bold**`, `*italic*`, `` `code` ``.
- Consumed by `EpicArtifactView`, `UserStoryArtifactView`, `SubTaskDetailView`, and the FRD view — replacing raw markdown dumps with readable tables and structure.

#### 18. `frontend/lib/epic-parser.ts` (New)

Shared EPIC parsing library for cross-component consistency.

- `parseEpicContent(sections)` → `{ header, sections, internalSections }`.
- `EPIC_SECTION_ORDER` defines the 12 canonical EPIC sections with display labels and alternate label lookups (`FRD Feature IDs`, `Summary`, `Business Context`, `Key Actors`, `High-Level Flow`, `Scope`, `Integration Domains`, `Acceptance Criteria`, `NFRs`, `Pre-requisites`, `Out of Scope`, `Risks`).
- `sortInternalSections()` sorts `Step N` entries numerically, then alphabetically — so Step 1, Step 2 … Step 7 precede "Output Checklist".
- Used by both `ArtifactTree` (to build the TOC) and `EpicArtifactView` (to render content), guaranteeing the tree and the panel stay in sync.

#### 19. `frontend/components/ba-tool/ArtifactTree.tsx` (Modified)

TOC-style tree for artifacts.

- EPIC nodes now expand into a structured sub-tree using `parseEpicContent`: top-level sections (Summary, Business Context, …) followed by an "Internal Processing" sub-group containing Step 1-7 + Output Checklist, sorted via `sortInternalSections`.
- Clicking a TOC entry sets `activeSectionId` on the parent, which the content panel uses to scroll + ring-highlight.
- EPIC tree nodes show `AlertTriangle` icons for TBD-Future-tainted sections and a "Critical" badge for Business Context.

#### 20. `frontend/components/ba-tool/ArtifactContentPanel.tsx` (Modified)

Routing layer from artifact type → view component.

- EPIC artifacts → `<EpicArtifactView artifact={...} activeSectionId={activeTreeNode?.sectionId} />`.
- User Story artifacts → `<UserStoryArtifactView artifact={...} activeStorySection={...} />`.
- FRD artifacts → `<FrdArtifactView artifact={...} activeFeatureId={...} />` when a feature TOC entry is clicked.
- SubTask artifacts → `<SubTaskDetailView>`.
- Detects section vs. artifact-level clicks via the tree node payload.

#### 21. `frontend/app/ba-tool/project/[id]/module/[moduleId]/page.tsx` (Modified)

Module workspace UX fixes.

- `statusToStep` mapping: `SCREENS_UPLOADED` now maps to **step 0** (not step 1) so users can keep adding descriptions until they explicitly advance:

```typescript
const statusToStep = {
  DRAFT: 0,
  SCREENS_UPLOADED: 0,   // stay on upload step — user still adding descriptions
  // ...
};
```

- Toolbar adds two new buttons shown when module status is `SUBTASKS_COMPLETE` or `APPROVED`:
  - "SubTasks" → `setActiveStep(6)` → renders `<SubTaskList moduleDbId={mod.id} />`
  - "Sprint Sequence" → `setActiveStep(7)` → renders `<SprintSequenceView moduleDbId={mod.id} projectId={projectId} />`
- Clicking either clears `activeTreeNode` so the right-panel view switches cleanly.

---

## Data Flow

```
User approves SKILL-05 execution
  |
  v
BaSkillOrchestratorService.approveExecution()
  |  Marks execution APPROVED
  |  For SKILL-05, auto-promotes parent module to APPROVED
  v
(pipeline already ran on SKILL-05 completion:)
  runSkillAsync() -> createArtifactFromOutput()  [existing]
    |
    v
  subtaskParser.parseAndStore(humanDocument, moduleDbId, artifactId)
    |  Split markdown by /^## (SubTask: )?ST-/m
    |  parseHeader() -> BaSubTask row (skip duplicates)
    |  parseSections() -> up to 24 BaSubTaskSection rows
    v
  extractTbdFromSubTasks(moduleDbId)
    |  Section 15 (integration_points) scanned for `TBD-Future Ref: TBD-NNN`
    |  New BaTbdFutureEntry rows created
    v
  extendRtmWithSubTasks(moduleDbId, projectId)
       For each SubTask with featureId:
         find BaRtmRow (projectId+moduleId+featureId)
         append subtaskId/team/class/file/method + testCaseIds (Set-dedup)

Frontend
  |
  v
Module workspace polls status
  |
  v
ArtifactTree loads artifacts
  |  EPIC      -> parseEpicContent() -> TOC (12 sections + Internal Processing)
  |  Story     -> 26 sections grouped into 5 categories
  |  FRD       -> features parsed via extractFeatures() (new F-XX-XX regex)
  |  SubTask   -> 24 sections from BaSubTaskSection rows
  v
User clicks a TOC entry -> activeTreeNode with sectionId
  |
  v
ArtifactContentPanel routes to {Epic|UserStory|Frd|SubTask}ArtifactView
  |  Passes activeSectionId / activeFeatureId / activeStorySection
  v
Target view: scrolls target into view, auto-expands, ring-highlights
  Body text rendered through MarkdownRenderer (tables, code, lists, badges)
```

## Test Coverage

- **Schema tests** (`backend/src/ba-tool/ba-subtask-schema.spec.ts`): 3 passing tests — `BaSubTask` model availability, `BaSubTaskSection` model availability, `SubTaskStatus` enum values.
- **Parser isolation**: `parseMarkdown()` is a pure function, trivially unit-testable without a DB; `parseEpicContent()` and `parseFrdContent()` are likewise pure.
- **E2E hooks**: Frontend components expose `data-testid` attributes (`subtask-list`, `subtask-card-{id}`, `subtask-detail`, `subtask-detail-page`, `sprint-sequence`, `epic-artifact-view`) for future Playwright coverage.
- **Still pending**: integration tests for the SKILL-05 pipeline (parser → TBD → RTM) end-to-end; unit tests for `MarkdownRenderer` table/code rendering; E2E flow for the TOC → scroll → ring-highlight interaction.

## Security Measures

- **Input validation at the boundary**: `UpdateSubTaskSectionDto` uses `class-validator` (`@IsString()`, `@IsNotEmpty()`) to reject empty or malformed section edit payloads before the service layer sees them.
- **404-first error handling**: `getSubTask`, `updateSubTaskSection`, `approveSubTask` all throw `NotFoundException` for invalid IDs — no information leakage about internal IDs.
- **Pipeline failure isolation**: SKILL-05 post-processing is wrapped in a try/catch so a SubTask parse/TBD/RTM failure never corrupts or rolls back the already-completed execution and its raw artifact.
- **Immutable AI content**: `aiContent` is written once and never mutated — human edits live in `editedContent` with an `isHumanModified` flag, giving a full audit trail.
- **Duplicate prevention**: `@@unique([moduleDbId, subtaskId])` prevents duplicate SubTasks on re-run; the TBD extractor checks existing `registryId + moduleDbId` before insert; RTM extension deduplicates `testCaseIds` via `Set`.
- **Markdown renderer sanitization**: The `MarkdownRenderer` builds JSX trees directly — no `dangerouslySetInnerHTML`. Inline formatting is tokenized; values flow into React children, preventing XSS from AI-produced markdown.
- **CommonJS interop for archiver**: `require('archiver')` avoids the ESM default-export pitfall that produced a non-callable import under NestJS's ts-node config, preventing runtime crashes during ZIP export.

## Known Limitations

1. **No SubTask diff between re-runs** — unique-constraint skips existing SubTasks; no merge or change-detection on re-execution.
2. **No automated code generation** — SubTask JSON is the terminal output; LLD/code-gen belongs to v4+.
3. **Sequence Diagram Inputs not rendered visually** — Section 21 is stored as text only.
4. **Sprint Sequencing is computed on every request** — no persistent sprint plan; changes to prerequisites instantly reshape priorities.
5. **No real-time collaborative editing** — SubTask section editing is last-write-wins.
6. **Per-module SubTask export missing** — only project-level export exists (though data is grouped by module in output).
7. **Section numbering drift** — older SubTasks stored before the current `SECTION_MAP` use slightly different section keys; the UI renders them but section-key-aware features (inline edit routing) assume the current mapping.
8. **Table parsing is regex-based** — `MarkdownRenderer` handles the common GFM-ish pipe table syntax but is not a full CommonMark parser; exotic markdown constructs (nested tables, HTML blocks, footnotes) degrade to paragraphs.
9. **Frontend error UX is shallow** — some catch blocks use `alert()` or swallow errors rather than showing structured toasts.
10. **Existing `SUBTASKS_COMPLETE` modules needed SQL migration** — a one-off migration was applied to promote previously-completed modules to `APPROVED`; this is not idempotent in automated deploys.

## What's Next (v4 candidates)

- **Streaming SKILL execution output** with live parse-as-you-go into SubTask rows
- **Code generation from SubTask JSON** — wire the export to an LLD/codegen tool and produce Spring Boot / Next.js scaffolds
- **Real-time collaborative SubTask editing** via WebSockets with OT/CRDT merge
- **Mermaid rendering for Section 21** sequence diagrams
- **SubTask diff and merge** between SKILL-05 re-runs
- **Automated test-case scaffolding** from Section 22 Test Case IDs
- **Jira / Azure DevOps sync** for SubTasks as work items
- **Per-module export + download ZIP** combining RTM + TBD + SubTasks for handoff
- **Full-fidelity markdown renderer** — replace the in-house `MarkdownRenderer` with `react-markdown` + `remark-gfm` once bundle size tradeoffs are acceptable
- **Server-side content sanitization** for any future HTML-emitting artifacts

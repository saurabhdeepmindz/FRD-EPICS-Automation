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

---

## Build-Time vs Runtime Architecture

A common confusion when onboarding to this codebase: there are TWO distinct sets of prompt / skill files that serve very different purposes. They live in different folders and are invoked at different lifecycle stages.

### The two layers

```text
┌──────────────────────────────────────────────────────────────────────┐
│  BUILD-TIME (one-time bootstrap — runs OUTSIDE the BA Tool)          │
│  ──────────────────────────────────────────────────────────────────  │
│  Screen-FRD-EPICS-Automation-Skills-Prompt/                          │
│    └── BA-AUTOMATION-TOOL-BUILD-PROMPT.md                            │
│                                                                      │
│  → Fed to a coding AI (Claude Code, Cursor, etc.) ONCE to rebuild    │
│    the entire BA Tool from scratch                                   │
│  → Tells the AI what DB models, API routes, services, React          │
│    components to create                                              │
│  → NOT invoked at runtime — the running app never reads this file    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  RUNTIME (read by the live BA Tool — every skill execution)          │
│  ──────────────────────────────────────────────────────────────────  │
│  Screen-FRD-EPICS-Automation-Skills/                                 │
│    ├── FINAL-SKILL-00-screen-analysis.md                             │
│    ├── FINAL-SKILL-01-S-create-frd-from-screens.md                   │
│    ├── FINAL-SKILL-02-S-create-epics-from-screens.md                 │
│    ├── FINAL-SKILL-04-create-user-stories-v2.md                      │
│    ├── FINAL-SKILL-05-create-subtasks-v2.md                          │
│    └── FINAL-SKILL-SET-ROUTING-GUIDE.md                              │
│                                                                      │
│  → Loaded by BaSkillOrchestratorService.loadSkillFile() at runtime   │
│  → Sent to the Python AI service as the system prompt for each       │
│    skill execution                                                   │
│  → Edited ⇒ behaviour of future SKILL runs changes immediately       │
│    (no redeploy needed)                                              │
└──────────────────────────────────────────────────────────────────────┘
```

### The lifecycle

**Bootstrap (done once):**

```text
Developer opens Claude Code in empty repo
 → Attaches BA-AUTOMATION-TOOL-BUILD-PROMPT.md
 → Attaches the 6 FINAL-SKILL-*.md files (referenced by the build prompt)
 → Prompts: "Read and implement phase by phase"
 → AI generates:
     - backend/prisma/schema.prisma
     - backend/src/ba-tool/ (orchestrator, parser, controllers, services)
     - frontend/app/ba-tool/* + frontend/components/ba-tool/*
     - Copies the 6 FINAL-SKILL-*.md into Screen-FRD-EPICS-Automation-Skills/
       so the runtime orchestrator can load them
```

**Runtime (every day, every skill click):**

```text
User clicks "Run SKILL-00" in the UI
 → POST /api/ba/modules/:id/execute/SKILL-00
 → BaSkillOrchestratorService.executeSkill('SKILL-00')
     └─ loadSkillFile('SKILL-00')
         └─ fs.readFileSync('Screen-FRD-EPICS-Automation-Skills/
                              FINAL-SKILL-00-screen-analysis.md')
     └─ assembleContext(moduleDbId, 'SKILL-00')
     └─ POST to Python AI service:
          {
            systemPrompt: <contents of FINAL-SKILL-00 file>,
            textContent: <assembled module context>,
            images: <screen base64[]>
          }
     └─ OpenAI returns markdown + handoff JSON
     └─ Stored in ba_skill_executions, parsed into ba_artifacts
     └─ Frontend polls and displays in ArtifactTree
```

### Key implication — the skill files are hot-swappable

Because the runtime skill files are read from disk on every execution (not bundled into the AI service Docker image, not cached), a BA can:

1. Edit `FINAL-SKILL-05-create-subtasks-v2.md` — add a new Section 22 requirement, tighten the validation rules, add examples
2. Save the file
3. The next SKILL-05 execution picks up the new prompt — no backend restart required

This is intentional. It lets BAs (not just developers) iterate on AI behaviour without touching code. If the skill file is moved into bundled assets or cached in memory for perf, the hot-swap property is lost.

### Where the build prompt references the runtime skill files

Inside `BA-AUTOMATION-TOOL-BUILD-PROMPT.md` under "Reference Skill Files":

```text
Reference Skill Files (Attached — Read All Before Building)
├─ FINAL-SKILL-00-screen-analysis.md
├─ FINAL-SKILL-01-S-create-frd-from-screens.md
├─ FINAL-SKILL-02-S-create-epics-from-screens.md
├─ FINAL-SKILL-04-create-user-stories-v2.md
├─ FINAL-SKILL-05-create-subtasks-v2.md
└─ FINAL-SKILL-SET-ROUTING-GUIDE.md
```

These are listed as INPUTS the coding AI must read during the build phase, and as FILES it must copy into the repository so the runtime orchestrator can load them. They are the bridge between the two layers.

### Why no `/build-ba-tool` slash command exists

A slash command like `/build-ba-tool` that invokes the build prompt was considered but not created. The build prompt is fed manually to a coding AI outside the BA Tool — it's a one-time operation that doesn't fit the slash-command pattern (which is designed for frequent user actions within a running app). If you do want one, the canonical location would be `.claude/commands/build-ba-tool.md` containing a tiny wrapper prompt: *"Read `BA-AUTOMATION-TOOL-BUILD-PROMPT.md` and the 6 FINAL-SKILL-\*.md files, then implement phase by phase."*

---

# v3 Post‑Post‑Enhancements — 2026‑04‑13 → 2026‑04‑14 Session

The session after the "Build‑Time vs Runtime Architecture" doc layered six user‑facing capabilities on top of v3 without touching the skill pipeline itself. These all live in the **editor + preview + export** surface area, plus one schema migration and a handful of orchestrator hooks that populate RTM as each skill runs instead of only at the end.

## Summary

1. **Project Metadata (Product Name / Client Name / Submitted By / Client Logo)** — captured once per project, threaded through every skill context *and* the PDF / DOCX cover page.
2. **AI Suggest + Mic + blue AI‑text styling** on every editable section of FRD / EPIC / User Story / SubTask, matching the PRD's `FormField` pattern.
3. **Hierarchical section numbers in the Artifact Tree** (`1. Screen Analysis`, `2.1 FRD‑MOD‑01`, `2.1.1 F‑01‑01 Assign Tasks…`, `3.1.i1 Step 1…`) mirroring the PRD preview TOC.
4. **Native‑React Preview page with left sidebar TOC, Document History, and per‑artifact‑type section layout** — replaces the prior iframe approach so Screens, Logo upload, TBD badges, and AI/Edited chips all render in React.
5. **Incremental RTM** — rows now appear after FRD, get linked as EPIC / User Stories / SubTasks complete, plus a `Populate from Artifacts` backfill button for existing projects.
6. **Screens attached to EPIC / User Story / FRD features / SubTask** — only those each artifact actually references; click‑to‑zoom lightbox in the editor and a screens block in the preview / PDF / DOCX.

Plus two bug fixes:

- **Screen upload failure on large modules** — frontend now chunks batch uploads (5 files/request, 5‑minute per‑request timeout) and shows `Uploading screens… N of M` progress.
- **Screen‑ID collision after deletes** — `uploadScreen` now picks `max(existing SCR‑XX suffix) + 1` instead of `count + 1`, so gaps from prior deletes don't produce a duplicate‑key 500.

## Architecture Overview

```
                                ┌────────────────────────────────────────────┐
                                │               Frontend (3001)              │
                                │                                            │
   [Project page] ─────────────▶│  Project Metadata Card  ──▶ PATCH /ba/projects/:id
                                │  Client Logo Upload                         │
                                │                                            │
   [Module workspace] ─────────▶│  ArtifactTree (numbered TOC)                │
                                │  ArtifactContentPanel                       │
                                │    ├─ ArtifactToolbar (Preview/PDF/DOCX)    │
                                │    ├─ FrdArtifactView    + ScreensGallery   │
                                │    ├─ EpicArtifactView   + ScreensGallery   │
                                │    ├─ UserStoryView      + ScreensGallery   │
                                │    └─ SectionCard        (Mic + AI Suggest) │
                                │         └─ AiEditableSection ──▶ POST /ai/ba-refine-section
                                │                                            │
   [Preview page] /ba-tool/preview/[kind]/[id]                                │
                                │  React TOC sidebar  +  Cover (logo upload) │
                                │  Document History  +  Screens  +  Sections │
                                │  Download PDF / DOCX / View Source          │
                                │                                            │
   [RTM page]    ──────────────▶│  Populate from Artifacts  ──▶ POST /ba/projects/:id/rtm/backfill
                                └──────────────┬────────────────────────────┘
                                               │
                                               ▼
                  ┌──────────────────────────────────────────────────────────┐
                  │                    Backend (4000 — Nest)                 │
                  │                                                           │
                  │  BaToolService        — projects (CRUD + metadata)        │
                  │  BaSkillOrchestrator  — skill exec + RTM hooks:           │
                  │      SKILL-01-S → seedRtmFromFrd                          │
                  │      SKILL-02-S → extendRtmWithEpic                       │
                  │      SKILL-04   → extendRtmWithStories                    │
                  │      SKILL-05   → extendRtmWithSubTasks (pre-existing)    │
                  │      + backfillProjectRtm(projectId)                      │
                  │                                                           │
                  │  BaArtifactExportService — HTML template + PDF + DOCX     │
                  │  PdfService.generatePdfFromHtml(html) ◀─── Puppeteer      │
                  │  AiService.refineBaSection(dto)       ──▶ Python /ba/refine-section
                  └───────────────────────────────────┬──────────────────────┘
                                                      │
                                                      ▼
                              ┌───────────────────────────────────────┐
                              │       Python AI (5000 — FastAPI)      │
                              │   POST /ba/refine-section             │
                              │     (preserves IDs/TBD markers)       │
                              └───────────────────────────────────────┘
```

## Files Created/Modified

### ProjectSourceCode/backend/prisma/schema.prisma
**Purpose**: Added project‑level metadata columns used by every exported document.

```prisma
model BaProject {
  // ...
  productName String?   // Required before EPIC generation
  clientName  String?
  submittedBy String?
  clientLogo  String?   @db.Text   // base64 data-URI for preview cover
}
```

Pushed with `prisma db push` (shadow DB perms blocked `migrate dev` — documented in the session). No data migration needed — all columns are nullable.

### ProjectSourceCode/backend/src/ba-tool/dto/update-project.dto.ts (new)
**Purpose**: Partial‑update DTO so the project page can PATCH any subset of the four new fields.

Validates: `MaxLength(200)` on text fields, `MaxLength(500_000)` on `clientLogo` (base64 data‑URI is compressed client‑side to ~200 KB).

### ProjectSourceCode/backend/src/ba-tool/dto/refine-section.dto.ts (new)
**Purpose**: Request shape for the "AI Suggest" refine endpoint. Takes `{ artifactType, sectionLabel, currentText, moduleContext?, instruction? }`.

### ProjectSourceCode/backend/src/ba-tool/ba-tool.controller.ts
**Purpose**: Adds `PATCH /api/ba/projects/:id` (project metadata). Existing `getSubTask` query updated to include `module → project → screens`.

### ProjectSourceCode/backend/src/ba-tool/ba-tool.service.ts
**Purpose**: `updateProject()` with field‑by‑field partial update; `getSubTask` and `getModule` now hydrate `module.project` and `module.screens` for preview/export consumers.

### ProjectSourceCode/backend/src/ba-tool/ba-skill-orchestrator.service.ts
**Purpose**: Two big changes.

**(a) Project metadata flows into every skill's context** (`assembleContext` wrapping):

```ts
const projectMeta = {
  projectName: mod.project?.name ?? null,
  projectCode: mod.project?.projectCode ?? null,
  productName: (mod.project as any)?.productName ?? null,
  clientName:  (mod.project as any)?.clientName ?? null,
  submittedBy: (mod.project as any)?.submittedBy ?? null,
};
// ...
return { ...ctx, projectMeta };
```

So Python prompts (and thus the generated EPIC / User Story / SubTask documents) know the product and client names — no per‑skill wiring needed.

**(b) Incremental RTM population.** After every skill execution, the orchestrator runs the matching RTM hook:

```ts
if (skillName === 'SKILL-01-S') await this.seedRtmFromFrd(...);
else if (skillName === 'SKILL-02-S') await this.extendRtmWithEpic(...);
else if (skillName === 'SKILL-04')   await this.extendRtmWithStories(...);
// SKILL-05 already called extendRtmWithSubTasks in its post‑processing block
```

`seedRtmFromFrd` parses `F‑XX‑XX` blocks from the FRD output (regex `/#{1,4}\s+\*{0,2}(F-\d+-\d+)[:\s—-]+\s*(.+?)\*{0,2}\s*\n([\s\S]*?)(?=...|$)/gi`) and upserts one `BaRtmRow` per feature. `extendRtmWithEpic` parses the `FRD Feature IDs` field and `updateMany` of matching rows with EPIC id/name. `extendRtmWithStories` does the same via each story's `FRD Feature Reference`. All failures are logged but never fail the skill — the raw output is always preserved.

**(c) `backfillProjectRtm(projectId)`** — runs the same four hooks over every module's already‑generated artifacts, so pre‑existing projects populate without re‑running skills. Returns `{ seeded, epics, stories, subtasks }`.

### ProjectSourceCode/backend/src/ba-tool/ba-skill.controller.ts
**Purpose**: Seven new routes.

- `POST /api/ba/projects/:id/rtm/backfill` → orchestrator's backfill
- `GET /api/ba/artifacts/:id/preview` → inline HTML
- `GET /api/ba/artifacts/:id/export/pdf` → Puppeteer PDF
- `GET /api/ba/artifacts/:id/export/docx` → html‑docx‑js DOCX
- `GET /api/ba/subtasks/:id/preview | export/pdf | export/docx` → same three for SubTasks

### ProjectSourceCode/backend/src/ba-tool/ba-artifact-export.service.ts (new)
**Purpose**: Generic artifact → HTML/PDF/DOCX renderer, used by the preview + PDF/DOCX endpoints.

Loads an artifact (or SubTask) with full `module → project → screens` includes, normalises to a `BaArtifactDoc`, runs it through `generateBaArtifactHtml()`, then optionally feeds into Puppeteer or `html‑docx‑js`. Subtask sections (`BaSubTaskSection.sectionNumber` + `aiContent`) get adapted to the same shape as `BaArtifactSection` for template reuse.

### ProjectSourceCode/backend/src/ba-tool/templates/artifact-html.ts (new)
**Purpose**: Generic HTML template for BA artifacts — cover page, Document History, ToC, sections, Referenced Screens block. Includes a minimal markdown → HTML renderer (~150 LOC, no deps) that handles pipe tables, lists, headings, code fences, bold/italic/inline code, blockquotes, IDs, and TBD‑Future highlighting.

Cover page renders `doc.project.clientLogo` as an `<img>` at the top if present. The Referenced Screens block filters `module.screens` down to only those mentioned in any section's content, for FRD / EPIC / USER_STORY / SUBTASK (Screen Analysis is excluded because it *is* the screens).

### ProjectSourceCode/backend/src/ai/ai.controller.ts / ai.service.ts
**Purpose**: New `POST /api/ai/ba-refine-section` proxy that wraps the Python `/ba/refine-section` endpoint. Lets the frontend call a single BA‑aware "AI Suggest" endpoint instead of trying to reuse the PRD‑coupled `/ai/suggest`.

### ProjectSourceCode/ai-service/main.py
**Purpose**: New Python endpoint `POST /ba/refine-section` using a BA‑tuned system prompt:

```text
You are a senior business analyst and technical writer.
You refine, correct and improve a single section of a BA deliverable (FRD, EPIC,
User Story, or SubTask) while preserving its intent, factual content and any
identifiers (like F-01-01, EPIC-MOD-01, FR-xxx, TBD-Future markers, module IDs).
Rules: preserve IDs and TBD markers verbatim; don't invent features;
return ONLY the refined text — no preamble, no code fences.
```

Temperature 0.3, max_tokens 3000.

### ProjectSourceCode/backend/src/export/pdf.service.ts
**Purpose**: Extracted `generatePdfFromHtml(html, { headerLabel })` for reuse by both the PRD and BA‑Tool export paths. PRD path still goes through `generatePdf(prd, history)`, which now delegates to the new method after building the HTML. Puppeteer launch config (headless, sandbox flags) and header/footer templates are unchanged.

### ProjectSourceCode/backend/src/export/export.module.ts
**Purpose**: Added `exports: [PdfService]` so `BaToolModule` can import and reuse the same Puppeteer launcher (no second Chromium instance).

### ProjectSourceCode/backend/src/ba-tool/ba-tool.module.ts
**Purpose**: `imports: [ExportModule]` and registered `BaArtifactExportService`.

### ProjectSourceCode/frontend/lib/ba-api.ts
**Purpose**: Types + API helpers for every new backend capability.

Added `BaProject.productName/clientName/submittedBy/clientLogo`, `BaScreenLite`, `BaModule.project`, `BaModule.screens`, `UpdateBaProjectDto`, `BaRefineSectionPayload`. New helpers:

- `updateBaProject(id, payload)` — PATCH metadata (incl. logo as base64)
- `baRefineSection({ artifactType, sectionLabel, currentText, moduleContext })` — wire the AI Suggest button
- `uploadBaScreensBatch(moduleDbId, files, onProgress)` — now **chunks into 5 files per request with 5‑minute per‑request timeout** and reports progress

### ProjectSourceCode/frontend/app/ba-tool/project/[id]/page.tsx
**Purpose**: Adds the "Project Metadata" card (Product Name*, Client Name, Submitted By) with edit/save/cancel, and an amber "Please fill in the required fields" banner when Product Name is empty. Blocks EPIC generation downstream by propagating metadata through `getArtifact` / `getModule`.

### ProjectSourceCode/frontend/app/ba-tool/project/[id]/module/[moduleId]/page.tsx
**Purpose**: Passes `moduleScreens={mod.screens}` into `ArtifactContentPanel` so structured artifact views can show thumbnails. Added an amber guard banner + `canStart` gate for step 3 (EPIC) when `productName` is empty.

### ProjectSourceCode/frontend/app/ba-tool/project/[id]/module/[moduleId]/subtask/[subtaskId]/page.tsx
**Purpose**: Preview / PDF / DOCX buttons on the SubTask detail page header.

### ProjectSourceCode/frontend/app/ba-tool/project/[id]/rtm/page.tsx
**Purpose**: New **Populate from Artifacts** button next to Export CSV. Calls `POST /api/ba/projects/:id/rtm/backfill`, shows an alert summarising `seeded / epics / stories / subtasks`, then reloads the table.

### ProjectSourceCode/frontend/app/ba-tool/preview/[kind]/[id]/page.tsx (new)
**Purpose**: Native‑React preview page — the centrepiece of the session.

- **Left sidebar TOC** with Cover Page, Document History, (conditional) Screens, and then numbered sections computed from `doc.artifactType` using the *same parsers the editor views use*:
  - `FRD` → `parseFrdContent` → one entry per `F‑XX‑XX` feature + Business Rules/Validations/TBD Registry/Internal Processing group
  - `EPIC` → `parseEpicContent` + `sortInternalSections` → 12 structured sections + EPIC Internal Processing group
  - `USER_STORY` → `STORY_SECTION_CONFIG` + `CATEGORY_LABELS` → grouped (Story Identity, User Flows & Screens, Technical Specification, Integrations, Testing & Traceability)
  - `SUBTASK` / `SCREEN_ANALYSIS` → raw sections in stored order
- **Cover page** with "Click to upload Client Logo" dashed box (client‑side canvas resize to 400 px PNG, then PATCH), Product Name / Project Code / Module / Client Name / Submitted By / Date / Status chip.
- **Document History** table (last 50 AI / Edited entries, coloured badges).
- **Referenced Screens** block (conditional, only shows when the artifact references ≥1 screen).
- **Section bodies** via `MarkdownRenderer` with AI (blue text) / Edited (amber) styling preserved, `Automation Critical` and `TBD‑Future` pill badges on applicable sections.
- **Toolbar**: Source (raw backend HTML in new tab), PDF, DOCX — all streaming blobs from the backend.

### ProjectSourceCode/frontend/components/ba-tool/ScreensGallery.tsx (new)
**Purpose**: Reusable thumbnail grid + click‑to‑zoom lightbox. Used by EPIC / User Story / FRD views and the preview page. Helper `extractScreenIds(text)` scans any content block for `SCR-XX` mentions; `filterReferencedScreens(screens, blocks)` returns only the matching screens.

### ProjectSourceCode/frontend/components/ba-tool/AiEditableSection.tsx (new)
**Purpose**: Drop‑in editor with **Mic button + AI Suggest button + Edit/Save/Cancel + blue AI‑text styling**. Resolves its backing `BaArtifactSection` via a caller‑supplied `findSection(sections)` predicate, so the same component works for FRD / EPIC / User Story (each uses a different section key or label match).

### ProjectSourceCode/frontend/components/ba-tool/ArtifactTree.tsx
**Purpose**: Hierarchical section numbers (`1.`, `1.1`, `1.1.1`, `1.1.i1` for internal processing) inside the tree. Numbers rendered in a muted `font-mono` span before each label so existing IDs (F‑XX‑XX, SCR‑XX) and status pills still visible.

### ProjectSourceCode/frontend/components/ba-tool/ArtifactContentPanel.tsx
**Purpose**: Big component — orchestrates every structured editor view.

- Adds `moduleScreens` prop + `withScreens(artifact)` helper that splices screens into every artifact passed down, since `getModule`'s shape doesn't include them.
- Adds an `ArtifactToolbar` (Preview / PDF / DOCX) above each structured view.
- `SectionCard` (generic/fallback) now has **Mic + AI Suggest** in the header, blue text + helper line for AI content.

### ProjectSourceCode/frontend/components/ba-tool/FrdArtifactView.tsx
**Purpose**: FRD feature cards now:
- Show a **compact thumbnail grid** right under each feature's `Screen Reference` field, filtered to the exact SCR‑XX IDs that feature cites.
- `CollapsibleSection` (Business Rules / Validations / TBD Registry) renders via `AiEditableSection` so tables format properly and each card has Mic + AI Suggest + blue/amber styling.
- Step N / Introduction / Output Checklist etc. now grouped under a collapsed **FRD Internal Processing** panel.

### ProjectSourceCode/frontend/components/ba-tool/EpicArtifactView.tsx
**Purpose**: Module Screens card at the top (only screens actually referenced by any EPIC section). Every `EpicSection` wraps its content in `AiEditableSection` with `findSection` matching by `sectionKey` or label.

### ProjectSourceCode/frontend/components/ba-tool/UserStoryArtifactView.tsx
**Purpose**: Top‑level "Referenced Screens" card. Exposes `STORY_SECTION_CONFIG` and `CATEGORY_LABELS` as `export` so the preview page can reuse them. `StorySectionCard` now wraps content in `AiEditableSection` matching by `sectionKey`. Section 14 (Screen Reference) renders only the specifically cited screens in a compact thumbnail row.

### ProjectSourceCode/frontend/components/ba-tool/ScreenUploader.tsx
**Purpose**: Upload reliability. Progress counter (`Uploading screens… N of M`) in the drop‑zone, chunked uploads via the new `uploadBaScreensBatch(onProgress)`. On failure the list is still reloaded so partially‑committed screens show, and the alert surfaces the actual HTTP error message instead of a generic failure.

## Data Flow

**Creating a new project and running the skill pipeline with incremental RTM:**

1. User creates project → fills in Product Name / Client Name / Submitted By on project page → `PATCH /api/ba/projects/:id`.
2. User opens module, uploads screens → chunked 5/request.
3. User runs SKILL‑00 (Screen Analysis), SKILL‑01‑S (FRD).
4. **Immediately after FRD finishes**: orchestrator parses features and writes 6 rows into `BaRtmRow`. RTM page shows Feature + Module columns populated.
5. User runs SKILL‑02‑S (EPIC). Orchestrator parses `FRD Feature IDs` and `updateMany` → EPIC column fills in.
6. User runs SKILL‑04 (User Stories). Orchestrator parses each story's `FRD Feature Reference` → Story columns fill in.
7. User runs SKILL‑05 (SubTasks). Pre‑existing hook fills SubTask / Team / Class / Source File / Test Cases / TBD columns.

**Viewing a generated EPIC:**

1. User clicks EPIC in tree → `ArtifactContentPanel` routes to `EpicArtifactView` with `withScreens(artifact)`.
2. Top card shows Referenced Screens filtered via `filterReferencedScreens`.
3. Each structured section (Summary, Business Context, …) rendered via `AiEditableSection`. User clicks "AI Suggest" → `POST /api/ai/ba-refine-section` → Python refines → response populates the textarea → user clicks Save → `updateArtifactSection`.

**Previewing + downloading:**

1. User clicks Preview in the toolbar → `/ba-tool/preview/artifact/:id` opens in a new tab.
2. Page fetches `getArtifact(id)` (now includes `module.project` and `module.screens`).
3. React renders cover + Document History + Screens + sections via the per‑type TOC computation.
4. User clicks PDF → `GET /api/ba/artifacts/:id/export/pdf` → backend renders HTML → Puppeteer → PDF blob streamed back → browser downloads.

## Test Coverage

No unit tests were added in this session. Verification was end‑to‑end smoke testing against a real project:

- `GET /api/ba/artifacts/6d0dedce.../preview` → `200`, HTML contains 3 `screen-tile` blocks matching FRD‑MOD‑01's SCR‑01 / 03 / 04 references.
- `GET /api/ba/artifacts/2ea0ced8.../preview` (EPIC) → only SCR‑01 referenced (correct).
- `POST /api/ba/projects/3c5d3ded.../rtm/backfill` → `{seeded: 6, epics: 3, stories: 3, subtasks: 16}` on the live Tax Compass project.
- Puppeteer PDF of FRD‑MOD‑01 → 461 KB, header label "Functional Requirements Document — FRD-MOD-01_MOD-01", cover page and ToC intact.

## Known Limitations

- **Document History is synthesized**, not a true audit log. It's reconstructed from each section's `createdAt/updatedAt` and `isHumanModified/aiGenerated` flags. If you need a line‑by‑line revision trail like PRD's `PrdAuditLog`, you'll want a new `BaArtifactAuditLog` model.
- **`prisma migrate dev` still blocked** by shadow DB permissions — session used `prisma db push`. Production deploys need the shadow DB grant or a proper migration folder.
- **AI Suggest is not streamed** — the user waits for the full refined text. Streaming would need a Python SSE endpoint and Nest proxy with `StreamingResponse`.
- **Screen references are string‑matched** (`SCR-\d+`). If a BA writes "SCR-1" (no zero‑pad) or "Screen 3", it won't resolve. The parser is easy to extend but right now is strict.
- **Chunked upload is sequential**, not parallel — upload time is bounded by sum of chunk durations. Fine for 20–50 screens, could be improved with `Promise.all` for chunks of non‑overlapping file sets.
- **No visual indicator that RTM is being populated** after a skill run — the orchestrator logs say "RTM: seeded N rows" but the RTM page doesn't auto‑refresh. User has to re‑open it or hit Populate from Artifacts.
- **The backend Nest watch intermittently dies with EADDRINUSE when a previous process lingers** — the fix is `taskkill /PID <N> /F && NODE_OPTIONS="--max-old-space-size=4096" npm run start:dev`.

## What's Next

- **Real audit log** → new `BaArtifactAuditLog` Prisma model mirroring `PrdAuditLog`, written from `updateArtifactSection`. Document History would then show actual change entries with `before → after` diffs.
- **Streaming AI Suggest** via SSE so long refinements feel live.
- **RTM live‑refresh** (SSE or WebSocket) so the user doesn't have to reload after each skill.
- **Screen‑reference resolver** that normalises `SCR-1`, `Screen 3`, `Signup Screen` to canonical SCR‑XX via fuzzy match on `screenTitle`.
- **Parallel chunked uploads** (3–4 chunks concurrent) to cut upload time on large projects.
- **Full Puppeteer pool** for concurrent PDF generation — currently each request launches its own Chromium, which is slow at volume.

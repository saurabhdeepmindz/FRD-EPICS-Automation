# Sprint v4 — Tasks: Architect Workspace — LLD Generation from EPICs / User Stories / SubTasks

## Status: Draft — awaiting go-ahead before any code is written

> **Persona note**: All v4 features target the **Architect** role. Where tasks and acceptance criteria say "Architect", read it as "the user acting in the Architect role" — v4 introduces no auth boundary. BA features from v1–v3 are untouched.

---

## Phase v4.0 — Architect Console Foundation (Must Have — BE + FE)

Objective: ship a working Architect Console (internal name: Master Data admin) that is independently usable before any LLD feature is wired. Every dropdown the LLD configurator will need is populated here first. The page surfaces as **Architect Console** / **Design Standards** in the UI; internal route + Prisma models keep the existing `Ba*` naming for code continuity.

### P0 Backend

- [ ] **Task 1: Add `BaMasterDataEntry`, `BaTemplate`, `BaTemplateModifier`, `BaMasterDataCategory`, `BaMasterDataScope` to Prisma schema** (P0-BE)
  - Acceptance: Migration adds the five new models / enums as defined in PRD §Data Model Changes; no existing column is renamed or dropped; `npx prisma db push` succeeds; `npx prisma generate` produces the new client types; uniqueness constraint `[category, scope, projectId, name]` on `BaMasterDataEntry` is present.
  - Algorithm: edit `schema.prisma`; add enums first, then `BaMasterDataEntry` and `BaTemplate` with self-relation for lineage; run `db push`; run `generate`.
  - Files: `backend/prisma/schema.prisma`

- [ ] **Task 2: Add `lldCompletedAt` and `lldArtifactId` nullable columns on `BaModule`, plus `LLD` variant on `BaArtifactType` enum** (P0-BE)
  - Acceptance: Columns are nullable; no existing `BaModule` rows fail to load; `BaArtifactType` enum gains `LLD` without renaming any existing variant.
  - Files: `backend/prisma/schema.prisma`

- [ ] **Task 3: Seed-data bundle for tech-stack master data (templates NOT bundled)** (P0-BE)
  - Acceptance: A new directory `Screen-FRD-EPICS-Automation-Skills-Prompt/master-data/` contains **eight JSON files**, one per tech-stack category, with these minimum seed values:
    - `frontend-stack.json` — React, Vue, Angular, Next.js, Svelte
    - `backend-stack.json` — NestJS, Spring Boot, Django, FastAPI, Express
    - `database.json` — PostgreSQL, MongoDB, MySQL, SQLite, MariaDB
    - `streaming.json` — Kafka, RabbitMQ
    - `caching.json` — Redis, Memcached
    - `storage.json` — MinIO, S3, Azure Blob, GCS
    - `cloud.json` — AWS, Azure, GCP
    - `architecture.json` — Modular Monolith, Microservices, Event-Driven
  - **No template files are bundled** (Project Structure / Backend Template / Frontend Template / LLD Template / Coding Guidelines categories ship empty — the Architect uploads them via UI).
  - Algorithm:
    1. Author the eight JSON files listed above; each entry has `{ name, value, description }`
    2. Document the loader contract at the top of each JSON file (format version, category semantics)
    3. Leave the `templates/` subdirectory empty or omit it entirely — reinforce that templates are UI-uploaded
  - Files: `Screen-FRD-EPICS-Automation-Skills-Prompt/master-data/*.json` (8 new files)

- [ ] **Task 4: `BaMasterDataService` — CRUD + seed loader + dedupe + promote** (P0-BE)
  - Acceptance: Service exposes `list(category, projectId?)`, `get(id)`, `create(dto)`, `update(id, dto)`, `archive(id)`, `promoteToGlobal(id)`, `bulkInsert(entries)`, `reseed(category?)`, `fuzzyMatch(category, name, projectId)`; `list` returns merged global + project entries with project overriding global on same `name`; `fuzzyMatch` returns candidates with Levenshtein ≤3; `reseed` and `bulkInsert` accept **tech-stack categories only** and throw `BadRequestException` for template categories.
  - Algorithm:
    1. On boot (`onModuleInit`), for each of the 8 tech-stack categories: check if any `BaMasterDataEntry` rows with scope=GLOBAL exist for that category; if none, read the matching JSON file under `master-data/` and insert as GLOBAL entries. Template categories are **never auto-seeded**.
    2. `fuzzyMatch`: load all entries for category+scope (global ∪ project), compute Levenshtein distance between `name.toLowerCase()` and each existing entry's `name.toLowerCase()`; return top 3 with distance ≤3.
    3. `create` first calls `fuzzyMatch` unless the caller passes `force: true`; returns 409 `{ suggestions: [...] }` if matches exist.
    4. `promoteToGlobal` clones the row with `scope=GLOBAL`, `projectId=null`, preserves `name / value / description / templateId`; archives the project-scoped original.
    5. `reseed(category)` archives all GLOBAL entries for the tech-stack category then re-loads from bundled JSON; no-op / 400 for template categories.
    6. Export a helper `isTechStackCategory(category): boolean` for the controller to gate bulk-upload / reseed endpoints.
  - Files: `backend/src/ba-tool/ba-master-data.service.ts` (new), `backend/src/ba-tool/ba-tool.module.ts` (register), `backend/src/main.ts` (confirm onModuleInit runs)

- [ ] **Task 5: `BaMasterDataController` — REST endpoints** (P0-BE)
  - Acceptance: All endpoints from PRD §BaMasterDataController are wired; DTO validation enforces `category` enum membership, `name` length ≤200, `scope` enum; `POST /master-data/:id/promote` requires `isAdmin` header flag (stub auth for v4); `POST /master-data/bulk` and `POST /master-data/reseed` enforce tech-stack-only via the service helper and return 400 on template categories; returns typed responses.
  - Algorithm: standard Nest controller; DTOs live under `backend/src/ba-tool/dto/master-data/*.dto.ts`.
  - Files: `backend/src/ba-tool/ba-master-data.controller.ts` (new), `backend/src/ba-tool/dto/master-data/*.dto.ts` (new)

- [ ] **Task 5b: `BaTemplateUploadController` / endpoint — single-file + folder/zip upload** (P0-BE)
  - Acceptance: `POST /api/ba/templates/upload` accepts `multipart/form-data` with fields `{ category, name, description?, scope, projectId?, file }`; for `PROJECT_STRUCTURE`, `file` may be `application/zip` or a concatenated directory upload (multi-file form); for the other four template categories, `file` is a single text file (`.md`, `.txt`, or any UTF-8-decodable); server reads content, creates a `BaTemplate` row (`lastModifiedBy: HUMAN`, `version: 1`, no `parentTemplateId`), and a linked `BaMasterDataEntry` row pointing at the new template; 413 (Payload Too Large) if the zip exceeds 5 MB or any single file exceeds 1 MB.
  - Algorithm:
    1. Accept multipart; validate `category` is a template category
    2. For zip uploads: unzip in memory, walk entries, build a Markdown representation of the tree (e.g. `src/\n  modules/\n    invoice/\n      invoice.controller.ts\n  ...`) with per-file annotation lines from any `.meta` companion files
    3. For single-file uploads: read text content directly
    4. Create `BaTemplate` with `content = <markdown or raw text>`, `category`, `scope`, `projectId`
    5. Create `BaMasterDataEntry` with `category`, `scope`, `projectId`, `name`, `templateId`
    6. Return the created `BaMasterDataEntry` with nested template
  - Files: extend `backend/src/ba-tool/ba-master-data.controller.ts` or new `backend/src/ba-tool/ba-template-upload.controller.ts`, DTO under `backend/src/ba-tool/dto/master-data/`

- [ ] **Task 6: `BaTemplateService` — CRUD + lineage helpers** (P0-BE)
  - Acceptance: Service exposes `list(category, scope, projectId?)`, `get(id)`, `create(dto)`, `fork(parentId, projectId, edits)`, `recordAiImprovement(parentId, newContent, projectId)`; both fork methods set `parentTemplateId` and `lastModifiedBy` correctly; forked template always lands at scope=PROJECT regardless of parent scope.
  - Files: `backend/src/ba-tool/ba-template.service.ts` (new)

- [ ] **Task 7: `BaTemplateController` — REST endpoints** (P0-BE)
  - Acceptance: `GET /api/ba/templates?category=…&projectId=…`, `GET /api/ba/templates/:id`, `POST /api/ba/templates`, `PATCH /api/ba/templates/:id` (creates a fork), `GET /api/ba/templates/:id/lineage` (returns ancestor chain).
  - Files: `backend/src/ba-tool/ba-template.controller.ts` (new)

### P0 Frontend

- [ ] **Task 8: `ba-api.ts` — types + helpers for master data + templates** (P0-FE)
  - Acceptance: Adds `BaMasterDataEntry`, `BaTemplate`, `BaMasterDataCategory` (13 variants — FRONTEND_STACK, BACKEND_STACK, DATABASE, STREAMING, CACHING, STORAGE, CLOUD, ARCHITECTURE, PROJECT_STRUCTURE, BACKEND_TEMPLATE, FRONTEND_TEMPLATE, LLD_TEMPLATE, CODING_GUIDELINES), `BaMasterDataScope`, `BaTemplateModifier`, and a helper `isTechStackCategory(cat): boolean`; corresponding `list*`, `create*`, `update*`, `promote*`, `fuzzyMatch*`, `bulkInsert*`, `reseed*`, `listTemplates`, `uploadTemplate(file, meta)`, `uploadTemplateFolder(zipOrFiles, meta)`, `forkTemplate`, `getTemplateLineage` helpers.
  - Files: `frontend/lib/ba-api.ts`

- [ ] **Task 9: Architect Console page** (P0-FE)
  - Acceptance: Route `/ba-tool/project/[id]/master-data` renders with the page title **Architect Console — Design Standards**; **thirteen category tabs** split into two visually-grouped sections:
    - *Tech Stack* — Frontend / Backend / Database / Streaming / Caching / Storage / Cloud / Architecture
    - *Templates* — Project Structure / Backend Template / Frontend Template / LLD Template / Coding Guidelines
  - Each list shows name, description, scope badge (GLOBAL / PROJECT), `lastModifiedBy`, created date;
  - **Tech-stack tabs** show `+ Add` (opens inline value-add form), `Reset category from bundle` (confirm dialog), `Bulk Upload JSON`;
  - **Template tabs** show `+ Upload Template` (opens upload dialog — single file for 4 of them, folder/zip for Project Structure); no Reset or Bulk Upload actions on template tabs; empty-state message "No templates uploaded. Click + Upload Template to add one.";
  - `Promote to Global` action visible on PROJECT entries in both sections;
  - Dedupe prompt appears before save when fuzzy match exists ("Did you mean `React`?" with Use / Create Anyway options);
  - Breadcrumb reads "Project / Architect Console".
  - Files: `frontend/app/ba-tool/project/[id]/master-data/page.tsx` (new), `frontend/components/ba-tool/ArchitectConsoleTable.tsx` (new), `frontend/components/ba-tool/AddMasterDataDialog.tsx` (new), `frontend/components/ba-tool/BulkUploadDialog.tsx` (new), `frontend/components/ba-tool/UploadTemplateDialog.tsx` (new)

- [ ] **Task 10: Templates admin sub-page (inside Architect Console)** (P0-FE)
  - Acceptance: On the Architect Console page, template-backed categories (`BACKEND_TEMPLATE`, `FRONTEND_TEMPLATE`, `LLD_TEMPLATE`, `CODING_GUIDELINES`, `PROJECT_STRUCTURE`) render with an extra button **View / Edit Template** that opens a template editor; editor shows content, lineage trail (ancestor chain), fork-on-save behaviour; `lastModifiedBy` automatically becomes `HUMAN` on save.
  - Files: `frontend/components/ba-tool/TemplateEditor.tsx` (new), extensions to `ArchitectConsoleTable.tsx`

- [ ] **Task 11: Link to Architect Console from project header** (P0-FE)
  - Acceptance: Project header gains a new **Architect Console** button next to the existing `RTM` and `TBD Registry` buttons, routing to `/ba-tool/project/[id]/master-data`. Icon conveys "design standards" (e.g. ruler / compass).
  - Files: `frontend/app/ba-tool/project/[id]/page.tsx`

---

## Phase v4.1 — LLD Skill + Architect Configurator + Viewer (Must Have — after v4.0)

### P0 Skill File

- [ ] **Task 12: Author `FINAL-SKILL-06-create-lld.md`** (P0)
  - Acceptance: Markdown file follows the same structural pattern as the existing FINAL-SKILL-*.md files; **system prompt opens with "You are a senior software architect…"**; explicitly mandates RTM citations in every class/method docstring and forbids hallucinated IDs; output contract section specifies the exact LLD section order (matching PRD §LLD Document Section Structure) and the pseudo-file fenced-block format; example output fragment included for reference; prompt explicitly calls out that the skill should write from the perspective of an architect producing a handover to developers.
  - Files: `Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-06-create-lld.md` (new)

### P0 Backend

- [ ] **Task 13: Register SKILL-06-LLD in orchestrator** (P0-BE)
  - Acceptance: `SKILL_ORDER` gains `SKILL-06-LLD`; `loadSkillFile()` resolves the new file; `SKILL_STATUS_MAP` does NOT add a new `BaModuleStatus` entry (LLD completion tracked by `BaModule.lldCompletedAt`); `assembleContext` routes to the new `assembleSkill06Context` branch.
  - Files: `backend/src/ba-tool/ba-skill-orchestrator.service.ts`

- [ ] **Task 14: `assembleSkill06Context()` in orchestrator** (P0-BE)
  - Acceptance: Packs `{ projectMeta, moduleId, moduleName, packageName, epicHandoffPacket, storyHandoffPacket?, subtaskHandoffPacket?, rtmRows, tbdFutureRegistry, lldConfig: { stacks: { frontend, backend, database, streaming, caching, storage, cloud, architecture }, cloudServices, templates, nfrValues, customNotes }, resolvedTemplates: { backend?, frontend?, lld?, codingGuidelines?, projectStructure? } }`; resolves master-data IDs to actual `{ name, value, description }` objects; **null / missing** for any stack or template category the Architect didn't select — Python must handle nulls gracefully and fall back to best practices; `cloudServices` passed through as verbatim string; embeds full template body (not just id) for selected templates so Python can use them directly.
  - Files: `backend/src/ba-tool/ba-skill-orchestrator.service.ts`

- [ ] **Task 15: Post-SKILL-06 parser — `BaLldParserService`** (P0-BE)
  - Acceptance: `parseLldOutput(rawMarkdown, moduleDbId, artifactDbId)` creates (a) a `BaArtifact` of type `LLD` with `BaArtifactSection` per LLD section (15+ sections as listed in PRD), (b) `BaPseudoFile` rows per fenced code block in the output, parsing the path from the fence header (e.g. ` ```java path=backend/controllers/InvoiceController.java `); skips files with duplicate paths (warning); file count ≥5 on a typical module.
  - Algorithm:
    1. Split markdown into LLD document part (before `## Pseudo-Code Files`) and file-tree part (after).
    2. For the document part, split on `## ` headings; map heading text to canonical section key (case-insensitive fuzzy); store each as `BaArtifactSection` with `sectionKey` and `sectionLabel` and `displayOrder`.
    3. For the file-tree part, walk every fenced code block; parse the fence info string for `path=<relative>` and `language` (defaulting to the fence tag); create `BaPseudoFile` with `aiContent`, `path`, `language`.
    4. Set `BaModule.lldCompletedAt = new Date()` and `lldArtifactId = artifact.id`.
    5. Log counts: `LLD: created artifact with N sections + M pseudo files`.
  - Files: `backend/src/ba-tool/ba-lld-parser.service.ts` (new)

- [ ] **Task 16: `BaLldController` — config + trigger + fetch** (P0-BE)
  - Acceptance: All endpoints from PRD §BaLldController implemented; `POST /generate-lld` invokes the orchestrator the same way `executeSkill` does for other skills; returns an `executionId`; polling via existing `/api/ba/modules/:id/execution/:execId` works; `PUT /lld/config` upserts `BaLldConfig`.
  - Files: `backend/src/ba-tool/ba-lld.controller.ts` (new), `backend/src/ba-tool/ba-lld.service.ts` (new if needed)

- [ ] **Task 17: Hot-wire existing preview / export pipeline for `artifactType === 'LLD'`** (P0-BE)
  - Acceptance: `BaArtifactExportService.loadArtifactDoc` handles LLD artifacts same as FRD/EPIC; the `renderScreensBlock` helper returns empty string for LLD (LLD doesn't reference screens); HTML template renders all LLD sections and, if any `BaPseudoFile` rows exist for the artifact, renders a new "Pseudo-Code Files" appendix section listing the tree.
  - Files: `backend/src/ba-tool/ba-artifact-export.service.ts`, `backend/src/ba-tool/templates/artifact-html.ts`

### P0 Frontend

- [ ] **Task 18: `ba-api.ts` — types + helpers for LLD config, trigger, artifact, pseudo files** (P0-FE)
  - Acceptance: Adds `BaLldConfig` (with `frontendStackId`, `backendStackId`, `databaseId`, `streamingId`, `cachingId`, `storageId`, `cloudId`, `architectureId`, `cloudServices`, `projectStructureId`, `backendTemplateId`, `frontendTemplateId`, `lldTemplateId`, `codingGuidelinesId`, `nfrValues`, `customNotes`), `BaPseudoFile`, `NfrValue`, `generateLld`, `getLldConfig`, `saveLldConfig`, `getLld`, `listPseudoFiles`, `getPseudoFile`, `savePseudoFile` helpers.
  - Files: `frontend/lib/ba-api.ts`

- [ ] **Task 19: Architect LLD Configurator page** (P0-FE)
  - Acceptance: Route `/ba-tool/project/[id]/module/[moduleId]/lld` renders with page title **Architect — Generate LLD**; layout has three visually-grouped sections:
    - *Tech Stack* (8 dropdowns) — Frontend / Backend / Database / Streaming / Caching / Storage / Cloud / Architecture, each with inline **+ Add new** action that opens the dedupe-checked create dialog;
    - *Cloud Services* — a free-text area bound to `BaLldConfig.cloudServices` with placeholder "e.g. Lambda, SQS, DynamoDB, CloudFront";
    - *Templates* (5 dropdowns) — Project Structure / Backend Template / Frontend Template / LLD Template / Coding Guidelines. Each dropdown always renders with `(none — use AI best practices)` as the first option plus any uploaded templates for the project; an inline **Upload template…** action links to the Architect Console upload flow and returns on completion (with the newly-uploaded template pre-selected);
    - *NFR editor* — reuses PRD NFR categories (Scalability / Security / Performance / Responsive) as rows with free-text value fields + **+ Add NFR** for custom;
  - Input summary shows which upstream artifacts are available (EPIC ✓ / US ✓ or – / SubTask ✓ or –); **Generate LLD** button disabled if `moduleStatus ≠ EPICS_COMPLETE`+; clicking triggers orchestrator, navigates to artifact view on completion; breadcrumb reads "Project / Module / Architect Workspace / Generate LLD".
  - Files: `frontend/app/ba-tool/project/[id]/module/[moduleId]/lld/page.tsx` (new), `frontend/components/ba-tool/LldConfigurator.tsx` (new), `frontend/components/ba-tool/NfrEditor.tsx` (new), `frontend/components/ba-tool/AddMasterDataInline.tsx` (new — reusable inline dedupe-checked add), `frontend/components/ba-tool/CloudServicesField.tsx` (new — free-text with autosave)

- [ ] **Task 20: Module header — LLD button** (P0-FE)
  - Acceptance: Existing module workspace gains a new **LLD** button to the left of **SubTasks**; visible always; enabled once `moduleStatus ∈ { EPICS_COMPLETE, STORIES_COMPLETE, SUBTASKS_COMPLETE, APPROVED }`; click navigates to the configurator page when no LLD exists, otherwise to the LLD artifact view; label dynamically shows `Generate LLD` / `View LLD` / `Re-generate` based on `lldCompletedAt`; first-use tooltip reads **"Architect Workspace — design decisions live here"**.
  - Files: `frontend/app/ba-tool/project/[id]/module/[moduleId]/page.tsx`

- [ ] **Task 21: LLD Artifact View** (P0-FE)
  - Acceptance: When `lldCompletedAt` is set, `/ba-tool/project/[id]/module/[moduleId]/lld` renders a two-pane view: left TOC (sections + pseudo file tree), right content (MarkdownRenderer for sections, file viewer for files); toolbar has **Preview / PDF / DOCX / Re-generate / Back to Config**.
  - Files: `frontend/components/ba-tool/LldArtifactView.tsx` (new), `frontend/components/ba-tool/PseudoFileTree.tsx` (new), `frontend/components/ba-tool/PseudoFileViewer.tsx` (new)

- [ ] **Task 22: Update artifact tree to include LLD artifact** (P0-FE)
  - Acceptance: `ArtifactTree.tsx` gains a new top-level skill group `SKILL-06 — LLD` at position 6 (after `SKILL-05 — SubTasks`); only rendered when `mod.lldArtifactId` is set; clicking the root opens the new LLD view; hierarchical numbering continues `6.1 LLD-MOD-XX` etc.
  - Files: `frontend/components/ba-tool/ArtifactTree.tsx`

### Phase Gate

Before starting v4.2: full regression sweep of the pre-v4 flows (FRD generation, EPIC generation, User Story generation, SubTask generation, Preview, PDF/DOCX, RTM, TBD Registry, Screens, Mic/AI-Suggest). None of these should have behavioural changes from v3.

---

## Phase v4.2 — Pseudo-File Editor + Polish (Should Have)

### P1 Frontend

- [ ] **Task 23: Pseudo-file inline editor with AI Suggest + Mic** (P1-FE)
  - Acceptance: Each file in the pseudo tree is editable via the existing `AiEditableSection` component (or a specialised variant); saves go to `PUT /pseudo-files/:id`; `isHumanModified` flag set; re-generating the LLD preserves human-edited files under a "Merge pending" banner (v4.2 does not auto-merge — it surfaces conflicts).
  - Files: `frontend/components/ba-tool/PseudoFileViewer.tsx`

- [ ] **Task 24: Re-generate preserves human-edited pseudo files** (P1-BE)
  - Acceptance: When `POST /generate-lld` runs and an LLD already exists, existing `BaPseudoFile` rows with `isHumanModified = true` are not overwritten; instead a warning is attached to the execution: "3 pseudo files skipped (human-modified) — manual merge required"; UI shows these as "Merge pending".
  - Files: `backend/src/ba-tool/ba-lld.service.ts`, `backend/src/ba-tool/ba-lld-parser.service.ts`

- [ ] **Task 25: RTM slice for LLD linkage** (P1-FE)
  - Acceptance: RTM page gains two new columns: `LLD Class` and `LLD Method`, populated from pseudo-file content by parsing traceability blocks (`FRD: F-XX-XX | EPIC: EPIC-MOD-XX | US: US-XXX | ST: ST-XXX`); populate via a new `extendRtmWithLld()` hook after Task 15's parser.
  - Files: `backend/src/ba-tool/ba-skill-orchestrator.service.ts`, `frontend/app/ba-tool/project/[id]/rtm/page.tsx`

- [ ] **Task 26: LLD Document History integration** (P1-FE)
  - Acceptance: Preview page's Document History table shows LLD section edits alongside the regular per-section timestamps; new `Pseudo File` column distinguishes file edits from section edits.
  - Files: `frontend/app/ba-tool/preview/[kind]/[id]/page.tsx`

- [ ] **Task 27: "Generate Source Code" disabled button** (P1-FE)
  - Acceptance: LLD viewer toolbar has a right-aligned `Generate Source Code` button, styled in muted state, with tooltip "Available in Sprint v5"; clicking does nothing. This is a placeholder for continuity and sets expectation that LLD feeds source-gen.
  - Files: `frontend/components/ba-tool/LldArtifactView.tsx`

### P2 Quality / Documentation

- [ ] **Task 28: Unit tests for `BaMasterDataService` (Architect Console) + `BaLldParserService`** (P2-BE)
  - Acceptance: ≥80% line coverage for both services; tests cover (a) seed-on-empty behaviour, (b) fuzzy-match returning candidates, (c) promote-to-global cloning, (d) LLD output parsing with 15 sections + 10 pseudo files, (e) re-generate with human-modified file preserved.
  - Files: `backend/src/ba-tool/ba-master-data.service.spec.ts`, `backend/src/ba-tool/ba-lld-parser.service.spec.ts`

- [ ] **Task 29: Document SKILL-06 in walkthrough + build prompt** (P2)
  - Acceptance: `sprints/v4/WALKTHROUGH.md` authored at end of sprint; `BA-AUTOMATION-TOOL-BUILD-PROMPT.md` updated to list the new skill file, the master-data bootstrap step, and the new Prisma models so a fresh rebuild would produce v4 output.
  - Files: `ProjectSourceCode/sprints/v4/WALKTHROUGH.md` (new — end of sprint), `Screen-FRD-EPICS-Automation-Skills-Prompt/BA-AUTOMATION-TOOL-BUILD-PROMPT.md`

- [ ] **Task 30: Regression pass — existing v1/v2/v3 flows unaffected** (P2-QA)
  - Acceptance: Manual smoke test covers PRD creation + preview + PDF + DOCX; BA project create; FRD/EPIC/US/SubTask generation; preview (all 4 types); PDF/DOCX downloads; RTM populate from artifacts; TBD Registry; Mic + AI Suggest; Client Logo upload; Screen upload (chunked) + thumbnails. Each verified to behave identically to v3 commit.
  - Files: (testing only, no source changes)

---

## Acceptance Criteria for Sprint v4 as a Whole

- All Phase v4.0 tasks complete → the Architect Console is reachable, seeded, usable, and does not affect any existing flow.
- All Phase v4.1 P0 tasks complete → an Architect can generate a full LLD for a module and review it in the viewer.
- All Phase v4.2 P1 tasks complete → pseudo files are editable, re-generation preserves human edits, RTM has LLD columns.
- All Phase v4.2 P2 tasks complete → sprint is shippable with tests, docs, and regression pass.
- Persona rename is surface-only: no route was renamed, no Prisma model was renamed, no v1–v3 WALKTHROUGH / PRD / TASKS document was modified.

## Tasks Explicitly NOT in Sprint v4

- Source-code generation from pseudo files (Sprint v5)
- Automated LLD ↔ source-gen feedback loop (v5+)
- Stack-compatibility guardrails (v5+ polish)
- Multi-module project-wide LLD rollup (v5+)
- Role-based auth beyond the `isAdmin` flag (separate sprint)
- Real-time collaboration on the configurator (not planned)

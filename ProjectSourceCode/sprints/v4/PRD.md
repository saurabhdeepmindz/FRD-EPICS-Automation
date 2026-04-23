# Sprint v4 — PRD: Architect Workspace — Low-Level Design (LLD) Generation from EPICs / User Stories / SubTasks

## Overview

Sprint v4 adds a new pipeline phase to the BA Tool (**Architect Workspace**): **Low-Level Design (LLD) generation**. After EPICs are generated (and optionally after User Stories / SubTasks), the **Architect** can configure a stack of choices — frontend / backend / database / other infrastructure technologies, architecture pattern, NFRs, project structure, code templates, LLD document template, and coding guidelines — and trigger **SKILL-06-LLD** to produce a comprehensive LLD document plus a tree of language-specific pseudo-code files with full JavaDoc/JSDoc/PyDoc-style docstrings carrying RTM references back to the EPICs and User Stories that justify each class and method.

All inputs are optional. When absent, the skill falls back to industry best practices and explicitly calls out the choices it made in the LLD.

> **Role model**: v1–v3 produced BA artefacts (PRD, FRD, EPIC, User Stories, SubTasks). Sprint v4 is the first time the platform touches **design decisions** — tech stacks, architecture patterns, API contracts, data models. These are the Architect's territory, not the BA's. We introduce the Architect persona for v4 UI copy and user stories; BA personas in earlier sprints remain unchanged. Where a single person wears both hats, they simply act as Architect when opening the Architect Workspace. No auth / role separation is introduced in v4 — the persona split is a vocabulary and UX decision, not an access-control one.

> **Context**: Sprint v3 closed the BA pipeline at SubTask generation. v4 extends the pipeline one step closer to source code — without attempting to generate source code itself (that is Sprint v5). The LLD and pseudo-code output are the load-bearing inputs that v5 will consume. This sprint also introduces the platform's first **design-standards layer** — dropdown-backed, Architect-editable dictionaries of tech stacks, templates, and architectural patterns, surfaced in the new **Architect Console** — which is independently useful and will be reused by v5 and beyond.

## Goals

- An Architect can generate an LLD for any module whose EPICs are complete, by selecting from pre-populated dropdowns for each design decision
- All input categories have a **global** default set seeded from repo JSON, plus **project-scoped** overrides added inline by the Architect; new values are de-duplicated by fuzzy match before insert and can be promoted to global by an admin
- Templates have a lineage — any LLM-modified or human-forked template gets a new row with `parentTemplateId` pointing at its ancestor and a `lastModifiedBy: AI | HUMAN` flag, so provenance is always traceable
- The LLD skill (SKILL-06-LLD) is callable from the BA module workspace via a new **LLD** header button, without touching the existing 6-step stepper, status machine, or any pre-v4 skill flow
- The skill produces two artifacts per module: (a) an LLD Markdown document with 12+ structured sections, (b) a tree of pseudo-code files (`*.java`, `*.ts`, `*.py` etc.) with full docstrings and `// TODO: …` method bodies that reference EPIC/User Story/SubTask/FRD IDs from the RTM
- Each pseudo-code file is reachable from the UI (tree view + content preview) and editable by the BA, with human edits flagged so the AI output is preserved
- NFRs are read from the project's PRD where available (the PRD already captures Scalability, Security, Performance, Responsive) and editable per-module in the LLD UI, with free-text add for new NFR categories
- The LLD artifact is previewable with the same document shell the FRD/EPIC/User Story/SubTask artifacts already use (left TOC, cover page, Document History, downloads as PDF/DOCX)
- The LLD captures forward-compatibility scaffolding that Sprint v5 source-gen will need: module dependency graph, API contract manifest, data model definitions, env/secret catalog, test scaffold hints, cross-cutting concerns, and build/CI hooks
- All changes are strictly additive — the existing 6-skill pipeline, artifact tree, RTM, preview/export, screen galleries, and module status transitions are untouched

## User Stories

- As an Architect, I want to configure the technology stack, architecture, and templates once per module before generating the LLD, so the AI output matches my organisation's standards
- As an Architect, I want dropdowns for every design choice, pre-populated from the Architect Console, so I don't retype values and I can see what other teams have used
- As an Architect, I want to add a new value to any dropdown inline (e.g. a new backend framework) when the existing options don't cover my case, and have it saved for future projects
- As an Architect, I want the system to warn me if my new value looks like an existing one ("Did you mean `React`?") so design standards stay clean
- As an Architect, I want to upload a JSON bulk dump of design standards to seed multiple categories at once
- As an admin, I want to reset design standards to the bundled defaults or re-seed a specific category without losing project-scoped entries
- As an Architect, I want new values to be visible only in my current project by default, and to promote them to global with an explicit action, so one team's experiments don't pollute everyone else's dropdowns
- As an Architect, I want to generate the LLD after EPICs are approved, optionally consuming User Stories and SubTasks when they're available, so I can start design work either before or after the BA finishes story decomposition
- As an Architect, I want to click a single "Generate LLD" button once EPICs are complete, and have the LLD produced in the same orchestrated way as the other skills (context packet → AI → review → approve)
- As an Architect, I want the generated LLD document to include module dependency graph, API contracts, data models, env vars, test hints, cross-cutting concerns, and build/CI hooks — so downstream source-gen has everything it needs
- As an Architect, I want the generated pseudo-code files to live in a visible tree (e.g. `LLD-PseudoCode/backend/controllers/InvoiceController.java`) with full class signatures, method signatures, JavaDoc-style docstrings, and `// TODO` bodies that cite the EPIC/US/SubTask/FRD IDs each class and method implements
- As an Architect, I want to edit individual pseudo-code files inline with AI Suggest and Mic support, same as other artifact sections, and have my edits flagged as human-modified
- As an Architect, I want to preview the LLD document in the same cover/TOC/history layout as FRD/EPIC/User Story/SubTask previews, and download it as PDF or DOCX
- As an Architect, I want to re-generate the LLD after I've updated EPICs or templates, and see a fresh version replace the old one (with audit trail)
- As a BA, I want to know when the Architect has produced an LLD for a module so I can link it in requirements reviews
- As a developer who will consume LLD in v5 source-gen, I want the LLD sections in a predictable, parseable structure so my generator can consume them mechanically

## Technical Architecture

### New Components

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                          Browser (port 3001)                                   │
│                                                                                │
│  /ba-tool/project/[id]/master-data                              (NEW)          │
│    └── Architect Console (UI label — route path preserved for continuity)      │
│        ├── Tech stack tabs (bundled defaults + inline add):                    │
│        │   Frontend / Backend / Database / Streaming / Caching /               │
│        │   Storage / Cloud / Architecture                                      │
│        ├── Template tabs (UI-uploaded only — empty at install):                │
│        │   Project Structure / Backend Template / Frontend Template /          │
│        │   LLD Template / Coding Guidelines                                    │
│        ├── Upload Template action (single file OR folder/zip for Project Struct)│
│        ├── Add / Edit / Delete entries (per-project)                           │
│        ├── "Promote to global" action (admin-only)                             │
│        ├── Bulk upload JSON (tech stack only)                                  │
│        └── "Reset / Re-seed from bundle" action (tech stack only)              │
│                                                                                │
│  /ba-tool/project/[id]/module/[moduleId]                        (enhanced)     │
│    └── Module header:                                                          │
│        [Back]  MOD-XX  …       [LLD]  [SubTasks]  [Sprint]     (NEW button)   │
│    └── Clicking [LLD] opens the Architect Workspace for this module:           │
│        /ba-tool/project/[id]/module/[moduleId]/lld              (NEW)          │
│          ├── Architect — Generate LLD (Configurator Panel)                     │
│          │   ├── Tech stack dropdowns (8 categories) — inline "Add new"        │
│          │   ├── Template dropdowns (5 categories) — "(none — use AI best      │
│          │   │   practices)" when empty + "Upload template…" inline action     │
│          │   ├── Cloud Services (free-text area)                               │
│          │   ├── NFR editor (reuses PRD NFR categories + free text)            │
│          │   ├── Input summary (EPICs ✓, User Stories ✓/–, SubTasks ✓/–)       │
│          │   └── [Generate LLD] button                                         │
│          ├── LLD Artifact Viewer (after generation)                            │
│          │   ├── Left TOC (mirrors artifact-tree pattern)                      │
│          │   ├── LLD Document sections (Markdown via MarkdownRenderer)         │
│          │   ├── PseudoCode file tree (LLD-PseudoCode/…)                       │
│          │   │   └── File viewer with Mic + AI Suggest + Edit                  │
│          │   └── Toolbar: Preview / PDF / DOCX / Re-generate                   │
│                                                                                │
│  /ba-tool/preview/artifact/[lldArtifactId]                      (reuses v3)    │
│    └── Cover + Document History + TOC + Sections + PseudoCode tree             │
│                                                                                │
└──────────────────────────────────┬─────────────────────────────────────────────┘
                                   │ HTTP
                                   ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                         NestJS Backend (port 4000)                             │
│                                                                                │
│  BaMasterDataController (NEW):                                                 │
│    GET    /api/ba/master-data                          — list all (scoped)     │
│    GET    /api/ba/master-data/:category                — list by category      │
│    POST   /api/ba/master-data                          — add entry             │
│    PATCH  /api/ba/master-data/:id                      — edit entry            │
│    DELETE /api/ba/master-data/:id                      — soft-delete           │
│    POST   /api/ba/master-data/:id/promote              — promote to global     │
│    POST   /api/ba/master-data/bulk                     — bulk upload JSON      │
│    POST   /api/ba/master-data/reseed                   — re-seed from bundle   │
│    POST   /api/ba/master-data/dedupe-check             — fuzzy match check     │
│                                                                                │
│  BaLldController (NEW):                                                        │
│    GET    /api/ba/modules/:id/lld/config               — load saved selections │
│    PUT    /api/ba/modules/:id/lld/config               — save selections       │
│    POST   /api/ba/modules/:id/generate-lld             — trigger SKILL-06-LLD  │
│    GET    /api/ba/modules/:id/lld                      — fetch LLD artifact    │
│    GET    /api/ba/modules/:id/lld/pseudo-files         — list pseudo files     │
│    GET    /api/ba/pseudo-files/:id                     — get file content      │
│    PUT    /api/ba/pseudo-files/:id                     — save edited file      │
│                                                                                │
│  BaSkillOrchestratorService (enhanced):                                        │
│    - SKILL-06-LLD added to SKILL_ORDER                                         │
│    - assembleSkill06Context() — packs EPIC artifact + optional US/SubTask      │
│      artifacts + RTM rows + TBD entries + master-data selections + NFR values  │
│    - post-SKILL-06 hook: parse LLD output into LldDocument + PseudoFile rows   │
│                                                                                │
│  BaLldParserService (NEW):                                                     │
│    parseLldMarkdown() — split AI output into LLD sections                      │
│    parsePseudoFileTree() — extract the file-tree block and write files         │
│    resolveTemplateLineage() — decide if LLM output forks a template            │
│                                                                                │
│  Prisma schema additions:                                                      │
│    BaMasterDataEntry  — scoped dropdown values                                 │
│    BaTemplate         — reusable templates with parentTemplateId lineage       │
│    BaLldConfig        — per-module saved selections                            │
│    BaPseudoFile       — individual pseudo-code files                           │
│    NfrValue           — per-module NFR values (category + free text)           │
│    BaModule.lldCompletedAt / lldArtifactId (new columns — nullable)            │
│                                                                                │
└────────────────────────────────────┬───────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                      Python AI Service (port 5000)                             │
│                                                                                │
│  Reuses existing /ba/execute-skill endpoint — no new Python route.             │
│  System prompt = FINAL-SKILL-06-create-lld.md loaded from disk.                │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model Changes (Prisma, additive only)

```prisma
enum BaMasterDataCategory {
  // ── Tech stack (bundled defaults + inline add) ───────────────────────
  FRONTEND_STACK        // React, Vue, Angular, Next.js, Svelte, …
  BACKEND_STACK         // NestJS, Spring Boot, Django, FastAPI, Express, …
  DATABASE              // PostgreSQL, MongoDB, MySQL, …
  STREAMING             // Kafka, RabbitMQ, …
  CACHING               // Redis, Memcached, …
  STORAGE               // MinIO, S3, Azure Blob, GCS, …
  CLOUD                 // AWS, Azure, GCP, …
  ARCHITECTURE          // Modular Monolith, Microservices, Event-Driven, …
  // ── Org-specific templates (UI-uploaded only, NO bundled defaults) ───
  PROJECT_STRUCTURE     // references a BaTemplate id (folder-tree upload)
  BACKEND_TEMPLATE      // references a BaTemplate id (file upload)
  FRONTEND_TEMPLATE     // references a BaTemplate id (file upload)
  LLD_TEMPLATE          // references a BaTemplate id (file upload)
  CODING_GUIDELINES     // references a BaTemplate id (file upload)
}
// Note: "Cloud Services" is NOT a master-data category — it's a free-text
// field on BaLldConfig (e.g. "Lambda, SQS, DynamoDB, CloudFront") that the
// Architect types per-module.

enum BaMasterDataScope { GLOBAL PROJECT }

model BaMasterDataEntry {
  id          String                @id @default(uuid())
  category    BaMasterDataCategory
  scope       BaMasterDataScope     @default(PROJECT)
  projectId   String?               // null when scope=GLOBAL
  project     BaProject?            @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String                // "React", "NestJS", "Microservices", …
  value       String                // canonical id / reference value
  description String?               @db.Text
  templateId  String?               // set when category is PROJECT_STRUCTURE / *_TEMPLATE / CODING_GUIDELINES
  template    BaTemplate?           @relation(fields: [templateId], references: [id])
  isArchived  Boolean               @default(false)
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt

  @@unique([category, scope, projectId, name])    // prevent dupes within a scope
  @@index([category, scope])
}

model BaTemplate {
  id                 String              @id @default(uuid())
  category           BaMasterDataCategory  // BACKEND_TEMPLATE, FRONTEND_TEMPLATE, LLD_TEMPLATE, CODING_GUIDELINES, PROJECT_STRUCTURE
  name               String
  version            Int                 @default(1)
  parentTemplateId   String?             // lineage: this template was derived from parent
  parent             BaTemplate?         @relation("TemplateLineage", fields: [parentTemplateId], references: [id])
  children           BaTemplate[]        @relation("TemplateLineage")
  lastModifiedBy     BaTemplateModifier  @default(HUMAN)   // AI or HUMAN
  scope              BaMasterDataScope   @default(PROJECT)
  projectId          String?
  project            BaProject?          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  content            String              @db.Text   // template body (Markdown/JSON as appropriate)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  masterDataEntries  BaMasterDataEntry[]

  @@index([category, scope])
}

enum BaTemplateModifier { AI HUMAN }

model BaLldConfig {
  id                 String      @id @default(uuid())
  moduleDbId         String      @unique
  module             BaModule    @relation(fields: [moduleDbId], references: [id], onDelete: Cascade)
  // ── Tech stack single-select FKs (null = skip + use AI best practices) ─
  frontendStackId    String?     // FK to BaMasterDataEntry
  backendStackId     String?
  databaseId         String?
  streamingId        String?
  cachingId          String?
  storageId          String?
  cloudId            String?
  architectureId     String?
  cloudServices      String?     @db.Text   // free-text — "Lambda, SQS, …"
  // ── Template single-select FKs (null until Architect uploads) ─────────
  projectStructureId String?
  backendTemplateId  String?
  frontendTemplateId String?
  lldTemplateId      String?
  codingGuidelinesId String?
  // ── NFR values + free-form notes ──────────────────────────────────────
  nfrValues          Json?       // { scalability: "10k req/s", security: "OAuth2 + RBAC", … }
  customNotes        String?     @db.Text
  updatedAt          DateTime    @updatedAt
}

model BaPseudoFile {
  id              String        @id @default(uuid())
  artifactDbId    String        // links to the LLD BaArtifact
  artifact        BaArtifact    @relation(fields: [artifactDbId], references: [id], onDelete: Cascade)
  path            String        // "backend/controllers/InvoiceController.java"
  language        String        // "java" | "typescript" | "python" | …
  aiContent       String        @db.Text
  editedContent   String?       @db.Text
  isHumanModified Boolean       @default(false)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([artifactDbId])
  @@unique([artifactDbId, path])
}

model BaModule {
  // … existing fields unchanged …
  lldCompletedAt    DateTime?
  lldArtifactId     String?     // FK to BaArtifact when LLD exists
}
```

`BaArtifactType` enum gains a new variant: `LLD`. No existing variants are renamed or removed.

### Skill File — FINAL-SKILL-06-create-lld.md (NEW)

A new markdown file at `Screen-FRD-EPICS-Automation-Skills/FINAL-SKILL-06-create-lld.md`, loaded by the orchestrator the same way SKILL-00 through SKILL-05 are loaded today. The prompt:

- Accepts a context packet with EPIC artifact content, optional User Story / SubTask artifact content, RTM rows, TBD-Future entries, resolved master-data selections (stack names + template bodies), NFR values, and project metadata
- Produces a single Markdown document with ≥12 sections (listed below)
- Produces a fenced block per pseudo-code file using language-tagged code fences, with each file including full signatures + docstrings + `// TODO` bodies citing RTM IDs
- Must NEVER hallucinate EPIC/US/SubTask/FRD IDs — only cite IDs present in the context packet
- Must explicitly note any section where it applied a best-practice default because no template or selection was provided
- Follows the hot-swap property of existing skill files — edit the markdown, next run uses the new prompt

### LLD Document Section Structure (minimum)

1. **Summary** — product name, module name, scope, intended deployment model
2. **Technology Stack** — FE / BE / DB / Other, with justifications
3. **Architecture Overview** — chosen pattern, rationale, high-level diagram (ASCII)
4. **Module Dependency Graph** — which internal modules consume which (feeds v5 build order)
5. **Non-Functional Requirements** — each NFR category with target values and implementation approach
6. **API Contract Manifest** — every endpoint: method, path, request schema, response schema, auth, error codes
7. **Data Model Definitions** — entities, fields, relationships, indexes, constraints (DB-agnostic description)
8. **Cross-Cutting Concerns** — logging, error handling, auth middleware, rate limiting, i18n, caching strategy
9. **Env Var / Secret Catalog** — names, purpose, where consumed, whether optional, example value
10. **Test Scaffold Hints** — per module: unit vs integration vs E2E; key scenarios linked to US acceptance criteria
11. **Build / CI Hooks** — package manager, lint, test, build commands; CI stages; deployment targets
12. **Project Structure** — resolved tree of folders and files, with one-line purpose each
13. **Traceability Summary** — EPIC/US/SubTask/FRD → Class/Method mapping (acts as RTM slice for dev handoff)
14. **Open Questions / TBD-Future References** — anything unresolved, referencing the TBD registry
15. **Applied Best-Practice Defaults** — explicit list of any template or selection the LLM filled in

### Pseudo-Code File Conventions

- **Language chosen from BE/FE master-data entries.** E.g. if backend is NestJS, files are `*.ts`; if Spring Boot, `*.java`; if Django, `*.py`.
- **Docstring per class** — purpose, traceability block (`FRD: F-XX-XX | EPIC: EPIC-MOD-XX | US: US-XXX | ST: ST-XXX`), collaborators
- **Docstring per public method** — purpose, `@param`, `@return`, `@throws`, traceability block
- **Method body** — `// TODO: <algorithmic description drawn from EPIC / US / SubTask content>` — no real code, no partial stubs
- **No imports to types not declared elsewhere in the pseudo tree** — self-consistent
- **Files live under `LLD-PseudoCode/<layer>/<module>/<file>`** where `<layer>` is `backend | frontend | database | infra | tests`
- **Database schema files** get their own subtree (e.g. `LLD-PseudoCode/database/migrations/001_create_invoice_table.sql`) as SQL DDL with header comments
- **Infra / CI files** (e.g. `.github/workflows/ci.yml.pseudo`) are included under `LLD-PseudoCode/infra/` with pseudo-structure + inline comments

### Design Standards Seeding Strategy

> Internally the data is stored in `BaMasterDataEntry` / `BaTemplate` Prisma models (names preserved for code continuity); the UI surfaces this as the **Architect Console** / **Design Standards**.

Two different kinds of values live under the 13 categories. Seeding differs between them.

| Category | Seed source at install | Architect action |
|---|---|---|
| Frontend Stack | Bundled JSON (React, Vue, Angular, Next.js, Svelte) | Add new inline (e.g. "Qwik") |
| Backend Stack | Bundled JSON (NestJS, Spring Boot, Django, FastAPI, Express) | Add new inline (e.g. "Elixir Phoenix") |
| Database | Bundled JSON (PostgreSQL, MongoDB, MySQL, SQLite, MariaDB) | Add new inline |
| Streaming | Bundled JSON (Kafka, RabbitMQ) | Add new inline |
| Caching | Bundled JSON (Redis, Memcached) | Add new inline |
| Storage | Bundled JSON (MinIO, S3, Azure Blob, GCS) | Add new inline |
| Cloud | Bundled JSON (AWS, Azure, GCP) | Add new inline |
| Architecture | Bundled JSON (Modular Monolith, Microservices, Event-Driven) | Add new inline |
| **Project Structure** | **Empty at install** | **Upload folder / zip via UI** |
| **Backend Template** | **Empty at install** | **Upload file via UI** |
| **Frontend Template** | **Empty at install** | **Upload file via UI** |
| **LLD Document Template** | **Empty at install** | **Upload file via UI** |
| **Coding Guidelines** | **Empty at install** | **Upload file via UI** |

#### Tech-stack categories (bundled)

- Bundled JSON files under `Screen-FRD-EPICS-Automation-Skills-Prompt/master-data/*.json`, one file per tech-stack category, containing sensible well-known defaults.
- First-boot migration: if `BaMasterDataEntry` table is empty for scope=GLOBAL for a given tech-stack category, load that category's bundled JSON file.
- Admin action **Re-seed from bundle** wipes GLOBAL entries for a tech-stack category and reloads from its JSON; PROJECT entries are preserved.
- **Template categories are never auto-seeded** — the bundle directory contains no template files at all. Re-seed from bundle is a no-op for template categories.

#### Template categories (UI-uploaded)

- Dropdown starts empty at install. Nothing is bundled — templates are org-specific.
- The Architect uploads templates via the **Architect Console** → target category tab → **Upload Template** action:
  - **Project Structure**: folder or `.zip` upload; extracted tree stored as Markdown content representing the file/folder layout with annotations.
  - **Backend Template / Frontend Template / LLD Template / Coding Guidelines**: single text file upload (Markdown, plain text, or source file).
  - Upload form captures name, description, scope toggle (this project / global — admin only).
- Template body is editable post-upload using the same editor planned for Task 10; human edits fork a new `BaTemplate` row with `parentTemplateId` and `lastModifiedBy: HUMAN`.
- **Empty-template behaviour in the LLD Configurator**: each template dropdown is rendered with a single `(none — use AI best practices)` option by default, plus an inline **Upload template…** action that opens the Architect Console upload dialog scoped to that category. Architects can generate LLDs without any templates; the skill falls back to industry best practices and declares "Applied Best-Practice Defaults" in the LLD's final section.

### Cloud Services Field (free text)

Separate from the 13 master-data categories, the LLD Configurator captures a **Cloud Services** free-text area on `BaLldConfig.cloudServices`. Typical content: `"Lambda, SQS, DynamoDB, CloudFront, S3"`. The LLD skill receives this verbatim in the context packet and may reference specific services in the Data Model, API Contract, and Env Var sections. No master data — the Architect simply types the services used.

### Stepper & Status-Machine Impact

**None.** The existing 6-step stepper (`Upload → Analyse → FRD → EPIC → Stories → SubTasks`) is unchanged. LLD is accessed via a new header button placed next to the existing SubTasks / Sprint Sequence buttons; enabled once `moduleStatus ∈ { EPICS_COMPLETE, STORIES_COMPLETE, SUBTASKS_COMPLETE, APPROVED }`. Completion is tracked via `BaModule.lldCompletedAt` + `lldArtifactId` — the `BaModuleStatus` enum gets no new variants.

### Preview / Export Impact

The existing preview route `/ba-tool/preview/artifact/[id]` works for LLD artifacts out of the box because they are stored as `BaArtifact` rows. The only addition: when `artifactType === 'LLD'`, the preview page renders a second pane showing the pseudo-file tree (similar to the Screens block for EPIC/US). PDF/DOCX generation works via the same `BaArtifactExportService` and `artifact-html.ts` template.

## Non-Goals

- **Source-code generation** — Sprint v5, not v4. The "Generate Source Code" button on the LLD page is shown disabled with a "Coming in v5" tooltip.
- **Automated LLD ↔ source-gen feedback loop** — v4 uses manual edit + re-run; automated diff/merge is v5+ polish.
- **Compatibility guardrails between stack selections** — if a BA picks "React + Django templates + MongoDB", nothing warns them. The LLM will flag inconsistencies in the LLD body.
- **Template versioning beyond parent/child lineage** — no branches, no merge, no diff UI in v4.
- **Multi-module LLD** — LLD is generated per-module. Project-wide LLD rollup is v5+.
- **Real-time collaboration on the LLD configurator** — single-user edits, last-write-wins.

## Success Criteria

- Demo flow completes end-to-end: fresh install → tech-stack dropdowns are pre-populated; template dropdowns are empty → Architect uploads one LLD template + one backend template via the Architect Console → opens module with `EPICS_COMPLETE` → clicks LLD → picks stacks (incl. Streaming=Kafka, Caching=Redis, Storage=MinIO, Cloud=AWS, Cloud Services="Lambda, SQS") + the uploaded templates + NFRs → Generate LLD → review LLD doc + pseudo files → edit one file → approve → preview with TOC → download as PDF
- Fresh install loads bundled defaults for tech-stack categories automatically: ≥5 each for Frontend / Backend / Database; ≥2 each for Streaming / Caching / Storage / Cloud; ≥3 for Architecture
- Template categories start **empty** at install — no bundled template files exist; Architect must upload before a template appears in the LLD Configurator dropdown
- Generating an LLD with no templates uploaded works end-to-end; the LLD's "Applied Best-Practice Defaults" section explicitly lists the categories where AI defaults were used
- Cloud Services free-text is preserved in `BaLldConfig.cloudServices` and threaded into the skill context packet
- Adding a new value that matches an existing one within Levenshtein distance ≤3 shows a "Did you mean?" prompt
- LLD for a module with 3 EPICs + 6 user stories + 12 subtasks produces ≥8 pseudo-code files covering backend controllers/services/models, frontend components, DB schema, and at least one test scaffold
- Generated pseudo-code files include RTM references in every class and method docstring
- LLD markdown contains all 15 section headings listed above (or explicit "N/A — applied default" notes)
- All existing BA Tool and PRD Generator routes, artifacts, and RTM flows are unchanged (regression pass)
- `BaModuleStatus` enum is unchanged; no Prisma migration renames or drops any existing column
- No route path is renamed; internal Prisma model names preserved (`Ba*`); persona rename is UI-label and documentation only

## Open Questions (to resolve during implementation)

1. **Fuzzy-match threshold** for the "Did you mean?" dedupe prompt — Levenshtein ≤3? Trigram similarity? Start with Levenshtein and tune.
2. **Promote-to-global authorization** — does v4 need a real admin role, or a single `isAdmin` flag on user that a settings page toggles? Start with settings-page toggle since auth is not yet in scope.
3. **Pseudo-file format for non-typed languages** (Python) — does the same docstring+signature approach work, or do we produce `.pyi` stub files? Default to regular `.py` with `pass` bodies and `"""docstrings"""` for consistency.
4. **Bundled default templates** — who authors them? Recommend a separate `v4-seed-data` PR before v4 implementation begins, so v4 starts with real defaults not placeholders.
5. **Preview pseudo-file tree UX** — left-nav tree or inline accordion? Left-nav is more consistent with the existing artifact-tree TOC but adds a second level of nesting inside the preview page.

## Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| LLM produces pseudo-code files with invented imports / types | High | Skill prompt explicitly forbids this; parser rejects files referencing symbols not defined elsewhere in the tree (warning, not hard fail) |
| Design-standards drift between projects | Med | Scope defaults to PROJECT; promotion requires explicit action; dedupe on insert |
| Generated LLD too long to review | Med | Each section collapsible by default in the preview; TOC numbering mirrors PRD preview |
| Template lineage confusion after several LLM improvements | Med | `parentTemplateId` trace exposed in the Architect Console; Re-seed from bundle always works as escape hatch |
| Pseudo-file tree inflates artifact payload | Low | Files stored per row in `BaPseudoFile`, not in the artifact JSON blob; preview fetches on demand |
| Sprint v5 source-gen discovers LLD gaps post-hoc | High | 15-section LLD structure includes all forward-compat items (dependency graph, API contracts, env catalog, test hints, CI hooks) from day one |
| Architect persona confuses users who are also BAs | Low | Persona is labelling only — no auth boundary; any logged-in user can open the Architect Workspace; first-use tooltip on the LLD button clarifies "Design decisions live here" |

## Phasing inside Sprint v4

- **v4.0 — Architect Console Foundation** (P0) — Schema, tech-stack seed loader, Architect Console UI with two UI flows (value-add for tech-stack categories vs. file/folder upload for template categories), CRUD API, dedupe-check, promote-to-global, bulk JSON upload for tech-stack only. Template categories ship empty. LLD skill NOT yet wired. Ships independently usable.
- **v4.1 — LLD Skill + Architect Configurator + Viewer** (P0) — SKILL-06-LLD markdown, orchestrator integration, Architect configurator UI, LLD document + pseudo-file parser + viewer, preview/PDF/DOCX reuse.
- **v4.2 — Pseudo-File Editor + Polish** (P1) — Inline edit with AI Suggest / Mic, file-tree navigation, human-modified flagging, re-generate flow preserving human edits where possible, RTM section showing LLD linkage.

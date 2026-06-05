# BA Tool — Prioritized Backlog

> Living document. Updated after every execution so we always know what's next.
> **Last updated:** 2026-06-04 — **Sprint v8 planned** (Tracks Y + Z): a PRD-sourced **Wireframes stage between PRD and HLD** — a screen↔feature **mapping** artifact (CSV-shaped, annotations cite PRD §/FR-IDs) → lo-fi → hi-fi (reuse + extend Discovery models via `source=PIPELINE`), plus **single/bulk upload** for 3rd-party wireframes and `CUSTOMER_WIREFRAME` reflection; freshness extends PRD→map→wireframes→HLD. Discovery (BRD/AN) wireframes untouched. Spec in `sprints/v8/`. Prior 2026-06-03 — Tracks S + T + U **shipped (Sprint v6 COMPLETE)**: interactive PRD authoring (gap loop + inline AI/Mic editor with blue AI text, FRD feature editing), enrich-within-section + §22 `[AI][NEW]` + lock enforcement, in-browser narration / no-inputs seed, and forward PRD→HLD→E2E freshness propagation. Verified (27 unit tests, tsc clean both apps, freshness live-checked). See `sprints/v6/WALKTHROUGH.md`. Earlier 2026-06-03 — Tracks S + T planned (Sprint v6): interactive PRD authoring (gap-answering loop + inline AI-Suggest/Mic editor with blue AI text on `project-prd`, reusing legacy GapWizard/FormField components) and forward propagation (extend the impact engine to HLD + E2E + modules, add a `sourceArtifactVersions` freshness banner) — closes the forward PRD→HLD→E2E loop and unblocks deferred I-03. Full spec in `sprints/v6/`. Prior (2026-06-01): Module-scoped code-gen (Tracks N–Q)

---

## NEW PIPELINE — Customer Discovery → Code

> **Goal:** End-to-end pipeline that takes multiple customer input types, generates PRD+FRD, wireframes, HLD, EPICs, LLD, and incrementally generates code — all without disturbing existing functionality.
> **Execution approach:** Skeleton-first (all stubs end-to-end in one pass), then implement track by track.
> **Status Legend:** ⬜ Pending | 🔄 In Progress | ✅ Complete | ⏸ Blocked | ➖ Superseded (delivered differently / no longer needed)

### Key Design Decisions (confirmed)

| Decision | Detail |
|---|---|
| Folder root = project name | e.g., `Taxcompass/` (not project code) — human-readable |
| Source code folder | `ProjectSourceCode/` (not `ProjectImplementation/`) — starts with pseudo files from LLD, evolves to complete code as `/prd` runs |
| Wireframes | Lo-fi and Hi-fi **reuse the existing Discovery feature** (BaWireframeSet, BaHifiSet) — Track D just adds disk writes |
| Downstream → upstream | When code changes in `ProjectSourceCode/`, LLD and functional documents in `ProjectArtifacts/` are updated |
| Changelog | `CHANGELOG.md` maintained in project root — records every downstream→upstream change with timestamp and affected artifacts |

### Pipeline Flow

```
Customer Input Hub (audio, BRD doc, wireframes, text, any doc, extensible)
  → Combined PRD + FRD (FRD lives under Functional Requirements section)
    → Lo-fi Wireframes (REUSE Discovery BaWireframeSet) → Hi-fi (REUSE Discovery BaHifiSet)
      → HLD – High Level Design (new, template-driven)
        → EPICs (extended context: PRD+FRD + HLD + wireframe refs)
          → User Stories → Subtasks (existing, unchanged)
            → LLD (existing SKILL-06) → pseudo files placed in ProjectSourceCode/
              → Incremental Code Dev via /prd and /dev skills
                ↑ Downstream → Upstream: code changes update LLD + functional docs + CHANGELOG
```

### Folder Output Structure

```
d:\SaurabhVerma\COE\New-FRD-EPICS-Automation\
├── ProjectSourceCode\               ← existing BA Tool app (unchanged)
└── Projects\                        ← NEW root for all customer project outputs
    └── {ProjectName}\               ← e.g., Taxcompass\ (project.name, not code)
        ├── CHANGELOG.md             ← NEW: downstream→upstream change log
        ├── ProjectArtifacts\        ← all generated documents as files
        │   ├── 01-CustomerInputs\   (audio transcripts, BRD docs, wireframes, other)
        │   ├── 02-PRD-FRD\          (PRD-FRD-v1.md / .pdf / .docx)
        │   ├── 03-Wireframes-LoFi\  (HTML files — written from BaWireframeScreen)
        │   ├── 04-Wireframes-HiFi\  (HTML files — written from BaHifiScreen)
        │   ├── 05-HLD\              (HLD-v1.md / .pdf)
        │   ├── 06-EPICs\            (module-EPICs.md)
        │   ├── 07-UserStories\      (module-UserStories.md)
        │   ├── 08-SubTasks\         (module-SubTasks.md)
        │   ├── 09-LLD\              (module-LLD.md — updated when code changes)
        │   └── 10-RTM\              (RTM.md + RTM.csv)
        └── ProjectSourceCode\       ← source code (replaces ProjectImplementation/)
            ├── .context\            (context engineering: REQUIREMENTS, HLD, RTM,
            │                         EPICS, USER_STORIES, SUBTASKS, LLD markdown files)
            └── {LLD-scaffold}\      (pseudo files → evolve to complete code via /prd)
                ├── src\
                └── ...
```

---

### Phase 0 — Skeleton (End-to-End Stubs)

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | S-01 | Define all 4 new Prisma models — `BaCustomerInput`, `BaProjectPrd`, `BaHld`, `BaProjectImplementation` | `BaArtifact`, `BaApproachNoteVersion`, `BaAudioFile` as reference patterns | Appended to schema.prisma; BaProject relations updated |
| ✅ | S-02 | Run Prisma migration for new models + regenerate Prisma client | SQL migration at `prisma/migrations/new_pipeline_models.sql`; `npx prisma generate` | 4 tables + 3 enums created in `new_prd_generator` DB |
| ✅ | S-03 | Backend stub controllers for Customer Input, ProjectPrd, Hld, ProjectImplementation | `ba-tool` NestJS module structure; `PipelineController` + `PipelineService` + `PipelineModule` wired into `BaToolModule` | 10 routes live at `/api/ba/projects/:id/*` |
| ✅ | S-04 | AI Service stub endpoints — `/project-prd-generate`, `/hld-generate` (return hardcoded minimal JSON) | FastAPI router pattern; Pydantic models appended to `main.py` | Both endpoints live on <http://localhost:5000> |
| ✅ | S-05 | Frontend stub pages — `/customer-inputs`, `/project-prd`, `/hld`, `/implementation` with placeholder UI | Next.js App Router; 4 new page.tsx files; 4 nav buttons added to project dashboard | All 4 pages accessible from project header |
| ✅ | S-06 | `ProjectFolderService` — create `{ProjectName}/ProjectArtifacts/` (10 subfolders) + `{ProjectName}/ProjectSourceCode/.context/` + `CHANGELOG.md` | Node.js `fs/promises`; disk-storage.ts path/sanitize pattern | Folder root = `project.name`; wired into `createProject`; backfilled 6 existing projects; `Projects/` gitignored |
| ✅ | S-07 | `ContextEngineeringService` — seeds 7 `.context/` markdown files (REQUIREMENTS, HLD, RTM, EPICS, USER_STORIES, SUBTASKS, LLD) | `ProjectFolderService.writeContextFile`; structured placeholder bodies | `POST /api/ba/projects/:id/context/seed`; verified 7 files on disk; H-04 swaps placeholders for live DB content |

---

### Track A — Foundation & Infrastructure

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | A-01 | Finalise `BaCustomerInput` schema — polymorphic (inputType enum: AUDIO, EXTERNAL_BRD, CUSTOMER_WIREFRAME, TEXT_CONTEXT, DOCUMENT; extensible) | `BaAudioFile`, `BaScreen` model patterns | Finalised + in use (Track B live) |
| ✅ | A-02 | Finalise `BaProjectPrd` schema — combined PRD+FRD at project level, sections JSON, version, status | `BaApproachNoteVersion` versioning; `BaArtifact` status enum | Finalised + in use; extended in v6 (`metadata`) + v7 (`prdCode/clientName/submittedBy`) |
| ✅ | A-03 | Finalise `BaHld` schema — sections driven by user-provided HLD template, version, status | `BaWft` section JSON; `BaApproachNoteVersion` | Done — HLD template shared (HRMS v2.1.1, 17 sections); Track E live |
| ✅ | A-04 | `BaProjectImplementation` schema (tracks `ProjectSourceCode/` folder path, scaffold status, context status, LLD sync) | No direct equivalent — new concept | Folder root = `project.name`; links to `BaProject`; already in DB |
| ✅ | A-05 | Run Prisma migration | SQL migration `new_pipeline_models.sql` applied; `npx prisma generate` run | 4 tables + 3 enums created |
| ✅ | A-06 | `ProjectFolderService` — full implementation: folder tree + `writeArtifactFile()` + `writeSourceFile()` + `writeContextFile()` + `appendChangelog()` + path management | Node.js `fs/promises`; disk-storage.ts patterns | Done together with S-06; exports `ARTIFACT_SUBFOLDERS` + `ProjectPaths`; endpoints: `GET/POST /folders`, `POST /ba/pipeline/backfill-folders` |

---

### Track B — Customer Input Hub

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | B-01 | `CustomerInputService` + controller — CRUD + multi-type upload (AUDIO, EXTERNAL_BRD, CUSTOMER_WIREFRAME, TEXT_CONTEXT, DOCUMENT) | `TextExtractionService` (PDF/DOCX/TXT/image-OCR); `FileInterceptor`; `ProjectFolderService` | Single `POST /customer-inputs` (FileInterceptor) handles all types; list strips base64 blobs; delete cleans disk |
| ✅ | B-02 | Write each customer input to `ProjectArtifacts/01-CustomerInputs/{TYPE}/` (original + `.extracted.txt`) | `ProjectFolderService.writeArtifactNested` (added); `deleteFile` | `diskPaths` persisted in metadata; delete removes files; verified on disk |
| ✅ | B-03 | Frontend: `/ba-tool/project/:id/customer-inputs` — working Input Hub: expandable cards per type, file/text upload, list with extracted-text preview, delete | `pipeline-api.ts` (new client); Radix Card/Button; `INPUT_TYPE_CATALOGUE` drives cards | Page renders 200; extensible — new enum value = new card |

---

### Track C — Combined PRD + FRD Generation

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | C-01 | AI Service: `/project-prd-generate` — consolidated customer inputs → 22-section PRD JSON (§6 = FRD: modules→features with FR-IDs, AC, priority) | **Reuses `PARSE_SYSTEM_PROMPT`** (the proven 22-section parser); OpenAI json_object; `_parse_ai_json` helper | No new prompt file needed — §6 already IS the FRD; returns sections + gaps |
| ✅ | C-02 | `ProjectPrdService` — consolidate inputs → call AI → persist versioned `BaProjectPrd` → edit section | axios to AI; `triggeredBy` set (INITIAL_GENERATION/MANUAL_EDIT); soft-delete-safe | `generate`, `getLatest`, `list`, `get`, `updateSection`; 10 gaps surfaced in test |
| ✅ | C-03 | Export PRD+FRD to `02-PRD-FRD/PRD-FRD-v{n}.md` + CHANGELOG entry | `ProjectFolderService.writeArtifactFile` + `appendChangelog` | 34KB MD verified on disk; changelog auto-appended (PDF/DOCX deferred — MD sufficient for now) |
| ✅ | C-04 | Frontend: `/ba-tool/project/:id/project-prd` — generate/regenerate, 22-section collapsible viewer, special FRD module/feature rendering, gaps panel, `[AI]` badges, export note | `pipeline-api.ts`; Radix Card/Button | Page renders 200; §6 expanded by default showing modules → features |

---

### Track D — Wireframe Disk Writes (Minimal Change — REUSING Discovery feature)

> Lo-fi wireframes (`BaWireframeSet` / `BaWireframeScreen`) and Hi-fi mockups (`BaHifiSet` / `BaHifiScreen`) are **fully reused** from the existing Discovery feature. Track D only adds the disk-write step so files land in `ProjectArtifacts/`. No new AI endpoints or DB models needed.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | D-01 | On lo-fi wireframe generate, write each screen HTML to `03-Wireframes-LoFi/` | **Full reuse** — `WireframeService` + new `WireframeExportService` (pipeline) | 3-line hook in `WireframeService.generate`; DiscoveryModule imports PipelineModule |
| ✅ | D-02 | On hi-fi generate, write each screen HTML to `04-Wireframes-HiFi/` | **Full reuse** — `HifiService` + `WireframeExportService` | 3-line hook in `HifiService.generate`; backfill verified 6+7 lo-fi & 6+7 hi-fi files on disk; `POST /ba/pipeline/backfill-wireframes` for existing sets |

---

### Track E — HLD Generation

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | E-01 | Collect HLD template from user — derive `HLD_SECTIONS` schema for prompt + DB + UI | User shared HRMS-HLD-Consolidated-v2.1.1 (63 pages, 18 sections, 4 architecture views) | 17 section keys derived — see HLD Template section below |
| ✅ | E-02 | AI Service: `/hld-generate` — PRD+FRD + wireframe context → 17-section HLD JSON + 5 Mermaid diagrams | New `hld_prompts.py` (HRMS-template-driven); OpenAI json_object; `_parse_ai_json` | Returns sections + mermaidDiagrams + gaps; verified real generation |
| ✅ | E-03 | `HldService` — pull latest PRD (+ wireframe screen context) → call AI → persist versioned `BaHld` → edit section | axios to AI; `sourceArtifactVersions={prdVersion}`; `triggeredBy` set | `generate`, `getLatest`, `list`, `get`, `updateSection` |
| ✅ | E-04 | Export HLD to `05-HLD/HLD-v{n}.md` (sections + Mermaid fences) + CHANGELOG | `ProjectFolderService.writeArtifactFile` + `appendChangelog` | 17KB MD verified on disk |
| ✅ | E-05 | Frontend: `/ba-tool/project/:id/hld` — generate/regenerate, 5 Mermaid diagrams rendered client-side, 17-section collapsible viewer, gaps, `[AI]` badges | `pipeline-api.ts`; dynamic `mermaid` import (proven pattern); Radix Card | Page renders 200; diagrams render as SVG with source fallback |

---

### Track F — Extended EPIC Context

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | F-01 | `assemblePipelineContext` — injects trimmed PRD (overview/scope/success) + HLD (style decision/tech stack/project structure) + lo-fi/hi-fi screen lists into the SKILL-02-S context; `wrapSkill02SPrompt` tells the AI to use it | `BaSkillOrchestratorService`; `callAiService` already serialises the whole packet to the model | **No-op when no pipeline artifacts** → legacy EPIC generation unchanged; FRD still flows via RTM |
| ✅ | F-02 | `mirrorArtifactToDisk` — on SKILL-02-S completion, write EPIC markdown to `06-EPICs/{MOD}-EPICs.md` + changelog | `ProjectFolderService.writeArtifactFile` + `appendChangelog` (injected into orchestrator) | Same helper also covers G-01/G-02/H-01 (Stories/SubTasks/LLD); best-effort, never blocks skill |

---

### Track G — User Story & Subtask Artifact Exports

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | G-01 | On SKILL-04 (User Stories) completion, write to `07-UserStories/{MOD}-UserStories.md` | `mirrorArtifactToDisk` helper (Track F) | Done via shared helper + changelog |
| ✅ | G-02 | On SKILL-05 (SubTasks) completion, write to `08-SubTasks/{MOD}-SubTasks.md` | `mirrorArtifactToDisk` helper (Track F) | Done via shared helper + changelog |

---

### Track H — LLD → ProjectSourceCode Folder + Context Engineering

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | H-01 | On SKILL-06-LLD completion, write LLD to `09-LLD/{MOD}-LLD.md` | `mirrorArtifactToDisk` helper (Track F) | Done via shared helper + changelog (scaffold + pseudo-file placement remain in H-02/H-03) |
| ✅ | H-02 | `SourceCodeScaffoldService.scaffoldProject()` — writes each `BaPseudoFile` to `ProjectSourceCode/{path}`; the folder tree emerges from the paths (no separate parse needed) | `BaPseudoFile.path`; `ProjectFolderService.writeSourceFile` (mkdir-recursive) | Verified 230 files across 3 modules on Tax Compass |
| ✅ | H-03 | Pseudo-file content placed via `editedContent ?? aiContent` | `BaPseudoFile` | Done within scaffoldProject; auto-triggers after SKILL-06-LLD + on-demand endpoint |
| ✅ | H-04 | `ContextEngineeringService` real assembly — REQUIREMENTS (from `BaProjectPrd`), HLD (`BaHld`+Mermaid), RTM (`BaRtmRow`), EPICS/STORIES/SUBTASKS/LLD (from mirrored `ProjectArtifacts/` md) | All artifact models; reads mirrored markdown | Verified: REQUIREMENTS 32KB, HLD 16.5KB, RTM 4.8KB real content |
| ✅ | H-05 | Frontend: `/ba-tool/project/:id/implementation` — scaffold status + file count, context-engineering status + 7-file list, Scaffold button, Regenerate-context button, status pills | `pipeline-api.ts`; Radix Card | Page renders 200; reflects `BaProjectImplementation` status |
| ✅ | H-06 | `CHANGELOG.md` created (A-06) + appended by every track (PRD, HLD, wireframes, EPIC/Story/SubTask/LLD mirror, scaffold) | `ProjectFolderService.appendChangelog` (newest-on-top) | Already live across all tracks |

---

### Track I — RTM for Requirement Changes

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | I-01 | Backend: `RequirementChangeService.analyzeChange` — on PRD **or** HLD section edit, computes impacted EPICs/Stories/Sub-Tasks/LLD per module (read-only; coarse — a project-level change flags every module's downstream); hooked into both `PATCH project-prd/:id/section/:key` and `PATCH hld/:id/section/:key`, returns `impact` in the response | `BaArtifact`, `BaRtmRow` groupBy, `ProjectFolderService` | **Verified**: PRD §6 edit → 24 downstream across 6 modules; no new model/migration |
| ✅ | I-02 | Backend: writes change-impact report (MD + CSV) to `ProjectArtifacts/10-RTM/change-impact-{src}-sec{n}-{ts}.{md,csv}` + CHANGELOG entry | `ProjectFolderService.writeArtifactFile` + `appendChangelog` | **Verified**: report files written; CHANGELOG appended |
| ✅ | I-03 | Frontend change-impact surfacing — **delivered in v6**: the inline section-editor (S-08) wired the in-UI trigger, and the `FreshnessBanner` (T-03) surfaces downstream staleness/impact on HLD/E2E/Implementation pages | PRD/HLD pages; `FreshnessBanner` (v6 T-03) | Unblocked + delivered via v6 Tracks S/T |

---

### Track J — Downstream → Upstream: Code Sync + Artifact Updates

> When `/prd` or `/dev` evolves code in `ProjectSourceCode/`, changes must propagate back upstream. LLD pseudo-files in `ProjectArtifacts/09-LLD/` are updated. If the change is significant, functional documents (PRD+FRD, HLD) are flagged for review. Every change is logged in `CHANGELOG.md`.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | J-03 | Downstream→upstream propagation (code change → flag upstream + CHANGELOG) | `UpstreamSyncService` (P-04) | **Delivered via Track P-04/P-05** — dynamic files auto-draft LLD+sub-task+CHANGELOG+RTM, human approves |
| ✅ | J-04 | Upstream review flow — review + accept/reject flagged changes | `UpstreamSyncPanel` (P-05) | **Delivered via P-05** |
| ➖ | J-01 | Backend: manual `PUT …/lld/sync-from-code` — re-read `ProjectSourceCode/` → `BaPseudoFile.editedContent` | — | **Superseded** by P-04 auto-detection of dynamic files (no manual re-read button built) |
| ➖ | J-02 | Frontend: "Sync LLD from Code" button + diff panel | — | **Superseded** by P-04/P-05 auto-draft + `UpstreamSyncPanel` review |

---

### Track K — UI-Driven Agentic Code Development (Claude Agent SDK)

> **Architecture decision (2026-06-01):** Use the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) as the execution engine, behind a backend **`AgentRunner` provider interface** (Claude SDK first; other providers pluggable later). Fully UI-driven — live logs, incremental task completion, and permission prompts all surfaced in the browser via SSE/WebSocket. NOT terminal/VS-Code driven.
>
> **Honest scope note:** The SDK runs Claude models (direct / Bedrock / Vertex / Azure). "Same `/prd` `/dev` skills on OpenAI too" is not realistic — those are Claude Code skills. The provider interface lets us add a *different* OpenAI agent later, not the identical skills.
>
> SDK mechanics (verified): `query({ cwd, systemPrompt, allowedTools, canUseTool, hooks })` returns an async stream of messages; `canUseTool` pauses for UI approval; `PostToolUse` hooks report each file edit; `.context/` injected as grounding; sessions resumable.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | K-00 | `AgentSettingsService` (provider · model · API key) — gitignored file store, **key masked in UI** (never returned); `GET/PUT /ba/pipeline/agent-settings`; settings panel on implementation page | Settings-file pattern | Key falls back to `ANTHROPIC_API_KEY` env; verified end-to-end |
| ✅ | K-01 | Installed `@anthropic-ai/claude-agent-sdk`; `AgentRunner` interface + `AGENT_RUNNER` token + `ClaudeAgentRunner` — runs a skill via `query({cwd, model, allowedTools, canUseTool, …})` in `ProjectSourceCode/`, emits typed `AgentEvent`s (log/tool/file/permission/result), routes permissions to a resolver | SDK `query`; `ProjectFolderService` paths | Provider-abstraction seam in place; compiles + DI resolves |
| ✅ | K-02 | `SkillRegistry` — reads the **real** `/prd` + `/dev` markdown (project copy → user `~/.claude/commands/` fallback), strips frontmatter, lists skills; `GET /ba/pipeline/skills` | Existing `/prd` `/dev` files | Verified: both skills resolved + listed in UI; new skill = file + registry entry |
| ✅ | K-03 | `RunManagerService` + SSE — `POST .../implementation/run` starts a run (ReplaySubject), `@Sse .../run/:runId/stream` streams every `AgentEvent` to the browser | Nest `@Sse`, rxjs; `.context/` read + concatenated as grounding | **Verified end-to-end**: start → runner → event → SSE → client |
| ✅ | K-04 | Permission routing — runner's `canUseTool` registers a pending resolver + emits a `permission` event; `POST .../run/:runId/permission` resolves it → agent resumes | SDK `canUseTool`; RunManager pending-map | UI shows approve/deny dialog; the "permissions in UI" requirement |
| ✅ | K-05 | Progress tracking — file edits emit `file` events (tracked at the tool-gate); UI shows files changing incrementally + count | runner file-tracking | Incremental file list live in `AgentRunPanel` |
| ✅ | K-06 | Frontend `AgentRunPanel` — per-skill Run button, subtask input (for /dev), live terminal-style log, files-changed list, in-UI permission dialog, final result; wired into the implementation page | `pipeline-api.ts`; `EventSource` SSE client | Page renders 200; full live UI |

> **Track K complete** — the only step requiring your input is pasting an **Anthropic API key** into Agent Settings; the harness is verified working up to that point (it correctly streams the "no key" error through the full pipeline). Live agentic `/prd` `/dev` runs work once the key is set.

---

### Track L — Downstream → Upstream Sync Agent

> **Architecture decision:** Event-driven + manual hybrid (NOT a continuous file watcher).
> Auto-triggers at end of each /prd or /dev skill run. Manual trigger available anytime.
> Agent proposes upstream changes — user reviews and accepts/rejects per section. Never auto-updates.

```text
/prd or /dev completes → BaSyncAgent fires
  → File hash diff vs last snapshot (BaSyncCheckpointService)
  → LLM semantic impact analysis ("this change affects LLD §3 API contracts")
  → Proposes upstream updates: LLD pseudo-files → LLD doc → PRD+FRD sections → HLD sections
  → Writes to CHANGELOG.md
  → User reviews flagged sections → accepts/rejects
```

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | L-02 | Wire sync trigger to /dev completion — fire upstream detection after each run | `RunManager` hook (P-04) | **Delivered via P-04** (fires on `/dev` run completion) |
| ✅ | L-05 | Frontend: upstream review panel — flagged drafts, per-draft accept/reject | `UpstreamSyncPanel` (P-05) | **Delivered via P-05** |
| ➖ | L-01 | Backend: `BaSyncCheckpointService` — SHA-256 file-hash checkpoints | — | **Superseded** — P-04 detects dynamic files vs pseudo-file/subtask targets instead of hashing |
| ➖ | L-04 | Backend: `BaSyncAgentService` orchestration → flag sections | `UpstreamSyncService` (P-04) | **Superseded** by P-04's file-detection draft flow |
| ➖ | L-06 | Frontend: manual "Sync to Upstream" button | — | **Superseded** — auto-draft on `/dev`; v6 `FreshnessBanner` surfaces upstream staleness |
| ⬜ | L-03 | **OPTIONAL** — AI `/sync-analyze` LLM semantic-impact endpoint (richer than file-detection) | OpenAI JSON pattern; `sync_analysis_prompts.py` | Genuinely deferred — only the heuristic (P-04) shipped; build if semantic diffs are needed |

---

### Track M — Change Request Foundation (Schema NOW · UI Deferred)

> **Why do schema now:** Once artifacts are in production, adding `changeRequestId` and `triggeredBy` to artifact tables requires a disruptive migration. One nullable field per model costs nothing now and avoids rework when CRs ship.
> **CR can come at any stage** — before or after any artifact is generated. The traceability chain must be preserved: original artifact → CR → updated artifact version.

**Foundation schema additions (do now — no UI yet):**

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | M-01 | Prisma: Add `BaChangeRequest` model (parked — no UI) + `BaChangeRequestStatus` + `BaChangeRequestStage` enums | `BaArtifactStatus` enum pattern; `BaProject` relation | Model + 2 enums in schema.prisma; `changeRequests` relation added to BaProject |
| ✅ | M-02 | Prisma: Add `triggeredBy` (`BaTriggeredBy` enum) to `BaArtifact`, `BaProjectPrd`, `BaHld` — INITIAL_GENERATION/CHANGE_REQUEST/DOWNSTREAM_SYNC/MANUAL_EDIT | Existing artifact models | Nullable, defaults INITIAL_GENERATION; existing rows backfill on migration |
| ✅ | M-03 | Prisma: Add nullable `changeRequestId` soft-FK to `BaArtifact`, `BaProjectPrd`, `BaHld`, `BaRtmRow` | Existing soft-FK pattern (lldArtifactId, ftcArtifactId) | Indexed; no hard relation (matches codebase convention) |
| ✅ | M-04 | Prisma: Add `sourceArtifactVersions` JSON to `BaArtifact`, `BaProjectPrd`, `BaHld` | Existing JSON field pattern | e.g., `{ prdVersion: 2, hldVersion: 1 }` — critical for CR impact analysis |
| ✅ | M-05 | Run migration for M-01 to M-04 | `cr_foundation.sql` + `_fixup_ownership.sql` applied; verified in DB | `ba_change_requests` table + 9 columns (3 fields × 3 tables) live; smoke-tested via project-prd endpoint |

> **DB ops note:** `prd_user` now owns the `public` schema (via `_setup_prd_user_permissions.sql`). All 4 new-pipeline tables + CR objects reassigned to `prd_user`. **Future migrations run as `prd_user` — no postgres password needed.** Postgres password (dev): `root`.
| ✅ | M-06 | Backend: Populate `triggeredBy` + `sourceArtifactVersions` in all artifact creation flows | `BaProjectPrdService`, `BaHldService`, SKILL orchestrator | **Done in v6 (S-03)** — PRD/HLD/E2E generate populate both; drives v6 freshness |

**Deferred (spec preserved for future sprint):**

- CR UI: create, list, view CRs per project
- CR approval workflow (reviewer → approver → implementer)
- CR impact analysis: auto-identify which artifacts a CR affects
- CR implementation flow: open a new version of each affected artifact with CR context
- CR RTM view: trace original artifact → CR → updated artifact version

---

### Track N — Module-Scoped Code-Gen & Readiness Gate

> **Decision (2026-06-01):** `/prd` and `/dev` run **per module**, not for the whole project at once. The Implementation ("Code") page gets a **module dropdown**; only modules where **every** artifact exists are selectable. LLD + Subtasks are hard must-haves (alongside PRD+FRD, Wireframes, HLD, EPICs, User Stories).

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | N-01 | Backend: `ModuleReadinessService` — per-module gate. Project-level: PRD+FRD (`BaProjectPrd`) · HLD (`BaHld`). Module-level: **Wireframes / Screens** (dual-source — generated `BaWireframeSet` **OR** customer screenshots that went through screen analysis: `BaScreen` + `SCREEN_ANALYSIS` artifact) · FRD/EPIC/USER_STORY/SUBTASK/LLD present + `BaSubTask` rows + pseudo files. Returns `{ projectGates, modules:[{ ready, gates[], missing[] }] }` | `BaArtifact`, `BaSubTask` groupBy, `BaPseudoFile` count, `BaScreen` groupBy, `BaProjectPrd`, `BaHld`, `BaWireframeSet` | Bulk-load + bucket (no N+1); LLD+Subtasks+visual flagged `mandatory`; FTC NOT a gate. **Verified on Tax Compass** (screenshot→screen-analysis project): MOD-01 (12 screens), MOD-04 (8), MOD-06 (11) **ready**; MOD-02/03/05 blocked only on LLD |
| ✅ | N-02 | Backend: `GET /ba/projects/:id/code/modules` — list modules with readiness + missing-artifact list | N-01; `PipelineController` | Drives the dropdown; HTTP 200 verified |
| ✅ | N-03 | Backend: scope runs to a module — `run` payload gains `moduleDbId`; new `ModuleContextService.buildModuleContext` narrows grounding to that module's EPICs/Stories/LLD + a linkage-rich subtask table + pseudo-file paths (PRD+FRD/HLD stay shared). `RunManager.start` gates on readiness (400 if not ready, 404 if missing) | K-03 `RunManager`; `ModuleReadinessService` (N-01); Prisma | **Verified**: MOD-01 run → `400 "not code-gen-ready — missing: Wireframes"`; bogus id → `404`. Subtasks emitted as summary (id·type·team·prereqs·sourceFile) so 100s of subtasks don't blow context; agent Reads pseudo files from `cwd` |
| ✅ | N-04 | Frontend: `ModuleSelector` on Implementation page — dropdown (●ready/○blocked, inline "missing: …"), per-module readiness checklist (mandatory * markers, detail counts, project/module scope tags); auto-selects first ready module; scopes the `/prd` `/dev` run panels (passes `moduleDbId` only when ready, else disables Run with the missing-list reason) | Implementation page (K-06); `AgentRunPanel` (now takes `moduleDbId`+`disabledReason`); `listCodeModules` API | Frontend tsc clean; page 200. Run buttons disabled + explained until a ready module is picked |

---

### Track O — Task Plan + `/prd` Module Task Generation (linked to subtasks + pseudo files)

> `/prd` (module-scoped) produces a **task list** ordered by the **topological sort of `BaSubTask.prerequisites`** (the subtask sequence is authoritative). Each task explicitly **links** the subtask(s) and pseudo file(s) it implements — shown as chips in the UI.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | O-01 | Prisma: `BaCodeTask` (moduleDbId, projectId, sequence, taskKey, title, description, status `PENDING/RUNNING/COMPLETED/FAILED/SKIPPED`, `subtaskRefs[]`, `pseudoFileRefs[]`, `targetFiles[]`, runId, `isDynamic`, startedAt, completedAt, errorMessage, generatedFiles Json) + `code_tasks.sql` migration run as `prd_user` | `BaSubTask`/`BaPseudoFile` linkage fields | Table + enum live; `BaModule.codeTasks` back-relation; client regenerated |
| ✅ | O-02 | Backend: `CodeTaskPlannerService` — **deterministic** plan from sub-tasks: topo-sort of `prerequisites` (Kahn, deterministic tie-break, cycle-safe), one `BaCodeTask` per subtask; links `subtaskRefs` + `pseudoFileRefs` (segment-boundary file match) + `targetFiles`. Idempotent upsert preserves executed status. `POST .../tasks/plan` | N-03 module context; `BaSubTask.prerequisites`, `sourceFileName` | **Verified** MOD-01: 6 tasks ordered ST-…-01→06, each linked to subtask+pseudo file+target; `/prd` skill stays the agentic *executor* via `/dev` (Step 6) |
| ✅ | O-03 | Backend: `GET .../code/modules/:moduleDbId/tasks` — tasks in execution order + linkage | O-01 | **Verified**: 6 tasks persisted, ordered, statuses returned |
| ✅ | O-04 | Frontend: `CodeTasksPanel` — "Generate Plan" button + ordered task list (seq · taskKey · title · blue subtask chips · green pseudo-file chips · status badge + counts); scoped to the selected module; `dynamic` badge + inline error for failed tasks | `listCodeTasks`/`planCodeTasks` API; Implementation page | Frontend tsc clean; page 200. Live status updates wired for /dev (Step 6) |

---

### Track P — `/dev` Task Execution + Dev Tests + Dynamic Files → Upstream (feeds Track J)

> `/dev` executes the module's task list. **Run-all** (sequential, honoring order) **and per-task** Run both supported. `/dev` runs its **own dev tests** first (shown in a *separate* Dev-Tests section). When `/dev` must create a file not in the LLD/subtasks, it's recorded as a **dynamic task** and the LLD + subtask update is **auto-drafted for human approval** (CHANGELOG + RTM) — closing into Track J.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | P-01 | Backend: `RunManager.startCodeRun` — `/dev` run-all (PENDING/FAILED tasks in sequence, stops on first failure) **and** per-task (`taskKey`); flips `BaCodeTask` PENDING→RUNNING→COMPLETED/FAILED, records `generatedFiles`/`errorMessage`; emits `task` events; gated on readiness. `POST .../tasks/run` + `.../tasks/:taskKey/run` | K-03 SSE/permissions; O-01; `ModuleContextService` | **Gate-verified**: run-all + per-task on non-ready module → `400 missing Wireframes`; per-task instruction built from subtask+pseudo+target. Live flips fire once a module is ready + key set |
| ✅ | P-02 | Frontend: `CodeTasksPanel` live execution — "Run All" + per-task "Run" buttons, SSE `task` events flip status live, `/dev` output log, in-UI permission Allow/Deny; Run disabled with reason until ready+key | O-04; `AgentRunEvent` `task` type; reuses `agentRunStreamUrl`/`resolveAgentPermission` | tsc clean; page 200 |
| ✅ | P-03 | Backend: `TestRunnerService` — runs the module's DEV tests in `ProjectSourceCode/` (auto-detects `npm test`/jest/vitest from package.json), captures output, parses pass/fail, records `BaCodeTestRun{kind:DEV}`. `POST .../tests/dev/run` + `GET .../tests`. Frontend: `TestsPanel` Dev-Tests section (Run + latest badge + expandable history with output) | Q-01 model; `ProjectFolderService`; `child_process` | **Verified** MOD-01: honest `ERROR "no test command"` for Java pseudo-code, run recorded + listed; auto-runs for real Node/TS projects. Generic runner reused by Q-02 |
| ✅ | P-04 | Backend: `UpstreamSyncService` — after each `/dev` run, `detectDynamicFiles` compares written files vs the module's pseudo-files+subtask targets; new ones → dynamic `BaCodeTask{isDynamic:true}` + PENDING `BaUpstreamSync` draft (LLD note + sub-task + CHANGELOG + RTM). `approve()` applies all four upstream + marks APPROVED; `reject()` discards. New `BaUpstreamSync` model + migration (collision-checked) | `BaPseudoFile`, `BaSubTask`, `BaRtmRow`, `ProjectFolderService.appendChangelog`; RunManager hook | **Verified**: approve created pseudo-file+subtask+RTM row + CHANGELOG entry, draft→APPROVED. Auto-draft, human approves |
| ✅ | P-05 | Frontend: `UpstreamSyncPanel` — lists drafts with file·summary·proposed LLD/sub-task/CHANGELOG + **Approve/Reject**; pending-count badge; resolved state shown | P-04 API; Implementation page | tsc clean; page 200. Closes the human-in-the-loop review |

---

### Track Q — FTC-Based Playwright Test Runner + History (Stage 2)

> A **separate "Run" button** runs the module's **FTC-derived Playwright** test cases (built from `BaFtcConfig`, which already targets Playwright). On-screen results + persisted history.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | Q-01 | Prisma: **`BaCodeTestRun`** (table `ba_code_test_runs`) — moduleDbId, projectId, framework, `kind DEV/FTC`, status, total/passed/failed/skipped, durationMs, command, output Text, artifacts Json, reportPath, triggeredByRunId + `code_test_runs.sql` migration; client regenerated | `BaFtcConfig` | Shared by P-03 (DEV) + Q (FTC). **Renamed from `BaTestRun` after it collided with the existing `BaTestRun`/`ba_test_runs` (test-execution tracking); original recovered from 2026-05-22 backup — see incident note** |
| ✅ | Q-02 | Backend: `TestRunnerService.runFtcTests` (reuses generic runner, `kind:FTC`; detects Playwright cmd `test:e2e`/`npx playwright test`) + `getFtcSummary` (FTC case count · Playwright-hinted count · `BaFtcConfig.testingFrameworks`). `POST .../tests/ftc/run` + `GET .../tests/ftc/summary` | `BaTestCase`, `BaFtcConfig`; `TestRunnerService` (P-03) | **Verified** MOD-04 (180 cases, 98 PW-ready, [Playwright,Manual]) & MOD-06 (104, 91); honest `ERROR` (no PW setup in Java pseudo-code), run recorded. Spec-generation-from-FTC = future enhancement |
| ✅ | Q-03 | Backend: history via `GET .../tests?kind=FTC` (newest-first, takes 50) + `getRun` | Q-01; shared list endpoint (P-03) | **Verified**: MOD-04 → 1 FTC / 0 DEV; kind filter works |
| ✅ | Q-04 | Frontend: second `TestsPanel` mounted `kind="FTC"` — dedicated **"Run"** button, latest-status badge, expandable per-run output + **artifacts location** (folder · report · file list), history; FTC-basis summary line (cases · Playwright hints · frameworks) | Implementation page; `runFtcTests`/`getFtcSummary` API | tsc clean; page 200. Separate from Dev-Tests panel |
| ✅ | Q-05 | Backend+UI: **test artifacts capture** — after a run, Playwright `playwright-report/` + `test-results/` (+ coverage) are copied to `ProjectArtifacts/11-TestRuns/{kind}/{runId}/`; `BaCodeTestRun.artifacts`(dir·report·files)+`reportPath` recorded and surfaced in the run row | `ProjectFolderService`; `fs.cp` | **Verified**: report `index.html` + trace copied + listed; answers "where are Playwright outputs stored" |
| ⬜ | Q-06 | **DEFERRED** — Serve + view test artifacts IN the UI: a static-serve/download route under `ProjectArtifacts/11-TestRuns/{runId}/` + "Open report" link (Playwright `index.html`) and image/trace preview/download in the run row. Today the panel shows paths + filenames as **text only** (not clickable). Needs a real Playwright run to be meaningful | `BaCodeTestRun.artifacts`; Nest static/stream route | Surfaces actual report & screenshots in-browser; pairs with FTC→spec generation |

---

### Track R — E2E-Flow (Cross-Module Journeys) — PLAN ONLY, awaiting go-ahead

> **Decision (2026-06-01):** A new **project-scoped** artifact — cross-module, role-based, executable customer journeys — that **starts before EPICs** and **elaborates downstream** at each stage (EPIC → Story → Sub-Task → LLD → FTC → WTC), surfacing design gaps. Fully **additive**, mirroring how FTC v4.2 + Track M were added. **No existing module-scoped flow/test is disturbed.**
>
> **Confirmed choices:** ① Flows are **project-scoped** (like `BaHld`), referenced down into module artifacts. ② **WTC = white-box sub-mode of the FTC skill** (`BaTestCase.scope=white_box` + `includeLldReferences` already exist). ③ E2E skill is **manual/optional, OFF the `BaModuleStatus` machine**, gated by an `FRD_COMPLETE` **project rollup**. ④ **Full decision-graph** branching (nodeType + `nextStepIds[]` + edge labels), not linear steps.
>
> **Reuse decision:** do NOT mutate `BaClickThroughFlow` (hard module-scoped); fork its step-JSON shape + `ClickThroughBuilder.tsx` (~60–70%) into a project-scoped `E2eFlowBuilder`.

**Key Components → artifacts (from the E2E reference docs):** Test Scenarios = `BaE2eFlow`+steps · Test Data = existing `BaTestCase.testData` · Assertions (UI/API/DB) = existing `playwrightHint`/`steps`+`expected`/`sqlSetup`+`sqlVerify`/`postValidation` · Automation = existing `BaFtcConfig.testingFrameworks` · Monitoring = existing `BaTestRun`/`BaDefect` + new `BaThirdPartyIntegration`. **Layered assertions already exist on `BaTestCase`** — E2E only composes + orders them across modules.

| Status | # | Phase / Action Item | Existing Reuse | Notes |
|--------|---|---------------------|----------------|-------|
| ✅ | R-P0 | **Foundation schema (additive):** `BaE2eFlow` (projectId, flowKey, flowName, journeyType, primaryRole, secondaryRoles[], spannedModuleIds[], mermaidDiagrams Json, status, + Track M CR fields); `BaE2eFlowStep` (**graph**: nodeType `BaE2eNodeType`, nextStepIds[], branchLabels Json, moduleDbId?, screenId?, role?, triggerLabel, outcome?, condition?, layer?, thirdPartyIntegrationId?, `elaborationByStage` Json); `BaE2eFlowConfig`(+attachments, mirror `BaFtcConfig`); `BaThirdPartyIntegration`; `BaArtifactType += E2E_FLOW`; nullable cols on `BaProject`/`BaRtmRow`/`BaTestCase` + `e2e_flows.sql` migration (psql) + client regen | FTC v4.2 + Track M migration pattern | **Verified**: 5 tables + enum + cols live; FTC/impl/tasks endpoints still 200 (no regression); enum-add + new tables + nullable cols only |
| ✅ | R-P1 | **Skill + service + CRUD + AI endpoint.** Authored `FINAL-SKILL-E2E-FLOW-*.md`; `E2eFlowService` (project-scoped: config get/upsert · flow create/list/get/update/delete · step upsert/delete · `generate` via AI · integrations CRUD + **`seedIntegrationsFromHld`**); `E2eFlowController` (`/ba/projects/:id/e2e-flows/*`, static routes before `:flowId`); ai-service `e2e_flow_prompts.py` + `POST /e2e-flow-generate` | `HldService` project-scoped pattern; `hld_prompts.py`; HLD `integrations` section | **Reframe:** project-scoped like PRD/HLD (NOT the module-scoped `SKILL_ORDER`) — correct for a cross-module artifact. **Verified**: full CRUD + decision-graph steps + HLD→3 integrations seeded; cleanup clean; no regression. AI `generate` structurally complete (needs ai-service restart + OpenAI key, like PRD/HLD) |
| ✅ | R-P2 | **E2E Flows page + builder.** New `/ba-tool/project/:id/e2e-flows` (linked from dashboard): Config & Generation (reference journeys · roles · narrative · env/baseUrl · Save + **Generate Flows**); 3rd-Party Integrations (list · **Seed from HLD** · add/delete); Flows (create/list/delete) + **decision-graph step editor** (stepId · nodeType · cross-module module dropdown · screen · role · trigger · outcome · condition · layer · **branches: nextStepId→label edges**) + functional Mermaid source view | `pipeline-api.ts` E2E client; `listCodeModules` for module dropdown; Card/Button patterns | tsc clean; page 200. Built clean (not a literal `ClickThroughBuilder` fork) to avoid its module-scoped assumptions |
| ✅ | R-P3 | **Downstream elaboration + gap matrix.** `E2eElaborationService.elaborate(stage)` walks flow steps, records the step's module's real artifacts into `elaborationByStage[stage]` (immutable merge); `gapReport` = step×stage fill matrix. `POST :flowId/elaborate/:stage` + `GET :flowId/gaps`. Frontend `ElaborationMatrix`: per-stage + "Elaborate all" buttons + ✓/· grid | `BaArtifact`/`BaSubTask`/`BaPseudoFile`/`BaTestCase` (read-only) | **Safer than the proposal**: a separate additive pass (NOT modifying the AI EPIC/etc. skills) — existing generation untouched. **Verified**: MOD-04 fills EPIC→FTC (147 subtasks/135 LLD files); MOD-02 shows LLD/FTC gaps. Fixed manual-step `moduleDbId` drop |
| ✅ | R-P4 | **Per-artifact mapping (reverse link).** `E2eMappingService.syncArtifactMappings` stamps an `e2e_flow_mapping` `BaArtifactSection` ("participates in **E2E-X** · steps S01,S02") onto EPIC/US/SUBTASK/LLD/FTC artifacts + populates `BaRtmRow.e2eFlowIds/e2eFlowStepRefs`; idempotent (clears RTM first, removes stale sections). `POST .../sync-mappings`. Frontend "Sync to artifacts" button | generic `BaArtifactSection` (no new table); additive RTM cols (R-P0) | **Verified**: 8 sections + 15 RTM rows; delete flow + re-sync → 8 removed, RTM cleared, 0 residue |
| ✅ | R-P5 | **4 Mermaid diagrams (deterministic) + render.** `E2eDiagramService.buildDiagrams` derives all 4 from structured data (no AI/key): functional (decision-graph flowchart — START/END stadium, DECISION rhombus, branch-labeled edges) · classMethod (from R-P3 SUBTASK elaboration) · dbEntities (LLD/subtask entity files) · integrations (steps + vendor registry) → `BaE2eFlow.mermaidDiagrams`. `POST :flowId/build-diagrams`. Frontend `DiagramsPanel`: Build button + tabbed live Mermaid render (source fallback on error). AI path (R-P1) also fills these | local Mermaid dynamic-import (HLD pattern); ai-service `e2e_flow_prompts.py` | **Verified**: valid Mermaid all 4; OTP valid/invalid branches render; real classes from subtasks. `mermaid-sanitizer` wiring left optional (deterministic output clean + UI fallback) |
| ✅ | R-P6 | **E2E test execution.** `E2eTestService.composeTestPlan` (read-only) — per-step FTC coverage + layered assertion counts (UI=`playwrightHint` · DB=`sqlSetup/sqlVerify` · white-box=`scope`), flags gap steps; `runE2eTests` executes the FTC suite **per spanned module reusing the Track-Q runner**. `GET :flowId/test-plan` + `POST :flowId/run-tests`. Frontend `TestPlanPanel`: coverage table + "Run E2E tests" + per-module results | `BaTestCase` layered fields; `TestRunnerService` (Track Q); RTM `e2eFlow*` set in R-P4 | **Verified**: MOD-04 step → 180 cases (98 UI, 180 DB, 82 WBox), MOD-02 step → 0 = gap; run reuses FTC runner. **Read-only plan** (no bulk-write to real test cases) — `linkedE2e*` persistence left as a safe follow-up |

> **Resolved (2026-06-01):** ⑤ `BaThirdPartyIntegration` is **auto-seeded from the HLD `integrations` section + the E2E skill, and editable in the UI**. ⑥ The legacy `BaTestCase.e2eFlow` text field is **kept untouched for back-compat**; new structured links (`linkedE2eFlowIds`/`linkedE2eStepIds`) are added alongside it. **Design fully locked — plan only, no code until go-ahead.**

---

### Track S — Interactive PRD Authoring (Gap Loop · Inline AI/Mic Editing) — Sprint v6, ✅ COMPLETE (2026-06-03)

> **Decision (2026-06-03):** Bring the legacy `/prd` pipeline's interactive authoring UX to the new project-scoped `/ba-tool/project/[id]/project-prd` track, which is currently **read/generate-only**. Reuse the proven `GapWizard` / `FormField` / `AISuggestButton` / `MicButton` components on the new persistent, **versioned** `BaProjectPrd` model. The **22 canonical sections stay fixed** — AI enriches *within* sections (§6 modules / §10 NFR / §7 integrations); net-new top-level items go to **§22 (Miscellaneous)** tagged `[AI] [NEW]`, never new section keys.
>
> **Foundation decisions (confirmed):** **F1** add `metadata Json` to `BaProjectPrd` + `BaHld` (gaps/answers/freshness). **F2** realize the documented `{aiContent, editedContent, lockedAt}` section shape via a single `section-normalizer` seam (blue=AI, ink=edited, lockable) — all readers (export, FrdView, RTM, context-engineering) routed through it. **F3** inline section edit = in-place + `lastEditedAt` + propagation; regenerate / gap-resolution = new version. **F5** bundle **M-06** (populate `triggeredBy` + `sourceArtifactVersions`), reuse `MANUAL_EDIT` (no enum migration). Full spec in `sprints/v6/PRD.md` + `TASKS.md`.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | S-01 | Prisma: add `metadata Json @default("{}")` to `BaProjectPrd` + `BaHld` (F1); migrate as `prd_user` | Track M migration pattern | Holds `metadata.gaps`/`gapAnswers`/`freshness` |
| ✅ | S-02 | `section-normalizer.ts` — flat `[AI]` ⇄ `{aiContent, editedContent, lockedAt, lastEditedAt}` (F2); route export/FrdView/RTM/context reads through it | existing `[AI]` convention | Pure + unit-tested; round-trip safe for legacy rows |
| ✅ | S-03 | M-06 — populate `triggeredBy` + `sourceArtifactVersions` on PRD/HLD/E2E generate (F5) | M-02/M-04 columns | Staleness (T-02) depends on this |
| ✅ | S-04 | AI `/gap-check` answer-merge contract (`{sections, answers}` → `{updatedSections, remainingGaps}`) | legacy `/prd` `/gap-check` | Reuse; extend prompt only if needed |
| ✅ | S-05 | `ProjectPrdService` — persist gaps to `metadata.gaps` + `answerGaps` (new version + propagation); `GET …/gaps`, `POST …/answer-gaps` | `ProjectPrdService` | Fail-safe on malformed merge (keep prior version) |
| ✅ | S-06 | Frontend: `PrdGapPanel` — port `GapWizard` (voice/text answers) onto the PRD page | `conversational/GapWizard.tsx`, `MicButton` | Replaces the static amber gaps card |
| ✅ | S-07 | `updateSection` rework (F3: in-place + `lastEditedAt` + propagation) + `POST …/suggest-field` | `ProjectPrdService`, AI `/suggest` | Locked fields skipped by regenerate |
| ✅ | S-08 | Frontend: inline section editor — `FormField` + AI Suggest + Mic + **blue AI text** + lock; **unblocks I-03** | `forms/FormField.tsx`, `AISuggestButton.tsx`, `MicButton.tsx` | FRD (§6) keeps module/feature structure |
| ✅ | S-08b | Frontend: **FRD (§6) feature-level inline editing** (Phase-2 fast-follow) — edit each feature's name/description/businessRule/AC/priority with AI Suggest+Mic+lock; preserve module/feature + FR-IDs | `PrdSectionEditor`; per-feature normalizer round-trip | Raised 2026-06-03: §6 features were read-only in S-08 |
| ✅ | S-09 | AI prompts: enrich WITHIN canonical sections; net-new → §22 `[AI] [NEW]`; never new top-level keys | `parse_prompts.py`, `gap_check_prompts.py` | Preserves the 22-key contract |
| ✅ | S-10 | Frontend: render `[AI] [NEW]` items with a distinct "new" chip | `AiText`/`FrdView` renderers | Visualises additions from later inputs |

---

### Track T — Forward Propagation & Artifact Freshness (PRD→HLD→E2E→modules) — Sprint v6, ✅ COMPLETE (2026-06-03)

> **Decision (2026-06-03):** Close the forward-propagation gap. The impact engine `RequirementChangeService` (I-01/I-02) already flags **module** artifacts but **ignores the project-scoped HLD + E2E flows** that sit between the PRD and the modules, and has **no version-staleness concept**. Track T extends it to the full chain and adds a freshness checker driven by `sourceArtifactVersions`, surfaced as a banner on each downstream page. **Non-destructive** — flags stale, never auto-regenerates. This is the in-UI surface that finally satisfies the deferred **I-03**.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | T-01 | Extend `RequirementChangeService.analyzeChange` to flag `BaHld` + `BaE2eFlow` (PRD change) and `BaE2eFlow` + modules (HLD change) | `requirement-change.service.ts` (I-01) | Report gains "upstream artifacts flagged" section |
| ✅ | T-02 | `ArtifactFreshnessService.check` — compare downstream `sourceArtifactVersions` vs current upstream version → stale map; `GET …/freshness` | `sourceArtifactVersions` (M-04) | Missing version → "unknown, regenerate" (no crash) |
| ✅ | T-03 | Frontend: `FreshnessBanner` on HLD / E2E / Implementation pages — "built from PRD v{n}, current v{m}"; renders **I-03** impact data | existing pipeline pages | Amber when stale, hidden/green when current |
| ✅ | T-04 | Fire propagation (`analyzeChange` + freshness recompute) on every PRD/HLD gap-answer/edit/regenerate + CHANGELOG (`Forward Sync`) | `project-folder.service.ts` changelog | Best-effort, non-blocking |

---

### Track U — Direct Narration / Conversational Seed (no-inputs path) — Sprint v6 addendum, ✅ COMPLETE (2026-06-03)

> **Raised 2026-06-03 (testing Phase 2):** the new pipeline relocated input collection into the Customer Inputs hub (`TEXT_CONTEXT` paste + `AUDIO` file-upload, auto-transcribed) but lost the old `/prd` tool's **in-browser narration** and the **"no inputs yet → narrate/type → generate"** quick-start. Track U restores both. Additive; reuses `MicButton`.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | U-01 | Frontend: **in-browser mic recording** on the Customer Inputs `AUDIO` card (record + transcribe in-browser → save as input) | `components/forms/MicButton.tsx` (MediaRecorder); customer-inputs page | Today audio is upload-only |
| ✅ | U-02 | Frontend: PRD **empty-state conversational seed** — "Start from voice or text" box creates a `TEXT_CONTEXT` input + triggers generate | `createCustomerInput` + `generateProjectPrd`; `MicButton` | Gives old narrate/type → PRD on the PRD page |

---

### Track V — Canonical PRD Preview & Export + Always-On AI Suggest — Sprint v6 addendum 2 (2026-06-03)

> **Raised testing v6:** parity with the original `/prd` tool. (1) AI Suggest was hidden behind the per-section Edit toggle — make it always-on (old tool is an always-editable form). (2) No in-browser **canonical PRD view / download** — the old "Generate → Preview/Source" step. (3) 413 on the old tool's bulk create — fixed (body limit 100kb→25mb in `main.ts`).

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | V-03 | Frontend: **AI Suggest always visible** — expanding a section opens the editor directly (no read-only/Edit toggle) | `PrdSectionEditor`/`FrdEditor` | Matches old always-editable form |
| ✅ | V-02 | Backend+FE: **Markdown export endpoint + Download** (`GET …/project-prd/markdown`) | `exportMarkdown` renderer + F2 seam | PDF/DOCX deferred |
| ✅ | V-01 | Frontend: **Preview** toggle → full canonical rendered document (22 sections + §6 modules/features, AI text blue) | `FieldValue`/`FrdView` (read-only renderers) | The "generate → see full PRD canonically" view |
| ✅ | V-00 | Backend: raise body-parser limit 100kb→25mb (fixes 413 on bulk create / large §6 save) | `main.ts` (json/urlencoded) | Done 2026-06-03 |

---

### Track X — Guided PRD Editor Shell — Sprint v7, ✅ COMPLETE (2026-06-03)

> UI parity with the old `/prd/[id]/edit`: brings the stepper + sidebar checklist + focused single-section authoring into the new `/ba-tool` pipeline. Full spec in `sprints/v7/`.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | X-1 | `computeSectionStatuses` (derived NOT_STARTED/IN_PROGRESS/COMPLETE) + exposed on GET | v6 `section-normalizer` | 12 unit tests |
| ✅ | X-2 | `PrdStepper` (1–22 status-colored) + `PrdSidebar` ("PRD SECTIONS" + §6 feature tree) | — | |
| ✅ | X-3 | `PrdGuidedEditor` — focused single-section + Previous / Save & Continue / Next | reuses `PrdSectionEditor`/`FrdEditor` | |
| ✅ | X-4 | `PrdViewSource` — customer inputs the PRD was generated from | `GET …/project-prd/source` | |

### Track W — Draft Review & PRD Metadata — ✅ DELIVERED in Sprint v7 (2026-06-03)

> Was deferred from v6; built in v7. Per-section accept gate + metadata + version history on the persistent `BaProjectPrd`. Full spec in `sprints/v7/`.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | W-01 | Draft-review stage — per-section Accept/Edit/Skip + Accept All + progress + **Confirm** (DRAFT→CONFIRMED/_PARTIAL) | `PrdReviewMode`; review map in `metadata.review` | |
| ✅ | W-02 | PRD-level metadata (PRD Code, Client, Submitted By) + **version history UI** (list/view/restore) | `prdCode/clientName/submittedBy` cols; `/versions` + `/restore` | diff/compare out of scope |

---

### Track Y — PRD-Sourced Screen↔Feature Mapping — Sprint v8, ✅ COMPLETE (2026-06-04)

> **Decision (2026-06-04):** A new pipeline **Wireframes stage between PRD and HLD**, sourced from the **PRD** (not the BRD/Approach Note that drive Discovery wireframes). Step 1 is a screen↔feature **mapping** artifact (CSV-shaped, mirroring the customer reference RTM) where `frRefs` are §6 FR-IDs and every annotation cites **PRD §/FR-IDs**. Full spec in `sprints/v8/`.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | Y-01 | Prisma: `BaScreenMap` + `BaScreenMapRow` (annotations JSON, PRD refs) + migration | Track M/v6 migration pattern | screen-centric, versioned, `sourceArtifactVersions={prdVersion}` |
| ✅ | Y-02 | AI: `/screen-map-generate` — PRD §6 FRD + §5/§8/§10 → screens + FR mapping + business rules + annotations | `parse`/`hld` prompt patterns; F2 normalizer | `screen_map_prompts.py`; refs cite PRD, never SRS/BRD/AN |
| ✅ | Y-03 | Backend: `ScreenMapService` — generate / CRUD / **CSV import + export** / coverage (orphan FRs/screens) | `ProjectFolderService`; F2 normalizer | exports to `02b-ScreenMap/` + CHANGELOG |
| ✅ | Y-04 | Frontend: mapping table + annotations editor (numbered + Persona) + CSV up/download | `pipeline-api`; Card/table patterns | "Generate from PRD" + edit + coverage |

---

### Track Z — Wireframes Stage (Lo-fi + Hi-fi, PRD-driven) + Bulk Upload — Sprint v8, ✅ COMPLETE (2026-06-04)

> **Decision (2026-06-04):** Reuse + extend the Discovery wireframe models (`BaWireframeSet`/`BaHifiSet`) with a `source` discriminator (`DISCOVERY`/`PIPELINE`); generate lo-fi/hi-fi from the PRD-sourced screen map; **single + bulk upload** for 3rd-party wireframes; reflect `CUSTOMER_WIREFRAME` inputs. Discovery (BRD/AN) wireframes untouched.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | Z-01 | Prisma: extend `BaWireframeSet` (nullable AN FK + `source` + `screenMapId` + `sourceArtifactVersions`) + migration | existing wireframe models | Discovery rows backfill `source=DISCOVERY` |
| ✅ | Z-02 | Backend: generate **lo-fi from screen map** → **hi-fi** (PIPELINE source) | `WireframeService`/`HifiService`/`WireframeExportService` | callouts=annotations; `meta.frRefs`=§6 FR-IDs; preserve uploaded |
| ✅ | Z-03 | Backend: **upload (single/bulk)** HTML/PNG/JPG → screens; reflect `CUSTOMER_WIREFRAME` inputs | `FileInterceptor`; attachment storage | `meta.uploaded=true`; disk mirror |
| ✅ | Z-04 | Frontend: **`/wireframes` page** (mapping → lo-fi → hi-fi galleries + Upload) + nav between PRD and HLD | `pipeline-api`; iframe preview (Discovery pattern) | new pipeline stage |
| ✅ | Z-05 | Integration: HLD `buildWireframeContext` prefers PIPELINE; readiness N-01; **freshness** PRD→map→wf→HLD | v6 Track T; `project-hld.service` | extends `ArtifactFreshnessService`/`RequirementChangeService` |
| ✅ | Z-06 | Wire-up: smoke + regression (incl. Discovery no-regression) | — | tsc clean; CSV parser unit-tested |

---

### Track AA — Design System data model — Sprint v9, ✅ COMPLETE (2026-06-04)

> **Decision (2026-06-04):** A new **Look & Feel / Design System Studio** stage **between Screen-Map and Lo-fi**. Per-project active tokens + a **shared (GLOBAL) preset library**; tokens formalize the existing `brandTokensSnapshot` shape (lifted from the user's reference `:root`). Full spec in `sprints/v9/`.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | AA-01 | Prisma: `BaDesignSystem` (per-project tokens + logo) + `BaDesignPreset` (GLOBAL/PROJECT library) + `BaWireframeSet.designSystemId` + migration | v8 wireframe models; `brandTokensSnapshot` shape | additive; applied as `prd_user` |

---

### Track BB — Design System backend (Studio service) — Sprint v9, ✅ COMPLETE (2026-06-04)

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | BB-01 | `DesignSystemService`: get/save tokens · logo upload · preset CRUD · **seed starter presets** · shared **`tokensToCss()`** · `renderSamplePreview` (web + mobile) | `ProjectFolderService`; brand-token util | one token→CSS util shared by studio/lo-fi/navigator |
| ✅ | BB-02 | Routes: design-system (get/put/logo/preview) + design-presets (list/apply/save) | `PipelineController` patterns | preview `?platform=web\|mobile` |

---

### Track CC — Design System Studio frontend — Sprint v9, ✅ COMPLETE (2026-06-04)

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | CC-01 | `pipeline-api` helpers + `DesignTokens`/`DesignPreset` types | `pipeline-api.ts` | — |
| ✅ | CC-02 | Studio page — grouped parameter form (brand/neutral/semantic/module/persona/type/shape/platform) + **logo upload** | LLD/architecture page styling | strong defaults; collapsible advanced |
| ✅ | CC-03 | **Template library** + **live web/mobile preview** + **bidirectional sync** (preset ↔ param) + save-as-preset + nav (before Wireframes) | iframe preview pattern | single in-memory token object = source of truth |

---

### Track DD — Wireframe Navigator + token threading — Sprint v9, ✅ COMPLETE (2026-06-04)

> **Decision (2026-06-04):** The wireframe stage **always emits a stitched `index.html` navigator** (modules→screens) — standing output to `ProjectArtifacts`, viewable in-app, downloadable as a zip. Per the user's reference navigator.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | DD-01 | `WireframeNavigatorService`: deterministic `index.html` from screen-map (modules via §6 FR-ID prefix) + tokens + screens (sidebar groups · Web/Mobile/Infra · phase · search · hero · screen cards · mobile section · legend) | screen-map; `tokensToCss()` | mirrors the user's reference `index.html` |
| ✅ | DD-02 | Thread tokens into **lo-fi** (deterministic) + **hi-fi** (Claude); navigator as **standing output** to `03-/04-` folders | v8 `PipelineWireframeService`/`HifiService` | record `designSystemId/Version` on set |
| ✅ | DD-03 | In-app navigator view + **zip export** (screens + index.html + shared CSS) + `/wireframes` buttons | `WireframeExportService` | "Open navigator" + "Download zip" |

---

### Track EE — Integration (freshness, readiness, regression) — Sprint v9, ✅ COMPLETE (2026-06-04)

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | EE-01 | Freshness: add `DESIGN_SYSTEM` to the chain (PRD → Map → Design System → Wireframes → HLD); readiness soft-gate before lo-fi | v8 `ArtifactFreshnessService` | design-system change ⇒ wireframes stale |
| ✅ | EE-02 | Wire-up: unit tests (`tokensToCss`, navigator grouping, preset round-trip) + smoke + Discovery no-regression | — | tsc clean both apps |

---

### Track FF — Import reference screens/templates → presets — Sprint v9, ✅ COMPLETE (2026-06-04)

> **Decision (2026-06-04):** An **Upload reference** button in the Template Library ingests reference screens/templates (multi-file **or** folder) and turns each into an applicable preset. HTML/CSS → **deterministic** `:root`/color extraction; PNG/JPG/SVG → **Vision** (`/extract-brand-tokens`). Derived presets fill colors; type/shape default (labelled "imported"); uploaded artifact kept as thumbnail.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | FF-01 | Backend: `extractTokensFromHtml()` (deterministic) + `importReferences` (HTML→tokens, image→Vision, multi/folder) + route | `design-tokens`; `AiService.extractBrandTokens`; `FilesInterceptor` | PROJECT presets w/ thumbnail |
| ✅ | FF-02 | Frontend: **Upload reference** (multi-file + folder) in Template Library | studio page; `pipeline-api` | imported-preset marker |
| ✅ | FF-03 | Unit test (HTML extract) + smoke + tsc clean | — | — |

---

### Track GG — Wireframe gallery UX + lo-fi differentiation + hi-fi selection — Sprint v9, ✅ COMPLETE (2026-06-04)

> **Decision (2026-06-04):** lo-fi cards open in an **in-app modal** (+ new tab); lo-fi default = **type-aware deterministic** skeletons **plus** an optional **AI lo-fi** (Claude); **per-screen checkboxes** choose which lo-fi screens generate **hi-fi**.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | GG-01 | FE: click-to-open modal (+ new tab) for gallery cards | `/wireframes` Gallery | sandbox iframe |
| ✅ | GG-02 | BE: type-aware deterministic lo-fi (`inferScreenType` + per-type skeletons) | `loFiHtml`; `tokensToCss` | free, token-driven |
| ✅ | GG-03 | BE+AI: optional AI lo-fi (`/lofi-generate` Claude grey-box) | hi-fi pipeline pattern | `generateLoFi({mode})` |
| ✅ | GG-04 | BE: hi-fi from a selected subset (`slugs`) | `HifiService.generate` `limit` | supersedes first-N |
| ✅ | GG-05 | FE: selection checkboxes + "Generate hi-fi for selected" + lo-fi mode toggle | `/wireframes` page | per-card AI regen |
| ✅ | GG-06 | Unit test (`inferScreenType`) + smoke + tsc | — | — |

---

### Track LL — Design System Studio: diagram-palette editor — Sprint v9, ✅ COMPLETE (2026-06-05)

> **Decision (2026-06-05):** surface the `diagramPalette` in the Studio so a UX resource can recolor the 7 diagram layers per project; edits flow to the HLD diagrams + project-structure grid. Frontend-only.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | LL-01 | "Diagram palette" group (7 layers × fill/border/text + sample chip) + `setLayer` + `withDefaults` legacy backfill | Studio page; `diagramPalette` | fixes crash on pre-palette saved tokens |
| ✅ | LL-02 | tsc + Playwright (group, 7 layers, 43 colour inputs) | — | — |

---

### Track KK — Pastel diagram palette (in Design System) + project-structure diagram — Sprint v9, ✅ COMPLETE (2026-06-04)

> **Decision (2026-06-04):** add the reference diagram's exact pastel palette **into the Design System** (`diagramPalette`) and drive both the architecture (Mermaid) diagrams and a new **project-structure diagram** (pastel HTML grid + legend) from it. Structure derived deterministically from the project's §6 modules + stack.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | KK-01 | `diagramPalette` (attached pastels) in `DesignTokens` + tokensToCss vars + FE type | `design-tokens` | seed presets inherit |
| ✅ | KK-02 | Pastel Mermaid theme from the palette | `Mermaid`; `mermaid@11` | fallback = attached defaults |
| ✅ | KK-03 | `buildProjectStructure` (deterministic) + `GET hld/project-structure` + pastel grid in §17 | `HldService`; `BaModule` | grid + legend like the attached |
| ✅ | KK-04 | tsc + design-tokens tests (15) + Playwright | — | — |

---

### Track JJ — HLD page: left section menu + switchable panels — Sprint v9, ✅ COMPLETE (2026-06-04)

> **Decision (2026-06-04):** the HLD page was a long scroll (17 sections + diagrams) and the architecture diagrams rendered as raw Mermaid code (render error → amber source fallback). Add a **left section menu** (Diagrams + 17 headings) with one-panel-at-a-time switching (like wireframes/PRD), and **fix the Mermaid renderer** so diagrams draw.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | JJ-01 | FE: HLD left section menu + switchable panels | `/hld` page; `HLD_SECTIONS` | no API/DB change |
| ✅ | JJ-02 | FE: fix Mermaid v11 render (init-once, robust) | existing `Mermaid` component; `mermaid@11` | source fallback on genuine error only |
| ✅ | JJ-03 | Playwright smoke (sidebar, switch, diagram→svg) + tsc | — | — |

---

### Track II — Wireframes page: left-rail stepper + switchable panels — Sprint v9, ✅ COMPLETE (2026-06-04)

> **Decision (2026-06-04):** the 3 wireframe stages were a long vertical scroll (lower stages missed). Refactor `/wireframes` into a **left sticky stepper rail** (status/counts/✓/locked + "N selected") with **one panel shown at a time** (matches v7 `PrdStepper`/`PrdSidebar`). Frontend-only; behavior unchanged.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | II-01 | FE: left-rail stepper + switchable panels + status/gating | `/wireframes` page; v7 stepper | no API/DB change |
| ✅ | II-02 | Playwright smoke + tsc clean | — | — |

---

### Track HH — Coexisting lo-fi variants (deterministic + AI) + active selection — Sprint v9, ✅ COMPLETE (2026-06-04)

> **Decision (2026-06-04):** AI lo-fi no longer overwrites the deterministic wireframe — both variants coexist per screen. UX: per-card `[Deterministic | AI]` toggle + modal side-by-side compare + an "active" marker. Active variant (user-chosen, default deterministic) drives navigator/zip/export. Hi-fi stays checkbox-driven.

| Status | # | Action Item | Existing Reuse | Notes |
|--------|---|-------------|----------------|-------|
| ✅ | HH-01 | BE: AI lo-fi as `meta.aiHtml` variant (keep deterministic `htmlContent`) + `meta.activeVariant` + set-variant route + navigator uses active | `regenerateLoFiWithAI`; navigator | no migration (meta JSON) |
| ✅ | HH-02 | FE: card `[Deterministic\|AI]` toggle + modal compare + active marker | `/wireframes` Gallery | persists active via API |
| ✅ | HH-03 | Smoke + tsc clean | — | — |

---

### HLD Template

> **Status:** ✅ User shared HRMS-HLD-Consolidated-v2.1.1 (63 pages). 17 section keys derived and implemented in `BaHld` model and stub AI endpoint.

---

### New Pipeline Summary

| Track | Items | Delivers |
|---|---|---|
| Phase 0 — Skeleton | 7 (7 ✅) | **COMPLETE** — full end-to-end stubs + folder service + context seeding |
| A — Foundation | 6 (6 ✅) | **COMPLETE** — DB schema + `ProjectFolderService` |
| B — Customer Input Hub | 3 (3 ✅) | **COMPLETE** — multi-type input collection, extraction, disk mirror |
| C — PRD + FRD | 4 (4 ✅) | **COMPLETE** — AI generation (reuses parse prompt), 22-section viewer, disk export |
| D — Wireframe Disk Writes | 2 (2 ✅) | **COMPLETE** — reuse Discovery lo-fi + hi-fi; disk mirror + backfill |
| E — HLD | 5 (5 ✅) | **COMPLETE** — 17-section HLD + 5 Mermaid diagrams, AI-generated |
| F — EPIC Context | 2 (2 ✅) | **COMPLETE** — EPIC grounded in PRD+HLD+wireframes; EPIC→disk |
| G — Story/Subtask Exports | 2 (2 ✅) | **COMPLETE** — Stories + SubTasks → disk (shared helper) |
| H — ProjectSourceCode + Context | 6 (6 ✅) | **COMPLETE** — scaffold from LLD (230 files), real context engineering, CHANGELOG, status UI |
| I — RTM for Req Changes | 3 (2 ✅) | I-01/I-02 **done** — PRD/HLD section edit → downstream impact + MD/CSV report + CHANGELOG; I-03 (UI banner) deferred (no section-editor wired) |
| J — Downstream → Upstream | 4 | **DELIVERED via P-04/P-05** — dynamic files auto-draft LLD+sub-task+CHANGELOG+RTM, human approves |
| K — UI-Driven Agentic Code Dev | 7 (7 ✅) | **COMPLETE** — Claude Agent SDK, SSE live logs, in-UI permissions, incremental files (needs API key for live run) |
| L — Sync Agent | 6 | **Core delivered via P-04** — event-driven detection on `/dev` completion → upstream drafts; LLM semantic-impact variant still optional |
| M — CR Foundation (schema) | 6 (6 ✅) | **COMPLETE** — schema + fields for future Change Request feature |
| N — Module-Scoped Code-Gen & Readiness Gate | 4 (4 ✅) | **COMPLETE** — per-module `/prd` `/dev`; readiness-gated dropdown (dual-source Wireframes/Screens; LLD+Subtasks mandatory); module-scoped context + run gate |
| O — Task Plan + `/prd` Linkage | 4 (4 ✅) | **COMPLETE** — `BaCodeTask` ordered by subtask prerequisite topo-sort; each task links subtask(s) + pseudo file(s); Tasks panel UI |
| P — `/dev` Execution + Dev Tests + Dynamic Files | 5 (5 ✅) | **COMPLETE** — run-all + per-task live status; dev-tests section; dynamic files auto-draft upstream (closes J) |
| Q — FTC Playwright Runner + History | 5 (5 ✅) | **COMPLETE** — generic test runner; separate FTC "Run" + FTC-basis summary + history + per-run artifacts folder |
| R — E2E-Flow (Cross-Module Journeys) | 7 (7 ✅) | **COMPLETE** — project-scoped decision-graph artifact; builder UI; bidirectional traceability (elaboration + gap matrix + per-artifact mapping); 4 Mermaid diagrams; test-plan + execution. Fully additive |
| S — Interactive PRD Authoring | 11 (11 ✅) | **COMPLETE (v6)** — gap-answering loop + inline AI-Suggest/Mic editor (blue AI text) on `project-prd`; FRD feature editing (S-08b); enrich-within-section + §22 `[AI][NEW]`; lock enforcement. Unblocks I-03 |
| T — Forward Propagation & Freshness | 4 (4 ✅) | **COMPLETE (v6)** — impact engine extended to HLD + E2E; `ArtifactFreshnessService` staleness checker; freshness banner on HLD/E2E/Impl; forward-sync CHANGELOG. Non-destructive |
| U — Direct Narration / No-Inputs Seed | 2 (2 ✅) | **COMPLETE (v6)** — in-browser mic on Customer Inputs; PRD empty-state "narrate/type → generate" |
| X — Guided PRD Editor Shell | 4 (4 ✅) | **COMPLETE (v7)** — stepper + sidebar checklist + §6 feature tree + focused Save & Continue + View Source |
| W — Draft Review · Metadata · History | 2 (2 ✅) | **COMPLETE (v7)** — Accept/Edit/Skip + Accept All + Confirm; PRD metadata; version history (view/restore) |
| Y — PRD-Sourced Screen↔Feature Mapping | 4 | **PLAN (v8)** — mapping artifact from PRD (CSV-shaped); annotations cite PRD §/FR; generate/edit/import/export |
| Z — Wireframes Stage (Lo-fi + Hi-fi) + Bulk Upload | 6 | **PLAN (v8)** — PRD-driven lo-fi→hi-fi (reuse Discovery models, `source=PIPELINE`); 3rd-party bulk upload; freshness PRD→map→wf→HLD |
| **Total** | **112** | Complete pipeline + agentic code-gen + two-tier tests + sync + interactive authoring + forward propagation + guided editor/review (v6/v7 shipped) + PRD-sourced wireframes stage (v8 planned) |

### What changed from original plan

| Change | Reason |
|---|---|
| `ProjectImplementation/` → `ProjectSourceCode/` | User clarified folder name |
| Folder root = `project.name` not code | Human-readable folder names per project |
| Lo-fi + Hi-fi: fully reuse Discovery | Already built in `BaWireframeSet`/`BaHifiSet` — Track D only adds disk writes |
| H-06 added: `CHANGELOG.md` | Track every downstream→upstream change with timestamp |
| J-03 + J-04 added: downstream→upstream propagation | Code changes flag PRD+FRD / HLD for review; user accepts/rejects per section |
| Track L added: Sync Agent (6 items) | Event-driven agent at end of /prd /dev runs; LLM semantic impact; non-destructive review |
| Track M added: CR Foundation (6 items + deferred UI) | Schema designed now to avoid migration rework when CRs ship; `triggeredBy` + `changeRequestId` + `sourceArtifactVersions` added to all artifact models |
| Tracks S + T added (v6, 2026-06-03): Interactive PRD Authoring + Forward Propagation | New `project-prd` track was read/generate-only; v6 ports the legacy gap-loop + inline AI/Mic editor (blue AI text) onto the versioned `BaProjectPrd`, keeps the 22 canonical sections fixed (enrich-within + §22 appendix), and extends the impact engine to flag HLD + E2E + module artifacts with a `sourceArtifactVersions` freshness banner — closing the forward PRD→HLD→E2E loop and unblocking the deferred I-03 |

---


Priority scale:

- **P0** — Top (do next, blocks or degrades the flow we already shipped)
- **P1** — High (visible gap users will hit within a week)
- **P2** — Medium (quality-of-life, active scope)
- **P3** — Low (nice-to-have, polish)
- **DEFERRED** — Scope-locked items parked for a future sprint (specs preserved so we can resume without re-designing)

---

## Active Lane — what we're working through

### P0 — Do Next

_P0 lane is clear. Next push starts from P1._

### P1 — High

_P1 lane is clear. Next push starts from P2 (TDD codegen)._

### P2 — TDD Codegen (active)

_P2 active lane clear. D1 + D2 both shipped. Next push goes to P3 polish or returns to the deferred lane._

### P3 — UX Polish

| # | Item | Why | Effort |
|---|------|-----|--------|
| UX1 | Dark mode toggle | Requested informally. | S |
| UX2 | Keyboard shortcuts (j/k to navigate tree, r to record run, g to generate) | Power users. | S |
| UX4 | Drag-drop reorder of TCs within a category | Current order is DB insertion order. | M |
| UX6 | A11y audit — ARIA labels, keyboard nav, focus order | We haven't checked; likely many misses. | M |

### P3 — Docs

| # | Item | Why | Effort |
|---|------|-----|--------|
| G1 | User manual (screenshots, end-to-end walkthrough) | Onboarding new BAs/testers. | M |
| G2 | Admin guide (env vars, storage backends, Prisma migrations, backup) | Ops handoff. | M |
| G5 | Video tutorial (5 min end-to-end) | Sales / demo. | M |

### P3 — Security Hardening

| # | Item | Why | Effort |
|---|------|-----|--------|
| H2 | Virus scan on uploaded attachments (ClamAV) | Currently raw upload. | S |
| H3 | Secret rotation — OPENAI_API_KEY, DATABASE_URL via Vault/KMS | Today secrets live in `.env`. | M |
| H4 | Pen-test hardening pass | Pre-production gate. | L |

---

## DEFERRED Lane — parked for a future sprint (specs preserved)

### G3 — API reference via `@nestjs/swagger`

**Decision (2026-04-24):** Deferred. Distinct from D2 (which emits contract-test scaffolds for the user's target application). G3 documents the BA Tool's own NestJS endpoint surface for integrators.

- **Scope when resumed:** install `@nestjs/swagger` + `swagger-ui-express`, call `SwaggerModule.setup()` in `main.ts`, expose at `GET /api/docs` (HTML UI) + `GET /api/docs-json` (raw OpenAPI).
- **Controllers to annotate:** BaToolController, BaSkillController, BaLldController, BaFtcController, BaExecutionController, BaSprintController, BaMasterDataController — add `@ApiTags` + `@ApiOperation` where TS types alone aren't descriptive.
- **Consumers:** CI pipelines auto-triggering skills; typed SDKs for external integrators; admin-guide (G2) cross-references.
- **Estimate when resumed:** S (~30 min wiring + ~1 h decorator polish).

### F2 — Issue Tracker Integrations (Monday / Jira / ADO)

**Decision (2026-04-24):** Build later, but scope locked.

- **Architecture:** Pluggable `IssueTracker` interface so one abstraction serves Monday, Jira, ADO.
- **Monday scope (first implementation):**
  - **Board mapping:** one Monday board **per BA project** (not global). Project schema needs `mondayBoardId` column.
  - **Severity column:** build-side creates a new "Severity" status column on each project board with P0/P1/P2/P3 swatches. Column IDs captured at board-create time and persisted in project row.
  - **Auth:** personal API token (OAuth deferred). Env: `MONDAY_API_TOKEN`, `MONDAY_API_URL=https://api.monday.com/v2`.
  - **API:** GraphQL (`create_item`, `change_column_value`, `change_simple_column_value`).
  - **externalRef format:** `monday://item/{itemId}` with `externalUrl = https://{account}.monday.com/boards/{bid}/pulses/{itemId}`.
  - **Status propagation:** when defect status/severity changes in our UI AND externalRef starts with `monday://`, fire async `change_column_value`.
  - **Testing stance:** user has no Monday access right now — build against monday.com API docs, ship, test later when they have credentials.
- **Deferred within the deferred item:** OAuth flow, Monday → us webhook sync, attachment mirroring, board/column picker UI.
- **Estimate when resumed:** M (~4 h) for tracker abstraction + Monday impl + push button + per-project board provisioning.

### E — Enterprise Readiness (all deferred)

| # | Item | Why parked |
|---|------|------------|
| E1 | Multi-tenant isolation (`tenantId` on all BA_* tables) | No second tenant yet |
| E2 | RBAC (BA/Dev/QA/Manager roles + per-project ACLs) | Single-team tool today |
| E3 | Audit log (`ba_audit_log`) | No compliance requirement yet |
| E4 | SSO (SAML/OIDC via next-auth) | No enterprise customer yet |
| E5 | Rate limiting on AI endpoints (per-user quotas) | Single-user budget risk is low |
| E6 | Observability — OpenTelemetry + Prometheus | Debug-via-logs is fine for now |
| E7 | Backup/restore of attachments storage | Disk backup suffices for dev |
| E8 | GDPR — user data export + delete | No EU users yet |

### C — Codegen beyond Playwright (all deferred)

| # | Item | Why parked |
|---|------|------------|
| C1 | Cypress codegen | Playwright covers MVP |
| C2 | Selenium + Java codegen | Playwright covers MVP |
| C3 | WebdriverIO codegen | Playwright covers MVP |
| C4 | Appium (mobile native) codegen | Mobile out of scope now |
| C5 | RestAssured / Postman collections for API-only TCs | API tests run via Playwright request context for now |
| C6 | k6 / JMeter for performance TCs | Perf TCs exist as docs only, no runnable artifact |
| C7 | Pact contract tests | Not a microservices project yet |

---

## Recently Completed (reverse chronological)

- ✅ 2026-04-24 — **Customer-LLD OpenAPI / Swagger (user-requested, new item — no pre-existing backlog entry)** — new `BaOpenApiExportService` generates OpenAPI 3.0 spec for the customer's target application from LLD pseudo-code (re-using D2's regex-grade endpoint detection plus new class/schema extraction for TS interfaces, Python pydantic, Java DTOs); two granularities: per-LLD module (`GET /api/ba/lld-artifacts/:id/{openapi.json,openapi.yaml,swagger}`) and per-project aggregate (`GET /api/ba/projects/:id/{openapi.json,openapi.yaml,swagger}`) with project-level paths prefixed as `/{moduleId}` to prevent collisions across modules exposing the same route; Swagger UI HTML served via CDN-loaded swagger-ui-dist (no new npm dep); title = `{productName ?? projectName} — {moduleName} API` (module) or `{productName ?? projectName} API` (project); version = `projectCode`; servers = editable placeholder; hand-rolled YAML serialiser avoids js-yaml dep; "View API Spec (Swagger)" button added to LLD Workbench header (module level) + "API Spec" button on project dashboard header (project level); `FINAL-SKILL-06-create-lld.md` updated with rule 12 instructing the AI to emit OpenAPI-friendly annotations (@summary/@param/@returns in JSDoc/PyDoc/JavaDoc) across NestJS/FastAPI/Flask/Spring handlers for richer auto-generated Swagger (`3c07c35`)
- ✅ 2026-04-24 — **UX5: Toast notifications for long-running ops** — fixed pre-existing broken `useToast` (per-component `useState` that never reached the mounted `<Toaster />`); rewrote as module-level singleton with subscribe/emit pattern, returns `{ id, update, dismiss }` from `pushToast()` so flows can show "Exporting…" loading → "Exported" success in one toast; new variants `loading` (spinner, no auto-dismiss, no close) + `success` (emerald bg + checkmark); wired into: LLD workbench (Export Unit Tests, Export Contract Tests), FTC workbench (Export CSV, Export Playwright Suite, Re-verify + Export), FTC artifact view (AC Re-verify, Bulk Run dialog); replaces 6+ `alert()` calls with in-app toasts (`3c4ef7a`)
- ✅ 2026-04-24 — **H1: Input sanitisation audit** — systematic review of every `@Body()` surface; identified that Phase 2a/Sprint endpoints were accepting plain TypeScript interfaces (bypassing the global `ValidationPipe`); shipped 7 new DTO classes with `class-validator` decorators (`CreateTestRunDto`, `BulkCreateTestRunDto` w/ 200-UUID cap, `CreateDefectDto`, `UpdateDefectDto`, `SaveTesterRcaDto`, `CreateSprintDto`, `UpdateSprintDto`); wired into `ba-execution.controller` + `ba-sprint.controller`; reviewed and cleared attachment uploads (30 MB caps + Multer limits + path sanitisation), AI prompt framing, Prisma parameterisation, CORS pinning, SSRF posture; audit doc at `sprints/v4/SECURITY_AUDIT_H1.md` with deferred items flagged (E5 rate limiting, H2 AV scan, H3 secret rotation, H4 pen-test) (`5933c76`)
- ✅ 2026-04-24 — **UX3: Tree search / filter box** — new sticky-top search input in `ArtifactTree`; case-insensitive substring match across skill labels, artifact labels + artifactId, FRD features (id + name), EPIC structural + internal sections, generic section labels/keys, pseudo-file paths + language, and test-case ids/titles/categories; when query is active all skills/artifacts without matches in their subtree are hidden AND matching nodes are auto-expanded so hits are visible without user clicks; live count shown ("3 artifact(s) across 2 skill(s)"); clear-X button resets (`d3be573`)
- ✅ 2026-04-24 — **G3 deferred to future sprint** — moved from P3 Docs to DEFERRED lane with scope locked: `@nestjs/swagger` + `swagger-ui-express`, `@ApiTags`/`@ApiOperation` on 7 controllers, expose at `GET /api/docs` + `/api/docs-json`. Distinct from D2 (which docs the user's target app, not the BA Tool itself) (`d3be573`)
- ✅ 2026-04-24 — **G4: Architecture diagram refresh — Sprint v4 walkthrough** — new `sprints/v4/WALKTHROUGH.md` (333 lines) canonicalising everything shipped in v4: LLD skill (v4 PRD core), FTC skill + AC Coverage + Playwright export, Phase 2a (runs/defects/RCA), B1–B4 Sprint entity (table/picker/burndown/filters), D1/D2 TDD codegen (unit + contract tests), dashboard tiles + global Defect list + header nav; includes full ASCII architecture diagram (browser → backend → Postgres → Python AI), complete schema change list, net-new API surface table, end-to-end happy path data flow (22 steps), test coverage gaps, security posture, known limitations, and v5 roadmap (`f09a680`)
- ✅ 2026-04-24 — **D2: Contract-test scaffold export (TDD codegen)** — new `BaContractTestExportService` walks LLD pseudo-files and detects HTTP provider definitions (Express/Nest `app.get/@Get`, Flask/FastAPI `@app.route/@app.get`, Spring `@GetMapping`) and consumer callsites (`fetch`, `axios`, `httpx`, `requests`), normalises paths (`{id}` → `:id`), and pairs them by `method+path`; generates OpenAPI 3.0 stub (`openapi.yaml`), Jest+supertest provider shape tests, Jest+msw pact-style consumer tests, pytest+httpx provider tests, pytest+respx consumer tests; orphan consumers (no matching provider) emitted to `UNRESOLVED_CONTRACTS.md` since they're the most likely integration-breakage sites; new endpoint `GET /api/ba/lld-artifacts/:id/contract-tests-zip` + "Export Contract Tests" button (Network icon) on LLD Workbench (`86300ef`)
- ✅ 2026-04-24 — **D1: Unit-test scaffold export (TDD codegen)** — new `BaUnitTestExportService` parses LLD pseudo-files via language-aware regex (Python `def`, TS/JS `function`/arrow/class, Java method) and emits runnable ZIPs with per-language subdirectories: `python/` (pytest + requirements.txt + pytest.ini + conftest.py), `javascript/` (Jest + ts-jest + tsconfig + package.json), `java/` (JUnit 5 + Maven pom.xml); every test starts red with explicit `pytest.fail`/`expect(true).toBe(false)`/`fail()` so devs see the exact scaffold turn green as they implement; new endpoint `GET /api/ba/lld-artifacts/:id/unit-tests-zip` + "Export Unit Tests" button (FlaskConical icon) on LLD Workbench header; README in each ZIP lists all generated files + runner commands (`1257b09`)
- ✅ 2026-04-24 — **F3: Playwright export drift badge + Re-verify+Export button** — FTC workbench header now shows the AC coverage summary alongside the export button; amber `!N` badge on "Export Playwright Suite" when gaps exist; new `ShieldCheck`-icon "Re-verify + Export" button chains `analyzeAcCoverage` + `downloadPlaywrightZip` and alerts with fresh coverage numbers when uncovered/partial ACs remain; new API helper `reverifyAndExportPlaywright()` returns the fresh bundle so the UI can update the drift badge in-place (`2efaac6`)
- ✅ 2026-04-24 — **B4: Sprint FK filters in RTM + FTC + Defects** — backend now enriches RTM rows with `sprintDbIds[]` + `sprintCodes[]` aggregated from linked TCs; defect list endpoint selects `sprintDbId` + nested `sprint { sprintCode, name, status }` on both TC and firstSeenRun; all three pages (RTM, FTC artifact view, Defects) get unified sprint filter dropdowns backed by real `BaSprint` rows plus an `optgroup` for orphan legacy free-text codes; canonical FK match preferred, string fallback when TC has no FK (`d0ae1ce`)
- ✅ 2026-04-24 — **B3: Sprint burndown chart on dashboard** — new endpoint `GET /api/ba/sprints/:id/burndown` returning `{ sprint, totalScope, days[], ideal[], totals }`; backend computes first-run-per-TC-in-sprint for accurate burndown semantics (re-runs don't move the needle); inline-SVG `BurndownChart` component (ideal dashed vs actual solid blue, markers with tooltips, responsive viewport); dashboard tile with sprint picker defaulting to most-recent ACTIVE sprint + PASS/FAIL/BLOCKED/SKIPPED/NOT_RUN totals underneath (`b5806b9`)
- ✅ 2026-04-24 — **B2: SprintPicker wired into Record Run + Bulk Run dialogs** — new reusable `SprintPicker` component (status-aware dropdown, hides COMPLETED/CANCELLED by default, deep-link to Sprints mgmt); payload types extended with `sprintDbId`; `BaTestRunService.resolveSprintFields` maps FK → sprintCode and writes both columns atomically (backward-compat safety); TC's own sprint is mirrored from the latest run's sprint so RTM groupings stay consistent (`c546537`)
- ✅ 2026-04-24 — **B1: Real Sprint entity** — new `BaSprint` table (projectId + sprintCode unique, name, goal, startDate, endDate, status=PLANNING/ACTIVE/COMPLETED/CANCELLED); nullable `sprintDbId` FK added to BaTestCase + BaTestRun (legacy string `sprintId` kept for backward compat); full CRUD endpoints at `/ba/projects/:id/sprints` + `/ba/sprints/:id`; new Sprints mgmt page at `/ba-tool/project/[id]/sprints` with create/edit/delete + legacy-string backfill button; "Sprints" nav added to project header (`3165599`)
- ✅ 2026-04-24 — **Global Defect list page** — new route `/ba-tool/project/[id]/defects` with search + 5 filters (status incl. "Open all" shortcut, severity, sprint, module, reporter); header nav pill shows open-defect count (red when P0/P1 critical); CSV export; "direct" badge for run-less defects; new endpoint `GET /api/ba/projects/:id/defects` (`82f2ff9`)
- ✅ 2026-04-24 — **Standalone "Open defect" button** on each TC — logs bugs outside a formal run (spec review, prod report, ad-hoc exploration); new `POST /api/ba/test-cases/:id/defects` endpoint with nullable `firstSeenRunId`; denormalizes defect ref onto `BaTestCase.defectIds` like the run-triggered flow (`ea0ba94`)
- ✅ 2026-04-24 — **Bulk test-run recording** — multi-select checkboxes per TC, per-group "select all", sticky toolbar with "Run selected (N)" button, modal dialog for shared status/executor/env/sprint/notes; new backend endpoint `POST /api/ba/test-cases/bulk-runs` (200-TC cap, continues on individual failures) (`399b9d8`)
- ✅ 2026-04-24 — **Dashboard tile: Test Execution Health** — pass-rate, stacked bar, PASS/FAIL/BLOCKED/SKIPPED/NOT_RUN pills, open-defect count (with P0/P1 callout), failing + blocked TC drill-downs (top 10 each with deep links to module), new endpoint `GET /api/ba/projects/:id/execution-health` (`17ec30d`)
- ✅ 2026-04-24 — **RTM exec verdict column + filter** — per-row PASS/FAIL/BLOCKED/MIXED/NOT_RUN pill reading denormalized `BaTestCase.executionStatus`; new CSV columns (Pass/Fail/Blocked/Skipped/Not Run) (`2e4008c`)
- ✅ 2026-04-24 — Monday integration scope locked + deferred (decision captured in F2 section above)
- ✅ 2026-04-24 — **AI RCA now ingests attachment evidence** (logs, OCR'd screenshots, docs); per-file 2 KB cap, 8 KB total, system prompt updated to cite filenames (`38f054f`)
- ✅ 2026-04-24 — Tabular run history in ExecutionHistoryPanel (`9520d9d`)
- ✅ 2026-04-23 — Phase 2a: execution tracking + defect capture + AI/tester RCA (`a7dd8b0`)
- ✅ 2026-04-23 — AC coverage reads real user-facing ACs, not FRD process DoD (`00e6454`)
- ✅ 2026-04-23 — AC Coverage verifier + runnable Playwright suite export (`1528a73`)
- ✅ 2026-04-23 — FTC structured view + per-category tree sub-nodes (`9e537d2`, `5a51fc4`, `ccb75a1`)
- ✅ 2026-04-23 — Multi-select testing frameworks + test types (`c40e5ef`)
- ✅ 2026-04-23 — SKILL-07-FTC + AI FTC Workbench + OWASP Web/LLM coverage (`9b33d56`)
- ✅ 2026-04-23 — AI LLD Workbench (narrative + pseudo-code editor + RTM trace) (`5ffc7ae`)

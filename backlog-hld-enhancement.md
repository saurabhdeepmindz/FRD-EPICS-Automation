# Backlog — HLD Enhancement ("HLD V2 — Enhanced" / Architect Copilot)

> **Status:** PROPOSED — awaiting wireframe approval. No code written yet.
> **Created:** 2026-06-06 · **Owner:** saurabhdeepmindz
> Once the wireframes are approved we follow the standard flow: PRD → task docs → TDD → code review → commit/push (feature branch off `master`).

---

## 0. Goal & guiding decisions

Turn every HLD section into a self-contained **Architect Copilot** so the user never leaves the tool to research best practices / design on external Claude / Gemini / ChatGPT. Per section: conversational AI (context-injected with PRD/FRD/stack), AI Suggest with **voice**, **edit**, **save** AI answers as section "insights", and **merge/synthesize** those into one coherent section. Plus an **Architecture console** (template picker) that seeds + steers the AI. And full **Edit / Preview / Download (PDF, DOCX, MD)** parity with the PRD.

**Locked decisions (user, 2026-06-06):**
1. **Provider = user-selectable per message** (Claude / OpenAI / Gemini dropdown). Gemini needs a new SDK + `GEMINI_API_KEY` in the ai-service `.env` (absent today) → the dropdown **hides/disables any provider whose key is missing**, so Claude + OpenAI work day one; Gemini lights up when a key is added. **No rework either way.**
2. **Persistence = dedicated Prisma tables** — `BaHldThread` + `BaHldMessage` (full per-section history + audit). One migration, applied as `prd_user`.
3. **Architecture console = reuse existing `BaTemplate` / `BaDesignPreset` now**, behind a `TemplateSource` interface so a later **curated architecture-pattern catalog** plugs in with **no rework** (the catalog itself is deferred — see below).
4. **Streaming = deferred** (MVP shows a "thinking…" spinner → full answer; SSE later).

**Isolation strategy ("don't disturb the existing HLD") + planned cutover:**
New route **`/ba-tool/project/[id]/hld-v2`** ("HLD — Enhanced") rendering the **same `BaHld` record** as the current `/hld` page (single source of truth → no data divergence). The existing `/hld` page and all existing routes stay **untouched** during build; every backend addition is **additive** (new tables, new export controller, new copilot controller).

> **Decision (user, 2026-06-07):** the two-page split is **temporary**. Once HLD-V2 is fully functional and validated, we **retire the legacy `/hld`** — there is no point maintaining two HLDs. The enhanced page becomes *the* HLD. See **Phase F — Cutover** below. Because both pages already share one `BaHld` record, cutover is a UI swap (route + nav), not a data migration.

---

## 1. MUST-HAVE — tracked for this sprint (MVP)

> These are the tasks I will track and implement once the wireframes are approved.
> **Edit / Preview / Download(PDF·DOCX·MD)** are P0 must-haves per explicit request (PRD-parity).

### Track A — Scaffolding & isolation
| ID | Pri | Size | Task |
|----|-----|------|------|
| HE-01 | P0 | M | **`/hld-v2` page** — clone the current HLD layout (left section menu, pastel inline diagrams, project-structure grid) reading the **same `BaHld`**; add nav entry "HLD — Enhanced". Existing `/hld` untouched. |

### Track B — Edit / Preview / Export (PDF · DOCX · MD)  *(PRD-parity, MUST-HAVE)*
| ID | Pri | Size | Task |
|----|-----|------|------|
| HE-02 | P0 | M | **Section EDIT UI** — guided/inline editor (mirror `PrdGuidedEditor`/`PrdSectionEditor`); save via the **existing** `PATCH /ba/projects/:id/hld/:hldId/section/:key` → version bump. |
| HE-03 | P0 | M | **PREVIEW mode** — new `HldPreview` component: canonical read-only render of all 17 sections + pastel diagrams; header view toggle **Edit / Preview / Diagrams** (mirror PRD `setView`). |
| HE-04 | P0 | M | **Shared HTML template** `backend/src/export/templates/hld-html.ts` → `generateHldHtml(sections, mermaidDiagrams)` so Preview, PDF, and DOCX render identically (mirror `prd-html.ts`). |
| HE-05 | P0 | M | **Export routes** (mirror PRD exactly): `GET /hld/:hldId/export/pdf` (Puppeteer via reused `PdfService`), `GET /hld/:hldId/export/docx` (`html-to-docx`), `GET /hld/markdown` (+ new `HldService.getMarkdown()`). New `HldExportController` registered in the pipeline module. |
| HE-06 | P0 | S | **Download menu (FE)** — PDF / DOCX / .md buttons + `pipeline-api` helpers (`getHldMarkdown`, `hldPdfUrl`, `hldDocxUrl`), filename `HLD-<CODE>-<Product>.<ext>`. |

### Track C — Section Copilot (conversational AI + voice + save + merge)
| ID | Pri | Size | Task |
|----|-----|------|------|
| HE-07 | P0 | M | **Prisma** `BaHldThread` (hldId, sectionKey) + `BaHldMessage` (role, model, content, savedToSection, createdAt) + migration (as `prd_user`); regenerate client. |
| HE-08 | P0 | L | **AI `/hld-chat`** endpoint — params: `provider` (openai\|anthropic\|gemini, key-gated), section context + PRD/FRD/stack + thread history + selected template; returns markdown answer + quick-prompt intents. |
| HE-09 | P0 | M | **AI `/hld-merge`** endpoint — current section + saved insights → one coherent section draft (returns structured draft for diff review). |
| HE-10 | P0 | M | **NestJS copilot controller/service** — chat proxy, `save-insight`, `list-thread`, `merge`; wires `AiService` + existing `/transcribe`; provider-availability probe. |
| HE-11 | P0 | L | **Copilot drawer — Chat tab** — per-message **model dropdown**, quick-prompt chips, **voice** (reuse `/transcribe` + `MicButton`), message actions (Save to section / Copy / Regenerate), "thinking…" spinner (no streaming yet). |
| HE-12 | P0 | M | **Saved insights tab + Merge/Synthesize** — list/select/delete insights; "Synthesize" → side-by-side diff → **Apply as new version** (non-destructive, mirrors gap-answer flow). |

### Track D — Architecture console (reuse existing templates)
| ID | Pri | Size | Task |
|----|-----|------|------|
| HE-13 | P1 | M | **Templates tab** behind a `TemplateSource` interface, sourced from existing `BaTemplate`/`BaDesignPreset`; "Use template" seeds section structure + steers chat context. (Interface designed so the deferred curated catalog needs no rework.) |

### Track E — Integration, polish, tests
| ID | Pri | Size | Task |
|----|-----|------|------|
| HE-14 | P1 | S | Freshness/readiness link + nav cross-links (PRD → Map → Design System → HLD-Enhanced); hide providers without a key. |
| HE-15 | P0 | M | Tests + verify — unit (`generateHldHtml`, merge, thread), smoke (edit→save→version, **PDF/DOCX open cleanly**, chat→save→merge→apply), `tsc` clean both apps, Playwright + screenshot. |

---

## 2. DEFERRED — implement after the MVP above is done

> These are the deliberately-deferred items from the decisions you made, plus natural follow-ons. I'll pick these up once the must-haves ship — sequenced so they require **no rework** of the MVP.

| ID | Pri | Size | Task | Why deferred |
|----|-----|------|------|--------------|
| HD-01 | P1 | L | **Streaming chat (SSE)** — token-by-token answers across FastAPI → NestJS → frontend (no streaming plumbing exists today). | Decision #4: deferred; MVP spinner is enough to ship. |
| HD-02 | P1 | L | **Curated architecture-pattern catalog** — dedicated per-section pattern library (multi-tenant, event-driven, RAG layer, CQRS, etc.) implementing the `TemplateSource` interface from HE-13. | Decision #3: reuse first; build curated catalog later, only with no rework. |
| HD-03 | P2 | S | **Gemini provider full enablement** — add Gemini SDK + `GEMINI_API_KEY`; un-gate the dropdown option. | Decision #1: needs a key not present today; dropdown already key-gated so this is drop-in. |
| HD-04 | P2 | M | **Merge-across-sections / forward-propagation** — apply a saved decision/insight to multiple related sections at once (reuse v6 forward-propagation pattern). | Natural follow-on once single-section merge is proven. |
| HD-05 | P2 | M | **Generalize Copilot to other artifacts** (PRD / LLD / E2E flows) — extract the drawer into a shared component. | Prove value on HLD first. |
| HD-06 | P2 | M | **Diagram-edit from chat** — ask AI to modify a section's Mermaid → preview → apply. | Builds on chat + edit being stable. |
| HD-07 | P2 | M | **Grounded research with citations** — optional web grounding (Exa/search) so answers cite sources. | Needs a research tool + cost review. |
| HD-08 | P3 | S | **Voice output (TTS)** — read answers back aloud. | Nice-to-have accessibility add-on. |
| ✅ HD-09 | P1 | M | **Save HLD as template** — DONE (2026-06-07). Save the current HLD (whole doc or one section) as an `ARCHITECTURE` `BaTemplate` (scope GLOBAL/PROJECT) → appears in the Architecture console (Templates tab) for future projects, via the same `TemplateSource`/`HldTemplate` shape. `POST .../hld/:hldId/save-as-template`; "Save this HLD as a template" form in the Templates tab. | Captures proven designs for reuse. |
| HD-10 | P1 | L | **HLD repository + RAG similarity + browse** — every finalized HLD is indexed into a central repository; embed sections/diagrams into a vector store; "Find similar HLDs" (RAG) surfaces related past designs inside the Copilot, plus a standard **browse/search** UI to explore other HLDs (filter by domain/stack/pattern). | High-value knowledge reuse; needs an embeddings provider + vector store — scope after MVP. Feeds the Copilot's research with *your own* prior HLDs. |
| HD-11 | P1 | M | **Copilot reference URLs** — add a URL → server fetches (SSRF-guarded) + extracts readable text + summarizes → included in the chat context for latest-trends grounding. | ✅ DONE (2026-06-07) — `sprints/v11/TASKS.md` (Track RR). Decisions: whole-HLD + optional section tag · summarize-and-inject · References tab. |
| HD-12 | P1 | M | **Copilot reference documents** — upload PDF/DOCX/TXT → extract (reuse `TextExtractionService`) + summarize → included in the chat context to answer in the document's context. | ✅ DONE (2026-06-07) — `sprints/v11/TASKS.md` (Track RR). Shares the References tab + model with HD-11. |
| HD-13 | P2 | L | **RAG upgrade for References (URLs + documents)** — replace v1's summarize-and-inject (HD-11/HD-12) with proper retrieval: **chunk → embed → store → top-k semantic retrieval** of the most relevant passages per query (instead of whole-summary injection). Same `BaHldReference` sources, same References-tab UI contract → **no rework**; references just get indexed on ingest and retrieved at chat time. Converges on the **same vector store as HD-10** (recommended: `pgvector` on the existing Postgres; alt: external store). | DEFERRED by design (user, 2026-06-07): ship summarize-and-inject first, add RAG later. Needs an embeddings provider + vector store. Bigger relevance/accuracy on long sources; pairs with HD-10 (HLD repository) which indexes finalized HLDs into the same store. |

---

## 2b. Phase F — Cutover & retire legacy HLD — ✅ COMPLETE (2026-06-07)

> **Decision (user, 2026-06-07):** once HLD-V2 is fully functional and validated, discard the existing HLD — no point maintaining two. **Done:** the enhanced page was promoted to the canonical `/hld`; the legacy read-only page was retired; `/hld-v2` now permanently redirects to `/hld`; the dashboard shows a single "HLD" entry. No data migration (both always shared the same `BaHld` record). Verified: `/hld` renders the enhanced page (Copilot/Edit/Preview/Export), `/hld-v2` → `/hld`, tsc clean, no console errors.

| ID | Pri | Size | Task | Status |
|----|-----|------|------|--------|
| HF-01 | P1 | S | Validation gate — parity (17 sections, diagrams, edit/preview/export, copilot) on the enhanced page. | ✅ |
| HF-02 | P1 | S | **Promote** enhanced → `/hld` (content moved into `hld/page.tsx`); single "HLD" nav entry. | ✅ |
| HF-03 | P1 | S | **Retire** the legacy read-only page (overwritten by the enhanced implementation) — no data migration. | ✅ |
| HF-04 | P2 | S | `/hld-v2` → `/hld` redirect for old bookmarks; docs cleanup. | ✅ |

---

## 3. Dependencies & risks

- **Gemini key** — MVP ships with Claude + OpenAI; Gemini stays disabled in the dropdown until `GEMINI_API_KEY` is provided. No rework when added (HD-03).
- **Puppeteer/Chrome** — PDF export reuses the existing `PdfService`; Chrome must be installed in the backend (`npx puppeteer browsers install chrome`) — same prerequisite as PRD PDF export.
- **`html-to-docx`** — already a backend dependency (used by PRD DOCX); reused as-is.
- **Migration** — `BaHldThread`/`BaHldMessage` applied as `prd_user` (shadow-DB workaround per existing migration setup).
- **No data divergence** — `/hld-v2` shares the `BaHld` record with `/hld`; only the UI + additive tables differ.

---

## 4. Wireframes

See **`ProjectSourceCode/sprints/v10/wireframes/hld-enhanced-wireframes.html`** (open in a browser) — covers: HLD-Enhanced main, Edit mode, Preview mode, Download menu (PDF/DOCX/MD), and the Copilot drawer (Chat / Saved+Merge / Templates).

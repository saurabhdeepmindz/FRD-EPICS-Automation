# Sprint v10 — Tasks: HLD-V2 "Architect Copilot" + Edit / Preview / Export (Track HE)

## Status: ✅ COMPLETE (2026-06-07) — Tracks A–E shipped & merged (PRs #16 A/B, #17 C, #18 D, #19 E). HLD-V2 enhanced + Architect Copilot live on `/hld-v2`.

> **Phase F cutover DONE (2026-06-07):** enhanced HLD promoted to the canonical `/hld` (content moved into `hld/page.tsx`, title now "High Level Design (HLD)"); legacy read-only page retired; `/hld-v2` permanently redirects to `/hld`; dashboard shows a single "HLD" entry. No data migration (shared `BaHld`). Verified: `/hld` = enhanced (Copilot/Edit/Preview/Export), `/hld-v2` → `/hld`, tsc clean, no console errors.
>
> **UX follow-ups (post-merge):** (1) Copilot markdown rendering + visible Save/Copy + scrollable full saved text (PR #20). (2) Preview made PRD-style — sticky left section menu with click-to-jump anchors, inline per-section architecture diagrams + §17 structure grid, and section text (incl. the merged `aiSynthesis`) rendered as markdown; shared `HldStructureDiagram` + `Markdown` components; browse view also renders markdown.
>
> **Track E done (integration + tests):** nav cross-link `/hld-v2` → PRD+FRD (FreshnessBanner + provider key-gating already in A/C); unit tests — `hld-html.spec.ts` (7) + `hld-templates.spec.ts` (4) → 10 new tests pass; full backend suite 105/107 (the 2 failures are pre-existing in the legacy `prd/prd.service.spec.ts`, untouched by v10). `tsc` clean both apps. Deferred items (HD-01..10 incl. save-as-template + HLD repository/RAG, Phase F cutover) remain in `backlog-hld-enhancement.md`.

> **Track A + B done:** `/hld-v2` page (same `BaHld`, view toggle Diagrams/Edit/Preview, nav entry), section Edit (existing PATCH), Preview (`HldPreview`), shared `generateHldHtml()`, export routes PDF (Puppeteer)+DOCX (html-to-docx)+MD, download menu. Verified: PDF `%PDF-1.4` 261KB, DOCX `PK` OOXML 109KB, MD 200; Playwright smoke green (toggle/preview/edit/download), `tsc` clean both apps. Note: section edits save in place + mark reviewed (consistent with PRD edit — no per-edit version clone).
>
> **Track D done (Architecture console):** `TemplateSource` (`hld-templates.ts`) = 6 built-in starter patterns (RLS multi-tenant, schema-per-tenant, event-driven, layered 3-tier, RAG/AI, CQRS+ES) + existing `BaTemplate` rows (GLOBAL/project) behind one `HldTemplate` shape; `GET .../hld/copilot/templates`; Copilot **Templates tab** ("Use as context" steers chat via the `template` param + a chip; "Draft section" sends a templated chat). Curated catalog (HD-02) + save-as-template (HD-09) implement the same interface — no rework. Verified: 6 patterns served + tab renders + chip set; tsc clean.
>
> **Track C done (Architect Copilot):** `BaHldThread`/`BaHldMessage` (+ migration applied as `prd_user`); ai-service `/providers` + `/hld-chat` + `/hld-merge` (provider-selectable openai/anthropic/gemini, key-gated; `GEMINI_API_KEY` config) with PRD/FRD/stack context injection; NestJS `HldCopilotController`/`Service`; FE `HldCopilot` drawer (Chat + Saved tabs, per-message model dropdown, voice via `MicButton`, quick-prompts, Save-to-section, Synthesize→diff→Apply as non-destructive `aiSynthesis` field). Verified end-to-end with Claude: chat grounded in "Luggage Room" project, save-insight, merge draft; Playwright drawer smoke green (providers key-gated, thread loads, no console errors); `tsc` clean both apps.

> **Backlog traceability:** full backlog (must-have + deferred + Phase F cutover) in `backlog-hld-enhancement.md` (repo root). Wireframes: `sprints/v10/wireframes/hld-enhanced-wireframes.html` (approved 2026-06-07). PRD: `sprints/v10/PRD.md`.
>
> **Isolation:** all work lands on a NEW `/hld-v2` page sharing the existing `BaHld` record; the legacy `/hld` page + routes stay untouched. Backend additions are additive (new tables, new controllers). Legacy retirement = Phase F (post-MVP, in backlog).
>
> **Sequencing:** HE-01 (scaffold) → HE-04→HE-06 (export/preview, PRD-parity, mostly independent) ∥ HE-02→HE-03 (edit/preview UI) → HE-07 (schema) → HE-08/HE-09 (AI endpoints) → HE-10 (NestJS copilot) → HE-11→HE-12 (Copilot UI + merge) → HE-13 (templates) → HE-14 (integration) → HE-15 (tests). A shared `generateHldHtml()` built in HE-04 is reused by Preview (HE-03), PDF + DOCX (HE-05).
>
> **Decisions (user):** ① model selectable per message (Claude/OpenAI/Gemini, key-gated) ② dedicated `BaHldThread`/`BaHldMessage` ③ reuse existing templates behind `TemplateSource` ④ streaming deferred ⑤ shared `BaHld`, legacy untouched ⑥ retire legacy after V2 stable ⑦ Edit/Preview/Export = must-have PRD parity.

---

### Track A — Scaffolding & isolation

- [ ] **HE-01 (FE): `/hld-v2` page scaffold** (P0)
  - New `app/ba-tool/project/[id]/hld-v2/page.tsx` cloning the current HLD layout (left 17-section menu + Diagrams entry, pastel inline diagrams, project-structure grid) reading the **same `BaHld`** via existing `getHld`. Add a project-nav entry "HLD — Enhanced" alongside "HLD". Existing `/hld` untouched. Header view toggle scaffold: **Diagrams | Edit | Preview**.

### Track B — Edit / Preview / Export (PDF · DOCX · MD) — MUST-HAVE, PRD parity

- [ ] **HE-02 (FE): Section Edit UI** (P0)
  - Guided/inline section editor (port `PrdGuidedEditor`/`PrdSectionEditor` pattern) for the active section; **Save** calls the **existing** `PATCH /ba/projects/:id/hld/:hldId/section/:key` (no new backend) → version bump; Cancel reverts. Wire `updateHldSection()` helper in `pipeline-api.ts` if missing.
- [ ] **HE-03 (FE): Preview mode** (P0)
  - New `components/ba-tool/HldPreview.tsx`: canonical read-only render of all 17 sections + pastel diagrams (AI-prefix styling like PRD). Header toggle `view: 'diagrams'|'edit'|'preview'`.
- [ ] **HE-04 (BE): Shared HTML export template** (P0)
  - `backend/src/export/templates/hld-html.ts` → `generateHldHtml(sections, mermaidDiagrams, meta)` (mirror `prd-html.ts`): 17 sections + embedded diagrams; valid for both Puppeteer and `html-to-docx`. Reused by Preview parity, PDF, DOCX.
- [ ] **HE-05 (BE): Export routes (PDF/DOCX/MD)** (P0)
  - New `HldExportController`: `GET /ba/projects/:id/hld/:hldId/export/pdf` (reuse `PdfService.generatePdfFromHtml`), `GET .../export/docx` (`html-to-docx` with full `margins` object), `GET /ba/projects/:id/hld/markdown` (+ new `HldService.getMarkdown()`). Content-Disposition `HLD-<CODE>-<Product>.<ext>`. Register controller in pipeline module.
- [ ] **HE-06 (FE): Download menu** (P0)
  - Header `⬇ Download ▾` → PDF / DOCX / .md. Helpers in `pipeline-api.ts`: `getHldMarkdown()`, `hldPdfUrl()`, `hldDocxUrl()` (blob download for md like PRD; direct link for pdf/docx).

### Track C — Section Copilot (conversational AI + voice + save + merge)

- [ ] **HE-07 (DB): `BaHldThread` + `BaHldMessage` + migration** (P0)
  - Models per PRD (thread unique on `[hldId, sectionKey]`; message role/model/content/savedToSection/templateRef, cascade-delete). Hand-written SQL migration applied as `prd_user`; regenerate Prisma client.
- [ ] **HE-08 (AI): `/hld-chat` endpoint** (P0)
  - FastAPI `/hld-chat` + `prompts/hld_chat_prompts.py`. Params: `provider` (openai|anthropic|gemini, key-gated), `sectionKey`, `sectionContent`, `prdContext`, `stack`, `history[]`, `template?`. Returns `{ markdown, intents[] }`. Context-injected system prompt forbids generic boilerplate. Provider routing mirrors `HIFI_PROVIDER` pattern; gemini stub returns "key not configured" until HD-03.
- [ ] **HE-09 (AI): `/hld-merge` endpoint** (P0)
  - FastAPI `/hld-merge` + prompt: `{ sectionContent, insights[] }` → coherent merged section draft (structured for diff review). Preserves existing content; integrates insights without duplication.
- [ ] **HE-10 (BE): NestJS Copilot controller/service** (P0)
  - `HldCopilotController` + `HldCopilotService`: `POST .../copilot/chat` (persist user+assistant msgs, proxy `/hld-chat`), `POST .../copilot/save-insight` (flag a message savedToSection), `GET .../copilot/thread?section=` (list), `POST .../section/:key/merge` (proxy `/hld-merge`, return draft — NO write). Wires `AiService` + existing `transcribe`. Provider-availability probe endpoint.
- [ ] **HE-11 (FE): Copilot drawer — Chat tab** (P0)
  - Collapsible right drawer. Chat tab: per-message **model dropdown** (key-gated options), quick-prompt chips (Best practices / Trade-offs / Security / Ref architecture / Pitfalls), **voice** input (reuse `MicButton` + `/transcribe`), message bubbles with actions **Save to section / Copy / Regenerate**, "thinking…" spinner (no streaming). `pipeline-api` helpers: `hldCopilotChat`, `hldTranscribe` (reuse), `listProviders`.
- [ ] **HE-12 (FE): Saved insights tab + Synthesize/Merge** (P0)
  - Saved tab lists insight messages (select/delete). "🧩 Synthesize merged section" → calls merge → **side-by-side diff** (current vs draft) → **Apply as new version** (calls existing `updateSection` PATCH). Non-destructive; mirrors gap-answer apply flow.

### Track D — Architecture console (reuse existing templates)

- [ ] **HE-13 (FE+BE): Templates tab via `TemplateSource`** (P1)
  - `TemplateSource` interface (list/get/preview) implemented over existing `BaTemplate`/`BaDesignPreset` (`listDesignPresets`/`getDesignPresetTokens`). Templates tab: grid + filter + Preview + **Use** (seeds section structure + passes `template` to `/hld-chat`). Interface shaped so curated catalog (HD-02) + save-as-template (HD-09) need no rework.

### Track E — Integration, polish, tests

- [ ] **HE-14 (BE+FE): Freshness/readiness + nav + provider gating** (P1)
  - Optional freshness link (PRD/FRD change ⇒ HLD stale) surfaced on `/hld-v2`; project-nav cross-links; hide/disable providers lacking a key (probe from HE-10).
- [ ] **HE-15 (Test): Unit + smoke + verify** (P0)
  - Unit: `generateHldHtml` (sections→HTML), merge draft shaping, thread/message persistence. Smoke: edit→save→version; **PDF + DOCX open cleanly**; markdown download; chat→save-insight→synthesize→apply. Backend + frontend `tsc` clean; Playwright walk + screenshot of `/hld-v2`.

---

## Task table

| # | Track | ID | Pri | Size | Summary |
|---|-------|----|----|------|---------|
| 1 | Scaffold | HE-01 | P0 | M | `/hld-v2` page cloning layout, same `BaHld`, nav entry, view toggle |
| 2 | Edit | HE-02 | P0 | M | Section edit UI → existing PATCH → version bump |
| 3 | Preview | HE-03 | P0 | M | `HldPreview` canonical read-only view + toggle |
| 4 | Export | HE-04 | P0 | M | Shared `hld-html.ts` template (Preview = PDF = DOCX) |
| 5 | Export | HE-05 | P0 | M | Export routes PDF (Puppeteer) + DOCX (html-to-docx) + MD |
| 6 | Export | HE-06 | P0 | S | Download menu + api helpers |
| 7 | Copilot DB | HE-07 | P0 | M | `BaHldThread` + `BaHldMessage` + migration |
| 8 | Copilot AI | HE-08 | P0 | L | `/hld-chat` (provider-selectable, key-gated, context-injected) |
| 9 | Copilot AI | HE-09 | P0 | M | `/hld-merge` (section + insights → coherent draft) |
| 10 | Copilot BE | HE-10 | P0 | M | NestJS copilot controller/service (chat/save/list/merge/probe) |
| 11 | Copilot FE | HE-11 | P0 | L | Chat tab (model dropdown, quick-prompts, voice, msg actions) |
| 12 | Copilot FE | HE-12 | P0 | M | Saved insights + Synthesize → diff → Apply |
| 13 | Templates | HE-13 | P1 | M | Templates tab over `TemplateSource` (reuse presets) |
| 14 | Integration | HE-14 | P1 | S | Freshness + nav + provider gating |
| 15 | Tests | HE-15 | P0 | M | Unit + smoke (PDF/DOCX open) + Playwright + tsc |

---

## Deferred (tracked in `backlog-hld-enhancement.md`)

HD-01 streaming (SSE) · HD-02 curated architecture-pattern catalog · HD-03 Gemini key enablement · HD-04 merge-across-sections · HD-05 generalize Copilot to PRD/LLD/E2E · HD-06 diagram-edit-from-chat · HD-07 grounded citations · HD-08 voice output (TTS) · HD-09 **save HLD as template** · HD-10 **HLD repository + RAG similarity + browse**.

## Phase F — Cutover (post-MVP, in backlog)

HF-01 parity validation · HF-02 promote `/hld-v2` → `/hld` · HF-03 retire legacy page · HF-04 redirects + docs cleanup.

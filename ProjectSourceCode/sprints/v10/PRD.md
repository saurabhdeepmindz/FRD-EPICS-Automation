# Sprint v10 — PRD: HLD-V2 "Architect Copilot" + Edit / Preview / Export (Tracks HE)

## Overview

Sprint v10 turns the HLD from a **read-only generated artifact** into an **interactive, AI-assisted authoring surface** — the **"Architect Copilot"** — so an architect never has to leave the tool to research best practices / design patterns on external Claude, Gemini, or ChatGPT.

The current HLD page (`/ba-tool/project/[id]/hld`) renders 17 sections + pastel Mermaid diagrams (v9) but is **read-only**: no edit, no preview, no PDF/DOCX export, and no AI assistance per section. v10 delivers all of that as a **new enhanced page (`/hld-v2`, "HLD — Enhanced")** that reads the **same `BaHld` record** as the existing page — so the legacy page is untouched during the build, and there is **no data divergence**. Once HLD-V2 is fully functional, the legacy `/hld` is **retired** (Phase F cutover — there is no point maintaining two HLDs).

Per HLD section the Copilot provides: **conversational AI** (context-injected with the project's PRD/FRD/stack + the section + thread history + a chosen template), **AI Suggest with voice** (speak the request), **edit** the section, **save** useful AI answers as section "insights", and **synthesize/merge** those saved insights into one coherent section draft (non-destructive → reviewed as a diff → applied as a new version). An **Architecture console** (template picker) seeds a section's structure and steers the AI; it reuses the existing template/preset library now, behind a `TemplateSource` interface so a future curated architecture-pattern catalog plugs in with no rework.

Alongside the Copilot, v10 brings the HLD to **full parity with the PRD** for **Edit · Preview · Download (PDF / DOCX / Markdown)** — mirroring the PRD's existing implementation (Puppeteer for PDF, `html-to-docx` for DOCX, a shared HTML template, the guided editor, and the canonical preview).

**Reuse posture (~70% exists):** voice via the existing `/transcribe` endpoint + `MicButton`; per-section AI via the `/suggest` / `/ba/refine-section` patterns; the gap-answer "card loop" UX from `PrdGapPanel`; per-section persistence via `BaHld.sections` + `updateSection()` + `version`; the template library via `BaTemplate` / `BaDesignPreset`; and the entire export stack (`PdfService`, `html-to-docx`, the `prd-html.ts` template pattern). The genuinely new pieces are the **conversational `/hld-chat` + `/hld-merge` endpoints**, the **`BaHldThread` + `BaHldMessage`** persistence, the **Copilot drawer UI**, the **editable HLD page**, and the **HLD HTML export template**.

## Goals

- An architect can hold a **per-section AI conversation** for best practices / trade-offs / reference architectures, with the project's PRD/FRD/stack auto-injected as context — no copy-paste, no external chat tool.
- The chat model is **selectable per message** (Claude / OpenAI / Gemini); providers without a configured key are hidden/disabled (Claude + OpenAI work day one; Gemini lights up when `GEMINI_API_KEY` is added). **No rework** when a provider is added.
- The architect can **dictate** requests by voice (reusing the existing transcription endpoint).
- Useful AI answers can be **saved into the section** as insights; **Synthesize/Merge** fuses the current section + saved insights into a coherent draft, reviewed as a **side-by-side diff** and **applied as a new version** (non-destructive).
- An **Architecture console** lets the architect pick a relevant **template** that seeds the section and steers the AI; sourced from the existing template/preset library behind a `TemplateSource` interface.
- The HLD reaches **full PRD parity**: **Edit** (guided section editor), **Preview** (canonical read-only render), and **Download** as **PDF, DOCX, and Markdown** — all from a shared HTML template so the three outputs match.
- All of the above ships on a **new `/hld-v2` page sharing the existing `BaHld` record**; the legacy `/hld` page stays untouched until the **Phase F cutover** retires it.
- Conversations + insights are **persisted** (dedicated `BaHldThread` / `BaHldMessage` tables) so research history survives reloads and is auditable.

## User Stories

- As an architect, I want to ask "what's the best multi-tenant isolation strategy for our Postgres stack?" right inside the Multi-Tenancy section and get an answer that already knows our PRD and tech stack — so I don't re-explain context to an external chatbot.
- As an architect, I want to pick which model answers each question (Claude / OpenAI / Gemini), so I can use the best model per task.
- As an architect, I want to speak my question instead of typing it, so I can think out loud.
- As an architect, I want to save the good parts of an AI answer into the section and later merge everything into one clean section draft — reviewing the change before it's applied — so my HLD improves without losing my existing content.
- As an architect, I want to start a section from a proven template (e.g. "event-driven backbone") and have the AI keep its answers aligned to that pattern.
- As an architect, I want to **edit** any HLD section, **preview** the whole document, and **download it as PDF / DOCX / Markdown** — exactly like the PRD — so I can share a polished deliverable.
- As the product owner, once the enhanced HLD is proven I want to **retire the old HLD page**, so we maintain only one.

## Technical Architecture

### Surface — v10

```
+------------------------------------------------------------------+
|  Browser (Next.js) — /ba-tool/project/[id]/hld-v2  (NEW PAGE)     |
|  reads the SAME BaHld record as /hld (legacy untouched)          |
|                                                                   |
|  Header:  view toggle [ Diagrams | Edit | Preview ]              |
|           [ ↻ Regenerate ]   [ ⬇ Download ▾ PDF/DOCX/MD ]        |
|           [ ⟨ Copilot ]                                          |
|  Left:    17-section menu (+ Diagrams)        (reused from /hld)  |
|  Center:  section panel — pastel inline diagram + content        |
|             · Diagrams view (read)                               |
|             · Edit view (guided section editor → save = version) |
|             · Preview view (canonical read-only, all sections)   |
|  Right:   Architect Copilot drawer (collapsible)                |
|             · Chat  (per-message model dropdown, quick-prompts,  |
|                      🎤 voice, msg actions Save/Copy/Regen)      |
|             · Saved insights  (select → Synthesize → diff → Apply)|
|             · Templates  (Architecture console)                  |
+----------------------------+-+------------------------------------+
                              | HTTP
                              v
+------------------------------------------------------------------+
|  NestJS — ba-tool/pipeline (new + extended)                       |
|   HldExportController (NEW): /hld/:hldId/export/pdf · /export/docx|
|     · /hld/markdown   (reuses PdfService + html-to-docx)          |
|   HldCopilotController/Service (NEW): /hld/:hldId/copilot/chat ·  |
|     save-insight · list-thread · /section/:key/merge             |
|   HldService (EXTENDED): getMarkdown(); updateSection() (exists)  |
|   PipelineModule: register new controllers                       |
+----------------------------+-+------------------------------------+
                              | HTTP
                              v
+------------------------------------------------------------------+
|  Python AI Service (new endpoints)                                |
|   /hld-chat  : conversational answer for one section; params      |
|     { provider, sectionKey, sectionContent, prdContext,          |
|       stack, history[], template? } → { markdown, intents[] }    |
|     provider ∈ openai | anthropic | gemini (key-gated)           |
|   /hld-merge : { sectionContent, insights[] } → merged draft     |
|   /transcribe (REUSE) : voice → text                             |
+------------------------------------------------------------------+
```

### Data flow — research → save → merge → version

```
HLD section (BaHld.sections[key])
  + Copilot chat (BaHldThread / BaHldMessage)  ← model selectable per message
      ↳ ask (text or 🎤 voice via /transcribe) → /hld-chat (provider, full context) → markdown answer
      ↳ "Save to section" → BaHldMessage.savedToSection = true (insight)
  + Saved insights (the saved messages)
      ↳ "Synthesize" → /hld-merge (current section + insights) → coherent draft
        → side-by-side diff → Apply → updateSection() → version++   (non-destructive)
  Export (any time): sections + diagrams → generateHldHtml() → { Preview | PDF (Puppeteer) | DOCX (html-to-docx) | MD }
```

### Schema changes (Prisma — additive)

```prisma
// NEW — one conversation thread per (HLD, section)
model BaHldThread {
  id         String          @id @default(uuid())
  hldId      String
  sectionKey String
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt
  messages   BaHldMessage[]
  @@unique([hldId, sectionKey])
}

// NEW — each chat turn (and saved insights are messages flagged savedToSection)
model BaHldMessage {
  id              String      @id @default(uuid())
  threadId        String
  thread          BaHldThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  role            String      // "user" | "assistant"
  model           String?     // provider/model that produced an assistant msg (e.g. "claude-sonnet-4-6")
  content         String      @db.Text
  savedToSection  Boolean     @default(false)  // true = a saved "insight"
  templateRef     String?     // template id steering this turn, if any
  createdAt       DateTime    @default(now())
}
```

> Migrations applied **as `prd_user`** (project DB convention; shadow-DB workaround). All additive — the legacy `/hld` and `BaHld` are untouched.

### Export (PRD parity — reuse)

- **Shared template** `backend/src/export/templates/hld-html.ts` → `generateHldHtml(sections, mermaidDiagrams, meta)` (mirrors `prd-html.ts`); the **same HTML** feeds Preview, PDF, and DOCX so all three match.
- **PDF** via the existing generic `PdfService.generatePdfFromHtml()` (Puppeteer; renders Mermaid before printing).
- **DOCX** via the existing `html-to-docx` dependency (margins object must include `header`/`footer`/`gutter` keys or Word refuses to open — known from PRD).
- **Markdown** via a new `HldService.getMarkdown()` (mirrors `getProjectPrdMarkdown`).

### Provider selection (key-gated)

- AI `/hld-chat` takes a `provider` param: `openai` | `anthropic` | `gemini`. The frontend model dropdown calls a provider-availability probe and **hides/disables** any provider whose key is absent. MVP ships Claude (anthropic) + OpenAI; Gemini is drop-in once `GEMINI_API_KEY` is set (deferred HD-03).

### Architecture console (`TemplateSource` interface)

- The Templates tab reads templates via a `TemplateSource` abstraction, implemented now over the existing `BaTemplate` / `BaDesignPreset` library. The deferred **curated architecture-pattern catalog** (HD-02) and **"save HLD as template"** (HD-09) implement the same interface — no UI rework.

## Key decisions (confirmed with user, 2026-06-06 / 07)

| # | Decision | Chosen |
|---|---|---|
| 1 | Chat model provider | **User-selectable per message** (Claude / OpenAI / Gemini); providers without a key hidden/disabled |
| 2 | Conversation persistence | **Dedicated Prisma tables** — `BaHldThread` + `BaHldMessage` |
| 3 | Architecture console templates | **Reuse existing** `BaTemplate`/`BaDesignPreset` now, behind a `TemplateSource` interface; curated catalog later (no rework) |
| 4 | Streaming chat | **Deferred** — MVP shows a "thinking…" spinner → full answer; SSE later |
| 5 | Isolation | **New `/hld-v2` page sharing the same `BaHld` record**; legacy `/hld` untouched during build |
| 6 | Two-HLD split | **Temporary** — retire legacy `/hld` after HLD-V2 is fully functional (Phase F cutover; UI swap, no data migration) |
| 7 | Edit / Preview / Export | **Must-have, full PRD parity** — PDF (Puppeteer) + DOCX (html-to-docx) + MD, shared HTML template |
| 8 | Wireframes | **Approved 2026-06-07** (`sprints/v10/wireframes/hld-enhanced-wireframes.html`) |

## Out of Scope (deferred — see backlog-hld-enhancement.md)

- **Streaming (SSE)** chat responses (HD-01).
- **Curated architecture-pattern catalog** (HD-02) — MVP reuses existing templates.
- **Gemini** full enablement (HD-03) — MVP key-gates it off.
- **Merge-across-sections / forward-propagation** (HD-04).
- **Generalizing the Copilot** to PRD / LLD / E2E (HD-05).
- **Diagram-edit-from-chat** (HD-06), **grounded citations** (HD-07), **voice output / TTS** (HD-08).
- **Save HLD as template** (HD-09) and **HLD repository + RAG similarity + browse** (HD-10).
- **Phase F cutover** (HF-01..04) — executed after the MVP is validated.

## Dependencies

- ✅ **HLD generation (v8/v9)** — `BaHld` (sections, mermaidDiagrams, metadata, version) + `HldService` + pastel diagrams (v9 KK/MM).
- ✅ **`updateSection(hldId, key, content)`** + `PATCH /ba/projects/:id/hld/:hldId/section/:key` — already exist (edit persistence).
- ✅ **Voice** — `/transcribe` AI endpoint + `AiService.transcribe()` + `MicButton` component.
- ✅ **AI plumbing** — `AiService` (axios proxy to FastAPI); `/suggest`, `/ba/refine-section`, `/gap-check` patterns to mirror.
- ✅ **Export stack** — `PdfService.generatePdfFromHtml()`, `html-to-docx`, `prd-html.ts` template pattern, export controller conventions.
- ✅ **Template library** — `BaTemplate` / `BaDesignPreset` + `listDesignPresets()` (the Architecture console source).
- ✅ **Interactive UX** — `PrdGapPanel` / `PrdGuidedEditor` / `PrdSectionEditor` / `PrdPreview` patterns to port.
- ⚠️ **Gemini key** — required only for the Gemini option (deferred); MVP key-gates it.
- ⚠️ **Chrome for Puppeteer** — `npx puppeteer browsers install chrome` in the backend (same as PRD PDF).

## Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Copilot answers lack project context (generic, like a public chatbot) | High | `/hld-chat` injects the section + PRD/FRD excerpts + tech stack + thread history + chosen template every turn; prompt forbids generic boilerplate |
| Merge overwrites/destroys an architect's existing section content | High | Merge is **non-destructive**: produces a *draft*, shown as a side-by-side diff; only an explicit **Apply** writes a new version (mirrors gap-answer flow) |
| Preview ≠ PDF ≠ DOCX (rendering drift) | Med | All three render from the **single** `generateHldHtml()`; one template, three outputs |
| DOCX won't open in Word | Med | Reuse the PRD's known-good `html-to-docx` config incl. full `margins` object (header/footer/gutter) |
| Provider dropdown offers a model with no key → runtime 500 | Med | Provider-availability probe hides/disables unkeyed providers; backend validates `provider` and returns a clear error |
| Data divergence between `/hld` and `/hld-v2` | Med | Both read the **same `BaHld` record**; no copy. Cutover is a UI swap |
| Conversation tables grow unbounded | Low | Threads scoped per (hld, section); messages paginated; insights are a flagged subset; cascade-delete on thread |
| No streaming → chat feels slow on long answers | Low | "thinking…" spinner + optimistic UI for MVP; SSE is the first deferred item (HD-01) |
| Cutover breaks bookmarks to `/hld-v2` | Low | HF-04 adds redirects `/hld-v2` → `/hld` |

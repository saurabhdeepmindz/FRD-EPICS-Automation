# Sprint v11 — Tasks: HLD Copilot References (URLs + Documents) — Track RR

## Status: 🟡 PLANNED (2026-06-07) — approved; not started.

> **PRD:** `sprints/v11/PRD.md`. **Decisions:** ① whole-HLD + optional per-section tag ② summarize-and-inject (no vector store; HD-10 is the RAG upgrade) ③ References tab in the Copilot ④ save-as-template always creates a new template (HD-09, reconfirmed).
>
> **Sequencing:** RR-01 (model) → RR-02 (summarize endpoint) → RR-03 (URL ingest) ∥ RR-04 (doc ingest) → RR-05 (refs controller/service) → RR-06 (inject into chat) → RR-07 (api helpers) → RR-08 (References tab) ∥ RR-09 (context chip) → RR-10 (SSRF hardening) → RR-11 (tests).
>
> **Reuse:** `TextExtractionService` (PDF/DOCX/image), `/hld-chat` context-injection + provider routing, the Copilot drawer/tabs.

---

### Track A — Data model + ingestion (backend)

- [ ] **RR-01 (DB): `BaHldReference` model + migration** (P0)
  - Fields: `id`, `hldId`, `sectionKey String?` (null = whole-HLD), `type` ("URL"|"DOCUMENT"), `title`, `sourceUrl String?`, `fileName String?`, `mimeType String?`, `extractedText @db.Text`, `summary @db.Text?`, `status` ("PENDING"|"READY"|"FAILED"), `error String?`, `includeInContext Boolean @default(true)`, `createdAt`. Index `[hldId]`. Hand-written SQL migration applied as `prd_user`; `prisma generate`. (Name/table verified collision-free: `ba_hld_references`.)

- [ ] **RR-02 (AI): `/summarize-reference` endpoint** (P0)
  - FastAPI endpoint + prompt: given extracted text (+ optional focus = section name), return a concise summary + key bullet points (Markdown). Provider-routed via the existing copilot routing (anthropic/openai, key-gated). Token-cap the input.

- [ ] **RR-03 (BE): URL ingestion (SSRF-guarded)** (P0)
  - Fetch the URL server-side: **http(s) only**, resolve DNS and **reject loopback/private/link-local/cloud-metadata IPs**, cap response size + timeout, limit redirects (and re-validate redirect targets). Extract main readable text (pick `@mozilla/readability`+`jsdom` or `node-html-parser` during this task). Call `/summarize-reference`. Persist a `READY`/`FAILED` reference with a clear error on failure.

- [ ] **RR-04 (BE): Document ingestion** (P0)
  - Multipart upload → `TextExtractionService.extract(buffer, mimeType, fileName)` (PDF/DOCX/TXT/image). Summarize via `/summarize-reference`. Persist reference. Reject unsupported types with a clear message; honour the extractor's partial-note.

- [ ] **RR-05 (BE): References controller + service** (P0)
  - `ReferencesService` + routes under the HLD namespace: `POST .../hld/:hldId/references/url`, `POST .../hld/:hldId/references/document` (multipart), `GET .../hld/:hldId/references?section=` (whole-HLD + that section), `PATCH .../references/:refId/include`, `DELETE .../references/:refId`.

- [ ] **RR-06 (BE): Inject references into `/hld-chat` context** (P0)
  - Extend `HldCopilotService.chat` to gather **included** references for (whole-HLD + current section), budget their summaries (+ one key excerpt) within a token cap, and pass them to `/hld-chat` as a `references` context block. Prompt updated so answers use + attribute them.

### Track B — Frontend

- [ ] **RR-07 (FE): `pipeline-api` helpers + types** (P0)
  - `addHldReferenceUrl`, `uploadHldReferenceDocument`, `listHldReferences`, `setReferenceInclude`, `deleteHldReference` + `HldReference` type.

- [ ] **RR-08 (FE): References tab in the Copilot** (P0)
  - New tab: **+ Add URL** (input) and **+ Upload document**; list with status (fetching/ready/failed), include checkbox, summary preview (expand/modal), optional section-tag badge, remove. Polls/refreshes until ingest is READY.

- [ ] **RR-09 (FE): "references in context" chip** (P1)
  - Show a chip in the chat composer (e.g. "📎 N references in context") so the user knows included references are grounding the answer; click → jump to References tab.

### Track C — Security, integration, tests

- [ ] **RR-10 (Sec): SSRF hardening + caps** (P0)
  - Centralize the URL allow/deny logic; unit-test that loopback/private/link-local/metadata hosts and non-http(s) schemes are rejected, and size/timeout caps hold.

- [ ] **RR-11 (Test): unit + smoke + verify** (P0)
  - Unit: SSRF guard, summary prompt builder, context-injection budgeting, reference list scoping (whole-HLD + section). Smoke: add URL → READY → query grounded in it; upload doc → READY → query grounded. `tsc` clean both apps; Playwright (tab, add, include, chat uses context); no console errors.

---

## Task table

| # | Track | ID | Pri | Size | Summary |
|---|-------|----|----|------|---------|
| 1 | Model | RR-01 | P0 | M | `BaHldReference` + migration |
| 2 | AI | RR-02 | P0 | S | `/summarize-reference` endpoint + prompt |
| 3 | Ingest | RR-03 | P0 | L | URL fetch (SSRF-guarded) + readable-text extract + summarize |
| 4 | Ingest | RR-04 | P0 | M | Document upload → extract (reuse) → summarize |
| 5 | BE | RR-05 | P0 | M | References controller/service (url/doc/list/include/delete) |
| 6 | BE | RR-06 | P0 | M | Inject included references into `/hld-chat` context |
| 7 | FE | RR-07 | P0 | S | `pipeline-api` helpers + types |
| 8 | FE | RR-08 | P0 | L | References tab (add URL / upload / list / include / remove) |
| 9 | FE | RR-09 | P1 | S | "N references in context" chip |
| 10 | Sec | RR-10 | P0 | S | SSRF allow/deny + caps (unit-tested) |
| 11 | Test | RR-11 | P0 | M | unit + smoke + Playwright + tsc |

---

## Backlog linkage

Supersedes the placeholder ideas; tracked here as **HD-11 (reference URLs)** + **HD-12 (reference documents)** in `backlog-hld-enhancement.md`. Deep semantic retrieval over these sources is the deferred **HD-13 (RAG upgrade for References)** — chunk → embed → top-k, sharing the same vector store as **HD-10** (HLD repository). v1 here is summarize-and-inject; HD-13 swaps in retrieval with **no UI-contract change**.

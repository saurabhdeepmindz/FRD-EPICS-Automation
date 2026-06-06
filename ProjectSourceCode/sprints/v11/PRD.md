# Sprint v11 — PRD: HLD Copilot References (URLs + Documents) — Track RR

## Status: 🟡 PLANNED (2026-06-07) — tasks approved; implementation not started.

## Overview

Adds a **References** capability to the HLD Architect Copilot so an architect can ground answers in **their own external sources** — a **reference URL** (to pull in the latest trends/best practices from a web page) or an **uploaded document** (PDF/DOCX/TXT, e.g. a security standard or vendor spec) — without leaving the tool.

When a source is added it is **ingested** (URL fetched + main text extracted, or document text extracted), **summarized** by the LLM, and stored. Included references are **injected into the `/hld-chat` context** so the Copilot's answers use them. References live in a new **"References" tab** in the Copilot drawer.

This is the ad-hoc, per-HLD complement to the deferred **HD-10** (cross-project HLD repository + vector RAG): References v1 uses **summarize-and-inject** (no vector store); the same sources can later feed HD-10's vector store for deep retrieval — no rework of the UI contract.

## Decisions (user, 2026-06-07)

| # | Decision | Chosen |
|---|---|---|
| 1 | Scope | **Whole-HLD by default, with optional per-section tag** |
| 2 | Ingestion depth (v1) | **Summarize & inject** (fetch/extract → AI summary → inject summary + key excerpt). No vector store; upgrade path = HD-10. |
| 3 | Surface | **New "References" tab** in the Copilot (consistent with Chat/Saved/Templates) |
| 4 | Save-as-template behaviour (reconfirmed) | Each save creates a **new** template (never overwrites) — see HD-09 |

## Goals

- Add a **reference URL** → server fetches the page (SSRF-guarded), extracts readable text, summarizes it, and stores it as a ready reference.
- Add a **reference document** (PDF/DOCX/TXT) → text extracted (reuse `TextExtractionService`), summarized, stored.
- Manage references in a **References tab**: list with status (fetching/ready/failed), preview the summary/extract, include/exclude toggle, optional section tag, remove.
- **Included references are injected into the chat context** (token-budgeted) so answers are grounded in them; a chip shows how many references are in context.
- Honest status — partial/failed fetches (bot-blocked, JS-only, oversized) are surfaced, never silently empty.

## Technical architecture (summary)

- **New model `BaHldReference`** (hldId, sectionKey?, type URL|DOCUMENT, title, sourceUrl?, fileName?, mimeType?, extractedText, summary?, status, error?, includeInContext, createdAt).
- **URL ingestion** (NestJS): SSRF-guarded fetch (http(s) only; block loopback/private/link-local IPs after DNS resolve; size + timeout caps) → HTML→readable text → AI summary.
- **Document ingestion** (NestJS): multipart upload → `TextExtractionService.extract()` (PDF via pdf-parse, DOCX via mammoth, images via vision) → AI summary.
- **Summary** (ai-service): `/summarize-reference` (provider-routed, reuses copilot provider/keys).
- **Context injection**: `HldCopilotService.chat` gathers included references (whole-HLD + current section), budgets their summaries, and passes them to `/hld-chat` as a `references` block.
- **Frontend**: References tab in `HldCopilot` + `pipeline-api` helpers; an "N references in context" chip in the composer.

## Out of scope (deferred)

- Vector/semantic retrieval over references (chunk + embed + top-k) → **HD-10**.
- Recursive crawling / multi-page sites (v1 fetches the single given URL).
- JS-rendered scraping (headless browser) — v1 is static fetch; note when content is thin.
- Auto-refresh of URL content on a schedule.

## Dependencies

- ✅ `TextExtractionService` (PDF/DOCX/image extraction) — reuse for documents.
- ✅ `/hld-chat` context-injection pattern + provider routing (Track C).
- ✅ Copilot drawer/tabs (Track C/D) — add a References tab.
- ⚠️ New backend dep for HTML→text (e.g. `@mozilla/readability` + `jsdom`, or `node-html-parser`) — pick during RR-03.

## Risks & mitigations

| Risk | Sev | Mitigation |
|---|---|---|
| SSRF via user URL (hit internal services) | High | http(s) only; resolve DNS and block loopback/private/link-local/metadata IPs; size + timeout caps; no redirects to private hosts |
| Long page/doc blows the token budget | Med | Summarize on ingest; inject summaries (+ one key excerpt); cap total injected tokens |
| Site blocks bots / needs JS | Med | Capture what's returned; mark status partial/failed with a clear message; (headless render deferred) |
| Cost of summarizing every source | Low | One summary call per source at ingest; cached in `summary` |
| Stale content (page changed) | Low | Show ingested-at time; manual re-ingest button (v1) |

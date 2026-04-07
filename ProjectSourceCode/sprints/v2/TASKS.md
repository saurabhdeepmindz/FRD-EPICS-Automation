# Sprint v2 — Tasks: Conversational PRD Creation

## Status: Complete

---

## P0 — Core Conversational Flow (Must Have)

- [x] Task 1: Add file upload endpoint and text extraction service in NestJS (P0)
  - Acceptance: `POST /api/upload/extract` accepts PDF, DOCX, MD, TXT files (max 20 MB); returns `{ text: "...", format: "pdf|docx|md|txt", charCount: N }`; rejects unsupported formats with 400; rejects files > 20 MB with 413
  - Files:
    - `backend/src/upload/upload.controller.ts`
    - `backend/src/upload/upload.module.ts`
    - `backend/src/upload/extract.service.ts` (pdf-parse for PDF, mammoth for DOCX, passthrough for MD/TXT)
    - `backend/src/upload/dto/extract-response.dto.ts`
    - `backend/package.json` (add pdf-parse, mammoth)
    - `backend/src/app.module.ts` (register UploadModule)

- [x] Task 2: Add /parse endpoint to Python FastAPI AI service with streaming (P0)
  - Acceptance: `POST /parse` accepts `{ text, mode: "all_in_one"|"interactive" }`; returns `{ sections: { "1": { "productName": "...", "objective": "..." }, ... "22": {...} }, gaps: [{ section: 5, question: "..." }] }`; uses PRD-Template section structure as system prompt context; handles text up to 15,000 chars; supports streaming response (tokens appear progressively); rate limit: 20 parses/hour/session
  - Files:
    - `ai-service/main.py` (add /parse endpoint with streaming support)
    - `ai-service/prompts/parse_prompts.py` (system prompt for parsing raw text into 22-section PRD JSON)

- [x] Task 3: Add /gap-check endpoint to Python FastAPI AI service (P0)
  - Acceptance: `POST /gap-check` accepts `{ sections: {...}, answers: "..." }`; returns `{ updatedSections: {...}, remainingGaps: [...], gapCount: N }`; uses PRD-Template-Checklist rules in system prompt; identifies missing/weak sections
  - Files:
    - `ai-service/main.py` (add /gap-check endpoint)
    - `ai-service/prompts/gap_check_prompts.py` (system prompt using checklist rules)

- [x] Task 4: Add NestJS proxy endpoints for /parse and /gap-check (P0)
  - Acceptance: `POST /api/ai/parse` accepts `{ text, mode }` and proxies to Python /parse; `POST /api/ai/gap-check` accepts `{ sections, answers }` and proxies to Python /gap-check; file upload text can be piped through /parse; validation on all DTOs
  - Files:
    - `backend/src/ai/ai.controller.ts` (add parse + gapCheck methods)
    - `backend/src/ai/ai.service.ts` (add parse + gapCheck methods)
    - `backend/src/ai/dto/parse.dto.ts`
    - `backend/src/ai/dto/gap-check.dto.ts`

- [x] Task 5: Build conversational tab UI on /prd/new page (P0)
  - Acceptance: `/prd/new` now has two tabs: "Structured Form" (existing) and "Conversational" (new); conversational tab shows: mode toggle (All-in-one / Interactive), large textarea for pasting text, file upload dropzone (PDF/DOCX/MD/TXT), "Generate PRD Draft" button; switching tabs preserves form state; no changes to existing structured form tab
  - Files:
    - `frontend/app/prd/new/page.tsx` (refactor to tabbed layout)
    - `frontend/components/conversational/ConversationalTab.tsx`
    - `frontend/components/conversational/FileDropzone.tsx`
    - `frontend/components/conversational/ModeToggle.tsx`

---

## P1 — Interactive Mode & Review Screen (Should Have)

- [x] Task 6: Build interactive chat UI for gap analysis (P1)
  - Acceptance: When "Interactive" mode is selected, after initial parse, a chat area appears showing AI-identified gaps grouped by section; user can type answers; each "Send" calls `/api/ai/gap-check`; AI updates sections and shows remaining gaps; chat history is scrollable; gap count badge updates in real-time
  - Files:
    - `frontend/components/conversational/ChatArea.tsx`
    - `frontend/components/conversational/GapBadge.tsx`
    - `frontend/hooks/useConversation.ts` (manages chat state, parse/gap-check calls)

- [x] Task 7: Build diff/review screen for AI-generated sections (P1)
  - Acceptance: `/prd/new/review` (or modal) shows all 22 sections with AI-generated content; each section has Accept/Edit/Skip buttons; sections with no content show "GAP — not found in source" with "Fill Manually" option; progress bar shows % of sections accepted; "Accept All & Create PRD" commits all accepted sections; "Back to Input" returns to conversational tab; editing opens an inline textarea
  - Files:
    - `frontend/app/prd/new/review/page.tsx`
    - `frontend/components/review/SectionReviewCard.tsx`
    - `frontend/components/review/ReviewProgress.tsx`
    - `frontend/hooks/useReview.ts` (manages accept/edit/skip state per section)

- [x] Task 8: Wire review screen to PRD creation flow (P1)
  - Acceptance: Clicking "Accept All & Create PRD" calls `POST /api/prd` to create the PRD, then calls `PUT /api/prd/:id/section/:num` for each accepted section with the AI content; redirects to `/prd/:id/edit` after completion; sections marked as "AI Suggested" in the database (aiSuggested flag); skipped sections remain NOT_STARTED in the editor
  - Files:
    - `frontend/hooks/useReview.ts` (add commit logic)
    - `frontend/app/prd/new/review/page.tsx` (add commit handler)

---

## P2 — Polish (Nice to Have)

- [x] Task 9: Add loading states, error handling, and progress indicators (P2)
  - Acceptance: File upload shows upload progress; parsing shows "Analysing your input..." with animated dots; gap-check shows section-by-section population animation; errors from AI service show toast with retry; file too large shows clear error; unsupported format shows clear error; network timeout shows retry button
  - Files:
    - `frontend/components/conversational/ParseProgress.tsx`
    - Updates to ConversationalTab.tsx, ChatArea.tsx, review page

- [x] Task 10: Build admin settings page and backend (P1)
  - Acceptance: `/settings` page shows system-wide configuration: rate limit (default 20/hr), max file size (default 20 MB), AI model (default gpt-4.5-preview), temperature (default 0.4), concurrent user target (default 15), uptime target (default 90%); "Save Settings" persists to database; settings loaded on service startup; new Prisma model `Settings` with key-value pairs; `GET /api/settings` and `PUT /api/settings` endpoints
  - Files:
    - `backend/prisma/schema.prisma` (add Settings model)
    - `backend/src/settings/settings.controller.ts`
    - `backend/src/settings/settings.service.ts`
    - `backend/src/settings/settings.module.ts`
    - `backend/src/app.module.ts` (register SettingsModule)
    - `frontend/app/settings/page.tsx`

- [x] Task 11: Build PRD template reference page (P2)
  - Acceptance: `/templates` page renders the PRD-Template.md as styled HTML; each section shows guidance text; conversational tab includes a "View PRD Template Guide" link; page is read-only reference for BAs and customers
  - Files:
    - `frontend/app/templates/page.tsx`
    - Link added in ConversationalTab.tsx

- [x] Task 12: Add conversational input badge to PRD cards on dashboard (P2)
  - Acceptance: PRD cards on dashboard show a badge "AI Generated" if the PRD was created via conversational mode; the "Create New PRD" button on dashboard links to the tabbed `/prd/new` page; new CTA on landing page updated to reflect both creation paths
  - Files:
    - `frontend/app/dashboard/page.tsx` (add AI badge)
    - `frontend/app/page.tsx` (update CTA text)

---

## Task Sequence Summary

```
Task 1 (file upload + extraction)
    → Task 4 (NestJS proxy for parse + gap-check)
        → Task 5 (conversational tab UI)
            → Task 7 (review/diff screen)
                → Task 8 (wire review → PRD creation)
                    → Task 12 (dashboard polish)

Task 2 (FastAPI /parse + streaming)
    → Task 4 (NestJS proxy)
        → Task 5 (UI calls /parse)

Task 3 (FastAPI /gap-check)
    → Task 4 (NestJS proxy)
        → Task 6 (interactive chat UI)

Task 9 (loading/error states) — can be done after Task 5-8
Task 10 (admin settings) — independent, can be done in parallel
Task 11 (template reference) — independent, can be done in parallel
```

---

## Key Design Decisions

1. **File processing in NestJS, not Python**: PDF/DOCX text extraction happens in the backend (Node.js) because `pdf-parse` and `mammoth` are mature Node libraries. The Python service only receives extracted text — keeping it focused on AI/LLM work.

2. **Two modes on same tab**: All-in-one and Interactive share the same UI entry point. The mode toggle only changes whether the chat area appears after initial parse.

3. **Review screen is a separate route**: `/prd/new/review` gets its own page (not a modal) because users need space to review 22 sections without feeling cramped. State is passed via sessionStorage or React context.

4. **No Prisma schema changes**: The existing `content: Json` field and `aiSuggested: Boolean` flag on PrdSection are sufficient. No database migration needed.

5. **Additive only**: No existing v1 files are modified in structure. The `/prd/new` page gets refactored to a tabbed layout but the structured form tab renders the same component.

# Sprint v1 — Tasks: PRD Generator Web Application

## Status: In Progress

---

## P0 — Foundation (Must Have)

- [x] Task 1: Initialise monorepo project structure (P0)
  - Acceptance: Folder structure exists with `frontend/`, `backend/`, `ai-service/`; root `docker-compose.yml` starts all three services; `README.md` documents how to run locally
  - Files:
    - `ProjectSourceCode/frontend/` (Next.js 14 app)
    - `ProjectSourceCode/backend/` (NestJS app)
    - `ProjectSourceCode/ai-service/` (Python FastAPI)
    - `ProjectSourceCode/docker-compose.yml`
    - `ProjectSourceCode/README.md`
  - Completed: 29-Mar-2026 — Scaffolded all 3 service dirs with package.json/requirements.txt, Dockerfiles, .env.example; docker-compose.yml wires all 4 services (postgres, backend, ai-service, frontend); .gitignore excludes all .env secrets; 16/16 structural tests pass; no hardcoded secrets in committed files

- [x] Task 2: Scaffold Next.js 14 frontend with Tailwind CSS + shadcn/ui (P0)
  - Acceptance: `npm run dev` starts on port 3000; Tailwind classes render; shadcn/ui Button and Card components render correctly; app is responsive at 320px, 768px, 1280px
  - Files:
    - `frontend/app/layout.tsx`
    - `frontend/app/page.tsx`
    - `frontend/tailwind.config.ts`
    - `frontend/components/ui/` (shadcn base components)
  - Completed: 29-Mar-2026 — Next.js 14 App Router scaffold with Tailwind CSS (CSS variables, Claude-inspired palette), shadcn/ui Button (cva variants) and Card (Header/Title/Description/Content/Footer), lib/utils.ts (cn helper), landing page with data-testid attributes and 3 feature cards; 26/26 structural tests pass; E2E Playwright spec written (task2-homepage.spec.ts, runs via playwright.config.ts webServer); no XSS vectors or secrets in committed files

- [x] Task 3: Scaffold NestJS backend with PostgreSQL via Prisma (P0)
  - Acceptance: `npm run start:dev` starts on port 4000; `/health` endpoint returns `{ status: "ok" }`; `npx prisma db push` creates tables without error
  - Files:
    - `backend/src/main.ts`
    - `backend/src/app.module.ts`
    - `backend/prisma/schema.prisma` (Prd, PrdSection models)
    - `backend/.env.example`
  - Completed: 29-Mar-2026 — NestJS App Router with ConfigModule (global), ValidationPipe (whitelist+forbidNonWhitelisted), CORS from env, global /api prefix; health endpoint GET /api/health returns {status:"ok",timestamp}; Prisma schema with postgresql provider, Prd and PrdSection models (CUID ids, Json content field for flexible per-section data, cascading deletes, unique prdId+sectionNumber); PrismaService extends PrismaClient with lifecycle hooks; 25/25 structural tests pass; unit specs for AppService and AppController; no hardcoded secrets

- [x] Task 4: Scaffold Python FastAPI AI service (P0)
  - Acceptance: `uvicorn main:app` starts on port 5000; `POST /suggest` endpoint accepts `{ section, field, context }` and returns `{ suggestion: "..." }` using OpenAI GPT-4.5; API key loaded from env var `OPENAI_API_KEY`
  - Files:
    - `ai-service/main.py`
    - `ai-service/requirements.txt`
    - `ai-service/prompts/section_prompts.py` (per-section prompt templates)
    - `ai-service/.env.example`
  - Completed: 29-Mar-2026 — FastAPI app with GET /health and POST /suggest; Pydantic v2 request/response models with field validation (section 1-22, field non-empty); OpenAI AsyncClient injected via Depends (key never in route handler); CORS restricted to CORS_ORIGINS env var; per-section system prompts for all 22 PRD sections + DEFAULT_PROMPT fallback; pydantic-settings config (lru_cache); structured error handling (401/429/502 for OpenAI errors); 27/27 structural tests pass; 11 pytest unit tests with mocked OpenAI; no hardcoded secrets or injection risks

- [ ] Task 5: Build PRD data model and CRUD API in NestJS (P0)
  - Acceptance: REST endpoints working — `POST /prd` (create), `GET /prd/:id` (fetch), `PUT /prd/:id/section/:sectionNum` (update section), `GET /prd/:id/completion` (returns completion status per section); all tested via Postman
  - Files:
    - `backend/src/prd/prd.controller.ts`
    - `backend/src/prd/prd.service.ts`
    - `backend/src/prd/prd.module.ts`
    - `backend/src/prd/dto/`
    - `backend/prisma/schema.prisma` (updated with all 22 section fields)

- [ ] Task 6: Build left sidebar navigation + top stepper component (P0)
  - Acceptance: Left sidebar lists all 22 PRD sections; active section highlighted; completed sections show a ✓ badge; top stepper shows 22 steps with filled/empty/active states; clicking sidebar item or stepper step navigates to that section; stepper and sidebar stay in sync
  - Files:
    - `frontend/components/layout/Sidebar.tsx`
    - `frontend/components/layout/Stepper.tsx`
    - `frontend/app/prd/[id]/layout.tsx`
    - `frontend/hooks/usePrdCompletion.ts`

- [ ] Task 7: Build section form renderer for Sections 1–5 (P0)
  - Acceptance: Sections 1 (Overview), 2 (Scope), 3 (Out of Scope), 4 (Assumptions), 5 (Actors) render as structured forms matching the PRD template fields; each field has a "✨ AI Suggest" button; saving a section calls `PUT /prd/:id/section/:sectionNum`; section marked complete in stepper/sidebar on save
  - Files:
    - `frontend/app/prd/[id]/section/[num]/page.tsx`
    - `frontend/components/forms/SectionForm.tsx`
    - `frontend/components/forms/AISuggestButton.tsx`
    - `frontend/components/forms/sections/Section01.tsx` ... `Section05.tsx`

- [ ] Task 8: Build section form renderer for Sections 6–10 with sub-tabs (P0)
  - Acceptance: Section 6 (Functional Requirements) renders with sub-tabs for each of its 13 modules (6.1 Auth, 6.2 KYC, etc.); sub-tabs also appear below the top stepper when Section 6 is active; Section 10 (NFRs) renders with 7 sub-tabs; all fields have AI Suggest; saves persist per sub-section
  - Files:
    - `frontend/components/forms/SubTabBar.tsx`
    - `frontend/components/forms/sections/Section06.tsx` (with sub-tab routing)
    - `frontend/components/forms/sections/Section10.tsx` (with sub-tab routing)

- [ ] Task 9: Build section form renderer for Sections 11–22 (P0)
  - Acceptance: All remaining sections (Technology, DevOps, UI/UX, Branding, Compliance, Testing, Deliverables, Receivables, Environment, Timelines, Success Criteria, Miscellaneous) render as structured forms; AI Suggest works on all fields; completion tracked per section
  - Files:
    - `frontend/components/forms/sections/Section11.tsx` ... `Section22.tsx`

- [ ] Task 10: Build AI suggestion integration (frontend → NestJS → Python) (P0)
  - Acceptance: Clicking "✨ AI Suggest" on any field calls `POST /api/ai/suggest`; NestJS proxies to Python FastAPI; suggested text populates the field (editable); field is visually tagged "AI Suggested" (amber border); suggestion is generated within 5 seconds; OpenAI key loaded from server-side env only (never exposed to browser)
  - Files:
    - `backend/src/ai/ai.controller.ts`
    - `backend/src/ai/ai.service.ts` (HTTP client to Python service)
    - `frontend/hooks/useAISuggest.ts`
    - `frontend/components/forms/AISuggestButton.tsx` (updated)

---

## P1 — Preview & Export (Should Have)

- [ ] Task 11: Build PRD full-document preview page (P1)
  - Acceptance: `/prd/:id/preview` renders the assembled PRD as styled HTML with all 22 sections; left TOC panel with anchor links scrolls to each section; TOC links are clickable and jump to the correct section heading; responsive layout
  - Files:
    - `frontend/app/prd/[id]/preview/page.tsx`
    - `frontend/components/preview/PRDViewer.tsx`
    - `frontend/components/preview/TOCPanel.tsx`

- [ ] Task 12: Implement PDF generation and download (P1)
  - Acceptance: Clicking "Download PDF" on the preview page calls `GET /prd/:id/export/pdf`; NestJS generates a PDF using Puppeteer (headless Chrome); PDF has: cover page, linked TOC, all 22 sections with section headings; download starts in browser within 10 seconds for a full 22-section PRD
  - Files:
    - `backend/src/export/export.controller.ts`
    - `backend/src/export/pdf.service.ts` (Puppeteer)
    - `backend/src/export/templates/prd.html.ts` (HTML template for PDF)

---

## P2 — Polish (Nice to Have in v1)

- [ ] Task 13: Add PRD list / dashboard home page (P2)
  - Acceptance: `/` shows list of created PRDs with name, status (Draft/Complete), last updated; "Create New PRD" button; clicking a PRD opens the editor
  - Files:
    - `frontend/app/page.tsx` (updated)
    - `frontend/components/dashboard/PRDCard.tsx`
    - `backend/src/prd/prd.controller.ts` (`GET /prd` list endpoint added)

- [ ] Task 14: Add loading skeletons, empty states, and error toasts (P2)
  - Acceptance: Section forms show skeleton loaders while fetching; empty section shows helpful placeholder text; API errors show a toast notification; AI suggest shows a spinner while loading
  - Files:
    - `frontend/components/ui/Skeleton.tsx`
    - `frontend/components/ui/Toast.tsx`
    - Updates across section form components

---

## Task Sequence Summary

```
Task 1 (monorepo)
    → Task 2 (Next.js)  → Task 6 (sidebar/stepper) → Task 7 (forms 1–5)
    →                                                 → Task 8 (forms 6–10, sub-tabs)
    →                                                 → Task 9 (forms 11–22)
    → Task 3 (NestJS)   → Task 5 (PRD CRUD API)     → Task 10 (AI integration)
    → Task 4 (Python AI)→ Task 10 (AI integration)
                                                      → Task 11 (preview)
                                                      → Task 12 (PDF export)
                                                      → Task 13 (dashboard)
                                                      → Task 14 (polish)
```

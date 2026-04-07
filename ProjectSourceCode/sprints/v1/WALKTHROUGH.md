# Sprint v1 — Walkthrough

## Summary

Sprint v1 built the foundational monorepo, three scaffolded services (Next.js frontend, NestJS backend, Python FastAPI AI service), a PostgreSQL database schema for 22-section PRDs, and a full CRUD REST API for PRD documents. Five of fourteen tasks were completed, establishing the project skeleton, inter-service communication via Docker Compose, and the core data model that all future sprint work will build upon.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Browser (port 3000)                            │
│                                                                      │
│   Next.js 14 (App Router) + Tailwind CSS + shadcn/ui                 │
│   ┌──────────────────────────────────────────────────────────┐       │
│   │  Landing Page: Hero + 3 Feature Cards + CTA Buttons      │       │
│   │  (PRD Editor / Preview / PDF — planned Tasks 6-14)       │       │
│   └──────────────────────────────────────────────────────────┘       │
└───────────────────────────┬──────────────────────────────────────────┘
                            │  HTTP (NEXT_PUBLIC_API_URL)
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    NestJS Backend (port 4000)                         │
│                                                                      │
│   /api prefix ─── ValidationPipe (whitelist + forbidNonWhitelisted)   │
│                                                                      │
│   ┌──────────────┐   ┌──────────────────────────────────────┐        │
│   │ AppController │   │ PrdController                        │        │
│   │ GET /health   │   │ POST   /prd          (create)        │        │
│   └──────────────┘   │ GET    /prd          (list)          │        │
│                      │ GET    /prd/:id      (detail)        │        │
│                      │ PUT    /prd/:id/section/:num (update)│        │
│                      │ GET    /prd/:id/completion   (stats) │        │
│                      │ DELETE /prd/:id      (remove)        │        │
│                      └──────────────────────────────────────┘        │
│                           │                                          │
│                  PrismaService (global)                               │
└──────────────┬───────────────────────────────────────────────────────┘
               │ Prisma ORM                        │ HTTP (future Task 10)
               ▼                                   ▼
┌──────────────────────┐          ┌────────────────────────────────────┐
│   PostgreSQL 16      │          │   Python FastAPI AI Service        │
│   (Docker volume)    │          │   (port 5000)                      │
│                      │          │                                    │
│   Tables:            │          │   GET  /health                     │
│   - Prd              │          │   POST /suggest                    │
│   - PrdSection       │          │     → OpenAI GPT-4.5 (async)      │
│                      │          │     → 22 per-section system prompts│
└──────────────────────┘          └────────────────────────────────────┘
```

## Files Created/Modified

---

### docker-compose.yml
**Purpose**: Orchestrates all four services (postgres, backend, ai-service, frontend) with health checks, networking, and hot-reload volumes.

**Key Services**:
- `postgres` — PostgreSQL 16 Alpine with health check (`pg_isready`)
- `backend` — NestJS on port 4000, depends on healthy postgres
- `ai-service` — FastAPI on port 5000, receives `OPENAI_API_KEY` from env
- `frontend` — Next.js on port 3000, depends on backend

**How it works**:
All four services are wired together in a single Docker network. PostgreSQL starts first and the backend waits for its health check to pass before booting. The AI service starts independently. The frontend depends on the backend being available so it can proxy API calls. Each service mounts its source directory for hot-reload during development, and the postgres data is persisted in a named volume.

---

### README.md
**Purpose**: Project documentation covering architecture, prerequisites, setup instructions, environment configuration, and test execution.

**Key Sections**:
- Architecture diagram (3-tier + database)
- Quick Start (Docker) and Local Development paths
- Environment variable reference table
- Test execution commands

**How it works**:
The README serves as the single entry point for any developer joining the project. It documents two setup paths: `docker-compose up --build` for Docker users, or running three separate terminal sessions for local development. It also lists all environment variables required by each service and how to run the structural, unit, and E2E test suites.

---

### frontend/app/layout.tsx
**Purpose**: Root layout wrapping all pages with global metadata, Inter font, and Tailwind base styles.

**Key Components**:
- `RootLayout` — Server component that renders `<html>` and `<body>` with font and theme classes

**How it works**:
This is a Next.js 14 App Router root layout. It imports the Inter font from Google Fonts via `next/font/google`, assigns it as a CSS variable `--font-inter`, and applies global Tailwind classes (`font-sans antialiased min-h-screen bg-background`). The metadata export sets the page title to "PRD Generator" and a description for SEO.

---

### frontend/app/page.tsx
**Purpose**: Landing page with hero section, three feature cards, and call-to-action buttons.

**Key Components**:
- `HomePage` — Server component rendering the marketing landing page

**How it works**:
The page is split into two sections. The hero section displays a badge, an h1 heading ("Create Professional PRDs with AI"), a description paragraph, and two CTA buttons — "Create New PRD" linking to `/prd/new` and "View My PRDs" linking to `/dashboard`. Below the hero, three feature cards are rendered in a responsive grid (1 column on mobile, 3 on desktop), showcasing the 22-section framework, AI suggestions, and PDF export. All interactive elements use `data-testid` attributes for E2E testing.

```tsx
const FEATURES = [
  { icon: FileText,  title: "22-Section PRD Framework", ... },
  { icon: Sparkles,  title: "AI-Powered Suggestions",   ... },
  { icon: Download,  title: "Export to PDF",             ... },
];
```

---

### frontend/tailwind.config.ts
**Purpose**: Tailwind CSS configuration with dark mode support, HSL-based design tokens, and animation utilities.

**Key Configuration**:
- Dark mode via `class` strategy
- Custom colors referencing CSS variables (`hsl(var(--primary))`)
- Container centered with max-width 1400px
- Accordion animations (keyframes + utility classes)

**How it works**:
All colors are defined as CSS custom properties in `globals.css` and referenced via `hsl(var(...))` in the Tailwind config. This allows runtime theming and easy dark-mode support. The config extends the default theme with semantic color names (primary, secondary, destructive, muted, accent, card) plus border-radius tokens.

---

### frontend/components/ui/button.tsx
**Purpose**: Reusable Button component using Class Variance Authority (CVA) for type-safe variant styling.

**Key Exports**:
- `Button` — forwardRef component with variant and size props
- `buttonVariants` — CVA configuration for styling variants

**How it works**:
The Button uses CVA to define six visual variants (default, destructive, outline, secondary, ghost, link) and four sizes (default, sm, lg, icon). It supports an `asChild` prop via Radix UI's `Slot` for polymorphic rendering (e.g., rendering as a `<Link>` instead of `<button>`). All base styles include focus rings, disabled states, and smooth transitions.

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 ...",
  {
    variants: {
      variant: { default: "bg-primary text-primary-foreground ...", ... },
      size:    { default: "h-9 px-4 py-2", sm: "h-8 ...", ... },
    },
  }
);
```

---

### frontend/components/ui/card.tsx
**Purpose**: Card layout system with composable sub-components (Header, Title, Description, Content, Footer).

**Key Exports**:
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`

**How it works**:
Each sub-component is a forwardRef wrapper around a semantic HTML element (div, h3, p) with pre-configured Tailwind classes. They compose together to create consistent card layouts. The `cn()` utility merges incoming className props with defaults, handling Tailwind class conflicts.

---

### frontend/lib/utils.ts
**Purpose**: Utility function for safely merging Tailwind CSS classes with conflict resolution.

**Key Export**:
- `cn(...inputs)` — Combines `clsx` (conditional classes) with `tailwind-merge` (conflict resolution)

**How it works**:
`cn("px-4", "px-2")` correctly returns `"px-2"` instead of `"px-4 px-2"`. This is essential for component libraries where user-provided classNames must override defaults without duplication. Used by every shadcn/ui component.

---

### backend/src/main.ts
**Purpose**: NestJS bootstrap entry point configuring global API prefix, validation, and CORS.

**Key Configuration**:
- `app.setGlobalPrefix('api')` — All routes prefixed with `/api`
- `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`
- CORS with configurable origins from `CORS_ORIGINS` env var

**How it works**:
The bootstrap function creates the NestJS app, configures a global validation pipe that strips unknown properties and throws on unexpected fields, enables CORS for the frontend origin, and listens on the configured port (default 4000). The `forbidNonWhitelisted` option is a security measure that rejects requests with unexpected fields in the body.

---

### backend/src/app.module.ts
**Purpose**: Root NestJS module importing global configuration, Prisma, and the PRD feature module.

**Key Imports**:
- `ConfigModule.forRoot({ isGlobal: true })` — Loads `.env` globally
- `PrismaModule` — Database access
- `PrdModule` — PRD CRUD feature

---

### backend/src/app.controller.ts & app.service.ts
**Purpose**: Health check endpoint returning server status and timestamp.

**Key Endpoint**:
- `GET /api/health` — Returns `{ status: "ok", timestamp: "2026-03-29T..." }`

---

### backend/prisma/schema.prisma
**Purpose**: Database schema defining the PRD document and section models with PostgreSQL.

**Key Models**:
- `Prd` — Document-level: id (CUID), prdCode (unique), productName, version, status (enum: DRAFT/UNDER_REVIEW/APPROVED/BASELINED), author, timestamps
- `PrdSection` — Section-level: prdId + sectionNumber (unique pair), sectionName, status (NOT_STARTED/IN_PROGRESS/COMPLETE), content (JSON), aiSuggested flag

**How it works**:
Each PRD contains exactly 22 sections, created automatically when the PRD is created. The `content` field uses Prisma's `Json` type, allowing each section to store a flexible schema tailored to its specific fields. Cascade delete ensures removing a PRD removes all its sections. The composite unique constraint `@@unique([prdId, sectionNumber])` prevents duplicate sections.

```prisma
model PrdSection {
  id            String        @id @default(cuid())
  prdId         String
  sectionNumber Int
  sectionName   String
  status        SectionStatus @default(NOT_STARTED)
  content       Json          @default("{}")
  aiSuggested   Boolean       @default(false)
  prd           Prd           @relation(fields: [prdId], references: [id], onDelete: Cascade)
  @@unique([prdId, sectionNumber])
}
```

---

### backend/src/prisma/prisma.service.ts & prisma.module.ts
**Purpose**: Global singleton Prisma client with lifecycle management (connect on init, disconnect on destroy).

**Key Pattern**:
- `@Global()` module makes PrismaService injectable everywhere without explicit imports
- Extends `PrismaClient` so all Prisma methods are directly available

---

### backend/src/prd/prd.controller.ts
**Purpose**: REST controller exposing six CRUD endpoints for PRD management.

**Key Endpoints**:
- `POST /api/prd` — Create PRD with auto-generated 22 empty sections
- `GET /api/prd` — List all PRDs (summary only, no section content)
- `GET /api/prd/:id` — Fetch PRD with all sections and content
- `PUT /api/prd/:id/section/:sectionNumber` — Update section content
- `GET /api/prd/:id/completion` — Completion stats (total, completed, percentage)
- `DELETE /api/prd/:id` — Delete PRD with cascade

---

### backend/src/prd/prd.service.ts
**Purpose**: Business logic for PRD operations including auto-completion tracking and section name mapping.

**Key Functions**:
- `create(dto)` — Creates PRD + 22 sections with human-readable names from `SECTION_NAMES` constant
- `updateSection(id, num, dto)` — Updates content and auto-marks status (COMPLETE if content non-empty, IN_PROGRESS otherwise)
- `getCompletion(id)` — Returns `{ totalSections: 22, completedSections: N, percentComplete: N/22*100, sections: [...] }`

**How it works**:
The service maps section numbers 1-22 to display names (e.g., 1 = "Overview / Objective", 6 = "Functional Requirements"). When creating a PRD, it bulk-creates all 22 sections with NOT_STARTED status and empty JSON content. On section update, it automatically transitions the status based on whether the content is non-empty, and records the completion timestamp.

---

### backend/src/prd/dto/create-prd.dto.ts
**Purpose**: Validation schema for PRD creation requiring prdCode and productName.

**Validated Fields**:
- `prdCode` — Required string, max 50 chars (e.g., "PRD-LSM001")
- `productName` — Required string, max 200 chars
- `version` — Optional, max 20 chars (defaults to "1.0" in DB)
- `author` — Optional, max 100 chars

---

### backend/src/prd/dto/update-section.dto.ts
**Purpose**: Validation schema for section updates with flexible JSON content.

**Validated Fields**:
- `content` — Required object (`Record<string, unknown>`) — flexible per-section schema
- `aiSuggested` — Optional boolean flag

---

### ai-service/main.py
**Purpose**: FastAPI microservice that wraps OpenAI GPT-4.5 to generate PRD field suggestions.

**Key Endpoints**:
- `GET /health` — Returns status and model name
- `POST /suggest` — Accepts `{ section: 1-22, field: string, context?: string }`, returns AI-generated suggestion

**How it works**:
The suggest endpoint receives a section number and field name, looks up the corresponding system prompt from `section_prompts.py`, and calls OpenAI's chat completion API with the system prompt + user context. The OpenAI client is injected via FastAPI's `Depends()` pattern so the API key is never exposed in route handlers. Error handling maps OpenAI-specific exceptions to appropriate HTTP status codes (401 for auth errors, 429 for rate limits, 502 for other API failures).

```python
@app.post("/suggest", response_model=SuggestResponse)
async def suggest(request: SuggestRequest, client: AsyncOpenAI = Depends(get_openai_client)):
    system_prompt = get_section_prompt(request.section)
    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Field: {request.field}\nContext: {request.context}"}
        ],
        max_tokens=settings.OPENAI_MAX_TOKENS,
        temperature=settings.OPENAI_TEMPERATURE,
    )
    return SuggestResponse(suggestion=response.choices[0].message.content, ...)
```

---

### ai-service/config.py
**Purpose**: Pydantic settings class loading all configuration from environment variables with sensible defaults.

**Key Settings**:
- `OPENAI_API_KEY` — Required, from env only
- `OPENAI_MODEL` — Default "gpt-4.5-preview"
- `OPENAI_TEMPERATURE` — Default 0.4 (moderately deterministic)
- `CORS_ORIGINS` — Comma-separated, parsed to list via property

---

### ai-service/prompts/section_prompts.py
**Purpose**: Contains 22 specialized system prompts guiding GPT on how to generate content for each PRD section.

**Key Function**:
- `get_section_prompt(section_number)` — Returns section-specific prompt or DEFAULT_PROMPT fallback

**How it works**:
Each prompt instructs GPT to act as a senior product manager and generate content appropriate for that section. For example, Section 1 (Overview) asks for "2-4 executive-level sentences", Section 6 (Functional Requirements) asks for "FR-ID format, testable requirements", and Section 10 (NFRs) asks for "measurable targets". A universal `SYSTEM_BASE` prefix is prepended to every prompt establishing the role and output format.

---

### tests/task1-structure.test.mjs
**Purpose**: Validates monorepo directory structure and top-level configuration files exist.
**Tests**: 16 assertions checking all directories, Dockerfiles, package files, and docker-compose service references.

### tests/task2-frontend-scaffold.test.mjs
**Purpose**: Validates Next.js configuration, App Router files, shadcn/ui components, and styling setup.
**Tests**: 26 assertions covering config files, Tailwind directives, component exports, and page structure.

### tests/task3-backend-scaffold.test.mjs
**Purpose**: Validates NestJS core modules, Prisma schema, health endpoint, and security configuration.
**Tests**: 25 assertions checking main.ts config, Prisma models, service patterns, and absence of hardcoded secrets.

### tests/task4-ai-service-scaffold.test.mjs
**Purpose**: Validates FastAPI service structure, Pydantic config, prompt templates, and security.
**Tests**: 27 assertions covering API endpoints, settings fields, all 22 section prompts, and absence of API keys.

### tests/task5-prd-crud-api.test.mjs
**Purpose**: Validates PRD module files, controller routes, service methods, DTOs, and unit test existence.
**Tests**: 28 assertions checking all CRUD endpoints, DTO validators, and module wiring.

### tests/e2e/task2-homepage.spec.ts
**Purpose**: Playwright E2E tests validating homepage rendering, CTA buttons, feature cards, and responsive layout.
**Tests**: 6 test cases including mobile (320px), tablet (768px), and desktop (1280px) viewports with screenshots.

### ai-service/tests/test_suggest.py
**Purpose**: Pytest unit tests for the suggest endpoint with mocked OpenAI client.
**Tests**: 11 test cases covering happy path, validation errors, OpenAI error mapping, and prompt selection.

### backend/src/prd/prd.service.spec.ts & prd.controller.spec.ts
**Purpose**: NestJS unit tests for PRD service and controller with mocked Prisma.
**Tests**: 14 test cases (8 service + 6 controller) covering CRUD operations, completion stats, and error handling.

---

## Data Flow

1. **Developer runs** `docker-compose up --build` — PostgreSQL, backend, AI service, and frontend start in order
2. **User visits** `http://localhost:3000` — Landing page renders with hero section and feature cards
3. **User clicks** "Create New PRD" — (Future: navigates to `/prd/new`, calls `POST /api/prd`)
4. **Backend creates** PRD record + 22 empty sections in PostgreSQL via Prisma
5. **User fills** section form fields — (Future: calls `PUT /api/prd/:id/section/:num` on save)
6. **User clicks** "AI Suggest" on a blank field — (Future: frontend calls backend, backend proxies to FastAPI)
7. **FastAPI selects** section-specific system prompt → calls OpenAI GPT-4.5 → returns suggestion
8. **Suggested text** populates the field (editable, marked as AI-generated)
9. **Section marked** COMPLETE automatically when content is non-empty
10. **User views** completion progress via `GET /api/prd/:id/completion` — percentage and per-section status
11. **User previews** assembled PRD — (Future Task 11: renders all sections as styled HTML)
12. **User downloads** PDF — (Future Task 12: Puppeteer generates PDF with linked TOC)

## Test Coverage

- **Structural**: 122 tests across 5 suites — validate project structure, configs, module patterns, and security constraints
- **Unit (NestJS)**: 14 tests — PrdService (8) and PrdController (6) with mocked Prisma
- **Unit (Python)**: 11 tests — suggest endpoint, validation, error handling, prompt selection with mocked OpenAI
- **E2E (Playwright)**: 6 tests — homepage rendering, CTA buttons, feature cards, responsive viewports (320/768/1280px)
- **Total**: ~153 tests

## Security Measures

- **No hardcoded secrets** — All API keys and database URLs loaded from environment variables; `.env` files excluded via `.gitignore`
- **DTO whitelist validation** — `forbidNonWhitelisted: true` rejects requests with unknown fields, preventing mass assignment
- **CORS restriction** — Backend allows only `localhost:3000`, AI service allows only `localhost:4000`
- **OpenAI key isolation** — API key exists only in the Python service environment, never exposed to frontend or browser
- **Input validation** — Pydantic v2 on Python side (section 1-22 range, non-empty fields), class-validator on NestJS side (MaxLength, IsNotEmpty)
- **Cascade deletes** — Prisma schema ensures orphaned sections are cleaned up when a PRD is deleted

## Known Limitations

- **5 of 14 tasks completed** — No UI forms, AI integration flow, preview, or PDF export yet
- **No authentication** — Single-user session; anyone with the URL can access all PRDs
- **No real-time auto-save** — Explicit save actions required (by design for v1)
- **SQLite-free but Docker-dependent** — PostgreSQL requires Docker or local install
- **No CI/CD pipeline** — Tests run locally only; no GitHub Actions or deployment workflow
- **Frontend is static** — Landing page exists but no functional PRD editor screens yet
- **AI service untested end-to-end** — Unit tests mock OpenAI; no integration test hitting real API
- **No rate limiting** — API endpoints are unprotected against abuse
- **No error boundaries** — React error boundaries not implemented; API errors not surfaced to UI

## What's Next

Based on the remaining tasks and PRD trajectory, **v1 completion** should prioritize:

1. **Task 6** — Left sidebar navigation + top stepper component (UI skeleton for the editor)
2. **Tasks 7-9** — Section form renderers for all 22 sections (the core user experience)
3. **Task 10** — AI suggestion integration wiring frontend → NestJS → FastAPI → OpenAI
4. **Task 11** — Full PRD preview page with TOC navigation
5. **Task 12** — PDF generation and download via Puppeteer
6. **Tasks 13-14** — Dashboard home page, loading states, and error toasts

For **v2**, the PRD defers: user authentication, version history, EPIC/User Story generation, RTM generation, real-time auto-save, and multi-user collaboration.

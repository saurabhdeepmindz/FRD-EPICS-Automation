---
description: Create a complete Product Requirements Document (PRD) using AI-powered conversational input, interactive gap analysis, document upload, voice input, and enterprise-grade 22-section generation with source tracking, audit trail, and professional export
---

# `/create-prd` v2 — AI-Powered PRD Creator

> Transform raw requirements into a comprehensive, enterprise-grade 22-section PRD using conversational AI, document parsing, interactive gap analysis, and voice input.

You are a senior product manager at a multinational IT consulting firm. Your job is to guide users — whether experienced BAs or first-time product owners — through creating a complete, professional PRD using the organisation's standard 22-section template. You leverage AI to generate, elaborate, and validate content at enterprise quality.

---

## Reference Documents

| # | Document | Purpose |
|---|----------|---------|
| T1 | `Master-Documents/PRD-Template-Checklist.md` | Completeness checklist — run BEFORE and AFTER writing (200+ items) |
| T2 | `Master-Documents/PRD-Template.md` | The canonical 22-section PRD structure to fill |
| T3 | `Project-Documents/PRD-PRDGEN-V2.md` | Reference PRD created using this skill (v2 example) |

---

## What Changed from v1

| Area | v1 (Original) | v2 (Current) |
|------|---------------|--------------|
| Input Method | Text only, manual Q&A | Text paste, file upload (PDF/DOCX/MD/TXT), voice input (STT) |
| AI Role | Gap identification only | Full content generation + gap identification + elaboration |
| Section 6 | Hardcoded 13 modules | Dynamic modules inferred from product domain |
| Section 10 | User must fill NFRs | AI generates all 7 NFR categories with measurable targets |
| Gap Analysis | Batch text response | Per-gap wizard UI with section pills, skip/submit, progress bar |
| Source Tracking | None | [AI] prefix on generated content; blue in editor, black in export |
| Document Output | Basic content only | Cover page, Document History, TOC, header/footer, revision appendix |
| PRD Metadata | PRD Code + Product Name + Author | + Client Name, Submitted By, Client Logo, Source Document |
| Audit Trail | None | Per-field change tracking with version numbers and diff history |
| Voice Input | None | Pluggable STT (Whisper/Deepgram/AssemblyAI/ElevenLabs/Cartesia) |
| Original Source | Lost after creation | Stored in DB, viewable via "Source" button in editor/preview |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Browser (Next.js 14)                             │
│                                                                     │
│  /prd/new ──────────┐                                               │
│    ├─ Structured Tab │   /prd/:id/edit ── /prd/:id/preview          │
│    └─ Conversational │        │                │                    │
│         ├─ Text/Paste│        ├─ SectionForm   ├─ Cover Page        │
│         ├─ File Upload│       ├─ MicButton     ├─ Document History  │
│         ├─ Mic (STT)  │       ├─ SectionHistory├─ TOC               │
│         └─ GapWizard  │       ├─ ViewSource    ├─ Export PDF/DOCX   │
│              │        │       └─ Dynamic Sidebar└─ Revision Appendix│
│              ▼        │                                              │
│  /prd/new/review      │                                              │
│    ├─ Accept/Edit/Skip│                                              │
│    ├─ AI source badges│                                              │
│    └─ Create PRD      │                                              │
└──────────┬────────────┴──────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   NestJS Backend (port 4000)                         │
│                                                                     │
│  POST /api/prd              — Create PRD (with source data)         │
│  PUT  /api/prd/:id/section  — Update section (with audit diff)      │
│  GET  /api/prd/:id/source   — Retrieve original source document     │
│  GET  /api/prd/:id/history  — Audit trail entries                   │
│  PATCH /api/prd/:id/meta    — Update clientName, submittedBy        │
│  POST /api/prd/:id/logo     — Upload client logo (base64)           │
│  GET  /api/prd/:id/export/pdf  — PDF with cover, history, TOC      │
│  GET  /api/prd/:id/export/docx — DOCX with same structure           │
│  POST /api/ai/parse         — Proxy to AI parse                     │
│  POST /api/ai/gap-check     — Proxy to AI gap analysis              │
│  POST /api/ai/suggest       — Proxy to AI field suggest             │
│  POST /api/ai/transcribe    — Proxy to AI speech-to-text            │
│  POST /api/upload/extract   — Extract text from PDF/DOCX/MD/TXT    │
└──────────┬──────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Python FastAPI AI Service (port 5000)                    │
│                                                                     │
│  POST /parse       — Raw text → 22-section PRD JSON with [AI] tags │
│  POST /gap-check   — Sections + answers → updated sections + gaps   │
│  POST /suggest     — Field-level AI suggestion                       │
│  POST /transcribe  — Audio → text (pluggable STT provider)          │
│                                                                     │
│  STT Providers: Whisper (default) | Deepgram | AssemblyAI |         │
│                 ElevenLabs | Cartesia                                │
└──────────┬──────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   PostgreSQL (port 5433)                              │
│                                                                     │
│  Tables: prds, prd_sections (22 per PRD), prd_audit_logs            │
│  Fields: clientName, submittedBy, clientLogo, sourceText,            │
│          sourceFileName, sourceFileData                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Your Process

### Step 1: Collect Raw Requirements (Multiple Input Modes)

The user can provide requirements through ANY of these channels:

**A. Text Paste** — User pastes meeting notes, BRD content, product description, or rough idea into a textarea.

**B. Document Upload** — User uploads a file:
- **PDF** — text extracted via `pdf-parse`
- **DOCX** — text extracted via `mammoth`
- **MD / TXT** — read as UTF-8
- Max file size: 20 MB

**C. Voice Input** — User clicks the microphone button and speaks. Audio is:
1. Recorded via browser MediaRecorder (WebM/Opus)
2. Sent to `POST /api/ai/transcribe`
3. Transcribed by the configured STT provider (default: OpenAI Whisper)
4. Text appended to the input field

**D. Seed Questions** — If nothing is provided, ask these 5 seed questions:
1. What is the product / application name and its primary purpose?
2. Who are the primary users (actors) and what are their roles?
3. What are the top 5–10 functional capabilities expected?
4. Are there any known integrations, compliance, or NFR constraints?
5. What is the target delivery timeline and environment (web / mobile / API)?

**Source Preservation:** The original input (text + filename if uploaded) is stored in the database for future reference via the "Source" button.

---

### Step 2: AI Parses Input into 22-Section PRD

The AI service receives the extracted text and generates a COMPREHENSIVE PRD:

**Two Modes:**

| Mode | Behaviour |
|------|-----------|
| **All-in-one** (default) | AI generates all 22 sections in one pass, then goes to review screen |
| **Interactive** | AI generates initial draft + identifies gaps, then presents per-gap wizard for iterative refinement |

**AI Generation Rules (Enterprise-Grade):**
- AI acts as a "world-class senior PM at a multinational consulting firm"
- EVERY section must have rich, detailed content — never just "TBD"
- AI INFERS and ELABORATES beyond what the user explicitly stated
- If input mentions "login", AI expands into full auth module: registration, login, password reset, MFA, OAuth, session management — each as separate features
- Industry best practices and standard patterns applied automatically

**Source Tracking:**
- Content directly extracted from user input → normal text (black)
- Content AI-generated/inferred → prefixed with `[AI] ` (displayed in blue in editor/preview)
- PDF/DOCX export → all text renders in professional black (prefix stripped)

**Section 6 — Functional Requirements (Dynamic Modules):**
- AI creates modules SPECIFIC to the product domain (not hardcoded)
- Example: CRM → Lead Management, Contact Management, Pipeline, Reporting
- Each module gets: moduleId, moduleName, moduleDescription, moduleBusinessRules
- Each module gets 3-8 features with: featureId (FR-{MOD}-{NNN}), featureName, description ("The system shall..."), businessRule, acceptanceCriteria (Given-When-Then), priority (P0/P1/P2)
- Feature IDs are RTM-traceable to downstream EPICs and User Stories

**Section 10 — Non-Functional Requirements (All 7 Categories):**
- 10.1 Performance — "API response < 200ms at p95, page load < 2s"
- 10.2 Security — "OWASP Top 10 compliance, AES-256 at rest, TLS 1.3 in transit"
- 10.3 Scalability — "10,000 concurrent users, horizontal scaling"
- 10.4 Availability — "99.9% uptime SLA, RPO < 1 hour, RTO < 4 hours"
- 10.5 Privacy — "GDPR compliant, right to be forgotten, consent management"
- 10.6 Maintainability — "90%+ coverage, <30 min deployment, blue-green"
- 10.7 Audit & Logging — "All CRUD logged, immutable trail, 1-year retention"

---

### Step 3: Interactive Gap Analysis (Per-Gap Wizard)

If in Interactive mode, after initial parse:

**Gap Wizard UI:**
- **Section pill bar** at top — shows which sections have gaps (green=answered, amber=pending, gray=skipped)
- **One gap at a time** — focused card with section badge, AI question, textarea + mic button
- **Skip / Submit & Next** — each answer scoped to its section
- **Previously answered trail** — shows all answered/skipped gaps (clickable to revisit)
- **Progress bar** — visual completion indicator
- **"Review All & Proceed"** — consolidates answers, calls gap-check API, navigates to review

**Gap Limit:** 10-15 maximum in interactive mode. AI should generate content with [AI] prefix rather than creating gaps for information it can reasonably infer.

**Voice Input on Gaps:** Each gap answer textarea has a microphone button for voice responses.

---

### Step 4: Review / Diff Screen

Before creating the PRD, user reviews all 22 sections:

**Per-Section Review Card:**
- Shows AI-generated content with blue text for [AI] prefix values
- Accept / Edit / Skip buttons
- "AI-generated fields" count badge
- Section 6: expanded module/feature view with feature IDs, descriptions, priorities
- Section 10: NFR sub-module cards with requirement + metric/SLA
- Gap indicator for sections with no content

**Metadata Fields:**
- PRD Code * (required)
- Product Name * (required, auto-filled from Section 1)
- Client Name (for cover page)
- Submitted By (for cover page)

**Actions:**
- "Accept All Pending" — batch accept
- "Accept All & Create PRD (N sections)" — commits to database
- Each accepted section calls `PUT /api/prd/:id/section/:num` with `aiSuggested: true`

---

### Step 5: Run the PRD Checklist (Validation)

Load `Master-Documents/PRD-Template-Checklist.md`.

**Minimum requirements per section:**
- Section 1: Must answer What, Why, Who, and Value
- Section 2: List functional areas with capabilities; distinguish MVP from future
- Section 3: At least 5 exclusions with reasons
- Section 4: At least 5 assumptions with owners; at least 4 constraints
- Section 5: At least 3 actors with roles, permissions, restrictions
- Section 6: At least 4 modules with 3+ features each; every feature has FR-ID, description, acceptance criteria
- Section 7: All integrations with type, direction, owner, SLA
- Section 8: At least 2 journeys with happy path, alternate path, exception path
- Section 9: All modules listed with dependencies
- Section 10: All 7 NFR sub-modules with measurable targets
- Sections 11-19: Technology, DevOps, UI/UX, branding, compliance, testing, deliverables, receivables, environments
- Section 20: At least 8 milestones with target dates
- Section 21: At least 3 measurable, time-bound business success criteria
- Section 22: Miscellaneous items classified and EPIC-traced

---

### Step 6: Professional Document Structure

The PRD output (preview + PDF/DOCX export) follows this structure:

**Page 1 — Cover Page:**
- Client Logo (uploaded image)
- "Product Requirements Document" (header)
- "PRD for [Product Name]" (title)
- PRD Code, Client Name, Submitted By, Author
- Date (latest revision date from audit trail)
- Revision Number (latest version from audit trail)
- Status (Draft / Under Review / Approved / Baselined)

**Page 2 — Document History:**
- Version table: Version | Date | Description of Changes
- Each description hyperlinks to the Appendix for full details

**Page 3 — Table of Contents:**
- 3-level TOC: Section → Module → Feature (for Section 6)
- Incomplete sections marked in red with "Incomplete" badge
- Appendix link at bottom

**Pages 4+ — Content Sections (1-22):**
- Header on every page: "Product Requirements Document"
- Footer on every page: "Page X of Y"
- Section 6: Module cards with feature cards (border-left accent)
- Incomplete sections: red heading, red banner with "Please fill this section"

**Final Page — Appendix: Revision History:**
- Full audit trail: Version, Date, Section, Field, Change Type, Source, Summary

---

### Step 7: Audit Trail & Version History

Every field change is tracked automatically:

**Per-section change tracking:**
- Change types: CREATED, MODIFIED, AI_GENERATED, AI_MODIFIED
- Sources: AI, MANUAL
- Previous value vs new value stored as text diff
- Version auto-increments: 1.0 → 1.1 → 1.2...

**Accessible via:**
- History icon (clock) on each section header in the editor → popover with section's change log
- Appendix in preview page and PDF/DOCX export
- Document History page (grouped by version) with hyperlinks to appendix
- `GET /api/prd/:id/history` API endpoint

---

### Step 8: View Original Source

The original input used to generate the PRD is preserved:

- **Stored in database:** `sourceText`, `sourceFileName`, `sourceFileData` (base64)
- **Accessible via:** "Source" button in editor and preview top bar
- **Shows:** Original file name, upload timestamp, character count, full text, download button

This ensures traceability — you can always go back to what the customer originally said.

---

### Step 9: Finalise and Save

1. Set PRD `Status` to **Draft** (first pass) or **Under Review** (if reviewed by stakeholder)
2. PRD is automatically saved in PostgreSQL with all sections, audit trail, and source document
3. Export as PDF or DOCX from the preview page — includes cover page, document history, TOC, all content, and revision appendix
4. Upload client logo from preview page for the cover
5. Confirm with the customer that the PRD is approved before proceeding to EPICs

---

## Output Checklist (Definition of Done)

- [ ] All 22 PRD sections populated (no blank sections)
- [ ] Success Criteria (Section 21) are measurable, time-bound, and agreed with the customer
- [ ] Miscellaneous Requirements (Section 22) are all classified, owned, and EPIC-traced
- [ ] PRD-Template-Checklist passes with zero open gaps
- [ ] Section 6: Modules are dynamic (domain-specific), each with 3+ features having unique FR-IDs
- [ ] Section 10: All 7 NFR categories have measurable targets
- [ ] Actors / User Types are enumerated with roles and permissions
- [ ] Integration requirements listed with type, direction, SLA
- [ ] Customer Journeys documented (2+ with happy/alternate/exception paths)
- [ ] AI-generated content is visually distinguishable (blue in editor, black in export)
- [ ] Cover page has: Client Logo, PRD title, Client Name, Submitted By, Date, Revision
- [ ] Document History page with version table
- [ ] TOC with 3-level drill-down (Section → Module → Feature)
- [ ] Header/footer on every page (PDF/DOCX)
- [ ] Audit trail has at least the initial creation entry
- [ ] Original source document is stored and viewable
- [ ] PRD status set and revision history entry added
- [ ] File exported as PDF and/or DOCX for customer delivery

---

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│   COLLECT REQUIREMENTS                                        │
│   ┌──────────┐  ┌────────────┐  ┌─────────┐  ┌──────────┐  │
│   │ Text     │  │ File Upload│  │ Voice   │  │ Seed Qs  │  │
│   │ Paste    │  │ PDF/DOCX/  │  │ (STT)   │  │ (if no   │  │
│   │          │  │ MD/TXT     │  │ Whisper+ │  │ input)   │  │
│   └────┬─────┘  └─────┬──────┘  └────┬────┘  └────┬─────┘  │
│        └───────────────┼──────────────┘            │         │
│                        ▼                           │         │
│              ┌─────────────────┐                   │         │
│              │ Store Original  │◄──────────────────┘         │
│              │ Source in DB    │                              │
│              └────────┬────────┘                             │
└───────────────────────┼──────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│   AI PARSE (Enterprise-Grade)                                 │
│                                                               │
│   ┌─ All-in-one mode ──────────────────────────────────────┐ │
│   │ AI generates ALL 22 sections with [AI] source tracking │ │
│   │ Dynamic modules for Section 6 (domain-specific)        │ │
│   │ All 7 NFR categories with measurable targets           │ │
│   └───────────────────────────────────┬────────────────────┘ │
│                                       │                      │
│   ┌─ Interactive mode ────────────────┼────────────────────┐ │
│   │ AI generates initial draft        │                    │ │
│   │         │                         │                    │ │
│   │         ▼                         │                    │ │
│   │  ┌─────────────────┐             │                    │ │
│   │  │  GAP WIZARD     │             │                    │ │
│   │  │  - Section pills │             │                    │ │
│   │  │  - 1 gap at time │             │                    │ │
│   │  │  - Skip/Submit   │             │                    │ │
│   │  │  - Mic input     │             │                    │ │
│   │  │  - Progress bar  │             │                    │ │
│   │  └────────┬────────┘             │                    │ │
│   │           │ All gaps addressed    │                    │ │
│   │           ▼                       │                    │ │
│   │  POST /api/ai/gap-check          │                    │ │
│   │  (merge answers, re-evaluate)    │                    │ │
│   └───────────────────────────────────┤                    │ │
│                                       │                      │
└───────────────────────────────────────┼──────────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────┐
│   REVIEW / DIFF SCREEN                                        │
│                                                               │
│   ┌── Per-Section Card ─────────────────────────────────────┐│
│   │ Section N — Name        [AI badge: N AI-generated fields]││
│   │ Content preview (blue = AI, black = extracted)           ││
│   │ Section 6: Module → Feature drill-down                   ││
│   │ Section 10: NFR sub-module cards with metrics            ││
│   │ [Accept]  [Edit]  [Skip]                                ││
│   └─────────────────────────────────────────────────────────┘│
│                                                               │
│   Metadata: PRD Code*, Product Name*, Client Name, Submitted By │
│                                                               │
│   [Accept All & Create PRD (N sections)]                      │
└───────────────────────────────────────┬──────────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────┐
│   PRD CREATED IN DATABASE                                     │
│                                                               │
│   POST /api/prd (with sourceText, sourceFileName, sourceFile) │
│   PUT  /api/prd/:id/section/:num (for each accepted section) │
│   Audit trail entries created (CREATED / AI_GENERATED)        │
│                                                               │
│   Redirect to /prd/:id/edit                                   │
└───────────────────────────────────────┬──────────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────┐
│   PRD EDITOR                                                  │
│                                                               │
│   - Dynamic sidebar (Section → Module → Feature for Sec 6)   │
│   - Scrollable sub-tab bar for modules                        │
│   - FormField with MicButton + AI Suggest on every field      │
│   - SectionHistory popover per section (audit trail)          │
│   - ViewSource button (original input)                        │
│   - Blue text for [AI] content, black for user content        │
│   - Every save triggers audit diff (old vs new, version++)    │
└───────────────────────────────────────┬──────────────────────┘
                                        ▼
┌──────────────────────────────────────────────────────────────┐
│   PREVIEW & EXPORT                                            │
│                                                               │
│   Preview Page:                                               │
│   - Cover Page (logo, title, metadata, revision)              │
│   - Document History (version table with hyperlinks)          │
│   - 3-level TOC (Section → Module → Feature)                  │
│   - Content with blue/black source distinction                │
│   - Incomplete indicators (red headings, banners)             │
│   - Appendix: Full Revision History                           │
│                                                               │
│   Export (PDF / DOCX):                                        │
│   - Same structure, all text in black                         │
│   - Header: "Product Requirements Document" on every page     │
│   - Footer: "Page X of Y" pagination                          │
│   - Puppeteer for PDF, html-docx-js fallback for DOCX        │
└──────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui | UI, routing, SSR |
| Backend | NestJS 10 + Prisma ORM | API, business logic, DB access |
| AI Service | Python FastAPI + OpenAI GPT-4.1 | Content generation, gap analysis, STT |
| Database | PostgreSQL | PRD storage, audit trail, source documents |
| PDF Export | Puppeteer (headless Chrome) | HTML → PDF rendering |
| Text Extraction | pdf-parse (PDF), mammoth (DOCX) | Document upload processing |
| STT | OpenAI Whisper (default), pluggable | Speech-to-text for voice input |

---

## Configuration

### Environment Variables (ai-service/.env)

```bash
# AI
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4.1

# Speech-to-Text (pluggable)
STT_PROVIDER=whisper          # whisper | deepgram | assemblyai | elevenlabs | cartesia
STT_API_KEY=                  # Leave empty to reuse OPENAI_API_KEY for Whisper
STT_MODEL=whisper-1           # Provider-specific model name
STT_LANGUAGE=en               # ISO 639-1 language code
```

### Database Fields (Prisma Schema)

```prisma
model Prd {
  prdCode        String   @unique
  productName    String
  version        String   @default("1.0")
  status         PrdStatus @default(DRAFT)
  author         String?
  clientName     String?
  submittedBy    String?
  clientLogo     String?          // base64 data-URI
  sourceText     String?  @db.Text // original input text
  sourceFileName String?           // uploaded file name
  sourceFileData String?  @db.Text // file as base64 (Phase 1: DB, Phase 2: S3)
}

model PrdAuditLog {
  sectionNumber  Int
  fieldKey       String
  changeType     ChangeType       // CREATED | MODIFIED | AI_GENERATED | AI_MODIFIED
  source         ChangeSource     // AI | MANUAL
  previousValue  String?  @db.Text
  newValue       String?  @db.Text
  version        String           // auto-increments: 1.0, 1.1, 1.2...
}
```

---

## Rules

- NEVER skip the checklist validation pass
- NEVER proceed to EPICs unless the PRD checklist is fully satisfied
- AI MUST generate comprehensive content for all 22 sections — never leave "TBD"
- Section 6 modules MUST be dynamic — inferred from the product domain, not hardcoded
- Section 10 MUST have all 7 NFR categories with measurable targets
- Every feature in Section 6 MUST have a unique FR-ID for RTM traceability
- [AI] prefix MUST be used on all AI-generated/inferred content
- Original source input MUST be preserved in the database
- All field changes MUST be tracked in the audit trail
- Voice input MUST be available on all text fields (conversational + editor)
- Cover page MUST include: Client Logo, PRD title, Client Name, Submitted By, Date, Revision
- PDF/DOCX export MUST have: Cover page, Document History, TOC, header/footer, revision appendix
- Ask gap questions in per-gap wizard format — not as a batch wall of text
- Limit gaps to 10-15 in interactive mode; generate [AI] content instead of creating gaps for inferable information
- Use the exact section numbering from PRD-Template.md
- Mark every TBD item with the owner who must resolve it

---

## Deployment

### Local Development

```bash
# Start all services
docker-compose up -d postgres    # PostgreSQL on port 5433
cd ai-service && uvicorn main:app --port 5000   # AI service
cd backend && npm run start:dev   # NestJS on port 4000
cd frontend && npm run dev -- -p 3001            # Next.js on port 3001
```

### Phase 2 (Cloud) — Planned

| Component | Target |
|-----------|--------|
| File storage | AWS S3 (replace base64 DB storage with presigned URLs) |
| Authentication | NextAuth.js or Auth0 |
| CI/CD | GitHub Actions → Docker → K8s |
| Monitoring | Datadog/Grafana for API latency, error rates |

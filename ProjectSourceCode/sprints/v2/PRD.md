# Sprint v2 — PRD: Conversational PRD Creation with AI-Powered Document Parsing

## Overview

Add a conversational input path to PRD creation. Users can now choose between the existing structured form (v1) or a new conversational mode where they paste raw text, upload documents (PDF/DOCX/MD/TXT), or answer guided questions. The AI service parses the input, runs a gap analysis using the PRD-Template-Checklist, asks follow-up questions for missing information, and auto-populates all 22 PRD sections. Users review a diff screen before committing the AI-generated content to the editor. This implements the full SKILL-01-create-prd workflow as an in-app experience.

> **Detailed PRD**: See `Project-Documents/PRD-PRDGEN-V2.md` for the full 22-section PRD with functional requirements, NFRs, customer journeys, integrations, and success criteria.

## Goals

- User can choose between "Structured Form" (v1) and "Conversational" (new) when creating a PRD
- Conversational mode accepts raw text paste, file upload (PDF, DOCX, MD, TXT — max 20 MB), or guided Q&A
- User can toggle between "All-in-one" (default, parse everything at once) and "Interactive" (iterative gap analysis) modes
- AI streams response tokens progressively (no blank screen during 30-second wait)
- AI runs the PRD-Template-Checklist gap analysis and asks follow-up questions for missing sections
- User sees a diff/review screen showing what AI populated per section before committing
- After committing, user lands in the existing PRD editor with pre-filled sections
- Admin settings page for configurable parameters (rate limit, file size, AI model, concurrent users, uptime target)
- In-app PRD template reference page for BAs and customers
- All changes are additive — existing v1 structured form and editor are untouched

## User Stories

- As a BA, I want to paste my meeting notes and have AI create a PRD draft, so that I don't start from a blank template
- As a BA, I want to upload an existing BRD/SOW document, so that I can transform it into a structured PRD
- As a BA, I want the AI to identify what's missing from my input, so that I can fill the gaps before the PRD is drafted
- As a BA, I want to choose between "all-in-one" and "interactive" mode, so that I can control the level of AI guidance
- As a BA, I want to review what the AI has filled per section before accepting, so that I maintain quality control
- As a BA, I want the conversational mode on the same page as the structured form, so that switching between approaches is seamless

## Technical Architecture

### New Components

```
┌──────────────────────────────────────────────────────────────────┐
│                   /prd/new (Two Tabs)                            │
│                                                                  │
│   [Structured Form]  |  [Conversational]  ← NEW TAB             │
│                                                                  │
│   ┌────────────────────────────────────────────────────────┐    │
│   │  Mode Toggle: [All-in-one] [Interactive]               │    │
│   ├────────────────────────────────────────────────────────┤    │
│   │                                                        │    │
│   │  Input Area:                                           │    │
│   │  ┌──────────────────────────────────────────┐          │    │
│   │  │  [Paste text here...]                     │          │    │
│   │  │  [  OR  ]                                 │          │    │
│   │  │  [📎 Upload: PDF, DOCX, MD, TXT]         │          │    │
│   │  └──────────────────────────────────────────┘          │    │
│   │                                                        │    │
│   │  ┌──────────────────────────────────────────┐          │    │
│   │  │  Chat / Gap Analysis Area                 │          │    │
│   │  │  AI: "I found gaps in Section 5, 7, 10..." │         │    │
│   │  │  User: "The actors are..."                │          │    │
│   │  └──────────────────────────────────────────┘          │    │
│   │                                                        │    │
│   │  [Generate PRD Draft]                                  │    │
│   └────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼  POST /api/ai/parse
┌──────────────────────────────────────────────────────────────────┐
│                    NestJS Backend                                 │
│                                                                  │
│   AiController:                                                  │
│   POST /api/ai/parse      ← NEW: parse raw input → 22 sections  │
│   POST /api/ai/gap-check  ← NEW: run checklist gap analysis     │
│   POST /api/ai/suggest    ← existing (v1)                       │
│                                                                  │
│   FileUploadService:       ← NEW: extract text from PDF/DOCX    │
│     - PDF → text (pdf-parse)                                     │
│     - DOCX → text (mammoth)                                     │
│     - MD/TXT → passthrough                                      │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│              Python FastAPI AI Service                            │
│                                                                  │
│  POST /parse        ← NEW: raw text → 22-section JSON output    │
│  POST /gap-check    ← NEW: draft sections → gap list            │
│  POST /suggest      ← existing (v1)                              │
│                                                                  │
│  Uses PRD-Template-Checklist.md as system prompt context          │
│  Uses PRD-Template.md section definitions for output structure   │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼  After AI populates sections
┌──────────────────────────────────────────────────────────────────┐
│              /prd/new/review (Diff Screen)                        │
│                                                                  │
│   ┌──────────────────────────────────────────────────────┐      │
│   │  Section 1 — Overview / Objective                     │      │
│   │  ┌─────────────────────────────────────┐              │      │
│   │  │ AI Generated:                        │              │      │
│   │  │ "This product is a luggage storage   │              │      │
│   │  │  marketplace connecting travellers..." │              │      │
│   │  └─────────────────────────────────────┘              │      │
│   │  [✓ Accept] [✏ Edit] [✗ Skip]                        │      │
│   ├──────────────────────────────────────────────────────┤      │
│   │  Section 2 — High-Level Scope                         │      │
│   │  ...                                                  │      │
│   └──────────────────────────────────────────────────────┘      │
│                                                                  │
│   [Accept All & Create PRD]  [Back to Input]                     │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼  POST /api/prd (with pre-filled sections)
┌──────────────────────────────────────────────────────────────────┐
│   Existing PRD Editor (v1 — unchanged)                           │
│   Sections pre-populated with accepted AI content                │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow — Conversational Mode (All-in-one)

```
User selects "Conversational" tab → pastes text OR uploads document
        │
        ▼
Frontend → POST /api/ai/parse { rawText, format }
        │
        ▼
NestJS extracts text (if file: PDF/DOCX → text) → forwards to Python
        │
        ▼
FastAPI /parse → GPT-4.5 with PRD-Template structure as system prompt
        │
        ▼
Returns: { sections: { 1: {...}, 2: {...}, ..., 22: {...} }, gaps: [...] }
        │
        ▼
Frontend renders Diff/Review screen → User accepts/edits/skips per section
        │
        ▼
Frontend → POST /api/prd { prdCode, productName, ... }
        │
        ▼
Frontend → PUT /api/prd/:id/section/:num (for each accepted section)
        │
        ▼
Redirect to /prd/:id/edit (existing editor, sections pre-filled)
```

### Data Flow — Conversational Mode (Interactive)

```
User selects "Interactive" mode → pastes text OR uploads document
        │
        ▼
Frontend → POST /api/ai/parse { rawText, format }
        │
        ▼
FastAPI parses → returns partial sections + gap list
        │
        ▼
Frontend renders Chat UI: "I found gaps in these sections: ..."
        │
        ▼
User answers gap questions → POST /api/ai/gap-check { sections, answers }
        │
        ▼
FastAPI updates sections, identifies remaining gaps
        │
        ▼  (repeat until no gaps)
Frontend renders Diff/Review screen → same as all-in-one
```

### File Upload — Text Extraction

| Format | Library | Approach |
|--------|---------|----------|
| PDF | `pdf-parse` (Node.js) | Extract text from all pages |
| DOCX | `mammoth` (Node.js) | Convert to plain text |
| MD | Native | Read as UTF-8 string |
| TXT | Native | Read as UTF-8 string |

File processing happens in the NestJS backend — the Python AI service only receives extracted text.

## Key Screen Layouts

### 1. Create PRD — Conversational Tab

```
[Structured Form]  |  [✦ Conversational]
──────────────────────────────────────────

Mode:  (●) All-in-one    ( ) Interactive

┌────────────────────────────────────────┐
│  Describe your product or paste your   │
│  requirements below:                   │
│                                        │
│  [                                     │
│   Large textarea...                    │
│                                        │
│  ]                                     │
└────────────────────────────────────────┘

— OR —

┌────────────────────────────────────────┐
│  📎 Drop a file here or click to       │
│     browse                             │
│     (PDF, DOCX, MD, TXT — max 10 MB)  │
└────────────────────────────────────────┘

[ ✨ Generate PRD Draft ]
```

### 2. Interactive Mode — Chat Area (below input)

```
┌────────────────────────────────────────┐
│ 🤖 AI: I've analysed your input and   │
│    identified the following gaps:      │
│                                        │
│    Section 5 — Actors:                 │
│    ❓ Are there admin roles beyond     │
│       the end user?                    │
│                                        │
│    Section 7 — Integrations:           │
│    ❓ Which payment providers?         │
│                                        │
│    Section 10 — NFRs:                  │
│    ❓ Any uptime or latency targets?   │
│                                        │
│ You: [Type your answers here...    ]   │
│      [Send]                            │
└────────────────────────────────────────┘
```

### 3. Review/Diff Screen

```
PRD Draft Review — 18 of 22 sections populated

┌─ Section 1 — Overview / Objective ──────┐
│ "This product is a peer-to-peer luggage  │
│  storage marketplace that connects       │
│  travellers with verified local hosts..." │
│                                          │
│ [✓ Accept]  [✏ Edit]  [✗ Skip]          │
└──────────────────────────────────────────┘

┌─ Section 2 — High-Level Scope ──────────┐
│ • User registration and verification     │
│ • Location-based host search             │
│ • Booking and payment processing         │
│ • Reviews and ratings                    │
│                                          │
│ [✓ Accept]  [✏ Edit]  [✗ Skip]          │
└──────────────────────────────────────────┘

...

┌─ Section 7 — Integrations ─── ⚠ GAP ───┐
│ TBD — Integration details not provided   │
│ in the source document.                  │
│                                          │
│ [✏ Fill Manually]  [✗ Skip]             │
└──────────────────────────────────────────┘

Progress: ████████████████░░░░ 82% sections populated

[Accept All & Create PRD]     [← Back to Input]
```

## Out of Scope (v2 — deferred to v3+)

- Audio/voice input (speech-to-text for verbal descriptions)
- Multi-document merge (uploading 2+ documents and combining them)
- Real-time collaborative editing of conversational input
- Version comparison between AI drafts
- Template customization (using non-standard PRD templates)
- Auto-save of conversational input mid-session
- EPIC / User Story generation from the completed PRD
- Export to Word / Confluence

## Dependencies

- All v1 infrastructure (Next.js frontend, NestJS backend, Python FastAPI, PostgreSQL)
- OpenAI API key (GPT-4.5 — for both /parse and /gap-check endpoints)
- `Master-Documents/PRD-Template.md` — section structure used as AI system prompt context
- `Master-Documents/PRD-Template-Checklist.md` — gap analysis rules used in /gap-check
- npm packages: `pdf-parse` (PDF text extraction), `mammoth` (DOCX text extraction)
- npm package: `multer` or NestJS `@nestjs/platform-express` file upload (already available)

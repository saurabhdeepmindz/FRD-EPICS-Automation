# Sprint v1 — PRD: PRD Generator Web Application

## Overview

Build the foundational responsive web application that guides Business Analysts and techno-functional professionals through creating a complete 22-section PRD. The application presents a structured, wizard-style UI (left-side section menu + top stepper) backed by an AI layer (OpenAI GPT) that auto-suggests content when a user leaves a field blank. At completion the user can view the full PRD inline and download it as a formatted PDF with a hyperlinked Table of Contents.

## Goals

- User can navigate all 22 PRD sections via a left sidebar menu and a top stepper that tracks completion status
- Each section renders its fields as a structured form; AI suggests values automatically when a field is left empty
- Completed sections are visually distinguished (stepper + sidebar badge)
- User can preview the full assembled PRD in a rich in-app viewer
- User can download the PRD as a PDF with a hyperlinked TOC

## User Stories

- As a Business Analyst, I want a guided form for each PRD section so that I never miss a required field
- As a BA, I want AI to suggest content when I don't know what to write, so that I can move forward without getting blocked
- As a BA, I want a top stepper to see which sections I've completed at a glance, so that I can track my progress
- As a BA, I want to preview the final PRD before downloading, so that I can review it holistically
- As a BA, I want to download the PRD as a PDF with a linked TOC, so that I can share it with stakeholders

## Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui |
| Backend API | NestJS (Node.js) — REST API |
| AI Service | Python (FastAPI microservice) — OpenAI GPT-4.5 reasoning model |
| Database | PostgreSQL (via Prisma ORM on NestJS side) |
| PDF Generation | React-PDF / Puppeteer (server-side) |
| Auth | TBD (v2 sprint) — v1 uses a single-user session |

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Next.js)                         │
│                                                             │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │  Left Sidebar│  │       Main Content Area              │  │
│  │  (22 Section │  │  ┌──────────────────────────────┐   │  │
│  │   Nav Menu) │  │  │  Top Stepper (22 steps)       │   │  │
│  │             │  │  │  ● ● ○ ○ ○ ○ ○ ... ○ ○       │   │  │
│  │  § 1 ✓      │  │  └──────────────────────────────┘   │  │
│  │  § 2 ✓      │  │  ┌──────────────────────────────┐   │  │
│  │  § 3 ○      │  │  │  Sub-tabs (section modules)  │   │  │
│  │  ...        │  │  └──────────────────────────────┘   │  │
│  │  § 22 ○     │  │  ┌──────────────────────────────┐   │  │
│  └─────────────┘  │  │  Section Form Fields          │   │  │
│                   │  │  + AI Suggest Button per field│   │  │
│                   │  └──────────────────────────────┘   │  │
│                   └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌────────────────┐        ┌─────────────────────┐
│  NestJS API    │        │  Python AI Service   │
│  (REST)        │◄──────►│  (FastAPI)           │
│                │        │  OpenAI GPT-4.5      │
│  - PRD CRUD    │        │  - Field suggestion  │
│  - PDF export  │        │  - Gap analysis      │
│  - Validation  │        └─────────────────────┘
└───────┬────────┘
        │
        ▼
┌────────────────┐
│  PostgreSQL    │
│  (PRD data,    │
│   section      │
│   state,       │
│   drafts)      │
└────────────────┘
```

### Data Flow — AI Suggestion

```
User leaves field blank → clicks "Suggest" (or auto-trigger on blur)
        │
        ▼
Next.js → POST /api/ai/suggest { section, field, context }
        │
        ▼
NestJS → forwards to Python FastAPI /suggest
        │
        ▼
FastAPI → OpenAI GPT-4.5 (reasoning) → returns suggested text
        │
        ▼
Field pre-filled in UI (editable) + highlighted as "AI Suggested"
```

### PRD Section Navigation Model

- Each of the 22 PRD sections maps to a **left sidebar item** and a **stepper step**
- Sections with sub-modules (e.g., Section 6 with 13 sub-modules, Section 10 with 7 NFR sub-sections) render **sub-tabs** below the stepper
- A section is marked **Complete** when all required fields have a non-empty value
- Completion state persisted in PostgreSQL per PRD document

## Key Screen Layouts

### 1. PRD Editor (Main Workspace)
```
[Top Stepper: 1●  2●  3○  4○  ...  22○]
[Sub-tabs: 6.1 Auth | 6.2 KYC | 6.3 Listings | ...]  ← visible only for multi-module sections

[Left Sidebar]  |  [Section Form]
§1 Overview ✓  |  Section 3 — Out of Scope
§2 Scope    ✓  |  ┌─────────────────────────────────┐
§3 OOS      ─  |  │ Out of Scope Items               │
§4 Assumpt  ○  |  │ [+ Add Item]  [✨ AI Suggest]    │
...            |  │                                  │
§22 Misc    ○  |  │ Item 1: [text field         ]    │
               |  │ Item 2: [text field         ]    │
               |  └─────────────────────────────────┘
               |  [← Previous]          [Save & Next →]
```

### 2. PRD Preview (Full Document View)
- Renders assembled PRD in styled markdown/HTML
- Left TOC panel with anchor links to each section
- "Download PDF" button top-right

### 3. PDF Output
- Cover page (PRD ID, Product Name, Version, Status, Date)
- TOC with clickable section hyperlinks
- All 22 sections formatted

## Out of Scope (v1 — deferred to v2+)

- User authentication and multi-user collaboration
- Version history / diff view for PRD edits
- EPIC / User Story generation from the PRD
- RTM (Requirements Traceability Matrix) generation
- Real-time auto-save (v1 uses explicit Save button)
- Export to Word / Confluence
- PRD sharing via link or email
- Role-based access (Author / Reviewer / Approver)
- Mobile native app

## Dependencies

- OpenAI API key (provided by client — GPT-4.5 reasoning model)
- PostgreSQL instance (local Docker for v1 dev)
- PRD Template logic sourced from: `Master-Documents/PRD-Template.md` and `Master-Documents/PRD-Template-Checklist.md`
- AI suggestion prompts derived from `skill-01-create-prd` section guidelines

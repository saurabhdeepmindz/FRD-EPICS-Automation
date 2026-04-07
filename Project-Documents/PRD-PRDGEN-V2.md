# Product Requirements Document (PRD)

> **Document Flow:** **PRD** → BRD → FRD → Initiative → EPICs → User Stories → Tasks → Subtasks

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRD ID          : PRD-PRDGEN-V2
Product Name    : PRD Generator (placeholder — final brand TBD)
Version         : 2.0
Created Date    : 07-Apr-2026
Last Updated    : 07-Apr-2026
Author          : Saurabh Verma / Product Owner
Reviewed By     : TBD — CEO review scheduled 08-Apr-2026
Approved By     : TBD — pending CEO demo
Status          : Draft
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Table of Contents

| # | Section |
|---|---------|
| 1 | Overview / Objective |
| 2 | High-Level Scope |
| 3 | Out of Scope |
| 4 | Assumptions and Constraints |
| 5 | Actors / User Types |
| 6 | Functional Requirements |
| 7 | Integration Requirements |
| 8 | Customer Journeys / Flows |
| 9 | Functional Landscape |
| 10 | Non-Functional Requirements |
| 11 | Technology |
| 12 | DevOps and Observability |
| 13 | UI/UX Requirements |
| 14 | Branding Requirements |
| 15 | Compliance Requirements |
| 16 | Testing Requirements |
| 17 | Key Deliverables |
| 18 | Receivables |
| 19 | Environment |
| 20 | High-Level Timelines |
| 21 | Success Criteria |
| 22 | Miscellaneous Requirements |
| — | Revision History |

---

## 1. Overview / Objective of the Application

### PRODUCT NAME
PRD Generator (placeholder — final market-facing brand name TBD by Product Owner)

### BUSINESS CONTEXT
Business Analysts and techno-functional professionals currently spend 5–10 working days to create a Product Requirements Document from scratch. Many customers and early-stage teams do not have a dedicated BA — the product owner or founder acts as the BA, working from rough meeting notes, an idea sketch, or a verbal product vision. They lack the experience and know-how to convert ideation-phase requirements into a structured, comprehensive PRD that development teams can act on. This results in incomplete requirements, missed sections, scope creep, and rework.

As of April 2026, there is no widely available tool in the market that combines a structured 22-section PRD template with AI-powered content generation and iterative gap analysis. The current alternatives are static Word/Google Docs templates that offer no guidance, no validation, and no intelligence.

### OBJECTIVE
The PRD Generator is a web-based application that guides users — whether experienced BAs or first-time product owners — through creating a complete, professional 22-section PRD. Version 2 adds a **Conversational PRD Creation** mode where users can paste raw text, upload existing documents (BRD, SOW, meeting notes in PDF/DOCX/MD/TXT format), or answer guided questions. The AI layer (OpenAI GPT-4.5) parses the input, identifies gaps using a standardised PRD completeness checklist, asks follow-up questions, and auto-populates all 22 sections. Users review a diff screen before committing the AI-generated content to the editor.

This is positioned as a **game-changing consultancy tool** — it hand-holds customers and BAs through the PRD creation process, providing the same guidance a senior product manager would give.

### VALUE DELIVERED
- **Customers / Non-BA users**: Can transform a rough idea or meeting notes into a professional PRD in under 30 minutes, without PRD authoring experience
- **Business Analysts**: Reduce PRD creation time from 10 days to < 30 minutes; AI fills gaps they might miss
- **Business**: Launch a market-differentiating product that positions the company as an AI-powered consultancy platform
- **Quality**: Every PRD is validated against a 200+ item completeness checklist, ensuring no section is missed

### FOUNDATION FOR DOWNSTREAM DOCUMENTS
This PRD forms the input for:
- BRD-PRDGEN-V2 — Business justification for the conversational feature
- FRD-PRDGEN-V2 — Detailed functional specifications
- INIT-PRDGEN — PRD Generator Initiative
- EPIC-CONV-001 to EPIC-CONV-005 — Conversational Input, Document Parsing, Gap Analysis, Review/Diff, Settings

---

## 2. High-Level Scope

The v2 release covers the following functional areas **in addition to** all v1 capabilities (structured form editor, sidebar/stepper navigation, AI field suggestions, preview, PDF export, dashboard):

```
┌──────────────────────────────────────────────────────────────────────────┐
│  AREA                          │  CAPABILITIES INCLUDED                  │
├──────────────────────────────────────────────────────────────────────────┤
│  Conversational Input          │  Raw text paste input                    │
│                                │  File upload (PDF, DOCX, MD, TXT)       │
│                                │  Mode toggle: All-in-one / Interactive   │
│                                │  Tabbed UI alongside structured form    │
├──────────────────────────────────────────────────────────────────────────┤
│  AI Document Parsing           │  Text extraction from PDF/DOCX           │
│                                │  AI-powered parse to 22-section JSON    │
│                                │  Streaming token response               │
├──────────────────────────────────────────────────────────────────────────┤
│  Gap Analysis                  │  Checklist-based gap identification      │
│                                │  Interactive chat for follow-up Q&A     │
│                                │  Iterative section refinement           │
├──────────────────────────────────────────────────────────────────────────┤
│  Review / Diff Screen          │  Per-section Accept / Edit / Skip       │
│                                │  Progress bar (% sections populated)    │
│                                │  Commit to PRD editor                   │
├──────────────────────────────────────────────────────────────────────────┤
│  Admin Settings                │  Rate limit configuration               │
│                                │  Max file size configuration            │
│                                │  AI model parameters                    │
│                                │  Concurrent user limits                 │
├──────────────────────────────────────────────────────────────────────────┤
│  PRD Template Reference        │  In-app viewable PRD template           │
│                                │  Section guidance for BAs/customers     │
└──────────────────────────────────────────────────────────────────────────┘
```

**DELIVERY PHASING:**
- Phase 1 (v2 — current): Conversational Input, AI Parsing, Gap Analysis, Review/Diff, Admin Settings, Template Reference
- Phase 2 (v3): Reviewer/Approver roles, comments, multi-user collaboration
- Phase 3 (v4): EPIC/User Story generation from PRD, RTM generation, export to Word/Confluence

---

## 3. Out of Scope

| # | Excluded Item / Capability | Reason / Where Handled |
|---|---------------------------|------------------------|
| 1 | Audio/voice input (speech-to-text) | Phase 3 — requires speech API integration |
| 2 | Multi-document merge (uploading 2+ documents) | Phase 2 — complex reconciliation logic |
| 3 | Reviewer / Approver roles with comments | Phase 3 (v3) — confirmed by Product Owner |
| 4 | EPIC / User Story generation from PRD | Phase 3 (v4) — downstream document generation |
| 5 | RTM (Requirements Traceability Matrix) generation | Phase 3 (v4) |
| 6 | Export to Word / Confluence | Phase 2 |
| 7 | Google Drive / SharePoint file import | Phase 2 — local upload only for v2 |
| 8 | Real-time collaborative editing | Phase 3 — requires WebSocket infrastructure |
| 9 | Multi-language / internationalisation | Not in roadmap for FY2026 |
| 10 | Mobile native app | Web-only; responsive web covers mobile use |
| 11 | User authentication / multi-tenant | Phase 3 — v2 uses single-user session |
| 12 | Version comparison between AI drafts | Phase 2 |
| 13 | Template customisation (non-standard PRD templates) | Phase 3 |
| 14 | Auto-save of conversational input mid-session | Phase 2 |

---

## 4. Assumptions and Constraints

### 4A. ASSUMPTIONS

| # | Assumption | Owner | Validation Date | Risk if False |
|---|-----------|-------|----------------|---------------|
| A1 | OpenAI GPT-4.5 API is available and supports 15,000+ token inputs | Delivery Team | 07-Apr-2026 | Must switch to GPT-4o or chunk input; delays parsing feature |
| A2 | Customers will provide requirements in English | Product Owner | 07-Apr-2026 | Multi-language support needed; out of scope for v2 |
| A3 | PDF and DOCX files contain extractable text (not scanned images) | Product Owner | Ongoing | OCR integration needed; out of scope for v2 |
| A4 | A single admin user manages system-wide settings | Product Owner | 07-Apr-2026 | RBAC needed if multiple admins; deferred to v3 |
| A5 | CEO demo environment is local Docker on developer machine | Product Owner | 08-Apr-2026 | Cloud deployment needed if demo is remote |
| A6 | Uploaded documents do not contain malicious content | Delivery Team | Ongoing | File scanning/antivirus needed for production |
| A7 | Rate limit of 20 parses/hour is sufficient for initial launch | Product Owner | Post-launch | May need to increase based on usage patterns |

### 4B. CONSTRAINTS

| # | Constraint | Type | Impact on Design / Delivery |
|---|-----------|------|----------------------------|
| C1 | Delivery must be completed within hours (CEO demo 08-Apr-2026 morning) | Timeline | Aggressive task prioritisation; P2 tasks may be deferred |
| C2 | Local Docker deployment only (no cloud for v2) | Technical | No load balancer, CDN, or managed services |
| C3 | Single-user session (no auth) | Technical | No RBAC, no per-user settings, no audit trail per user |
| C4 | OpenAI API key must be provided by the deploying user | Operational | Cannot ship with embedded key; must be configurable |
| C5 | Maximum file upload size: 20 MB | Technical | Large files must be rejected with clear error message |
| C6 | Budget: Minimal — open-source stack only | Budget | No licensed dependencies; no paid monitoring tools |

---

## 5. Actors / User Types

### 5A. Actor Summary Table

| Actor ID | Actor Name | Type | Channel | Frequency |
|----------|-----------|------|---------|-----------|
| ACT-01 | Business Analyst (BA) | Human | Web Browser | Daily |
| ACT-02 | Customer / Product Owner | Human | Web Browser | Weekly |
| ACT-03 | System Administrator | Human | Web Browser | Occasional |
| ACT-04 | OpenAI GPT-4.5 | System | REST API | Per-request |
| ACT-05 | PRD Generator Backend | System | Internal | Always-on |

### 5B. Actor Detail Blocks

**ACT-01: Business Analyst (BA)**
- **Description**: Experienced BA who uses the tool daily to create PRDs for multiple projects. Familiar with PRD structure.
- **Goals**: Create complete PRDs faster; use AI to fill sections they're unsure about; ensure checklist compliance.
- **Permissions**: Create PRD, edit PRD, use conversational mode, upload documents, preview, download PDF, delete own PRDs.
- **Restrictions**: Cannot modify system settings. Cannot access admin panel.
- **Authentication**: None (v2 — single-user session). Auth planned for v3.

**ACT-02: Customer / Product Owner**
- **Description**: Non-technical user in ideation phase. May not have BA experience. Has rough meeting notes or a product idea. Needs hand-holding through the PRD process.
- **Goals**: Transform a rough idea into a professional PRD without knowing PRD structure. Get consultancy-level guidance from the AI.
- **Permissions**: Same as BA (no role distinction in v2).
- **Restrictions**: Cannot modify system settings. Cannot access admin panel.
- **Authentication**: None (v2).

**ACT-03: System Administrator**
- **Description**: Internal admin who configures system-wide settings (rate limits, file size limits, AI parameters).
- **Goals**: Manage operational parameters without code changes.
- **Permissions**: Access admin settings page. Configure rate limits, file size, AI model, concurrent user limits.
- **Restrictions**: Cannot delete other users' PRDs (no multi-user in v2). Settings are system-wide only.
- **Authentication**: None (v2 — access via direct URL). Auth planned for v3.

---

## 6. Functional Requirements

### 6.1 Module: Conversational Input (EPIC-CONV-001)

**Module Description**: Enables users to provide raw requirements via text paste or file upload, with a choice of AI processing mode.

| FR-ID | Feature Name | Description | Priority |
|-------|-------------|-------------|----------|
| FR-CONV-001 | Tabbed Creation UI | The system shall display two tabs ("Structured Form" and "Conversational") on the /prd/new page. Switching tabs shall preserve form state. | P0 |
| FR-CONV-002 | Raw Text Input | The system shall accept raw text input up to 15,000 characters in a resizable textarea. | P0 |
| FR-CONV-003 | File Upload | The system shall accept file uploads in PDF, DOCX, MD, and TXT formats up to 20 MB. Unsupported formats shall be rejected with error "Unsupported file format. Please upload PDF, DOCX, MD, or TXT." | P0 |
| FR-CONV-004 | Mode Toggle | The system shall display a mode toggle with two options: "All-in-one" (default) and "Interactive". | P0 |
| FR-CONV-005 | File Text Extraction | The system shall extract plain text from uploaded PDF files using pdf-parse and from DOCX files using mammoth. MD and TXT files shall be read as UTF-8 strings. | P0 |

**Business Rules:**
| BR-ID | Rule | Testable Criteria |
|-------|------|-------------------|
| BR-CONV-001 | Files exceeding 20 MB shall be rejected before upload completes | Upload attempt with 21 MB file → error displayed within 1 second |
| BR-CONV-002 | Only one input method active at a time (text OR file, not both) | Uploading a file clears the text area; typing text removes the uploaded file |
| BR-CONV-003 | Empty input shall not trigger AI parsing | "Generate PRD Draft" button disabled when both text area and file upload are empty |

### 6.2 Module: AI Document Parsing (EPIC-CONV-002)

**Module Description**: AI service that parses raw text into structured 22-section PRD JSON output.

| FR-ID | Feature Name | Description | Priority |
|-------|-------------|-------------|----------|
| FR-PARSE-001 | Parse Endpoint | The system shall expose POST /api/ai/parse accepting { text, mode } and returning { sections: {1: {...}, ..., 22: {...}}, gaps: [...] }. | P0 |
| FR-PARSE-002 | Streaming Response | The system shall stream AI response tokens progressively to the frontend so users see content appearing in real-time. | P0 |
| FR-PARSE-003 | Section Structure | The AI shall output content keyed to all 22 PRD sections using the field keys defined in section-fields.ts. | P0 |
| FR-PARSE-004 | Gap Identification | The AI shall identify sections it cannot populate from the input and return them as a gaps array with section number and question. | P0 |

**Business Rules:**
| BR-ID | Rule | Testable Criteria |
|-------|------|-------------------|
| BR-PARSE-001 | Parse must complete within 30 seconds for text up to 15,000 characters | Timer test with 15,000 char input → response within 30s |
| BR-PARSE-002 | Rate limit: 20 parses per hour per session (configurable via admin settings) | 21st parse within 1 hour → HTTP 429 "Rate limit exceeded" |

### 6.3 Module: Gap Analysis (EPIC-CONV-003)

**Module Description**: Interactive gap-filling flow using the PRD-Template-Checklist as the validation backbone.

| FR-ID | Feature Name | Description | Priority |
|-------|-------------|-------------|----------|
| FR-GAP-001 | Gap Check Endpoint | The system shall expose POST /api/ai/gap-check accepting { sections, answers } and returning { updatedSections, remainingGaps, gapCount }. | P1 |
| FR-GAP-002 | Chat UI | In Interactive mode, the system shall display a scrollable chat area showing AI-identified gaps grouped by section. User can type answers and send. | P1 |
| FR-GAP-003 | Iterative Refinement | Each "Send" in the chat shall call /api/ai/gap-check, update sections, and show remaining gaps. Loop until gapCount = 0 or user chooses to proceed. | P1 |
| FR-GAP-004 | Gap Badge | The system shall display a badge showing remaining gap count (e.g., "5 gaps remaining") that updates in real-time. | P1 |

**Business Rules:**
| BR-ID | Rule | Testable Criteria |
|-------|------|-------------------|
| BR-GAP-001 | User can proceed to review even with remaining gaps | "Proceed to Review" button visible regardless of gap count |
| BR-GAP-002 | Gap check uses PRD-Template-Checklist rules as validation context | System prompt includes checklist items for gap evaluation |

### 6.4 Module: Review / Diff Screen (EPIC-CONV-004)

**Module Description**: Per-section review screen allowing users to accept, edit, or skip AI-generated content before committing to the PRD.

| FR-ID | Feature Name | Description | Priority |
|-------|-------------|-------------|----------|
| FR-REV-001 | Section Review Cards | The system shall display all 22 sections with AI-generated content. Each card shows Accept, Edit, and Skip buttons. | P1 |
| FR-REV-002 | Inline Editing | Clicking "Edit" on a section shall open an inline textarea allowing the user to modify AI content before accepting. | P1 |
| FR-REV-003 | Progress Bar | The system shall display a progress bar showing "X of 22 sections accepted" with percentage. | P1 |
| FR-REV-004 | Accept All & Create | Clicking "Accept All & Create PRD" shall create the PRD via POST /api/prd, then PUT each accepted section, then redirect to /prd/:id/edit. | P1 |
| FR-REV-005 | Gap Indicator | Sections with no AI content shall show "GAP — not found in source" with a "Fill Manually" button. | P1 |
| FR-REV-006 | AI Suggested Flag | All sections committed from the review screen shall have aiSuggested = true in the database. | P1 |

**Business Rules:**
| BR-ID | Rule | Testable Criteria |
|-------|------|-------------------|
| BR-REV-001 | Skipped sections remain NOT_STARTED in the editor | Create PRD via review with Section 7 skipped → Section 7 status = NOT_STARTED |
| BR-REV-002 | At least prdCode and productName must be provided before committing | "Accept All & Create PRD" disabled until prdCode and productName fields are filled |

### 6.5 Module: Admin Settings (EPIC-CONV-005)

**Module Description**: System-wide configuration page for operational parameters.

| FR-ID | Feature Name | Description | Priority |
|-------|-------------|-------------|----------|
| FR-SET-001 | Settings Page | The system shall expose /settings page accessible to admin users. | P1 |
| FR-SET-002 | Rate Limit Config | Admin can configure the maximum number of AI parse calls per hour (default: 20). | P1 |
| FR-SET-003 | File Size Config | Admin can configure the maximum upload file size in MB (default: 20). | P1 |
| FR-SET-004 | AI Model Config | Admin can configure the OpenAI model name (default: gpt-4.5-preview) and temperature (default: 0.4). | P1 |
| FR-SET-005 | Concurrent Users Config | Admin can configure the maximum concurrent users target (default: 15). | P1 |
| FR-SET-006 | Uptime Target Config | Admin can configure the uptime SLA percentage target (default: 90%). | P2 |
| FR-SET-007 | Settings Persistence | Settings shall be persisted in the database and loaded on service startup. | P1 |

### 6.6 Module: PRD Template Reference (EPIC-CONV-006)

**Module Description**: In-app reference page showing the PRD template structure as a guide for BAs and customers.

| FR-ID | Feature Name | Description | Priority |
|-------|-------------|-------------|----------|
| FR-TPL-001 | Template Reference Page | The system shall expose /templates page rendering the PRD-Template.md as styled HTML. | P2 |
| FR-TPL-002 | Section Guidance | Each section in the template shall show guidance text explaining what information is expected. | P2 |
| FR-TPL-003 | Link from Conversational Tab | The conversational tab shall include a "View PRD Template Guide" link to the /templates page. | P2 |

---

## 7. Integration Requirements

### 7A. Integration Summary Table

| INT-ID | System | Type | Direction | Owner | Priority | API Contract |
|--------|--------|------|-----------|-------|----------|-------------|
| INT-001 | OpenAI GPT-4.5 API | REST API | Outbound | Delivery Team | High | Available |
| INT-002 | Python FastAPI AI Service | REST API (internal) | Bidirectional | Delivery Team | High | Available (v1) |

### 7B. Integration Detail Blocks

**INT-001: OpenAI GPT-4.5 API**
- **Data Sent**: Raw text (up to 15,000 chars), system prompts (PRD template structure, checklist rules)
- **Data Received**: Structured JSON with 22 section content + gap list
- **Authentication**: API key via environment variable (never exposed to browser)
- **SLA / Timeout**: 30 seconds; circuit breaker after 3 consecutive failures
- **Error Handling**: 401 → "AI service authentication error"; 429 → "Rate limit exceeded — retry in X seconds"; 502 → "AI service unavailable"
- **Features Using**: FR-PARSE-001, FR-GAP-001, FR-CONV-002 (existing /suggest)

**INT-002: Python FastAPI AI Service (Internal)**
- **Data Sent**: Extracted text, section data, user answers
- **Data Received**: Parsed sections JSON, gap analysis results, suggestions
- **Authentication**: Internal network (no auth — services co-located)
- **SLA / Timeout**: 30 seconds
- **Error Handling**: NestJS proxy maps FastAPI errors to appropriate HTTP status codes
- **Features Using**: All AI-related features

---

## 8. Customer Journeys / Flows

### Journey 1: First-Time User Creates PRD via Conversational Mode (All-in-one)

**Actor**: Customer / Product Owner (ACT-02) — no PRD experience
**Goal**: Transform rough meeting notes into a complete PRD
**Trigger**: User clicks "Create New PRD" from landing page or dashboard

**Happy Path:**
1. User lands on /prd/new page
2. User sees two tabs: "Structured Form" and "Conversational"
3. User clicks "Conversational" tab
4. User selects "All-in-one" mode (default)
5. User pastes meeting notes into the textarea (or uploads a PDF)
6. User clicks "Generate PRD Draft"
7. System shows "Analysing your input..." with streaming progress
8. System displays review screen with 22 sections populated
9. User reviews each section — accepts most, edits 3, skips 2
10. User fills in prdCode and productName fields
11. User clicks "Accept All & Create PRD"
12. System creates PRD and redirects to editor
13. User reviews pre-filled sections in the editor, makes final adjustments
14. User clicks "Preview" to see the full document
15. User clicks "Download PDF" to share with stakeholders

**Alternate Path — File Upload:**
- At step 5, user drags a PDF file onto the dropzone
- System extracts text and proceeds to step 6

**Exception Path — AI Service Unavailable:**
- At step 7, AI service returns 502
- System shows toast: "AI service temporarily unavailable. Please try again."
- User can retry or switch to structured form tab

### Journey 2: Experienced BA Uses Interactive Mode with Gap Analysis

**Actor**: Business Analyst (ACT-01)
**Goal**: Create a thorough PRD with AI-assisted gap filling
**Trigger**: BA has partial requirements and wants AI to identify what's missing

**Happy Path:**
1. BA navigates to /prd/new → Conversational tab
2. BA selects "Interactive" mode
3. BA pastes partial requirements text
4. BA clicks "Generate PRD Draft"
5. System parses input and shows initial sections + gap list in chat area
6. AI message: "I found gaps in Sections 5, 7, 10, 15. Section 5: Are there admin roles beyond the end user?"
7. BA types answers to gap questions
8. BA clicks "Send"
9. System calls /gap-check, updates sections, shows remaining gaps
10. Steps 6-9 repeat until BA is satisfied (or gap count = 0)
11. BA clicks "Proceed to Review"
12. Review screen shows all 22 sections with AI + user-provided content
13. BA accepts all, creates PRD, lands in editor

**Exception Path — Rate Limit:**
- At step 4 or 8, user has exceeded 20 parses/hour
- System shows: "Rate limit reached (20/hour). Please wait X minutes or contact admin."

### Journey 3: Admin Configures System Settings

**Actor**: System Administrator (ACT-03)
**Goal**: Adjust operational parameters
**Trigger**: Admin needs to change rate limits or file size limits

**Happy Path:**
1. Admin navigates to /settings
2. Admin sees current values for: rate limit, max file size, AI model, temperature, concurrent users, uptime target
3. Admin modifies rate limit from 20 to 30
4. Admin clicks "Save Settings"
5. System persists changes and shows success toast
6. New rate limit takes effect immediately

---

## 9. Functional Landscape

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER-FACING LAYER                         │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Landing Page  │  │  Dashboard   │  │  Templates   │              │
│  │ (marketing)   │  │  (PRD list)  │  │  (reference) │              │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘              │
│         │                 │                                          │
│  ┌──────▼─────────────────▼────────────────────────────────────┐    │
│  │              PRD Creation (Tabbed)                           │    │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐   │    │
│  │  │ Structured Form │  │ Conversational                   │   │    │
│  │  │ (v1 — unchanged)│  │ ┌─Text Paste / File Upload──┐   │   │    │
│  │  │                 │  │ │ Mode: All-in-one/Interactive│   │   │    │
│  │  │                 │  │ └────────────────────────────┘   │   │    │
│  │  │                 │  │ ┌─Chat Area (Interactive)────┐   │   │    │
│  │  │                 │  │ │ Gap Q&A                     │   │   │    │
│  │  │                 │  │ └────────────────────────────┘   │   │    │
│  │  └─────────────────┘  └─────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│  ┌──────▼──────────────────────────────────────────────────────┐    │
│  │              Review / Diff Screen                           │    │
│  │  22 sections × (Accept / Edit / Skip) → Create PRD         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│  ┌──────▼──────────────────────────────────────────────────────┐    │
│  │              PRD Editor (v1 — unchanged)                    │    │
│  │  Sidebar + Stepper + Section Forms + AI Suggest             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│  ┌──────▼──────────┐  ┌──────────────┐                              │
│  │  PRD Preview    │  │  PDF Export   │                              │
│  └─────────────────┘  └──────────────┘                              │
└──────────────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      PLATFORM / API LAYER                            │
│                                                                      │
│  NestJS Backend (port 4000)                                          │
│  ├── PrdController (CRUD — v1 unchanged)                             │
│  ├── AiController (/suggest, /parse NEW, /gap-check NEW)            │
│  ├── ExportController (PDF — v1 unchanged)                           │
│  ├── UploadController (file extract NEW)                             │
│  ├── SettingsController (admin config NEW)                           │
│  └── PrismaService (PostgreSQL)                                      │
└──────────────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌────────────────────┐  ┌──────────────────────────────────────────────┐
│  PostgreSQL 16     │  │  Python FastAPI AI Service (port 5000)       │
│  ├── Prd           │  │  ├── POST /suggest (v1 unchanged)            │
│  ├── PrdSection    │  │  ├── POST /parse (NEW)                       │
│  └── Settings NEW  │  │  └── POST /gap-check (NEW)                   │
└────────────────────┘  └──────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │  OpenAI GPT-4.5 API   │
                        └───────────────────────┘
```

---

## 10. Non-Functional Requirements

### 10.1 Security

| NFR-ID | Requirement | Metric | Priority |
|--------|------------|--------|----------|
| NFR-SEC-001 | Data-in-transit encryption | TLS 1.2+ for all HTTP traffic | High |
| NFR-SEC-002 | OpenAI API key never exposed to browser | Key stored in server-side env only; validated by code review | Critical |
| NFR-SEC-003 | File upload validation | Reject files > 20 MB and non-whitelisted MIME types | High |
| NFR-SEC-004 | No hardcoded secrets in source code | Verified by pre-commit scan; .env files in .gitignore | Critical |
| NFR-SEC-005 | OWASP Top 10 mitigation | XSS prevention (HTML escaping), CSRF protection, input validation on all endpoints | High |
| NFR-SEC-006 | Session timeout | Idle session expires after 30 minutes (configurable in v3 with auth) | Medium |

### 10.2 Performance

| NFR-ID | Requirement | Metric | Condition |
|--------|------------|--------|-----------|
| NFR-PERF-001 | API response time (non-AI endpoints) | P95 ≤ 500ms | Normal load (10 concurrent users) |
| NFR-PERF-002 | AI parse response time | ≤ 30 seconds | 15,000 char input, single user |
| NFR-PERF-003 | File upload + extraction time | ≤ 5 seconds | 20 MB PDF |
| NFR-PERF-004 | Page load time | P95 ≤ 3 seconds | 4G mobile connection |
| NFR-PERF-005 | PDF generation time | ≤ 10 seconds | Full 22-section PRD |

### 10.3 Scalability

| NFR-ID | Requirement | Metric |
|--------|------------|--------|
| NFR-SCALE-001 | Concurrent users at launch | 10–15 simultaneous users |
| NFR-SCALE-002 | Stateless backend services | NestJS and FastAPI must be horizontally scalable |
| NFR-SCALE-003 | Database read performance | PostgreSQL handles 100 PRDs with sub-second queries |

### 10.4 Availability and Reliability

| NFR-ID | Requirement | Metric |
|--------|------------|--------|
| NFR-AVAIL-001 | Uptime SLA | 90% (configurable via admin settings) |
| NFR-AVAIL-002 | Health checks | All 3 services expose /health endpoint; Docker restart on failure |
| NFR-AVAIL-003 | Circuit breaker for OpenAI | After 3 consecutive failures, stop calling for 60 seconds |

### 10.5 Compliance

| NFR-ID | Requirement |
|--------|------------|
| NFR-COMP-001 | Uploaded documents stored for audit purposes (no auto-deletion) |
| NFR-COMP-002 | No PII processing in v2 (PRD content is business requirements, not personal data) |
| NFR-COMP-003 | OWASP Top 10 compliance required before production deployment |

### 10.6 Maintainability

| NFR-ID | Requirement | Metric |
|--------|------------|--------|
| NFR-MAINT-001 | Unit test coverage | ≥ 80% for new code |
| NFR-MAINT-002 | Externalised configuration | All thresholds configurable via admin settings, not hardcoded |
| NFR-MAINT-003 | Independent deployability | Each service (frontend, backend, AI) deployable independently |

### 10.7 Audit & Logs

| NFR-ID | Requirement |
|--------|------------|
| NFR-AUDIT-001 | All AI parse and gap-check calls logged with timestamp, input size, response time |
| NFR-AUDIT-002 | File uploads logged with filename, size, format, extraction result |
| NFR-AUDIT-003 | Settings changes logged with before/after values |
| NFR-AUDIT-004 | Uploaded documents retained in filesystem/storage for audit trail |

---

## 11. Technology

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui | MANDATORY (v1 established) |
| Backend API | NestJS 10 (Node.js) | MANDATORY (v1 established) |
| AI Service | Python FastAPI + OpenAI GPT-4.5 | MANDATORY (v1 established) |
| Database | PostgreSQL 16 (via Prisma ORM) | MANDATORY (v1 established) |
| PDF Generation | Puppeteer (headless Chrome) | MANDATORY (v1 established) |
| File Extraction — PDF | pdf-parse (Node.js) | PREFERRED |
| File Extraction — DOCX | mammoth (Node.js) | PREFERRED |
| File Upload | Multer via @nestjs/platform-express | PREFERRED |
| Streaming | Server-Sent Events (SSE) or chunked transfer | PREFERRED |
| Containerisation | Docker + Docker Compose | MANDATORY |

---

## 12. DevOps and Observability

### 12A. CI/CD Pipeline

| Item | Specification | Provided By |
|------|--------------|-------------|
| Source Control | Git (local) | Delivery Team |
| CI Pipeline | Manual (npm run test, npm run build) | Delivery Team |
| Container Registry | Local Docker images | Delivery Team |
| Deployment | docker-compose up --build | Delivery Team |
| Deployment Strategy | Recreate (local dev) | Delivery Team |

### 12B. Monitoring & Observability

| Item | Specification |
|------|--------------|
| Health Checks | GET /health on all 3 services |
| Logging | Console logging (structured JSON in production) |
| Error Tracking | Console error output (Sentry planned for v3) |
| Dashboards | TBD — Delivery Team — target v3 with cloud deployment |

---

## 13. UI/UX Requirements

| UX-ID | Requirement | Testable Criteria |
|-------|------------|-------------------|
| UX-001 | Responsive design | All pages usable at 320px, 768px, 1280px |
| UX-002 | Streaming progress | AI response tokens appear progressively; no blank screen during 30s wait |
| UX-003 | Error messages | Human-readable; no raw error codes shown to users |
| UX-004 | Loading skeletons | All async operations show skeleton or spinner |
| UX-005 | File upload feedback | Upload progress bar; clear error for wrong format/size |
| UX-006 | Accessibility | WCAG 2.1 Level AA for all new components |
| UX-007 | Mode toggle clarity | Clear visual distinction between All-in-one and Interactive modes |
| UX-008 | Review screen usability | Accept/Edit/Skip buttons clearly labelled; progress bar always visible |
| UX-009 | Colour-blind safe | Status indicators use icons + colour (not colour alone) |
| UX-010 | Wireframes | TBD — Product Owner — screen mockups to be created post-v2 for v3 polish |

---

## 14. Branding Requirements

| Item | Specification |
|------|--------------|
| Product Name | PRD Generator (placeholder — final brand TBD by Product Owner) |
| Tagline | TBD — Product Owner |
| Primary Colour | Warm amber-orange (#F97316) — v1 established |
| Secondary Colour | Slate (#1E293B) — v1 established |
| Font | Inter (Google Fonts) — v1 established |
| Icon Library | Lucide React — v1 established |
| Logo | TBD — Product Owner — needed before public launch |
| Favicon | TBD — Product Owner |
| Brand assets are a Receivable from Product Owner (see Section 18, REC-007) |

---

## 15. Compliance Requirements

| COMP-ID | Regulation | Applicability | Key Requirements | Sign-off Owner |
|---------|-----------|---------------|-----------------|----------------|
| COMP-001 | OWASP Top 10 | All web endpoints | Input validation, XSS prevention, secure headers | Delivery Team |
| COMP-002 | Data Retention | Uploaded documents | Documents stored for audit; no auto-deletion | Product Owner |
| COMP-003 | Secret Management | API keys | No hardcoded secrets; env-only configuration | Delivery Team |

Note: GDPR/DPDP not applicable for v2 (no user registration, no PII collection). Will be addressed in v3 when auth is added.

---

## 16. Testing Requirements

| TEST-ID | Test Type | Scope | Tool | Owner | Exit Criteria |
|---------|-----------|-------|------|-------|--------------|
| TEST-001 | Unit Testing | All new services, hooks, utilities | Vitest (frontend), Jest (backend), pytest (AI) | Delivery Team | ≥ 80% coverage on new code |
| TEST-002 | Integration Testing | API endpoints (/parse, /gap-check, /upload, /settings) | Supertest (NestJS) | Delivery Team | All endpoints return expected responses |
| TEST-003 | E2E Testing | Conversational flow, review screen, settings | Playwright | Delivery Team | Critical user journeys pass |
| TEST-004 | File Upload Testing | PDF, DOCX, MD, TXT extraction accuracy | Manual + pytest | Delivery Team | Text extracted matches source content |
| TEST-005 | Performance Testing | AI parse response time | Manual timing | Delivery Team | ≤ 30s for 15,000 char input |
| TEST-006 | Security Testing | File upload validation, XSS, input injection | Manual review | Delivery Team | No vulnerabilities in OWASP Top 10 |

---

## 17. Key Deliverables

| DEL-ID | Deliverable | Format | Produced By | Delivery Phase |
|--------|------------|--------|-------------|---------------|
| DEL-001 | PRD (this document) | Markdown | Product Owner | v2 Planning |
| DEL-002 | Sprint v2 TASKS.md | Markdown | Delivery Team | v2 Planning |
| DEL-003 | Conversational Input UI | Source Code (Git) | Delivery Team | v2 |
| DEL-004 | AI Parse + Gap Check endpoints | Source Code (Git) | Delivery Team | v2 |
| DEL-005 | Review / Diff Screen | Source Code (Git) | Delivery Team | v2 |
| DEL-006 | Admin Settings Page | Source Code (Git) | Delivery Team | v2 |
| DEL-007 | File Upload + Extraction Service | Source Code (Git) | Delivery Team | v2 |
| DEL-008 | PRD Template Reference Page | Source Code (Git) | Delivery Team | v2 |
| DEL-009 | Updated docker-compose.yml | YAML | Delivery Team | v2 |
| DEL-010 | Unit + Integration Tests | Source Code (Git) | Delivery Team | v2 |
| DEL-011 | CEO Demo (08-Apr-2026) | Live walkthrough | Product Owner + Delivery Team | v2 |

---

## 18. Receivables

| REC-ID | Receivable | Why Needed | Provided By | Required By | Risk if Late |
|--------|-----------|-----------|-------------|-------------|-------------|
| REC-001 | OpenAI API key (GPT-4.5 access) | AI parse, gap check, suggest features | Product Owner | 07-Apr-2026 | All AI features blocked |
| REC-002 | Sample requirements document (PDF/DOCX) | Testing file upload + parse flow | Product Owner | 07-Apr-2026 | Cannot verify end-to-end flow |
| REC-003 | CEO demo time slot confirmation | Schedule and logistics | Product Owner | 07-Apr-2026 | Demo may not happen |
| REC-004 | Docker installed on demo machine | Local deployment | Product Owner | 07-Apr-2026 | Cannot deploy |
| REC-005 | Rate limit and settings defaults confirmation | Admin settings initial values | Product Owner | 07-Apr-2026 | Delivered — confirmed in this PRD |
| REC-006 | PRD-Template.md and PRD-Template-Checklist.md | AI system prompts | Product Owner | Already available | N/A |
| REC-007 | Brand assets (logo, favicon) — if available | Branding polish | Product Owner | Pre-public-launch | App uses placeholder branding |
| REC-008 | Final product name decision | Branding | Product Owner | Pre-public-launch | "PRD Generator" used as placeholder |

---

## 19. Environment

### 19A. Environment Table

| Environment | Purpose | Hosted On | Provisioned By | Managed By | Access |
|-------------|---------|-----------|---------------|-----------|--------|
| DEV / LOCAL | Development and CEO demo | Developer machine (Docker) | Delivery Team | Delivery Team | Local only |

### 19B. Environment Details

- **Cloud Provider**: None for v2 (local Docker only)
- **Deployment**: docker-compose up --build on local machine
- **Data Handling**: Dev data only; no real customer data in v2
- **GPU**: Not required (OpenAI API is cloud-hosted)
- **Network**: Localhost only; no VPN or public subnet

---

## 20. High-Level Timelines

### 20A. Milestone Table

| # | Milestone | Target Date | Status | Notes |
|---|----------|-------------|--------|-------|
| M1 | PRD v2 Signed Off | 07-Apr-2026 | Complete | This document |
| M2 | v2 Development Complete | 07-Apr-2026 | In Progress | Same-day delivery |
| M3 | Local Deployment Verified | 07-Apr-2026 | Pending | Docker Compose |
| M4 | CEO Demo | 08-Apr-2026 morning | Pending | Requires REC-001, REC-002, REC-004 |
| M5 | Customer Pilot (first external use) | TBD — Product Owner | Pending | Post-CEO approval |
| M6 | v3 Planning (auth, reviewer roles) | TBD | Pending | |

### 20B. Phase Summary

- **Phase 1 (v1)**: Foundation — monorepo, structured editor, AI suggest, preview, PDF export — COMPLETE
- **Phase 2 (v2)**: Conversational input, AI parsing, gap analysis, review/diff, admin settings — IN PROGRESS
- **Phase 3 (v3)**: Auth, reviewer/approver roles, comments, cloud deployment
- **Phase 4 (v4)**: EPIC/User Story generation, RTM, export to Word/Confluence

### 20C. Sprint Cadence

- Sprint duration: Continuous delivery (v2 is a single-sprint release)
- Release: On completion of all P0 + P1 tasks

---

## 21. Success Criteria

### 21A. Business Success Criteria

| SC-ID | Criterion | Target | Measurement Window | Owner |
|-------|----------|--------|-------------------|-------|
| SC-BIZ-001 | PRD creation time | Reduced from 10 days to < 30 minutes | First 10 PRDs created via conversational mode | Product Owner |
| SC-BIZ-002 | Conversational adoption rate | ≥ 60% of PRDs created via conversational mode (vs structured form) | 30 days post-pilot launch | Product Owner |
| SC-BIZ-003 | CEO approval for pilot | CEO approves product for customer pilot after demo | 08-Apr-2026 | Product Owner |

### 21B. Operational / Technical Success Criteria

| SC-ID | Criterion | Target | Measurement Method |
|-------|----------|--------|-------------------|
| SC-TECH-001 | AI parse success rate | ≥ 90% of parses return valid 22-section JSON | Log analysis |
| SC-TECH-002 | Uptime during demo | 100% during CEO demo window | Manual observation |

### 21C. Hypercare / Go-Live Readiness Gate

- All P0 tasks complete and verified
- At least one end-to-end test: paste text → parse → review → create PRD → preview → download PDF
- Docker Compose starts all services without errors
- OpenAI API key configured and tested
- Sign-off: Product Owner (Saurabh Verma), Delivery Team Lead

---

## 22. Miscellaneous Requirements

### 22A. Raw Input Log

| # | Source | Date | Verbatim Input |
|---|--------|------|---------------|
| 1 | Product Owner (Saurabh Verma) — conversation | 07-Apr-2026 | "BA has a high level view of the requirement or is in the ideation phase, doesn't have the experience or know how of how to create a PRD" |
| 2 | Product Owner — conversation | 07-Apr-2026 | "It is kind of handholding the customers, BA and giving them consultancy also" |
| 3 | Product Owner — conversation | 07-Apr-2026 | "I am launching this as a game changing product in the market" |
| 4 | Product Owner — conversation | 07-Apr-2026 | "Rate limit can be 20 parses per hour per user. It will be great if we can have a settings feature where we can configure these parameters" |
| 5 | Product Owner — conversation | 07-Apr-2026 | "delivery in next couple of hours... I want to show my CEO tomorrow morning" |
| 6 | Product Owner — conversation | 07-Apr-2026 | "The reference document created we should share it on the UI as a template also for a BA or customer to refer" |

### 22B. Structured Miscellaneous Requirements

| MISC-ID | Summary | Classification | Migration Target | EPIC Trace | Owner | Status |
|---------|---------|---------------|-----------------|-----------|-------|--------|
| MISC-001 | Settings page for configurable parameters | Functional | Section 6.5 | EPIC-CONV-005 | Delivery Team | Migrated |
| MISC-002 | PRD template reference page on UI | Functional | Section 6.6 | EPIC-CONV-006 | Delivery Team | Migrated |
| MISC-003 | Streaming token response for AI | NFR / UX | Section 10.2, 13 | EPIC-CONV-002 | Delivery Team | Migrated |

### 22C. Migration Tracker

All MISC items have been migrated to their target sections. Zero items remain as "Pending Migration".

---

## Revision History

| Version | Date | Author | Changes | Approver |
|---------|------|--------|---------|----------|
| 0.1 | 07-Apr-2026 | Saurabh Verma | Initial draft — v2 Conversational PRD Creation | TBD |
| 1.0 | TBD | Saurabh Verma | Baselined after CEO review | TBD |

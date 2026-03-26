# UI/UX Design Brief Completeness Checklist

> **Purpose:** Use this checklist when creating or reviewing a UI/UX Design Brief to ensure
> all six categories are answered completely and correctly before the brief is handed to
> a designer, fed into an AI design tool, or used as input for wireframe and prototype work.
>
> **When to use:**
> - **Author (BA / PO / Product Manager)** — self-review before submitting the brief for design
> - **UX Designer / Design Lead** — review before beginning wireframes or prototypes
> - **Solution Architect** — review before committing to technology or platform choices
> - **Brand / Marketing Stakeholder** — review before visual design begins
> - **Customer / Sponsor** — baseline review before design sprint commences
>
> **Scoring:** Each item is marked as one of:
> - `[ ]` — Not done
> - `[x]` — Complete
> - `[N/A]` — Not applicable (add a brief reason in the Notes column)
>
> A UI/UX Brief is considered **APPROVED FOR DESIGN** only when all applicable items
> are marked `[x]` and the Final Readiness Gate is passed.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UIUX Brief ID   : UIUX-[XXX]
Product Name    : [Product / Application Name]
Reviewed By     : [Name / Role]
Review Date     : DD-MMM-YYYY
Review Stage    : [ Author Self-Review | Designer Review | Architect Review | Brand Review | Final Approval ]
Overall Status  : [ NOT READY | READY WITH COMMENTS | APPROVED FOR DESIGN ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## SECTION 0 — Header & Metadata

> Verify the brief's identity and administrative fields are correctly filled before
> reviewing any content section. An incomplete header breaks traceability to the PRD and EPICs.

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 0.1 | UIUX Brief ID is assigned and follows the naming convention (UIUX-XXX) | `[ ]` | |
| 0.2 | Product Name is filled in — not left as placeholder text | `[ ]` | |
| 0.3 | Version number is set (1.0 for initial baseline) | `[ ]` | |
| 0.4 | Created Date is filled in (DD-MMM-YYYY format) | `[ ]` | |
| 0.5 | Last Updated date reflects the most recent edit | `[ ]` | |
| 0.6 | Author name and role are filled in | `[ ]` | |
| 0.7 | Designer name and design tool (e.g., Figma, Adobe XD) are specified | `[ ]` | |
| 0.8 | Reviewed By and Approved By fields are filled in (or assigned with a name) | `[ ]` | |
| 0.9 | Status field is set to the correct current state | `[ ]` | |

---

## SECTION 1 — Business DNA

> Verifies that the business context, competitive landscape, and problem statement are
> fully defined. Without this, visual and structural design decisions lack an anchor.

### 1.1 Company & Project Name

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.1.1 | Company Name is filled in — not a placeholder | `[ ]` | |
| 1.1.2 | Project / App Name is filled in and distinct from the company name | `[ ]` | |
| 1.1.3 | Tagline is provided or explicitly marked as "Not defined yet" | `[ ]` | |

### 1.2 The Elevator Pitch

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.2.1 | Elevator pitch is written — not a placeholder | `[ ]` | |
| 1.2.2 | Sentence 1 clearly states WHAT the product does | `[ ]` | |
| 1.2.3 | Sentence 2 clearly states WHO it serves AND the VALUE it delivers | `[ ]` | |
| 1.2.4 | The pitch is free of internal jargon — a designer unfamiliar with the domain can understand it | `[ ]` | |
| 1.2.5 | The pitch implies the industry (fintech, healthcare, edtech, etc.) without needing to be told | `[ ]` | |

### 1.3 The Core Problem

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.3.1 | Problem Statement is written from the USER's perspective — not the business's | `[ ]` | |
| 1.3.2 | The specific pain point is named — no vague phrases like "poor user experience" | `[ ]` | |
| 1.3.3 | Impact on User is described — the emotional and practical consequences of the problem | `[ ]` | |
| 1.3.4 | The problem statement would make sense to the user it describes | `[ ]` | |

### 1.4 Top 3 Competitors

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.4.1 | At least 3 competitors are listed by name (URL optional but recommended) | `[ ]` | |
| 1.4.2 | Each competitor has a Key UI Observation — specific, not generic (e.g., not just "good design") | `[ ]` | |
| 1.4.3 | A Differentiation Opportunity is articulated — how this product's design will stand apart | `[ ]` | |
| 1.4.4 | At least one observation identifies a competitor weakness this product can exploit in UX | `[ ]` | |

### 1.5 Current Website / App

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 1.5.1 | Existing web URL or mobile app name is provided — or "Greenfield / None" is explicitly stated | `[ ]` | |
| 1.5.2 | Figma or design file link is provided — or "No existing design assets" is stated | `[ ]` | |
| 1.5.3 | "What to Preserve" is specified (brand elements, user mental models, existing flows) | `[ ]` | |
| 1.5.4 | "What to Redesign" is specified — not left blank | `[ ]` | |

---

## SECTION 2 — Target Audience

> Verifies that the design brief is anchored to a real, specific user — not a hypothetical
> or generic one. Every UX decision (font size, tap target, information density, language)
> must be traceable to a clearly defined audience.

### 2.1 Primary Demographics

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 2.1.1 | Age Range is specified as a numeric range — not "adults" or "everyone" | `[ ]` | |
| 2.1.2 | Gender Distribution is described or stated as "equal mix" | `[ ]` | |
| 2.1.3 | Primary Occupation is filled in with specific roles — not "general public" | `[ ]` | |
| 2.1.4 | Secondary User Group is identified (or stated as "none") | `[ ]` | |
| 2.1.5 | Device Usage Pattern is specified (mobile-first, desktop-first, or mixed) | `[ ]` | |
| 2.1.6 | At least one user persona is sketched — name, age, goal, frustration, tech comfort | `[ ]` | |

### 2.2 Geographic Location

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 2.2.1 | Primary User Location is specified by country or region — not "global" without elaboration | `[ ]` | |
| 2.2.2 | Secondary User Location is specified (or stated as "same as primary") | `[ ]` | |
| 2.2.3 | All languages required in the UI are listed explicitly | `[ ]` | |
| 2.2.4 | RTL language support requirement is answered — Yes (with language named) or No | `[ ]` | |
| 2.2.5 | Connectivity assumption is selected (high-speed / mixed / low-bandwidth) | `[ ]` | |
| 2.2.6 | Cultural considerations are noted — color sensitivities, taboo imagery, date/currency format | `[ ]` | |

### 2.3 User Tech-Savviness

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 2.3.1 | All four dimensions are scored on the 1–5 scale (not left blank) | `[ ]` | |
| 2.3.2 | Each score has an explanatory note — not just a number | `[ ]` | |
| 2.3.3 | The corresponding Design Implication tier (Guided / Balanced / Power UI) is selected | `[ ]` | |
| 2.3.4 | The tech-savviness score is consistent with the occupation described in Section 2.1 | `[ ]` | |

---

## SECTION 3 — Visual Identity

> Verifies that the design language is fully specified — giving the designer or AI tool a
> precise, unambiguous visual vocabulary to work from. Vague answers here produce inconsistent,
> off-brand, or generic UI output.

### 3.1 Brand Colors (HEX Codes)

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 3.1.1 | Primary Brand Color is defined with a HEX code — or Section 3.2 (mood picker) is used instead | `[ ]` | |
| 3.1.2 | Secondary / Accent Color is defined with a HEX code | `[ ]` | |
| 3.1.3 | Background colors for both Light and Dark modes are defined (or Dark is marked N/A if light-only) | `[ ]` | |
| 3.1.4 | Semantic colors are defined: Success, Warning, Error / Danger | `[ ]` | |
| 3.1.5 | Text — Primary and Text — Secondary colors are defined | `[ ]` | |
| 3.1.6 | Each color has a Usage context specified — not just the HEX code alone | `[ ]` | |
| 3.1.7 | WCAG accessibility target is selected (AA or AAA) | `[ ]` | |
| 3.1.8 | Primary text on primary background color combination meets the selected WCAG contrast ratio | `[ ]` | |

### 3.2 Color Preference (If No Brand Guide)

> *This section applies only when no HEX codes exist. Mark all items `[N/A]` if Section 3.1 is complete.*

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 3.2.1 | At least one mood category is selected from the provided list | `[ ]` | |
| 3.2.2 | If "Custom Mood" is selected, a descriptive paragraph is written — not left as a placeholder | `[ ]` | |
| 3.2.3 | The selected mood is consistent with the industry implied by the Elevator Pitch (Section 1.2) | `[ ]` | |

### 3.3 Typography Style

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 3.3.1 | Heading Font Style is selected (Serif / Sans-Serif / Display) | `[ ]` | |
| 3.3.2 | Body Font Style is selected — Sans-Serif is confirmed or a justified exception noted | `[ ]` | |
| 3.3.3 | Code / Data Font requirement is answered (Monospace required or N/A) | `[ ]` | |
| 3.3.4 | Preferred Font Families are named — or "Let designer decide" is explicitly stated | `[ ]` | |
| 3.3.5 | Font Size Base (Body) is specified for desktop and mobile — or "Per design system" stated | `[ ]` | |
| 3.3.6 | Typography style is consistent with the Visual Keywords in Section 3.5 (e.g., "Minimal" ≠ ornate serif) | `[ ]` | |

### 3.4 Theme Preference

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 3.4.1 | Exactly one theme option is selected (Light Only / Dark Only / System Toggle / User Toggle) | `[ ]` | |
| 3.4.2 | If "Both" is selected, the team has acknowledged this doubles design token and QA scope | `[ ]` | |
| 3.4.3 | Dark mode background HEX (Section 3.1) is filled in — required if Dark or Both is selected | `[ ]` | |
| 3.4.4 | Any screen-level theme exceptions are documented in the Additional Notes field | `[ ]` | |

### 3.5 Visual Keywords

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 3.5.1 | Exactly 3 visual keywords are provided — no more, no fewer | `[ ]` | |
| 3.5.2 | Keywords are specific design personality words — not generic values like "reliable" or "innovative" | `[ ]` | |
| 3.5.3 | The 3 keywords do not contradict each other (e.g., "Minimal" and "Maximalist" together) | `[ ]` | |
| 3.5.4 | The keyword combination is consistent with the competitor analysis and differentiation opportunity | `[ ]` | |

---

## SECTION 4 — User Experience

> Verifies that the interaction architecture — primary action, platforms, and navigation —
> is fully defined. These decisions determine component library scope, responsive breakpoints,
> and must be reflected in EPIC and User Story acceptance criteria.

### 4.1 The Primary Action

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 4.1.1 | The Primary User Action is defined as a single, specific action — not a category | `[ ]` | |
| 4.1.2 | "Where It Appears" is specified — the screen(s) and persistent placement of the primary CTA | `[ ]` | |
| 4.1.3 | CTA Label is defined as actual button copy — not a description of what it does | `[ ]` | |
| 4.1.4 | Success Metric is defined — how success of the primary action will be measured | `[ ]` | |
| 4.1.5 | The primary action is consistent with the Core Problem described in Section 1.3 | `[ ]` | |

### 4.2 Platform Scope

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 4.2.1 | At least one platform is marked as Required = Yes | `[ ]` | |
| 4.2.2 | Every required platform has a Priority assigned (P1 / P2 / P3) | `[ ]` | |
| 4.2.3 | No platform is left blank — every row is answered (Yes/No + Priority or N/A) | `[ ]` | |
| 4.2.4 | If Web is required, responsive breakpoints (Mobile / Tablet / Desktop / Wide) are confirmed | `[ ]` | |
| 4.2.5 | If iOS and Android are both P1, native component guidelines for both platforms are acknowledged | `[ ]` | |
| 4.2.6 | Platform priority is consistent with the Device Usage Pattern in Section 2.1 | `[ ]` | |
| 4.2.7 | PWA offline requirements are specified if PWA is selected | `[ ]` | |

### 4.3 Navigation Style

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 4.3.1 | At least one navigation pattern is selected | `[ ]` | |
| 4.3.2 | The selected navigation pattern is appropriate for the primary platform (e.g., Bottom Tab Bar for mobile apps) | `[ ]` | |
| 4.3.3 | Navigation Depth is defined for at least Level 1 (primary sections) | `[ ]` | |
| 4.3.4 | Navigation Depth is defined for Level 2 (sub-flows or drill-downs) where applicable | `[ ]` | |
| 4.3.5 | Mobile-specific navigation rules are answered: back button behavior, sticky tab bar, swipe gestures | `[ ]` | |
| 4.3.6 | Safe area handling (iPhone notch / Android gesture bar) is acknowledged for mobile platforms | `[ ]` | |
| 4.3.7 | Navigation style is consistent with the tech-savviness level (complex nav ≠ Level 1–2 users) | `[ ]` | |

---

## SECTION 5 — AI & Features

> Verifies that AI integration requirements, chatbot personality, feature scope, and
> third-party constraints are fully defined. Every feature listed must trace to a User Story
> in the backlog. Every integration must have its UI impact assessed before design begins.

### 5.1 AI Integration Requirements

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 5.1.1 | Every AI feature row has a checkbox answer (selected or explicitly left unchecked) — no blanks | `[ ]` | |
| 5.1.2 | Each selected AI feature has a Description that is specific — not just the feature type name | `[ ]` | |
| 5.1.3 | Each selected AI feature has a Priority assigned (P1 / P2 / P3) | `[ ]` | |
| 5.1.4 | Each selected AI feature has at least one Screen(s) Affected specified | `[ ]` | |
| 5.1.5 | Required AI UX States are checked: at minimum Loading, Error/Fallback, and Empty/First-use states | `[ ]` | |
| 5.1.6 | If no AI features are required, all rows are explicitly unchecked (not left blank) | `[ ]` | |
| 5.1.7 | Streaming response state is checked if a conversational AI / chatbot is selected | `[ ]` | |
| 5.1.8 | Explainability panel is checked if AI is used for fraud detection or automated decisions | `[ ]` | |

### 5.2 Chatbot Personality

> *Mark all items `[N/A]` if no chatbot / conversational AI is selected in Section 5.1.*

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 5.2.1 | Tone is selected (Formal / Friendly / Neutral) — exactly one option | `[ ]` | |
| 5.2.2 | "Address User As" preference is selected | `[ ]` | |
| 5.2.3 | Response Length preference is selected | `[ ]` | |
| 5.2.4 | Emoji usage decision is made (Yes — sparingly / No) | `[ ]` | |
| 5.2.5 | Escalation Path is defined — what happens when AI cannot resolve the user's issue | `[ ]` | |
| 5.2.6 | Bot Avatar / Name is defined or explicitly marked "No branding requirement" | `[ ]` | |
| 5.2.7 | The selected tone is consistent with the product's Visual Keywords and industry (Section 1.2 + 3.5) | `[ ]` | |

### 5.3 Must-Have Features

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 5.3.1 | At least 5 features are listed in priority order | `[ ]` | |
| 5.3.2 | Each feature has a name and description — no blank rows | `[ ]` | |
| 5.3.3 | Each feature has a Screen Count Estimate — even if approximate | `[ ]` | |
| 5.3.4 | Each feature is mapped to an EPIC Reference (or "TBD" with a note if EPICs are not yet created) | `[ ]` | |
| 5.3.5 | Features are listed in genuine priority order — P1 features appear before P2 and P3 | `[ ]` | |
| 5.3.6 | Out-of-Scope Features (Phase 1 exclusions) are explicitly listed | `[ ]` | |
| 5.3.7 | No feature listed here conflicts with items in the Out-of-Scope section of the linked PRD | `[ ]` | |
| 5.3.8 | The primary action from Section 4.1 corresponds to Feature #1 or #2 in this list | `[ ]` | |

### 5.4 Third-Party Integrations

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 5.4.1 | Every integration row is answered — selected or explicitly left unchecked | `[ ]` | |
| 5.4.2 | Each selected integration has a Provider named (not just the category) | `[ ]` | |
| 5.4.3 | Each selected integration has a UI Impact assessment — even if "Backend only, no UI impact" | `[ ]` | |
| 5.4.4 | Payment gateway UI constraints (SDK-provided components vs custom UI) are clarified | `[ ]` | |
| 5.4.5 | KYC / AML SDK overlay customization limits are acknowledged if identity verification is selected | `[ ]` | |
| 5.4.6 | Chat / support widget placement is specified (floating button position relative to tab bar etc.) | `[ ]` | |
| 5.4.7 | All integrations in this section are consistent with the Integration Requirements in the linked PRD | `[ ]` | |

---

## SECTION 6 — Creative Assets

> Verifies that the visual content strategy — imagery style, creative inspiration, and
> content ownership — is fully defined before design begins. Undefined content ownership
> is the most common cause of design handoff delays.

### 6.1 Imagery Style

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 6.1.1 | At least one imagery style is selected — no section left entirely blank | `[ ]` | |
| 6.1.2 | If multiple styles are selected, different screen zones are assigned to each style | `[ ]` | |
| 6.1.3 | Usage by Screen Zone is defined for at minimum: Hero/Onboarding, Empty States, and Marketing screens | `[ ]` | |
| 6.1.4 | Motion / Lottie animations are confirmed or explicitly excluded (important for loading/success UX) | `[ ]` | |
| 6.1.5 | Selected imagery style is consistent with the Visual Keywords in Section 3.5 | `[ ]` | |
| 6.1.6 | If Real Photography is selected, diversity and authenticity requirements are noted | `[ ]` | |

### 6.2 Inspiration Links

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 6.2.1 | At least 2 inspiration references are provided (app name, website, or direct URL) | `[ ]` | |
| 6.2.2 | Each reference has a "What You Love About It" note — specific design elements, not just "it looks good" | `[ ]` | |
| 6.2.3 | Inspiration references are from comparable product types or aspirational peers — not random sites | `[ ]` | |
| 6.2.4 | Anti-Inspiration (What to AVOID) is specified — at least one explicit example | `[ ]` | |

### 6.3 Content Readiness

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| 6.3.1 | Brand Logo (SVG + PNG) status is specified with an owner and delivery date | `[ ]` | |
| 6.3.2 | Brand Colors & Typography Guide status is specified | `[ ]` | |
| 6.3.3 | UI Copy / Microcopy ownership is confirmed (Client / AI / UX Writer) | `[ ]` | |
| 6.3.4 | Product Photography ownership and source are confirmed | `[ ]` | |
| 6.3.5 | Illustrations / Icons source is confirmed (client / designer / licensed library) | `[ ]` | |
| 6.3.6 | Lottie Animation source is confirmed — or explicitly marked N/A if animations are not planned | `[ ]` | |
| 6.3.7 | Legal / Compliance Copy ownership is assigned to a named person or team | `[ ]` | |
| 6.3.8 | Content Placeholder Strategy is defined — what to use during the design phase (no blank "Lorem Ipsum") | `[ ]` | |
| 6.3.9 | All content with a delivery date has a named owner — no row has a date but no owner | `[ ]` | |
| 6.3.10 | Content items marked "In Progress" or "Not Started" have a risk flag raised with the project manager | `[ ]` | |

---

## SECTION RH — Revision History

| # | Checklist Item | Status | Notes / Comments |
|---|----------------|--------|------------------|
| RH.1 | Version 1.0 entry is present with Created Date and Author | `[ ]` | |
| RH.2 | Every change made after the brief was first shared with the design team is logged | `[ ]` | |
| RH.3 | Each revision entry specifies which Section was changed — not just "minor updates" | `[ ]` | |
| RH.4 | The designer has been notified of all revisions logged after design began | `[ ]` | |

---

## Cross-Section Consistency Checks

> These checks verify that the six sections form a coherent, self-consistent brief.
> Inconsistencies here are the most common root cause of design rework.

| # | Consistency Check | Status | Notes / Comments |
|---|------------------|--------|------------------|
| CC.1 | The Elevator Pitch (1.2) and Core Problem (1.3) describe the same product from different angles — they do not contradict | `[ ]` | |
| CC.2 | The Primary Action (4.1) directly addresses the Core Problem (1.3) | `[ ]` | |
| CC.3 | The Primary Action (4.1) corresponds to Feature #1 or #2 in Must-Have Features (5.3) | `[ ]` | |
| CC.4 | The Platform Scope (4.2) is consistent with the Device Usage Pattern in Demographics (2.1) — mobile-first users → mobile P1 | `[ ]` | |
| CC.5 | The Navigation Style (4.3) is appropriate for the selected primary platform in Platform Scope (4.2) | `[ ]` | |
| CC.6 | The Tech-Savviness score (2.3) is reflected in the Navigation Style complexity (4.3) — low score → simple nav | `[ ]` | |
| CC.7 | The Visual Keywords (3.5) are consistent with the industry implied by the Elevator Pitch (1.2) | `[ ]` | |
| CC.8 | The Typography Style (3.3) is consistent with the Visual Keywords (3.5) — "Minimal" ≠ ornate decorative fonts | `[ ]` | |
| CC.9 | The Brand Colors (3.1) do not conflict with Cultural Considerations in Geographic Location (2.2) | `[ ]` | |
| CC.10 | The Theme Preference (3.4) is consistent with the Visual Keywords (3.5) — "High-Luxury" aligns with Dark Mode | `[ ]` | |
| CC.11 | All AI features selected in Section 5.1 are reflected in the Must-Have Features list (5.3) | `[ ]` | |
| CC.12 | The Chatbot Personality tone (5.2) is consistent with the Visual Keywords and industry tone (1.2 + 3.5) | `[ ]` | |
| CC.13 | The Imagery Style (6.1) is consistent with the Visual Keywords (3.5) — "Clinical" ≠ playful cartoon illustrations | `[ ]` | |
| CC.14 | Inspiration Links (6.2) reflect the same visual personality as the Visual Keywords (3.5) | `[ ]` | |
| CC.15 | RTL language support decision (2.2) is reflected in Platform Scope notes (4.2) if a Right-to-Left language is required | `[ ]` | |

---

## Final Readiness Gate

> All items below must be marked `[x]` before the brief is approved for design.
> Any `[ ]` here blocks design from commencing.

| # | Gate Criterion | Status | Notes / Comments |
|---|---------------|--------|------------------|
| G.1 | All 9 Header & Metadata fields (Section 0) are complete | `[ ]` | |
| G.2 | Business DNA (Section 1) is fully answered — all 5 sub-sections, no placeholder text remaining | `[ ]` | |
| G.3 | Target Audience (Section 2) is fully answered — age range, geography, and savviness score all present | `[ ]` | |
| G.4 | Visual Identity (Section 3) provides either HEX codes (3.1) or a mood selection (3.2) — not both blank | `[ ]` | |
| G.5 | Typography style and theme preference are selected (Section 3.3 + 3.4) | `[ ]` | |
| G.6 | Exactly 3 Visual Keywords are provided (Section 3.5) | `[ ]` | |
| G.7 | Primary Action is defined with CTA copy and placement (Section 4.1) | `[ ]` | |
| G.8 | At least one platform is confirmed as P1 (Section 4.2) | `[ ]` | |
| G.9 | Navigation style is selected and navigation depth Level 1 is defined (Section 4.3) | `[ ]` | |
| G.10 | AI feature selection is complete — all rows answered (Section 5.1) | `[ ]` | |
| G.11 | At least 5 Must-Have Features are listed with priorities (Section 5.3) | `[ ]` | |
| G.12 | All third-party integrations have UI impact assessed (Section 5.4) | `[ ]` | |
| G.13 | Brand Logo delivery status and owner are confirmed (Section 6.3) | `[ ]` | |
| G.14 | UI Copy ownership is assigned — designer is not waiting on unspecified copy (Section 6.3) | `[ ]` | |
| G.15 | All 15 Cross-Section Consistency Checks are passed (CC.1 – CC.15) | `[ ]` | |

---

## Sign-Off Block

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UIUX Brief ID   : UIUX-[XXX]
Product Name    : [Product / Application Name]

Role                    Name                    Date            Signature
─────────────────────────────────────────────────────────────────────────
Author (BA / PO)        ___________________     DD-MMM-YYYY     _________
UX Designer / Lead      ___________________     DD-MMM-YYYY     _________
Solution Architect      ___________________     DD-MMM-YYYY     _________
Brand / Marketing       ___________________     DD-MMM-YYYY     _________
Product Owner           ___________________     DD-MMM-YYYY     _________
Customer / Sponsor      ___________________     DD-MMM-YYYY     _________

Final Decision: [ APPROVED FOR DESIGN ] [ RETURNED FOR REVISION ]
Comments:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Quick Reference — Section Priority by Review Role

> Use this table to prioritise your review effort based on your role.
> ✅ = Must review thoroughly &nbsp;&nbsp; ⚠️ = Review if applicable &nbsp;&nbsp; — = Not your primary responsibility

| Section | Author (BA/PO) | UX Designer | Architect | Brand / Marketing | Customer / Sponsor |
|---------|---------------|------------|-----------|------------------|--------------------|
| 0 — Header & Metadata | ✅ | ⚠️ | ⚠️ | — | ⚠️ |
| 1 — Business DNA | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| 2 — Target Audience | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| 3.1 Brand Colors | ✅ | ✅ | — | ✅ | ✅ |
| 3.2 Color Mood | ✅ | ✅ | — | ✅ | ✅ |
| 3.3 Typography | ⚠️ | ✅ | — | ✅ | ⚠️ |
| 3.4 Theme Preference | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| 3.5 Visual Keywords | ✅ | ✅ | — | ✅ | ✅ |
| 4.1 Primary Action | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| 4.2 Platform Scope | ✅ | ✅ | ✅ | — | ✅ |
| 4.3 Navigation Style | ✅ | ✅ | ✅ | — | ⚠️ |
| 5.1 AI Integration | ✅ | ✅ | ✅ | — | ✅ |
| 5.2 Chatbot Personality | ✅ | ✅ | — | ✅ | ✅ |
| 5.3 Must-Have Features | ✅ | ✅ | ✅ | — | ✅ |
| 5.4 Integrations | ✅ | ⚠️ | ✅ | — | ⚠️ |
| 6.1 Imagery Style | ✅ | ✅ | — | ✅ | ✅ |
| 6.2 Inspiration Links | ✅ | ✅ | — | ✅ | ✅ |
| 6.3 Content Readiness | ✅ | ✅ | — | ✅ | ⚠️ |
| CC Cross-Section Checks | ✅ | ✅ | ✅ | ⚠️ | — |
| Final Readiness Gate | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |

---

*End of UI/UX Design Brief Completeness Checklist*

# UI/UX Design Brief Template

> **Document Flow:** **UI/UX Brief** → PRD → BRD → FRD → Initiative → EPICs → User Stories → Tasks → Subtasks
>
> The UI/UX Design Brief is the **visual and experiential contract** for the product being built.
> It captures the business identity, target audience profile, visual language, interaction model,
> AI integration expectations, and creative asset strategy — giving designers and AI tools the
> full context needed to produce cohesive, on-brand, user-centered interfaces.
> Every decision made here feeds directly into wireframes, prototypes, design systems, and
> ultimately into the User Stories and EPICs that govern front-end development.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UI/UX Brief ID  : UIUX-[XXX]
Product Name    : [Product / Application Name]
Version         : [1.0]
Created Date    : DD-MMM-YYYY
Last Updated    : DD-MMM-YYYY
Author          : [Name / Role]
Designer        : [Name / Design Tool (e.g., Figma, Adobe XD)]
Reviewed By     : [Name / Role]
Approved By     : [Name / Role]
Status          : [ Draft | Under Review | Approved | In Design | Baselined ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Table of Contents

| # | Section | Questions Covered |
|---|---------|-------------------|
| 1 | Business DNA | Company name, elevator pitch, core problem, competitors, existing app |
| 2 | Target Audience | Demographics, geography, tech-savviness |
| 3 | Visual Identity | Brand colors, typography, theme, visual keywords |
| 4 | User Experience | Primary action, platform scope, navigation style |
| 5 | AI & Features | AI integration, chatbot personality, must-have features, integrations |
| 6 | Creative Assets | Imagery style, inspiration links, content readiness |
| — | Revision History | — |

---

## 1. Business DNA

> **Guideline:** This section establishes the foundational identity of the business and product.
> It provides designers and AI tools with the **industry context, competitive landscape, and
> problem statement** needed to make informed aesthetic and structural decisions.
> Without this context, visual choices (colors, tone, layout density) may be misaligned
> with the market segment or user expectations.
>
> Complete all five fields before beginning any wireframe or prototype work.

---

### 1.1 Company & Project Name

> **Why We Ask:** Used for branding placement, logo positioning, splash screens, and
> document identification. The project name often influences naming conventions for
> design tokens, component libraries, and style guides.

| Field | Your Answer |
|-------|-------------|
| Company Name | [e.g., FinEdge Technologies] |
| Project / App Name | [e.g., FinEdge Onboard] |
| Tagline (optional) | [e.g., "Banking made human"] |

**Example:**

```
Company Name    : NovaPay Solutions
Project Name    : NovaPay Wallet
Tagline         : "Spend smart. Save smarter."
```

---

### 1.2 The Elevator Pitch

> **Why We Ask:** A 2-sentence description of the business helps designers and AI understand
> the **industry "vibe"** — whether this is fintech (trust, precision), edtech (friendly, engaging),
> healthcare (calm, reassuring), or e-commerce (energetic, conversion-driven).
> The pitch directly shapes tone-of-voice, iconography style, and visual weight decisions.

**Format:** Describe WHAT the product does (sentence 1) and WHO it serves + the VALUE it delivers (sentence 2).

```
Sentence 1 — What it does:
[e.g., NovaPay Wallet is a digital payment platform that enables instant peer-to-peer
money transfers across 40+ countries.]

Sentence 2 — Who it serves + value:
[e.g., Built for the global diaspora community, it eliminates remittance fees and
delivers funds in under 30 seconds.]
```

---

### 1.3 The Core Problem

> **Why We Ask:** The specific pain point the app solves dictates the **emotional tone** of
> the design. A product solving financial anxiety requires calm, trust-building visuals.
> A product solving time-waste requires speed-oriented, minimal UI.
> This field prevents generic design that could belong to any product.

**Format:** State the problem from the USER's perspective, not the business perspective.

```
Problem Statement:
[e.g., Migrant workers sending money home lose 8–12% of every transfer to
hidden bank fees and unfavorable exchange rates, with no visibility into
when funds actually arrive.]

Impact on User:
[e.g., Financial stress, distrust of institutions, reliance on costly informal
channels like hawala networks.]
```

---

### 1.4 Top 3 Competitors

> **Why We Ask:** Competitor analysis informs **differentiation decisions** in the UI.
> If all competitors use blue and data-table-heavy dashboards, there is a strategic
> opportunity to stand out with warmer tones and card-based layouts.
> Benchmarking also sets the baseline usability bar users will compare against.

| # | Competitor Name | URL / App Store Link | Key UI Observation |
|---|----------------|----------------------|--------------------|
| 1 | [e.g., Wise] | [e.g., wise.com] | [e.g., Clean, minimal, trust signals prominent] |
| 2 | [e.g., Remitly] | [e.g., remitly.com] | [e.g., Conversion-focused, CTA-heavy above fold] |
| 3 | [e.g., Western Union] | [e.g., westernunion.com] | [e.g., Dense, traditional, legacy feel] |

**Differentiation Opportunity:**
```
[e.g., Competitors are functional but cold. Our opportunity: warmth + speed —
design that feels like texting money to a friend, not filing a bank transfer.]
```

---

### 1.5 Current Website / App

> **Why We Ask:** Knowing the existing digital presence lets designers identify what must
> be preserved (brand equity, existing user mental models) versus what should be redesigned.
> A URL also provides visual and structural reference for the design system audit.

| Field | Your Answer |
|-------|-------------|
| Existing Web URL | [e.g., https://novapay.io — or — "None, greenfield"] |
| Existing Mobile App | [e.g., NovaPay on iOS/Android — or — "Not yet launched"] |
| Figma / Design File | [e.g., Figma link — or — "No existing design assets"] |
| What to Preserve | [e.g., Logo, primary brand color #1A2E6F, existing user base familiarity] |
| What to Redesign | [e.g., Navigation structure, checkout flow, typography system] |

---

## 2. Target Audience

> **Guideline:** Every UI decision — font size, tap target size, information density, language
> register, iconography complexity — must be calibrated against the actual human who will
> use this product daily. This section prevents designing for yourself instead of your user.
>
> Be specific. "Everyone" is not a target audience. Narrowing here improves design quality.

---

### 2.1 Primary Demographics

> **Why We Ask:** Age range determines cognitive load tolerance and visual preference
> (Gen Z expects motion and bold visuals; seniors need larger type and high contrast).
> Occupation influences when and how the product is used (commute, office, home).

| Attribute | Your Answer |
|-----------|-------------|
| Age Range | [e.g., 25–40 years] |
| Gender Distribution | [e.g., Predominantly male — 70% / 30% or "Equal mix"] |
| Primary Occupation | [e.g., Migrant workers, blue-collar professionals, freelancers] |
| Secondary User Group | [e.g., Family recipients in home country, 40–60 years] |
| Device Usage Pattern | [e.g., Primarily mobile, limited desktop access] |

**Example Persona (optional but recommended):**

```
Primary Persona: "Arjun"
  Age           : 31
  Occupation    : Construction worker, Dubai
  Goal          : Send ₹20,000 to family in Kerala every month
  Frustration   : Bank transfers take 3 days; he doesn't know if money arrived
  Tech comfort  : Uses WhatsApp daily; comfortable with UPI on personal trips home
```

---

### 2.2 Geographic Location

> **Why We Ask:** Geography influences **language direction** (LTR vs RTL for Arabic/Hebrew),
> **date/currency formats**, **cultural color associations** (white = mourning in some Asian cultures),
> and **connectivity assumptions** (low-bandwidth optimization for rural markets).

| Field | Your Answer |
|-------|-------------|
| Primary User Location | [e.g., UAE, Saudi Arabia, Qatar (sender side)] |
| Secondary User Location | [e.g., India, Philippines, Bangladesh (recipient side)] |
| Language(s) Required | [e.g., English primary; Hindi, Malayalam as secondary] |
| RTL Language Support Needed | [ Yes — specify language | No ] |
| Connectivity Assumption | [ High-speed urban WiFi | Mixed 4G/3G | Low-bandwidth rural ] |
| Cultural Considerations | [e.g., Avoid red for errors — lucky color in South Asian context] |

---

### 2.3 User Tech-Savviness

> **Why We Ask:** Tech-savviness determines **interaction complexity tolerance** — whether
> to use progressive disclosure, tooltips, onboarding tours, or simplified single-action screens.
> A score of 1–2 demands hand-holding; 4–5 allows power-user density and shortcuts.

**Scale:** Rate primary users on a scale of 1 (Beginner) to 5 (Power User).

| Dimension | Score (1–5) | Notes |
|-----------|------------|-------|
| Overall Digital Literacy | [ ] | [e.g., 2 — uses basic apps but avoids unfamiliar UIs] |
| Mobile App Familiarity | [ ] | [e.g., 3 — comfortable with WhatsApp, YouTube, UPI] |
| Financial App Experience | [ ] | [e.g., 2 — bank app only; no investment/fintech experience] |
| Tolerance for Complexity | [ ] | [e.g., 1 — needs simple, single-step flows per screen] |

**Design Implication:**
```
[ ] Level 1–2 : Guided UI — step-by-step wizards, large buttons, minimal jargon,
                inline help text, confirmation prompts, simplified navigation
[ ] Level 3   : Balanced UI — standard navigation, collapsible advanced options,
                contextual tooltips, moderate information density
[ ] Level 4–5 : Power UI — keyboard shortcuts, data tables, bulk actions,
                advanced filters, configurable dashboards
```

---

## 3. Visual Identity

> **Guideline:** This section defines the **design language** — the visual vocabulary that
> makes every screen instantly recognizable as belonging to this product.
> A consistent visual identity reduces cognitive load, builds brand trust, and creates
> the emotional connection that drives retention.
>
> If a Brand Style Guide already exists, attach it and mark fields as "Per Brand Guide."
> If no guide exists, use this section to construct one from scratch.

---

### 3.1 Brand Colors (HEX Codes)

> **Why We Ask:** Specific HEX codes ensure pixel-perfect brand consistency across all
> screens, platforms, and design tools. Colors carry emotional weight — blue conveys trust,
> green conveys growth, orange conveys energy — and must align with the brand persona.

| Role | Color Name | HEX Code | Usage |
|------|-----------|----------|-------|
| Primary Brand Color | [e.g., Deep Navy] | [e.g., #1A2E6F] | [e.g., Primary buttons, headers, key CTAs] |
| Secondary / Accent | [e.g., Electric Teal] | [e.g., #00C9A7] | [e.g., Highlights, badges, progress indicators] |
| Background — Light | [e.g., Off White] | [e.g., #F8F9FA] | [e.g., Page background in light mode] |
| Background — Dark | [e.g., Charcoal] | [e.g., #1C1C2E] | [e.g., Page background in dark mode] |
| Surface / Card | [e.g., White] | [e.g., #FFFFFF] | [e.g., Card backgrounds, modals] |
| Success | [e.g., Emerald] | [e.g., #27AE60] | [e.g., Success states, confirmations] |
| Warning | [e.g., Amber] | [e.g., #F39C12] | [e.g., Warnings, pending states] |
| Error / Danger | [e.g., Coral Red] | [e.g., #E74C3C] | [e.g., Errors, destructive actions] |
| Text — Primary | [e.g., Near Black] | [e.g., #1A1A1A] | [e.g., Body copy, headings] |
| Text — Secondary | [e.g., Slate Gray] | [e.g., #6B7280] | [e.g., Labels, captions, placeholders] |

**WCAG Accessibility Target:**
```
[ ] AA  — Minimum contrast ratio 4.5:1 for body text (recommended baseline)
[ ] AAA — Enhanced contrast ratio 7:1 for body text (for healthcare / accessibility-first products)
```

---

### 3.2 Color Preference (If No Brand Guide)

> **Why We Ask:** If no brand guide exists, this "mood preference" gives AI tools and
> designers a starting palette direction. Color moods carry industry and emotional associations
> that anchor the visual design to the product's personality.

*Skip this section if HEX codes were provided in Section 3.1.*

| Mood Category | Examples | Selected? |
|--------------|---------|-----------|
| Earthy & Organic | Terracotta, Sage Green, Warm Beige | [ ] |
| Corporate & Trust | Navy, White, Steel Gray, Cobalt Blue | [ ] |
| Neon & Energetic | Electric Purple, Hot Pink, Lime Green | [ ] |
| High-Luxury | Deep Black, Gold, Platinum, Ivory | [ ] |
| Playful & Friendly | Coral, Sky Blue, Sunshine Yellow | [ ] |
| Calm & Healthcare | Soft Blue, Lavender, Mint, Warm White | [ ] |
| Bold & Fintech | Electric Teal, Dark Navy, Bright Orange | [ ] |
| Custom Mood | [Describe in words] | [ ] |

**Custom Mood Description (if applicable):**
```
[e.g., "Like a premium airline app — dark backgrounds, gold accents,
ultra-clean layouts, no clutter, confidence-inspiring."]
```

---

### 3.3 Typography Style

> **Why We Ask:** Typography is the single most powerful driver of brand perception.
> Serif fonts signal tradition and authority (banks, law, editorial). Sans-serif signals
> modernity and clarity (tech, fintech, SaaS). Mono signals precision and data (dev tools,
> trading platforms). Mixing incorrectly creates cognitive dissonance.

| Attribute | Your Selection |
|-----------|---------------|
| Heading Font Style | [ ] Serif (Traditional, Authoritative) &nbsp;&nbsp; [ ] Sans-Serif (Modern, Clean) &nbsp;&nbsp; [ ] Display (Expressive, Bold) |
| Body Font Style | [ ] Serif &nbsp;&nbsp; [ ] Sans-Serif (recommended for digital readability) &nbsp;&nbsp; [ ] Mono |
| Code / Data Font | [ ] Monospace (required if showing data, logs, or code) &nbsp;&nbsp; [ ] N/A |
| Preferred Font Families | [e.g., Inter for body, Sora for headings — or — "Let designer decide"] |
| Font Size Base (Body) | [e.g., 14px desktop / 16px mobile — or — "Per design system defaults"] |
| Line Height Preference | [e.g., 1.5 for body, 1.2 for headings — or — "Standard"] |

**Example Typography Stack:**

```
Headings  : Sora Bold / SemiBold       — H1: 32px, H2: 24px, H3: 20px
Body      : Inter Regular / Medium     — 16px, line-height 1.6
Labels    : Inter Medium               — 12px, uppercase, letter-spacing 0.5px
Code/Data : JetBrains Mono Regular     — 14px (only in data/transaction screens)
```

---

### 3.4 Theme Preference

> **Why We Ask:** Theme choice affects the entire color token system, component library,
> and test matrix. A "System Toggle" option means designing and testing two complete
> theme sets — doubling design and QA effort. Set expectations early.

| Option | Description | Selected |
|--------|-------------|----------|
| Light Mode Only | White/light backgrounds; black text. Lower complexity. | [ ] |
| Dark Mode Only | Dark backgrounds; light text. Premium/technical feel. | [ ] |
| Both — System Toggle | Follows device OS theme setting. Requires 2x design tokens. | [ ] |
| Both — User Toggle | User manually switches in-app. Requires in-app settings UI. | [ ] |

**Additional Notes:**
```
[e.g., Dark mode preferred for dashboard screens; light mode for
onboarding and marketing-facing screens. Toggle at user account level.]
```

---

### 3.5 Visual Keywords

> **Why We Ask:** Three words create a shared vocabulary between stakeholders, designers,
> and AI tools — eliminating ambiguity. "Minimal" means different things to different people;
> "Minimal + Swiss Grid + No Decoration" is precise and actionable.

**Select or write 3 keywords that describe the target visual personality:**

```
Keyword 1 : [e.g., Minimal       | Brutalist | High-Luxury | Playful | Bold | Soft | Clinical]
Keyword 2 : [e.g., Trustworthy   | Energetic | Sophisticated | Friendly | Premium | Calm | Sharp]
Keyword 3 : [e.g., Data-Forward  | Conversational | Editorial | Transactional | Immersive | Clean]
```

**Example Combinations by Industry:**

| Industry | Keyword Set | Visual Implication |
|----------|-------------|-------------------|
| Fintech / Banking | Trustworthy · Minimal · Data-Forward | Navy + white, dense tables, no decorations |
| Healthcare | Calm · Soft · Accessible | Muted blues, large type, icon-forward |
| E-Commerce | Bold · Playful · Energetic | High contrast, product-first, CTA-heavy |
| EdTech | Friendly · Engaging · Bright | Illustration-heavy, gamification elements |
| Enterprise SaaS | Sharp · Clinical · Data-Forward | Dark mode option, sidebar nav, data grids |
| Luxury / Fashion | High-Luxury · Editorial · Minimal | Full bleed imagery, serif fonts, whitespace |

---

## 4. User Experience

> **Guideline:** This section defines the **interaction architecture** — how users navigate
> the product, what the most critical action is, and which platforms must be supported.
> These decisions determine the component library scope, responsive breakpoints, and
> the information architecture (IA) of every screen.
>
> UX decisions made here must be reflected in the EPIC and User Story acceptance criteria.

---

### 4.1 The Primary Action

> **Why We Ask:** Every screen, every user flow, and every visual hierarchy decision should
> serve the PRIMARY action. Knowing it upfront ensures the design doesn't bury the most
> important button beneath secondary content. It also guides CTA placement, color weight,
> and onboarding sequence.

| Field | Your Answer |
|-------|-------------|
| Primary User Action | [e.g., "Send money to a recipient" / "Book a demo" / "Complete KYC"] |
| Where It Appears | [e.g., Home screen, persistent bottom bar, and post-login landing] |
| CTA Label | [e.g., "Send Now" / "Get Started" / "Verify Identity"] |
| Success Metric | [e.g., Conversion rate from home screen to completed transfer] |

**Example:**

```
Primary Action   : Complete a money transfer end-to-end
CTA              : "Send Money" — floating action button on home, full-width on flow screens
Placement Rule   : Always visible above the fold; never hidden behind scroll
Success Metric   : % of sessions that reach "Transfer Confirmed" screen
```

---

### 4.2 Platform Scope

> **Why We Ask:** Platform scope defines the **responsive design breakpoints**, the component
> library (native mobile components vs. web components), and the testing matrix.
> Each additional platform multiplies design and development effort — be explicit about priority.

| Platform | Required | Priority | Notes |
|---------|---------|----------|-------|
| iOS App (iPhone) | [ ] Yes &nbsp; [ ] No | [ ] P1 &nbsp; [ ] P2 &nbsp; [ ] P3 | [e.g., Primary platform for target users] |
| iOS App (iPad) | [ ] Yes &nbsp; [ ] No | [ ] P1 &nbsp; [ ] P2 &nbsp; [ ] P3 | [e.g., Secondary; same app, adaptive layout] |
| Android App (Phone) | [ ] Yes &nbsp; [ ] No | [ ] P1 &nbsp; [ ] P2 &nbsp; [ ] P3 | [e.g., Equal priority to iOS] |
| Android App (Tablet) | [ ] Yes &nbsp; [ ] No | [ ] P1 &nbsp; [ ] P2 &nbsp; [ ] P3 | [e.g., Not in scope Phase 1] |
| Web (Responsive) | [ ] Yes &nbsp; [ ] No | [ ] P1 &nbsp; [ ] P2 &nbsp; [ ] P3 | [e.g., Admin portal only] |
| Web (Desktop-First) | [ ] Yes &nbsp; [ ] No | [ ] P1 &nbsp; [ ] P2 &nbsp; [ ] P3 | [e.g., Dashboard / analytics views] |
| Desktop App (Electron) | [ ] Yes &nbsp; [ ] No | [ ] P1 &nbsp; [ ] P2 &nbsp; [ ] P3 | [e.g., Out of scope] |
| Progressive Web App (PWA) | [ ] Yes &nbsp; [ ] No | [ ] P1 &nbsp; [ ] P2 &nbsp; [ ] P3 | [e.g., Offline-capable web fallback] |

**Responsive Breakpoints (if Web):**

```
Mobile  : 320px – 767px
Tablet  : 768px – 1199px
Desktop : 1200px – 1919px
Wide    : 1920px+
```

---

### 4.3 Navigation Style

> **Why We Ask:** Navigation architecture is the skeleton of the entire UX. The wrong
> pattern for the platform or user type increases error rates and abandonment.
> Top-nav suits content-rich web apps; bottom tab bars suit mobile apps with ≤5 sections;
> sidebars suit complex dashboards with deep hierarchies.

| Pattern | Best For | Selected |
|---------|---------|----------|
| **Top Navigation Bar** | Web apps, marketing sites, < 6 primary sections | [ ] |
| **Side Navigation Bar** | Enterprise dashboards, admin panels, deep menu trees | [ ] |
| **Bottom Tab Bar (Mobile)** | Mobile apps with 3–5 primary sections (iOS/Android native feel) | [ ] |
| **Hamburger / Drawer** | Mobile web, apps with secondary navigation items | [ ] |
| **Mega Menu** | E-commerce, content portals with many categories | [ ] |
| **Contextual / Breadcrumb** | Multi-step flows, wizards, deeply nested content | [ ] |

**Navigation Depth:**

```
Level 1 : [e.g., Home | Send Money | History | Profile]              (Tab Bar)
Level 2 : [e.g., Send Money → Select Recipient → Enter Amount]        (Step Flow)
Level 3 : [e.g., Profile → Settings → Notification Preferences]       (Drill-down)
```

**Mobile-Specific Navigation Rules:**
```
[ ] Back button behavior: System back or custom in-app back chevron
[ ] Bottom safe area respected (iPhone notch / Android gesture bar)
[ ] Swipe gestures: [ ] Enabled — specify  [ ] Disabled
[ ] Sticky tab bar: [ ] Always visible  [ ] Hides on scroll down
```

---

## 5. AI & Features

> **Guideline:** This section captures **intelligence requirements** and the feature scope
> that the design must accommodate. AI features are not afterthoughts — they require
> dedicated screen states (loading, streaming, error, empty), distinct interaction patterns,
> and personality-consistent copy.
>
> Every feature listed here should map to a User Story in the backlog.

---

### 5.1 AI Integration Requirements

> **Why We Ask:** AI features have unique UX requirements — streaming responses need
> typing indicators, confidence scores need visual representation, AI decisions need
> explainability UI. Knowing the specific AI needs upfront prevents retrofitting these
> patterns into an incompatible layout.

| AI Feature | Description | Priority | Screen(s) Affected |
|-----------|-------------|----------|-------------------|
| [ ] Chatbot / Conversational AI | [e.g., In-app support bot for transfer queries] | [ ] P1/P2/P3 | [e.g., Help screen, transaction error screen] |
| [ ] Content Generation | [e.g., AI-generated payment reference descriptions] | [ ] P1/P2/P3 | [e.g., Transfer confirmation screen] |
| [ ] Predictive / Smart Suggestions | [e.g., "Send to Priya?" based on monthly pattern] | [ ] P1/P2/P3 | [e.g., Home screen, recipient selector] |
| [ ] Fraud / Anomaly Detection | [e.g., Flag unusual transfer amounts with warning UI] | [ ] P1/P2/P3 | [e.g., Amount entry screen, review screen] |
| [ ] Personalization Engine | [e.g., Reorder menu items based on usage frequency] | [ ] P1/P2/P3 | [e.g., Home screen, quick actions] |
| [ ] OCR / Document Scanning | [e.g., Scan ID document for KYC auto-fill] | [ ] P1/P2/P3 | [e.g., KYC upload screen] |
| [ ] Voice / NLP Input | [e.g., "Send 500 dirhams to Ravi"] | [ ] P1/P2/P3 | [e.g., Home screen FAB] |
| [ ] Other | [Describe] | [ ] P1/P2/P3 | [Specify screens] |

**AI UX States Required (check all that apply):**

```
[ ] Loading / Thinking state   (spinner, skeleton, typing indicator)
[ ] Streaming response state   (word-by-word text reveal)
[ ] Error / Fallback state     (AI unavailable — graceful degradation message)
[ ] Empty / First-use state    (no data yet — AI onboarding prompt)
[ ] Confidence indicator       (AI shows certainty level for suggestions)
[ ] Explainability panel       (why did AI flag this transaction?)
```

---

### 5.2 Chatbot Personality

> **Why We Ask:** The chatbot's personality must match the brand voice and the user's
> emotional context. A formal assistant creates distance; a casual friend may undermine
> credibility for financial products. Define this before writing chatbot UI copy.

| Attribute | Your Selection |
|-----------|---------------|
| Tone | [ ] Formal & Professional &nbsp;&nbsp; [ ] Friendly & Casual &nbsp;&nbsp; [ ] Neutral & Efficient |
| Address User As | [ ] First name ("Hi Arjun") &nbsp;&nbsp; [ ] Generic ("Hi there") &nbsp;&nbsp; [ ] Formal ("Dear Customer") |
| Response Length | [ ] Concise — 1–2 lines max &nbsp;&nbsp; [ ] Moderate — paragraph &nbsp;&nbsp; [ ] Detailed — with options |
| Use Emojis | [ ] Yes — sparingly &nbsp;&nbsp; [ ] No — formal context |
| Escalation Path | [e.g., "Talk to a human" button after 2 failed AI responses] |
| Avatar / Name | [e.g., "Nova" — abstract geometric avatar, no human face] |

**Voice & Tone Examples:**

```
Formal    : "Your transaction of AED 1,000 has been initiated.
             Expected arrival: 28 Mar 2026, 06:00 PM IST."

Friendly  : "Done! 💸 AED 1,000 is on its way to Priya.
             She should get it by tomorrow evening."

Neutral   : "Transfer initiated: AED 1,000 → Priya Sharma.
             ETA: 28 Mar 2026."
```

---

### 5.3 Must-Have Features

> **Why We Ask:** The feature list drives the **screen inventory** — every feature maps
> to one or more screens. Knowing the top 5 features in priority order ensures the
> information architecture is built around what matters most, not what is easiest to design.

List the top features in priority order. Each feature will be decomposed into User Stories.

| # | Feature Name | Description | Screen Count Estimate | EPIC Reference |
|---|-------------|-------------|----------------------|----------------|
| 1 | [e.g., User Authentication] | [e.g., Email/mobile OTP login + biometric re-auth] | [e.g., 3] | [e.g., EPIC-001] |
| 2 | [e.g., KYC / Identity Verification] | [e.g., ID document scan + selfie liveness check] | [e.g., 5] | [e.g., EPIC-002] |
| 3 | [e.g., Money Transfer Flow] | [e.g., Select recipient → amount → review → confirm] | [e.g., 6] | [e.g., EPIC-003] |
| 4 | [e.g., Transaction History] | [e.g., Filterable list + receipt download] | [e.g., 3] | [e.g., EPIC-004] |
| 5 | [e.g., Recipient Management] | [e.g., Add/edit/delete saved recipients with bank details] | [e.g., 4] | [e.g., EPIC-005] |
| 6 | [e.g., Notifications] | [e.g., Push + in-app alerts for transfer status] | [e.g., 2] | [e.g., EPIC-006] |
| 7 | [e.g., Support / Help Center] | [e.g., FAQ + AI chatbot + live chat escalation] | [e.g., 3] | [e.g., EPIC-007] |

**Out-of-Scope Features (Phase 1):**
```
[e.g., Investment products, multi-currency wallet, merchant payments,
loyalty rewards program — deferred to Phase 2]
```

---

### 5.4 Third-Party Integrations

> **Why We Ask:** Integrations constrain UI components. Payment SDKs provide pre-built
> UIs that may not match the design system. Map providers offer fixed embeds.
> Knowing integrations upfront prevents late-stage design rework when SDK limitations surface.

| Integration | Provider | UI Impact | Notes |
|------------|---------|-----------|-------|
| [ ] Payment Gateway | [e.g., Stripe / Razorpay / Adyen] | [e.g., Card entry UI — Stripe Elements style] | [e.g., Must match brand colors] |
| [ ] CRM | [e.g., Salesforce / HubSpot] | [e.g., Backend only — no UI impact] | — |
| [ ] Maps | [e.g., Google Maps / Mapbox] | [e.g., Agent locator screen — embedded map] | [e.g., Custom map pin styling required] |
| [ ] KYC / AML | [e.g., Onfido / Jumio / DigiLocker] | [e.g., SDK overlay — limited customization] | [e.g., Match SDK overlay to brand colors] |
| [ ] Messaging | [e.g., WhatsApp Business API / Twilio] | [e.g., No in-app UI — external channel] | — |
| [ ] Analytics | [e.g., Mixpanel / Amplitude / Firebase] | [e.g., No UI — event tracking only] | — |
| [ ] Chat / Support | [e.g., Intercom / Freshchat / Zendesk] | [e.g., Chat widget — floating button placement] | [e.g., Bottom-right, above tab bar] |
| [ ] Auth / SSO | [e.g., Auth0 / Firebase Auth / Azure AD B2C] | [e.g., Login screen — SDK or custom UI?] | [e.g., Custom UI with Auth0 backend] |
| [ ] Other | [Describe] | [Describe] | — |

---

## 6. Creative Assets

> **Guideline:** This section defines the **visual content strategy** — what kind of imagery
> the product will use, where design inspiration comes from, and who is responsible for
> producing the final content.
>
> Asset decisions directly impact design timeline. AI-generated or designer-produced assets
> add lead time. Settling this upfront prevents last-minute content scrambles before handoff.

---

### 6.1 Imagery Style

> **Why We Ask:** Imagery style defines whether the product feels grounded in reality
> (real photography), aspirational and modern (3D rendering), or approachable and
> friendly (flat illustration). Mixing styles across screens creates visual incoherence.

| Style | Description | Best For | Selected |
|-------|-------------|---------|----------|
| **Real Photography** | Actual people, places, products. High trust signal. | Healthcare, consumer apps, lifestyle brands | [ ] |
| **3D Renderings** | Stylized 3D objects, characters, environments. Premium feel. | Fintech, SaaS, tech products | [ ] |
| **2D Flat Illustrations** | Geometric, icon-based, color-filled vector art. Friendly. | EdTech, onboarding flows, empty states | [ ] |
| **Isometric Illustrations** | 3D-perspective flat art. Detailed, technical aesthetic. | B2B SaaS, data-heavy products | [ ] |
| **Motion / Lottie Animations** | Animated micro-illustrations for loading/success states. | All — for delight moments | [ ] |
| **Icon-Only (No Illustrations)** | Clean, minimal — icons carry all visual weight. | Enterprise apps, data-dense screens | [ ] |

**Usage by Screen Zone:**

```
Hero / Onboarding   : [e.g., 3D rendered character + animated confetti on success]
Empty States        : [e.g., 2D flat illustration + friendly copy]
Modals / Toasts     : [e.g., Lottie animation for success / error feedback]
Profile / Settings  : [e.g., User avatar placeholder — abstract geometric initials]
Marketing Screens   : [e.g., Real photography — diverse, authentic, non-stock-looking]
```

---

### 6.2 Inspiration Links

> **Why We Ask:** 2–3 links to apps or websites the client loves are worth 10 pages of
> written description. They reveal subconscious preferences — layout density, whitespace
> tolerance, icon style, animation frequency — that are hard to articulate verbally.
> These are reference DIRECTION only, not copy targets.

| # | App / Website Name | URL | What You Love About It |
|---|-------------------|----|------------------------|
| 1 | [e.g., Revolut App] | [e.g., revolut.com] | [e.g., Dark mode, data-forward home screen, card-flip animation] |
| 2 | [e.g., Linear.app] | [e.g., linear.app] | [e.g., Speed, keyboard-first, ultra-minimal design language] |
| 3 | [e.g., Airbnb] | [e.g., airbnb.com] | [e.g., Photography-forward, trust signals, clean search UX] |

**Anti-Inspiration (What to AVOID):**
```
[e.g., Avoid: cluttered dashboards like legacy banking apps (HDFC NetBanking),
dark patterns like hidden fees reveals, aggressive popup frequency like Booking.com]
```

---

### 6.3 Content Readiness

> **Why We Ask:** Content (copy, images, videos) is the #1 cause of design handoff delays.
> If the client provides content, the designer can use real data from day one, producing
> more accurate high-fidelity mockups. If AI or designers must create content, that effort
> must be scoped and scheduled.

| Content Type | Status | Owner | Delivery Date |
|-------------|--------|-------|---------------|
| Final Brand Logo (SVG + PNG) | [ ] Ready &nbsp; [ ] In Progress &nbsp; [ ] Not Started | [Name / Team] | [DD-MMM-YYYY] |
| Brand Colors & Typography Guide | [ ] Ready &nbsp; [ ] In Progress &nbsp; [ ] Not Started | [Name / Team] | [DD-MMM-YYYY] |
| UI Copy / Microcopy | [ ] Client provides &nbsp; [ ] AI generates &nbsp; [ ] UX Writer creates | [Name / Team] | [DD-MMM-YYYY] |
| Product Photography | [ ] Client provides &nbsp; [ ] Stock &nbsp; [ ] Photographer hired | [Name / Team] | [DD-MMM-YYYY] |
| Illustrations / Icons | [ ] Client provides &nbsp; [ ] Designer creates &nbsp; [ ] Icon library licensed | [Name / Team] | [DD-MMM-YYYY] |
| Lottie Animations | [ ] Client provides &nbsp; [ ] Animator creates &nbsp; [ ] LottieFiles licensed | [Name / Team] | [DD-MMM-YYYY] |
| Video / Motion Content | [ ] Client provides &nbsp; [ ] Production team hired &nbsp; [ ] N/A | [Name / Team] | [DD-MMM-YYYY] |
| Legal / Compliance Copy | [ ] Client provides &nbsp; [ ] Legal team drafts | [Name / Team] | [DD-MMM-YYYY] |

**Content Placeholder Strategy (for design phase):**
```
Copy       : [e.g., Use realistic lorem-replacement copy — no "Lorem Ipsum"]
Images     : [e.g., Use Unsplash placeholders in design; swap with real photos at handoff]
Data       : [e.g., Use realistic fake data — real-format account numbers, names, amounts]
```

---

## Revision History

> **Guideline:** Record every significant change to this brief after it has been shared
> with the design team. Version control prevents miscommunication between stakeholders
> and ensures the design team is always working from the latest approved version.

| Version | Date | Author | Section Changed | Summary of Change |
|---------|------|--------|----------------|-------------------|
| 1.0 | DD-MMM-YYYY | [Name] | All | Initial draft |
| 1.1 | DD-MMM-YYYY | [Name] | [e.g., 3.1 Brand Colors] | [e.g., Updated primary HEX from #1A2E6F to #0F1F5C after brand refresh] |
| 1.2 | DD-MMM-YYYY | [Name] | [e.g., 4.2 Platform Scope] | [e.g., Added iPad as P2 platform for Phase 2] |

---

*End of UI/UX Design Brief Template*

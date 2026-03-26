---
description: Create comprehensive UI/UX Guidelines using the UI-UX-Template, covering branding, design system, UX patterns, AI features, and creative assets, validated by the UI-UX checklist
---

# `/create-ui-ux-guidelines` — UI/UX Guidelines Creator

> Create a comprehensive UI/UX Design Brief and Guidelines document using the UI-UX-Template. Covers business DNA, audience, visual identity, UX patterns, AI features, and creative assets — validated by the UI-UX completeness checklist.

You are a senior UX designer and design system architect. Your job is to produce a definitive UI/UX guidelines document that gives designers and developers everything they need to build a consistent, accessible, and branded experience.

---

## Reference Documents

| # | Document | Purpose |
|---|----------|---------|
| T1 | `Master-Documents/UI-UX-Template.md` | Write the UI/UX Design Brief |
| T2 | `Master-Documents/UI-UX-Template-Checklist.md` | Validate completeness (6 section checks + 15 cross-section consistency checks + Readiness Gate) |

**Input required:**
- Approved PRD (Sections 5, 13, 14 — Actors, UI/UX, Branding)
- Approved EPICs (actor flows, feature scope)
- Approved Screens (wireframes, navigation, components)
- Any existing brand guide, style guide, or asset kit provided by the customer

---

## Your Process

### Step 1: Gather Inputs

Collect the following from the customer and existing documents:

**Business DNA:**
- Product mission in one sentence
- Brand personality (3–5 adjectives: e.g., "trustworthy, modern, approachable")
- Primary use context (enterprise SaaS / consumer mobile / internal tool)
- Key differentiators vs. competitors

**Audience:**
- Primary and secondary user personas (from PRD Section 5)
- User technical proficiency (novice / intermediate / expert)
- Accessibility requirements (WCAG level — A, AA, AAA)
- Device/platform targets (desktop, tablet, mobile, PWA, native)

**Visual Identity:**
- Existing brand guidelines / logo files
- Primary, secondary, and accent colour palette (with hex codes)
- Typography preferences (font families, weight, size scale)
- Iconography style (outlined, filled, illustrated)
- Spacing and grid system

**UX Patterns:**
- Navigation pattern (top nav, sidebar, tab bar, breadcrumbs)
- Form interaction style (inline validation, step-by-step wizard, single page)
- Feedback patterns (toast notifications, modals, inline errors)
- Data display patterns (tables, cards, charts, lists)
- Empty states, loading states, error states design approach

**AI Features (if applicable):**
- AI-powered features in the product (suggestions, search, summarisation, chat)
- Transparency requirements (how to communicate AI-generated content to users)
- Fallback UX when AI is unavailable

**Creative Assets:**
- Required asset types (illustrations, icons, images, animations)
- Asset creation approach (custom designed / stock / icon library)
- File format and resolution requirements

---

### Step 2: Identify Gaps

For any input category that is incomplete, ask the customer:

**Visual Identity Gaps:**
- Do you have an existing brand guide or logo kit we should use?
- Are there competitor products whose visual style you admire or want to avoid?
- What colours represent your brand? Any colours that must NOT be used?

**UX Gaps:**
- Are there existing products (internal or external) whose UX patterns you want to adopt?
- What are the top 3 pain points users have with the current system (if replacing something)?
- Are there specific accessibility requirements or regulations we must comply with?

**AI Feature Gaps:**
- Which features will use AI (generative, predictive, or search)?
- How should AI-generated content be labelled or disclosed to users?

---

### Step 3: Write the UI/UX Guidelines Document

Open `Master-Documents/UI-UX-Template.md`. Fill all six major sections:

#### Section 1 — Business DNA
```
Product name, mission statement, brand personality, target market,
competitive positioning, primary success metrics (UX-related).
```

#### Section 2 — Audience & Accessibility
```
User personas (name, role, goals, frustrations, tech proficiency),
device/browser matrix, WCAG compliance level, i18n/RTL requirements.
```

#### Section 3 — Visual Identity (Design System)
```
Colour palette (primary, secondary, accent, semantic colours with hex codes),
typography scale (font family, sizes H1–H6, body, caption),
spacing system (base unit, grid, margins, padding),
border radius, shadow, elevation system,
icon library selection and style guide,
logo usage rules (minimum size, clear space, forbidden uses).
```

#### Section 4 — UX Patterns & Interaction Design
```
Navigation architecture (sitemap, primary nav, secondary nav),
layout templates (page grid, responsive breakpoints),
component library: buttons, forms, tables, cards, modals, toasts, badges,
interaction states: default, hover, active, disabled, focus, error,
loading patterns: skeleton screens, spinners, progress bars,
empty state templates: illustrations + copy pattern,
error state templates: 404, 500, validation error, permission denied,
data input patterns: inline validation, character limits, masked inputs,
confirmation patterns: destructive action dialogs, undo patterns.
```

#### Section 5 — AI Feature UX (if applicable)
```
AI feature list and their UX entry points,
AI disclosure / labelling pattern ("Generated by AI" badge),
AI confidence and uncertainty UX (show/hide confidence scores),
AI loading UX (streaming text, thinking indicators),
AI fallback UX (graceful degradation when AI is unavailable),
user control over AI (opt-in/opt-out, override AI suggestion).
```

#### Section 6 — Creative Assets
```
Required illustrations (list by screen/context),
icon library selection + custom icon specs,
image guidelines (aspect ratio, subject matter, photo style),
animation guidelines (duration, easing, motion principles),
asset file formats (SVG for icons, WebP for images, Lottie for animation),
asset naming and folder structure conventions.
```

Save the UI/UX Guidelines as:
```
Project-Documents/UI-UX-Guidelines-[ProjectCode].md
```

---

### Step 4: Run the UI/UX Checklist

Run `Master-Documents/UI-UX-Template-Checklist.md`:
- 6 section completeness checks
- 15 cross-section consistency checks (e.g., colours used in wireframes match the palette defined in Section 3)
- Readiness Gate (all must pass before handoff to design/dev)

Common gaps:
- Colour palette defined but semantic colour tokens missing (error red, success green)
- Personas defined but no accessibility profile per persona
- AI features listed but no disclosure UX pattern defined
- Loading states described but skeleton screen specs missing

---

## Output Checklist (Definition of Done)

- [ ] All 6 UI/UX Template sections completed (no blank sections)
- [ ] Colour palette includes hex codes for all colours + semantic tokens
- [ ] Typography scale defined for all heading levels + body + caption
- [ ] WCAG compliance level specified and accessibility requirements documented
- [ ] Navigation pattern and sitemap documented
- [ ] All key UI components specified (buttons, forms, tables, modals, toasts)
- [ ] Loading, empty, and error state patterns defined
- [ ] AI feature UX documented (if product includes AI features)
- [ ] Creative asset list and specifications complete
- [ ] UI-UX-Template-Checklist passes with Readiness Gate satisfied
- [ ] File saved to `Project-Documents/UI-UX-Guidelines-[ProjectCode].md`

---

## Flow Diagram

```
┌──────────────────────────────────┐
│  Gather Inputs                    │
│  (PRD, EPICs, Screens, Brand Kit) │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│  Identify Gaps                   │
│  Ask customer targeted questions │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│  Write UI/UX Guidelines          │
│  (Sections 1–6)                  │
└──────────────┬───────────────────┘
               ▼
┌──────────────────────────────────┐
│  Run UI/UX Checklist             │── Gaps found? ──┐
│  (6 checks + 15 cross-checks     │                 │
│   + Readiness Gate)              │                 │
└──────────────┬───────────────────┘                 │
               │ All checks pass                     │
               ▼                                     │
┌──────────────────────────────────┐                 │
│  UI/UX Guidelines Complete ✅    │◄────────────────┘
└──────────────────────────────────┘
```

---

## Rules

- NEVER finalise the UI/UX guidelines without input from the actual end users or their proxy (customer stakeholder).
- NEVER define colours without a contrast ratio check against WCAG AA (minimum 4.5:1 for normal text).
- The design system in Section 3 must be consistent with what appears in the screen wireframes — discrepancies are gaps.
- If the product has AI features, Section 5 is MANDATORY — not optional.
- Component states (hover, active, disabled, error, focus) must ALL be specified — not just the default state.
- The UI/UX guidelines are a living document — version and date every revision.

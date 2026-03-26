# Functional Landscape Rules

> **Purpose:** Rules for defining, structuring, and documenting a Functional Landscape diagram for any software platform. The Functional Landscape is created before PRD, epics, and user stories — it provides the complete bird's-eye view of what the system does.
> **Sequence:** Functional Landscape → Actors → PRD → Epics → User Stories → Code

---

## What Is a Functional Landscape?

A **Functional Landscape** is a structured visual and written map of all major functional areas (rows) and their constituent modules (boxes) in a software system. It answers the question:

> *"What does this system do, and how does its functionality decompose into buildable, ownable modules?"*

It is NOT:
- A system architecture diagram (that shows how components connect technically)
- A database schema (that shows data structure)
- A roadmap (that shows when things are built)
- A user journey (that shows how users interact)

The Functional Landscape IS:
- A complete inventory of system capabilities
- The source of truth for identifying Epics
- The input to PRD feature scoping
- A communication tool for stakeholders, architects, and product owners

---

## Layer Structure — Bottom to Top

The Functional Landscape is always drawn **bottom to top**, following this progression:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 7 (Top)    │  AI / Intelligence / Cognitive Services │
├───────────────────┼─────────────────────────────────────────┤
│  Layer 6          │  Reporting, Analytics & Dashboards       │
├───────────────────┼─────────────────────────────────────────┤
│  Layer 5          │  User-Facing Applications & Portals      │
├───────────────────┼─────────────────────────────────────────┤
│  Layer 4          │  Business Transactions & Workflows        │
├───────────────────┼─────────────────────────────────────────┤
│  Layer 3          │  Business Services & Domain Logic        │
├───────────────────┼─────────────────────────────────────────┤
│  Layer 2          │  Integration & External Services         │
├───────────────────┼─────────────────────────────────────────┤
│  Layer 1 (Bottom) │  Core Data, Entities & Master Data       │
└───────────────────┴─────────────────────────────────────────┘
```

**Reading the diagram:**
- The **bottom rows** are the foundations — they must exist before anything above them works
- The **middle rows** are business operations — they consume and transform core data
- The **top rows** are intelligence and visibility — they observe and automate everything below
- Each row is **independent enough to name** but **dependent on layers below** it

---

## Layer Definitions

### Layer 1 — Core Data & Master Data
**What:** The fundamental entities, reference data, and configurations the entire system depends on.
**Examples:** Products, Ingredients, Users, Locations, Taxonomy, Configuration, Pricing Rules
**Rule:** No business logic lives here. This is pure data definition.

### Layer 2 — Integration & External Services
**What:** Connectors, adapters, and APIs to external systems — payment gateways, third-party APIs, IoT devices, communication providers.
**Examples:** Payment Gateway, SMS/Email Provider, ERP Connector, IoT Device Hub, OAuth Provider
**Rule:** Integration modules are wrappers only. Business rules are never placed here.

### Layer 3 — Business Services & Domain Logic
**What:** The core business capabilities of the platform — the "engine" that makes it work.
**Examples:** Enrichment Service, Matching Engine, Pricing Engine, Subscription Management, Inventory Management
**Rule:** This is where the most complex domain logic lives. Each module maps to one bounded context.

### Layer 4 — Business Transactions & Workflows
**What:** Multi-step processes, state machines, and user-initiated transactions that orchestrate services from Layer 3.
**Examples:** Order Processing, Lead Pipeline, Onboarding Workflow, Checkout, Outreach Campaign
**Rule:** Transactions call services; services do not call transactions.

### Layer 5 — User-Facing Applications & Portals
**What:** The interfaces through which different actors interact with the platform.
**Examples:** Customer Portal, Admin Dashboard, Mobile App, Agent UI, Self-Service Portal
**Rule:** Each application maps to one or more actor types defined in the Actor Rules file.

### Layer 6 — Reporting, Analytics & Dashboards
**What:** Observability, KPIs, business intelligence, and operational reporting.
**Examples:** Sales Dashboard, Pipeline Report, Usage Analytics, Compliance Reports, Audit Log Viewer
**Rule:** Reporting modules are read-only consumers — they never mutate state.

### Layer 7 — AI / Intelligence / Cognitive Services
**What:** AI-powered capabilities that augment or automate functions across all layers below.
**Examples:** Recommendation Engine, Voice Agent, Predictive Scoring, NLP Search, Chatbot, Anomaly Detection
**Rule:** AI modules are always consumers of lower-layer data — they never own the source of truth.

---

## Module Identification Rules

### What Qualifies as a Module?
A module is a discrete, nameable unit of functionality that:
- Has a clear, single responsibility
- Can be owned by one team or one squad
- Can be built, tested, and deployed somewhat independently
- Can be mapped to one or more Epics

### Module Naming Rules
- Use **noun phrases** for data/entity modules: *Ingredient Catalog*, *User Profile*, *Inventory*
- Use **verb-noun phrases** for service/action modules: *Order Processing*, *Lead Matching*, *Contact Enrichment*
- Use **noun + modifier** for specialised variants: *AI Search*, *Voice Agent*, *Real-Time Dashboard*
- Keep names to **1–4 words** — if you need more, the module is probably two modules
- Avoid technical names: no `UserService`, `DataProcessor`, `APIHandler` — use business language

### Module Granularity Rules
| Too Large | Correct Size | Too Small |
|---|---|---|
| Spans multiple layers | Fits within one layer | A single API endpoint |
| Has 20+ sub-features | Has 3–8 sub-features | A single database table |
| Takes 6+ months | Takes 2–12 weeks | Takes 1–2 days |
| Would be its own product | Owns one domain concept | A config toggle |

**Rule:** If a module cannot be explained in one sentence, split it. If a module is only ever used inside another module, merge it.

### Module Count Per Layer
| Layer | Typical Module Count | Maximum |
|---|---|---|
| Core Data | 5–15 | 20 |
| Integration | 3–10 | 15 |
| Business Services | 5–15 | 20 |
| Transactions | 3–10 | 15 |
| Applications | 2–6 | 8 |
| Reporting | 3–10 | 12 |
| AI / Intelligence | 2–8 | 10 |

**Rule:** If any layer exceeds its maximum, it likely contains multiple sublayers. Split the layer and name each sublayer distinctly.

---

## Functional Landscape Document Template

Create one document per project at `docs/functional-landscape/FUNCTIONAL_LANDSCAPE.md`.

```markdown
# Functional Landscape — <Project Name>

**Version:** 1.0
**Status:** Draft | Reviewed | Approved
**Owner:** <Product Owner / Architect>
**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD

---

## System Purpose
<2–3 sentences. What problem does this system solve? Who benefits?>

## Actors
> See [actor-roles-rules.md](./actor-roles-rules.md) and the project-specific actor definitions.
<List actors here — link to the detailed Actor document>

---

## Layer 7 — AI / Intelligence
| Module | Description | Priority | Linked Epic |
|---|---|---|---|
| <Module Name> | <What it does in one sentence> | High / Med / Low | EPIC-<ID> |

## Layer 6 — Reporting & Analytics
| Module | Description | Priority | Linked Epic |
|---|---|---|---|

## Layer 5 — Applications & Portals
| Module | Description | Actor(s) | Linked Epic |
|---|---|---|---|

## Layer 4 — Transactions & Workflows
| Module | Description | Priority | Linked Epic |
|---|---|---|---|

## Layer 3 — Business Services
| Module | Description | Priority | Linked Epic |
|---|---|---|---|

## Layer 2 — Integration & External Services
| Module | Description | External System | Linked Epic |
|---|---|---|---|

## Layer 1 — Core Data & Master Data
| Module | Description | Key Entities | Linked Epic |
|---|---|---|---|

---

## Module Dependency Map
> List which modules depend on which other modules (cross-layer dependencies).

| Module | Depends On | Layer Direction |
|---|---|---|
| <Module A> | <Module B>, <Module C> | Upper → Lower |

---

## Out of Scope
> Explicitly list functional areas that are NOT in this system. Prevents scope creep.

- <Feature or capability not being built>
- <System responsibility belonging to another platform>

---

## Version History
| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | YYYY-MM-DD | <Name> | Initial draft |
```

---

## Functional Landscape → Epic Mapping

Every module in the Functional Landscape must eventually map to at least one Epic. Use this process:

1. **Group related modules** from the same layer into a candidate epic
2. **Name the epic** after the functional area, not the technical implementation
3. **Check sizing** — if a module is large enough (>10 stories estimated), it becomes its own epic
4. **Record the link** — update the `Linked Epic` column in the Functional Landscape document

| Functional Landscape Module | Epic Pattern |
|---|---|
| One small module (3–6 stories) | One Epic |
| One large module (>10 stories) | One Epic per major sub-capability |
| Related modules in same layer | Group into one Epic |
| Cross-layer capability (e.g., Notifications) | One horizontal Epic |

---

## Functional Landscape vs Other Documents

| Document | Purpose | Relationship |
|---|---|---|
| **Functional Landscape** | What the system does (full inventory) | Created first — input to all below |
| **PRD** | What to build, for whom, and why (prioritised) | Selects from Functional Landscape |
| **HLD** | How the system is architected technically | Implements the Functional Landscape |
| **Epics** | What to build in what order (sprints) | One epic per module or module group |
| **User Stories** | Specific behaviours within an epic | Child of epic, child of module |

---

## Diagram Conventions (for Slide / Whiteboard Version)

When producing the visual Functional Landscape diagram:

- **Each row = one layer**, labelled on the left with the layer name
- **Each box = one module**, labelled with the module name (1–4 words)
- **Rows ordered bottom to top** — Core Data at the bottom, AI at the top
- **Row background colour** distinguishes layers (use a consistent colour scheme per layer type)
- **`...` (ellipsis box)** at the end of a row signals there are more modules not shown in the current view
- **Vertical alignment is not meaningful** — horizontal position within a row has no significance
- **Box size is uniform** within a row — do not use size to imply importance
- **Actors are shown separately** — typically above or beside the diagram, mapped to the Application layer modules they interact with

---

## Rules Summary (Non-Negotiable)

- **Landscape first:** Functional Landscape is created before PRD, before Epics, before any code
- **Bottom-to-top ordering:** Core Data at the bottom; AI/Intelligence at the top
- **Business language only:** Module names use domain terms, not technical terms
- **One responsibility per module:** If a module spans two concerns, split it into two
- **All modules linked to epics:** Every module maps to at least one Epic before development begins
- **Scope boundary documented:** Out of Scope section is mandatory — prevents scope creep
- **Living document:** Functional Landscape is updated when new modules are approved — not frozen after v1
- **Layer integrity:** Modules in Layer N may only depend on modules in Layer N-1 or lower — no upward dependencies

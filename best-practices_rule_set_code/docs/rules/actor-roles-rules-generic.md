# Actor & Roles Rules

> **Purpose:** Rules for identifying, defining, and documenting the actors who interact with a software system, their roles, responsibilities, permissions, and how they map to functional modules and user stories.
> **Sequence:** Actors are defined alongside the Functional Landscape — before PRD, before Epics, before User Stories.
> **Reference:** Every User Story uses actors defined in this document. See `user-story-rules.md`.

---

## What Is an Actor?

An **actor** is any person, organisation, or automated system that interacts with the platform — either by initiating actions, receiving outputs, or both.

Actors are NOT:
- Job titles (e.g., "Software Engineer") — unless that person uses the system
- Internal components (e.g., "the database", "the API") — those are system components
- Generic personas like "user" — every actor must have a specific, named role

Actors ARE:
- **Human actors:** real people who log in, submit data, review results, or consume outputs
- **System actors:** automated processes, background jobs, external systems, or scheduled tasks that trigger or consume behaviour
- **External actors:** third-party systems or organisations that integrate with the platform (e.g., payment provider, government portal, ERP system)

---

## Actor Types

| Type | Description | Examples |
|---|---|---|
| **Primary Human Actor** | Directly initiates and benefits from the core system functions | Customer, Sales Rep, Field Technician |
| **Administrative Actor** | Manages the platform, configures rules, monitors health | System Admin, Operations Manager |
| **Supervisory Actor** | Reviews, approves, or oversees work done by others | Sales Manager, Compliance Officer, Approver |
| **Support Actor** | Assists primary actors; does not own the primary workflow | Customer Support Agent, Helpdesk |
| **System Actor** | Automated process, scheduler, or background job | Celery Worker, Cron Job, Event Listener |
| **External System Actor** | Third-party system that sends or receives data | Payment Gateway, CRM, ERP, IoT Device |
| **Anonymous Actor** | Unauthenticated visitor with limited, read-only access | Website Visitor, Public API Consumer |

---

## Actor Identification Process

Follow this process to identify all actors for a project:

### Step 1 — Map Actors to Functional Layers
For each layer in the Functional Landscape, ask: *"Who triggers or consumes this layer?"*

| Functional Layer | Who Typically Interacts |
|---|---|
| Core Data / Master Data | Admin, System Actor (import/seed), Integration Actor |
| Integration Services | System Actor, External System Actor |
| Business Services | System Actor, occasionally Admin (config) |
| Transactions & Workflows | Primary Human Actor, Supervisory Actor, System Actor |
| Applications & Portals | Primary Human Actor, Support Actor, Admin |
| Reporting & Dashboards | Supervisory Actor, Admin, Primary Human Actor (own data) |
| AI / Intelligence | Primary Human Actor (consumes outputs), System Actor (triggers) |

### Step 2 — Apply the CRUD Test
For each actor, ask: *"What can this actor Create, Read, Update, Delete?"*
Any actor with zero CRUD interactions is not a system actor — they may be a stakeholder (documented separately).

### Step 3 — Check for Missing Actors
Run this checklist:
- [ ] Who creates the core data (master data, config, products)?
- [ ] Who processes the primary business transactions?
- [ ] Who approves or rejects work done by others?
- [ ] Who receives the outputs (reports, notifications, results)?
- [ ] Which automated jobs run without human initiation?
- [ ] Which external systems send data in or receive data out?
- [ ] Who can view everything but change nothing? (read-only supervisor/auditor)
- [ ] Who manages other actors' access? (user admin)

---

## Actor Definition Template

Define every actor using this template. Store all actor definitions in the project-specific guidelines.

```markdown
## Actor: <Actor Name>

**Type:** Primary Human | Administrative | Supervisory | Support | System | External System | Anonymous
**Authentication:** Authenticated | Unauthenticated | Service Token | API Key | OAuth
**Scope:** <Which part of the platform this actor primarily operates in>

### Description
<2–3 sentences. Who is this actor? What is their primary goal in using the system?>

### Responsibilities
- <What this actor is accountable for doing in the system>
- <Key decisions they make>
- <Key outputs they produce>

### Key Permissions
| Capability | Access Level | Notes |
|---|---|---|
| <Feature or module> | Full / Read-Only / Create / Approve / None | <Condition or constraint> |

### Interaction Points
> Which Functional Landscape modules does this actor directly use?

| Layer | Module | Interaction Type |
|---|---|---|
| <Layer name> | <Module name> | Initiates / Consumes / Approves / Configures |

### Constraints & Business Rules
- <What this actor cannot do — explicit restrictions>
- <Conditions under which their access or capability changes>

### User Story Actor Label
> The exact string to use in "As a **<actor>**" user stories.

`<actor-label>` — e.g., `manager`, `rep`, `system`, `admin`
```

---

## Role vs Actor — Key Distinction

| Concept | Definition | Example |
|---|---|---|
| **Actor** | The entity that interacts with the system | `manager` |
| **Role** | A named permission set assigned to an actor | `ROLE_MANAGER` |
| **Permission** | A specific capability granted by a role | `leads:approve_outreach` |

An actor may hold multiple roles. A role grants multiple permissions. Never design system behaviour around actors directly — always model through roles and permissions.

```
Actor (human/system)
  └── has one or more Roles
        └── each Role has one or more Permissions
              └── each Permission allows one or more Actions on one or more Resources
```

---

## Role Definition Template

```markdown
## Role: <Role Name>

**Identifier:** `ROLE_<NAME>` (e.g., `ROLE_MANAGER`)
**Assigned To:** <Which actor(s) hold this role by default>
**Inherits From:** <Parent role if using role hierarchy, or "None">

### Permissions

| Resource | Actions Allowed | Conditions |
|---|---|---|
| <Resource/Module> | create, read, update, delete, approve | <e.g., "own records only", "within assigned territory"> |

### Restrictions
- <What this role explicitly cannot do>
- <Data scoping rules — e.g., "can only see leads assigned to them">
```

---

## RBAC Design Rules

Role-Based Access Control (RBAC) governs what actors can do. Follow these rules:

### Rule 1 — Least Privilege
Every actor starts with the minimum permissions needed. Additional access is granted explicitly, never assumed.

### Rule 2 — Role Hierarchy
Define a clear inheritance chain. Lower roles inherit from more restricted parent roles:
```
super_admin
  └── admin
        └── manager
              └── rep / operator
                    └── read_only / viewer
```

### Rule 3 — Resource + Action Model
Permissions are always expressed as `<resource>:<action>`, not as booleans:
- `leads:read` — can view leads
- `leads:create` — can create leads
- `outreach:approve` — can approve outreach
- `config:write` — can change system configuration

### Rule 4 — No UI-Only Security
Hiding a button is not security. Every permission must be enforced at the API/service layer. UI hides; the backend enforces.

### Rule 5 — Data Scoping
Define data scope per role:
- **Global scope:** actor sees all records in the system
- **Organisation scope:** actor sees records within their organisation/tenant
- **Own scope:** actor sees only records they created or are assigned to
- **Custom scope:** actor sees records matching a custom rule (e.g., territory, product line)

### Rule 6 — Audit Trail
Every action taken by an actor is logged with: actor ID, role at time of action, timestamp, resource, action performed, and outcome.

---

## Actor–Module Mapping Matrix Template

Create a matrix showing which actors interact with which Functional Landscape modules. Store this in `docs/functional-landscape/ACTOR_MODULE_MATRIX.md`.

```markdown
# Actor–Module Interaction Matrix

> Legend: C = Create, R = Read, U = Update, D = Delete, A = Approve, — = No access

| Module | admin | manager | rep | system | external |
|---|---|---|---|---|---|
| <Module Name> | CRUD | R, A | R | C, U | — |
| <Module Name> | CRUD | R | — | C | R |
```

---

## Actor Documentation File Structure

```
docs/
  functional-landscape/
    FUNCTIONAL_LANDSCAPE.md     ← Layer/module inventory
    ACTOR_MODULE_MATRIX.md      ← Actor × module interaction grid
  actors/
    ACTORS.md                   ← Actor index (all actors listed)
    <actor-name>.md             ← One file per actor (using Actor Definition Template)
  roles/
    ROLES.md                    ← Role index with permission summary
    <role-name>.md              ← One file per role (using Role Definition Template)
```

---

## Actor Index Template

Maintain `docs/actors/ACTORS.md`:

```markdown
# Actor Index

| Actor Label | Type | Authentication | Description | Defined In |
|---|---|---|---|---|
| `admin` | Administrative | Authenticated | Full platform access | [admin.md](admin.md) |
| `manager` | Supervisory | Authenticated | Approves and monitors | [manager.md](manager.md) |
| `rep` | Primary Human | Authenticated | Day-to-day operations | [rep.md](rep.md) |
| `system` | System Actor | Service Token | Background automation | [system.md](system.md) |
| `<actor>` | <Type> | <Auth method> | <One-line description> | [<file>.md](<file>.md) |
```

---

## Actors and User Stories

Every User Story starts with: *"As a **`<actor-label>`**, I want…"*

Rules:
- Use **only** actor labels defined in `docs/actors/ACTORS.md`
- Do not create new actor names in a user story — add the actor to the index first
- System actors appear in stories for background/automated behaviour: *"As the **system**, I want to…"*
- If multiple actors share the same story, write separate stories — one per actor perspective
- The actor label in a story must exactly match the `User Story Actor Label` field in the actor definition

---

## Actors and the Functional Landscape

When completing the Functional Landscape document:

1. List all actors in the **Actors section** of `FUNCTIONAL_LANDSCAPE.md`
2. For the **Applications & Portals layer**, label each module with its primary actor(s)
3. Complete the **Actor–Module Matrix** to make access patterns explicit
4. Reference the Actor definitions from all Epic and User Story documents

---

## Rules Summary (Non-Negotiable)

- **Actors defined before PRD:** Actor index is complete before any Epics or User Stories are written
- **No generic "user" actor:** Every actor has a specific, named role — never use "user" as an actor label
- **RBAC modelled explicitly:** Every actor has a defined role with permissions using `<resource>:<action>` format
- **Least privilege default:** Actors start with minimum permissions; access is granted, not assumed
- **API-layer enforcement:** All permissions enforced at service/API layer — UI visibility is complementary, not sufficient
- **Data scoping stated:** Every role specifies its data scope (global / org / own / custom)
- **Audit trail required:** Every actor action is logged with actor, role, timestamp, resource, action, outcome
- **Traceability maintained:** Actor labels in user stories must match the Actor Index exactly
- **One file per actor:** Each actor has its own definition file in `docs/actors/`
- **Matrix kept current:** Actor–Module Matrix updated whenever new modules or actors are added

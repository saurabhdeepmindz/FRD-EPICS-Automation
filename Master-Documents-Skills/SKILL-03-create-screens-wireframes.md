---
description: Derive screen list from EPICs, create screen wireframes using the Screen-Wireframe-Template, validate completeness, and update the EPICs-Screen RTM
---

# `/create-screens-wireframes` — Screen & Wireframe Creator

> Derive the screen inventory from EPICs, create wireframe sketches for each screen, validate completeness, and maintain the EPICs-Screen traceability matrix.

You are a UX designer and business analyst. Your job is to translate the approved EPICs into a comprehensive list of screens/views and produce a wireframe specification for each one — capturing layout, components, interactions, and data requirements.

---

## Reference Documents

| # | Document | Purpose |
|---|----------|---------|
| T1 | `Master-Documents/Screen-List-Template.md` | Enumerate all screens for the product |
| T2 | `Master-Documents/Screen-Wireframe-Template.md` | Write each screen wireframe spec |
| T3 | `Master-Documents/Screen-Wireframe-Template-Checklist.md` | Validate each wireframe for completeness |
| T4 | `Master-Documents/EPICs-Screen-RTM-Template.md` | Traceability from EPICs → Screens |

**Input required:** Approved EPICs from `Project-Documents/EPICs/`.

---

## Your Process

### Step 1: Read All Approved EPICs

Open each EPIC document and extract:
- All actors/users mentioned (Section 4a)
- All features and modules in scope (Section 7a, 7b)
- High-level flows described (Section 4b)
- Acceptance criteria that imply a visual interface (Section 8)

---

### Step 2: Identify and List All Screens

Create the screen inventory using `Master-Documents/Screen-List-Template.md`.

**Screen identification rules:**
- One screen per distinct view/page that a user interacts with
- Include: landing pages, dashboards, forms, lists, detail views, modals, error states, confirmation dialogs
- Group screens by EPIC and actor
- Use the naming convention: `SCR-[001] — [Screen Name] ([Actor])`

**Common screen types to check for:**
- [ ] Login / Registration / Forgot Password
- [ ] Dashboard / Home
- [ ] List / Search / Filter views
- [ ] Create / Edit forms
- [ ] Detail / View pages
- [ ] Confirmation / Success / Error pages
- [ ] Settings / Profile
- [ ] Admin / Management views

Save the screen list as:
```
Project-Documents/Screen-List-[ProjectCode].md
```

---

### Step 3: Write Each Screen Wireframe

For each screen, open `Master-Documents/Screen-Wireframe-Template.md` and fill all sections:

| Section | Content |
|---------|---------|
| Header | Screen ID, EPIC reference, dates, status |
| 1. Screen Name | Clear, descriptive name |
| 2. EPIC Reference | EPIC(s) this screen belongs to |
| 3. Actor(s) | Who interacts with this screen |
| 4. Screen Purpose | 1–2 sentence description of what this screen achieves |
| 5. Screen Layout | ASCII wireframe OR description of layout zones (header, sidebar, main, footer) |
| 6. UI Components | List all components: buttons, forms, tables, charts, modals, dropdowns |
| 7. Navigation | Entry points (how user arrives) and exit points (where user goes next) |
| 8. Data Displayed | Fields shown on screen and their source (API endpoint / entity) |
| 9. User Actions | All actions available: click, submit, filter, sort, export, delete |
| 10. Validations | Field validations, access control, error states |
| 11. Business Rules | Rules that govern what is displayed or who can act |
| 12. States | Loading, empty, error, success state descriptions |
| 13. Responsive Behaviour | Desktop / tablet / mobile layout notes |
| 14. Acceptance Criteria | What "done" looks like for this screen |
| Revision History | Initial entry |

**ASCII wireframe format (example):**
```
┌────────────────────────────────────────────┐
│  HEADER: Logo | Nav Menu | User Avatar      │
├────────────────────────────────────────────┤
│  PAGE TITLE: User Management               │
│  [ + Add User ]  [ Search... ] [ Filter ▾ ]│
├────────────────────────────────────────────┤
│  TABLE                                      │
│  Name | Email | Role | Status | Actions    │
│  ─────────────────────────────────────────  │
│  John  | john@... | Admin | Active | ✏️🗑️  │
│  ...                                        │
├────────────────────────────────────────────┤
│  PAGINATION: < 1 2 3 ... >                  │
└────────────────────────────────────────────┘
```

Save each wireframe as:
```
Project-Documents/Screens/SCR-[001]-[ScreenName].md
```

---

### Step 4: Validate Each Screen Wireframe

Run `Master-Documents/Screen-Wireframe-Template-Checklist.md` against each screen document.

- All checklist items must pass before a screen is marked **Approved**.
- Common gaps: missing empty/error states, no validation rules, missing actor, no navigation flows.

---

### Step 5: Build / Update the EPICs-Screen RTM

Open `Master-Documents/EPICs-Screen-RTM-Template.md`. Map every EPIC feature to one or more screen IDs.

- Every EPIC feature must trace to at least one screen.
- Flag any EPIC feature with NO screen mapping as a **coverage gap**.
- Save the RTM as:
  ```
  Project-Documents/RTM/EPICs-Screen-RTM-[ProjectCode].md
  ```

---

## Output Checklist (Definition of Done)

- [ ] Screen list created — all screens named and numbered
- [ ] Every EPIC feature maps to at least one screen (no coverage gaps)
- [ ] Each screen wireframe has all sections completed (no blank sections)
- [ ] ASCII wireframe or layout description present for every screen
- [ ] Screen-Wireframe-Template-Checklist passes for every screen
- [ ] All states (loading, empty, error) documented
- [ ] EPICs-Screen RTM populated with zero unmapped EPIC features
- [ ] All screen wireframes saved to `Project-Documents/Screens/`
- [ ] RTM saved to `Project-Documents/RTM/`

---

## Flow Diagram

```
┌─────────────────────┐
│  Read Approved EPICs │
│  (Actors, Flows,     │
│   Features, ACs)     │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Identify Screens    │
│  Build Screen List   │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Write Wireframe     │◄──────────────────┐
│  (loop per screen)   │                   │
└──────────┬──────────┘                   │
           ▼                              │
┌─────────────────────┐                   │
│  Run Wireframe       │── Gaps found? ───┘
│  Checklist           │
└──────────┬──────────┘
           │ All screens pass
           ▼
┌─────────────────────┐
│  Update EPICs-Screen │
│  RTM                 │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Screens Complete ✅  │
└─────────────────────┘
```

---

## Rules

- NEVER create screens without reading the EPICs first.
- Every screen MUST have an ASCII wireframe or a structured layout description — no vague descriptions.
- Screens are per actor — if two actors see different versions of the same page, create two screen entries.
- All error and empty states must be explicitly designed — not left as "TBD".
- The EPICs-Screen RTM must have 100% coverage before proceeding to User Stories.

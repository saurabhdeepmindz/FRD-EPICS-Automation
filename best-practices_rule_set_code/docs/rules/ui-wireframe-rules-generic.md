# UI Wireframe Rules — Generic

> **Scope:** Generic rules for creating HTML wireframes and screen mockups as part of the pre-development design phase.
> **Stage:** This step belongs between Stage 3 (Architecture) and Stage 5 (Agile Planning).
> **Project-specific override:** `project-specific-guidelines/rules/ui-wireframe-rules.md`

---

## Purpose

Wireframes are low-fidelity visual blueprints of every screen in the application. They are created **before user stories are written** so that:

- Acceptance criteria in user stories describe visible, concrete behaviours
- Developers know exactly what to build before they open an editor
- Stakeholders can validate the UX flow without reading code
- The UI layer has a spec to implement against, just like the API layer has an API spec

**Wireframes are NOT:**
- High-fidelity mockups or pixel-perfect designs
- Prototypes with real data
- Final UI code

---

## When to Create Wireframes

```
Stage 3.5 — API Spec complete          ← data shapes are known
Stage 3.6 — UI Wireframes              ← *** THIS STEP ***
Stage 4   — Design Patterns            ← implementation patterns
Stage 5   — Agile Planning (Stories)   ← stories reference wireframes
Stage 6   — Development                ← implementation follows wireframe
```

**Prerequisite:** API Spec must be complete. Every field shown in a wireframe must correspond to a real API response field.

---

## Format

### Use Static HTML

All wireframes must be created as **self-contained HTML files**:

- Single `.html` file per screen
- Inline CSS only (no external stylesheets, no CDN links — files must work offline)
- No JavaScript (wireframes are static layout documents)
- Grayscale palette only: `#f5f5f5`, `#e0e0e0`, `#bdbdbd`, `#9e9e9e`, `#757575`, `#424242`, `#212121`, `#ffffff`
- Use `font-family: Arial, sans-serif` — no Google Fonts

### Why HTML over Figma/images?

- Version-controllable in git (text diff, PR review)
- No external tool required to view
- Easy to annotate with HTML comments
- Trivially shareable (open in any browser)
- Naturally links between screens via `href`

---

## File Naming Convention

```
docs/wireframes/
├── WF-000-screen-index.html         ← Master index linking all screens
├── WF-001-login.html
├── WF-002-lead-pipeline-dashboard.html
├── WF-003-lead-detail-view.html
├── WF-004-outreach-review-queue.html
├── WF-005-analytics-funnel.html
├── WF-006-admin-users.html
└── WF-007-admin-api-keys.html
```

**Numbering:** Sequential 3-digit prefix.
**Slug:** Matches the screen's primary user story slug where possible.

---

## Screen Anatomy Template

Every wireframe HTML file must include:

### 1. Header block (HTML comment)
```html
<!--
  Screen:     Lead Pipeline Dashboard
  File:       WF-002-lead-pipeline-dashboard.html
  Epic:       EPIC-09
  Stories:    US-032
  Actor(s):   rep, manager, admin
  API calls:  GET /api/v1/leads?status=&tier=&page=&limit=
  Updated:    YYYY-MM-DD
-->
```

### 2. Navigation bar
Shows: app name, current user role badge, navigation links to all screens, logout button.

### 3. Page title + breadcrumb
Matches the screen name in the user story.

### 4. Main content area
The actual screen layout. Use placeholder boxes (`div` with border + background) for charts and images.

### 5. Annotations panel
A right-side or bottom panel listing UX notes, business rules, and API field mappings:
```html
<div class="annotations">
  <h3>Annotations</h3>
  <ul>
    <li><strong>[A1]</strong> Status filter maps to Lead.status enum values</li>
    <li><strong>[A2]</strong> Score column hidden when score IS NULL</li>
  </ul>
</div>
```

### 6. Linked screens section
Footer listing which screens this wireframe links to and from.

---

## Grayscale Component Library

Use these standard components consistently across all wireframes:

### Buttons
```css
/* Primary action */
.btn-primary { background: #424242; color: #fff; padding: 8px 16px; border: none; }
/* Secondary action */
.btn-secondary { background: #fff; color: #424242; padding: 8px 16px; border: 1px solid #424242; }
/* Danger action */
.btn-danger { background: #9e9e9e; color: #fff; padding: 8px 16px; border: none; }
/* Disabled */
.btn-disabled { background: #e0e0e0; color: #9e9e9e; padding: 8px 16px; border: none; }
```

### Status badges
```css
.badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
.badge-dark   { background: #424242; color: #fff; }   /* active/eligible */
.badge-medium { background: #9e9e9e; color: #fff; }   /* pending/processing */
.badge-light  { background: #e0e0e0; color: #424242; } /* inactive/skipped */
```

### Tables
```css
table { width: 100%; border-collapse: collapse; }
th    { background: #e0e0e0; padding: 8px 12px; text-align: left; border-bottom: 2px solid #bdbdbd; }
td    { padding: 8px 12px; border-bottom: 1px solid #e0e0e0; }
tr:hover { background: #f5f5f5; }
```

### Form inputs
```css
input, select, textarea { width: 100%; padding: 8px; border: 1px solid #bdbdbd; background: #fff; }
label { display: block; font-size: 12px; color: #757575; margin-bottom: 4px; }
```

### Chart placeholder
```css
.chart-placeholder {
  background: #f5f5f5;
  border: 2px dashed #bdbdbd;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9e9e9e;
  font-size: 14px;
}
```

### Toast / alert
```css
.toast-success { background: #e0e0e0; border-left: 4px solid #424242; padding: 12px; }
.toast-error   { background: #f5f5f5; border-left: 4px solid #212121; padding: 12px; }
```

---

## Screen Catalog Rules

### Minimum screen set

For every application, wireframes must cover at minimum:

| Screen type | Required |
|---|---|
| Authentication (login/logout) | Always |
| Primary list/table view | Always |
| Detail/form view | Always |
| Error states (401, 403, 404, 500) | Always |
| Admin management | If admin role exists |
| Analytics/reporting | If dashboard exists |

### Role visibility annotation

Every screen must annotate which roles can access it:

```html
<!-- Accessible by: manager, admin -->
<!-- Hidden from:   rep -->
```

And show a role restriction banner for screens that are restricted:

```html
<div class="role-banner">
  Accessible by: <strong>Manager</strong> and <strong>Admin</strong> only
</div>
```

---

## API Field Mapping

Every data field shown in a wireframe must be annotated with its API source:

```html
<td>[company_name] ← Lead.company_name</td>
<td>[status] ← Lead.status (enum)</td>
<td>[score] ← Lead.score (nullable, show — when null)</td>
```

This ensures:
- No field is shown that doesn't exist in the API
- Developer knows exactly which field to bind
- Null/empty states are explicitly designed

---

## Empty and Error States

Every list view, table, and chart must have an explicit empty state wireframe (or annotated section):

```html
<!-- EMPTY STATE: shown when API returns 0 results -->
<div class="empty-state">
  <p>No leads found matching the current filters.</p>
  <button class="btn-secondary">Clear filters</button>
</div>
```

Every form must show validation error state:
```html
<!-- ERROR STATE: field validation failure -->
<div class="field-error">company_name is required</div>
```

---

## Screen Index File (WF-000)

The index file must:
1. List every screen with a hyperlink
2. Show the EPIC and user story each screen covers
3. Show the actor(s) for each screen
4. Show the current status of each wireframe (Draft / Review / Approved)

---

## Definition of Done — Wireframe

A wireframe is considered **complete** when:

- [ ] HTML file created in `docs/wireframes/`
- [ ] Header comment block filled in (screen, file, epic, stories, actors, API calls, date)
- [ ] Navigation bar present
- [ ] All data fields annotated with API field name
- [ ] Empty state designed
- [ ] All error states designed (validation, auth, 404, 500)
- [ ] Role visibility annotated
- [ ] All action buttons present (with disabled state where applicable)
- [ ] Annotations panel complete
- [ ] Entry added to `WF-000-screen-index.html`
- [ ] Linked from relevant user story files (under a "Wireframe" section)
- [ ] Reviewed by at least one stakeholder or tech lead

---

## Wireframe → User Story Link

After creating a wireframe, update the relevant user story file to include a wireframe reference:

```markdown
## Wireframe

**Screen:** Lead Pipeline Dashboard
**File:** `docs/wireframes/WF-002-lead-pipeline-dashboard.html`
**Annotations:** See [A1]–[A5] in wireframe for field mappings and business rule notes.
```

---

## Wireframe → Implementation Link

When the Streamlit (or other UI) page is implemented, update the wireframe header comment:

```html
<!-- Implementation: src/ui/pages/leads.py (Increment 8, US-032) -->
```

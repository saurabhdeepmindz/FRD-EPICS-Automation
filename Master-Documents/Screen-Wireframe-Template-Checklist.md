# Screen Wireframe Template Checklist

> **Document Flow:** BRD → FRD → Initiative → EPIC → User Story → SubTask
> **Design Flow:** Screen Wireframe → High-Fidelity Mockup (Figma) → UI Development
>
> This checklist is used to verify that a Screen Wireframe document is complete,
> consistent, and ready for handoff to a UI/UX designer for high-fidelity mockup creation.
> Review every applicable item before marking the wireframe status as **Approved**.
>
> **Status Values:**
> - `[ ]` — Not yet done
> - `[x]` — Complete
> - `[N/A]` — Not applicable (provide reason in parentheses)

---

## How to Use This Checklist

1. Complete the Screen Wireframe document first, then use this checklist to review it.
2. Work through each section in order.
3. Mark `[N/A]` only when a control type or section genuinely does not appear on this screen.
4. All items in the **Final Readiness Gate** must be `[x]` before the wireframe is approved.
5. The **Sign-off** block must be completed before the design handoff begins.

---

## Screen Reference

```
Screen ID       : SCR-[XXX]
Screen Name     : [Screen Name]
Checklist Date  : DD-MMM-YYYY
Reviewed By     : [Name / Role]
```

---

## Table of Contents

| # | Section |
| --- | --- |
| 0 | Header Block |
| 1 | Screen ID |
| 2 | Screen Description |
| 3 | EPIC References |
| 4 | Screen Navigation |
| 5A | Fields |
| 5B | Charts |
| 5C | Analytics |
| 5D | Tables |
| 5E | Details / Info Panels |
| 5F | Actions / Buttons |
| 6 | Screen Mockup |
| 7 | Design Handoff Notes |
| — | Revision History |
| CC | Cross-Section Consistency Checks |
| CT | Control Type Applicability Summary |
| G | Final Readiness Gate |

---

## Section 0 — Header Block

| # | Check | Status |
| --- | --- | --- |
| 0.1 | Screen ID is filled in and follows the format `SCR-[XXX]` (zero-padded, e.g., SCR-002) | `[ ]` |
| 0.2 | Screen Name is filled in — short and descriptive | `[ ]` |
| 0.3 | Created Date is filled in (DD-MMM-YYYY format) | `[ ]` |
| 0.4 | Last Updated date is filled in and is on or after Created Date | `[ ]` |
| 0.5 | Author is filled in with a name or role | `[ ]` |
| 0.6 | Status is one of the allowed values: `Draft`, `Under Review`, `Approved`, `In Development`, `Done` | `[ ]` |
| 0.7 | Figma Link is populated once the high-fidelity design is created, or marked as "To be populated" in Draft status | `[ ]` |

---

## Section 1 — Screen ID

| # | Check | Status |
| --- | --- | --- |
| 1.1 | Screen ID is filled in and matches the Screen ID in the Header Block | `[ ]` |
| 1.2 | Screen Name is filled in and matches the Screen Name in the Header Block | `[ ]` |
| 1.3 | Screen ID is globally unique — no other screen in the application uses the same `SCR-[XXX]` number | `[ ]` |

---

## Section 2 — Screen Description

| # | Check | Status |
| --- | --- | --- |
| 2.1 | Description is filled in (not a placeholder or "TBD") | `[ ]` |
| 2.2 | **Purpose** is described — what the screen allows the user to do | `[ ]` |
| 2.3 | **Context** is described — where in the user journey this screen appears | `[ ]` |
| 2.4 | **User Type** is identified — who interacts with this screen | `[ ]` |
| 2.5 | **Business Rules** governing this screen are listed by rule ID (e.g., BR-01, BR-02) | `[ ]` |
| 2.6 | Each listed Business Rule is traceable to the parent User Story or EPIC document | `[ ]` |
| 2.7 | **Conditional Display Logic** is documented — which elements show/hide based on state or input | `[ ]` |
| 2.8 | **Outcome** is described — what happens after the user successfully completes this screen | `[ ]` |
| 2.9 | The description is detailed enough for a designer to understand context without opening the EPIC or User Story documents | `[ ]` |

---

## Section 3 — EPIC References

| # | Check | Status |
| --- | --- | --- |
| 3.1 | At least one EPIC is listed | `[ ]` |
| 3.2 | Each EPIC row has an EPIC ID in the format `EPIC-[XXX]` | `[ ]` |
| 3.3 | Each EPIC row has a non-empty EPIC Description | `[ ]` |
| 3.4 | EPIC IDs and Descriptions match the parent EPIC documents exactly — no paraphrasing | `[ ]` |
| 3.5 | Related User Story IDs are listed for each EPIC — all User Stories that reference this screen are included | `[ ]` |
| 3.6 | If the screen is shared across multiple EPICs, all EPICs are listed as separate rows | `[ ]` |

---

## Section 4 — Screen Navigation

### 4A — Navigation Map

| # | Check | Status |
| --- | --- | --- |
| 4A.1 | At least one Previous (Back) entry is listed, or explicitly marked N/A (e.g., the screen is a landing page with no back navigation) | `[ ]` |
| 4A.2 | At least one Next (Forward) entry is listed, or explicitly marked N/A (e.g., the screen is a terminal confirmation page) | `[ ]` |
| 4A.3 | Cancel / Exit path is documented, or explicitly marked N/A | `[ ]` |
| 4A.4 | Error Redirect / Session Timeout path is documented where applicable | `[ ]` |
| 4A.5 | Each navigation row specifies the correct target Screen ID and Screen Name | `[ ]` |
| 4A.6 | Each navigation row specifies the trigger or condition (button click, validation pass, timeout, etc.) | `[ ]` |
| 4A.7 | All Screen IDs referenced in navigation exist as separate, registered screen documents | `[ ]` |

### 4B — Navigation Flow Diagram

| # | Check | Status |
| --- | --- | --- |
| 4B.1 | A Mermaid flowchart (or equivalent diagram) is provided | `[ ]` |
| 4B.2 | The diagram includes all screens listed in the Navigation Map (4A) | `[ ]` |
| 4B.3 | All navigation edges are labelled with their trigger or condition | `[ ]` |
| 4B.4 | The current screen is visually distinguishable from adjacent screens in the diagram | `[ ]` |

---

## Section 5A — Fields

> *Mark this entire section `[N/A]` only if the screen contains zero input controls of any kind.*

| # | Check | Status |
| --- | --- | --- |
| 5A.1 | Every input control on the screen has a corresponding row in the Fields table | `[ ]` |
| 5A.2 | Each field has a unique Field ID in the format `FLD-[NNN]` | `[ ]` |
| 5A.3 | Field IDs are sequential with no gaps or duplicates | `[ ]` |
| 5A.4 | UI Label matches exactly what is shown on screen (not the internal variable name) | `[ ]` |
| 5A.5 | Field Type is one of the defined types: Text, Number, Email, Password, Date, Dropdown, Multi-Select, Radio, Checkbox, File, Textarea, Toggle | `[ ]` |
| 5A.6 | Mandatory flag is explicitly set (`Y` or `N`) for every field — no blanks | `[ ]` |
| 5A.7 | Default Value is specified for each field, or confirmed as `blank` / `None selected` | `[ ]` |
| 5A.8 | Placeholder Text is specified for each field where a hint is shown inside the control | `[ ]` |
| 5A.9 | Validation Rules are documented for every mandatory field | `[ ]` |
| 5A.10 | Validation Rules reference specific Business Rule IDs (e.g., BR-02 age check) where a rule drives the validation | `[ ]` |
| 5A.11 | Optional fields explicitly state they have no mandatory validation and reference the Business Rule permitting this | `[ ]` |
| 5A.12 | For Date fields — both the display format (e.g., DD/MM/YYYY) and the internal storage format (e.g., ISO YYYY-MM-DD) are specified | `[ ]` |
| 5A.13 | For Dropdown / Radio / Multi-Select fields — the list of options is documented | `[ ]` |
| 5A.14 | For File Upload fields — allowed file types and maximum file size are specified | `[ ]` |
| 5A.15 | Client-side validations (format, mandatory) are distinguished from server-side validations (uniqueness, business rules) in the Notes column | `[ ]` |

---

## Section 5B — Charts

> *Mark this entire section `[N/A]` if the screen contains no charts.*

| # | Check | Status |
| --- | --- | --- |
| 5B.1 | Every chart on the screen has a corresponding row in the Charts table | `[ ]` |
| 5B.2 | Each chart has a unique Chart ID in the format `CHT-[NNN]` | `[ ]` |
| 5B.3 | Chart Title matches exactly what is displayed as the chart heading on screen | `[ ]` |
| 5B.4 | Chart Type is specified (Bar, Line, Pie, Donut, Scatter, Area, Heatmap, Gauge) | `[ ]` |
| 5B.5 | X-Axis / Category label is specified, or marked N/A for charts without an X-axis (e.g., Pie) | `[ ]` |
| 5B.6 | Y-Axis / Value label is specified, or marked N/A | `[ ]` |
| 5B.7 | Data Source is specified — API endpoint name or dataset identifier | `[ ]` |
| 5B.8 | Available filters (date range, category, etc.) are listed or confirmed as "None" | `[ ]` |
| 5B.9 | Drill-down behaviour is documented in the Notes column if the chart is interactive | `[ ]` |
| 5B.10 | Empty state behaviour is documented (what shows when there is no data) | `[ ]` |

---

## Section 5C — Analytics

> *Mark this entire section `[N/A]` if the screen contains no KPI tiles, metric cards, or summary counters.*

| # | Check | Status |
| --- | --- | --- |
| 5C.1 | Every metric tile or analytics card on the screen has a corresponding row in the Analytics table | `[ ]` |
| 5C.2 | Each metric has a unique Metric ID in the format `MTR-[NNN]` | `[ ]` |
| 5C.3 | Metric Label matches exactly what is displayed on screen | `[ ]` |
| 5C.4 | Metric Type is specified (Count, Percentage, Currency, Duration, Score, Rate) | `[ ]` |
| 5C.5 | Value Format is specified (e.g., `#,##0`, `0.0%`, `₹#,##,##0`) | `[ ]` |
| 5C.6 | Data Source is specified — API endpoint name or dataset identifier | `[ ]` |
| 5C.7 | Refresh Frequency is specified (Real-time, On load, Scheduled) | `[ ]` |
| 5C.8 | Comparison period or trend indicator is documented in Notes if the metric shows a delta (e.g., "↑ 12% vs last month") | `[ ]` |

---

## Section 5D — Tables

> *Mark this entire section `[N/A]` if the screen contains no data grids or tabular listings.*

| # | Check | Status |
| --- | --- | --- |
| 5D.1 | Every table on the screen has a corresponding row in the Tables section | `[ ]` |
| 5D.2 | Each table has a unique Table ID in the format `TBL-[NNN]` | `[ ]` |
| 5D.3 | Table Title matches exactly what is displayed as the table heading on screen | `[ ]` |
| 5D.4 | The purpose of the table is described — what data it lists | `[ ]` |
| 5D.5 | All column names are listed | `[ ]` |
| 5D.6 | Pagination is specified: enabled with page size, or disabled | `[ ]` |
| 5D.7 | Sortable columns are identified — or confirmed as "None" | `[ ]` |
| 5D.8 | Filterable columns are identified — or confirmed as "None" | `[ ]` |
| 5D.9 | Row-level actions are listed (View, Edit, Delete, Download, etc.) — or confirmed as "None" | `[ ]` |
| 5D.10 | Empty state message is documented (what is shown when the table has no records) | `[ ]` |

---

## Section 5E — Details / Info Panels

> *Mark this entire section `[N/A]` if the screen contains no read-only detail panels, sidebars, or summary cards.*

| # | Check | Status |
| --- | --- | --- |
| 5E.1 | Every detail or info panel on the screen has a corresponding row in the Panels table | `[ ]` |
| 5E.2 | Each panel has a unique Panel ID in the format `PNL-[NNN]` | `[ ]` |
| 5E.3 | Panel Title matches exactly what is displayed on screen | `[ ]` |
| 5E.4 | The purpose of the panel is described | `[ ]` |
| 5E.5 | All fields displayed within the panel are listed | `[ ]` |
| 5E.6 | The trigger for showing the panel is specified (Always visible, On row select, On button click) | `[ ]` |
| 5E.7 | Panel behaviour is noted: expandable, collapsible, modal, sidebar, inline, etc. | `[ ]` |

---

## Section 5F — Actions / Buttons

| # | Check | Status |
| --- | --- | --- |
| 5F.1 | Every button, link, and icon control on the screen has a corresponding row in the Actions table | `[ ]` |
| 5F.2 | Each action has a unique Action ID in the format `ACT-[NNN]` | `[ ]` |
| 5F.3 | Label matches exactly what is displayed on the button or link on screen | `[ ]` |
| 5F.4 | Button Type is specified (Primary, Secondary, Danger, Link, Icon) | `[ ]` |
| 5F.5 | Position on screen is described (e.g., Bottom-right footer, Top toolbar, Inline within row) | `[ ]` |
| 5F.6 | Action Triggered is described (Navigate, Submit, Open Modal, Download, Reset, etc.) | `[ ]` |
| 5F.7 | Target Screen ID is specified for all navigation actions, or marked N/A for non-navigation actions | `[ ]` |
| 5F.8 | Enabled Condition is specified — when is the button enabled vs disabled (Always, Only when form is valid, Only when row is selected, etc.) | `[ ]` |
| 5F.9 | Confirmation dialogs are noted in the Notes column for destructive or irreversible actions (Delete, Cancel, Submit) | `[ ]` |
| 5F.10 | Loading / in-progress state is documented for buttons that trigger async operations (e.g., spinner on Next during API call) | `[ ]` |
| 5F.11 | All buttons listed in Section 5F are visible in the ASCII wireframe sketch in Section 6 | `[ ]` |

---

## Section 6 — Screen Mockup

### 6A — ASCII Wireframe

| # | Check | Status |
| --- | --- | --- |
| 6A.1 | At least one mockup format (ASCII, Mermaid, or Excalidraw) is provided | `[ ]` |
| 6A.2 | The ASCII sketch (if provided) is in a fenced code block so it renders with monospace font in all Markdown viewers | `[ ]` |
| 6A.3 | The overall page structure is shown: header / body / footer regions are identifiable | `[ ]` |
| 6A.4 | All fields listed in Section 5A are visible in the sketch | `[ ]` |
| 6A.5 | All charts listed in Section 5B are represented (can be a labelled placeholder box) | `[ ]` |
| 6A.6 | All analytics tiles listed in Section 5C are represented | `[ ]` |
| 6A.7 | All tables listed in Section 5D are represented (can be a labelled placeholder box) | `[ ]` |
| 6A.8 | All detail/info panels listed in Section 5E are shown | `[ ]` |
| 6A.9 | All action buttons listed in Section 5F are shown in the sketch with their labels | `[ ]` |
| 6A.10 | Mandatory fields are marked with `*` or an equivalent indicator in the sketch | `[ ]` |
| 6A.11 | At least one error state sketch is provided showing inline error messages for a field or form | `[ ]` |
| 6A.12 | A legend is provided explaining symbols used (e.g., `*` = mandatory, `(○)` = radio, `[▼]` = dropdown) | `[ ]` |

### 6B — Mermaid Layout Diagram

| # | Check | Status |
| --- | --- | --- |
| 6B.1 | A Mermaid diagram is provided, or this section is explicitly marked as optional and omitted | `[ ]` |
| 6B.2 | If provided — the diagram represents the screen's section hierarchy from top to bottom | `[ ]` |
| 6B.3 | If provided — all major layout regions (header, form sections, footer) appear as nodes | `[ ]` |

### 6C — Excalidraw Reference

| # | Check | Status |
| --- | --- | --- |
| 6C.1 | If an Excalidraw sketch is provided, it is in a fenced `excalidraw` code block | `[ ]` |
| 6C.2 | If provided — the JSON payload is valid and the file can be opened in Excalidraw or the VS Code extension | `[ ]` |

---

## Section 7 — Design Handoff Notes

### 7A — Visual Design Notes

| # | Check | Status |
| --- | --- | --- |
| 7A.1 | Typography specifications are provided (heading style, label style, placeholder style, error text style) | `[ ]` |
| 7A.2 | Colour palette is specified for all states: default, focus, error, disabled, success | `[ ]` |
| 7A.3 | Hex colour codes are provided for every colour reference — not just colour names | `[ ]` |
| 7A.4 | Spacing and padding values are documented (field gaps, section padding, row spacing) | `[ ]` |
| 7A.5 | Border radius values are specified for input fields and buttons | `[ ]` |
| 7A.6 | Component library reference is specified (e.g., Material UI v5, Ant Design, Tailwind) | `[ ]` |
| 7A.7 | Specific component names from the library are referenced where applicable (e.g., TextField outlined variant) | `[ ]` |

### 7B — Responsive Breakpoints

| # | Check | Status |
| --- | --- | --- |
| 7B.1 | At least Desktop and Mobile breakpoints are documented | `[ ]` |
| 7B.2 | Each breakpoint specifies the pixel width threshold | `[ ]` |
| 7B.3 | Layout changes at each breakpoint are described (e.g., two-column → single-column, sticky footer) | `[ ]` |

### 7C — Accessibility Requirements

| # | Check | Status |
| --- | --- | --- |
| 7C.1 | All input fields are confirmed to have associated `<label>` elements (not placeholder-only) | `[ ]` |
| 7C.2 | Error messages are confirmed to use `aria-describedby` to link to their input | `[ ]` |
| 7C.3 | `aria-invalid="true"` requirement is documented for fields in error state | `[ ]` |
| 7C.4 | `aria-required="true"` requirement is documented for all mandatory fields | `[ ]` |
| 7C.5 | Tab order is explicitly documented for the full screen | `[ ]` |
| 7C.6 | Minimum touch target size is specified (44×44px recommended) | `[ ]` |
| 7C.7 | WCAG 2.1 AA colour contrast compliance is confirmed for all text/background combinations | `[ ]` |
| 7C.8 | Any interactive components (date picker, modal, dropdown) are confirmed to be keyboard-navigable | `[ ]` |
| 7C.9 | Screen-reader behaviour for dynamic elements (progress indicators, error messages, modals) is documented | `[ ]` |

### 7D — Figma Handoff Checklist

| # | Check | Status |
| --- | --- | --- |
| 7D.1 | Figma handoff checklist is included in the document | `[ ]` |
| 7D.2 | The checklist covers: all controls represented, interactive prototype links, error states, empty states | `[ ]` |
| 7D.3 | The checklist includes a Product Owner review step before development handoff | `[ ]` |
| 7D.4 | Figma file link is populated in the Header Block once the high-fidelity design is available | `[ ]` |

---

## Revision History

| # | Check | Status |
| --- | --- | --- |
| RH.1 | Revision History table is present | `[ ]` |
| RH.2 | Version 1.0 entry exists with Created Date, Author, and "Initial wireframe draft" as description | `[ ]` |
| RH.3 | Every subsequent edit has a corresponding version entry with date, author, and change description | `[ ]` |

---

## CC — Cross-Section Consistency Checks

> These checks verify that values used in multiple sections remain mutually consistent.

| # | Check | Status |
| --- | --- | --- |
| CC.1 | Screen ID in Section 1 matches the Screen ID in the Header Block | `[ ]` |
| CC.2 | Screen Name in Section 1 matches the Screen Name in the Header Block | `[ ]` |
| CC.3 | EPIC IDs in Section 3 are consistent with the EPICs referenced in the parent User Story documents | `[ ]` |
| CC.4 | User Story IDs in Section 3 are consistent with the User Stories that reference this Screen ID in the UserStory-SubTask-RTM | `[ ]` |
| CC.5 | All Screen IDs listed in the Navigation Map (Section 4A) exist as separate registered screen documents | `[ ]` |
| CC.6 | Navigation triggers in Section 4A are consistent with the Actions listed in Section 5F (e.g., the "Next" button in 5F navigates to the same screen as listed in 4A) | `[ ]` |
| CC.7 | All fields listed in Section 5A appear in the ASCII wireframe sketch in Section 6A | `[ ]` |
| CC.8 | All buttons listed in Section 5F appear in the ASCII wireframe sketch in Section 6A | `[ ]` |
| CC.9 | Validation rules in Section 5A are consistent with Business Rules documented in Section 2 | `[ ]` |
| CC.10 | Business Rules referenced in Section 2 and Section 5A are traceable to the Business Rules section of the parent User Story document | `[ ]` |
| CC.11 | The User Type described in Section 2 is consistent with the Actor(s) defined in the parent User Story | `[ ]` |
| CC.12 | Colour codes referenced in Section 7A are consistent with the project design system or brand guidelines | `[ ]` |
| CC.13 | Component library referenced in Section 7A is consistent across all screen wireframe documents in the same EPIC | `[ ]` |

---

## CT — Control Type Applicability Summary

> Quick reference: mark each control type as present (P) or not applicable (N/A) for this screen.
> Used to confirm that all applicable sub-sections of Section 5 have been completed.

| Control Type | Present on This Screen | Section Completed |
| --- | --- | --- |
| Fields (input controls) | `[ P ]` / `[ N/A ]` | `[ ]` / `[N/A]` |
| Charts | `[ P ]` / `[ N/A ]` | `[ ]` / `[N/A]` |
| Analytics / KPI Tiles | `[ P ]` / `[ N/A ]` | `[ ]` / `[N/A]` |
| Tables / Data Grids | `[ P ]` / `[ N/A ]` | `[ ]` / `[N/A]` |
| Details / Info Panels | `[ P ]` / `[ N/A ]` | `[ ]` / `[N/A]` |
| Actions / Buttons | `[ P ]` / `[ N/A ]` | `[ ]` / `[N/A]` |

---

## G — Final Readiness Gate

> All 14 gate checks must be `[x]` before the wireframe status is set to **Approved**
> and handed off to the designer. A wireframe failing any gate check must be returned
> to the author for remediation.

| # | Gate Check | Status |
| --- | --- | --- |
| G.1 | All Header Block fields (Section 0) are complete with no placeholders | `[ ]` |
| G.2 | Screen Description (Section 2) covers Purpose, Context, User Type, Business Rules, Conditional Logic, and Outcome | `[ ]` |
| G.3 | At least one EPIC is referenced (Section 3) and verified against the parent EPIC document | `[ ]` |
| G.4 | Screen Navigation (Section 4) is fully documented with a navigation map and a flow diagram | `[ ]` |
| G.5 | All applicable control sections (5A–5F) are completed; unused sections are explicitly marked N/A | `[ ]` |
| G.6 | Every control in Sections 5A–5F has a unique ID (FLD-/CHT-/MTR-/TBL-/PNL-/ACT-) | `[ ]` |
| G.7 | At least one mockup format is provided in Section 6 (ASCII, Mermaid, or Excalidraw) | `[ ]` |
| G.8 | All controls listed in Sections 5A–5F are visually represented in the mockup | `[ ]` |
| G.9 | At least one error state is shown in the mockup for screens with input fields | `[ ]` |
| G.10 | Visual Design Notes (Section 7A) include typography, colours (with hex codes), spacing, and component library | `[ ]` |
| G.11 | Responsive breakpoints are documented for at least Desktop and Mobile (Section 7B) | `[ ]` |
| G.12 | All WCAG 2.1 AA accessibility requirements are addressed (Section 7C) | `[ ]` |
| G.13 | All Cross-Section Consistency Checks (CC.1–CC.13) are resolved | `[ ]` |
| G.14 | Revision History has at least a Version 1.0 entry | `[ ]` |

---

## Sign-off

> The Author must complete this checklist before requesting design review.
> The Product Owner must approve before the Figma designer begins high-fidelity work.

```
Author
  Name              :
  Role              :
  Date              :
  Signature         : [ ] I confirm all applicable checklist items are complete
                          and this wireframe is ready for design handoff

Product Owner Review
  Name              :
  Date              :
  Decision          : [ ] Approved for Design   [ ] Returned — changes required
  Notes             :

UX / Design Lead Review
  Name              :
  Date              :
  Decision          : [ ] Sufficient detail for high-fidelity mockup
                      [ ] Returned — more detail needed in section(s): ___________
  Notes             :

Tech Lead Review (optional — for screens with complex interactions)
  Name              :
  Date              :
  Decision          : [ ] Controls and validations are technically feasible
                      [ ] Flagged concerns: ___________________________________
  Notes             :
```

---

*Checklist Version: 1.0 | Aligned to Screen-Wireframe-Template v1.0 | Last Reviewed: 25-Mar-2026*

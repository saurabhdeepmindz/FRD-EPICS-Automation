# Sprint v9 — Tasks: Look & Feel Studio (Design System) + Wireframe Navigator (Tracks AA–EE)

## Status: ✅ COMPLETE (2026-06-04) — all 11 tasks shipped on `feat/v8-prd-sourced-wireframes` (backend `6571f81`; frontend + tests `5278fb4`). Backend + frontend `tsc` clean; pipeline tests 61/61; Discovery wireframes no-regression. Verified end-to-end: 4 seed presets; save Corporate Blue → lo-fi renders `#0F2A52`; navigator 21KB + zip (42 files); web+mobile live preview; save-as-preset; freshness DESIGN_SYSTEM. Decisions: ① full studio; ② navigator standing output + in-app + zip; ③ per-project tokens + shared preset library.

> **Backlog traceability:** Track AA (data model) → BB (studio backend) → CC (studio frontend) → DD (navigator + downstream token threading) → EE (integration: freshness, readiness, regression).
>
> **Source-of-truth:** the design tokens reuse/formalize the existing `brandTokensSnapshot` shape; the navigator is a deterministic render of the **screen map** (modules→screens) + tokens. The new artifacts are `BaDesignSystem` + `BaDesignPreset` + the navigator generator.
>
> **Sequencing:** AA-01 → BB-01 → BB-02 → CC-01 → CC-02 → CC-03 (studio usable), then DD-01 → DD-02 → DD-03 (navigator + token threading), then EE-01 → EE-02. A single shared `tokensToCss()` util is built in BB-01 and reused by the studio preview, lo-fi, and the navigator.

---

- [x] **Task 1 (AA-01): `BaDesignSystem` + `BaDesignPreset` schema + migration** (P0-DB)
  - `BaDesignSystem` (projectId, version, status, `tokens` JSON, `logo` JSON?, `presetId`?, `sourceArtifactVersions`, metadata); `BaDesignPreset` (name, `scope` GLOBAL|PROJECT, projectId?, tokens, thumbnail, isSeed). Extend `BaWireframeSet` with `designSystemId String?` (+ `designSystemVersion` in `sourceArtifactVersions`).
  - Hand-written SQL migration, applied as `prd_user`; regenerate Prisma client.

- [x] **Task 2 (BB-01): `DesignSystemService` + shared `tokensToCss()`** (P0-BE)
  - `getActive(projectId)` / `save(projectId, tokens, logo)` (versioned); `uploadLogo` (PNG/JPG/SVG, sanitized, stored as data-URI); preset CRUD (`list`, `apply`, `saveAsPreset`, scope GLOBAL|PROJECT); **seed starter presets** (Deepmindz Navy/Orange default + Minimal-Mono, Corporate-Blue, Playful).
  - `tokensToCss(tokens)` → the canonical `:root` CSS block (single source of truth shared by studio preview, lo-fi, navigator); `renderSamplePreview(tokens, platform)` → deterministic sample screen HTML (web + mobile 390px).

- [x] **Task 3 (BB-02): Routes — design system + presets + preview** (P0-BE)
  - `GET/PUT /ba/projects/:id/design-system`, `POST /ba/projects/:id/design-system/logo`, `GET /ba/projects/:id/design-system/preview?platform=web|mobile`, `GET/POST /ba/design-presets` (+ `POST /ba/projects/:id/design-system/apply-preset/:presetId`, `POST /ba/projects/:id/design-presets` for save-as).

- [x] **Task 4 (CC-01): Frontend `pipeline-api` helpers** (P0-FE)
  - `getDesignSystem`, `saveDesignSystem`, `uploadDesignLogo`, `getDesignPreview`, `listDesignPresets`, `applyDesignPreset`, `saveDesignPreset` + `DesignTokens`/`DesignPreset` types.

- [x] **Task 5 (CC-02): Studio page — parameter form + logo** (P0-FE)
  - New `/ba-tool/project/[id]/design-system/page.tsx` (styled like the LLD/architecture pages). Grouped form: Brand (logo upload, product name, primary, accent/CTA, CTA hover, surface) · Neutrals · Semantic · Module palette (auto/manual) · Persona palette · Typography · Shape & density · Platform. Strong defaults; advanced groups collapsible; Save design system.

- [x] **Task 6 (CC-03): Template library + live preview + bidirectional sync** (P0-FE)
  - Preset gallery (thumbnails) → **apply** fills form + re-renders. **Live preview** of a sample screen in **web frame + 390px mobile frame**, re-rendering on any field edit (single in-memory token object as source of truth). **Save as preset** (PROJECT or GLOBAL). Nav button placed **before Wireframes** on the project dashboard + cross-links (Screen-Map → Design System → Wireframes).

- [x] **Task 7 (DD-01): `WireframeNavigatorService` — `index.html` generator** (P0-BE)
  - Deterministic build from screen map (modules via §6 FR-ID prefix + PRD §6 fallback) + tokens + generated/uploaded screens: sidebar (Business/Cross-cutting/Mobile groups), **Web/Mobile/Infra** toggles, phase filter, live search, hero stat tiles, per-module **screen-card grids** (thumbnail + PRD refs + persona chip + status) linking each screen file, mobile section, legend. Uses `tokensToCss()` so the navigator is on-brand.

- [x] **Task 8 (DD-02): Thread tokens into generation + standing navigator output** (P0-BE)
  - Feed the active Design System tokens into lo-fi (deterministic `loFiHtml`) and hi-fi (Claude `brandTokens`). On every lo-fi/hi-fi run, (re)generate `index.html` + write all screen files to `03-Wireframes-LoFi/` and `04-Wireframes-HiFi/`. Record `designSystemId`/`designSystemVersion` on the set.

- [x] **Task 9 (DD-03): In-app navigator view + zip export** (P0-FE/BE)
  - `GET /ba/projects/:id/wireframes/navigator` (HTML) + `GET /ba/projects/:id/wireframes/export-zip` (all screens + `index.html` + shared CSS). On `/wireframes`: "Open navigator" (new tab / embedded) + "Download zip" buttons.

- [x] **Task 10 (EE-01): Freshness + readiness integration** (P0-BE)
  - Extend `ArtifactFreshnessService` with a `DESIGN_SYSTEM` link (PRD → Map → Design System → Wireframes → HLD); a Design-System change flags wireframes stale. Readiness: lo-fi generation surfaces a soft gate "define the design system first" (non-blocking, with a sensible default if skipped).

- [x] **Task 11 (EE-02): Wire-up + smoke + regression** (P1)
  - Unit tests: `tokensToCss` (token→CSS), navigator module-grouping from FR-IDs, preset apply round-trip. Smoke: define design system → generate lo-fi (limit) → navigator emitted + zip downloads → tokens visible in output. Backend + frontend `tsc` clean; Discovery wireframes no-regression.

---

## Task table

| # | Track | ID | Pri | Size | Summary |
|---|-------|----|----|------|---------|
| 1 | Model | AA-01 | P0 | M | `BaDesignSystem` + `BaDesignPreset` + `BaWireframeSet.designSystemId` + migration |
| 2 | Studio BE | BB-01 | P0 | L | `DesignSystemService` + shared `tokensToCss()` + seed presets + sample preview |
| 3 | Studio BE | BB-02 | P0 | S | Routes: design-system (get/put/logo/preview) + design-presets (list/apply/save) |
| 4 | Studio FE | CC-01 | P0 | S | `pipeline-api` helpers + `DesignTokens`/`DesignPreset` types |
| 5 | Studio FE | CC-02 | P0 | L | Studio page — grouped parameter form + logo upload (LLD/architecture styling) |
| 6 | Studio FE | CC-03 | P0 | L | Template library + live web/mobile preview + bidirectional sync + save-as-preset + nav |
| 7 | Navigator | DD-01 | P0 | L | `WireframeNavigatorService` — deterministic `index.html` (modules→screens, filters, hero, cards) |
| 8 | Navigator | DD-02 | P0 | M | Thread tokens into lo-fi + hi-fi; navigator as standing output to ProjectArtifacts |
| 9 | Navigator | DD-03 | P0 | M | In-app navigator view + zip export (screens + index.html) + `/wireframes` buttons |
| 10 | Integration | EE-01 | P0 | M | Freshness (DESIGN_SYSTEM) + readiness soft-gate |
| 11 | Wire-up | EE-02 | P1 | S | Unit tests + smoke + Discovery no-regression + tsc clean |

---

## Track GG — Wireframe gallery UX + lo-fi differentiation + hi-fi selection (follow-on, added 2026-06-04)

> **Status:** ✅ COMPLETE (2026-06-04) — shipped on `feat/v9-wireframe-ux`. Verified: type-aware lo-fi (Landing→Dashboard, Login→Auth, Search→List, Listing Detail→Detail, Checkout, Payment→Checkout); AI lo-fi regen (scr-01 via Claude); hi-fi selection (2 slugs → 2 screens); click-to-open modal; tests 10/10 (`lofi-render`), pipeline 74/74; tsc clean both apps. **Why:** in-app lo-fi cards looked identical (one uniform scaffold) and weren't clickable. **Decisions (user):** (1) clicking a card opens the screen in an **in-app modal** (+ open-in-new-tab); (2) lo-fi default = **type-aware deterministic** skeletons (free, differentiated) **plus** an **AI lo-fi** option (Claude grey-box) the user can choose; (3) **per-screen checkboxes** to pick exactly which lo-fi screens are carried into **hi-fi** generation.

- [x] **GG-01 (FE):** Gallery cards clickable → **in-app modal** with the full screen (sandboxed iframe) + "Open in new tab".
- [x] **GG-02 (BE):** Type-aware deterministic lo-fi — `inferScreenType()` (auth/form/list/dashboard/detail/checkout/generic) from screen name + annotations → distinct grey-box skeleton per type (replaces the uniform scaffold; still free, token-driven via `tokensToCss`).
- [x] **GG-03 (BE+AI):** Optional **AI lo-fi** — `ai-service /lofi-generate` (Claude, grey-box/structural prompt) + `AiService.generateLofi` + `PipelineWireframeService.generateLoFi({ mode: 'deterministic' | 'ai' })`.
- [x] **GG-04 (BE):** Hi-fi from a **user-selected subset** — `generateHiFi({ slugs })` filters the lo-fi set (supersedes first-N `limit`); `HifiService.generate` honors a `slugs`/`sequenceNums` filter.
- [x] **GG-05 (FE):** Per-screen **selection checkboxes** + "Generate hi-fi for selected (N)"; lo-fi **mode toggle** (Deterministic default / AI) + per-card "regenerate with AI"; wire to GG-03/GG-04.
- [x] **GG-06:** Unit test (`inferScreenType`) + smoke; `tsc` clean both apps.

| # | Track | ID | Pri | Size | Summary |
|---|-------|----|----|------|---------|
| 15 | Gallery UX | GG-01 | P1 | S | Click-to-open modal (+ new tab) for gallery cards |
| 16 | Lo-fi | GG-02 | P1 | M | Type-aware deterministic lo-fi skeletons (default) |
| 17 | Lo-fi | GG-03 | P1 | M | Optional AI lo-fi (`/lofi-generate`, Claude) |
| 18 | Hi-fi | GG-04 | P1 | S | Hi-fi from a selected subset of lo-fi screens |
| 19 | Gallery UX | GG-05 | P1 | M | Selection checkboxes + "Generate hi-fi for selected" + lo-fi mode toggle |
| 20 | Wire-up | GG-06 | P1 | S | Unit test + smoke + tsc clean |

---

## Track KK — Pastel diagram palette (in Design System) + project-structure diagram (follow-on, added 2026-06-04)

> **Status:** ✅ COMPLETE (2026-06-04) — shipped on `feat/v9-pastel-diagrams`. **Decisions (user):** add the reference diagram's **exact pastel palette into the Design System** and drive **both** the architecture (Mermaid) diagrams and a new **project-structure diagram** from it; structure rendered as a **pastel HTML grid** (grouped boxes + legend) like the attached. Verified (Playwright + screenshot): Mermaid renders pastel (10 svg); §17 grid shows monorepo groups (frontend/backend/db/shared/config) + legend, items derived from the project's modules ("Luggage Room").

- [x] **KK-01 (BE+FE):** add `diagramPalette` (exact attached pastels: frontend/backend/calcEngine/shared/db/config/node, each fill/border/text) to `DesignTokens` (defaults + `normalizeTokens` + `tokensToCss` CSS vars); mirror the type on the frontend; Studio FALLBACK updated. (Seed presets inherit it.)
- [x] **KK-02 (FE):** HLD `Mermaid` renderer themed from the project's `diagramPalette` (Mermaid `base` theme + pastel `themeVariables`); HLD page fetches the active Design System for the palette (fallback = attached defaults).
- [x] **KK-03 (BE+FE):** `HldService.buildProjectStructure` deterministically derives monorepo groups (layers → folders/items) from the project's §6 modules + stack (no LLM — accurate & instant); `GET hld/project-structure`; frontend `ProjectStructureDiagram` pastel grid + legend rendered under §17.
- [x] **KK-04:** `tsc` clean both apps; design-tokens tests 15/15; Playwright verified grid + pastel diagrams.

| # | Track | ID | Pri | Size | Summary |
|---|-------|----|----|------|---------|
| 29 | Diagrams | KK-01 | P1 | M | `diagramPalette` (attached pastels) in Design System tokens |
| 30 | Diagrams | KK-02 | P1 | S | Pastel Mermaid theme from the palette |
| 31 | Diagrams | KK-03 | P1 | M | Project-structure derivation + endpoint + pastel grid (§17) |
| 32 | Wire-up | KK-04 | P1 | S | tsc + tests + Playwright |

---

## Track JJ — HLD page: left section menu + switchable panels + Mermaid render fix (follow-on, added 2026-06-04)

> **Status:** ✅ COMPLETE (2026-06-04) — shipped on `feat/v9-hld-stepper`. Left section menu (Architecture Diagrams + 17 headings) with one-panel-at-a-time switching, verified via Playwright (rail present; switching shows the section + hides diagrams; diagrams render to `<svg>`). **Mermaid needed no fix** — it renders on a fresh build; the screenshot's raw code was a stale dev-build/cache (hard refresh fixes it). `tsc` clean. **Why:** the HLD page was a long scroll of 17 sections + diagrams (hard to navigate); the diagrams *appeared* as raw Mermaid code due to the stale build. **Decisions (user):** add a **left menu of section headings**; clicking one shows that section on the right (one at a time), consistent with the wireframes/PRD screens. Plus fix Mermaid so diagrams actually draw.

- [x] **JJ-01 (FE):** refactor `/hld` into a left sidebar (Architecture Diagrams entry + the 17 section headings, with §num) + active-panel switching (render only the selected section / the diagrams panel). Keep header (Regenerate · ← PRD+FRD), freshness banner, export note, gaps.
- [x] **JJ-02 (FE):** ~~fix the `Mermaid` renderer~~ — **no code change needed.** Playwright on a fresh build showed Mermaid renders correctly (10 `<svg>`, 0 amber fallbacks, no console errors); the raw-code in the screenshot was a **stale dev-build/cache**. A hard refresh shows the diagrams.
- [x] **JJ-03:** Playwright smoke (sidebar present, panel switches, a diagram renders to `<svg>`) + `tsc` clean.

| # | Track | ID | Pri | Size | Summary |
|---|-------|----|----|------|---------|
| 26 | HLD UX | JJ-01 | P1 | M | Left section menu + switchable panels |
| 27 | HLD UX | JJ-02 | P1 | S | Fix Mermaid diagram rendering |
| 28 | Wire-up | JJ-03 | P1 | S | Playwright smoke + tsc clean |

---

## Track II — Wireframes page: left-rail stepper + switchable panels (follow-on, added 2026-06-04)

> **Status:** ✅ COMPLETE (2026-06-04) — shipped on `feat/v9-wireframes-stepper`. Verified (Playwright): left rail with 3 stages (status/✓/🔒 + "N selected"); one panel at a time (Lo-fi → 41 checkboxes, mapping hidden; Mapping → table, no gallery); switching + gating work; `tsc` clean. **Why:** the 3 stages (Mapping / Lo-fi / Hi-fi) were stacked in a long vertical scroll — lower stages were easy to miss, with no progress/gating. **Decisions (user):** a **left sticky stepper rail** with **one panel shown at a time** (matches the v7 `PrdStepper`/`PrdSidebar`). Frontend-only; no API/DB changes.

- [x] **II-01 (FE):** refactor `/wireframes` into a left rail (3 stages with live status — counts, ✓, locked) + a persistent "N selected for hi-fi" indicator; render only the active stage's panel; gating (lo-fi locked until mapping, hi-fi locked until lo-fi) with a hint; contextual actions in each panel header; keep top-bar links (Design System · Open navigator · Zip · ← PRD · HLD →). Behavior of mapping/lo-fi/variants/selection/hi-fi unchanged.
- [x] **II-02:** Playwright smoke (rail present, panel switches, locked states) + `tsc` clean.

| # | Track | ID | Pri | Size | Summary |
|---|-------|----|----|------|---------|
| 24 | Wireframes UX | II-01 | P1 | M | Left-rail stepper + switchable panels + status/gating |
| 25 | Wire-up | II-02 | P1 | S | Playwright smoke + tsc clean |

---

## Track HH — Coexisting lo-fi variants (deterministic + AI) + active selection (follow-on, added 2026-06-04)

> **Status:** ✅ COMPLETE (2026-06-04) — shipped on `feat/v9-lofi-variants`. Verified (Playwright + API): deterministic preserved + AI stored as `meta.aiHtml`; per-card `[Deterministic|AI]` toggle; modal side-by-side compare (2 iframes + "Set active"); active variant persists & drives the navigator; default active = deterministic. `tsc` clean both apps. **Why:** AI lo-fi overwrote the deterministic wireframe in place. **Decisions (user):** keep BOTH variants per screen — deterministic is never destroyed; AI is an added variant. **UX:** a per-card `[Deterministic | AI]` toggle + a modal **side-by-side compare**; an **active** marker. **Active variant is user-chosen** per screen (default deterministic) and drives navigator/zip/export. Hi-fi stays **checkbox-driven** (callout-based, variant-agnostic).

- [x] **HH-01 (BE):** AI lo-fi stored as a variant — `regenerateLoFiWithAI` writes `meta.aiHtml` and PRESERVES the deterministic `htmlContent`; `meta.activeVariant` ('deterministic'|'ai', default deterministic). Endpoint `POST wireframes/screen-variant {slug,variant}` to set active. `listScreens` returns `{ htmlContent, aiHtmlContent, activeVariant }`. `WireframeNavigatorService` exports the **active** variant per screen.
- [x] **HH-02 (FE):** lo-fi card `[Deterministic | AI]` segmented toggle (persists active via API) + "active" marker; modal shows BOTH side-by-side when an AI variant exists; "AI lo-fi (N)" keeps deterministic intact.
- [x] **HH-03:** smoke + `tsc` clean both apps.

| # | Track | ID | Pri | Size | Summary |
|---|-------|----|----|------|---------|
| 21 | Lo-fi variants | HH-01 | P1 | M | AI lo-fi as a variant (keep deterministic) + active-variant API + navigator uses active |
| 22 | Lo-fi variants | HH-02 | P1 | M | Card toggle + modal compare + active marker |
| 23 | Wire-up | HH-03 | P1 | S | Smoke + tsc clean |

---

## Track FF — Import reference screens/templates → presets (follow-on, added 2026-06-04)

> **Status:** ✅ COMPLETE (2026-06-04) — shipped on `feat/v8-prd-sourced-wireframes`. Verified: HTML `:root` reference → preset with extracted primary/accent/semantic; image path via Vision; multi-file + folder; backend+frontend `tsc` clean; 15 unit tests. **Decision:** an **Upload reference** button in the Template Library that ingests reference screens/templates (multi-file **or** folder) and turns each into an applicable preset. **HTML/CSS → deterministic `:root`/color extraction** (exact); **PNG/JPG/SVG → Vision** (`/extract-brand-tokens`). Derived presets fill colors confidently; type/shape stay at defaults (labelled "imported"). The uploaded artifact is kept as the preset thumbnail.

- [x] **FF-01 (BE):** `extractTokensFromHtml()` (deterministic `:root` var + hex-frequency fallback) in `design-tokens.ts`; `DesignSystemService.importReferences(projectId, files)` — HTML→deterministic, image→`AiService.extractBrandTokens` (Vision), multi-file + folder; create PROJECT `BaDesignPreset`(s) with thumbnail; reject unsupported. Route `POST design-system/import-references` (FilesInterceptor).
- [x] **FF-02 (FE):** "Upload reference" button (files **and** folder via `webkitdirectory`) in the Template Library; `importDesignReferences` helper; refresh + surface imported presets (with an "imported" marker).
- [x] **FF-03:** unit test for `extractTokensFromHtml` (`:root` parse + fallback) + smoke; `tsc` clean both apps.

| # | Track | ID | Pri | Size | Summary |
|---|-------|----|----|------|---------|
| 12 | Library | FF-01 | P1 | M | Backend: HTML→tokens (deterministic) + image→Vision; `importReferences` + route |
| 13 | Library | FF-02 | P1 | S | Frontend: Upload reference (multi + folder) in Template Library |
| 14 | Library | FF-03 | P1 | S | Unit test (HTML extract) + smoke + tsc clean |

---

## Acceptance criteria

- [x] A UX resource can define a project's **design tokens + logo** with strong defaults; the page is styled in line with the LLD/architecture pages.
- [x] A **template library** is available; **applying a preset** fills the form and updates the preview; **editing a parameter** updates the preview live; the user can **save a preset** (PROJECT or GLOBAL).
- [x] A **live preview** renders the design system on both a **web frame and a 390px mobile frame**.
- [x] Design tokens are **per-project**; presets are reusable across projects when **GLOBAL**.
- [x] Generated **lo-fi and hi-fi** wireframes visibly use the chosen design system (same `tokensToCss`).
- [x] Every wireframe run **emits a stitched `index.html` navigator** (modules→screens, Web/Mobile/Phase filters, search, hero stats, per-module screen cards) to `ProjectArtifacts`; it is viewable in-app and **downloadable as a zip**.
- [x] Freshness propagates **PRD → Screen-Map → Design System → Wireframes → HLD**.
- [x] **Discovery wireframes still work** — no regression; `tsc` clean both apps; tokens/navigator unit-tested.

## Open questions (none blocking — defaults chosen)

1. ✅ Studio scope — **full studio**.
2. ✅ Navigator delivery — **standing output + in-app + zip**.
3. ✅ Token/preset reuse — **per-project tokens + shared (GLOBAL) preset library**.
4. ⬜ Starter presets beyond Deepmindz Navy/Orange (Minimal-Mono, Corporate-Blue, Playful) — confirm names/palettes during BB-01 (non-blocking).

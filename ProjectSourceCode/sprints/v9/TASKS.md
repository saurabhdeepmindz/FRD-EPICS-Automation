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

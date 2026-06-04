# Sprint v9 — PRD: Look & Feel Studio (Design System) + Wireframe Navigator (Tracks AA–EE)

## Overview

Sprint v9 inserts a **Design System / "Look & Feel" Studio** into the pipeline **between the Screen↔Feature Mapping (v8 Track Y) and Lo-fi wireframes**, and makes a **stitched `index.html` Wireframe Navigator** a standing output of the wireframe stage.

Today the wireframe lo-fi/hi-fi already consume a `brandTokensSnapshot`, but it is a hard-coded default. v9 promotes that into a **first-class, user-authored Design System**: a UX resource defines the look, feel, and usability parameters (colors, typography, shape/density, module + persona palettes, platform frame) and a **logo**, with **default values + a template library** of presets. The studio is **bidirectional** — selecting a sample preset fills the parameters and re-renders a live preview; editing a parameter re-renders the preview and can be saved as a preset. Previews render for **both web and mobile** (390px phone frame), matching the reference wireframes the user supplied.

The design tokens then **flow downstream**: lo-fi (deterministic), hi-fi (Claude), and a new **navigator generator** all read them, so every generated screen shares one coherent design system. The navigator mirrors the user's reference `index.html`: a sidebar (modules grouped, Web/Mobile/Infra toggles, phase filters, search), hero stats, per-module **screen-card grids** linking each screen, a mobile section, and a legend — generated deterministically from the **screen map** (modules→screens) + tokens + generated screens.

**Reuse posture:** the design tokens reuse and formalize the existing `brandTokensSnapshot` shape already threaded into `WireframeService`/`HifiService`; the navigator reuses the screen map (modules via §6 FR-ID prefixes, personas, PRD-cited annotations) we already generate. The genuinely new pieces are the **`BaDesignSystem` artifact + preset library** and the **deterministic navigator generator**.

## Goals

- A UX resource can **define the look & feel** of a project's wireframes via a parameter form — brand (logo, product name, primary, accent/CTA, surface), neutrals, semantic colors, **per-module accents**, **persona colors**, typography (UI + mono fonts, sizes/weights), shape & density (radius, spacing, elevation), and platform (390px mobile frame, breakpoints, touch target) — all with **sensible defaults**.
- A **template library** of presets is offered. **Bidirectional sync:** pick a sample → parameters fill + preview re-renders; edit a parameter → preview re-renders live and can be **saved as a preset**.
- The studio renders a **live preview for both web and mobile** so the look is validated before any wireframe is generated.
- Design tokens are **per-project** (each project has its own active set) while **presets live in a shared library** reusable across projects (org design systems).
- The tokens **flow downstream** into lo-fi (deterministic), hi-fi (Claude), and the navigator — every screen uses the design system.
- The wireframe stage **always emits a stitched `index.html` navigator** (modules → screens) — a standing output written to `ProjectArtifacts`, viewable in-app, and **downloadable as a zip** of all screens + `index.html`.
- **Forward propagation extends:** a PRD or screen-map change flags wireframes stale; a design-system change flags wireframes stale (and the HLD after them).
- Discovery (BRD/AN) wireframes remain functional; they may optionally adopt the same navigator output.

## User Stories

- As a UX resource, I want to define a project's look & feel (colors, type, shape, logo) before wireframes are generated, so every screen is on-brand and consistent.
- As a UX resource, I want a library of starter templates; picking one fills my parameters, and tweaking a parameter updates the sample — so I can converge on a design quickly.
- As a UX resource, I want a live preview for both web and mobile, so I can see the design system on a real screen before committing.
- As a BA, I want the generated lo-fi and hi-fi wireframes to use the chosen design system, so they match the agreed look & feel.
- As a stakeholder, I want a single `index.html` navigator that stitches all modules and their screens (with web/mobile/phase filters and search), so I can review the whole product in one place and share it.
- As an Architect, when the PRD, screen map, or design system changes I want the wireframes flagged stale, so nothing downstream silently drifts.

## Technical Architecture

### Surface — v9

```
+------------------------------------------------------------------+
|  Browser (Next.js) — /ba-tool/project/[id]/design-system (NEW)    |
|  (placed before /wireframes; styled like the LLD/architecture pgs)|
|                                                                   |
|  Left:  Parameter form (grouped)                                  |
|    Brand: logo upload · product name · primary · accent/CTA ·     |
|           CTA hover · surface                                     |
|    Neutrals: bg-page · bg-soft · text primary/muted/subtle ·      |
|              border · border-medium                              |
|    Semantic: success · warning · danger · info · teal · purple    |
|    Palettes: module accents (auto/manual) · persona colors        |
|    Typography: UI font · mono font · base size · weight scale     |
|    Shape & density: radius (card/pill) · density · elevation      |
|    Platform: mobile frame width (390) · breakpoints · touch target|
|  Right: Template library (presets w/ thumbnails)                  |
|         + LIVE PREVIEW (Web frame  +  390px Mobile frame)         |
|    bidirectional: pick preset ↔ edit param → live re-render       |
|    actions: Apply preset · Save as preset · Save design system    |
|                                                                   |
|  /wireframes (v8, EXTENDED): "Open navigator" + "Download zip"    |
+----------------------------+-+------------------------------------+
                              | HTTP
                              v
+------------------------------------------------------------------+
|  NestJS — ba-tool/pipeline (new + extended)                       |
|   DesignSystemService (NEW): get/save tokens · logo upload ·      |
|     list/apply/save presets (PROJECT + GLOBAL scope) · seed       |
|     starter presets · render sample-preview HTML (deterministic)  |
|   WireframeNavigatorService (NEW): build index.html from the      |
|     screen map (modules→screens) + tokens + generated screens;    |
|     write to ProjectArtifacts; zip all screens + index.html       |
|   PipelineWireframeService / HifiService (EXTENDED): consume the  |
|     active design tokens for lo-fi + hi-fi generation             |
|   ArtifactFreshnessService (EXTENDED): + DESIGN_SYSTEM in the     |
|     PRD → map → design-system → wireframes → HLD chain            |
|   Routes: /ba/projects/:id/design-system/* · /design-presets/*    |
|           · /wireframes/navigator · /wireframes/export-zip        |
+----------------------------+-+------------------------------------+
                              | HTTP
                              v
+------------------------------------------------------------------+
|  Python AI Service (REUSE)                                         |
|   Hi-fi generation already accepts brandTokens — now fed the      |
|   project's Design System tokens (Claude, per v8). No new endpoint|
|   required for v9 (optional: AI "suggest palette from logo" reuse |
|   of /extract-brand-tokens as a fast-follow).                     |
+------------------------------------------------------------------+
```

### Data flow — design system → wireframes → navigator

```
Screen-Map v{n} (modules → screens, personas, PRD annotations)
  +
Design System (tokens + logo)  ← picked/edited from preset library, live-previewed (web + mobile)
  → Lo-fi (deterministic, tokens applied)  +  Hi-fi (Claude, tokens applied)
    → Navigator generator → index.html (sidebar groups, Web/Mobile/Phase filters,
        search, hero stats, per-module screen cards → each screen file, mobile section, legend)
      → ProjectArtifacts/{03-Wireframes-LoFi,04-Wireframes-HiFi}/index.html + all screens
        → in-app navigator view + downloadable zip
  → freshness: PRD/map/design-system change ⇒ wireframes stale ⇒ HLD stale
```

### Schema changes (Prisma — additive)

```prisma
// NEW — per-project active design system (the look & feel for this project's wireframes)
model BaDesignSystem {
  id            String   @id @default(uuid())
  projectId     String
  version       Int      @default(1)
  status        BaArtifactStatus @default(DRAFT)
  tokens        Json     // DesignTokens (brand, neutral, semantic, palettes, type, shape, platform)
  logo          Json?    // { dataUri | url, fileName, mimeType, width, height }
  presetId      String?  // provenance: which preset it started from (nullable)
  sourceArtifactVersions Json?   // { prdVersion, screenMapVersion } for freshness
  metadata      Json     @default("{}")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// NEW — reusable template library (shared across projects when scope = GLOBAL)
model BaDesignPreset {
  id            String   @id @default(uuid())
  name          String
  scope         String   @default("GLOBAL")  // "GLOBAL" | "PROJECT"
  projectId     String?  // set when scope = PROJECT
  tokens        Json     // DesignTokens
  thumbnail     String?  @db.Text            // small inline SVG/HTML preview or data-URI
  isSeed        Boolean  @default(false)     // shipped starter preset
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// EXTEND BaWireframeSet — record which design system produced the set (freshness + provenance)
//   designSystemId         String?
//   (sourceArtifactVersions already present from v8 → add designSystemVersion)
```

> `DesignTokens` JSON shape (lifted from the user's reference `:root`):
> `{ brand:{ productName, primary, cta, ctaHover, surface }, neutral:{ bgPage, bgSoft, textPrimary, textMuted, textSubtle, border, borderMedium }, semantic:{ success, warning, danger, info, teal, purple }, modulePalette:{ mode:"auto"|"manual", colors:{ m1..mN } }, personaPalette:{ employee, manager, hrAdmin, finance, admin, visitor }, typography:{ uiFont, monoFont, baseSize, weights }, shape:{ radiusCard, radiusPill, density, elevation }, platform:{ mobileFrameWidth:390, breakpoints, touchTarget } }`

> Migrations applied **as `prd_user`** (per project DB convention). All additive.

### The Wireframe Navigator (`index.html`)

Deterministic generator (no AI) that reproduces the user's reference navigator from data we already hold:

- **Modules** ← grouped from screen-map rows (by §6 FR-ID prefix, e.g. `FR-AUTH-*` → an Auth module; falls back to PRD §6 module names).
- **Screens** ← lo-fi/hi-fi screens (+ uploaded), each a card linking to its screen file; thumbnail = screenshot if present else a token-styled placeholder.
- **Filters** ← Web / Mobile / Infra toggles, phase (if known), live search — exactly the reference behavior.
- **Hero stats** ← screen counts, module counts, persona counts derived from the map.
- **Styling** ← the project's Design System tokens (so the navigator itself is on-brand).
- **Output** ← `index.html` + all screen files to `03-Wireframes-LoFi/` and `04-Wireframes-HiFi/`; an in-app view; and a **zip** download.

## Key decisions (confirmed with user, 2026-06-04)

| # | Decision | Chosen |
|---|---|---|
| 1 | Studio scope (first cut) | **Full studio** — token form + logo + preset library + live **web & mobile** preview + **bidirectional** sync |
| 2 | Navigator delivery | **Standing output** — auto-generated each lo-fi/hi-fi run → ProjectArtifacts, viewable in-app, **downloadable as zip** |
| 3 | Token / preset reuse | **Per-project tokens + shared preset library** (GLOBAL presets reusable across projects; PROJECT presets too) |
| 4 | Token schema | Lifted from the user's reference `:root` (brand, neutral, semantic, module `--m1..`, persona, type, radius/pill, 390px frame) |
| 5 | Pipeline placement | **Between Screen-Map and Lo-fi** — design system defined before any wireframe is generated |
| 6 | Generation reuse | Tokens fed to the existing deterministic lo-fi + Claude hi-fi (v8) — no new AI endpoint required |
| 7 | "Always create index.html" | Navigator is a **mandatory** output of the wireframe stage (lo-fi and hi-fi), per user instruction |
| 8 | Page styling | Built **in line with the existing LLD / architecture pages** |

## Out of Scope (v10+)

- A full visual drag-drop screen editor — wireframes remain token-driven generation or uploads.
- AI "generate palette from uploaded logo" — optional fast-follow reusing `/extract-brand-tokens` (Vision).
- Theming Discovery (BRD/AN) wireframes retroactively — Discovery may *opt in* to the navigator but its generation is unchanged.
- Animated / interactive prototype export (click-through is via the navigator's per-screen links + existing keyboard nav).
- Multi-brand / white-label switching within a single project.

## Dependencies

- ✅ **Screen-Map (v8 Track Y)** — `BaScreenMap`/`BaScreenMapRow` (modules→screens, personas, PRD annotations) — drives the navigator + hi-fi seeding.
- ✅ **Pipeline wireframes (v8 Track Z)** — `PipelineWireframeService` + extended `BaWireframeSet`/`HifiService` consume the tokens.
- ✅ **`brandTokensSnapshot`** — existing token shape on lo-fi/hi-fi sets (formalized into `DesignTokens`).
- ✅ **Claude hi-fi (post-v8)** — hi-fi already accepts `brandTokens`; now fed the Design System.
- ✅ **Freshness (v6 Track T / v8 Track Z)** — `ArtifactFreshnessService` + `sourceArtifactVersions` (extended with DESIGN_SYSTEM).
- ✅ **WireframeExportService / ProjectFolderService** — disk output for `index.html` + zip.

## Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Live preview drift vs actual generated screens (preview looks different from lo-fi/hi-fi output) | High | Preview renders from the **same token→CSS mapping** used by the generators; share one `tokensToCss()` util across studio + lo-fi + navigator |
| Bidirectional sync complexity (preset ↔ form ↔ preview loops) | Medium | Single source of truth = the in-memory token object; preset select and field edits both write it; preview is a pure function of it |
| Navigator module grouping wrong when FR-ID prefixes are irregular | Medium | Derive modules from §6 FR-ID prefix with a PRD §6 module-name fallback; allow a manual module label override on the screen map |
| Large zip (many screens + data-URI images) | Medium | Stream the zip; cap embedded image size; deduplicate shared CSS into one file referenced by all screens |
| Logo upload (size/type/SSRF if URL) | Medium | Accept PNG/JPG/SVG upload only (no remote URL fetch), size cap, store as data-URI/asset; sanitize SVG |
| Token explosion / overwhelming form | Low | Group fields, ship strong defaults + presets so most users only pick a preset + logo; "advanced" sections collapsed |
| Per-module/persona palettes vs unknown modules | Low | `auto` mode assigns a deterministic accent per module; `manual` lets the UX resource override |

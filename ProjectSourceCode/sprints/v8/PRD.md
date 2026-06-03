# Sprint v8 — PRD: PRD-Sourced Wireframes Stage — Screen↔Feature Mapping → Lo-fi → Hi-fi (Tracks Y + Z)

## Overview

Sprint v8 adds a **Wireframes stage to the main pipeline, positioned between PRD+FRD (Stage 2) and HLD (Stage 5)**. Unlike the existing **Discovery** wireframes (driven by the BRD + Approach Note), the new pipeline wireframes are **sourced from the PRD**: the screen↔feature mapping, business rules, and every annotation reference the canonical 22-section PRD (especially §6 FRD features, §5 actors, §8 journeys, §10 NFRs).

The stage has three sub-steps, plus an upload path for externally-created wireframes:

1. **Screen ↔ Feature Mapping** (the first deliverable) — a screen-centric artifact mapping each screen to PRD §6 FR-IDs + PRD sections + business rules (from PRD + architect-suggested) + screen description + **numbered annotations** (incl. a Persona row), every reference citing **PRD content**. (Shape mirrors the customer's reference RTM/screen-map CSV, but re-pointed from SRS → PRD.)
2. **Lo-fi wireframes** — generated from the mapping (annotations become callouts; FR-IDs become `meta.frRefs`).
3. **Hi-fi wireframes** — generated from the lo-fi.
4. **Upload (single + bulk)** — when wireframes are created by a 3rd party (or were uploaded in Customer Inputs as `CUSTOMER_WIREFRAME`), they are reflected/ingested here without forcing AI generation.

**Reuse posture:** the existing Discovery wireframe models (`BaWireframeSet`/`BaWireframeScreen`, `BaHifiSet`/`BaHifiScreen`) already carry callouts (annotations), `meta.frRefs` (feature mapping), and `coverageStatus` — so v8 **reuses and extends** them with a `source` discriminator (`DISCOVERY` vs `PIPELINE`) rather than building parallel models. The genuinely new artifact is the **PRD-sourced screen map**. Discovery wireframes are untouched.

## Goals

- A BA can **generate a screen↔feature mapping from the PRD** — each screen mapped to §6 FR-IDs + PRD sections + business rules (PRD + architect) + screen description + numbered annotations (Persona + per-element), all citing PRD content.
- The mapping is **editable** and supports **CSV import + export** (matching the reference column shape, re-pointed to PRD refs), plus an annotations editor.
- From the mapping, the BA can **generate lo-fi wireframes**, then **hi-fi wireframes** — reusing the proven Discovery generation engine, re-seeded from the PRD-sourced map.
- When wireframes come from a **3rd party**, the BA can **bulk-upload** them (HTML/PNG/JPG) — and wireframes already uploaded in **Customer Inputs** (`CUSTOMER_WIREFRAME`) are reflected in the stage.
- The Wireframes stage sits **between PRD and HLD** in the pipeline nav; HLD generation consumes the pipeline wireframes; the module readiness gate is satisfied by them.
- **Forward propagation (v6 Track T) extends through wireframes:** a PRD change flags the screen map + wireframes (and then HLD) stale; a wireframe/map change flags the HLD stale.
- Discovery's BRD/Approach-Note wireframes remain fully functional and unchanged.

## User Stories

- As a BA, after generating the PRD I want to generate a screen↔feature mapping from it, so each screen is traceable to the PRD's functional features and sections.
- As a BA, I want every annotation on the mapping (and the wireframes) to reference PRD content (PRD §/FR-ID), so the wireframes are grounded in the approved requirements, not an external doc.
- As a BA, I want to edit the mapping and its annotations, and import/export it as CSV, so I can refine it or hand it to a designer.
- As a BA, I want to generate lo-fi wireframes from the mapping and then hi-fi wireframes, so the design artifacts flow from the PRD.
- As a BA whose client supplied wireframes via a 3rd party, I want to bulk-upload them into the stage (and see the ones uploaded as Customer Inputs), so I can use them without AI generation.
- As an Architect, when the PRD changes I want the screen map and wireframes flagged stale (and the HLD after them), so nothing downstream silently drifts from the requirements.

## Technical Architecture

### Surface — v8

```
+------------------------------------------------------------------+
|  Browser (Next.js) — /ba-tool/project/[id]/wireframes  (NEW page) |
|                                                                   |
|  Header: Back · {prd version} · Generate Map · Upload · ← PRD · HLD →|
|  Step 1 — Screen↔Feature Mapping table  (Track Y)                 |
|    columns: Screen ID · PRD Section(s) · FR Ref(s) (§6) ·          |
|             Feature Desc · Screen Name · Business Rules (PRD) ·    |
|             Business Rules (Architect) · Screen Description ·      |
|             Annotations [{marker(P/n), title, description, prdRef}]|
|    actions: Generate from PRD · Edit · CSV import · CSV/MD export  |
|             coverage (orphan FRs / orphan screens)                |
|  Step 2 — Lo-fi gallery (iframe preview, callouts)  (Track Z)     |
|  Step 3 — Hi-fi gallery (iframe preview)            (Track Z)     |
|  Upload (single/bulk): HTML/PNG/JPG → lo-fi or hi-fi screens      |
|  Customer wireframes reflected (CUSTOMER_WIREFRAME inputs)        |
+----------------------------+-+------------------------------------+
                              | HTTP
                              v
+------------------------------------------------------------------+
|  NestJS — ba-tool/pipeline (new + extended)                       |
|   ScreenMapService (NEW): generate(from PRD) · get/list · update  |
|     · importCsv · exportCsv/Md · CRUD rows + annotations          |
|   WireframeService / HifiService (EXTENDED): PIPELINE source       |
|     seeded by the screen map; upload ingest (single/bulk)         |
|   WireframeExportService (reuse): 03-Wireframes-LoFi / 04-Hi-Fi    |
|   ArtifactFreshnessService / RequirementChangeService (EXTENDED): |
|     PRD → screen-map → lo-fi → hi-fi → HLD staleness               |
|   Routes: /ba/projects/:id/screen-map/* and /wireframes/*         |
+----------------------------+-+------------------------------------+
                              | HTTP
                              v
+------------------------------------------------------------------+
|  Python AI Service                                                |
|   NEW: POST /screen-map-generate — PRD sections (§6 FRD + §5/§8/  |
|        §10) → screens[{screenId, prdSections, frRefs, businessRules|
|        , screenName, screenDescription, annotations[]}] + coverage|
|        New prompt file: screen_map_prompts.py                     |
|   REUSE: existing lo-fi + hi-fi wireframe prompts (re-seeded)      |
+------------------------------------------------------------------+
```

### Data flow — PRD-sourced wireframes

```
PRD v{n} (§6 FRD + §5 actors + §8 journeys + §10 NFR)
  → /screen-map-generate → BaScreenMap (screens + FR mapping + annotations, PRD-referenced)
    → (edit / CSV import-export)
      → generate Lo-fi → BaWireframeSet(source=PIPELINE, screenMapId) + BaWireframeScreen[] (callouts = annotations)
        → generate Hi-fi → BaHifiSet + BaHifiScreen[]
          → HLD buildWireframeContext prefers PIPELINE set
            → freshness: PRD change ⇒ screen-map/wireframes stale ⇒ HLD stale
  OR  Upload (3rd-party / CUSTOMER_WIREFRAME) → BaWireframeScreen/BaHifiScreen (source=PIPELINE, uploaded=true)
```

### Schema changes (Prisma — additive)

```prisma
// NEW — PRD-sourced screen map (the Step-1 artifact; CSV-shaped, PRD-referenced)
model BaScreenMap {
  id            String   @id @default(uuid())
  projectId     String
  version       Int      @default(1)
  status        BaArtifactStatus @default(DRAFT)
  sourceArtifactVersions Json?    // { prdVersion }
  triggeredBy   BaTriggeredBy? @default(INITIAL_GENERATION)
  metadata      Json     @default("{}")  // { coverage: { orphanFrs[], orphanScreens[] } }
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  rows          BaScreenMapRow[]
}
model BaScreenMapRow {
  id                    String  @id @default(uuid())
  screenMapId           String
  screenId              String  // "SCR-01"
  sequenceNum           Int
  screenName            String
  prdSections           String[]    // PRD §refs (e.g. "§6", "§10")
  featureRefs           String[]    // §6 FR-IDs (e.g. "FR-AUTH-001")
  featureDescription    String  @db.Text
  businessRulesPrd      String  @db.Text
  businessRulesArchitect String @db.Text
  screenDescription     String  @db.Text   // "EPIC" description
  annotations           Json        // [{ marker: "P"|number, title, description, prdRef }]
}

// EXTEND BaWireframeSet — allow PRD/upload sourcing (Discovery flow unaffected)
//   approachNoteVersionId  String?   // was required; now nullable
//   source                 String  @default("DISCOVERY")   // "DISCOVERY" | "PIPELINE"
//   screenMapId            String?   // when source=PIPELINE
//   sourceArtifactVersions Json?     // { prdVersion } for freshness
// EXTEND BaWireframeScreen / BaHifiScreen — meta.uploaded flag for 3rd-party files
```

> Migrations applied **as `prd_user`** (per project DB convention). All additive; the nullable change on `approachNoteVersionId` preserves existing Discovery rows.

### New AI endpoint

```
POST /screen-map-generate
  Input:  { project_id, prd_sections (flattened via F2 normalizer), product_name }
  Output: { screens: [{ screenId, screenName, prdSections[], frRefs[], featureDescription,
                        businessRulesPrd, businessRulesArchitect, screenDescription,
                        annotations: [{ marker, title, description, prdRef }] }],
            coverage: { orphanFrs[], orphanScreens[] } }
  Prompt grounded in the PRD: every frRef is a §6 FR-ID; every annotation prdRef cites a PRD §/FR.
  New prompt file: ai-service/prompts/screen_map_prompts.py
```

## Key decisions (confirmed with user, 2026-06-04)

| # | Decision | Chosen |
|---|---|---|
| 1 | Wireframe model strategy | **Reuse + extend** Discovery `BaWireframeSet`/`BaHifiSet` with a `source` discriminator (`DISCOVERY`/`PIPELINE`) + nullable AN FK — not parallel models |
| 2 | Mapping artifact | **Separate** PRD-sourced `BaScreenMap`/`BaScreenMapRow` (CSV-shaped); cross-link to RTM later |
| 3 | Source of truth | **PRD** — screen map, business rules, and all annotation refs cite the **PRD** (§/FR-ID), NOT the BRD/Approach Note. Discovery stays BRD/AN-driven and untouched |
| 4 | Generation engine | **Reuse** Discovery `WireframeService`/`HifiService`, re-seeded from the screen map |
| 5 | Upload | **Single + bulk** upload of **HTML / PNG / JPG / PDF / SVG** (SVG/PDF cover Figma exports) for 3rd-party wireframes; reflect `CUSTOMER_WIREFRAME` inputs; CSV import for the mapping. (A raw `.fig` binary is not in-browser-renderable — ingest the Figma *export* as PDF/SVG/PNG.) |
| 6 | HLD source preference | HLD `buildWireframeContext` prefers the `PIPELINE` set; falls back to Discovery when absent |
| 7 | Screen-map disk | Exported to `ProjectArtifacts/02b-ScreenMap/` |
| 8 | Regenerate vs uploads | Regeneration **merges** — uploaded (3rd-party) screens are preserved, not overwritten |

## Out of Scope (v9+)

- Removing or migrating the Discovery (BRD/AN) wireframe flow — it stays as-is.
- Auto-regenerating wireframes when the PRD changes — v8 only **flags** them stale (consistent with v6 Track T).
- A visual drag-drop wireframe editor — lo-fi/hi-fi remain AI-generated or uploaded; editing is at the mapping/annotation level (+ raw HTML for uploads).
- 3D / hi-fi design-system theming beyond the existing hi-fi generator.
- Cross-linking the screen map into RTM rows (`BaRtmRow.screenRefs`) — noted as a fast-follow.

## Dependencies

- ✅ **PRD (Track C / v6/v7)** — `BaProjectPrd` with §6 FRD + sections + the F2 `section-normalizer` seam (used to flatten PRD content for the AI).
- ✅ **Discovery wireframes** — `BaWireframeSet`/`BaWireframeScreen`/`BaHifiSet`/`BaHifiScreen` + `WireframeService`/`HifiService` + `WireframeExportService` (reused/extended).
- ✅ **Customer Inputs** — `CUSTOMER_WIREFRAME` input type (reflected here).
- ✅ **Freshness/propagation (v6 Track T)** — `ArtifactFreshnessService` + `RequirementChangeService` + `sourceArtifactVersions` (extended to the new stage).
- ✅ **HLD (Track E)** — `buildWireframeContext` (re-pointed); readiness gate N-01.

## Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Two wireframe sources (Discovery + Pipeline) confuse HLD/readiness "latest set" selection | High | `source` discriminator + explicit preference (PIPELINE first, else DISCOVERY); query by source everywhere |
| Making `approachNoteVersionId` nullable breaks Discovery generation assumptions | Medium | Discovery path always sets it; only PIPELINE leaves it null; verify Discovery wireframe generation in regression |
| Screen-map AI cites SRS/external refs instead of PRD | Medium | Prompt explicitly grounds refs in PRD §/FR-IDs; validate frRefs against the PRD's actual §6 FR-IDs; flag unknown refs |
| Bulk upload of large/odd files | Medium | Accept HTML/PNG/JPG, per-file size cap, reuse existing attachment storage; reject unsupported types with clear errors |
| CSV import format drift vs the reference | Low | Tolerant parser keyed on header names; round-trip (export→import) test; unmatched columns ignored with a warning |
| Wireframe regeneration loses uploaded 3rd-party screens | Medium | Uploaded screens flagged `meta.uploaded`; regeneration preserves uploaded screens (merge, not overwrite) or warns |

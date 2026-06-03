# Sprint v8 — Tasks: PRD-Sourced Wireframes Stage — Screen↔Feature Mapping → Lo-fi → Hi-fi (Tracks Y + Z)

## Status: 🔄 APPROVED — in progress (2026-06-04). Open questions resolved: ① screen-map → `02b-ScreenMap/`; ② uploads = HTML/PNG/JPG/PDF/SVG (Figma exports as PDF/SVG/PNG); ③ regeneration merges (uploads preserved).

> **Backlog traceability:** Track Y (PRD-sourced Screen↔Feature Mapping) → Track Z (Wireframes stage: lo-fi + hi-fi + upload, between PRD and HLD).
>
> **Source-of-truth (confirmed):** the screen map, business rules, and ALL annotation refs cite the **PRD** (§/FR-IDs), NOT the BRD/Approach Note. Discovery (BRD/AN) wireframes are untouched; the new stage is distinguished by `BaWireframeSet.source = PIPELINE`.
>
> **Sequencing:** Y-01 → Y-02 → Y-03 → Y-04 (mapping foundation), then Z-01 → Z-02/Z-03 → Z-04 → Z-05 → Z-06. Reuses Discovery `WireframeService`/`HifiService` + v6 freshness.

---

## Phase 0 — Screen↔Feature Mapping (Track Y)

### P0 DB / AI

- [ ] **Task 1 (Y-01): `BaScreenMap` + `BaScreenMapRow` schema + migration** (P0-DB)
  - Acceptance:
    - `BaScreenMap` (projectId, version, status, `sourceArtifactVersions` {prdVersion}, `triggeredBy`, `metadata` {coverage}, timestamps) + `BaScreenMapRow` (screenMapId, screenId, sequenceNum, screenName, `prdSections String[]`, `featureRefs String[]`, featureDescription, businessRulesPrd, businessRulesArchitect, screenDescription, `annotations Json` = `[{marker, title, description, prdRef}]`)
    - SQL migration applied **as `prd_user`**; `npx prisma generate`; existing endpoints still 200
  - Files: `backend/prisma/schema.prisma`, `backend/prisma/migrations/<ts>_screen_map.sql` (new)
  - Effort: S

- [ ] **Task 2 (Y-02): AI `/screen-map-generate` (PRD-grounded) + prompt** (P0-AI)
  - Acceptance:
    - `POST /screen-map-generate { project_id, prd_sections, product_name }` → `{ screens: [{ screenId, screenName, prdSections[], frRefs[], featureDescription, businessRulesPrd, businessRulesArchitect, screenDescription, annotations: [{marker, title, description, prdRef}] }], coverage: { orphanFrs[], orphanScreens[] } }`
    - Prompt grounded in the **PRD**: `frRefs` are §6 FR-IDs; every annotation `prdRef` cites a PRD §/FR-ID (never SRS/BRD/AN); a Persona annotation (`marker:"P"`) is produced per screen
    - New prompt file `ai-service/prompts/screen_map_prompts.py`; OpenAI json_object; `_parse_ai_json`
  - Files: `ai-service/main.py`, `ai-service/prompts/screen_map_prompts.py` (new)
  - Effort: M

### P0 Backend / Frontend

- [ ] **Task 3 (Y-03): `ScreenMapService` — generate / CRUD / CSV import + export** (P0-BE)
  - Acceptance:
    - `generate(projectId)` — consolidates the latest PRD (§6 FRD + §5/§8/§10, flattened via the F2 `section-normalizer`), calls `/screen-map-generate`, persists a versioned `BaScreenMap` + rows, stamps `sourceArtifactVersions={prdVersion}`, validates `frRefs` against the PRD's actual §6 FR-IDs (flag unknowns), computes coverage (orphan FRs/screens)
    - `getLatest` / `list` / `get` / `updateRow` (edit fields + annotations) / `addRow` / `deleteRow`
    - **`importCsv`** — tolerant header-keyed parser accepting the reference column shape (re-pointed to PRD); **`exportCsv` / `exportMd`** — write to `ProjectArtifacts/02b-ScreenMap/` + CHANGELOG
    - Routes under `GET/POST /ba/projects/:id/screen-map[...]`
  - Files: `backend/src/ba-tool/pipeline/screen-map.service.ts` (new), `pipeline.controller.ts`, `pipeline.module.ts`
  - Effort: L

- [ ] **Task 4 (Y-04): Frontend — Screen↔Feature Mapping UI** (P0-FE)
  - Acceptance:
    - On the new Wireframes page: a mapping table (Screen ID · PRD Section(s) · FR Ref(s) · Feature Desc · Screen Name · Business Rules (PRD) · Business Rules (Architect) · Screen Description) + an **annotations editor** (numbered + Persona row, each with `prdRef`)
    - **Generate from PRD** + Regenerate; inline edit; **CSV import (upload)** + **CSV/MD download**; coverage indicator (orphan FRs/screens) with the AI/`[NEW]` conventions where relevant
    - `pipeline-api.ts` helpers (`getScreenMap`, `generateScreenMap`, `updateScreenMapRow`, `importScreenMapCsv`, `exportScreenMapCsv`)
  - Files: `frontend/components/ba-tool/ScreenMapTable.tsx` (new), `frontend/app/ba-tool/project/[id]/wireframes/page.tsx` (new), `frontend/lib/pipeline-api.ts`
  - Effort: L

---

## Phase 1 — Wireframes stage (Track Z)

### P0 DB / Backend

- [ ] **Task 5 (Z-01): Extend `BaWireframeSet` for PRD/upload sourcing + migration** (P0-DB)
  - Acceptance:
    - `approachNoteVersionId` made **nullable**; add `source String @default("DISCOVERY")` (`DISCOVERY`|`PIPELINE`), `screenMapId String?`, `sourceArtifactVersions Json?`; `BaWireframeScreen`/`BaHifiScreen` `meta.uploaded` flag convention documented
    - Migration **as `prd_user`**; existing Discovery rows backfill `source='DISCOVERY'`; Discovery generation still works (verified)
  - Files: `backend/prisma/schema.prisma`, `backend/prisma/migrations/<ts>_wireframe_source.sql` (new)
  - Effort: S

- [ ] **Task 6 (Z-02): Generate lo-fi from the screen map → hi-fi (PIPELINE source)** (P0-BE)
  - Acceptance:
    - New entrypoint (adapt `WireframeService`) that builds a `BaWireframeSet(source=PIPELINE, screenMapId, sourceArtifactVersions={prdVersion})` from the screen map: each row → `BaWireframeScreen` with `callouts` = the row's annotations and `meta.frRefs` = `featureRefs`; HTML/MD via the existing lo-fi prompt re-seeded from the map
    - Hi-fi generation reuses `HifiService` as-is (takes the PIPELINE wireframe set) → `BaHifiSet`/`BaHifiScreen`
    - Disk export via `WireframeExportService` (`03-Wireframes-LoFi/`, `04-Wireframes-HiFi/`) + CHANGELOG
    - Regeneration **preserves uploaded screens** (`meta.uploaded`) — merge, not overwrite
  - Files: `backend/src/ba-tool/discovery/wireframe.service.ts` + `hifi.service.ts` (extend), `backend/src/ba-tool/pipeline/*` (orchestration), `pipeline.controller.ts`
  - Effort: L

- [ ] **Task 7 (Z-03): Upload (single + bulk) + reflect `CUSTOMER_WIREFRAME` inputs** (P0-BE)
  - Acceptance:
    - `POST /ba/projects/:id/wireframes/upload` (FileInterceptor, multi-file) — accepts **HTML/PNG/JPG/PDF/SVG** (Figma exports as PDF/SVG/PNG); creates `BaWireframeScreen` (lo-fi) or `BaHifiScreen` (hi-fi) under a PIPELINE set with `meta.uploaded=true`; per-file size cap; rejects unsupported types (incl. raw `.fig` with a clear message to export first)
    - A read endpoint returns `CUSTOMER_WIREFRAME` customer inputs so the page can reflect them
    - Disk mirror of uploaded files; CHANGELOG entry
  - Files: `backend/src/ba-tool/pipeline/*` (upload service/handler), `pipeline.controller.ts`
  - Effort: M

### P0 Frontend / Integration

- [ ] **Task 8 (Z-04): Frontend — Wireframes page (Lo-fi + Hi-fi galleries + Upload)** (P0-FE)
  - Acceptance:
    - `/ba-tool/project/[id]/wireframes` page with 3 sections: **Mapping** (Track Y) → **Lo-fi gallery** (iframe preview + callouts) → **Hi-fi gallery** (iframe preview); Generate Lo-fi / Generate Hi-fi buttons gated on the mapping
    - **Upload (single/bulk)** button (HTML/PNG/JPG) + a panel reflecting `CUSTOMER_WIREFRAME` inputs
    - Header nav: **← PRD** and **HLD →**; project dashboard gets a **"Wireframes"** card between PRD and HLD
    - `pipeline-api.ts` helpers (generate lo-fi/hi-fi, upload, list screens, customer wireframes)
  - Files: `frontend/app/ba-tool/project/[id]/wireframes/page.tsx`, `frontend/components/ba-tool/WireframeGallery.tsx` (new), `frontend/app/ba-tool/project/[id]/page.tsx` (nav), `frontend/lib/pipeline-api.ts`
  - Effort: L

- [ ] **Task 9 (Z-05): Pipeline integration — HLD context, readiness, freshness** (P0-BE)
  - Acceptance:
    - HLD `buildWireframeContext` prefers the latest `PIPELINE` wireframe set (falls back to `DISCOVERY`)
    - Module readiness (N-01) Wireframes gate satisfied by the PIPELINE set
    - **Freshness (v6 Track T) extended**: `ArtifactFreshnessService` treats the screen map + wireframes as downstream of PRD and upstream of HLD — PRD change ⇒ screen-map/wireframes stale; map/wireframe change ⇒ HLD stale; `FreshnessBanner` surfaces it on the Wireframes + HLD pages; `RequirementChangeService` flags them
  - Files: `backend/src/ba-tool/pipeline/project-hld.service.ts`, `artifact-freshness.service.ts`, `requirement-change.service.ts`, `module-readiness.service.ts`, `frontend/.../wireframes/page.tsx` (banner)
  - Effort: M

- [ ] **Task 10 (Z-06): Wire-up + smoke + regression** (P1)
  - Acceptance:
    - Full flow on a real project: generate PRD → generate screen map (annotations cite PRD §/FR) → edit + CSV round-trip → generate lo-fi → hi-fi → both mirrored to disk
    - Bulk-upload 3rd-party wireframes → reflected; `CUSTOMER_WIREFRAME` inputs reflected
    - HLD context picks the PIPELINE set; freshness banner flips when the PRD changes
    - **Discovery wireframes still generate** (no regression from the nullable AN FK); customer-inputs/PRD/HLD/E2E/implementation all still 200
    - `tsc --noEmit` clean (backend + frontend); CSV parser + any pure helpers unit-tested
  - Files: smoke notes; fixes across touched files
  - Effort: S

---

## Task Summary

| # | Phase | Track | Priority | Effort | Deliverable |
|---|---|---|---|---|---|
| 1 | Mapping | Y-01 | P0 | S | `BaScreenMap` + `BaScreenMapRow` + migration |
| 2 | Mapping | Y-02 | P0 | M | AI `/screen-map-generate` (PRD-grounded) + prompt |
| 3 | Mapping | Y-03 | P0 | L | `ScreenMapService` — generate/CRUD/CSV import+export |
| 4 | Mapping | Y-04 FE | P0 | L | Screen↔Feature Mapping table + annotations editor + CSV |
| 5 | Wireframes | Z-01 | P0 | S | Extend `BaWireframeSet` (`source`/`screenMapId`/nullable AN) |
| 6 | Wireframes | Z-02 | P0 | L | Lo-fi from screen map → hi-fi (PIPELINE source) |
| 7 | Wireframes | Z-03 | P0 | M | Upload (single/bulk) + reflect `CUSTOMER_WIREFRAME` |
| 8 | Wireframes | Z-04 FE | P0 | L | Wireframes page (mapping + lo-fi + hi-fi + upload) + nav |
| 9 | Integration | Z-05 | P0 | M | HLD context + readiness + freshness (PRD→map→wf→HLD) |
| 10 | Wire-up | Z-06 | P1 | S | Smoke + regression (incl. Discovery no-regression) |

**Total tasks: 10**  
**P0: 9 | P1: 1**  
**Track Y (mapping): 4 · Track Z (wireframes): 6**

---

## Acceptance Criteria — Sprint Complete

- [ ] A screen↔feature mapping is generated **from the PRD**; every `frRef` is a §6 FR-ID and every annotation `prdRef` cites PRD content (no SRS/BRD/AN refs).
- [ ] The mapping is editable and round-trips via CSV import/export (reference shape, PRD-referenced); coverage (orphan FRs/screens) is shown.
- [ ] Lo-fi wireframes generate from the mapping (callouts = annotations); hi-fi generate from lo-fi; both mirror to disk.
- [ ] 3rd-party wireframes can be **bulk-uploaded**; `CUSTOMER_WIREFRAME` inputs are reflected; regeneration preserves uploaded screens.
- [ ] The Wireframes stage sits between PRD and HLD in the nav; HLD consumes the PIPELINE wireframes; readiness gate satisfied.
- [ ] Freshness propagates PRD → screen-map → lo-fi → hi-fi → HLD.
- [ ] **Discovery (BRD/AN) wireframes still work** — no regression; `tsc` clean both apps; CSV parser unit-tested.

---

## Open questions — RESOLVED (2026-06-04)

1. ✅ **Screen-map disk location** — `ProjectArtifacts/02b-ScreenMap/`.
2. ✅ **Upload file types** — **HTML / PNG / JPG / PDF / SVG** (Figma exports ingested as PDF/SVG/PNG; raw `.fig` rejected with guidance).
3. ✅ **Regeneration vs uploads** — regeneration **merges**; uploaded 3rd-party screens are preserved.

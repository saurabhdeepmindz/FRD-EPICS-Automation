-- Sprint v8 / Z-01 — allow PRD-sourced + uploaded wireframe sets on the pipeline
-- Run as: psql -U prd_user -d new_prd_generator -f prisma/migrations/wireframe_source.sql
-- Created: 2026-06-04
-- Additive + a NOT NULL relaxation. Existing Discovery rows backfill source='DISCOVERY'
-- and keep their approachNoteVersionId, so the Discovery flow is unaffected.

ALTER TABLE "ba_wireframe_sets"
    ALTER COLUMN "approachNoteVersionId" DROP NOT NULL;

ALTER TABLE "ba_wireframe_sets"
    ADD COLUMN IF NOT EXISTS "source"                 TEXT NOT NULL DEFAULT 'DISCOVERY',
    ADD COLUMN IF NOT EXISTS "screenMapId"            TEXT,
    ADD COLUMN IF NOT EXISTS "sourceArtifactVersions" JSONB;

CREATE INDEX IF NOT EXISTS "ba_wireframe_sets_projectId_source_idx" ON "ba_wireframe_sets"("projectId", "source");

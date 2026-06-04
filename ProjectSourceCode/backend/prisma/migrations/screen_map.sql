-- Sprint v8 / Y-01 — Screen ↔ Feature Mapping (PRD-sourced)
-- Run as: psql -U prd_user -d new_prd_generator -f prisma/migrations/screen_map.sql
--   (prd_user owns the public schema — no superuser needed)
-- Created: 2026-06-04
-- Additive only — two new tables; references the existing BaArtifactStatus + BaTriggeredBy enums.

CREATE TABLE IF NOT EXISTS "ba_screen_maps" (
    "id"                     TEXT NOT NULL,
    "projectId"              TEXT NOT NULL,
    "version"                INTEGER NOT NULL DEFAULT 1,
    "status"                 "BaArtifactStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceArtifactVersions" JSONB,
    "triggeredBy"            "BaTriggeredBy" DEFAULT 'INITIAL_GENERATION',
    "metadata"               JSONB NOT NULL DEFAULT '{}',
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_screen_maps_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_screen_maps"
    ADD CONSTRAINT "ba_screen_maps_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "ba_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ba_screen_maps_projectId_idx"          ON "ba_screen_maps"("projectId");
CREATE INDEX IF NOT EXISTS "ba_screen_maps_projectId_version_idx"  ON "ba_screen_maps"("projectId", "version");

CREATE TABLE IF NOT EXISTS "ba_screen_map_rows" (
    "id"                     TEXT NOT NULL,
    "screenMapId"            TEXT NOT NULL,
    "screenId"               TEXT NOT NULL,
    "sequenceNum"            INTEGER NOT NULL,
    "screenName"             TEXT NOT NULL,
    "prdSections"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "featureRefs"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "featureDescription"     TEXT NOT NULL DEFAULT '',
    "businessRulesPrd"       TEXT NOT NULL DEFAULT '',
    "businessRulesArchitect" TEXT NOT NULL DEFAULT '',
    "screenDescription"      TEXT NOT NULL DEFAULT '',
    "annotations"            JSONB NOT NULL DEFAULT '[]',
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_screen_map_rows_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_screen_map_rows"
    ADD CONSTRAINT "ba_screen_map_rows_screenMapId_fkey"
    FOREIGN KEY ("screenMapId") REFERENCES "ba_screen_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "ba_screen_map_rows_screenMapId_sequenceNum_key" ON "ba_screen_map_rows"("screenMapId", "sequenceNum");
CREATE INDEX IF NOT EXISTS "ba_screen_map_rows_screenMapId_idx" ON "ba_screen_map_rows"("screenMapId");

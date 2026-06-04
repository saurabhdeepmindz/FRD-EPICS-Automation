-- Sprint v9 / AA-01 — Design System ("Look & Feel" Studio) + preset library
-- Run as: psql -U prd_user -d new_prd_generator -f prisma/migrations/design_system.sql
--   (prd_user owns the public schema — no superuser needed)
-- Created: 2026-06-04
-- Additive only — two new tables + one nullable column on ba_wireframe_sets.

CREATE TABLE IF NOT EXISTS "ba_design_systems" (
    "id"                     TEXT NOT NULL,
    "projectId"              TEXT NOT NULL,
    "version"                INTEGER NOT NULL DEFAULT 1,
    "status"                 "BaArtifactStatus" NOT NULL DEFAULT 'DRAFT',
    "tokens"                 JSONB NOT NULL,
    "logo"                   JSONB,
    "presetId"               TEXT,
    "sourceArtifactVersions" JSONB,
    "metadata"               JSONB NOT NULL DEFAULT '{}',
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_design_systems_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_design_systems"
    ADD CONSTRAINT "ba_design_systems_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "ba_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ba_design_systems_projectId_idx"         ON "ba_design_systems"("projectId");
CREATE INDEX IF NOT EXISTS "ba_design_systems_projectId_version_idx" ON "ba_design_systems"("projectId", "version");

CREATE TABLE IF NOT EXISTS "ba_design_presets" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "scope"       TEXT NOT NULL DEFAULT 'GLOBAL',
    "projectId"   TEXT,
    "tokens"      JSONB NOT NULL,
    "thumbnail"   TEXT,
    "isSeed"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_design_presets_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_design_presets"
    ADD CONSTRAINT "ba_design_presets_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "ba_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ba_design_presets_scope_idx"     ON "ba_design_presets"("scope");
CREATE INDEX IF NOT EXISTS "ba_design_presets_projectId_idx" ON "ba_design_presets"("projectId");

-- Link a wireframe set to the design system whose tokens styled it (v9 DD-02).
ALTER TABLE "ba_wireframe_sets" ADD COLUMN IF NOT EXISTS "designSystemId" TEXT;

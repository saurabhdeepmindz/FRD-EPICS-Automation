-- Sprint v7 / Task 1 (W-02) — add PRD-level metadata to ba_project_prds
-- Run as: psql -U prd_user -d new_prd_generator -f prisma/migrations/prd_metadata_fields.sql
-- Created: 2026-06-03
-- Additive only — three nullable text columns. Existing rows tolerate NULL
-- (clientName / submittedBy inherit from ba_projects at read time when null).

ALTER TABLE "ba_project_prds"
    ADD COLUMN IF NOT EXISTS "prdCode"     TEXT,
    ADD COLUMN IF NOT EXISTS "clientName"  TEXT,
    ADD COLUMN IF NOT EXISTS "submittedBy" TEXT;

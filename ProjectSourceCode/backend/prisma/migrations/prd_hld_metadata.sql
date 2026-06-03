-- Sprint v6 / Track S-01 — add `metadata` JSON to ba_project_prds + ba_hlds
-- Run as: psql -U prd_user -d new_prd_generator -f prisma/migrations/prd_hld_metadata.sql
--   (prd_user owns the public schema since _setup_prd_user_permissions.sql — no superuser needed)
-- Created: 2026-06-03
-- Additive only — one nullable-defaulted JSONB column per table. Existing rows default to '{}'.
--
-- Holds interactive-authoring + forward-propagation state (Tracks S/T):
--   metadata.gaps       : [{ section, question }]                    persisted AI gaps
--   metadata.gapAnswers : [{ section, question, answer, answeredAt }] audit trail (PRD only)
--   metadata.freshness  : { computedAt, downstream:[{ artifactType, id, builtFrom, current, stale, reason }] }

-- 1. ba_project_prds.metadata
ALTER TABLE "ba_project_prds"
    ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

-- 2. ba_hlds.metadata
ALTER TABLE "ba_hlds"
    ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

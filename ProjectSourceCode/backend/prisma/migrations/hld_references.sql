-- Sprint v11 / Track RR (RR-01) — HLD Copilot References (URLs + documents)
-- Run as: psql -U prd_user -d new_prd_generator -f prisma/migrations/hld_references.sql
-- Created: 2026-06-07
-- Additive only — one new table. Included references feed the /hld-chat context.

CREATE TABLE IF NOT EXISTS "ba_hld_references" (
    "id"               TEXT NOT NULL,
    "hldId"            TEXT NOT NULL,
    "sectionKey"       TEXT,
    "type"             TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "sourceUrl"        TEXT,
    "fileName"         TEXT,
    "mimeType"         TEXT,
    "extractedText"    TEXT NOT NULL DEFAULT '',
    "summary"          TEXT,
    "status"           TEXT NOT NULL DEFAULT 'PENDING',
    "error"            TEXT,
    "includeInContext" BOOLEAN NOT NULL DEFAULT true,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_hld_references_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ba_hld_references_hldId_idx" ON "ba_hld_references"("hldId");

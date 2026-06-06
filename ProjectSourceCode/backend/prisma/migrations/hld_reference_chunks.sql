-- Sprint v11 / HD-13 — RAG chunks for Copilot references (app-side cosine, no pgvector)
-- Run as: psql -U prd_user -d new_prd_generator -f prisma/migrations/hld_reference_chunks.sql
-- Created: 2026-06-07 · Additive only — one new table.

CREATE TABLE IF NOT EXISTS "ba_hld_reference_chunks" (
    "id"          TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "hldId"       TEXT NOT NULL,
    "sectionKey"  TEXT,
    "idx"         INTEGER NOT NULL,
    "text"        TEXT NOT NULL,
    "embedding"   JSONB NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_hld_reference_chunks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_hld_reference_chunks"
    ADD CONSTRAINT "ba_hld_reference_chunks_referenceId_fkey"
    FOREIGN KEY ("referenceId") REFERENCES "ba_hld_references"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ba_hld_reference_chunks_hldId_idx" ON "ba_hld_reference_chunks"("hldId");
CREATE INDEX IF NOT EXISTS "ba_hld_reference_chunks_referenceId_idx" ON "ba_hld_reference_chunks"("referenceId");

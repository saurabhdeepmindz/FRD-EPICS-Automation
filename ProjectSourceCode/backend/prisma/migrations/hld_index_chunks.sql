-- Sprint v11 / HD-10 — HLD repository index (org-wide "find similar" + browse)
-- Run as: psql -U prd_user -d new_prd_generator -f prisma/migrations/hld_index_chunks.sql
-- Created: 2026-06-07 · Additive only — one new table (app-side cosine, no pgvector).

CREATE TABLE IF NOT EXISTS "ba_hld_index_chunks" (
    "id"          TEXT NOT NULL,
    "hldId"       TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sectionKey"  TEXT NOT NULL,
    "idx"         INTEGER NOT NULL,
    "text"        TEXT NOT NULL,
    "embedding"   JSONB NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_hld_index_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ba_hld_index_chunks_hldId_idx" ON "ba_hld_index_chunks"("hldId");
CREATE INDEX IF NOT EXISTS "ba_hld_index_chunks_projectId_idx" ON "ba_hld_index_chunks"("projectId");

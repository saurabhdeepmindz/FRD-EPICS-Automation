-- Sprint v10 / Track C (HE-07) — HLD Architect Copilot: per-section AI threads + messages
-- Run as: psql -U prd_user -d new_prd_generator -f prisma/migrations/hld_copilot.sql
--   (prd_user owns the public schema — no superuser needed)
-- Created: 2026-06-07
-- Additive only — two new tables. Saved "insights" = messages with savedToSection = true.

CREATE TABLE IF NOT EXISTS "ba_hld_threads" (
    "id"         TEXT NOT NULL,
    "hldId"      TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_hld_threads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ba_hld_threads_hldId_sectionKey_key" ON "ba_hld_threads"("hldId", "sectionKey");
CREATE INDEX IF NOT EXISTS "ba_hld_threads_hldId_idx" ON "ba_hld_threads"("hldId");

CREATE TABLE IF NOT EXISTS "ba_hld_messages" (
    "id"             TEXT NOT NULL,
    "threadId"       TEXT NOT NULL,
    "role"           TEXT NOT NULL,
    "model"          TEXT,
    "content"        TEXT NOT NULL,
    "savedToSection" BOOLEAN NOT NULL DEFAULT false,
    "templateRef"    TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_hld_messages_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_hld_messages"
    ADD CONSTRAINT "ba_hld_messages_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "ba_hld_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ba_hld_messages_threadId_idx" ON "ba_hld_messages"("threadId");

-- Track P-04/P-05 + J — BaUpstreamSync: staged downstream→upstream auto-drafts.
-- Run as prd_user via:
--   npx prisma db execute --file prisma/migrations/upstream_syncs.sql --schema prisma/schema.prisma

CREATE TYPE "BaUpstreamSyncStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "ba_upstream_syncs" (
    "id"               TEXT NOT NULL,
    "moduleDbId"       TEXT NOT NULL,
    "projectId"        TEXT NOT NULL,
    "status"           "BaUpstreamSyncStatus" NOT NULL DEFAULT 'PENDING',
    "trigger"          TEXT NOT NULL,
    "filePath"         TEXT,
    "summary"          TEXT NOT NULL,
    "proposedLld"      TEXT,
    "proposedSubtask"  JSONB,
    "changelogEntry"   TEXT,
    "rtmRow"           JSONB,
    "triggeredByRunId" TEXT,
    "resolvedAt"       TIMESTAMP(3),
    "resolvedNote"     TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_upstream_syncs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_upstream_syncs"
    ADD CONSTRAINT "ba_upstream_syncs_moduleDbId_fkey"
    FOREIGN KEY ("moduleDbId") REFERENCES "ba_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ba_upstream_syncs_moduleDbId_status_idx" ON "ba_upstream_syncs"("moduleDbId", "status");
CREATE INDEX "ba_upstream_syncs_projectId_idx"         ON "ba_upstream_syncs"("projectId");

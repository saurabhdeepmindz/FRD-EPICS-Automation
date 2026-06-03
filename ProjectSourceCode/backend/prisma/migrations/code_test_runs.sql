-- Track P/Q (Q-01) — BaCodeTestRun: two-tier code-gen test results + history.
-- Renamed from the earlier (mistaken) ba_test_runs to avoid colliding with the
-- existing ba_test_runs (test-case execution tracking).
-- Run as prd_user via:
--   npx prisma db execute --file prisma/migrations/code_test_runs.sql --schema prisma/schema.prisma

CREATE TYPE "BaCodeTestRunKind" AS ENUM ('DEV', 'FTC');
CREATE TYPE "BaCodeTestRunStatus" AS ENUM ('RUNNING', 'PASSED', 'FAILED', 'ERROR');

CREATE TABLE "ba_code_test_runs" (
    "id"               TEXT NOT NULL,
    "moduleDbId"       TEXT NOT NULL,
    "projectId"        TEXT NOT NULL,
    "kind"             "BaCodeTestRunKind" NOT NULL,
    "framework"        TEXT NOT NULL,
    "status"           "BaCodeTestRunStatus" NOT NULL DEFAULT 'RUNNING',
    "total"            INTEGER NOT NULL DEFAULT 0,
    "passed"           INTEGER NOT NULL DEFAULT 0,
    "failed"           INTEGER NOT NULL DEFAULT 0,
    "skipped"          INTEGER NOT NULL DEFAULT 0,
    "durationMs"       INTEGER,
    "command"          TEXT,
    "output"           TEXT,
    "artifacts"        JSONB,
    "reportPath"       TEXT,
    "triggeredByRunId" TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_code_test_runs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_code_test_runs"
    ADD CONSTRAINT "ba_code_test_runs_moduleDbId_fkey"
    FOREIGN KEY ("moduleDbId") REFERENCES "ba_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ba_code_test_runs_moduleDbId_kind_createdAt_idx" ON "ba_code_test_runs"("moduleDbId", "kind", "createdAt");
CREATE INDEX "ba_code_test_runs_projectId_idx"                 ON "ba_code_test_runs"("projectId");

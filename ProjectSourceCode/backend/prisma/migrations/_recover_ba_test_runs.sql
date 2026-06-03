-- RECOVERY (2026-06-01) — restore the pre-existing ba_test_runs that was
-- accidentally dropped/replaced while adding the new code-test-run feature.
-- Rebuilds the ORIGINAL structure (test-case execution tracking) + FKs.
-- Row data is restored separately from the 2026-05-22 backup.

-- 1. Remove the wrong table + enums that were mistakenly created.
DROP TABLE IF EXISTS "ba_test_runs" CASCADE;
DROP TYPE IF EXISTS "BaTestRunKind" CASCADE;
DROP TYPE IF EXISTS "BaTestRunStatus" CASCADE;

-- 2. Recreate the ORIGINAL ba_test_runs (matches schema model BaTestRun).
CREATE TABLE "ba_test_runs" (
    "id"          TEXT NOT NULL,
    "testCaseId"  TEXT NOT NULL,
    "sprintId"    TEXT,
    "sprintDbId"  TEXT,
    "executor"    TEXT,
    "executedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"      TEXT NOT NULL,
    "notes"       TEXT,
    "durationSec" INTEGER,
    "environment" TEXT,
    "deletedAt"   TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_test_runs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_test_runs" ADD CONSTRAINT "ba_test_runs_testCaseId_fkey"
    FOREIGN KEY ("testCaseId") REFERENCES "ba_test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ba_test_runs" ADD CONSTRAINT "ba_test_runs_sprintDbId_fkey"
    FOREIGN KEY ("sprintDbId") REFERENCES "ba_sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ba_test_runs_testCaseId_executedAt_idx" ON "ba_test_runs"("testCaseId", "executedAt");
CREATE INDEX "ba_test_runs_testCaseId_deletedAt_idx"  ON "ba_test_runs"("testCaseId", "deletedAt");

-- 3. (data rows restored from backup here — see _restore_ba_test_runs_rows.sql)
-- 4. The ba_defects -> ba_test_runs FK is re-added AFTER the rows are restored
--    (see _recover_ba_defects_fk.sql) so the existing defect's firstSeenRunId
--    resolves. Drop any leftover/partial constraint first to stay idempotent.
ALTER TABLE "ba_defects" DROP CONSTRAINT IF EXISTS "ba_defects_firstSeenRunId_fkey";

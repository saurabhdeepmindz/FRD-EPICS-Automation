-- RECOVERY step 4 — re-add the ba_defects -> ba_test_runs FK after the
-- ba_test_runs rows have been restored from backup.
ALTER TABLE "ba_defects" DROP CONSTRAINT IF EXISTS "ba_defects_firstSeenRunId_fkey";
ALTER TABLE "ba_defects" ADD CONSTRAINT "ba_defects_firstSeenRunId_fkey"
    FOREIGN KEY ("firstSeenRunId") REFERENCES "ba_test_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

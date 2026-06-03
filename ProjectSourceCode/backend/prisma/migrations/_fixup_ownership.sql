-- Reassign ownership of the postgres-owned new tables to prd_user, then finish
-- the two ALTERs that failed (ba_project_prds, ba_hlds).
-- Run as: psql -U postgres (password root)

ALTER TABLE "ba_customer_inputs"         OWNER TO prd_user;
ALTER TABLE "ba_project_prds"            OWNER TO prd_user;
ALTER TABLE "ba_hlds"                    OWNER TO prd_user;
ALTER TABLE "ba_project_implementations" OWNER TO prd_user;
ALTER TABLE "ba_change_requests"         OWNER TO prd_user;
ALTER TYPE  "BaCustomerInputType"        OWNER TO prd_user;
ALTER TYPE  "BaScaffoldStatus"           OWNER TO prd_user;
ALTER TYPE  "BaContextStatus"            OWNER TO prd_user;
ALTER TYPE  "BaTriggeredBy"              OWNER TO prd_user;
ALTER TYPE  "BaChangeRequestStatus"      OWNER TO prd_user;
ALTER TYPE  "BaChangeRequestStage"       OWNER TO prd_user;

-- Finish the failed ALTERs
ALTER TABLE "ba_project_prds"
    ADD COLUMN IF NOT EXISTS "triggeredBy"            "BaTriggeredBy" DEFAULT 'INITIAL_GENERATION',
    ADD COLUMN IF NOT EXISTS "changeRequestId"        TEXT,
    ADD COLUMN IF NOT EXISTS "sourceArtifactVersions" JSONB;
CREATE INDEX IF NOT EXISTS "ba_project_prds_changeRequestId_idx" ON "ba_project_prds"("changeRequestId");

ALTER TABLE "ba_hlds"
    ADD COLUMN IF NOT EXISTS "triggeredBy"            "BaTriggeredBy" DEFAULT 'INITIAL_GENERATION',
    ADD COLUMN IF NOT EXISTS "changeRequestId"        TEXT,
    ADD COLUMN IF NOT EXISTS "sourceArtifactVersions" JSONB;
CREATE INDEX IF NOT EXISTS "ba_hlds_changeRequestId_idx" ON "ba_hlds"("changeRequestId");

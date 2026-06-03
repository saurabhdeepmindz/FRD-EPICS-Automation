-- CR Foundation Migration (Track M — schema only, UI deferred)
-- Run as: psql -U postgres -d new_prd_generator -f prisma/migrations/cr_foundation.sql
-- Created: 2026-05-31
-- Additive only — adds nullable traceability fields + the parked BaChangeRequest table.

-- 1. New enums
CREATE TYPE "BaTriggeredBy" AS ENUM (
  'INITIAL_GENERATION',
  'CHANGE_REQUEST',
  'DOWNSTREAM_SYNC',
  'MANUAL_EDIT'
);

CREATE TYPE "BaChangeRequestStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'IN_PROGRESS',
  'IMPLEMENTED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "BaChangeRequestStage" AS ENUM (
  'CUSTOMER_INPUTS',
  'PRD_FRD',
  'WIREFRAMES',
  'HLD',
  'EPICS',
  'USER_STORIES',
  'SUBTASKS',
  'LLD',
  'SOURCE_CODE'
);

-- 2. BaChangeRequest table (parked — no UI yet)
CREATE TABLE "ba_change_requests" (
    "id"                  TEXT NOT NULL,
    "projectId"           TEXT NOT NULL,
    "crCode"              TEXT NOT NULL,
    "title"               TEXT NOT NULL,
    "description"         TEXT NOT NULL,
    "status"              "BaChangeRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "stage"               "BaChangeRequestStage" NOT NULL,
    "changeType"          TEXT,
    "priority"            TEXT NOT NULL DEFAULT 'MEDIUM',
    "requestedBy"         TEXT,
    "impactedArtifactIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "metadata"            JSONB NOT NULL DEFAULT '{}',
    "approvedBy"          TEXT,
    "implementedAt"       TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_change_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_change_requests"
    ADD CONSTRAINT "ba_change_requests_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "ba_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ba_change_requests_projectId_crCode_key" ON "ba_change_requests"("projectId", "crCode");
CREATE INDEX "ba_change_requests_projectId_idx"               ON "ba_change_requests"("projectId");
CREATE INDEX "ba_change_requests_projectId_status_idx"        ON "ba_change_requests"("projectId", "status");

-- 3. Traceability fields on ba_artifacts (existing rows backfill to INITIAL_GENERATION)
ALTER TABLE "ba_artifacts"
    ADD COLUMN "triggeredBy"            "BaTriggeredBy" DEFAULT 'INITIAL_GENERATION',
    ADD COLUMN "changeRequestId"        TEXT,
    ADD COLUMN "sourceArtifactVersions" JSONB;
CREATE INDEX "ba_artifacts_changeRequestId_idx" ON "ba_artifacts"("changeRequestId");

-- 4. Traceability fields on ba_project_prds
ALTER TABLE "ba_project_prds"
    ADD COLUMN "triggeredBy"            "BaTriggeredBy" DEFAULT 'INITIAL_GENERATION',
    ADD COLUMN "changeRequestId"        TEXT,
    ADD COLUMN "sourceArtifactVersions" JSONB;
CREATE INDEX "ba_project_prds_changeRequestId_idx" ON "ba_project_prds"("changeRequestId");

-- 5. Traceability fields on ba_hlds
ALTER TABLE "ba_hlds"
    ADD COLUMN "triggeredBy"            "BaTriggeredBy" DEFAULT 'INITIAL_GENERATION',
    ADD COLUMN "changeRequestId"        TEXT,
    ADD COLUMN "sourceArtifactVersions" JSONB;
CREATE INDEX "ba_hlds_changeRequestId_idx" ON "ba_hlds"("changeRequestId");

-- 6. Soft CR reference on ba_rtm_rows
ALTER TABLE "ba_rtm_rows"
    ADD COLUMN "changeRequestId" TEXT;

-- 7. Grants for prd_user
GRANT ALL ON TABLE "ba_change_requests" TO prd_user;
GRANT USAGE ON TYPE "BaTriggeredBy"         TO prd_user;
GRANT USAGE ON TYPE "BaChangeRequestStatus" TO prd_user;
GRANT USAGE ON TYPE "BaChangeRequestStage"  TO prd_user;

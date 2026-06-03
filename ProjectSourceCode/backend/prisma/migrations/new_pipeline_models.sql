-- New Pipeline Models Migration
-- Run as: psql -U postgres -d new_prd_generator -f prisma/migrations/new_pipeline_models.sql
-- Created: 2026-05-31

-- 1. New enums
CREATE TYPE "BaCustomerInputType" AS ENUM (
  'AUDIO',
  'EXTERNAL_BRD',
  'CUSTOMER_WIREFRAME',
  'TEXT_CONTEXT',
  'DOCUMENT'
);

CREATE TYPE "BaScaffoldStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETE',
  'ERROR'
);

CREATE TYPE "BaContextStatus" AS ENUM (
  'PENDING',
  'GENERATING',
  'COMPLETE',
  'ERROR'
);

-- 2. Customer Input Hub (Stage 1)
CREATE TABLE "ba_customer_inputs" (
    "id"            TEXT NOT NULL,
    "projectId"     TEXT NOT NULL,
    "inputType"     "BaCustomerInputType" NOT NULL,
    "label"         TEXT NOT NULL,
    "fileData"      TEXT,
    "fileMetadata"  JSONB,
    "extractedText" TEXT,
    "metadata"      JSONB NOT NULL DEFAULT '{}',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_customer_inputs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_customer_inputs"
    ADD CONSTRAINT "ba_customer_inputs_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "ba_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ba_customer_inputs_projectId_idx"       ON "ba_customer_inputs"("projectId");
CREATE INDEX "ba_customer_inputs_projectId_type_idx"  ON "ba_customer_inputs"("projectId", "inputType");

-- 3. Combined PRD + FRD (Stage 2)
CREATE TABLE "ba_project_prds" (
    "id"             TEXT NOT NULL,
    "projectId"      TEXT NOT NULL,
    "version"        INTEGER NOT NULL DEFAULT 1,
    "status"         "BaArtifactStatus" NOT NULL DEFAULT 'DRAFT',
    "sections"       JSONB NOT NULL DEFAULT '{}',
    "changesSince"   TEXT,
    "sourceInputIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_project_prds_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_project_prds"
    ADD CONSTRAINT "ba_project_prds_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "ba_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ba_project_prds_projectId_idx"         ON "ba_project_prds"("projectId");
CREATE INDEX "ba_project_prds_projectId_version_idx" ON "ba_project_prds"("projectId", "version");

-- 4. High Level Design / HLD (Stage 5)
CREATE TABLE "ba_hlds" (
    "id"              TEXT NOT NULL,
    "projectId"       TEXT NOT NULL,
    "version"         INTEGER NOT NULL DEFAULT 1,
    "status"          "BaArtifactStatus" NOT NULL DEFAULT 'DRAFT',
    "sections"        JSONB NOT NULL DEFAULT '{}',
    "mermaidDiagrams" JSONB NOT NULL DEFAULT '{}',
    "changesSince"    TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_hlds_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_hlds"
    ADD CONSTRAINT "ba_hlds_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "ba_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ba_hlds_projectId_idx"         ON "ba_hlds"("projectId");
CREATE INDEX "ba_hlds_projectId_version_idx" ON "ba_hlds"("projectId", "version");

-- 5. Project Implementation Folder (Stage 8)
CREATE TABLE "ba_project_implementations" (
    "id"                       TEXT NOT NULL,
    "projectId"                TEXT NOT NULL,
    "folderPath"               TEXT NOT NULL,
    "scaffoldStatus"           "BaScaffoldStatus" NOT NULL DEFAULT 'PENDING',
    "contextEngineeringStatus" "BaContextStatus"  NOT NULL DEFAULT 'PENDING',
    "lldSyncedAt"              TIMESTAMP(3),
    "lastContextRefreshedAt"   TIMESTAMP(3),
    "metadata"                 JSONB NOT NULL DEFAULT '{}',
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_project_implementations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_project_implementations"
    ADD CONSTRAINT "ba_project_implementations_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "ba_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ba_project_implementations_projectId_key"
    ON "ba_project_implementations"("projectId");

-- Grant table access to prd_user
GRANT ALL ON TABLE "ba_customer_inputs"        TO prd_user;
GRANT ALL ON TABLE "ba_project_prds"           TO prd_user;
GRANT ALL ON TABLE "ba_hlds"                   TO prd_user;
GRANT ALL ON TABLE "ba_project_implementations" TO prd_user;

-- Grant usage on new enum types
GRANT USAGE ON TYPE "BaCustomerInputType" TO prd_user;
GRANT USAGE ON TYPE "BaScaffoldStatus"    TO prd_user;
GRANT USAGE ON TYPE "BaContextStatus"     TO prd_user;

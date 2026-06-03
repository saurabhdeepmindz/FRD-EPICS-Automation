-- Track R (R-P0) — E2E-Flow foundation schema (STRICTLY ADDITIVE).
-- Run as prd_user via psql (ALTER TYPE ADD VALUE needs autocommit):
--   psql -U prd_user -h localhost -d new_prd_generator -v ON_ERROR_STOP=1 -f prisma/migrations/e2e_flows.sql

-- 1. Extend BaArtifactType (backward-compatible enum add).
ALTER TYPE "BaArtifactType" ADD VALUE IF NOT EXISTS 'E2E_FLOW';

-- 2. New enum for decision-graph step nodes.
CREATE TYPE "BaE2eNodeType" AS ENUM ('START', 'STEP', 'DECISION', 'JOIN', 'END');

-- 3. Additive nullable / default-empty columns on existing tables.
ALTER TABLE "ba_projects"
    ADD COLUMN IF NOT EXISTS "e2eFlowCompletedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "e2eFlowActiveId"    TEXT;

ALTER TABLE "ba_rtm_rows"
    ADD COLUMN IF NOT EXISTS "e2eFlowIds"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS "e2eFlowStepRefs"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS "e2eFlowMappingNotes" TEXT;

ALTER TABLE "ba_test_cases"
    ADD COLUMN IF NOT EXISTS "linkedE2eFlowIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS "linkedE2eStepIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 4. ba_e2e_flows (project-scoped journey container).
CREATE TABLE "ba_e2e_flows" (
    "id"                     TEXT NOT NULL,
    "projectId"              TEXT NOT NULL,
    "flowKey"                TEXT NOT NULL,
    "flowName"               TEXT NOT NULL,
    "journeyType"            TEXT,
    "primaryRole"            TEXT,
    "secondaryRoles"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status"                 "BaArtifactStatus" NOT NULL DEFAULT 'DRAFT',
    "spannedModuleIds"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "mermaidDiagrams"        JSONB NOT NULL DEFAULT '{}',
    "e2eArtifactId"          TEXT,
    "triggeredBy"            "BaTriggeredBy" DEFAULT 'INITIAL_GENERATION',
    "changeRequestId"        TEXT,
    "sourceArtifactVersions" JSONB,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_e2e_flows_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ba_e2e_flows" ADD CONSTRAINT "ba_e2e_flows_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "ba_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ba_e2e_flows_projectId_flowKey_key" ON "ba_e2e_flows"("projectId", "flowKey");
CREATE INDEX "ba_e2e_flows_projectId_idx"        ON "ba_e2e_flows"("projectId");
CREATE INDEX "ba_e2e_flows_changeRequestId_idx"  ON "ba_e2e_flows"("changeRequestId");

-- 5. ba_e2e_flow_steps (decision-graph nodes).
CREATE TABLE "ba_e2e_flow_steps" (
    "id"                      TEXT NOT NULL,
    "e2eFlowId"               TEXT NOT NULL,
    "sequenceNum"             INTEGER NOT NULL,
    "stepId"                  TEXT NOT NULL,
    "nodeType"                "BaE2eNodeType" NOT NULL DEFAULT 'STEP',
    "nextStepIds"             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "branchLabels"            JSONB,
    "moduleDbId"              TEXT,
    "screenId"                TEXT,
    "role"                    TEXT,
    "triggerLabel"            TEXT,
    "outcome"                 TEXT,
    "condition"               TEXT,
    "layer"                   TEXT,
    "thirdPartyIntegrationId" TEXT,
    "elaborationByStage"      JSONB NOT NULL DEFAULT '{}',
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_e2e_flow_steps_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ba_e2e_flow_steps" ADD CONSTRAINT "ba_e2e_flow_steps_e2eFlowId_fkey"
    FOREIGN KEY ("e2eFlowId") REFERENCES "ba_e2e_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ba_e2e_flow_steps_e2eFlowId_stepId_key" ON "ba_e2e_flow_steps"("e2eFlowId", "stepId");
CREATE INDEX "ba_e2e_flow_steps_e2eFlowId_sequenceNum_idx"   ON "ba_e2e_flow_steps"("e2eFlowId", "sequenceNum");

-- 6. ba_e2e_flow_configs (mirror ba_ftc_configs, project-scoped).
CREATE TABLE "ba_e2e_flow_configs" (
    "id"                TEXT NOT NULL,
    "projectId"         TEXT NOT NULL,
    "referenceJourneys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "defaultRoles"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "coverageTarget"    TEXT,
    "targetEnv"         TEXT,
    "baseUrl"           TEXT,
    "narrative"         TEXT,
    "useAsAdditional"   BOOLEAN NOT NULL DEFAULT true,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_e2e_flow_configs_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ba_e2e_flow_configs" ADD CONSTRAINT "ba_e2e_flow_configs_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "ba_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ba_e2e_flow_configs_projectId_key" ON "ba_e2e_flow_configs"("projectId");

-- 7. ba_e2e_flow_config_attachments.
CREATE TABLE "ba_e2e_flow_config_attachments" (
    "id"             TEXT NOT NULL,
    "configId"       TEXT NOT NULL,
    "fileName"       TEXT NOT NULL,
    "mimeType"       TEXT NOT NULL,
    "sizeBytes"      INTEGER NOT NULL,
    "storageBackend" TEXT NOT NULL,
    "storageKey"     TEXT NOT NULL,
    "extractedText"  TEXT,
    "extractionNote" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_e2e_flow_config_attachments_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ba_e2e_flow_config_attachments" ADD CONSTRAINT "ba_e2e_flow_config_attachments_configId_fkey"
    FOREIGN KEY ("configId") REFERENCES "ba_e2e_flow_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ba_e2e_flow_config_attachments_configId_idx" ON "ba_e2e_flow_config_attachments"("configId");

-- 8. ba_third_party_integrations (external vendor registry).
CREATE TABLE "ba_third_party_integrations" (
    "id"               TEXT NOT NULL,
    "projectId"        TEXT NOT NULL,
    "vendorName"       TEXT NOT NULL,
    "category"         TEXT NOT NULL,
    "endpoint"         TEXT,
    "authScheme"       TEXT,
    "status"           TEXT,
    "source"           TEXT,
    "mappedToFlowIds"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "mappedToStepIds"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "linkedSubtaskIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notes"            TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_third_party_integrations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ba_third_party_integrations" ADD CONSTRAINT "ba_third_party_integrations_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "ba_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ba_third_party_integrations_projectId_idx" ON "ba_third_party_integrations"("projectId");

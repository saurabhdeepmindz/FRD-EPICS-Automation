-- Track O (O-01) — BaCodeTask: the /prd-generated, /dev-executed task plan.
-- Run as prd_user (owns public schema) via:
--   npx prisma db execute --file prisma/migrations/code_tasks.sql --schema prisma/schema.prisma
-- Additive only.

CREATE TYPE "BaCodeTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

CREATE TABLE "ba_code_tasks" (
    "id"             TEXT NOT NULL,
    "moduleDbId"     TEXT NOT NULL,
    "projectId"      TEXT NOT NULL,
    "sequence"       INTEGER NOT NULL,
    "taskKey"        TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "description"    TEXT,
    "status"         "BaCodeTaskStatus" NOT NULL DEFAULT 'PENDING',
    "subtaskRefs"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "pseudoFileRefs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "targetFiles"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "runId"          TEXT,
    "startedAt"      TIMESTAMP(3),
    "completedAt"    TIMESTAMP(3),
    "errorMessage"   TEXT,
    "generatedFiles" JSONB,
    "isDynamic"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_code_tasks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ba_code_tasks"
    ADD CONSTRAINT "ba_code_tasks_moduleDbId_fkey"
    FOREIGN KEY ("moduleDbId") REFERENCES "ba_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ba_code_tasks_moduleDbId_taskKey_key" ON "ba_code_tasks"("moduleDbId", "taskKey");
CREATE INDEX "ba_code_tasks_moduleDbId_sequence_idx"        ON "ba_code_tasks"("moduleDbId", "sequence");
CREATE INDEX "ba_code_tasks_projectId_idx"                  ON "ba_code_tasks"("projectId");

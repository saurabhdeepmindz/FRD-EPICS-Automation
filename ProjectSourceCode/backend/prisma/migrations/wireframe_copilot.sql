-- v12 · Track WC — Wireframe Copilot: chat threads, feedback imports, change register + trail.
-- Additive only. Run as prd_user via:
--   npx prisma db execute --file prisma/migrations/wireframe_copilot.sql --schema prisma/schema.prisma

CREATE TYPE "BaWireframeChangeStatus" AS ENUM
  ('PENDING', 'IN_PROGRESS', 'IMPLEMENTED', 'FAILED', 'NEEDS_REVIEW', 'REVERTED', 'DEFERRED');

CREATE TYPE "BaWireframeChangeSource" AS ENUM ('CUSTOMER', 'INTERNAL');

CREATE TYPE "BaWireframeChangeActivityType" AS ENUM
  ('SUBMITTED', 'EXTRACTED', 'IN_PROGRESS', 'IMPLEMENTED', 'FAILED', 'ACCEPTED', 'REVERTED', 'COMMENT', 'REOPENED', 'NEEDS_REAPPLY');

-- ── Threads + messages ──────────────────────────────────────────────────────────
CREATE TABLE "ba_wireframe_copilot_threads" (
    "id"         TEXT NOT NULL,
    "projectId"  TEXT NOT NULL,
    "scopeLabel" TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_wireframe_copilot_threads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ba_wireframe_copilot_threads_projectId_idx" ON "ba_wireframe_copilot_threads"("projectId");

CREATE TABLE "ba_wireframe_copilot_messages" (
    "id"          TEXT NOT NULL,
    "threadId"    TEXT NOT NULL,
    "role"        TEXT NOT NULL,
    "model"       TEXT,
    "content"     TEXT NOT NULL,
    "targetScope" JSONB,
    "attachments" JSONB,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_wireframe_copilot_messages_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ba_wireframe_copilot_messages"
    ADD CONSTRAINT "ba_wireframe_copilot_messages_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "ba_wireframe_copilot_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ba_wireframe_copilot_messages_threadId_idx" ON "ba_wireframe_copilot_messages"("threadId");

-- ── Feedback imports (provenance) ───────────────────────────────────────────────
CREATE TABLE "ba_wireframe_feedback_imports" (
    "id"          TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "threadId"    TEXT,
    "fileName"    TEXT,
    "source"      "BaWireframeChangeSource" NOT NULL DEFAULT 'CUSTOMER',
    "uploadedBy"  TEXT,
    "uploadedAt"  TIMESTAMP(3),
    "rawText"     TEXT,
    "parsedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_wireframe_feedback_imports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ba_wireframe_feedback_imports_projectId_idx" ON "ba_wireframe_feedback_imports"("projectId");

-- ── Change register ─────────────────────────────────────────────────────────────
CREATE TABLE "ba_wireframe_changes" (
    "id"              TEXT NOT NULL,
    "projectId"       TEXT NOT NULL,
    "threadId"        TEXT,
    "sourceMessageId" TEXT,
    "importId"        TEXT,
    "changeCode"      TEXT NOT NULL,
    "description"     TEXT NOT NULL,
    "targetKind"      TEXT NOT NULL DEFAULT 'HIFI',
    "targetScreens"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scopeAll"        BOOLEAN NOT NULL DEFAULT false,
    "changeKind"      TEXT NOT NULL DEFAULT 'SCREEN',
    "calloutRef"      TEXT,
    "requestedBy"     TEXT,
    "source"          "BaWireframeChangeSource" NOT NULL DEFAULT 'INTERNAL',
    "requestedOn"     TIMESTAMP(3),
    "priority"        TEXT NOT NULL DEFAULT 'MEDIUM',
    "status"          "BaWireframeChangeStatus" NOT NULL DEFAULT 'PENDING',
    "beforeRef"       JSONB,
    "afterRef"        JSONB,
    "rationale"       TEXT,
    "appliedByRunId"  TEXT,
    "appliedAt"       TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_wireframe_changes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ba_wireframe_changes_projectId_changeCode_key" ON "ba_wireframe_changes"("projectId", "changeCode");
CREATE INDEX "ba_wireframe_changes_projectId_status_idx" ON "ba_wireframe_changes"("projectId", "status");

CREATE TABLE "ba_wireframe_change_activities" (
    "id"        TEXT NOT NULL,
    "changeId"  TEXT NOT NULL,
    "type"      "BaWireframeChangeActivityType" NOT NULL,
    "actor"     TEXT,
    "message"   TEXT,
    "metadata"  JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_wireframe_change_activities_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ba_wireframe_change_activities"
    ADD CONSTRAINT "ba_wireframe_change_activities_changeId_fkey"
    FOREIGN KEY ("changeId") REFERENCES "ba_wireframe_changes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ba_wireframe_change_activities_changeId_createdAt_idx" ON "ba_wireframe_change_activities"("changeId", "createdAt");

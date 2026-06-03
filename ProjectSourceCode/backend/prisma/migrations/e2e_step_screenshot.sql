-- E2E-Flow step screenshot (additive) — custom uploaded screenshot per step.
-- Run as prd_user:
--   npx prisma db execute --file prisma/migrations/e2e_step_screenshot.sql --schema prisma/schema.prisma

ALTER TABLE "ba_e2e_flow_steps"
    ADD COLUMN IF NOT EXISTS "screenshotData" TEXT,
    ADD COLUMN IF NOT EXISTS "screenshotName" TEXT;

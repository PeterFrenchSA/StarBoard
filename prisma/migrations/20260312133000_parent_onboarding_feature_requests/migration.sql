-- CreateEnum
CREATE TYPE "SupportTicketType" AS ENUM ('SUPPORT', 'FEATURE_REQUEST');

-- AlterTable
ALTER TABLE "Family"
  ADD COLUMN "themePreset" TEXT NOT NULL DEFAULT 'sun';

ALTER TABLE "User"
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

ALTER TABLE "SupportTicket"
  ADD COLUMN "type" "SupportTicketType" NOT NULL DEFAULT 'SUPPORT';

-- Update existing parents as completed if family already has configured data
UPDATE "User" AS u
SET "onboardingCompletedAt" = CURRENT_TIMESTAMP
WHERE u."role" = 'PARENT'
  AND EXISTS (
    SELECT 1
    FROM "Family" f
    WHERE f."id" = u."familyId"
      AND (
        EXISTS (SELECT 1 FROM "User" c WHERE c."familyId" = f."id" AND c."role" = 'CHILD')
        OR EXISTS (SELECT 1 FROM "Task" t WHERE t."familyId" = f."id")
        OR EXISTS (SELECT 1 FROM "Reward" r WHERE r."familyId" = f."id")
      )
  );

-- Replace ticket index with type-aware index
DROP INDEX IF EXISTS "SupportTicket_familyId_status_updatedAt_idx";
CREATE INDEX "SupportTicket_familyId_type_status_updatedAt_idx" ON "SupportTicket"("familyId", "type", "status", "updatedAt");

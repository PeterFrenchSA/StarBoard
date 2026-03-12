-- Extend enums
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'PARENT_ADDED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'VOICE_TOKEN_CREATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'VOICE_TOKEN_REVOKED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SUPPORT_TICKET_CREATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SUPPORT_TICKET_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'SUPPORT_MESSAGE_CREATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'BILLING_CHECKOUT_STARTED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'BILLING_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'BILLING_PORTAL_OPENED';

-- Create new enums
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'UNPAID');
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_PARENT', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- Family billing fields
ALTER TABLE "Family"
  ADD COLUMN "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
  ADD COLUMN "billingEmail" TEXT,
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "stripePriceId" TEXT,
  ADD COLUMN "subscriptionCurrentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "subscriptionCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "billingUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "planBaseAmountCents" INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN "includedChildren" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "additionalChildAmountCents" INTEGER NOT NULL DEFAULT 200;

-- User platform flags
ALTER TABLE "User"
  ADD COLUMN "isFamilyOwner" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isSupportAgent" BOOLEAN NOT NULL DEFAULT false;

-- Voice token ownership metadata
ALTER TABLE "VoiceApiToken"
  ADD COLUMN "tokenPreview" TEXT,
  ADD COLUMN "parentId" TEXT;

-- Backfill sensible defaults for existing data
UPDATE "User" AS u
SET "isFamilyOwner" = true
FROM (
  SELECT DISTINCT ON ("familyId") "id", "familyId"
  FROM "User"
  WHERE "role" = 'PARENT'
  ORDER BY "familyId", "createdAt" ASC
) AS owners
WHERE u."id" = owners."id";

UPDATE "VoiceApiToken" AS token
SET "parentId" = token."createdById"
FROM "User" AS u
WHERE token."createdById" = u."id"
  AND u."role" = 'PARENT';

-- New platform tables
CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "assignedToId" TEXT,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
  "category" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportTicketMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isInternal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingEvent" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "Family_stripeCustomerId_key" ON "Family"("stripeCustomerId");
CREATE UNIQUE INDEX "Family_stripeSubscriptionId_key" ON "Family"("stripeSubscriptionId");
CREATE INDEX "Family_subscriptionStatus_idx" ON "Family"("subscriptionStatus");

CREATE INDEX "User_role_isSupportAgent_idx" ON "User"("role", "isSupportAgent");

CREATE INDEX "VoiceApiToken_familyId_parentId_isActive_idx" ON "VoiceApiToken"("familyId", "parentId", "isActive");

CREATE INDEX "SupportTicket_familyId_status_updatedAt_idx" ON "SupportTicket"("familyId", "status", "updatedAt");
CREATE INDEX "SupportTicket_createdById_createdAt_idx" ON "SupportTicket"("createdById", "createdAt");
CREATE INDEX "SupportTicket_assignedToId_status_idx" ON "SupportTicket"("assignedToId", "status");

CREATE INDEX "SupportTicketMessage_ticketId_createdAt_idx" ON "SupportTicketMessage"("ticketId", "createdAt");
CREATE INDEX "SupportTicketMessage_authorId_createdAt_idx" ON "SupportTicketMessage"("authorId", "createdAt");

CREATE UNIQUE INDEX "BillingEvent_stripeEventId_key" ON "BillingEvent"("stripeEventId");
CREATE INDEX "BillingEvent_familyId_createdAt_idx" ON "BillingEvent"("familyId", "createdAt");
CREATE INDEX "BillingEvent_eventType_createdAt_idx" ON "BillingEvent"("eventType", "createdAt");

-- Foreign keys
ALTER TABLE "VoiceApiToken"
  ADD CONSTRAINT "VoiceApiToken_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicketMessage"
  ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportTicketMessage"
  ADD CONSTRAINT "SupportTicketMessage_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingEvent"
  ADD CONSTRAINT "BillingEvent_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

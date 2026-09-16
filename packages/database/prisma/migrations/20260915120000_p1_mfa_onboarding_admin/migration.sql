-- P1: MFA enrolment, onboarding persistence, and admin operational queries.
--
-- Additive only. Every new column is nullable or carries a default so existing
-- rows remain valid and no data rewrite is required. There are no DROP
-- statements and no destructive changes, so this migration is forward-only by
-- construction and safe to apply while the previous application version runs.
--
-- NOT YET APPLIED. Applying a migration to staging or production requires
-- database-owner approval and a verified backup; see
-- docs/database/P0-IDENTITY-PAYMENT-TENANCY-ROLLOUT.md.

-- CreateTable
CREATE TABLE "MfaCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" VARCHAR(32) NOT NULL DEFAULT 'TOTP',
    "secretEncrypted" VARCHAR(512) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" VARCHAR(128) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" VARCHAR(64) NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "severity" VARCHAR(16) NOT NULL DEFAULT 'info',
    "status" VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    "owner" VARCHAR(150),
    "escalationState" VARCHAR(32) NOT NULL DEFAULT 'NONE',
    "lastResponseAt" TIMESTAMP(3),
    "lastResponseBy" VARCHAR(150),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MfaCredential_userId_type_revokedAt_idx" ON "MfaCredential"("userId", "type", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MfaRecoveryCode_codeHash_key" ON "MfaRecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "MfaRecoveryCode_userId_usedAt_idx" ON "MfaRecoveryCode"("userId", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportCase_reference_key" ON "SupportCase"("reference");

-- CreateIndex
CREATE INDEX "SupportCase_tenantId_status_createdAt_idx" ON "SupportCase"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportCase_status_escalationState_idx" ON "SupportCase"("status", "escalationState");

-- AddForeignKey
ALTER TABLE "MfaCredential" ADD CONSTRAINT "MfaCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Wedding onboarding persistence.
-- `version` backs optimistic concurrency for the onboarding wizard, matching
-- the pattern already used by `Invitation.optimisticVersion`.
ALTER TABLE "Wedding"
  ADD COLUMN "partner1Name" VARCHAR(100),
  ADD COLUMN "partner2Name" VARCHAR(100),
  ADD COLUMN "weddingDateUndecided" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "city" VARCHAR(100),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- AlterTable: notification delivery bookkeeping so the admin failed-jobs
-- section reflects real attempts instead of a lossy status string.
ALTER TABLE "Notification"
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: retry bookkeeping for the outbox consumer.
ALTER TABLE "OutboxEvent"
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "OutboxEvent_status_attemptCount_idx" ON "OutboxEvent"("status", "attemptCount");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

-- Additive guest organization. Existing households default to no tags; event
-- access rows are created by the application after this migration.
-- NOT YET APPLIED. Staging/production migration requires database-owner approval
-- and a verified backup.

ALTER TABLE "GuestHousehold" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "GuestEventAccess" (
    "tenantId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "GuestEventAccess_pkey" PRIMARY KEY ("householdId", "eventId")
);

CREATE INDEX "GuestEventAccess_tenantId_eventId_idx"
    ON "GuestEventAccess"("tenantId", "eventId");

ALTER TABLE "GuestEventAccess"
    ADD CONSTRAINT "GuestEventAccess_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "GuestHousehold"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuestEventAccess"
    ADD CONSTRAINT "GuestEventAccess_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "WeddingEvent"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

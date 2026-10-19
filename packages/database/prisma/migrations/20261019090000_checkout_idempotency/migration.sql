-- Additive checkout idempotency. No existing order or payment data changes.
-- NOT YET APPLIED. Staging/production migration requires database-owner approval
-- and a verified backup.

ALTER TABLE "Order" ADD COLUMN "checkoutIdempotencyKey" TEXT;
ALTER TABLE "Payment" ADD COLUMN "redirectUrl" TEXT;

CREATE UNIQUE INDEX "Order_tenantId_checkoutIdempotencyKey_key"
    ON "Order"("tenantId", "checkoutIdempotencyKey");

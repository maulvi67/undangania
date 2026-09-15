# P0 Identity, Payment, and Tenant Boundary Rollout

## Scope

Migration `20260914170000_p0_identity_payment_tenancy` creates the Prisma schema required by the P0 implementation: users and revocable sessions, tenant memberships, tenant-scoped wedding/guest data, orders/payments, entitlement/outbox/audit records, and the supporting indexes/constraints.

The SQL was generated from the reviewed Prisma schema with local placeholder connection values. No database connection, migration application, or production data operation was performed in this workspace.

## Required approvals

Before any staging or production application, obtain explicit approval from:

- Identity/Security for password hashing, session cookies, roles, MFA enforcement, and account recovery.
- Database owner for migration locking, backup, rehearsal, and forward recovery.
- Payment owner/Security for QRIS webhook credentials, callback allowlisting, replay/idempotency, and reconciliation.
- Operations for database monitoring, webhook retry policy, alerting, and secret provisioning.

## Staging application

1. Provision a dedicated PostgreSQL database and a separate `TEST_DATABASE_URL`.
2. Set `DATABASE_URL`, `DIRECT_URL`, and `TEST_DATABASE_URL` from the secret manager; never use production credentials locally.
3. Take a backup/snapshot and verify restore before migration.
4. Run schema validation and client generation:

   ```sh
   npm run db:validate
   npm run db:generate
   ```

5. Apply only through the reviewed migration:

   ```sh
   npm run migrate:deploy -w @wedding/database
   ```

6. Run the live tenant-isolation test:

   ```sh
   npm run test:integration
   ```

7. Verify session creation/revocation, admin MFA denial, QRIS signature rejection, duplicate notification idempotency, out-of-order notification handling, and order ownership with synthetic data.

## Rollout sequence

- Expand: apply the migration and deploy repository/API code while fixture-backed production paths remain fail-closed.
- Verify: run health, auth, tenant, payment webhook, and entitlement reconciliation checks.
- Switch: enable real customer/admin route traffic only after the checks and human approvals pass.
- Contract: remove remaining production-disabled fixture transports only in a separately reviewed change.

## Rollback and forward recovery

This migration is intentionally forward-only. Do not run `prisma migrate reset`, `db push --accept-data-loss`, or ad-hoc destructive SQL.

If application validation fails:

1. Disable the affected route/feature flag and keep the last known-good application running.
2. Preserve the migration and database error correlation ID.
3. Fix the application/repository issue and deploy a forward migration if schema changes are needed.
4. Restore from the verified backup only under database-owner incident approval when data integrity cannot be recovered forward.
5. Reconcile payment notifications and outbox events after recovery before reopening customer access.

No down migration is supplied because dropping session, payment, tenant, audit, or entitlement data would be destructive and is prohibited without a separate approved recovery plan.

## Known limitations

- This repository does not have a local PostgreSQL/Docker service, so live migration and tenant-isolation evidence is pending.
- Checkout creation, invitation editor persistence, onboarding persistence, and admin operational queries still need their own repository/use-case implementations. Their production UI routes fail closed rather than rendering fixtures.
- Email verification, password reset delivery, MFA enrollment/step-up, and QRIS provider HTTP creation require provider-specific implementations and human review.

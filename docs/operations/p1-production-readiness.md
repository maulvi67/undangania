# P1 Production Readiness Handoff

## Scope

This document records the P1 implementation delivered without activating approval-gated P0 providers, production infrastructure, destructive retention, or production database migrations.

## Implemented

- Analytics ingestion and reporting now require an injected distributed rate-limiter port.
- Added a Redis-compatible atomic sliding-window adapter using a provider-neutral `evaluate` port; raw tenant/actor identifiers are hashed before key construction.
- Analytics policies are separate: 60 ingestion requests/minute and 30 report requests/minute per authenticated actor and tenant in the initial staging contract.
- Missing limiter configuration fails closed with `503 PROVIDER_UNAVAILABLE`.
- Exceeded limits return `429 RATE_LIMITED` with a safe message and `Retry-After`.
- Media completion stops at `UPLOADED`.
- Media processing uses `UPLOADED → SCANNING → PROCESSING → READY`.
- The provider-neutral media contract covers signature detection, dimensions, malware verdict, derivatives, rejection codes, retryable provider failures, tenant scope, and idempotent retries. The application now includes a bounded JPEG/PNG/WebP content inspector, and the R2 adapter can read a tenant-scoped prefix with an HTTP range request capped at 64 KiB.
- The background worker dispatches media jobs through application ports and has no direct Prisma dependency. Its envelope validator requires matching tenant and idempotency scopes before dispatch, and `createMediaProcessingPorts` composes the storage-backed inspector without activating scanner or derivative providers.
- Media cleanup exposes a bounded dry-run candidate interface only; it does not delete objects or database rows.
- Added a bounded analytics retention dry-run over `AnalyticsEventAccepted` outbox rows; it does not delete or mutate data.
- Customer editor state no longer treats `UPLOADED` as directly ready.
- Admin `recover_publication` is implemented end-to-end. It reactivates an existing immutable publication snapshot only inside the owning tenant, refuses expired/archived/draft invitations, demotes competing active snapshots, restores the invitation to `PUBLISHED`, emits the existing `InvitationPublished` outbox event, and records the admin audit in the same transaction.
- Admin publication-failure UI now exposes the audited recovery action. Production execution remains gated by the explicit `ADMIN_PRODUCTION_MUTATIONS_APPROVED` flag and MFA step-up.
- `escalate_printing` and `reveal_audit` remain fail-closed. Printing has no escalation state or support-case relation in the current schema; audit reveal is intentionally not exposed because the contract provides masked export only.

## Files and requirement areas

- `packages/analytics/src/rate-limit.ts`: typed distributed limiter contract and policies.
- `packages/analytics/src/redis-rate-limit.ts`: atomic Redis sliding-window adapter boundary and script.
- `packages/analytics/src/retention.ts`: bounded non-destructive retention dry-run contract.
- `apps/backend-api/src/server.ts`: auth-after rate-limit enforcement and HTTP mapping.
- `packages/application/src/media.ts`: async completion contract.
- `packages/application/src/media-processing.ts`: processing use case, bounded content inspector, and validation.
- `packages/storage/src/index.ts`: tenant-scoped ranged object-prefix read for content inspection.
- `packages/application/src/media-cleanup.ts`: non-destructive cleanup dry-run.
- `packages/database/src/repositories/media-asset.ts`: tenant-scoped CAS transitions.
- `services/background-worker/src/index.ts`: provider-neutral media job dispatch, envelope scope validation, and `createMediaProcessingPorts` composition.
- `apps/customer-web/src/lib/editor/media-contract.ts`: client state transition correction.
- `apps/admin-dashboard/src/components/admin/publication-failures.tsx`: audited publication recovery control.
- `apps/admin-dashboard/src/components/admin/admin-mutation-action.tsx`: recovery action contract in the shared privileged-action form.
- `packages/application/src/admin.ts`: recovery mutation port, validation, approval gate, and execution mapping.
- `packages/application/src/admin-mutations.test.ts`: recovery authorization, idempotency, conflict, and production-gate tests.
- `packages/database/src/repositories/admin-operations.ts`: tenant-scoped transactional recovery, outbox, audit, CAS, and structural transaction boundary.
- `packages/database/src/repositories/admin-operations-mutation.test.ts`: repository isolation, lifecycle, CAS, ordering, audit, and outbox tests.
- `docs/domains/analytics.md`, `docs/domains/media-gallery.md`, `docs/api/openapi.yaml`, `docs/api/event-catalog.md`, `docs/operations/runbooks.md`: operational/API/event contracts.

## Architecture impact

No new database table or migration was added. The existing media state enum, immutable publication rows, invitation status, audit, and outbox boundaries are reused. Publication recovery updates the existing rows in one transaction and emits the already documented `InvitationPublished` event. The analytics retention dry-run reads existing outbox rows without deleting them. The rate limiter now has a provider-neutral Redis adapter, but a deployment must still inject an authenticated Redis client; a process-local fallback is not acceptable. Media inspection uses a bounded range read and keeps object bytes outside repository persistence; scanner and derivative providers remain injected ports.

## Security/privacy

- Rate limits are applied only after session authentication and tenant membership authorization.
- Limiter keys are actor+tenant and are not emitted as metric labels or logs.
- Media worker jobs carry explicit tenant and wedding scope; repository reads and writes preserve both scopes.
- Raw media prefixes are used only for inspection and are not persisted or logged.
- Rejection outputs use stable codes rather than file contents or provider diagnostics.
- No production credentials, provider activation, or PII telemetry was added.

## Validation evidence

Targeted validation completed:

- `npm run typecheck -w @wedding/application`
- `npm run typecheck -w @wedding/backend-api`
- `npm run typecheck -w @wedding/background-worker`
- `npm run typecheck -w @wedding/database`
- `npm run typecheck -w @wedding/storage`
- `npm test -w @wedding/analytics`
- `npm test -w @wedding/application -- --run src/media-processing.test.ts src/media.test.ts`
- `npm test -w @wedding/storage`
- `npm test -w @wedding/database -- --run src/repositories/media-asset.test.ts`
- `npm test -w @wedding/background-worker` (5 tests, including malformed payload, envelope scope mismatch, and provider-neutral composition cases)
- `npm run build -w @wedding/analytics`
- `npm run build -w @wedding/database`
- `npm run build -w @wedding/backend-api`
- `npm run typecheck -w @wedding/admin-dashboard`
- `npm test -w @wedding/application -- --run src/admin-mutations.test.ts`
- `npm test -w @wedding/database -- --run src/repositories/admin-operations-mutation.test.ts`
- `npx prettier --check` on all changed application, database, and admin-dashboard files.

The existing full repository validation baseline remains documented in the prior handoff. Full format check still has unrelated pre-existing failures; targeted formatting should be run for the changed files.

## Migration and rollback

- Schema migration: none for this implementation.
- Rollback: disable `ADMIN_PRODUCTION_MUTATIONS_APPROVED` and deploy the previous application code. Recovery only touches existing publication/invitation rows and writes a normal outbox/audit record; no irreversible data is deleted. If a recovery event was already consumed, restore the previous active publication through the normal editor/publication recovery runbook rather than running a destructive rollback.
- Do not run destructive cleanup during rollback.
- Do not enable a scheduler until the shared outbox/lease implementation and approved cleanup policy exist.

## Remaining approvals and risks

- Product/Operations must approve the analytics rate policies before production enforcement.
- Infrastructure must wire the Redis adapter to an approved shared Redis service and provide observability with low-cardinality labels.
- Product/Privacy/Database owners must approve the retention duration and destructive cleanup implementation before any delete operation is added.
- Security/Privacy and Database owners must approve retention and any destructive media cleanup.
- A production worker still needs deployment-specific scanner and derivative-writer adapters plus staging integration evidence. Object-byte inspection is now available through `createMediaContentInspector` backed by `R2StorageAdapter.readPrefix`; `createMediaProcessingPorts` only composes that inspector and intentionally supplies no provider credentials or worker activation.
- Generic durable outbox leasing, claim, retry, and scheduled worker execution remain pending and require additive migration/DB-owner approval.
- Rejection reason persistence remains application-code-safe stable codes; adding a persisted reason column needs an additive migration and database-owner review.
- `escalate_printing` needs a product/domain decision and likely an additive schema relation or escalation model before implementation. It must not overload `PrintingStatus`.
- `reveal_audit` remains intentionally unavailable; use the bounded masked export path.

## Next action

1. Obtain Product/Operations approval for the initial analytics rate policies and retention duration.
2. Wire and test the Redis adapter in approved staging without exposing Redis credentials to application logs.
3. Run media worker integration tests against approved staging adapters.
4. Complete the outbox lease/migration design and request database-owner approval before applying it.
5. In approved staging, inject `createMediaContentInspector(storage)` and verify a valid image reaches inspection while oversized/range-ignored responses fail closed.

# Outbox Lease Design — P1-OUTBOX-LEASE-001

## Status

Design boundary plus a schema-free consumer. The full lease contract below (`lockedBy`, `lockedUntil`, `PROCESSING`/`RETRY`/`DEAD_LETTER`) still requires a Database/Operations-approved migration and is not implemented. What *is* implemented is the `PENDING`/`FAILED`/`PROCESSED` variant described in "Schema-free lease consumer" — see `packages/database/src/repositories/outbox-consumer.ts` and `services/background-worker/src/outbox-runner.ts`. Production activation (multi-worker staging evidence, metrics, kill switch) remains gated.

## Problem

`OutboxEvent` currently stores status, availability, attempt count, last attempt, processed time, and last error. It does not store an owner or lease expiry. A generic worker cannot safely claim a row, crash, and let another worker reclaim it without either duplicate processing or a stuck `PROCESSING` row.

## Proposed expand phase

Additive fields:

```text
lockedBy   TEXT NULL
lockedUntil TIMESTAMP NULL
```

Additive index:

```text
(status, availableAt, lockedUntil)
```

Existing fields remain authoritative during rollout. No destructive down migration is required.

## Claim contract

A worker claim must run in a short transaction:

1. Select rows with `FOR UPDATE SKIP LOCKED` where:
   - `status = PENDING`, or
   - `status = RETRY` and `availableAt <= now`, or
   - `status = PROCESSING` and `lockedUntil <= now`.
2. Order by `availableAt`, then `createdAt`.
3. Set `status = PROCESSING`, `lockedBy = workerInstanceId`, `lockedUntil = now + leaseDuration`, increment `attemptCount`, and set `lastAttemptAt`.
4. Return only the claimed payload and tenant scope.

The worker must verify `lockedBy` and an expected claim token before acknowledging success or scheduling retry. A worker must not process a row after its lease expires unless it successfully renews or reclaims it.

## Completion and retry contract

- Success: set `status = PROCESSED`, `processedAt = now`, clear `lockedBy`, `lockedUntil`, and `lastError`.
- Retryable failure: set `status = RETRY`, set bounded exponential `availableAt`, clear the lease, and store a redacted error code.
- Permanent failure or attempt limit: set `status = DEAD_LETTER`, clear the lease, and emit an operational alert.
- Every consumer remains idempotent using event ID and provider idempotency keys.
- Raw payloads, tokens, payment data, contacts, and tenant/actor identifiers must not be logged.

## Migration and rollout

1. Add nullable lease fields and the covering index.
2. Deploy repository claim/renew/ack code while the existing consumer remains disabled.
3. Run staging claim/reclaim/crash/retry tests with multiple workers.
4. Enable one staging worker, verify no duplicate side effects and no stuck rows.
5. Obtain Database, Operations, Security, and Product approval.
6. Enable production workers progressively with a kill switch.

## Rollback

Disable the new consumer before rollback. Preserve rows and provider event IDs. Do not run a destructive down migration. If a claimed row is left in `PROCESSING`, wait for lease expiry or use the approved administrative reclaim operation; do not manually mark payment or entitlement events as complete.

## Schema-free lease consumer

The payment outbox must be drained before the lease columns exist, without a
migration and without introducing a `PROCESSING` status the admin console does
not understand. `outbox-consumer.ts` therefore claims with a lease expressed in
columns the model already has:

1. `findMany` selects due rows (`status = PENDING`, `availableAt <= now`,
   `attemptCount < maxAttempts`), oldest first, bounded by `batchSize`.
2. For each candidate, `updateMany` wins it only if `attemptCount` is unchanged
   (`WHERE id AND status = PENDING AND attemptCount = <read> AND availableAt <= now`),
   then increments `attemptCount`, sets `lastAttemptAt`, and pushes
   `availableAt = now + leaseMs`.
3. The losing writer of a concurrent claim observes `count = 0` and skips the
   row, so a row is processed by one worker at a time.

Completion mirrors the contract's intent with the existing vocabulary:

- success or nothing-to-do: `status = PROCESSED`, `processedAt = now`,
  `lastError = null`;
- retryable failure: leave `status = PENDING` and let the lease lapse, so the row
  is re-claimed after `availableAt`;
- permanent failure (`PROVIDER_REJECTED`/`PROVIDER_INVALID_RESPONSE` or
  `attemptCount >= maxAttempts`): `status = FAILED` with a bounded `lastError` —
  the dead-letter state the admin console already lists and can retry, which
  resets the row to `PENDING`.

Consumers stay idempotent through the event id: the notification idempotency key
is `payment:PaymentConfirmed:<eventId>`, so a re-claim after a crash collapses
onto the same provider message.

Not covered by this variant, and still required before the full contract ships:
lease renewal, `SKIP LOCKED`-based concurrent claiming at scale, per-status
metrics, and the staging multi-worker evidence below.

## Required evidence

- concurrent claim test with `SKIP LOCKED` (or the CAS claim above);
- worker crash and lease reclaim;
- lease renewal near expiry;
- retry backoff and dead-letter threshold;
- payment, notification, media, analytics, and admin mutation idempotency tests;
- queue depth, age, retry, dead-letter, and provider failure metrics;
- rollback rehearsal and named approvers.

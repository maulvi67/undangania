# P0 Production Readiness Gate

## Purpose

This gate tracks the production blockers for identity/session, payment, notifications, custom domains, and infrastructure. It is a release-control document, not an activation instruction. Production providers, migrations, DNS, secrets, and privileged mutation flags remain disabled until the required owners approve the evidence below.

## Current status

| Capability | Code foundation | Production activation | Required decision |
| --- | --- | --- | --- |
| Identity and sessions | Database-backed password authentication, revocable sessions, tenant membership lookup, email verification and password-reset use cases | **Blocked** | Identity/Security approval and staging evidence |
| QRIS payment | Midtrans adapter, signature verification, amount/currency/order checks, atomic notification processing, idempotent entitlement/outbox path | **Blocked** | Payment/Security approval, provider sandbox evidence, reconciliation approval |
| Transactional notifications | Console transport for local/CI and fail-closed HTTP relay transport | **Blocked** | Notification/Security/Operations approval and delivery evidence |
| Custom domains | Domain policy/documentation exists; no production DNS/certificate provider activation | **Blocked** | Domain/Infrastructure/Security design and approval |
| Production infrastructure | Environment, rollback, monitoring, and migration runbooks exist; provider-specific IaC is intentionally not enabled | **Blocked** | DevOps/Security/Database approval |

## Non-negotiable safety rules

- Never use browser redirects or query parameters as payment truth.
- Never enable a production payment provider without verified server-to-server notification handling and reconciliation.
- Never enable production email or WhatsApp sending without provider, consent, suppression, retry, and monitoring evidence.
- Never apply a production migration without a verified backup, restore rehearsal, lock/timeout plan, and database-owner approval.
- Never activate custom DNS or certificates before ownership verification and takeover prevention are reviewed.
- Never set `ADMIN_PRODUCTION_MUTATIONS_APPROVED=true` or `ADMIN_PAYMENT_PRODUCTION_APPROVED=true` before the corresponding owner signs off.
- Never print secrets, raw payment payloads, tokens, recipient contacts, or guest PII in logs or test evidence.

## Approval matrix

Each approval must identify the environment, commit/release identifier, scope, approver, decision, timestamp, and expiry/review date. A verbal approval is not sufficient for the release record.

| Gate | Required approver(s) | Evidence required | Status |
| --- | --- | --- | --- |
| Identity/session | Identity owner, Security | Staging auth journey, session revocation, cookie review, anti-enumeration, recovery-token replay/expiry tests, abuse/rate-limit decision | `PENDING` |
| Database migration | Database owner, Operations | Backup and restore result, migration rehearsal, lock/timeout result, tenant-isolation integration test, forward-recovery plan | `PENDING` |
| Payment provider | Payment owner, Security | Sandbox charge, invalid signature, replay, duplicate, out-of-order, amount/currency mismatch, provider outage, reconciliation evidence | `PENDING` |
| Entitlement correctness | Payment owner, Database owner | Exactly-once entitlement test, outbox delivery/retry evidence, mismatch alert verification | `PENDING` |
| Notifications | Notification owner, Security, Operations | Relay delivery, retry/suppression, idempotency, callback verification, PII telemetry review, cost limit and kill switch | `PENDING` |
| Custom domain | Domain owner, Infrastructure, Security | DNS ownership challenge, takeover prevention, certificate issuance/renewal, disable and rollback rehearsal | `PENDING` |
| Infrastructure | DevOps, Security, Operations | Secret-manager configuration, TLS/HSTS/WAF, rate limits, backup, alerting, smoke checks, rollback rehearsal | `PENDING` |
| Release | Product owner, QA, human release approver | All required gates approved, critical E2E/a11y/performance evidence, customer communication and support runbook | `PENDING` |

## Verified repository evidence

The following evidence is available from the current codebase and must be rerun on the release candidate:

- `packages/payments`: Midtrans QRIS charge contract, allowlisted provider URLs, signature verification, status mapping, and fail-closed refund behavior.
- `packages/payments/src/process-qris-notification.ts`: tenant-scoped payment/order checks, duplicate and out-of-order handling, atomic entitlement and outbox calls, and audit calls through injected transaction repositories.
- `apps/backend-api/src/server.ts`: strict webhook body limits, untouched raw-body verification boundary, correlation IDs, and safe error mapping.
- `apps/customer-web/src/lib/auth/server.ts`: hashed-token session lookup, active-user/membership checks, revocation path, and secure production cookie attributes.
- `apps/customer-web/src/lib/auth/container.ts`: real token/account repositories and fail-closed notification provider binding.
- `packages/notifications`: redacted logging, idempotency-key forwarding, timeout handling, strict relay response parsing, and fail-closed provider construction.
- `apps/admin-dashboard/src/app/api/admin/mutations/route.ts`: server-side MFA requirement, schema validation, idempotency input, and separate production mutation/payment approval flags.
- `docs/database/P0-IDENTITY-PAYMENT-TENANCY-ROLLOUT.md`: staging migration, rollout, forward-recovery, and required owner approvals.

These are code-level checks only. They do not prove provider credentials, DNS, deployment, backup, monitoring, or operational readiness.

## Staging execution order

1. Create isolated staging database, object storage, queue, domains, and provider sandbox accounts.
2. Load secrets from the secret manager. Do not copy production secrets into local or test environments.
3. Validate the schema and generate the client:

   ```sh
   npm run db:validate
   npm run db:generate
   ```

4. Take a staging backup and complete a restore rehearsal.
5. Apply the reviewed migration through the deployment pipeline only:

   ```sh
   npm run migrate:deploy -w @wedding/database
   ```

6. Run unit, integration, typecheck, build, and repository validation.
7. Run synthetic auth, payment sandbox, notification relay, admin MFA, tenant-isolation, and failure-recovery journeys.
8. Capture correlation IDs, status transitions, audit/outbox records, screenshots where applicable, and provider dashboard evidence without recording secrets or PII.
9. Obtain all approvals in the matrix.
10. Deploy with all production approval flags disabled, run smoke checks, then enable only the separately approved capability flag using a progressive rollout.

## Rollback and forward recovery

- Prefer disabling the capability flag or rolling back the application to the last known-good release.
- Do not run a destructive down migration.
- Preserve migration errors, provider event IDs, outbox IDs, and correlation IDs.
- If a payment notification was accepted by the provider but not by the application, reconcile from the provider using the approved reconciliation procedure before reopening the route.
- If notification delivery is uncertain, keep the request retryable and use the same idempotency key; do not send an unbounded duplicate.
- If auth/session behavior is faulty, disable affected entry routes and preserve existing session revocation controls while investigating.
- Restore a database backup only with database-owner incident approval when forward recovery cannot preserve integrity.

## Known blockers

- No production provider credentials or deployment changes are present in this repository.
- Live PostgreSQL migration and restore evidence is environment-dependent and cannot be proven locally without an approved staging environment.
- Email verification/password-reset delivery requires a configured relay and operational delivery evidence.
- Payment refund remains intentionally disabled pending separate payment-owner approval.
- Custom DNS/certificate provisioning is not implemented or activated.
- Production admin mutation flags must remain false until operations and security approval.

## Handoff requirement

Before release, attach this document or a release-specific copy with:

- release commit/tag and environment;
- changed files and requirement/task IDs;
- schema/API changes and migration/rollback result;
- security/privacy and tenant-isolation review;
- test commands and results;
- provider, backup, monitoring, and smoke-test evidence;
- named approvers and decisions;
- known risks and the next action.

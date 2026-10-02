# Environments

Local, test, preview, staging, and production are isolated. No production data in non-production. Provider sandbox keys are separate. Feature flags default safe. Production access is time-bound and audited.

## Transactional email

Production authentication email requires `EMAIL_PROVIDER=relay`, `NOTIFICATION_RELAY_URL`, `NOTIFICATION_RELAY_API_KEY`, and `APP_URL` set to the public application origin. The relay must provide the approved templates `auth.email-verification`, `auth.password-reset`, and `auth.password-changed`. Console delivery is for local development only; an unset or `console` provider fails closed in production. Keep relay credentials server-only and use synthetic recipients in non-production unless a sandbox has been approved.

## Private media storage

Customer media uses a private Cloudflare R2 bucket through the S3-compatible API. Configure these variables independently per environment:

```text
STORAGE_ENDPOINT=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
```

The application fails closed when any value is absent or invalid. Access and secret keys are server-only; they must never be exposed through a client bundle, signed upload response, publication snapshot, or telemetry.

Configure R2 CORS for the exact customer-web origins that may upload. Allow browser `PUT` with `Content-Type` and `Content-Length`; do not make the bucket public. Signed upload URLs are short-lived, and public invitation read URLs are generated at render time with a shorter lifetime.

No production credentials or provider deployment changes belong in this repository. The `MediaAsset` schema already exists, so enabling the adapter requires no migration. The approved worker deployment may back `createMediaContentInspector` with the storage adapter's tenant-scoped `readPrefix` operation; it must keep the 64 KiB cap and require `206 Partial Content`. Malware scanning and derivative writing remain separate provider approvals.

## Analytics telemetry

Configure `ANALYTICS_HASH_SECRET` independently per environment as a server-only secret of at least 32 characters. The backend fails closed with `503 PROVIDER_UNAVAILABLE` when it is absent or too short; never expose it to a client bundle or write it to logs. The backend also requires an injected distributed/atomic analytics rate limiter shared across replicas: the initial staging policy is 60 ingestion requests/minute and 30 report requests/minute per authenticated actor+tenant. The repository includes a Redis-compatible atomic sliding-window adapter, but the deployment must inject an authenticated Redis client and must not substitute a process-local limiter in production. Define and approve retention/cleanup for `AnalyticsEventAccepted` rows in the existing outbox before enabling high-volume ingestion.

## Admin privileged mutations

The admin mutation route fails closed unless an authenticated admin has MFA and submits a valid step-up code. Production state changes are additionally gated by server-only flags:

```text
ADMIN_PRODUCTION_MUTATIONS_APPROVED=false
ADMIN_PAYMENT_PRODUCTION_APPROVED=false
```

Keep both unset or `false` until the operations/security owner approves activation. The first flag controls retry, template moderation, support escalation, and masked audit export; the second separately gates provider reconciliation. Neither flag makes a browser redirect authoritative for payment state: verified provider callbacks remain the only payment truth.

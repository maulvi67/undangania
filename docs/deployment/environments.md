# Environments

Local, test, preview, staging, and production are isolated. No production data in non-production. Provider sandbox keys are separate. Feature flags default safe. Production access is time-bound and audited.

## Transactional email

Production authentication and payment email requires `EMAIL_PROVIDER=relay`, `NOTIFICATION_RELAY_URL`, `NOTIFICATION_RELAY_API_KEY`, and `APP_URL` set to the public application origin. The relay must provide the approved templates `auth.email-verification`, `auth.password-reset`, `auth.password-changed`, and `payment.payment-confirmed`. Console delivery is for local development only; an unset or `console` provider fails closed in production. Keep relay credentials server-only and use synthetic recipients in non-production unless a sandbox has been approved.

The relay service (`services/notification-relay`) reads its own SMTP configuration and must run where the calling services can reach it over HTTPS or the private network:

```text
NOTIFICATION_RELAY_API_KEY=   # >= 32 characters, same value the callers use
EMAIL_FROM=                   # e.g. Undangania <no-reply@example.com>
SMTP_URL=                     # full SMTP URL, or use the split values below
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
```

`SMTP_USER` and `SMTP_PASS` must be set together. The relay sends `EMAIL` only; `WHATSAPP` returns `422 UNSUPPORTED_CHANNEL` until a WhatsApp provider is approved. It never logs recipient addresses or template variables, because auth templates carry single-use links.

## Private media storage

Customer media uses a private Cloudflare R2 bucket through the S3-compatible API. Configure these variables independently per environment:

```text
STORAGE_ENDPOINT=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
```

The application fails closed when any value is absent or invalid. Access and secret keys are server-only; they must never be exposed through a client bundle, signed upload response, publication snapshot, or telemetry.

The background worker also reads the media provider selection:

```text
MEDIA_MALWARE_SCANNER=passthrough
MEDIA_DERIVATIVE_WRITER=none
```

Those are stand-ins: `passthrough` supplies no antivirus verdict and `none` generates no resized variants. Production refuses both unless `MEDIA_ALLOW_UNSCANNED_UPLOADS=true` and `MEDIA_ALLOW_MISSING_DERIVATIVES=true` are set deliberately, because advancing an upload to `READY` without a scanner is indistinguishable from a clean verdict. Keep the overrides unset in production until a real scanner and derivative writer are approved; a deployment that cannot process media should fail its worker instead of serving unchecked uploads.

Configure R2 CORS for the exact customer-web origins that may upload. Allow browser `PUT` with `Content-Type` and `Content-Length`; do not make the bucket public. Signed upload URLs are short-lived, and public invitation read URLs are generated at render time with a shorter lifetime.

No production credentials or provider deployment changes belong in this repository. The `MediaAsset` schema already exists, so enabling the adapter requires no migration. The approved worker deployment may back `createMediaContentInspector` with the storage adapter's tenant-scoped `readPrefix` operation; it must keep the 64 KiB cap and require `206 Partial Content`. Malware scanning and derivative writing remain separate provider approvals; the worker image (`docker/background-worker.Dockerfile`) runs the pipeline and fails closed when those providers are missing.

## Cache and distributed rate limiting

Upstash Redis backs ephemeral coordination only: public-read caching and the distributed analytics rate limiter. It is never business storage and carries no unique data. Configure it per environment:

```text
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

`@wedding/cache` provides the concrete adapter for both jobs over the Upstash REST protocol. `createCachePortFromEnv` returns `null` when the credentials are absent or invalid, and `readThrough` then reads straight from PostgreSQL, so an unconfigured or unreachable cache degrades to the database instead of failing a public invitation page. The same adapter's `evaluate` method implements the `AnalyticsRedisEvalClient` shape, so it can be passed directly to `RedisAnalyticsRateLimiter` without a second Redis client.

Suggested cache keys, keyed off the publication slug (never a tenant secret): `wedding:{slug}`, `template:{id}`, `ratelimit:{scope}:{identifier}`, `idempotency:{provider}:{id}`. Cache entries are invalidated on publish/mutation, not on a timer alone. `REDIS_URL` is not used: the Upstash REST client is the single Redis transport.

## Analytics telemetry

Configure `ANALYTICS_HASH_SECRET` independently per environment as a server-only secret of at least 32 characters. The backend fails closed with `503 PROVIDER_UNAVAILABLE` when it is absent or too short; never expose it to a client bundle or write it to logs. The backend also requires an injected distributed/atomic analytics rate limiter shared across replicas: the initial staging policy is 60 ingestion requests/minute and 30 report requests/minute per authenticated actor+tenant. The repository includes a Redis-compatible atomic sliding-window adapter, but the deployment must inject an authenticated Redis client and must not substitute a process-local limiter in production. Define and approve retention/cleanup for `AnalyticsEventAccepted` rows in the existing outbox before enabling high-volume ingestion.

## Admin privileged mutations

The admin mutation route fails closed unless an authenticated admin has MFA and submits a valid step-up code. Production state changes are additionally gated by server-only flags:

```text
ADMIN_PRODUCTION_MUTATIONS_APPROVED=false
ADMIN_PAYMENT_PRODUCTION_APPROVED=false
```

Keep both unset or `false` until the operations/security owner approves activation. The first flag controls retry, template moderation, support escalation, and masked audit export; the second separately gates provider reconciliation. Neither flag makes a browser redirect authoritative for payment state: verified provider callbacks remain the only payment truth.

## Database (Neon)

Neon Postgres is the relational source of truth. Prisma reads two connections from
the environment, so runtime traffic is pooled while migrations run direct:

```text
DATABASE_URL=   # pooled runtime connection
DIRECT_URL=     # direct/unpooled connection, migrations only
```

`packages/database/prisma/schema.prisma` declares `url = env("DATABASE_URL")` and
`directUrl = env("DIRECT_URL")`. The client is a process-wide singleton
(`packages/database/src/client.ts`), so it is never constructed per request and a
development reload cannot leak connections.

Production migrations are a deliberate, separate step against `DIRECT_URL`:

```text
npm run db:migrate:deploy
```

Never run `prisma migrate dev` or `prisma db push` against production, and never
auto-migrate from an application boot. Rollback guidance lives in
`docs/deployment/rollback.md`.

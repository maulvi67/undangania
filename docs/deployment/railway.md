# Railway (Singapore)

Railway runs five services from this repository: the public application, the
admin dashboard, the backend API that receives payment webhooks, the background
worker, and the notification relay. It owns the dynamic request path; static
media is served from Cloudflare R2, never from these services.

## Service topology

Every service builds from the repository root, because npm workspaces resolve
every package from the single root lockfile. Each service points Railway
config-as-code at its own file; the path is set per service in
**Settings > Config-as-code**, so a single `railway.json` cannot describe the
whole project.

| Service | Dockerfile | Config file | Port | Health path |
| --- | --- | --- | --- | --- |
| customer-web | `Dockerfile` | `railway.json` | 3000 | `/api/health` |
| admin-dashboard | `docker/admin-dashboard.Dockerfile` | `railway.admin.json` | 3001 | `/api/health` |
| backend-api | `docker/backend-api.Dockerfile` | `railway.backend.json` | 4000 | `/health` |
| background-worker | `docker/background-worker.Dockerfile` | `railway.worker.json` | none | process exits |
| notification-relay | `docker/notification-relay.Dockerfile` | `railway.relay.json` | 4100 | `/health` |

The worker has no HTTP listener: its liveness signal is the process staying
alive, so its config omits `healthcheckPath` and restarts `ON_FAILURE`.

All configs set `build.builder: DOCKERFILE` and the repository-root build
context. `deploy.restartPolicyType: ON_FAILURE` keeps a crashed service from
looping forever on a configuration error.

Alternatively, deploy from GitHub with the Dockerfile builder and let Railway
read the config file; do not invent build commands that duplicate the repository
scripts.

## First-time setup

`scripts/setup-cloudflare-r2-railway.sh` walks the whole production wiring in 14
gated stages: the private R2 bucket, its S3 token and CORS policy, Neon,
Upstash, the Railway service variables, the public domain, Cloudflare DNS,
migrations, and the deploy. Run it from the repository root:

```text
bash scripts/setup-cloudflare-r2-railway.sh
```

It records what it captures in a gitignored `.env` so it can resume, and pushes
the same values to the linked Railway service. It provisions nothing itself.

After the first deploy, create the remaining four services in the same project
and region, set each one's config-as-code path from the table above, then add the
variables from the scoping section. The relay must be deployed before
`EMAIL_PROVIDER=relay` is enabled on the callers, or verification email fails
closed with `PROVIDER_UNAVAILABLE`.

## Build and start

```text
customer-web:   build: docker build -f Dockerfile .
                start: node apps/customer-web/server.js
admin:          build: docker build -f docker/admin-dashboard.Dockerfile .
                start: node apps/admin-dashboard/server.js
backend-api:    build: docker build -f docker/backend-api.Dockerfile .
                start: ./node_modules/.bin/tsx apps/backend-api/src/server.ts
worker:         build: docker build -f docker/background-worker.Dockerfile .
                start: ./node_modules/.bin/tsx services/background-worker/src/worker.ts
relay:          build: docker build -f docker/notification-relay.Dockerfile .
                start: ./node_modules/.bin/tsx services/notification-relay/src/server.ts
```

`apps/customer-web/next.config.ts` and `apps/admin-dashboard/next.config.ts` set
`output: "standalone"`, so those runtime stages ship only the traced server
bundle. The standalone output mirrors the workspace, which is why the entrypoints
are `apps/*/server.js`. The API, worker, and relay run TypeScript through `tsx`
because workspace packages publish raw `.ts` from their package exports.

## Region

Deploy every service in the Railway **Singapore** region so the application runs
close to the Neon Postgres region and the primary audience.

## Environment variables

Production values live in Railway service variables, never in the repository.
Railway scopes variables per service, so give each service only what it uses.

Shared by customer-web, admin-dashboard, backend-api, and background-worker:

```text
DATABASE_URL=            # Neon pooled connection (runtime)
DIRECT_URL=              # Neon direct connection (migrations only)
APP_URL=                 # public application origin, e.g. https://example.com
```

customer-web and admin-dashboard additionally:

```text
AUTH_SECRET=
NEXT_PUBLIC_SITE_URL=    # same origin; inlined at build time
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
STORAGE_ENDPOINT=        # Cloudflare R2 S3 endpoint
STORAGE_BUCKET=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
EMAIL_PROVIDER=relay
NOTIFICATION_RELAY_URL=  # internal or public relay origin
NOTIFICATION_RELAY_API_KEY=
PAYMENT_PROVIDER=midtrans
MIDTRANS_SERVER_KEY=
MIDTRANS_IS_PRODUCTION=false
ANALYTICS_HASH_SECRET=
```

backend-api additionally:

```text
AUTH_SECRET=
MIDTRANS_SERVER_KEY=
MIDTRANS_IS_PRODUCTION=false
ANALYTICS_HASH_SECRET=
```

background-worker:

```text
EMAIL_PROVIDER=relay
NOTIFICATION_RELAY_URL=
NOTIFICATION_RELAY_API_KEY=
STORAGE_ENDPOINT=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
MEDIA_MALWARE_SCANNER=passthrough
MEDIA_DERIVATIVE_WRITER=none
MEDIA_ALLOW_UNSCANNED_UPLOADS=false
MEDIA_ALLOW_MISSING_DERIVATIVES=false
```

notification-relay:

```text
NOTIFICATION_RELAY_API_KEY=   # >= 32 characters, same value the callers use
EMAIL_FROM=                   # e.g. Undangania <no-reply@example.com>
SMTP_URL=                     # or SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_SECURE
```

No server secret may be exposed through `NEXT_PUBLIC_*`. In particular the Upstash
token, R2 keys, database URLs, payment keys, SMTP credentials, and the relay API
key are server-only.

`NEXT_PUBLIC_SITE_URL` is inlined by `next build`, so the Dockerfile declares it
as an `ARG` and sets it before the build; Railway injects service variables into
the build only when they are declared that way. Change it with a rebuild, not a
restart. `APP_URL` is the runtime equivalent used for verification links and
payment callbacks, so keep both on the same origin.

The media overrides are a deliberate production decision, not a default. Leave
them false until a real scanner and derivative writer are approved, because the
stand-ins mark uploads `READY` without an antivirus verdict or resized variants.

## Health endpoints

- `GET /api/health` (customer-web, admin-dashboard) returns
  `{ "status": "ok" }` from the running process.
- `GET /health` (backend-api, notification-relay) does the same.

Each is a liveness probe that touches no downstream dependency, so a database or
Redis outage does not restart a healthy container. The worker has no health
endpoint.

## Database migrations

Migrations are deliberate, never automatic on boot. Run them as a separate step
against `DIRECT_URL` before deploying code that depends on the new schema:

```text
npm run db:migrate:deploy
```

That alias runs `prisma migrate deploy` through `@wedding/database`. It applies
committed migrations and never generates or resets. `docker/database-migrate.Dockerfile`
packages the same command for a one-off Railway job. Rollback guidance lives in
`docs/deployment/rollback.md`.

## Cache

`@wedding/cache` reads `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
When they are absent the public invitation read falls straight through to Postgres,
so a missing or unreachable Redis never takes a public page down. See
`docs/deployment/environments.md`.

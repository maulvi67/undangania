# Railway (Singapore)

Railway runs the Next.js application, its API routes, authentication, business
logic, Prisma access, and payment webhooks. It owns the dynamic request path;
static media is served from Cloudflare R2, never from this service.

## Service topology

The application image is built from the repository root `Dockerfile`. The build
context must be the repository root: npm workspaces resolve every package from the
single root lockfile, so the whole workspace has to be present when `npm ci` runs.

`railway.json` pins the image and the deploy behaviour:

- `build.builder: DOCKERFILE`, `build.dockerfilePath: Dockerfile`
- `deploy.healthcheckPath: /api/health` — the liveness probe that touches no
  downstream dependency, so a database or Redis outage does not restart a
  healthy container
- `deploy.restartPolicyType: ON_FAILURE`

Alternatively, deploy from GitHub with the Dockerfile builder and let Railway read
`railway.json`; do not invent build commands that duplicate the repository scripts.

## Build and start

```text
build: docker build -f Dockerfile .
start: node apps/customer-web/server.js
```

`apps/customer-web/next.config.ts` sets `output: "standalone"`, so the runtime
stage ships only the traced server bundle. The standalone output mirrors the
workspace, which is why the entrypoint is `apps/customer-web/server.js`.

## Region

Deploy in the Railway **Singapore** region so the application runs close to the
Neon Postgres region and the primary audience.

## Environment variables

Production values live in Railway service variables, never in the repository.
Required server-only values:

```text
DATABASE_URL=            # Neon pooled connection (runtime)
DIRECT_URL=              # Neon direct connection (migrations)
AUTH_SECRET=
APP_URL=                 # public application origin, e.g. https://example.com
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
STORAGE_ENDPOINT=        # Cloudflare R2 S3 endpoint
STORAGE_BUCKET=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
EMAIL_PROVIDER=relay
NOTIFICATION_RELAY_URL=
NOTIFICATION_RELAY_API_KEY=
PAYMENT_PROVIDER=
MIDTRANS_SERVER_KEY=
MIDTRANS_IS_PRODUCTION=false
ANALYTICS_HASH_SECRET=
```

No server secret may be exposed through `NEXT_PUBLIC_*`. In particular the Upstash
token, R2 keys, database URLs, and payment keys are server-only.

## Health endpoint

`GET /api/health` returns `{ "status": "ok" }` from the running process. It is the
Railway healthcheck and the deploy smoke test; keep it dependency-free.

## Database migrations

Migrations are deliberate, never automatic on boot. Run them as a separate step
against `DIRECT_URL`:

```text
npm run db:migrate:deploy
```

That alias runs `prisma migrate deploy` through `@wedding/database`. It applies
committed migrations and never generates or resets. Rollback guidance lives in
`docs/deployment/rollback.md`.

## Cache

`@wedding/cache` reads `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
When they are absent the public invitation read falls straight through to Postgres,
so a missing or unreachable Redis never takes a public page down. See
`docs/deployment/environments.md`.

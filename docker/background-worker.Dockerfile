# syntax=docker/dockerfile:1

# Background worker production image.
#
# Runs the long-lived outbox and media loops from TypeScript sources through
# `tsx`. It has no HTTP listener, so this image has no HEALTHCHECK; Railway
# restarts it when the process exits.

FROM node:24-slim AS base
WORKDIR /app
# Prisma's query engine needs the system OpenSSL that Debian slim omits.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY . .
# The schema lives in packages/database/prisma, so `@prisma/client`'s own
# postinstall leaves its uninitialized stub behind. The worker queries through
# the generated client, so generate it and fail here if the stub survived
# instead of at the first outbox poll in production.
RUN npm ci \
  && npm run db:generate \
  && if [ ! -f node_modules/.prisma/client/index.d.ts ] \
       || grep -q "export declare const PrismaClient: any" node_modules/.prisma/client/index.d.ts; then \
       echo "ERROR: @prisma/client is missing or ungenerated at node_modules/.prisma/client" >&2; \
       exit 1; \
     fi

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=deps --chown=node:node /app/tsconfig.base.json ./
COPY --from=deps --chown=node:node /app/packages ./packages
COPY --from=deps --chown=node:node /app/services/background-worker ./services/background-worker
USER node
CMD ["./node_modules/.bin/tsx", "services/background-worker/src/worker.ts"]

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
RUN npm ci && npm run db:generate

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=deps --chown=node:node /app/tsconfig.base.json ./
COPY --from=deps --chown=node:node /app/packages ./packages
COPY --from=deps --chown=node:node /app/services/background-worker ./services/background-worker
USER node
CMD ["./node_modules/.bin/tsx", "services/background-worker/src/worker.ts"]

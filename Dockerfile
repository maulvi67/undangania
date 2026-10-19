# syntax=docker/dockerfile:1.7

# Container image for the Next.js application on Railway.
#
# `apps/customer-web/next.config.ts` sets `output: "standalone"`, so the runtime
# stage ships only the traced server bundle instead of the full workspace.
#
# The build context must be the repository root: npm workspaces resolve every
# workspace package from the single root lockfile, so the whole workspace has to
# be present when `npm ci` runs.

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
RUN npm ci

FROM deps AS builder
# Railway injects service variables at build time only when the Dockerfile
# declares them as ARG. `NEXT_PUBLIC_*` is inlined into the bundle during
# `next build`, so the public origin must be present here, not just at runtime.
# The default keeps an unconfigured local build on the same localhost fallback
# the app already uses.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
# Builds the app and every workspace package it depends on, in dependency order.
RUN npx --no-install turbo run build --filter=@wedding/customer-web

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
# The standalone output mirrors the workspace, so the server entry is nested
# under `apps/customer-web/`.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/customer-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/customer-web/.next/static ./apps/customer-web/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/customer-web/server.js"]

# syntax=docker/dockerfile:1

# Customer web (Next.js) production image.
#
# The builder emits Next's traced standalone bundle, so the runtime stage needs
# neither the monorepo sources nor the install stage's `node_modules`: workspace
# packages are compiled into the bundle.
#
# NEXT_PUBLIC_* values are inlined by Next at build time. Changing the public
# origin therefore requires rebuilding this image, not only changing env vars.

FROM node:24-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma's query engine needs the system OpenSSL that Debian slim omits.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY . .
# The schema lives in packages/database/prisma, so @prisma/client's postinstall
# cannot find it and falls back to an empty stub. Generate the real client here:
# `next build` typechecks the workspace packages against it.
RUN npm ci && npm run db:generate

FROM base AS builder
COPY --from=deps /app ./
# Next only fills in a default NODE_ENV; an explicit "development" here would
# build a development-mode bundle. The standalone server then forces production
# at runtime, so the two must match.
ENV NODE_ENV=production
# Default matches the application's own local fallback; staging and production
# must pass the real public origin.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build -w @wedding/customer-web

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/apps/customer-web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/customer-web/.next/static ./apps/customer-web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/customer-web/server.js"]

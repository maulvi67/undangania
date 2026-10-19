# syntax=docker/dockerfile:1

# Admin dashboard (Next.js) production image.
#
# Same shape as the customer web image: the runtime stage runs only Next's
# traced standalone bundle, which already contains the compiled workspace
# packages.

FROM node:24-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma's query engine needs the system OpenSSL that Debian slim omits.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY . .
RUN npm ci

FROM base AS builder
COPY --from=deps /app ./
ENV NODE_ENV=development
RUN npm run build -w @wedding/admin-dashboard

FROM base AS runner
ENV NODE_ENV=development
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/apps/admin-dashboard/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/admin-dashboard/.next/static ./apps/admin-dashboard/.next/static
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/admin-dashboard/server.js"]

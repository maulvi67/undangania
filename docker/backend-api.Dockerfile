# syntax=docker/dockerfile:1

# Backend API production image.
#
# The service runs from TypeScript sources through `tsx`, because every
# workspace package publishes raw `.ts` from its package.json exports and there
# is no compiled JavaScript artifact to ship. Type checking stays in CI; this
# image only needs a working runtime.

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
ENV PORT=4000
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=deps --chown=node:node /app/tsconfig.base.json ./
COPY --from=deps --chown=node:node /app/packages ./packages
COPY --from=deps --chown=node:node /app/apps/backend-api ./apps/backend-api
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["./node_modules/.bin/tsx", "apps/backend-api/src/server.ts"]

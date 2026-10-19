# syntax=docker/dockerfile:1

# Notification relay production image.
#
# Holds the transactional email bodies and speaks SMTP. The application services
# reach it over `NOTIFICATION_RELAY_URL` with a bearer key, so this is the only
# image that needs mail credentials.

FROM node:24-slim AS base
WORKDIR /app

FROM base AS deps
COPY . .
RUN npm ci

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4100
ENV HOSTNAME=0.0.0.0
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=deps --chown=node:node /app/tsconfig.base.json ./
COPY --from=deps --chown=node:node /app/packages ./packages
COPY --from=deps --chown=node:node /app/services/notification-relay ./services/notification-relay
USER node
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4100)+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["./node_modules/.bin/tsx", "services/notification-relay/src/server.ts"]

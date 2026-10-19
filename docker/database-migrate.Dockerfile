# syntax=docker/dockerfile:1

# One-shot migration image.
#
# Applies committed Prisma migrations with `prisma migrate deploy`. It keeps
# devDependencies on purpose: the Prisma CLI is one. The application runtime
# images do not use this stage.

FROM node:24-slim AS base
WORKDIR /app
# Prisma's migration engine needs the system OpenSSL that Debian slim omits.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS migrate
COPY . .
RUN npm ci
ENV NODE_ENV=development
USER node
CMD ["npm", "run", "migrate:deploy", "-w", "@wedding/database"]

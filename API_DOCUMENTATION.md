# API Documentation

REST and webhook contracts live in `docs/api/openapi.yaml`. Internal events use schemas in `packages/contracts`. Every endpoint defines authentication, tenant authorization, input/output schema, idempotency, rate limit, audit, errors, and cache behavior.

Public endpoints are limited to invitation read, RSVP, guestbook, signed media view, payment callback, and domain verification callbacks. Payment and vendor callbacks are verified server-to-server.

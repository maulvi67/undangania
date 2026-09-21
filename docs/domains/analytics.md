# Domain: Analytics

## Purpose

Provide bounded product and operational measurement without turning telemetry into a second user-data store.

## P1 scope

The P1 implementation provides validated ingestion, deterministic idempotency, tenant-scoped aggregate reporting, and a privacy-safe persistence adapter. It does not add dashboard UI or a new analytics table; existing dashboard hooks do not currently expose an analytics surface.

## Event taxonomy

Every request must contain `schemaVersion: 1`, `consent: true`, and an `idempotencyKey` matching `[A-Za-z0-9._~-]{16,128}`. Event objects and property objects are strict: unknown fields are rejected.

| Event | Allowlisted properties |
| --- | --- |
| `invitation_viewed` | `source`: `direct`, `shared`, `search`, or `unknown`; `device`: `mobile`, `tablet`, `desktop`, or `unknown` |
| `invitation_published` | `status: PUBLISHED` |
| `rsvp_submitted` | `response`: `ATTENDING`, `DECLINED`, or `TENTATIVE` |
| `guestbook_submitted` | `moderationStatus: PENDING` |
| `checkout_started` | `currency: IDR` |
| `checkout_completed` | `currency: IDR` |

Only event-specific scalar properties are accepted. Free-form content, contacts, URLs, tokens, account numbers, raw identifiers, request metadata, and other prohibited PII-shaped property names are rejected before persistence.

## Actors and tenant scope

- `POST /v1/analytics/events?tenantId={tenantId}` and `GET /v1/analytics/report?tenantId={tenantId}&from={from}&to={to}` require the authenticated `ws_session` cookie.
- The requested tenant must have an active membership for the authenticated user. `OWNER`, `EDITOR`, and `VIEWER` are allowed.
- The request body cannot provide the tenant, actor, or either hash. The server derives tenant and actor identity from the session and membership.
- The existing `OutboxEvent.tenantId` column remains the relational scope used for authorization and tenant filtering. It is not copied into the analytics payload. The payload stores an HMAC-SHA-256 tenant hash and, when an authenticated actor exists, an HMAC actor hash.

## Idempotency and lifecycle

The analytics event ID is deterministic for `(tenantId, idempotencyKey)` and is stored as a UUID-shaped identifier. The deterministic ID does not depend on the hash secret, so secret rotation does not convert a retry into a second event.

- A new event returns `202` with `status: accepted`.
- A retry with the same key and equivalent event content returns `200` with `status: replayed`.
- Reusing a key with different event content returns `409 IDEMPOTENCY_CONFLICT`.
- Concurrent inserts are resolved by the existing unique OutboxEvent ID and a reread of the committed row.
- Accepted rows use `aggregateType: AnalyticsEvent`, `eventType: AnalyticsEventAccepted`, and `payloadVersion: 1`.

The existing transactional outbox model is reused as the durable analytics write model. No Prisma model, schema, or migration is required for this P1 scope.

## Reporting

`GET /v1/analytics/report` accepts strict UTC timestamps in `YYYY-MM-DDTHH:mm:ss[.SSS]Z` form and permits a positive range of at most 31 days. It returns only total and counts by allowlisted event name; hashes and event properties are not returned. Reports over 10,000 accepted events return `422 REPORT_TOO_LARGE` instead of silently truncating.

## Validation and errors

- `400 INVALID_INPUT`: malformed JSON, missing consent/version/idempotency data, an unallowlisted event/property, a prohibited property, or an invalid report range.
- `401 AUTH_REQUIRED`: no active session.
- `404 RESOURCE_NOT_FOUND`: no active membership for the requested tenant.
- `409 IDEMPOTENCY_CONFLICT`: an idempotency key was reused with different content.
- `413 PAYLOAD_TOO_LARGE`: ingestion body exceeds the configured 16 KiB default.
- `422 REPORT_TOO_LARGE`: the bounded report event limit was exceeded.
- `429 RATE_LIMITED`: the authenticated actor+tenant exceeded the operation-specific analytics budget; the response includes `Retry-After`.
- `503 PROVIDER_UNAVAILABLE`: the repository, hash configuration, or distributed rate limiter is unavailable.

## Security and privacy

- `ANALYTICS_HASH_SECRET` is server-only and must be at least 32 characters. Raw tenant and actor identifiers never cross the analytics package's persistence payload boundary.
- Consent is required at ingestion, but consent does not make arbitrary data permissible; the schema allowlist remains mandatory.
- Reports are authenticated, tenant-scoped, aggregate-only, and sent with `Cache-Control: no-store`.
- The route applies a strict request-body byte limit and requires an injected distributed rate limiter. The initial staging policy is 60 ingestion requests and 30 report requests per authenticated actor+tenant per rolling minute. A limiter must be atomic and shared across replicas; the backend fails closed with `503 PROVIDER_UNAVAILABLE` when it is not configured.
- Retention and deletion policy for analytics rows must be defined before production data volume grows. The existing outbox worker/operational cleanup policy must also account for accepted analytics events.

## Domain events

`AnalyticsEventAccepted` is stored in the existing outbox with the privacy-safe payload. Consumers must remain idempotent and tolerate additive schema versions.

## Owning module

`packages/analytics` owns the event invariant, validation, hashing, idempotency identity, and reporting rules. `packages/database` owns the Prisma adapter. `apps/backend-api` owns authentication, tenant authorization, HTTP limits, and status mapping. Other modules integrate through these ports or versioned events.

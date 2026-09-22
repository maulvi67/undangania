import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
export {
  ANALYTICS_INGEST_RATE_LIMIT,
  ANALYTICS_REPORT_RATE_LIMIT,
  analyticsRateLimitPolicy,
  assertAnalyticsRateLimitDecision,
  type AnalyticsRateLimitDecision,
  type AnalyticsRateLimitOperation,
  type AnalyticsRateLimiter,
  AnalyticsRateLimiterUnavailableError,
} from "./rate-limit";
export {
  ANALYTICS_REDIS_RATE_LIMIT_SCRIPT,
  RedisAnalyticsRateLimiter,
  type AnalyticsRedisEvalClient,
  type RedisAnalyticsRateLimiterOptions,
} from "./redis-rate-limit";
export {
  ANALYTICS_RETENTION_MAX_BATCH_SIZE,
  dryRunAnalyticsRetention,
  type AnalyticsRetentionCandidate,
  type AnalyticsRetentionDryRun,
  type AnalyticsRetentionRepository,
} from "./retention";

export const ANALYTICS_SCHEMA_VERSION = 1 as const;
export const ANALYTICS_HASH_SECRET_MIN_LENGTH = 32;
export const ANALYTICS_REPORT_MAX_EVENTS = 10_000;
export const ANALYTICS_REPORT_MAX_RANGE_DAYS = 31;

export const ANALYTICS_EVENT_NAMES = [
  "invitation_viewed",
  "invitation_published",
  "rsvp_submitted",
  "guestbook_submitted",
  "checkout_started",
  "checkout_completed",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

const DEVICE_VALUES = ["mobile", "tablet", "desktop", "unknown"] as const;
const VIEW_SOURCE_VALUES = ["direct", "shared", "search", "unknown"] as const;
const RSVP_RESPONSE_VALUES = ["ATTENDING", "DECLINED", "TENTATIVE"] as const;

const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9._~-]{16,128}$/u);
const scalarPropertySchema = z.union([
  z.string().max(64),
  z.number().finite(),
  z.boolean(),
]);

const commonEventFields = {
  schemaVersion: z.literal(ANALYTICS_SCHEMA_VERSION),
  consent: z.literal(true),
  idempotencyKey: idempotencyKeySchema,
};

const invitationViewedPropertiesSchema = z
  .object({
    source: z.enum(VIEW_SOURCE_VALUES),
    device: z.enum(DEVICE_VALUES),
  })
  .strict();

const invitationPublishedPropertiesSchema = z
  .object({
    status: z.literal("PUBLISHED"),
  })
  .strict();

const rsvpSubmittedPropertiesSchema = z
  .object({
    response: z.enum(RSVP_RESPONSE_VALUES),
  })
  .strict();

const guestbookSubmittedPropertiesSchema = z
  .object({
    moderationStatus: z.literal("PENDING"),
  })
  .strict();

const checkoutPropertiesSchema = z
  .object({
    currency: z.literal("IDR"),
  })
  .strict();

/**
 * The public ingestion body is a discriminated union on purpose. A generic
 * `Record<string, unknown>` would make it too easy for a caller to add a name,
 * contact, token, URL, or free-form content field that later becomes telemetry.
 */
export const analyticsEventRequestSchema = z.discriminatedUnion("name", [
  z
    .object({
      ...commonEventFields,
      name: z.literal("invitation_viewed"),
      properties: invitationViewedPropertiesSchema,
    })
    .strict(),
  z
    .object({
      ...commonEventFields,
      name: z.literal("invitation_published"),
      properties: invitationPublishedPropertiesSchema,
    })
    .strict(),
  z
    .object({
      ...commonEventFields,
      name: z.literal("rsvp_submitted"),
      properties: rsvpSubmittedPropertiesSchema,
    })
    .strict(),
  z
    .object({
      ...commonEventFields,
      name: z.literal("guestbook_submitted"),
      properties: guestbookSubmittedPropertiesSchema,
    })
    .strict(),
  z
    .object({
      ...commonEventFields,
      name: z.literal("checkout_started"),
      properties: checkoutPropertiesSchema,
    })
    .strict(),
  z
    .object({
      ...commonEventFields,
      name: z.literal("checkout_completed"),
      properties: checkoutPropertiesSchema,
    })
    .strict(),
]);

export type AnalyticsEventRequest = z.infer<typeof analyticsEventRequestSchema>;
export type AnalyticsPropertyValue = string | number | boolean;
export type AnalyticsProperties = Readonly<
  Record<string, AnalyticsPropertyValue>
>;

/**
 * These names are rejected before schema parsing so a caller gets an explicit
 * privacy failure for common PII fields rather than relying only on unknown-key
 * rejection. The event-specific schemas remain the final allowlist.
 */
export const prohibitedPropertyNames = [
  "name",
  "email",
  "phone",
  "guestToken",
  "accountNumber",
  "message",
  "userId",
  "tenantId",
  "guestId",
  "householdId",
  "token",
  "tokenHash",
  "address",
  "url",
  "path",
  "ipAddress",
  "userAgent",
  "content",
  "displayName",
] as const;

export type AnalyticsValidationFailure =
  "INVALID_EVENT" | "PROHIBITED_PROPERTY";

export type AnalyticsValidationResult =
  | Readonly<{ ok: true; data: AnalyticsEventRequest }>
  | Readonly<{ ok: false; reason: AnalyticsValidationFailure }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsProhibitedProperty(input: unknown): boolean {
  if (!isRecord(input) || !isRecord(input.properties)) return false;
  return Object.keys(input.properties).some((key) =>
    (prohibitedPropertyNames as readonly string[]).includes(key),
  );
}

export function validateAnalyticsEvent(
  input: unknown,
): AnalyticsValidationResult {
  if (containsProhibitedProperty(input)) {
    return { ok: false, reason: "PROHIBITED_PROPERTY" };
  }

  const parsed = analyticsEventRequestSchema.safeParse(input);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, reason: "INVALID_EVENT" };
}

function toAnalyticsProperties(
  properties: AnalyticsEventRequest["properties"],
): AnalyticsProperties {
  const normalized: Record<string, AnalyticsPropertyValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      normalized[key] = value;
    }
  }
  return normalized;
}

function assertHashSecret(secret: string): void {
  if (secret.length < ANALYTICS_HASH_SECRET_MIN_LENGTH) {
    throw new Error("Analytics hash secret is too short");
  }
}

function hashIdentifier(
  purpose: string,
  identifier: string,
  secret: string,
): string {
  if (identifier.length === 0) throw new Error("Analytics identifier is empty");
  assertHashSecret(secret);
  return createHmac("sha256", secret)
    .update(`${purpose}:${identifier}`, "utf8")
    .digest("hex");
}

/** Hashes the tenant reference before it enters the analytics payload. */
export function hashTenantId(tenantId: string, secret: string): string {
  return hashIdentifier("tenant", tenantId, secret);
}

/** Hashes an authenticated actor reference; the raw user id is never persisted. */
export function hashActorId(
  actorId: string | null | undefined,
  secret: string,
): string | null {
  return actorId === null || actorId === undefined
    ? null
    : hashIdentifier("actor", actorId, secret);
}

/**
 * The idempotency key is hashed into a stable UUID-shaped id. It is intentionally
 * independent of the rotating hash secret so a secret rotation does not turn a
 * client retry into a second event.
 */
export function analyticsEventId(
  tenantId: string,
  idempotencyKey: string,
): string {
  const digest = createHash("sha256")
    .update(`analytics-event:v1:${tenantId}:${idempotencyKey}`, "utf8")
    .digest("hex")
    .slice(0, 32);
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `8${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-");
}

export type AnalyticsScope = Readonly<{
  tenantId: string;
}>;

export type AnalyticsEventDraft = Readonly<{
  id: string;
  name: AnalyticsEventName;
  schemaVersion: typeof ANALYTICS_SCHEMA_VERSION;
  tenantIdHash: string;
  actorHash: string | null;
  properties: AnalyticsProperties;
  occurredAt: Date;
  acceptedAt: Date;
}>;

export type AnalyticsEventRecord = AnalyticsEventDraft;

export type AnalyticsAppendResult = Readonly<{
  kind: "created" | "existing";
  event: AnalyticsEventRecord;
}>;

export type AnalyticsEventRepository = Readonly<{
  append(
    scope: AnalyticsScope,
    event: AnalyticsEventDraft,
  ): Promise<AnalyticsAppendResult>;
  listAccepted(
    scope: AnalyticsScope,
    range: AnalyticsReportRange,
  ): Promise<readonly AnalyticsEventRecord[]>;
}>;

export type AnalyticsIngestContext = Readonly<{
  tenantId: string;
  actorId?: string | null;
  hashSecret: string;
}>;

export type AnalyticsIngestResult =
  | Readonly<{ kind: "invalid"; reason: AnalyticsValidationFailure }>
  | Readonly<{ kind: "accepted"; eventId: string }>
  | Readonly<{ kind: "replayed"; eventId: string }>
  | Readonly<{ kind: "idempotency-conflict"; eventId: string }>;

function sameEventContent(
  left: AnalyticsEventRecord,
  right: AnalyticsEventDraft,
): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.schemaVersion === right.schemaVersion &&
    left.tenantIdHash === right.tenantIdHash &&
    left.actorHash === right.actorHash &&
    stableJson(left.properties) === stableJson(right.properties)
  );
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Validates, hashes, and persists one event through the repository port. The
 * repository's unique id is the final concurrent idempotency guard; comparing the
 * returned row makes a reused key with different content an explicit conflict.
 */
export async function ingestAnalyticsEvent(
  repository: AnalyticsEventRepository,
  context: AnalyticsIngestContext,
  input: unknown,
  now: Date,
): Promise<AnalyticsIngestResult> {
  const validation = validateAnalyticsEvent(input);
  if (!validation.ok) {
    return { kind: "invalid", reason: validation.reason };
  }

  const data = validation.data;
  const event: AnalyticsEventDraft = {
    id: analyticsEventId(context.tenantId, data.idempotencyKey),
    name: data.name,
    schemaVersion: data.schemaVersion,
    tenantIdHash: hashTenantId(context.tenantId, context.hashSecret),
    actorHash: hashActorId(context.actorId, context.hashSecret),
    properties: toAnalyticsProperties(data.properties),
    occurredAt: now,
    acceptedAt: now,
  };

  const saved = await repository.append({ tenantId: context.tenantId }, event);
  if (!sameEventContent(saved.event, event)) {
    return { kind: "idempotency-conflict", eventId: saved.event.id };
  }
  return {
    kind: saved.kind === "created" ? "accepted" : "replayed",
    eventId: saved.event.id,
  };
}

const ISO_UTC_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

export type AnalyticsReportRange = Readonly<{
  from: Date;
  to: Date;
}>;

export type AnalyticsReportRangeFailure = "INVALID_RANGE";

export type AnalyticsReportRangeResult =
  | Readonly<{ ok: true; value: AnalyticsReportRange }>
  | Readonly<{ ok: false; reason: AnalyticsReportRangeFailure }>;

export function parseAnalyticsReportRange(
  input: unknown,
): AnalyticsReportRangeResult {
  const parsed = z
    .object({
      from: z.string().regex(ISO_UTC_DATE_TIME),
      to: z.string().regex(ISO_UTC_DATE_TIME),
    })
    .strict()
    .safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_RANGE" };

  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  const duration = to.getTime() - from.getTime();
  const maximumDuration =
    ANALYTICS_REPORT_MAX_RANGE_DAYS * 24 * 60 * 60 * 1_000;
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    duration <= 0 ||
    duration > maximumDuration
  ) {
    return { ok: false, reason: "INVALID_RANGE" };
  }
  return { ok: true, value: { from, to } };
}

export class AnalyticsReportLimitError extends Error {
  public constructor() {
    super("The analytics report contains too many events");
    this.name = "AnalyticsReportLimitError";
  }
}

export type AnalyticsReport = Readonly<{
  from: string;
  to: string;
  total: number;
  counts: Readonly<Record<AnalyticsEventName, number>>;
}>;

export async function reportAnalyticsEvents(
  repository: AnalyticsEventRepository,
  scope: AnalyticsScope,
  range: AnalyticsReportRange,
): Promise<AnalyticsReport> {
  const events = await repository.listAccepted(scope, range);
  if (events.length > ANALYTICS_REPORT_MAX_EVENTS) {
    throw new AnalyticsReportLimitError();
  }

  const counts: Record<AnalyticsEventName, number> = {
    invitation_viewed: 0,
    invitation_published: 0,
    rsvp_submitted: 0,
    guestbook_submitted: 0,
    checkout_started: 0,
    checkout_completed: 0,
  };
  for (const event of events) counts[event.name] += 1;

  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    total: events.length,
    counts,
  };
}

const analyticsStoredPayloadSchema = z
  .object({
    eventId: z
      .string()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/u,
      ),
    eventName: z.enum(ANALYTICS_EVENT_NAMES),
    schemaVersion: z.literal(ANALYTICS_SCHEMA_VERSION),
    tenantIdHash: z.string().regex(/^[0-9a-f]{64}$/u),
    actorHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/u)
      .nullable(),
    properties: z.record(z.string(), scalarPropertySchema),
    occurredAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type AnalyticsStoredPayload = Readonly<{
  eventId: string;
  eventName: AnalyticsEventName;
  schemaVersion: typeof ANALYTICS_SCHEMA_VERSION;
  tenantIdHash: string;
  actorHash: string | null;
  properties: AnalyticsProperties;
  occurredAt: string;
}>;

export function serializeAnalyticsEventPayload(
  event: AnalyticsEventDraft,
): AnalyticsStoredPayload {
  return {
    eventId: event.id,
    eventName: event.name,
    schemaVersion: event.schemaVersion,
    tenantIdHash: event.tenantIdHash,
    actorHash: event.actorHash,
    properties: event.properties,
    occurredAt: event.occurredAt.toISOString(),
  };
}

/** Parses and re-applies the event allowlist before a row enters reporting. */
export function parseAnalyticsEventPayload(
  input: unknown,
): AnalyticsStoredPayload | null {
  const parsed = analyticsStoredPayloadSchema.safeParse(input);
  if (!parsed.success) return null;

  const validation = validateAnalyticsEvent({
    name: parsed.data.eventName,
    schemaVersion: parsed.data.schemaVersion,
    consent: true,
    idempotencyKey: "stored-payload-validation",
    properties: parsed.data.properties,
  });
  if (!validation.ok) return null;

  return {
    eventId: parsed.data.eventId,
    eventName: parsed.data.eventName,
    schemaVersion: parsed.data.schemaVersion,
    tenantIdHash: parsed.data.tenantIdHash,
    actorHash: parsed.data.actorHash,
    properties: toAnalyticsProperties(validation.data.properties),
    occurredAt: parsed.data.occurredAt,
  };
}

/** The adapter-facing port contains hashes only; raw identifiers do not cross it. */
export interface AnalyticsPort {
  track(event: {
    name: AnalyticsEventName;
    tenantIdHash: string;
    actorHash?: string | null;
    properties: AnalyticsProperties;
  }): Promise<void>;
}

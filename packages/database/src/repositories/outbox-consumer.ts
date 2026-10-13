import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";

/**
 * Outbox consumption.
 *
 * `OutboxEvent` is written inside the same transaction that mutates the
 * aggregate (see `PrismaQrisOutboxRepository`), which is what makes the event
 * durable: it cannot be lost between the state change and the side effect.
 * Nothing drained it, so `PaymentConfirmed` rows accumulated with no downstream
 * effect. This module is that drain.
 *
 * The claim protocol avoids a `PROCESSING` status — the schema has no such
 * state and the admin console already treats `PENDING`, `FAILED`, and
 * `PROCESSED` as the whole vocabulary. Instead a claim is a compare-and-swap on
 * `attemptCount` that also leases the row by pushing `availableAt` forward:
 *
 *   - `findMany` selects candidates the worker could take (oldest first);
 *   - `updateMany` wins a candidate only if its `attemptCount` is still the one
 *     that was read, which makes two workers racing on the same row a no-op for
 *     the loser rather than a double delivery;
 *   - the lease (`availableAt = now + leaseMs`) keeps a crashed worker's row
 *     from being stuck, because a later poll re-claims it once the lease lapses.
 *
 * On success the row becomes `PROCESSED`; on a retryable failure it is left
 * `PENDING` and simply waits out its lease; on a terminal failure, or once
 * `maxAttempts` is exhausted, it becomes `FAILED` — the dead-letter state the
 * admin console lists and can retry, which resets it back to `PENDING`.
 *
 * Delivery is at-least-once, so the notification port receives an idempotency
 * key derived from the event id; a re-claim after a crash collapses onto the
 * same provider message instead of sending a second email.
 */

/** The one event type this consumer understands today. */
export const PAYMENT_CONFIRMED_EVENT_TYPE = "PaymentConfirmed" as const;

export type OutboxEventRecord = Readonly<{
  id: string;
  tenantId: string | null;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payloadVersion: number;
  payload: unknown;
  /** Attempts including the claim that produced this record. */
  attemptCount: number;
}>;

export type OutboxConsumerPolicy = Readonly<{
  /** Maximum events claimed per poll. */
  batchSize: number;
  /** Claims allowed before an event is dead-lettered. */
  maxAttempts: number;
  /** How long a claim is held before another worker may retake it. */
  leaseMs: number;
}>;

export const OUTBOX_CONSUMER_POLICY: OutboxConsumerPolicy = {
  batchSize: 25,
  maxAttempts: 5,
  leaseMs: 60_000,
};

/** Structural so the consumer never depends on `@wedding/notifications`. */
export interface OutboxConsumerNotificationPort {
  send(input: {
    idempotencyKey: string;
    channel: "EMAIL" | "WHATSAPP";
    recipientRef: string;
    templateCode: string;
    variables: Record<string, string>;
  }): Promise<{ providerMessageId: string; status: "SENT" | "QUEUED" }>;
}

export type OutboxOrderCustomer = Readonly<{
  userId: string;
  email: string;
  displayName: string;
  orderNumber: string;
}>;

export interface OutboxOrderCustomerPort {
  findByOrder(input: {
    tenantId: string;
    orderId: string;
  }): Promise<OutboxOrderCustomer | null>;
}

const outboxEventSelect = {
  id: true,
  tenantId: true,
  eventType: true,
  aggregateType: true,
  aggregateId: true,
  payload: true,
  payloadVersion: true,
  attemptCount: true,
} as const satisfies Prisma.OutboxEventSelect;

type OutboxEventRow = Prisma.OutboxEventGetPayload<{
  select: typeof outboxEventSelect;
}>;

const orderCustomerSelect = {
  orderNumber: true,
  userId: true,
  user: { select: { email: true, displayName: true } },
} as const satisfies Prisma.OrderSelect;

type OrderCustomerRow = Prisma.OrderGetPayload<{
  select: typeof orderCustomerSelect;
}>;

/**
 * Structural delegates, narrow so tests can inject plain objects. A real Prisma
 * client is adapted by `adaptOutboxConsumerClient` rather than cast into place,
 * because Prisma's delegate methods are generic over `SelectSubset` and do not
 * compare soundly against a concrete signature.
 */
export type OutboxConsumerClient = Readonly<{
  outboxEvent: {
    findMany(args: {
      where: Prisma.OutboxEventWhereInput;
      orderBy: Prisma.OutboxEventOrderByWithRelationInput;
      take: number;
      select: typeof outboxEventSelect;
    }): Promise<OutboxEventRow[]>;
    updateMany(args: {
      where: Prisma.OutboxEventWhereInput;
      data: Prisma.OutboxEventUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
  order: {
    findFirst(args: {
      where: Prisma.OrderWhereInput;
      select: typeof orderCustomerSelect;
    }): Promise<OrderCustomerRow | null>;
  };
}>;

export function adaptOutboxConsumerClient(
  client: Pick<PrismaClient, "outboxEvent" | "order">,
): OutboxConsumerClient {
  return {
    outboxEvent: {
      findMany: (args) => client.outboxEvent.findMany(args),
      updateMany: (args) => client.outboxEvent.updateMany(args),
    },
    order: {
      findFirst: (args) => client.order.findFirst(args),
    },
  };
}

/** Resolves the customer a paid order belongs to, without decrypting anything. */
export function createOrderCustomerLookup(
  client: OutboxConsumerClient,
): OutboxOrderCustomerPort {
  return {
    async findByOrder({ tenantId, orderId }) {
      const row = await client.order.findFirst({
        where: { id: orderId, tenantId },
        select: orderCustomerSelect,
      });
      if (row === null) return null;
      return {
        userId: row.userId,
        email: row.user.email,
        displayName: row.user.displayName,
        orderNumber: row.orderNumber,
      };
    },
  };
}

/**
 * Claims up to `policy.batchSize` due events, oldest first. Returns only the
 * rows this call won; a row another worker claimed concurrently is skipped.
 */
export async function claimOutboxEvents(
  client: OutboxConsumerClient,
  input: Readonly<{
    now: Date;
    policy: OutboxConsumerPolicy;
    eventTypes: readonly string[];
  }>,
): Promise<readonly OutboxEventRecord[]> {
  const { now, policy, eventTypes } = input;
  const candidates = await client.outboxEvent.findMany({
    where: {
      status: "PENDING",
      eventType: { in: [...eventTypes] },
      availableAt: { lte: now },
      attemptCount: { lt: policy.maxAttempts },
    },
    orderBy: { createdAt: "asc" },
    take: policy.batchSize,
    select: outboxEventSelect,
  });

  const leaseUntil = new Date(now.getTime() + policy.leaseMs);
  const claimed: OutboxEventRecord[] = [];
  for (const row of candidates) {
    const result = await client.outboxEvent.updateMany({
      where: {
        id: row.id,
        status: "PENDING",
        attemptCount: row.attemptCount,
        availableAt: { lte: now },
      },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
        availableAt: leaseUntil,
      },
    });
    if (result.count !== 1) continue;
    claimed.push({
      id: row.id,
      tenantId: row.tenantId,
      eventType: row.eventType,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      payloadVersion: row.payloadVersion,
      payload: row.payload,
      attemptCount: row.attemptCount + 1,
    });
  }
  return claimed;
}

export async function markOutboxProcessed(
  client: OutboxConsumerClient,
  input: Readonly<{ id: string; now: Date }>,
): Promise<void> {
  await client.outboxEvent.updateMany({
    where: { id: input.id, status: "PENDING" },
    data: { status: "PROCESSED", processedAt: input.now, lastError: null },
  });
}

export async function markOutboxFailed(
  client: OutboxConsumerClient,
  input: Readonly<{ id: string; error: string }>,
): Promise<void> {
  await client.outboxEvent.updateMany({
    where: { id: input.id, status: "PENDING" },
    data: { status: "FAILED", lastError: input.error.slice(0, 500) },
  });
}

export type PaymentConfirmedPayload = Readonly<{
  paymentId: string;
  orderId: string;
  provider: string;
  providerTransactionId: string;
  providerEventId: string;
  status: string;
  occurredAt: string;
}>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Reads the payload the payment slice wrote, rejecting anything unexpected. */
export function readPaymentConfirmedPayload(
  value: unknown,
): PaymentConfirmedPayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const {
    paymentId,
    orderId,
    provider,
    providerTransactionId,
    providerEventId,
    status,
    occurredAt,
  } = record;
  if (
    !isNonEmptyString(paymentId) ||
    !isNonEmptyString(orderId) ||
    !isNonEmptyString(provider) ||
    !isNonEmptyString(providerTransactionId) ||
    !isNonEmptyString(providerEventId) ||
    !isNonEmptyString(status) ||
    !isNonEmptyString(occurredAt)
  ) {
    return null;
  }
  return {
    paymentId,
    orderId,
    provider,
    providerTransactionId,
    providerEventId,
    status,
    occurredAt,
  };
}

/**
 * A provider rejection is permanent for this message — a bad address will not
 * become good on the next attempt — so it is dead-lettered immediately instead
 * of burning the remaining attempts. The code is read structurally so this
 * package stays free of a `@wedding/notifications` dependency.
 */
function isTerminalNotificationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === "PROVIDER_REJECTED" || code === "PROVIDER_INVALID_RESPONSE";
}

export type OutboxConsumeOutcome =
  | Readonly<{ kind: "processed"; eventId: string }>
  | Readonly<{ kind: "skipped"; eventId: string; reason: string }>
  | Readonly<{ kind: "retry"; eventId: string; attemptCount: number }>
  | Readonly<{
      kind: "failed";
      eventId: string;
      attemptCount: number;
      reason: string;
    }>;

export interface OutboxConsumerPorts {
  readonly client: OutboxConsumerClient;
  readonly notifications: OutboxConsumerNotificationPort;
  readonly customers: OutboxOrderCustomerPort;
  readonly templates: Readonly<{ paymentConfirmed: string }>;
  readonly policy: OutboxConsumerPolicy;
  readonly eventTypes: readonly string[];
}

/**
 * Handles a single event. `skipped` means there is nothing to deliver and the
 * event should be retired as `PROCESSED`; `retry` means leave it `PENDING` and
 * let the lease lapse.
 */
export async function consumeOutboxEvent(
  event: OutboxEventRecord,
  ports: OutboxConsumerPorts,
): Promise<OutboxConsumeOutcome> {
  if (event.eventType !== PAYMENT_CONFIRMED_EVENT_TYPE) {
    return { kind: "skipped", eventId: event.id, reason: "unsupported-event-type" };
  }
  // Tenant scope is part of every tenant-bound operation; an event without one
  // cannot be authorized downstream, so it is retired rather than retried.
  if (event.tenantId === null) {
    return { kind: "skipped", eventId: event.id, reason: "missing-tenant" };
  }

  const payload = readPaymentConfirmedPayload(event.payload);
  if (payload === null) {
    // A malformed payload never becomes valid on retry.
    return {
      kind: "failed",
      eventId: event.id,
      attemptCount: event.attemptCount,
      reason: "malformed-payload",
    };
  }

  const customer = await ports.customers.findByOrder({
    tenantId: event.tenantId,
    orderId: payload.orderId,
  });
  if (customer === null) {
    return { kind: "skipped", eventId: event.id, reason: "customer-not-found" };
  }

  try {
    await ports.notifications.send({
      idempotencyKey: `payment:${PAYMENT_CONFIRMED_EVENT_TYPE}:${event.id}`,
      channel: "EMAIL",
      recipientRef: customer.email,
      templateCode: ports.templates.paymentConfirmed,
      variables: {
        customerName: customer.displayName,
        orderNumber: customer.orderNumber,
        status: payload.status,
        occurredAt: payload.occurredAt,
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "notification-failed";
    if (
      isTerminalNotificationError(error) ||
      event.attemptCount >= ports.policy.maxAttempts
    ) {
      return {
        kind: "failed",
        eventId: event.id,
        attemptCount: event.attemptCount,
        reason,
      };
    }
    return { kind: "retry", eventId: event.id, attemptCount: event.attemptCount };
  }

  return { kind: "processed", eventId: event.id };
}

export type OutboxBatchSummary = Readonly<{
  claimed: number;
  processed: number;
  skipped: number;
  retried: number;
  failed: number;
}>;

/**
 * One poll: claim a batch, handle each event, and persist the terminal outcome.
 * A handler that throws is treated like a failed delivery so one bad event
 * cannot abort the rest of the batch.
 */
export async function consumeOutboxBatch(
  ports: OutboxConsumerPorts,
  input: Readonly<{ now: Date }>,
): Promise<OutboxBatchSummary> {
  const events = await claimOutboxEvents(ports.client, {
    now: input.now,
    policy: ports.policy,
    eventTypes: ports.eventTypes,
  });

  let processed = 0;
  let skipped = 0;
  let retried = 0;
  let failed = 0;

  for (const event of events) {
    let outcome: OutboxConsumeOutcome;
    try {
      outcome = await consumeOutboxEvent(event, ports);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unexpected-error";
      outcome =
        event.attemptCount >= ports.policy.maxAttempts
          ? {
              kind: "failed",
              eventId: event.id,
              attemptCount: event.attemptCount,
              reason,
            }
          : { kind: "retry", eventId: event.id, attemptCount: event.attemptCount };
    }

    if (outcome.kind === "processed" || outcome.kind === "skipped") {
      await markOutboxProcessed(ports.client, { id: event.id, now: input.now });
      if (outcome.kind === "processed") processed += 1;
      else skipped += 1;
    } else if (outcome.kind === "failed") {
      await markOutboxFailed(ports.client, {
        id: event.id,
        error: outcome.reason,
      });
      failed += 1;
    } else {
      // Retryable: the claim already pushed `availableAt` forward, so the row
      // stays PENDING and is re-claimed once the lease lapses.
      retried += 1;
    }
  }

  return { claimed: events.length, processed, skipped, retried, failed };
}

/** Wires the ports from a client, a notification transport, and a template. */
export function createOutboxConsumerPorts(input: {
  client: OutboxConsumerClient;
  notifications: OutboxConsumerNotificationPort;
  templates: Readonly<{ paymentConfirmed: string }>;
  policy?: OutboxConsumerPolicy;
  eventTypes?: readonly string[];
}): OutboxConsumerPorts {
  return {
    client: input.client,
    notifications: input.notifications,
    customers: createOrderCustomerLookup(input.client),
    templates: input.templates,
    policy: input.policy ?? OUTBOX_CONSUMER_POLICY,
    eventTypes: input.eventTypes ?? [PAYMENT_CONFIRMED_EVENT_TYPE],
  };
}

/**
 * Convenience composition for a runner that already holds the shared client.
 * Kept here so the Prisma wiring lives next to the adapter it adapts.
 */
export function createPrismaOutboxConsumerPorts(input: {
  notifications: OutboxConsumerNotificationPort;
  templates: Readonly<{ paymentConfirmed: string }>;
  client?: PrismaClient;
  policy?: OutboxConsumerPolicy;
  eventTypes?: readonly string[];
}): OutboxConsumerPorts {
  return createOutboxConsumerPorts({
    client: adaptOutboxConsumerClient(input.client ?? prisma),
    notifications: input.notifications,
    templates: input.templates,
    ...(input.policy === undefined ? {} : { policy: input.policy }),
    ...(input.eventTypes === undefined ? {} : { eventTypes: input.eventTypes }),
  });
}

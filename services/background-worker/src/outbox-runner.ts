import {
  consumeOutboxBatch,
  createPrismaOutboxConsumerPorts,
  PAYMENT_CONFIRMED_EVENT_TYPE,
  type OutboxBatchSummary,
  type OutboxConsumerPorts,
} from "@wedding/database";
import {
  createNotificationPortFromEnv,
  NOTIFICATION_TEMPLATES,
} from "@wedding/notifications";

/**
 * Payment-outbox runner.
 *
 * `OutboxEvent` rows are written inside the payment transaction and were never
 * drained, so `PaymentConfirmed` events piled up with no downstream effect. This
 * runner closes that loop: it claims due events, turns each into a customer
 * notification, and persists the outcome.
 *
 * The runner is the composition root. `src/index.ts` stays free of Prisma by
 * receiving ports through injection; this file is the only place in the service
 * that binds the Prisma-backed consumer and the environment-configured delivery
 * transport together.
 */

export const OUTBOX_POLL_INTERVAL_MS = 15_000;

export class OutboxRunnerUnavailableError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "OutboxRunnerUnavailableError";
  }
}

/**
 * Fails closed when no delivery transport is configured, rather than draining
 * events into a transport that would silently drop them. A configured
 * environment (console locally, relay in production) yields a ready consumer.
 */
export function createPaymentConfirmedConsumer(): OutboxConsumerPorts {
  const notifications = createNotificationPortFromEnv();
  if (notifications === null) {
    throw new OutboxRunnerUnavailableError(
      "Email delivery is not configured; refusing to drain the payment outbox.",
    );
  }
  return createPrismaOutboxConsumerPorts({
    notifications,
    templates: { paymentConfirmed: NOTIFICATION_TEMPLATES.PAYMENT_CONFIRMED },
    eventTypes: [PAYMENT_CONFIRMED_EVENT_TYPE],
  });
}

/** Claims and handles one batch. Safe to call from a cron trigger. */
export async function drainOutboxOnce(
  now: Date = new Date(),
): Promise<OutboxBatchSummary> {
  return consumeOutboxBatch(createPaymentConfirmedConsumer(), { now });
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted === true) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(finish, ms);
    function finish(): void {
      signal?.removeEventListener("abort", finish);
      clearTimeout(timer);
      resolve();
    }
    signal?.addEventListener("abort", finish, { once: true });
  });
}

/**
 * Polls until `signal` aborts. A failing poll is logged and retried on the next
 * tick so a transient database or provider outage cannot stop the loop.
 */
export async function startOutboxLoop(
  input: Readonly<{ intervalMs?: number; signal?: AbortSignal }> = {},
): Promise<void> {
  const intervalMs = input.intervalMs ?? OUTBOX_POLL_INTERVAL_MS;
  const signal = input.signal;

  while (signal === undefined || !signal.aborted) {
    try {
      const summary = await drainOutboxOnce(new Date());
      if (summary.claimed > 0) {
        console.info("outbox.poll.drained", summary);
      }
    } catch (error) {
      console.error(
        "outbox.poll.failed",
        error instanceof Error ? error.message : "unknown-error",
      );
    }
    await delay(intervalMs, signal);
  }
}

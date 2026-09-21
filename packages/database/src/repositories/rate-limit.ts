import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";
import { guestbookMessageId } from "./guestbook-submission";

/**
 * Submission rate limiting for the guest-facing writes.
 *
 * `docs/domains/rsvp.md` and `docs/domains/guestbook.md` both name rate limiting as
 * a security consideration, and both client contracts carry a `RATE_LIMITED` code.
 * This is the missing piece.
 *
 * The window is counted from rows that were actually written, not from a separate
 * counter: `OutboxEvent` for RSVP (one row per accepted submission, keyed by the
 * idempotency key) and `GuestbookMessage` for the guestbook. Counting committed
 * rows needs no new table, no migration, and no cache — so it cannot disagree with
 * what was stored.
 *
 * What this does and does not cover, stated plainly:
 *
 *   - It limits **accepted** submissions. A request rejected for validation or a
 *     lost version guard consumes no budget, so a guest correcting a form is never
 *     locked out by their own retries.
 *   - It is a per-household budget. A scraper cycling through many valid tokens is
 *     not slowed by this; that needs an edge or gateway limit keyed on the caller's
 *     address, which is the deployment's job rather than this module's.
 *   - The two operations are limited independently, so a flood of greetings cannot
 *     close RSVP.
 */

export type RateLimitDecision = Readonly<{
  allowed: boolean;
  /** Accepted submissions still available in the current window. */
  remaining: number;
  /** Seconds until the oldest counted submission leaves the window. */
  retryAfterSeconds: number;
}>;

export type RateLimitPolicy = Readonly<{
  /** Accepted submissions permitted per window. */
  limit: number;
  windowSeconds: number;
}>;

/**
 * Five RSVP submissions per household per ten minutes.
 *
 * A household answers once per event and legitimately edits a few times before the
 * deadline, so the budget has to be generous enough for a family fixing a mistake
 * on several events; the abuse it prevents is scripted churn.
 */
export const RSVP_RATE_LIMIT: RateLimitPolicy = {
  limit: 5,
  windowSeconds: 600,
};

/**
 * Three greetings per household per thirty minutes.
 *
 * Each accepted greeting enters a human moderation queue, so the figure is set to
 * what a well-meaning guest would plausibly send (a greeting, a correction, and one
 * more) rather than to what a server could absorb.
 */
export const GUESTBOOK_RATE_LIMIT: RateLimitPolicy = {
  limit: 3,
  windowSeconds: 1800,
};

/** Exported so tests can build a fake client with the same shape. */
export type RateLimitClient = Readonly<{
  outboxEvent: {
    findMany(args: {
      where: Prisma.OutboxEventWhereInput;
      orderBy: Prisma.OutboxEventOrderByWithRelationInput;
      select: { createdAt: true };
      take: number;
    }): Promise<{ createdAt: Date }[]>;
  };
  guestbookMessage: {
    findMany(args: {
      where: Prisma.GuestbookMessageWhereInput;
      orderBy: Prisma.GuestbookMessageOrderByWithRelationInput;
      select: { submittedAt: true };
      take: number;
    }): Promise<{ submittedAt: Date }[]>;
  };
}>;

export function adaptRateLimitClient(
  client: Pick<PrismaClient, "outboxEvent" | "guestbookMessage">,
): RateLimitClient {
  return {
    outboxEvent: {
      findMany: (args) => client.outboxEvent.findMany(args),
    },
    guestbookMessage: {
      findMany: (args) => client.guestbookMessage.findMany(args),
    },
  };
}

/**
 * Decides from the timestamps of recent accepted submissions.
 *
 * Exported separately so the arithmetic can be tested without a database, which is
 * where the off-by-one in a window boundary would otherwise hide.
 */
export function decideRateLimit(input: {
  /** Most recent first. */
  timestamps: readonly Date[];
  policy: RateLimitPolicy;
  now: Date;
}): RateLimitDecision {
  const windowMs = input.policy.windowSeconds * 1_000;
  const windowStart = input.now.getTime() - windowMs;
  const inWindow = input.timestamps.filter(
    (timestamp) => timestamp.getTime() > windowStart,
  );

  if (inWindow.length < input.policy.limit) {
    return {
      allowed: true,
      remaining: input.policy.limit - inWindow.length,
      retryAfterSeconds: 0,
    };
  }

  // The oldest counted submission is the one that frees a slot, so waiting for it
  // is the shortest amount of time that will actually help.
  const oldest = inWindow[inWindow.length - 1];
  const freesAt =
    oldest === undefined ? input.now.getTime() : oldest.getTime() + windowMs;
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((freesAt - input.now.getTime()) / 1_000),
    ),
  };
}

export class PrismaSubmissionRateLimiter {
  public constructor(
    private readonly client: RateLimitClient = adaptRateLimitClient(prisma),
  ) {}

  /** Counts accepted RSVP submissions by the household's outbox rows. */
  public async checkRsvp(
    householdId: string,
    now: Date,
    policy: RateLimitPolicy = RSVP_RATE_LIMIT,
    idempotencyKey?: string,
  ): Promise<RateLimitDecision> {
    const rows = await this.client.outboxEvent.findMany({
      where: {
        aggregateType: "GuestHousehold",
        aggregateId: householdId,
        eventType: "RsvpSubmitted",
        ...(idempotencyKey === undefined
          ? {}
          : { id: { not: idempotencyKey } }),
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
      // Bound the read: only `limit` rows can possibly change the answer, so there
      // is no reason to load a household's whole history.
      take: policy.limit,
    });

    return decideRateLimit({
      timestamps: rows.map((row) => row.createdAt),
      policy,
      now,
    });
  }

  /** Counts accepted guestbook posts, including ones still awaiting moderation. */
  public async checkGuestbook(
    householdId: string,
    now: Date,
    policy: RateLimitPolicy = GUESTBOOK_RATE_LIMIT,
    idempotencyKey?: string,
  ): Promise<RateLimitDecision> {
    const rows = await this.client.guestbookMessage.findMany({
      where: {
        householdId,
        ...(idempotencyKey === undefined
          ? {}
          : { id: { not: guestbookMessageId(householdId, idempotencyKey) } }),
      },
      orderBy: { submittedAt: "desc" },
      select: { submittedAt: true },
      take: policy.limit,
    });

    return decideRateLimit({
      timestamps: rows.map((row) => row.submittedAt),
      policy,
      now,
    });
  }
}

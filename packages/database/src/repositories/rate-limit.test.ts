import { describe, expect, it, vi } from "vitest";
import {
  PrismaSubmissionRateLimiter,
  RSVP_RATE_LIMIT,
  decideRateLimit,
  type RateLimitClient,
} from "./rate-limit";

const NOW = new Date("2026-09-16T10:00:00.000Z");

function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60_000);
}

describe("decideRateLimit", () => {
  const policy = { limit: 3, windowSeconds: 600 };

  it("allows a submission with budget left", () => {
    expect(
      decideRateLimit({ timestamps: [minutesAgo(1)], policy, now: NOW }),
    ).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
  });

  it("allows the first submission ever", () => {
    expect(decideRateLimit({ timestamps: [], policy, now: NOW })).toEqual({
      allowed: true,
      remaining: 3,
      retryAfterSeconds: 0,
    });
  });

  it("refuses once the budget is spent", () => {
    const decision = decideRateLimit({
      timestamps: [minutesAgo(1), minutesAgo(2), minutesAgo(3)],
      policy,
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
  });

  it("ignores submissions that have left the window", () => {
    // Two of the four are older than ten minutes, so only two count.
    const decision = decideRateLimit({
      timestamps: [
        minutesAgo(1),
        minutesAgo(2),
        minutesAgo(11),
        minutesAgo(30),
      ],
      policy,
      now: NOW,
    });
    expect(decision).toEqual({
      allowed: true,
      remaining: 1,
      retryAfterSeconds: 0,
    });
  });

  it("counts a submission exactly on the window boundary as expired", () => {
    const exactly = new Date(NOW.getTime() - 600_000);
    const decision = decideRateLimit({
      timestamps: [exactly],
      policy,
      now: NOW,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(3);
  });

  it("reports how long until the oldest slot frees", () => {
    // The oldest of the three left the window in 4 minutes.
    const decision = decideRateLimit({
      timestamps: [minutesAgo(1), minutesAgo(2), minutesAgo(6)],
      policy,
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBe(240);
  });

  it("never reports a zero wait when refusing", () => {
    // A refusal with `retryAfter: 0` would invite an immediate retry loop.
    const decision = decideRateLimit({
      timestamps: [minutesAgo(0), minutesAgo(0), minutesAgo(0)],
      policy,
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("PrismaSubmissionRateLimiter", () => {
  function client(overrides: Record<string, unknown> = {}): RateLimitClient {
    return {
      outboxEvent: {
        findMany: vi.fn().mockResolvedValue([]),
        ...((overrides.outboxEvent as object) ?? {}),
      },
      guestbookMessage: {
        findMany: vi.fn().mockResolvedValue([]),
        ...((overrides.guestbookMessage as object) ?? {}),
      },
    };
  }

  it("counts only this household's accepted RSVP submissions", async () => {
    const c = client();
    await new PrismaSubmissionRateLimiter(c).checkRsvp("hh-1", NOW);

    expect(c.outboxEvent.findMany).toHaveBeenCalledWith({
      where: {
        aggregateType: "GuestHousehold",
        aggregateId: "hh-1",
        eventType: "RsvpSubmitted",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
      // Bounded by the limit: more rows than the limit cannot change the answer.
      take: RSVP_RATE_LIMIT.limit,
    });
  });

  it("excludes the current RSVP idempotency record for safe retries", async () => {
    const c = client();
    await new PrismaSubmissionRateLimiter(c).checkRsvp(
      "hh-1",
      NOW,
      undefined,
      "key-1",
    );

    expect(c.outboxEvent.findMany).toHaveBeenCalledWith({
      where: {
        aggregateType: "GuestHousehold",
        aggregateId: "hh-1",
        eventType: "RsvpSubmitted",
        id: { not: "key-1" },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
      take: RSVP_RATE_LIMIT.limit,
    });
  });

  it("excludes the current guestbook idempotency record for safe retries", async () => {
    const c = client();
    await new PrismaSubmissionRateLimiter(c).checkGuestbook(
      "hh-1",
      NOW,
      undefined,
      "key-1",
    );

    expect(c.guestbookMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          householdId: "hh-1",
          id: { not: expect.any(String) },
        },
      }),
    );
  });

  it("counts the household's guestbook messages, pending or not", async () => {
    const c = client({
      guestbookMessage: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { submittedAt: minutesAgo(1) },
            { submittedAt: minutesAgo(2) },
            { submittedAt: minutesAgo(3) },
          ]),
      },
    });

    const decision = await new PrismaSubmissionRateLimiter(c).checkGuestbook(
      "hh-1",
      NOW,
    );
    // Pending messages still consume the budget: an unmoderated flood is exactly
    // what the limit is for.
    expect(decision.allowed).toBe(false);
  });

  it("allows a household with no history", async () => {
    const limiter = new PrismaSubmissionRateLimiter(client());
    await expect(limiter.checkRsvp("hh-1", NOW)).resolves.toEqual({
      allowed: true,
      remaining: RSVP_RATE_LIMIT.limit,
      retryAfterSeconds: 0,
    });
  });
});

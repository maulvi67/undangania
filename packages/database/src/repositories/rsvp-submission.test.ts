import { describe, expect, it, vi } from "vitest";
import {
  applyRsvpSubmission,
  normalizePax,
  validateRsvpUpdates,
  type RsvpSubmissionClient,
  type RsvpSubmitInput,
} from "./rsvp-submission";

const NOW = new Date("2026-09-16T10:00:00.000Z");
const HOUSEHOLD = {
  id: "hh-1",
  tenantId: "t-1",
  weddingId: "w-1",
  maximumPax: 4,
  status: "ACTIVE",
};

function rsvpRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "r-1",
    eventId: "e-1",
    response: "ATTENDING" as const,
    pax: 2,
    optimisticVersion: 1,
    ...overrides,
  };
}

/**
 * The rules are exercised through `applyRsvpSubmission`, which is the function the
 * transaction class calls with an already-open client. That keeps the assertions
 * on behaviour rather than on Prisma's transaction plumbing.
 */
const repository = {
  submit: (client: RsvpSubmissionClient, input: RsvpSubmitInput) =>
    applyRsvpSubmission(client, input, NOW, input.idempotencyKey),
};

function client(overrides: Record<string, unknown> = {}): RsvpSubmissionClient {
  return {
    guestHousehold: {
      findFirst: vi.fn().mockResolvedValue(HOUSEHOLD),
      ...((overrides.guestHousehold as object) ?? {}),
    },
    weddingEvent: {
      findMany: vi.fn().mockResolvedValue([{ id: "e-1" }, { id: "e-2" }]),
      ...((overrides.weddingEvent as object) ?? {}),
    },
    rsvp: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(rsvpRow()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      ...((overrides.rsvp as object) ?? {}),
    },
    rsvpHistory: {
      create: vi.fn().mockResolvedValue({ id: "h-1" }),
      ...((overrides.rsvpHistory as object) ?? {}),
    },
    outboxEvent: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "k-1" }),
      ...((overrides.outboxEvent as object) ?? {}),
    },
    auditEvent: {
      create: vi.fn().mockResolvedValue({ id: "a-1" }),
      ...((overrides.auditEvent as object) ?? {}),
    },
  };
}

/**
 * The fake delegates are `vi.fn()`s, but their declared type is the port's own
 * signature. This reads recorded calls without weakening that type.
 */
function calls<T>(fn: unknown): readonly (readonly [T])[] {
  return (fn as { mock: { calls: readonly (readonly [T])[] } }).mock.calls;
}

const SUBMIT = {
  householdId: "hh-1",
  updates: [
    {
      eventId: "e-1",
      response: "ATTENDING" as const,
      pax: 2,
      expectedVersion: null,
    },
  ],
  idempotencyKey: "key-abcdefghijklmnop",
};

describe("normalizePax", () => {
  it("zeroes pax for an answer that is not attendance", () => {
    expect(normalizePax("DECLINED", 5, 4)).toBe(0);
    expect(normalizePax("TENTATIVE", 3, 4)).toBe(0);
  });

  it("bounds an attending answer by the household allowance", () => {
    expect(normalizePax("ATTENDING", 4, 4)).toBe(4);
    expect(normalizePax("ATTENDING", 5, 4)).toBe(null);
    expect(normalizePax("ATTENDING", 0, 4)).toBe(null);
    expect(normalizePax("ATTENDING", 1.5, 4)).toBe(null);
  });
});

describe("validateRsvpUpdates", () => {
  const allowed = new Set(["e-1", "e-2"]);

  it("rejects an empty submission", () => {
    expect(validateRsvpUpdates([], 4, allowed)).toEqual({
      ok: false,
      reason: "EMPTY_SUBMISSION",
    });
  });

  it("rejects an event belonging to another wedding", () => {
    expect(
      validateRsvpUpdates(
        [
          {
            eventId: "e-other",
            response: "ATTENDING",
            pax: 1,
            expectedVersion: null,
          },
        ],
        4,
        allowed,
      ),
    ).toEqual({ ok: false, reason: "UNKNOWN_EVENT" });
  });

  it("rejects the same event twice", () => {
    expect(
      validateRsvpUpdates(
        [
          {
            eventId: "e-1",
            response: "ATTENDING",
            pax: 1,
            expectedVersion: null,
          },
          {
            eventId: "e-1",
            response: "DECLINED",
            pax: 0,
            expectedVersion: null,
          },
        ],
        4,
        allowed,
      ),
    ).toEqual({ ok: false, reason: "DUPLICATE_EVENT" });
  });

  it("rejects pax above the allowance", () => {
    expect(
      validateRsvpUpdates(
        [
          {
            eventId: "e-1",
            response: "ATTENDING",
            pax: 9,
            expectedVersion: null,
          },
        ],
        4,
        allowed,
      ),
    ).toEqual({ ok: false, reason: "PAX_OUT_OF_RANGE" });
  });

  it("normalizes pax down to zero for a decline", () => {
    const result = validateRsvpUpdates(
      [{ eventId: "e-1", response: "DECLINED", pax: 3, expectedVersion: null }],
      4,
      allowed,
    );
    expect(result).toEqual({
      ok: true,
      normalized: [
        { eventId: "e-1", response: "DECLINED", pax: 0, expectedVersion: null },
      ],
    });
  });
});

describe("rsvp submission", () => {
  it("creates an answer, appends history, and writes audit plus outbox", async () => {
    const c = client();
    const result = await repository.submit(c, SUBMIT);

    expect(result).toEqual({
      kind: "success",
      answers: [
        { eventId: "e-1", response: "ATTENDING", pax: 2, optimisticVersion: 1 },
      ],
    });

    expect(c.rsvp.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t-1",
        householdId: "hh-1",
        eventId: "e-1",
        response: "ATTENDING",
        pax: 2,
        optimisticVersion: 1,
        respondedAt: NOW,
      },
      select: expect.anything(),
    });
    expect(c.rsvpHistory.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t-1",
        rsvpId: "r-1",
        previousResponse: null,
        newResponse: "ATTENDING",
        previousPax: null,
        newPax: 2,
        actorType: "GUEST",
        changedAt: NOW,
      },
    });
    expect(c.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(c.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it("takes tenant scope from the household rather than from the caller", async () => {
    const c = client();
    // The caller supplies only a household id; the tenant is read from the row.
    await repository.submit(c, SUBMIT);

    const eventArgs = calls<{
      where: { tenantId: string; weddingId: string };
    }>(c.weddingEvent.findMany)[0]?.[0];
    expect(eventArgs?.where).toEqual({ tenantId: "t-1", weddingId: "w-1" });
  });

  it("treats a replayed idempotency key as a no-op", async () => {
    const c = client({
      outboxEvent: { findUnique: vi.fn().mockResolvedValue({ id: "key-1" }) },
      rsvp: {
        findMany: vi
          .fn()
          .mockResolvedValue([rsvpRow({ optimisticVersion: 2 })]),
      },
    });

    const result = await repository.submit(c, SUBMIT);
    expect(result).toEqual({
      kind: "replayed",
      answers: [
        { eventId: "e-1", response: "ATTENDING", pax: 2, optimisticVersion: 2 },
      ],
    });
    expect(c.outboxEvent.create).not.toHaveBeenCalled();
    expect(c.rsvp.create).not.toHaveBeenCalled();
    expect(c.rsvpHistory.create).not.toHaveBeenCalled();
  });

  it("reports a stale version when the client expects none but a row exists", async () => {
    const c = client({
      rsvp: {
        findFirst: vi.fn().mockResolvedValue(rsvpRow({ optimisticVersion: 3 })),
      },
    });

    await expect(repository.submit(c, SUBMIT)).resolves.toEqual({
      kind: "stale",
      eventId: "e-1",
    });
    expect(c.rsvp.create).not.toHaveBeenCalled();
  });

  it("reports a stale version when the version moved under the client", async () => {
    const c = client({
      rsvp: {
        findFirst: vi.fn().mockResolvedValue(rsvpRow({ optimisticVersion: 5 })),
      },
    });

    await expect(
      repository.submit(c, {
        ...SUBMIT,
        updates: [
          { eventId: "e-1", response: "DECLINED", pax: 0, expectedVersion: 2 },
        ],
      }),
    ).resolves.toEqual({ kind: "stale", eventId: "e-1" });
  });

  it("reports a stale version when the guarded update matches no row", async () => {
    const c = client({
      rsvp: {
        findFirst: vi.fn().mockResolvedValue(rsvpRow({ optimisticVersion: 2 })),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });

    await expect(
      repository.submit(c, {
        ...SUBMIT,
        updates: [
          { eventId: "e-1", response: "TENTATIVE", pax: 0, expectedVersion: 2 },
        ],
      }),
    ).resolves.toEqual({ kind: "stale", eventId: "e-1" });
    expect(c.rsvpHistory.create).not.toHaveBeenCalled();
  });

  it("keeps the version in the update predicate", async () => {
    const c = client({
      rsvp: {
        findFirst: vi.fn().mockResolvedValue(rsvpRow({ optimisticVersion: 2 })),
      },
    });

    await repository.submit(c, {
      ...SUBMIT,
      updates: [
        { eventId: "e-1", response: "TENTATIVE", pax: 0, expectedVersion: 2 },
      ],
    });

    expect(c.rsvp.updateMany).toHaveBeenCalledWith({
      where: { id: "r-1", householdId: "hh-1", optimisticVersion: 2 },
      data: {
        response: "TENTATIVE",
        pax: 0,
        optimisticVersion: 3,
        respondedAt: NOW,
      },
    });
  });

  it("refuses a household whose link is no longer active", async () => {
    const c = client({
      guestHousehold: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ ...HOUSEHOLD, status: "DISABLED" }),
      },
    });

    await expect(repository.submit(c, SUBMIT)).resolves.toEqual({
      kind: "not-found",
    });
    expect(c.rsvp.create).not.toHaveBeenCalled();
  });

  it("reports an unknown household as not found", async () => {
    const c = client({
      guestHousehold: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    await expect(repository.submit(c, SUBMIT)).resolves.toEqual({
      kind: "not-found",
    });
  });

  it("rejects an event outside the household's own wedding", async () => {
    const c = client({
      weddingEvent: { findMany: vi.fn().mockResolvedValue([{ id: "e-2" }]) },
    });

    await expect(repository.submit(c, SUBMIT)).resolves.toEqual({
      kind: "invalid",
      reason: "UNKNOWN_EVENT",
    });
    expect(c.outboxEvent.create).not.toHaveBeenCalled();
  });

  it("re-reads the allowance instead of trusting the client", async () => {
    const c = client({
      guestHousehold: {
        findFirst: vi.fn().mockResolvedValue({ ...HOUSEHOLD, maximumPax: 1 }),
      },
    });

    await expect(repository.submit(c, SUBMIT)).resolves.toEqual({
      kind: "invalid",
      reason: "PAX_OUT_OF_RANGE",
    });
  });

  it("records no free text, token, or contact data in the audit row", async () => {
    const c = client();
    await repository.submit(c, SUBMIT);

    const args = calls<{ data: Record<string, unknown> }>(
      c.auditEvent.create,
    )[0]?.[0];
    expect(args?.data.action).toBe("RSVP_SUBMITTED");
    expect(args?.data.actorType).toBe("GUEST");
    expect(args?.data.correlationId).toBe(SUBMIT.idempotencyKey);
    expect(Object.keys((args?.data.metadata ?? {}) as object).sort()).toEqual([
      "eventCount",
      "responses",
    ]);
  });
});

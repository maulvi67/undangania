import { describe, expect, it, vi } from "vitest";
import {
  PrismaOversightRepository,
  tallyRsvp,
  toModerationStatus,
  toResponseValue,
  type OversightClient,
} from "./oversight";

const NOW = new Date("2026-09-16T10:00:00.000Z");

function rsvpRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "r-1",
    householdId: "hh-1",
    eventId: "e-1",
    response: "ATTENDING",
    pax: 2,
    optimisticVersion: 1,
    respondedAt: NOW,
    household: { displayName: "Keluarga Rahman", maximumPax: 4 },
    event: { title: "Akad Nikah", startsAt: NOW },
    ...overrides,
  };
}

function client(overrides: Record<string, unknown> = {}): OversightClient {
  return {
    weddingEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      ...((overrides.weddingEvent as object) ?? {}),
    },
    guestHousehold: {
      count: vi.fn().mockResolvedValue(0),
      ...((overrides.guestHousehold as object) ?? {}),
    },
    guest: {
      count: vi.fn().mockResolvedValue(0),
      ...((overrides.guest as object) ?? {}),
    },
    rsvp: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      ...((overrides.rsvp as object) ?? {}),
    },
    rsvpHistory: {
      create: vi.fn().mockResolvedValue({ id: "history-1" }),
      ...((overrides.rsvpHistory as object) ?? {}),
    },
    auditEvent: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      ...((overrides.auditEvent as object) ?? {}),
    },
    guestbookMessage: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      ...((overrides.guestbookMessage as object) ?? {}),
    },
  };
}

const SCOPE = { tenantId: "t-1", weddingId: "w-1" };

describe("toResponseValue", () => {
  it("keeps the two explicit answers and defaults the rest to tentative", () => {
    expect(toResponseValue("ATTENDING")).toBe("ATTENDING");
    expect(toResponseValue("DECLINED")).toBe("DECLINED");
    expect(toResponseValue("TENTATIVE")).toBe("TENTATIVE");
    expect(toResponseValue("SOMETHING_ELSE")).toBe("TENTATIVE");
  });
});

describe("toModerationStatus", () => {
  it("defaults an unrecognized status to pending", () => {
    // Defaulting to anything else would show an unreviewed greeting as approved.
    expect(toModerationStatus("APPROVED")).toBe("APPROVED");
    expect(toModerationStatus("REJECTED")).toBe("REJECTED");
    expect(toModerationStatus("HIDDEN")).toBe("HIDDEN");
    expect(toModerationStatus("DELETED")).toBe("DELETED");
    expect(toModerationStatus("READY")).toBe("PENDING");
    expect(toModerationStatus("")).toBe("PENDING");
  });
});

describe("tallyRsvp", () => {
  it("counts each answer and sums only attending head-count", () => {
    expect(
      tallyRsvp([
        { response: "ATTENDING", pax: 2 },
        { response: "ATTENDING", pax: 3 },
        { response: "DECLINED", pax: 0 },
        { response: "TENTATIVE", pax: 0 },
      ]),
    ).toEqual({
      attending: 2,
      declined: 1,
      tentative: 1,
      attendingPax: 5,
    });
  });

  it("does not let a malformed declined row inflate the head-count", () => {
    // A declined answer is normalized to zero on write, but summing blindly would
    // make the figure the couple plans catering against wrong.
    expect(tallyRsvp([{ response: "DECLINED", pax: 4 }]).attendingPax).toBe(0);
  });
});

describe("PrismaOversightRepository.loadRsvp", () => {
  it("scopes RSVP and guest reads through the household", async () => {
    const c = client();
    await new PrismaOversightRepository(c).loadRsvp(SCOPE);

    const rsvpArgs = (
      c.rsvp.findMany as unknown as {
        mock: { calls: readonly (readonly [{ where: unknown }])[] };
      }
    ).mock.calls[0]?.[0];
    expect(rsvpArgs?.where).toEqual({
      tenantId: "t-1",
      household: { tenantId: "t-1", weddingId: "w-1" },
    });

    const guestArgs = (
      c.guest.count as unknown as {
        mock: { calls: readonly (readonly [{ where: unknown }])[] };
      }
    ).mock.calls[0]?.[0];
    expect(guestArgs?.where).toEqual({
      tenantId: "t-1",
      household: { tenantId: "t-1", weddingId: "w-1" },
    });
  });

  it("counts distinct households rather than answer rows", async () => {
    const c = client({
      rsvp: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            rsvpRow({ id: "r-1", eventId: "e-1", householdId: "hh-1" }),
            rsvpRow({ id: "r-2", eventId: "e-2", householdId: "hh-1" }),
            rsvpRow({ id: "r-3", eventId: "e-1", householdId: "hh-2" }),
          ]),
      },
    });

    const overview = await new PrismaOversightRepository(c).loadRsvp(SCOPE);
    // One family answering two events is still one family.
    expect(overview.answeredHouseholds).toBe(2);
    expect(overview.totals.attending).toBe(3);
  });

  it("maps the household and event labels the page renders", async () => {
    const c = client({
      rsvp: { findMany: vi.fn().mockResolvedValue([rsvpRow()]) },
    });

    const overview = await new PrismaOversightRepository(c).loadRsvp(SCOPE);
    expect(overview.rows[0]).toMatchObject({
      householdName: "Keluarga Rahman",
      eventTitle: "Akad Nikah",
      response: "ATTENDING",
      pax: 2,
    });
  });
});

describe("PrismaOversightRepository.loadGuestbook", () => {
  it("includes pending messages and counts them", async () => {
    const c = client({
      guestbookMessage: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "m-1",
            householdId: "hh-1",
            displayName: "Keluarga Rahman",
            message: "Selamat menempuh hidup baru.",
            moderationStatus: "PENDING",
            submittedAt: NOW,
          },
          {
            id: "m-2",
            householdId: "hh-2",
            displayName: "Keluarga Wulandari",
            message: "Bahagia selalu.",
            moderationStatus: "APPROVED",
            submittedAt: NOW,
          },
        ]),
      },
    });

    const overview = await new PrismaOversightRepository(c).loadGuestbook(
      SCOPE,
    );
    expect(overview.rows).toHaveLength(2);
    expect(overview.pendingCount).toBe(1);
  });
});

describe("PrismaOversightRepository.moderate", () => {
  it("scopes the decision by tenant and wedding", async () => {
    const c = client();
    await new PrismaOversightRepository(c).moderate(SCOPE, "m-1", "APPROVED");

    const args = (
      c.guestbookMessage.updateMany as unknown as {
        mock: {
          calls: readonly (readonly [{ where: unknown; data: unknown }])[];
        };
      }
    ).mock.calls[0]?.[0];
    expect(args?.where).toEqual({
      id: "m-1",
      tenantId: "t-1",
      weddingId: "w-1",
    });
    expect(args?.data).toEqual({ moderationStatus: "APPROVED" });
  });

  it("reports no match rather than throwing", async () => {
    const c = client({
      guestbookMessage: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    });

    await expect(
      new PrismaOversightRepository(c).moderate(SCOPE, "m-other", "APPROVED"),
    ).resolves.toBe(false);
  });
});

describe("PrismaOversightRepository.overrideRsvp", () => {
  it("records the previous answer, history, and audit", async () => {
    const update = vi.fn().mockResolvedValue({ count: 1 });
    const historyCreate = vi.fn().mockResolvedValue({ id: "history-1" });
    const auditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
    const c = client({
      rsvp: {
        findFirst: vi.fn().mockResolvedValue(rsvpRow()),
        updateMany: update,
      },
      rsvpHistory: { create: historyCreate },
      auditEvent: { create: auditCreate },
    });

    await expect(
      new PrismaOversightRepository(c).overrideRsvp(SCOPE, {
        rsvpId: "r-1",
        response: "DECLINED",
        pax: 2,
        actorId: "user-1",
        correlationId: "corr-1",
      }),
    ).resolves.toEqual({ kind: "ok" });

    expect(update).toHaveBeenCalledWith({
      where: { id: "r-1", tenantId: "t-1", optimisticVersion: 1 },
      data: {
        response: "DECLINED",
        pax: 0,
        optimisticVersion: { increment: 1 },
      },
    });
    expect(historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousResponse: "ATTENDING",
        newResponse: "DECLINED",
        previousPax: 2,
        newPax: 0,
      }),
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "RSVP_OVERRIDDEN",
        targetId: "r-1",
      }),
    });
  });

  it("refuses a head-count above the household allowance", async () => {
    const update = vi.fn();
    const c = client({
      rsvp: {
        findFirst: vi.fn().mockResolvedValue(rsvpRow()),
        updateMany: update,
      },
    });

    await expect(
      new PrismaOversightRepository(c).overrideRsvp(SCOPE, {
        rsvpId: "r-1",
        response: "ATTENDING",
        pax: 9,
        actorId: "user-1",
        correlationId: "corr-1",
      }),
    ).resolves.toEqual({ kind: "invalid" });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("PrismaOversightRepository.exportRsvp", () => {
  it("returns the tenant's answers and records the export", async () => {
    const auditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
    const c = client({
      rsvp: { findMany: vi.fn().mockResolvedValue([rsvpRow()]) },
      auditEvent: { create: auditCreate },
    });

    const rows = await new PrismaOversightRepository(c).exportRsvp(SCOPE, {
      actorId: "user-1",
      correlationId: "corr-1",
    });

    expect(rows).toEqual([
      {
        householdName: "Keluarga Rahman",
        eventTitle: "Akad Nikah",
        response: "ATTENDING",
        pax: 2,
        respondedAt: NOW,
      },
    ]);
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "RSVP_EXPORTED" }),
    });
  });
});

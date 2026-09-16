import { describe, expect, it, vi } from "vitest";
import {
  PrismaDashboardRepository,
  coupleNames,
  toContractYmd,
  toRsvpCounts,
  type DashboardClient,
} from "./dashboard-aggregate";

const WEDDING = {
  id: "w-1",
  displayName: "Pernikahan kami",
  partner1Name: "Rani",
  partner2Name: "Bima",
  weddingDate: new Date("2026-11-01T00:00:00.000Z"),
  timezone: "Asia/Jakarta",
  city: "Bandung",
};

function client(overrides: Record<string, unknown> = {}): DashboardClient {
  return {
    wedding: {
      findFirst: vi.fn().mockResolvedValue(WEDDING),
      ...((overrides.wedding as object) ?? {}),
    },
    invitation: {
      findFirst: vi.fn().mockResolvedValue(null),
      ...((overrides.invitation as object) ?? {}),
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
      ...((overrides.rsvp as object) ?? {}),
    },
    payment: {
      findFirst: vi.fn().mockResolvedValue(null),
      ...((overrides.payment as object) ?? {}),
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

const SCOPE = { tenantId: "t-1", weddingId: "w-1" };

describe("toContractYmd", () => {
  it("reads the UTC date prefix so the day does not shift", () => {
    // A `@db.Date` column arrives as UTC midnight; reading it with local accessors
    // in any timezone behind UTC would report the previous day.
    expect(toContractYmd(new Date("2026-11-01T00:00:00.000Z"))).toBe(
      "2026-11-01",
    );
    expect(toContractYmd(null)).toBe(null);
  });
});

describe("coupleNames", () => {
  it("joins both names, tolerates one, and reports neither as null", () => {
    expect(coupleNames({ partner1Name: "Rani", partner2Name: "Bima" })).toBe(
      "Rani & Bima",
    );
    expect(coupleNames({ partner1Name: "Rani", partner2Name: null })).toBe(
      "Rani",
    );
    expect(coupleNames({ partner1Name: null, partner2Name: "Bima" })).toBe(
      "Bima",
    );
    expect(coupleNames({ partner1Name: null, partner2Name: null })).toBe(null);
    expect(coupleNames({ partner1Name: "  ", partner2Name: "  " })).toBe(null);
  });
});

describe("toRsvpCounts", () => {
  it("tallies each response and derives pending", () => {
    expect(
      toRsvpCounts(
        [
          { response: "ATTENDING" },
          { response: "ATTENDING" },
          { response: "DECLINED" },
          { response: "TENTATIVE" },
        ],
        10,
      ),
    ).toEqual({
      invited: 10,
      attending: 2,
      declined: 1,
      tentative: 1,
      pending: 6,
    });
  });

  it("clamps pending at zero when answers outnumber the guest list", () => {
    // The guest list can shrink after answers arrive, and a negative "pending"
    // would render as a nonsense figure on the dashboard.
    expect(toRsvpCounts([{ response: "ATTENDING" }], 0).pending).toBe(0);
  });

  it("ignores an unrecognized response value", () => {
    expect(toRsvpCounts([{ response: "SOMETHING_ELSE" }], 5)).toEqual({
      invited: 5,
      attending: 0,
      declined: 0,
      tentative: 0,
      pending: 5,
    });
  });
});

describe("PrismaDashboardRepository.load", () => {
  it("assembles every section from the scoped reads", async () => {
    const c = client({
      invitation: {
        findFirst: vi.fn().mockResolvedValue({
          id: "inv-1",
          status: "PUBLISHED",
          template: { name: "Seruni" },
          publications: [{ publishedAt: new Date("2026-01-15T08:00:00.000Z") }],
        }),
      },
      guestHousehold: { count: vi.fn().mockResolvedValue(12) },
      guest: { count: vi.fn().mockResolvedValue(42) },
      rsvp: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { response: "ATTENDING" },
            { response: "ATTENDING" },
            { response: "DECLINED" },
          ]),
      },
      payment: { findFirst: vi.fn().mockResolvedValue({ status: "PAID" }) },
    });

    await expect(new PrismaDashboardRepository(c).load(SCOPE)).resolves.toEqual(
      {
        workspace: {
          coupleNames: "Rani & Bima",
          weddingDate: "2026-11-01",
          timezone: "Asia/Jakarta",
          city: "Bandung",
        },
        invitation: {
          status: "PUBLISHED",
          templateName: "Seruni",
          publishedAt: new Date("2026-01-15T08:00:00.000Z"),
        },
        payment: { paid: true, pending: false },
        guests: { guestCount: 42, householdCount: 12 },
        rsvp: {
          invited: 42,
          attending: 2,
          declined: 1,
          tentative: 0,
          pending: 39,
        },
      },
    );
  });

  it("scopes every read to the tenant and wedding", async () => {
    const c = client();
    await new PrismaDashboardRepository(c).load(SCOPE);

    expect(c.wedding.findFirst).toHaveBeenCalledWith({
      where: { id: "w-1", tenantId: "t-1" },
      select: expect.anything(),
    });
    const guestWhere = calls<{ where: Record<string, unknown> }>(
      c.guest.count,
    )[0]?.[0];
    expect(guestWhere?.where).toEqual({
      tenantId: "t-1",
      household: { tenantId: "t-1", weddingId: "w-1" },
    });
    const rsvpWhere = calls<{ where: Record<string, unknown> }>(
      c.rsvp.findMany,
    )[0]?.[0];
    expect(rsvpWhere?.where).toEqual({
      tenantId: "t-1",
      household: { tenantId: "t-1", weddingId: "w-1" },
    });
  });

  it("reads publication state, not the invitation's own status field", async () => {
    const c = client({
      invitation: {
        findFirst: vi.fn().mockResolvedValue({
          id: "inv-1",
          // Status says PUBLISHED but no active publication row exists, which is
          // what a paused or rolled-back snapshot looks like.
          status: "PUBLISHED",
          template: { name: "Seruni" },
          publications: [],
        }),
      },
    });

    const aggregate = await new PrismaDashboardRepository(c).load(SCOPE);
    expect(aggregate?.invitation?.publishedAt).toBe(null);

    const args = calls<{ select: { publications: { where: unknown } } }>(
      c.invitation.findFirst,
    )[0]?.[0];
    // `active: true` is what makes the row describe reality; without it an older
    // superseded publication would be read as the current one.
    expect(args?.select.publications.where).toEqual({ active: true });
  });

  it("reads the newest payment so an expired attempt cannot mask a success", async () => {
    const c = client();
    await new PrismaDashboardRepository(c).load(SCOPE);

    const args = calls<{ orderBy: unknown }>(c.payment.findFirst)[0]?.[0];
    expect(args?.orderBy).toEqual({ createdAt: "desc" });
  });

  it("reports a missing workspace as null", async () => {
    const c = client({
      wedding: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    await expect(new PrismaDashboardRepository(c).load(SCOPE)).resolves.toBe(
      null,
    );
  });

  it("degrades one failed section without failing the page", async () => {
    const c = client({
      rsvp: { findMany: vi.fn().mockRejectedValue(new Error("unavailable")) },
      guest: { count: vi.fn().mockResolvedValue(5) },
      guestHousehold: { count: vi.fn().mockResolvedValue(2) },
    });

    const aggregate = await new PrismaDashboardRepository(c).load(SCOPE);
    // The page still renders: only the RSVP panel falls back to its unavailable
    // state, which is what the contract's per-section union is for.
    expect(aggregate?.rsvp).toBe(null);
    expect(aggregate?.guests).toEqual({ guestCount: 5, householdCount: 2 });
    expect(aggregate?.workspace.coupleNames).toBe("Rani & Bima");
  });

  it("drops RSVP rather than reporting it without a guest count", async () => {
    const c = client({
      guest: { count: vi.fn().mockRejectedValue(new Error("unavailable")) },
    });

    const aggregate = await new PrismaDashboardRepository(c).load(SCOPE);
    // `invited` comes from the guest count, so a summary without it would show a
    // zero invitee figure that contradicts the guests panel.
    expect(aggregate?.rsvp).toBe(null);
    expect(aggregate?.guests).toBe(null);
  });

  it("reports a payment that is started but not confirmed as pending", async () => {
    const c = client({
      payment: { findFirst: vi.fn().mockResolvedValue({ status: "CREATED" }) },
    });

    const aggregate = await new PrismaDashboardRepository(c).load(SCOPE);
    expect(aggregate?.payment).toEqual({ paid: false, pending: true });
  });
});

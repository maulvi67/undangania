import { describe, expect, it } from "vitest";
import {
  activeUntilDate,
  deriveDashboardState,
  dashboardAggregateSchema,
} from "./contract";
import type { DashboardAggregate } from "./contract";

/**
 * The loader is not exercised here — it resolves a session and reaches the
 * database. What this covers is the mapping rule the loader relies on: a section
 * the loader marks `unavailable` must not stop the rest of the page from rendering,
 * which is the whole reason the contract has a per-section union.
 */
function aggregate(
  overrides: Partial<DashboardAggregate> = {},
): DashboardAggregate {
  return {
    role: "OWNER",
    workspace: {
      coupleNames: "Rani & Bima",
      weddingDate: "2026-11-01",
      timezone: "Asia/Jakarta",
      city: "Bandung",
    },
    invitation: {
      status: "ok",
      data: {
        status: "PUBLISHED",
        slug: "rani-bima-1a2b3c4d",
        templateName: "Seruni",
        contentComplete: true,
        publishedAt: "2026-01-15T08:00:00.000Z",
        publicUrl: null,
        activeUntil: activeUntilDate("2026-11-01"),
      },
    },
    payment: { status: "ok", data: { state: "OK" } },
    guests: { status: "ok", data: { guestCount: 42, householdCount: 12 } },
    rsvp: {
      status: "ok",
      data: {
        invited: 42,
        attending: 18,
        declined: 4,
        tentative: 3,
        pending: 17,
      },
    },
    ...overrides,
  };
}

describe("dashboard aggregate contract", () => {
  it("accepts an aggregate the loader produces", () => {
    expect(dashboardAggregateSchema.safeParse(aggregate()).success).toBe(true);
  });

  it("accepts an aggregate with individually unavailable sections", () => {
    const parsed = dashboardAggregateSchema.safeParse(
      aggregate({
        invitation: { status: "unavailable" },
        payment: { status: "unavailable" },
        guests: { status: "unavailable" },
        rsvp: { status: "unavailable" },
      }),
    );
    expect(parsed.success).toBe(true);
  });

  it("rejects a negative count", () => {
    expect(
      dashboardAggregateSchema.safeParse(
        aggregate({
          guests: { status: "ok", data: { guestCount: -1, householdCount: 0 } },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects a lifecycle value outside the union", () => {
    expect(
      dashboardAggregateSchema.safeParse(
        aggregate({
          invitation: {
            status: "ok",
            data: {
              // `ARCHIVED` is a stored status the dashboard does not carry; the
              // loader maps it to EXPIRED before this point.
              status: "ARCHIVED" as never,
              slug: "archived-invitation",
              templateName: null,
              contentComplete: false,
              publishedAt: null,
              publicUrl: null,
              activeUntil: null,
            },
          },
        }),
      ).success,
    ).toBe(false);
  });
});

describe("deriveDashboardState", () => {
  it("reports a fresh workspace as NEW", () => {
    expect(
      deriveDashboardState(
        aggregate({
          workspace: {
            coupleNames: null,
            weddingDate: null,
            timezone: null,
            city: null,
          },
        }),
        "2026-09-16",
      ),
    ).toBe("NEW");
  });

  it("prefers a pending payment over the invitation lifecycle", () => {
    // An unpublished-but-paid-for invitation must not look ready to send.
    expect(
      deriveDashboardState(
        aggregate({ payment: { status: "ok", data: { state: "PENDING" } } }),
        "2026-09-16",
      ),
    ).toBe("PAYMENT_PENDING");
  });

  it("reports an expired active period as EXPIRED", () => {
    // The active period ends 30 days after the event, so a day past that is expired
    // while the final day itself is still merely expiring soon.
    expect(activeUntilDate("2026-11-01")).toBe("2026-12-01");
    expect(deriveDashboardState(aggregate(), "2026-12-01")).toBe("EXPIRING");
    expect(deriveDashboardState(aggregate(), "2026-12-02")).toBe("EXPIRED");
  });

  it("reports a paused invitation as PAUSED", () => {
    expect(
      deriveDashboardState(
        aggregate({
          invitation: {
            status: "ok",
            data: {
              status: "PAUSED",
              slug: "rani-bima-1a2b3c4d",
              templateName: "Seruni",
              contentComplete: true,
              publishedAt: "2026-01-15T08:00:00.000Z",
              publicUrl: null,
              activeUntil: activeUntilDate("2026-11-01"),
            },
          },
        }),
        "2026-09-16",
      ),
    ).toBe("PAUSED");
  });

  it("still derives a state when the invitation section is unavailable", () => {
    // The page has to say something useful even with one panel missing.
    expect(
      deriveDashboardState(
        aggregate({ invitation: { status: "unavailable" } }),
        "2026-09-16",
      ),
    ).toBe("DRAFT");
  });
});

import { describe, expect, it } from "vitest";
import {
  DASHBOARD_STATES,
  addDaysYmd,
  activePeriodRemaining,
  activeUntilDate,
  completionCount,
  completionItems,
  countdownText,
  dashboardAggregateSchema,
  deriveDashboardState,
  formatActivePeriod,
  nextActions,
  type DashboardAggregate,
} from "./contract";
import {
  getDashboardFixtureNames,
  loadDashboard,
  parseDashboardFixture,
} from "./stub-transport";

const TODAY = "2026-03-21";

function aggregate(
  overrides: Partial<DashboardAggregate> = {},
): DashboardAggregate {
  return {
    role: "OWNER",
    workspace: {
      coupleNames: "Rani & Bima",
      weddingDate: "2026-06-16",
      timezone: "Asia/Jakarta",
      city: "Bandung",
    },
    invitation: {
      status: "ok",
      data: {
        status: "DRAFT",
        slug: "contoh-undangan",
        templateName: "Seruni",
        contentComplete: false,
        publishedAt: null,
        publicUrl: null,
        activeUntil: null,
      },
    },
    payment: { status: "ok", data: { state: "OK" } },
    guests: { status: "ok", data: { guestCount: 0, householdCount: 0 } },
    rsvp: {
      status: "ok",
      data: { invited: 0, attending: 0, declined: 0, tentative: 0, pending: 0 },
    },
    ...overrides,
  };
}

function published(
  eventDate: string,
  status: "PUBLISHED" | "PAUSED" | "EXPIRED" = "PUBLISHED",
) {
  return aggregate({
    workspace: {
      coupleNames: "Rani & Bima",
      weddingDate: eventDate,
      timezone: "Asia/Jakarta",
      city: "Bandung",
    },
    invitation: {
      status: "ok",
      data: {
        status,
        slug: "contoh-undangan",
        templateName: "Seruni",
        contentComplete: true,
        publishedAt: "2026-01-15T08:00:00.000Z",
        publicUrl: "/undangan/contoh",
        activeUntil: activeUntilDate(eventDate),
      },
    },
  });
}

describe("dashboard date rules", () => {
  it("keeps active period at event date plus 30 days", () => {
    expect(activeUntilDate("2026-03-21")).toBe("2026-04-20");
    expect(activePeriodRemaining("2026-03-21", TODAY)).toBe(30);
    expect(formatActivePeriod("2026-03-21", TODAY)).toContain("sisa 30 hari");
  });

  it("marks the 14-day boundary as expiring and the next day as normal", () => {
    const eventDate = "2026-03-21";
    const activeUntil = "2026-04-20";
    expect(activePeriodRemaining(eventDate, "2026-04-06")).toBe(14);
    expect(deriveDashboardState(published(eventDate), "2026-04-06")).toBe(
      "EXPIRING",
    );
    expect(deriveDashboardState(published(eventDate), "2026-04-05")).toBe(
      "PUBLISHED",
    );
    expect(
      deriveDashboardState(
        published(eventDate),
        addDaysYmd(activeUntil, 1) ?? "",
      ),
    ).toBe("EXPIRED");
  });
});

describe("countdownText", () => {
  it("supports future, today, past, and undecided dates", () => {
    expect(countdownText("2026-03-24", "Asia/Jakarta", TODAY)).toMatchObject({
      kind: "future",
      days: 3,
    });
    expect(countdownText(TODAY, "Asia/Jakarta", TODAY).kind).toBe("today");
    expect(countdownText("2026-03-20", "Asia/Jakarta", TODAY).kind).toBe(
      "past",
    );
    expect(countdownText(null, "Asia/Jakarta", TODAY)).toEqual({
      kind: "undecided",
      label: "Tanggal pernikahan belum ditentukan.",
    });
  });

  it("uses the same wall-date result for Indonesian timezones", () => {
    const makassar = countdownText("2026-03-24", "Asia/Makassar", TODAY);
    const jayapura = countdownText("2026-03-24", "Asia/Jayapura", TODAY);
    expect(makassar.kind).toBe("future");
    expect(jayapura.kind).toBe("future");
    if (makassar.kind === "future" && jayapura.kind === "future") {
      expect(makassar.days).toBe(3);
      expect(jayapura.days).toBe(3);
    }
  });
});

describe("dashboard state and actions", () => {
  it("derives all lifecycle states and the payment overlay", () => {
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
        TODAY,
      ),
    ).toBe("NEW");
    expect(deriveDashboardState(aggregate(), TODAY)).toBe("DRAFT");
    const ready = aggregate({
      invitation: {
        status: "ok",
        data: {
          status: "READY",
          slug: "contoh-undangan",
          templateName: "Seruni",
          contentComplete: true,
          publishedAt: null,
          publicUrl: null,
          activeUntil: null,
        },
      },
    });
    expect(deriveDashboardState(ready, TODAY)).toBe("READY");
    expect(deriveDashboardState(published("2026-06-16"), TODAY)).toBe(
      "PUBLISHED",
    );
    expect(deriveDashboardState(published("2026-06-16", "PAUSED"), TODAY)).toBe(
      "PAUSED",
    );
    expect(deriveDashboardState(published("2026-03-21"), "2026-04-06")).toBe(
      "EXPIRING",
    );
    expect(deriveDashboardState(published("2026-03-21"), "2026-04-21")).toBe(
      "EXPIRED",
    );
    expect(
      deriveDashboardState(
        aggregate({ payment: { status: "ok", data: { state: "PENDING" } } }),
        TODAY,
      ),
    ).toBe("PAYMENT_PENDING");
  });

  it("puts payment first, limits actions to three, and hides editor billing CTAs", () => {
    const owner = aggregate({
      payment: { status: "ok", data: { state: "PENDING" } },
      invitation: {
        status: "ok",
        data: {
          status: "READY",
          slug: "contoh-undangan",
          templateName: "Seruni",
          contentComplete: true,
          publishedAt: null,
          publicUrl: null,
          activeUntil: null,
        },
      },
    });
    expect(nextActions(owner, TODAY).map((item) => item.id)).toEqual([
      "payment",
    ]);

    const editor = { ...owner, role: "EDITOR" as const };
    expect(nextActions(editor, TODAY)).toEqual([]);

    const active = published("2026-06-16");
    const actions = nextActions(active, TODAY);
    expect(actions[0]?.id).toBe("view-invitation");
    expect(actions.length).toBeLessThanOrEqual(3);

    const expired = nextActions(published("2026-03-21"), "2026-04-21");
    expect(expired.map((item) => item.id)).toEqual(["orders", "templates"]);
  });
});

describe("completion and fixture transport", () => {
  it("exposes an explainable five-item completion calculation", () => {
    const items = completionItems(published("2026-06-16"));
    expect(items).toHaveLength(5);
    expect(completionCount(items).total).toBe(5);
    expect(items.find((item) => item.id === "design")?.done).toBe(true);
  });

  it("validates all approved fixtures and defaults invalid query values", async () => {
    expect(getDashboardFixtureNames()).toEqual(DASHBOARD_STATES);
    expect(parseDashboardFixture("not-a-state")).toBe("baru");
    expect(parseDashboardFixture(["aktif", "draf"])).toBe("aktif");
    for (const fixture of DASHBOARD_STATES.filter(
      (value) => value !== "belum-masuk" && value !== "gangguan",
    )) {
      const result = await loadDashboard(fixture);
      if (result.kind === "ok")
        expect(() => dashboardAggregateSchema.parse(result.data)).not.toThrow();
    }
    expect((await loadDashboard("belum-masuk")).kind).toBe("unauthenticated");
    expect((await loadDashboard("gangguan")).kind).toBe("unavailable");
  });
});

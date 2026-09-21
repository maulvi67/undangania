/**
 * ⚠️ SIMULATION ONLY — MVP-UI-007 dashboard provider.
 *
 * This module has no tenant, session, authorization, persistence, or payment
 * provider integration. It exists to exercise the approved dashboard states
 * until the real aggregate API is available. Remove the fixture switch when
 * the tenant-scoped provider is wired.
 */

import {
  DASHBOARD_STATES,
  addDaysYmd,
  activeUntilDate,
  dashboardAggregateSchema,
  type DashboardAggregate,
  type DashboardFixture,
  type DashboardLoad,
  isDashboardFixture,
} from "./contract";
import { todayYmd } from "../onboarding/contract";

const DEFAULT_FIXTURE: DashboardFixture = "baru";
const DEMO_PUBLISHED_AT = "2026-01-15T08:00:00.000Z";

function dateFromToday(days: number): string {
  const value = addDaysYmd(todayYmd("Asia/Jakarta"), days);
  if (value === null)
    throw new Error("Dashboard fixture date could not be created.");
  return value;
}

function baseAggregate(
  overrides: Partial<DashboardAggregate> = {},
): DashboardAggregate {
  return {
    role: "OWNER",
    workspace: {
      coupleNames: "Rani & Bima",
      weddingDate: dateFromToday(87),
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

function publishedAggregate(
  status: "PUBLISHED" | "PAUSED" | "EXPIRED" = "PUBLISHED",
  eventOffset = 87,
): DashboardAggregate {
  const weddingDate = dateFromToday(eventOffset);
  const activeUntil = activeUntilDate(weddingDate);
  return baseAggregate({
    workspace: {
      coupleNames: "Rani & Bima",
      weddingDate,
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
        publishedAt: DEMO_PUBLISHED_AT,
        publicUrl: "/undangan/contoh",
        activeUntil,
      },
    },
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
  });
}

function fixtureAggregate(fixture: DashboardFixture): DashboardAggregate {
  switch (fixture) {
    case "baru":
      return baseAggregate({
        workspace: {
          coupleNames: null,
          weddingDate: null,
          timezone: null,
          city: null,
        },
        invitation: {
          status: "ok",
          data: {
            status: "DRAFT",
            slug: "contoh-undangan",
            templateName: null,
            contentComplete: false,
            publishedAt: null,
            publicUrl: null,
            activeUntil: null,
          },
        },
      });
    case "draf":
      return baseAggregate();
    case "siap":
      return baseAggregate({
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
    case "aktif":
      return publishedAggregate("PUBLISHED");
    case "jeda":
      return publishedAggregate("PAUSED");
    case "segera-berakhir":
      return publishedAggregate("PUBLISHED", -16);
    case "berakhir":
      return publishedAggregate("EXPIRED", -45);
    case "menunggu-pembayaran":
      return baseAggregate({
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
        payment: { status: "ok", data: { state: "PENDING" } },
      });
    case "peninjau":
      return {
        ...fixtureAggregate("menunggu-pembayaran"),
        role: "EDITOR",
      };
    case "ringkasan-gagal":
      return {
        ...publishedAggregate("PUBLISHED"),
        rsvp: { status: "unavailable" },
      };
    case "belum-masuk":
    case "gangguan":
      throw new Error(`Fixture ${fixture} is a top-level dashboard state.`);
  }
}

export function parseDashboardFixture(
  value: string | string[] | undefined,
): DashboardFixture {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate !== undefined && isDashboardFixture(candidate)
    ? candidate
    : DEFAULT_FIXTURE;
}

export function getDashboardFixtureNames(): readonly DashboardFixture[] {
  return DASHBOARD_STATES;
}

export async function loadDashboard(
  fixture: DashboardFixture,
): Promise<DashboardLoad> {
  await new Promise<void>((resolve) => setTimeout(resolve, 80));
  if (fixture === "belum-masuk") return { kind: "unauthenticated" };
  if (fixture === "gangguan") return { kind: "unavailable" };
  const aggregate = dashboardAggregateSchema.parse(fixtureAggregate(fixture));
  return { kind: "ok", data: aggregate };
}

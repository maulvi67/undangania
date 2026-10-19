import { describe, expect, it } from "vitest";
import {
  ANALYTICS_REPORT_MAX_EVENTS,
  AnalyticsReportLimitError,
  analyticsDayKey,
  summarizeInvitationViewsByDay,
  type AnalyticsEventRecord,
} from "./index";

const TIME_ZONE = "Asia/Jakarta";

function view(
  occurredAt: string,
  name: AnalyticsEventRecord["name"] = "invitation_viewed",
): AnalyticsEventRecord {
  const instant = new Date(occurredAt);
  return {
    id: `event-${occurredAt}`,
    name,
    schemaVersion: 1,
    tenantIdHash: "a".repeat(64),
    actorHash: null,
    properties: { source: "direct", device: "mobile" },
    occurredAt: instant,
    acceptedAt: instant,
  };
}

describe("analyticsDayKey", () => {
  it("resolves the calendar day in the requested zone", () => {
    // 18:00 UTC is already the next day in Asia/Jakarta (UTC+7).
    expect(
      analyticsDayKey(new Date("2026-09-17T18:00:00.000Z"), TIME_ZONE),
    ).toBe("2026-09-18");
    expect(
      analyticsDayKey(new Date("2026-09-17T16:59:00.000Z"), TIME_ZONE),
    ).toBe("2026-09-17");
  });
});

describe("summarizeInvitationViewsByDay", () => {
  const dayKeys = ["2026-09-15", "2026-09-16", "2026-09-17"];

  it("counts views per day and zero-fills days without views", () => {
    const report = summarizeInvitationViewsByDay(
      [
        view("2026-09-15T03:00:00.000Z"),
        view("2026-09-17T02:00:00.000Z"),
        view("2026-09-17T15:00:00.000Z"),
      ],
      { dayKeys, timeZone: TIME_ZONE },
    );

    expect(report.days).toEqual([
      { date: "2026-09-15", views: 1 },
      { date: "2026-09-16", views: 0 },
      { date: "2026-09-17", views: 2 },
    ]);
    expect(report.total).toBe(3);
    expect(report.peak).toBe(2);
    expect(report.startDate).toBe("2026-09-15");
    expect(report.endDate).toBe("2026-09-17");
  });

  it("ignores events other than invitation_viewed", () => {
    const report = summarizeInvitationViewsByDay(
      [view("2026-09-17T02:00:00.000Z", "rsvp_submitted")],
      { dayKeys, timeZone: TIME_ZONE },
    );

    expect(report.total).toBe(0);
    expect(report.peak).toBe(0);
  });

  it("ignores events outside the requested window", () => {
    const report = summarizeInvitationViewsByDay(
      [view("2026-09-14T02:00:00.000Z"), view("2026-09-17T02:00:00.000Z")],
      { dayKeys, timeZone: TIME_ZONE },
    );

    expect(report.total).toBe(1);
    expect(report.days[0]).toEqual({ date: "2026-09-15", views: 0 });
  });

  it("returns a zero series for an empty window", () => {
    const report = summarizeInvitationViewsByDay([], {
      dayKeys: ["2026-09-17"],
      timeZone: TIME_ZONE,
    });

    expect(report).toEqual({
      startDate: "2026-09-17",
      endDate: "2026-09-17",
      total: 0,
      peak: 0,
      days: [{ date: "2026-09-17", views: 0 }],
    });
  });

  it("refuses a report above the bounded event limit", () => {
    const events = Array.from(
      { length: ANALYTICS_REPORT_MAX_EVENTS + 1 },
      (_unused, index) => view(`2026-09-17T02:00:0${index % 10}.000Z`),
    );

    expect(() =>
      summarizeInvitationViewsByDay(events, { dayKeys, timeZone: TIME_ZONE }),
    ).toThrow(AnalyticsReportLimitError);
  });
});

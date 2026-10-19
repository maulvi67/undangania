import { describe, expect, it } from "vitest";
import { VISIT_STATS_WINDOW_DAYS } from "./visit-stats-contract";
import { visitDayKeys, visitStatsRange } from "./visit-stats";

/**
 * The loader itself resolves a session and reaches the database, so it is not
 * exercised here. What is covered is the window it asks for: the chart's day
 * series must be a stable, zero-filled run of calendar days in the report zone,
 * and the UTC range must be wide enough to contain all of them.
 */

const JAKARTA = "Asia/Jakarta";

describe("visitDayKeys", () => {
  it("ends on the report zone's current day, oldest first", () => {
    // 18:30 UTC is already 2026-09-18 in Asia/Jakarta (UTC+7).
    expect(
      visitDayKeys(new Date("2026-09-17T18:30:00.000Z"), 3, JAKARTA),
    ).toEqual(["2026-09-16", "2026-09-17", "2026-09-18"]);
  });

  it("crosses a month boundary", () => {
    expect(
      visitDayKeys(new Date("2026-03-02T04:00:00.000Z"), 3, JAKARTA),
    ).toEqual(["2026-02-28", "2026-03-01", "2026-03-02"]);
  });

  it("returns exactly the requested number of days", () => {
    const keys = visitDayKeys(
      new Date("2026-09-17T04:00:00.000Z"),
      30,
      JAKARTA,
    );
    expect(keys).toHaveLength(30);
    expect(keys[29]).toBe("2026-09-17");
  });
});

describe("visitStatsRange", () => {
  it("pads the instant range so every day key is contained", () => {
    const now = new Date("2026-09-17T18:30:00.000Z");
    const { from, to } = visitStatsRange(now, VISIT_STATS_WINDOW_DAYS);

    // The oldest day key is 2026-08-19 in Jakarta; its local midnight is
    // 2026-08-18T17:00:00Z, so `from` must be at or before that instant.
    expect(from.getTime()).toBeLessThanOrEqual(
      new Date("2026-08-18T17:00:00.000Z").getTime(),
    );
    expect(to.getTime()).toBeGreaterThan(now.getTime());
  });
});

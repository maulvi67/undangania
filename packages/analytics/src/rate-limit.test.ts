import { describe, expect, it } from "vitest";
import {
  ANALYTICS_INGEST_RATE_LIMIT,
  ANALYTICS_REPORT_RATE_LIMIT,
  analyticsRateLimitPolicy,
  assertAnalyticsRateLimitDecision,
} from "./rate-limit";

describe("analytics rate-limit contract", () => {
  it("exposes separately bounded ingest and report policies", () => {
    expect(ANALYTICS_INGEST_RATE_LIMIT).toEqual({
      limit: 60,
      windowSeconds: 60,
    });
    expect(ANALYTICS_REPORT_RATE_LIMIT).toEqual({
      limit: 30,
      windowSeconds: 60,
    });
    expect(analyticsRateLimitPolicy("ingest")).toBe(
      ANALYTICS_INGEST_RATE_LIMIT,
    );
    expect(analyticsRateLimitPolicy("report")).toBe(
      ANALYTICS_REPORT_RATE_LIMIT,
    );
  });

  it("accepts a bounded decision", () => {
    expect(
      assertAnalyticsRateLimitDecision({
        allowed: true,
        remaining: 59,
        retryAfterSeconds: 0,
      }),
    ).toEqual({ allowed: true, remaining: 59, retryAfterSeconds: 0 });
  });

  it("rejects malformed provider decisions", () => {
    expect(() =>
      assertAnalyticsRateLimitDecision({
        allowed: false,
        remaining: -1,
        retryAfterSeconds: 10,
      }),
    ).toThrow();
    expect(() =>
      assertAnalyticsRateLimitDecision({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 1.5,
      }),
    ).toThrow();
  });
});

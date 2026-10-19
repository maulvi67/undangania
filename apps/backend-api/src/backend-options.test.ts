import { describe, expect, it } from "vitest";
import {
  backendOptionsFromEnv,
  createAnalyticsRateLimiterFromEnv,
} from "./backend-options";

const CONFIGURED = {
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token-value",
};

describe("createAnalyticsRateLimiterFromEnv", () => {
  it("returns undefined when Upstash is not configured", () => {
    expect(createAnalyticsRateLimiterFromEnv({})).toBeUndefined();
  });

  it("builds a limiter when the Upstash credentials are present", () => {
    expect(createAnalyticsRateLimiterFromEnv(CONFIGURED)).toBeDefined();
  });

  it("honours a valid key prefix", () => {
    expect(
      createAnalyticsRateLimiterFromEnv({
        ...CONFIGURED,
        ANALYTICS_RATE_LIMIT_PREFIX: "staging:",
      }),
    ).toBeDefined();
  });

  it("disables the limiter when the key prefix is invalid", () => {
    expect(
      createAnalyticsRateLimiterFromEnv({
        ...CONFIGURED,
        ANALYTICS_RATE_LIMIT_PREFIX: "bad prefix!",
      }),
    ).toBeUndefined();
  });
});

describe("backendOptionsFromEnv", () => {
  it("omits the limiter when unconfigured so the route keeps failing closed", () => {
    expect(backendOptionsFromEnv({})).toEqual({});
  });

  it("includes the limiter when configured", () => {
    expect(
      backendOptionsFromEnv(CONFIGURED).analyticsRateLimiter,
    ).toBeDefined();
  });
});

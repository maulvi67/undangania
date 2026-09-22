import { describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_REDIS_RATE_LIMIT_SCRIPT,
  RedisAnalyticsRateLimiter,
  type AnalyticsRedisEvalClient,
} from "./redis-rate-limit";
import { AnalyticsRateLimiterUnavailableError } from "./rate-limit";

const SCOPE = {
  tenantId: "tenant-secret",
  actorId: "actor-secret",
} as const;

function makeClient(result: unknown): {
  client: AnalyticsRedisEvalClient;
  evaluate: ReturnType<typeof vi.fn>;
} {
  const evaluate = vi.fn().mockResolvedValue(result);
  return { client: { evaluate }, evaluate };
}

describe("Redis analytics rate limiter", () => {
  it("uses one atomic sliding-window script and hashes scope key material", async () => {
    const { client, evaluate } = makeClient([1, "59", "0"]);
    const limiter = new RedisAnalyticsRateLimiter(client);

    await expect(
      limiter.consume({ scope: SCOPE, operation: "ingest", now: new Date() }),
    ).resolves.toEqual({
      allowed: true,
      remaining: 59,
      retryAfterSeconds: 0,
    });

    expect(evaluate).toHaveBeenCalledOnce();
    const [script, keys, args] = evaluate.mock.calls[0] as [
      string,
      readonly string[],
      readonly string[],
    ];
    expect(script).toBe(ANALYTICS_REDIS_RATE_LIMIT_SCRIPT);
    expect(script).toContain('redis.call("ZREMRANGEBYSCORE"');
    expect(script).toContain('redis.call("ZADD"');
    expect(script).toContain('redis.call("TIME"');
    expect(keys[0]).toMatch(/^wedding:analytics:rate:ingest:[0-9a-f]{64}$/u);
    expect(keys[0]).not.toContain(SCOPE.tenantId);
    expect(keys[0]).not.toContain(SCOPE.actorId);
    expect(args).toHaveLength(3);
    expect(args[0]).toBe("60");
    expect(args[1]).toBe("60");
  });

  it("maps a denied provider decision without weakening the retry window", async () => {
    const { client } = makeClient(["0", "0", "17"]);
    const limiter = new RedisAnalyticsRateLimiter(client, {
      keyPrefix: "staging:",
    });

    await expect(
      limiter.consume({ scope: SCOPE, operation: "report", now: new Date() }),
    ).resolves.toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 17,
    });
  });

  it("fails closed when Redis is unavailable or returns malformed data", async () => {
    const unavailable = new RedisAnalyticsRateLimiter({
      evaluate: vi.fn().mockRejectedValue(new Error("redis down")),
    });
    const malformed = new RedisAnalyticsRateLimiter({
      evaluate: vi.fn().mockResolvedValue([1, -1, 0]),
    });
    const outOfPolicy = new RedisAnalyticsRateLimiter({
      evaluate: vi.fn().mockResolvedValue([1, 61, 0]),
    });

    await expect(
      unavailable.consume({
        scope: SCOPE,
        operation: "ingest",
        now: new Date(),
      }),
    ).rejects.toBeInstanceOf(AnalyticsRateLimiterUnavailableError);
    await expect(
      malformed.consume({
        scope: SCOPE,
        operation: "ingest",
        now: new Date(),
      }),
    ).rejects.toBeInstanceOf(AnalyticsRateLimiterUnavailableError);
    await expect(
      outOfPolicy.consume({
        scope: SCOPE,
        operation: "ingest",
        now: new Date(),
      }),
    ).rejects.toBeInstanceOf(AnalyticsRateLimiterUnavailableError);
  });

  it("rejects unsafe Redis key prefixes", () => {
    expect(
      () =>
        new RedisAnalyticsRateLimiter({ evaluate: vi.fn() }, { keyPrefix: "" }),
    ).toThrow();
  });
});

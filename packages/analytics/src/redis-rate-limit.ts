import { createHash, randomUUID } from "node:crypto";
import {
  analyticsRateLimitPolicy,
  assertAnalyticsRateLimitDecision,
  AnalyticsRateLimiterUnavailableError,
  type AnalyticsRateLimitDecision,
  type AnalyticsRateLimiter,
} from "./rate-limit";
import type {
  AnalyticsRateLimitOperation,
  AnalyticsRateLimitScope,
} from "./rate-limit";

/**
 * Small adapter boundary for Redis clients. Keeping the Redis SDK outside this
 * package lets each deployment choose node-redis, ioredis, or a managed Redis
 * client without leaking provider DTOs into the analytics contract.
 */
export type AnalyticsRedisEvalClient = Readonly<{
  evaluate(
    script: string,
    keys: readonly string[],
    args: readonly string[],
  ): Promise<unknown>;
}>;

export type RedisAnalyticsRateLimiterOptions = Readonly<{
  keyPrefix?: string;
}>;

/**
 * Atomic sliding-window limiter. Redis TIME is used inside the script so
 * replicas do not rely on independently supplied application clocks.
 */
export const ANALYTICS_REDIS_RATE_LIMIT_SCRIPT = `
local now = redis.call("TIME")
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
local windowMs = tonumber(ARGV[1]) * 1000
local limit = tonumber(ARGV[2])
local member = ARGV[3]
local windowStart = nowMs - windowMs

redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", windowStart)
local count = redis.call("ZCARD", KEYS[1])
if count >= limit then
  local oldest = redis.call("ZRANGE", KEYS[1], 0, 0, "WITHSCORES")
  local retryMs = windowMs
  if oldest[2] ~= nil then
    retryMs = math.max(1, tonumber(oldest[2]) + windowMs - nowMs)
  end
  redis.call("EXPIRE", KEYS[1], ARGV[1])
  return { 0, 0, math.max(1, math.ceil(retryMs / 1000)) }
end

redis.call("ZADD", KEYS[1], nowMs, member)
redis.call("EXPIRE", KEYS[1], ARGV[1])
return { 1, limit - count - 1, 0 }
`;

function scopeDigest(scope: AnalyticsRateLimitScope): string {
  return createHash("sha256")
    .update(JSON.stringify([scope.tenantId, scope.actorId]), "utf8")
    .digest("hex");
}

function keyFor(
  scope: AnalyticsRateLimitScope,
  operation: AnalyticsRateLimitOperation,
  keyPrefix: string,
): string {
  return `${keyPrefix}analytics:rate:${operation}:${scopeDigest(scope)}`;
}

function integerFromResult(value: unknown): number | null {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^-?\d+$/u.test(value)
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(number) ? number : null;
}

function decisionFromResult(
  result: unknown,
  maximumRemaining: number,
): AnalyticsRateLimitDecision {
  if (!Array.isArray(result) || result.length < 3) {
    throw new AnalyticsRateLimiterUnavailableError();
  }
  const allowed = integerFromResult(result[0]);
  const remaining = integerFromResult(result[1]);
  const retryAfterSeconds = integerFromResult(result[2]);
  if (
    (allowed !== 0 && allowed !== 1) ||
    remaining === null ||
    remaining > maximumRemaining ||
    retryAfterSeconds === null ||
    (allowed === 0 && remaining !== 0)
  ) {
    throw new AnalyticsRateLimiterUnavailableError();
  }
  return assertAnalyticsRateLimitDecision({
    allowed: allowed === 1,
    remaining,
    retryAfterSeconds,
  });
}

/**
 * Production-wiring-ready distributed analytics limiter.
 *
 * This adapter performs no network connection by itself. The deployment must
 * inject an authenticated Redis client and must not replace it with an
 * in-memory implementation. Raw tenant and actor identifiers are hashed before
 * they become Redis key material.
 */
export class RedisAnalyticsRateLimiter implements AnalyticsRateLimiter {
  private readonly keyPrefix: string;

  public constructor(
    private readonly client: AnalyticsRedisEvalClient,
    options: RedisAnalyticsRateLimiterOptions = {},
  ) {
    const keyPrefix = options.keyPrefix ?? "wedding:";
    if (!/^[A-Za-z0-9._:-]{1,64}$/u.test(keyPrefix)) {
      throw new Error("Analytics Redis key prefix is invalid");
    }
    this.keyPrefix = keyPrefix;
  }

  public async consume(input: {
    scope: AnalyticsRateLimitScope;
    operation: AnalyticsRateLimitOperation;
    now: Date;
  }): Promise<AnalyticsRateLimitDecision> {
    const policy = analyticsRateLimitPolicy(input.operation);
    try {
      const result = await this.client.evaluate(
        ANALYTICS_REDIS_RATE_LIMIT_SCRIPT,
        [keyFor(input.scope, input.operation, this.keyPrefix)],
        [String(policy.windowSeconds), String(policy.limit), randomUUID()],
      );
      return decisionFromResult(result, policy.limit);
    } catch (error) {
      if (error instanceof AnalyticsRateLimiterUnavailableError) throw error;
      throw new AnalyticsRateLimiterUnavailableError();
    }
  }
}

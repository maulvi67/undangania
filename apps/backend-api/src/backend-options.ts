/**
 * Runtime wiring for provider-backed server options.
 *
 * The backend fails closed when the analytics rate limiter is absent, so this
 * module is the single place that turns environment configuration into a live
 * limiter. It returns an empty options object when Upstash is not configured,
 * which preserves the existing 503 behaviour instead of silently substituting a
 * process-local limiter — the one thing production must never do.
 */

import {
  RedisAnalyticsRateLimiter,
  type AnalyticsRateLimiter,
} from "@wedding/analytics";
import { createCacheEvalClientFromEnv } from "@wedding/cache";
import type { BackendServerOptions } from "./server";

/**
 * Builds the distributed analytics limiter from the Upstash REST credentials, or
 * `undefined` when they are absent. A malformed key prefix disables the limiter
 * (fail closed to 503) rather than crashing a process that also serves webhooks.
 */
export function createAnalyticsRateLimiterFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): AnalyticsRateLimiter | undefined {
  const client = createCacheEvalClientFromEnv(env);
  if (client === null) return undefined;
  const keyPrefix = env.ANALYTICS_RATE_LIMIT_PREFIX;
  try {
    return new RedisAnalyticsRateLimiter(
      client,
      keyPrefix === undefined || keyPrefix.trim() === "" ? {} : { keyPrefix },
    );
  } catch {
    return undefined;
  }
}

/**
 * The options the process entrypoint starts with. Only provider-backed options
 * are derived here; everything else keeps its existing default.
 */
export function backendOptionsFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): BackendServerOptions {
  const analyticsRateLimiter = createAnalyticsRateLimiterFromEnv(env);
  return analyticsRateLimiter === undefined ? {} : { analyticsRateLimiter };
}

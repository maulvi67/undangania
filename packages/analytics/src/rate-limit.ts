export const ANALYTICS_INGEST_RATE_LIMIT = {
  limit: 60,
  windowSeconds: 60,
} as const;

export const ANALYTICS_REPORT_RATE_LIMIT = {
  limit: 30,
  windowSeconds: 60,
} as const;

export type AnalyticsRateLimitOperation = "ingest" | "report";

export type AnalyticsRateLimitScope = Readonly<{
  tenantId: string;
  actorId: string;
}>;

export type AnalyticsRateLimitDecision = Readonly<{
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}>;

/**
 * The backend must receive a distributed/atomic implementation in every
 * deployed environment. This port deliberately does not expose an in-memory
 * fallback: a process-local limiter would allow a caller to bypass the limit
 * by moving between replicas.
 */
export interface AnalyticsRateLimiter {
  consume(
    input: Readonly<{
      scope: AnalyticsRateLimitScope;
      operation: AnalyticsRateLimitOperation;
      now: Date;
    }>,
  ): Promise<AnalyticsRateLimitDecision>;
}

export class AnalyticsRateLimiterUnavailableError extends Error {
  public constructor() {
    super("The analytics rate limiter is unavailable");
    this.name = "AnalyticsRateLimiterUnavailableError";
  }
}

export function analyticsRateLimitPolicy(
  operation: AnalyticsRateLimitOperation,
): Readonly<{ limit: number; windowSeconds: number }> {
  return operation === "ingest"
    ? ANALYTICS_INGEST_RATE_LIMIT
    : ANALYTICS_REPORT_RATE_LIMIT;
}

export function assertAnalyticsRateLimitDecision(
  decision: AnalyticsRateLimitDecision,
): AnalyticsRateLimitDecision {
  if (
    typeof decision.allowed !== "boolean" ||
    !Number.isSafeInteger(decision.remaining) ||
    decision.remaining < 0 ||
    !Number.isSafeInteger(decision.retryAfterSeconds) ||
    decision.retryAfterSeconds < 0
  ) {
    throw new Error("Analytics rate limiter returned an invalid decision");
  }
  return decision;
}

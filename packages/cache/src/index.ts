/**
 * Framework-agnostic cache port with an Upstash Redis (REST) adapter, plus the
 * concrete Redis transport the rest of the repository has been missing.
 *
 * Redis is ephemeral coordination, never business storage. The database stays
 * the source of truth, so every read must survive the cache being absent, empty,
 * or unreachable. Two consequences shape this module:
 *
 * - Configuration fails closed: {@link createCachePortFromEnv} returns `null`
 *   rather than a half-configured client, so callers degrade to the database.
 * - Transport failures surface as {@link CacheUnavailableError} and
 *   {@link readThrough} treats them as a miss, so a Redis outage never takes a
 *   public invitation page down with it.
 *
 * The adapter speaks the Upstash REST protocol directly over `fetch` (the same
 * dependency-free approach as the storage adapter) instead of pulling in an SDK.
 * Its {@link UpstashCacheAdapter.evaluate} method also implements the shape of
 * the `AnalyticsRedisEvalClient` port, so the same client backs both cache-aside
 * reads and the existing `RedisAnalyticsRateLimiter`.
 */

export interface CachePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** -2 when the key is missing, -1 when it exists without an expiry. */
  ttl(key: string): Promise<number>;
}

export const DEFAULT_CACHE_TTL_SECONDS = 300;

/** Upper bound on any single key's lifetime; cache is not durable storage. */
export const MAX_CACHE_TTL_SECONDS = 60 * 60 * 24;

const MIN_CACHE_TTL_SECONDS = 1;

export class CacheConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CacheConfigurationError";
  }
}

export class CacheUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CacheUnavailableError";
  }
}

export type CacheFetchResponse = Readonly<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type CacheFetch = (
  input: string,
  init: Readonly<{
    method: "POST";
    headers: Readonly<Record<string, string>>;
    body: string;
  }>,
) => Promise<CacheFetchResponse>;

export type UpstashCacheAdapterOptions = Readonly<{
  url: string;
  token: string;
  /** Injected for tests; defaults to the global `fetch`. */
  fetch?: CacheFetch;
}>;

function assertTtlSeconds(ttlSeconds: number): void {
  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds < MIN_CACHE_TTL_SECONDS ||
    ttlSeconds > MAX_CACHE_TTL_SECONDS
  ) {
    throw new RangeError(
      `Cache TTL must be an integer between ${MIN_CACHE_TTL_SECONDS} and ${MAX_CACHE_TTL_SECONDS} seconds`,
    );
  }
}

function normalizeUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CacheConfigurationError("Cache URL must be a valid absolute URL");
  }
  if (parsed.protocol !== "https:") {
    throw new CacheConfigurationError("Cache URL must use HTTPS");
  }
  // Credentials in the URL would leak the token into logs and error messages.
  if (parsed.username !== "" || parsed.password !== "") {
    throw new CacheConfigurationError("Cache URL must not contain credentials");
  }
  return parsed.toString().replace(/\/$/, "");
}

function resultOf(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null) {
    throw new CacheUnavailableError("Cache returned a malformed response");
  }
  if (!("result" in payload)) {
    throw new CacheUnavailableError("Cache returned a malformed response");
  }
  return (payload as { result: unknown }).result;
}

export class UpstashCacheAdapter implements CachePort {
  readonly #url: string;
  readonly #token: string;
  readonly #fetch: CacheFetch;

  constructor(options: UpstashCacheAdapterOptions) {
    if (options.token.trim() === "") {
      throw new CacheConfigurationError("Cache token must not be blank");
    }
    this.#url = normalizeUrl(options.url);
    this.#token = options.token;
    this.#fetch = options.fetch ?? (globalThis.fetch as unknown as CacheFetch);
    if (typeof this.#fetch !== "function") {
      throw new CacheConfigurationError("A fetch implementation is required");
    }
  }

  async #command(args: readonly (string | number)[]): Promise<unknown> {
    let response: CacheFetchResponse;
    try {
      response = await this.#fetch(this.#url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.#token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(args),
      });
    } catch {
      // The cause may hold the request (and thus the token); never re-expose it.
      throw new CacheUnavailableError("Cache request failed");
    }
    if (!response.ok) {
      throw new CacheUnavailableError(
        `Cache responded with status ${response.status}`,
      );
    }
    return resultOf(await response.json());
  }

  async get(key: string): Promise<string | null> {
    const result = await this.#command(["GET", key]);
    if (result === null) return null;
    if (typeof result === "string") return result;
    throw new CacheUnavailableError("Cache GET returned an unexpected value");
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    assertTtlSeconds(ttlSeconds);
    const result = await this.#command([
      "SET",
      key,
      value,
      "EX",
      String(ttlSeconds),
    ]);
    if (result !== "OK") {
      throw new CacheUnavailableError("Cache SET was not acknowledged");
    }
  }

  async delete(key: string): Promise<void> {
    await this.#command(["DEL", key]);
  }

  async ttl(key: string): Promise<number> {
    const result = await this.#command(["TTL", key]);
    if (typeof result === "number") return result;
    throw new CacheUnavailableError("Cache TTL returned an unexpected value");
  }

  /**
   * Runs a Lua script atomically. This is the shape of the repository's
   * `AnalyticsRedisEvalClient` port, so a caller can pass this adapter straight
   * to `RedisAnalyticsRateLimiter` instead of wiring a second Redis client.
   */
  async evaluate(
    script: string,
    keys: readonly string[],
    args: readonly string[],
  ): Promise<unknown> {
    if (keys.length === 0) {
      throw new RangeError("Cache EVAL requires at least one key");
    }
    return this.#command([
      "EVAL",
      script,
      String(keys.length),
      ...keys,
      ...args,
    ]);
  }
}

/**
 * Builds a cache port from environment variables, or `null` when the Upstash
 * REST credentials are absent or invalid. Returning `null` is the failure mode,
 * not throwing: an unconfigured cache must not stop the app from starting, and a
 * caller that receives `null` reads straight from the database.
 */
export function createCachePortFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): CachePort | null {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (url === undefined || url.trim() === "") return null;
  if (token === undefined || token.trim() === "") return null;
  try {
    return new UpstashCacheAdapter({ url, token });
  } catch {
    // Fail closed without echoing the credentials back to the caller.
    return null;
  }
}

function tryParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Cache-aside read with a hard fallback to the loader.
 *
 * A hit returns without touching the loader. A miss, an unreadable entry, an
 * unreachable cache, or an unconfigured cache all fall through to `load`, and a
 * failed write is best-effort. The loader is always the source of truth.
 */
export async function readThrough<T>(
  input: Readonly<{
    cache: CachePort | null;
    key: string;
    ttlSeconds: number;
    load: () => Promise<T>;
    /** Return `null` to reject a cached value and reload. Defaults to JSON. */
    parse?: (cached: string) => T | null;
    /** Defaults to `JSON.stringify`. */
    serialize?: (value: T) => string;
  }>,
): Promise<T> {
  const parse = input.parse ?? tryParseJson<T>;
  const serialize = input.serialize ?? ((value: T) => JSON.stringify(value));

  if (input.cache !== null) {
    try {
      const cached = await input.cache.get(input.key);
      if (cached !== null) {
        const value = parse(cached);
        if (value !== null) return value;
      }
    } catch {
      // Treat an unreachable or corrupt cache as a miss.
    }
  }

  const value = await input.load();

  if (input.cache !== null) {
    try {
      await input.cache.set(input.key, serialize(value), input.ttlSeconds);
    } catch {
      // A cache write is an optimization; never fail the read over it.
    }
  }

  return value;
}

/**
 * The structural port the repository's `RedisAnalyticsRateLimiter` expects.
 *
 * `UpstashCacheAdapter` already implements this shape, so a caller can reuse the
 * one configured client for both cache-aside reads and the distributed analytics
 * limiter. It is a structural type on purpose: the cache package stays ignorant
 * of analytics and promises only the exact method shape.
 */
export type CacheEvalClient = Readonly<{
  evaluate(
    script: string,
    keys: readonly string[],
    args: readonly string[],
  ): Promise<unknown>;
}>;

/**
 * Resolves the cache eval client, or `null` when Upstash is unconfigured.
 *
 * `null` is the fail-closed signal: a deployment without Redis gets no
 * distributed limiter, and the caller must not substitute a process-local one.
 */
export function createCacheEvalClientFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): CacheEvalClient | null {
  const port = createCachePortFromEnv(env);
  return port instanceof UpstashCacheAdapter ? port : null;
}

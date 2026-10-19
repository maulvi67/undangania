import { describe, expect, it, vi } from "vitest";
import {
  CacheConfigurationError,
  CacheUnavailableError,
  createCachePortFromEnv,
  readThrough,
  type CacheFetch,
  type CacheFetchResponse,
  type CachePort,
  DEFAULT_CACHE_TTL_SECONDS,
  MAX_CACHE_TTL_SECONDS,
  UpstashCacheAdapter,
} from "./index";

const BASE_OPTIONS = {
  url: "https://example.upstash.io",
  token: "rest-token-that-must-not-leak",
} as const;

function jsonResponse(payload: unknown, status = 200): CacheFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function createRecordingAdapter(handler: (body: string) => CacheFetchResponse) {
  const bodies: string[] = [];
  const fetcher: CacheFetch = async (_input, init) => {
    bodies.push(init.body);
    return handler(init.body);
  };
  return {
    adapter: new UpstashCacheAdapter({ ...BASE_OPTIONS, fetch: fetcher }),
    bodies,
  };
}

describe("createCachePortFromEnv", () => {
  it("returns null when either REST setting is missing or blank", () => {
    expect(createCachePortFromEnv({})).toBeNull();
    expect(
      createCachePortFromEnv({ UPSTASH_REDIS_REST_URL: BASE_OPTIONS.url }),
    ).toBeNull();
    expect(
      createCachePortFromEnv({ UPSTASH_REDIS_REST_TOKEN: BASE_OPTIONS.token }),
    ).toBeNull();
    expect(
      createCachePortFromEnv({
        UPSTASH_REDIS_REST_URL: "  ",
        UPSTASH_REDIS_REST_TOKEN: BASE_OPTIONS.token,
      }),
    ).toBeNull();
    expect(
      createCachePortFromEnv({
        UPSTASH_REDIS_REST_URL: BASE_OPTIONS.url,
        UPSTASH_REDIS_REST_TOKEN: "  ",
      }),
    ).toBeNull();
  });

  it("fails closed without exposing credentials for an invalid URL", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      createCachePortFromEnv({
        UPSTASH_REDIS_REST_URL: "http://example.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: BASE_OPTIONS.token,
      }),
    ).toBeNull();
    expect(
      createCachePortFromEnv({
        UPSTASH_REDIS_REST_URL: "https://user:pass@example.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: BASE_OPTIONS.token,
      }),
    ).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("builds an adapter for valid credentials", () => {
    const port = createCachePortFromEnv({
      UPSTASH_REDIS_REST_URL: BASE_OPTIONS.url,
      UPSTASH_REDIS_REST_TOKEN: BASE_OPTIONS.token,
    });
    expect(port).toBeInstanceOf(UpstashCacheAdapter);
  });
});

describe("UpstashCacheAdapter", () => {
  it("reads a value and normalizes a missing key to null", async () => {
    const { adapter, bodies } = createRecordingAdapter((body) =>
      body.includes('"missing"')
        ? jsonResponse({ result: null })
        : jsonResponse({ result: "cached-value" }),
    );

    await expect(adapter.get("wedding:slug")).resolves.toBe("cached-value");
    await expect(adapter.get("missing")).resolves.toBeNull();
    expect(bodies[0]).toBe('["GET","wedding:slug"]');
  });

  it("writes with a bounded expiry and requires acknowledgement", async () => {
    const { adapter, bodies } = createRecordingAdapter(() =>
      jsonResponse({ result: "OK" }),
    );

    await adapter.set("wedding:slug", "value", 120);
    expect(bodies[0]).toBe('["SET","wedding:slug","value","EX","120"]');
  });

  it("rejects an out-of-range expiry before issuing a request", async () => {
    const { adapter, bodies } = createRecordingAdapter(() =>
      jsonResponse({ result: "OK" }),
    );

    await expect(adapter.set("k", "v", 0)).rejects.toBeInstanceOf(RangeError);
    await expect(
      adapter.set("k", "v", MAX_CACHE_TTL_SECONDS + 1),
    ).rejects.toBeInstanceOf(RangeError);
    expect(bodies).toHaveLength(0);
  });

  it("deletes a key and reads back a TTL", async () => {
    const { adapter } = createRecordingAdapter((body) =>
      body.includes('"TTL"')
        ? jsonResponse({ result: 42 })
        : jsonResponse({ result: 1 }),
    );

    await expect(adapter.delete("wedding:slug")).resolves.toBeUndefined();
    await expect(adapter.ttl("wedding:slug")).resolves.toBe(42);
  });

  it("surfaces transport failures without leaking the token", async () => {
    const fetcher: CacheFetch = async () => {
      throw new Error("network down");
    };
    const adapter = new UpstashCacheAdapter({
      ...BASE_OPTIONS,
      fetch: fetcher,
    });

    await expect(adapter.get("k")).rejects.toThrow(CacheUnavailableError);
    await expect(adapter.get("k")).rejects.not.toThrow(BASE_OPTIONS.token);
  });

  it("surfaces a non-2xx response and a malformed body as unavailable", async () => {
    const failing = new UpstashCacheAdapter({
      ...BASE_OPTIONS,
      fetch: async () => jsonResponse({ error: "boom" }, 500),
    });
    const malformed = new UpstashCacheAdapter({
      ...BASE_OPTIONS,
      fetch: async () => jsonResponse({ notResult: true }),
    });

    await expect(failing.get("k")).rejects.toThrow("status 500");
    await expect(malformed.get("k")).rejects.toThrow("malformed");
  });

  it("requires HTTPS, a non-blank token, and no URL credentials", () => {
    expect(
      () =>
        new UpstashCacheAdapter({
          ...BASE_OPTIONS,
          url: "http://example.test",
        }),
    ).toThrow(CacheConfigurationError);
    expect(
      () => new UpstashCacheAdapter({ ...BASE_OPTIONS, token: "  " }),
    ).toThrow(CacheConfigurationError);
    expect(
      () =>
        new UpstashCacheAdapter({
          ...BASE_OPTIONS,
          url: "https://user:pass@example.test",
        }),
    ).toThrow(CacheConfigurationError);
  });

  it("runs a Lua script atomically with keys before args", async () => {
    const { adapter, bodies } = createRecordingAdapter(() =>
      jsonResponse({ result: [1, 59, 0] }),
    );

    await expect(
      adapter.evaluate("return 1", ["wedding:rate:k"], ["60", "60", "m"]),
    ).resolves.toEqual([1, 59, 0]);
    expect(bodies[0]).toBe(
      '["EVAL","return 1","1","wedding:rate:k","60","60","m"]',
    );
  });

  it("rejects an EVAL without a key", async () => {
    const { adapter, bodies } = createRecordingAdapter(() =>
      jsonResponse({ result: 1 }),
    );

    await expect(adapter.evaluate("return 1", [], [])).rejects.toBeInstanceOf(
      RangeError,
    );
    expect(bodies).toHaveLength(0);
  });
});

describe("readThrough", () => {
  function memoryCache(): CachePort & { store: Map<string, string> } {
    const store = new Map<string, string>();
    return {
      store,
      get: async (key) => store.get(key) ?? null,
      set: async (key, value) => {
        store.set(key, value);
      },
      delete: async (key) => {
        store.delete(key);
      },
      ttl: async (key) => (store.has(key) ? -1 : -2),
    };
  }

  it("returns a cached value without calling the loader", async () => {
    const cache = memoryCache();
    cache.store.set("wedding:slug", JSON.stringify({ couple: "A & B" }));
    const load = vi.fn(async () => ({ couple: "stale" }));

    await expect(
      readThrough({
        cache,
        key: "wedding:slug",
        ttlSeconds: DEFAULT_CACHE_TTL_SECONDS,
        load,
      }),
    ).resolves.toEqual({ couple: "A & B" });
    expect(load).not.toHaveBeenCalled();
  });

  it("loads on a miss and populates the cache", async () => {
    const cache = memoryCache();
    const load = vi.fn(async () => ({ couple: "A & B" }));

    await expect(
      readThrough({
        cache,
        key: "wedding:slug",
        ttlSeconds: DEFAULT_CACHE_TTL_SECONDS,
        load,
      }),
    ).resolves.toEqual({ couple: "A & B" });
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.store.get("wedding:slug")).toBe('{"couple":"A & B"}');
  });

  it("falls back to the loader when the cache throws", async () => {
    const cache: CachePort = {
      get: async () => {
        throw new CacheUnavailableError("down");
      },
      set: async () => {
        throw new CacheUnavailableError("down");
      },
      delete: async () => {},
      ttl: async () => -2,
    };
    const load = vi.fn(async () => "from-db");

    await expect(
      readThrough({ cache, key: "k", ttlSeconds: 60, load }),
    ).resolves.toBe("from-db");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("ignores a cached value the parser rejects", async () => {
    const cache = memoryCache();
    cache.store.set("wedding:slug", "not-json");
    const load = vi.fn(async () => "from-db");

    await expect(
      readThrough({ cache, key: "wedding:slug", ttlSeconds: 60, load }),
    ).resolves.toBe("from-db");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("always loads when no cache is configured", async () => {
    const load = vi.fn(async () => "from-db");

    await expect(
      readThrough({ cache: null, key: "k", ttlSeconds: 60, load }),
    ).resolves.toBe("from-db");
    expect(load).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { CachePort } from "@wedding/cache";
import type { PublicPublication } from "@wedding/database";
import {
  invalidatePublicInvitation,
  publicInvitationCacheKey,
  readPublicPublication,
} from "./publication-cache";

function publication(slug: string): PublicPublication {
  return {
    slug,
    tenantId: "tenant-1",
    weddingId: "wedding-1",
    templateId: "nara-modern",
    templateVersion: "1",
    contractVersion: 1,
    invitationStatus: "PUBLISHED",
    snapshot: { couple: "A & B" },
  };
}

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

describe("publicInvitationCacheKey", () => {
  it("scopes the key by slug under the wedding namespace", () => {
    expect(publicInvitationCacheKey("rani-bima-1a2b3c4d")).toBe(
      "wedding:rani-bima-1a2b3c4d",
    );
  });
});

describe("readPublicPublication", () => {
  it("returns a cached row without hitting the database", async () => {
    const cache = memoryCache();
    cache.store.set(
      publicInvitationCacheKey("rani-bima-1a2b3c4d"),
      JSON.stringify(publication("rani-bima-1a2b3c4d")),
    );
    const load = vi.fn(async () => publication("stale"));

    await expect(
      readPublicPublication({
        slug: "rani-bima-1a2b3c4d",
        cache,
        load,
      }),
    ).resolves.toEqual(publication("rani-bima-1a2b3c4d"));
    expect(load).not.toHaveBeenCalled();
  });

  it("loads on a miss and populates the cache", async () => {
    const cache = memoryCache();
    const load = vi.fn(async () => publication("rani-bima-1a2b3c4d"));

    await expect(
      readPublicPublication({ slug: "rani-bima-1a2b3c4d", cache, load }),
    ).resolves.toEqual(publication("rani-bima-1a2b3c4d"));
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.store.get("wedding:rani-bima-1a2b3c4d")).toBe(
      JSON.stringify(publication("rani-bima-1a2b3c4d")),
    );
  });

  it("falls back to the database when the cache throws", async () => {
    const cache: CachePort = {
      get: async () => {
        throw new Error("redis down");
      },
      set: async () => {
        throw new Error("redis down");
      },
      delete: async () => {},
      ttl: async () => -2,
    };
    const load = vi.fn(async () => publication("rani-bima-1a2b3c4d"));

    await expect(
      readPublicPublication({ slug: "rani-bima-1a2b3c4d", cache, load }),
    ).resolves.toEqual(publication("rani-bima-1a2b3c4d"));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reads straight from the loader when no cache is configured", async () => {
    const load = vi.fn(async () => publication("rani-bima-1a2b3c4d"));

    await expect(
      readPublicPublication({ slug: "rani-bima-1a2b3c4d", cache: null, load }),
    ).resolves.toEqual(publication("rani-bima-1a2b3c4d"));
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("invalidatePublicInvitation", () => {
  it("deletes the slug's key", async () => {
    const cache = memoryCache();
    cache.store.set("wedding:rani-bima-1a2b3c4d", "cached");

    await invalidatePublicInvitation("rani-bima-1a2b3c4d", cache);

    expect(cache.store.has("wedding:rani-bima-1a2b3c4d")).toBe(false);
  });

  it("is a no-op without a configured cache", async () => {
    await expect(
      invalidatePublicInvitation("rani-bima-1a2b3c4d", null),
    ).resolves.toBeUndefined();
  });

  it("swallows a cache failure so publishing still succeeds", async () => {
    const cache: CachePort = {
      get: async () => null,
      set: async () => {},
      delete: async () => {
        throw new Error("redis down");
      },
      ttl: async () => -2,
    };

    await expect(
      invalidatePublicInvitation("rani-bima-1a2b3c4d", cache),
    ).resolves.toBeUndefined();
  });
});

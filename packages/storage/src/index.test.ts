import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createStoragePortFromEnv,
  DEFAULT_UPLOAD_EXPIRES_IN_SECONDS,
  R2StorageAdapter,
  type StorageFetch,
} from "./index";

afterEach(() => {
  vi.restoreAllMocks();
});

const BASE_ENV: Readonly<Record<string, string>> = {
  STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com/",
  STORAGE_BUCKET: "wedding-assets",
  STORAGE_ACCESS_KEY_ID: "access-key-id",
  STORAGE_SECRET_ACCESS_KEY: "secret-key-that-must-not-leak",
};

const BASE_OPTIONS = {
  endpoint: "https://account.r2.cloudflarestorage.com/",
  bucket: "wedding-assets",
  accessKeyId: "access-key-id",
  secretAccessKey: "secret-key-that-must-not-leak",
  now: () => new Date("2026-09-17T00:00:00.000Z"),
} as const;

function response(
  status: number,
  headers: Readonly<Record<string, string>> = {},
  body: Uint8Array = new Uint8Array(),
): Readonly<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}> {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => headers[name.toLowerCase()] ?? null,
    },
    arrayBuffer: async () => Uint8Array.from(body).buffer,
  };
}

function createTestAdapter(): Readonly<{
  adapter: R2StorageAdapter;
  requests: {
    input: string;
    method: "GET" | "HEAD" | "DELETE";
    headers?: Readonly<Record<string, string>>;
  }[];
}> {
  const requests: {
    input: string;
    method: "GET" | "HEAD" | "DELETE";
    headers?: Readonly<Record<string, string>>;
  }[] = [];
  const fetcher: StorageFetch = async (input, init) => {
    requests.push({
      input,
      method: init.method,
      ...(init.headers === undefined ? {} : { headers: init.headers }),
    });
    if (init.method === "HEAD") {
      return response(200, {
        "content-length": "125000",
        "content-type": "image/jpeg",
        etag: '"etag-1"',
      });
    }
    if (init.method === "GET") {
      return response(
        206,
        { "content-length": "3", "content-range": "bytes 0-2/125000" },
        new Uint8Array([0xff, 0xd8, 0xff]),
      );
    }
    return response(204);
  };

  return {
    adapter: new R2StorageAdapter({ ...BASE_OPTIONS, fetch: fetcher }),
    requests,
  };
}

describe("createStoragePortFromEnv", () => {
  it("returns null when any required setting is missing or blank", () => {
    for (const name of Object.keys(BASE_ENV)) {
      const missing = { ...BASE_ENV };
      delete missing[name];
      expect(createStoragePortFromEnv(missing)).toBeNull();

      expect(
        createStoragePortFromEnv({ ...BASE_ENV, [name]: "  " }),
      ).toBeNull();
    }
  });

  it("fails closed for an invalid endpoint without exposing credentials", () => {
    const secret = BASE_ENV.STORAGE_SECRET_ACCESS_KEY;
    const invalidEnv = {
      ...BASE_ENV,
      STORAGE_ENDPOINT: "http://not-r2.example",
    };

    expect(createStoragePortFromEnv(invalidEnv)).toBeNull();
    expect(
      () =>
        new R2StorageAdapter({
          ...BASE_OPTIONS,
          endpoint: invalidEnv.STORAGE_ENDPOINT,
        }),
    ).toThrow("Storage endpoint must use HTTPS");
    expect(
      () =>
        new R2StorageAdapter({
          ...BASE_OPTIONS,
          endpoint: invalidEnv.STORAGE_ENDPOINT,
        }),
    ).not.toThrow(secret);
  });

  it("rejects URL expiration values outside the bounded range", () => {
    expect(
      () =>
        new R2StorageAdapter({
          ...BASE_OPTIONS,
          uploadExpiresInSeconds: 60 * 60 + 1,
        }),
    ).toThrow("Upload URL expiration");
  });
});

describe("R2StorageAdapter", () => {
  it("signs a tenant-scoped upload with an exact expiration and content type", async () => {
    const { adapter } = createTestAdapter();

    const result = await adapter.createUpload({
      tenantId: "tenant-1",
      objectKey: "tenant-1/gallery/photo.jpg",
      contentType: "image/jpeg",
      maxBytes: 2_000_000,
      contentLength: 125_000,
    });
    const url = new URL(result.url);

    expect(url.pathname).toBe("/wedding-assets/tenant-1/gallery/photo.jpg");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Expires")).toBe(
      String(DEFAULT_UPLOAD_EXPIRES_IN_SECONDS),
    );
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe(
      "content-type;host",
    );
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(result.expiresAt).toISOString()).toBe(
      "2026-09-17T00:15:00.000Z",
    );
  });

  it("rejects object keys outside the tenant prefix", async () => {
    const { adapter } = createTestAdapter();

    await expect(
      adapter.createUpload({
        tenantId: "tenant-1",
        objectKey: "tenant-2/gallery/photo.jpg",
        contentType: "image/jpeg",
        maxBytes: 2_000_000,
      }),
    ).rejects.toThrow("tenant-scoped");
  });

  it("rejects an exact content length above maxBytes", async () => {
    const { adapter } = createTestAdapter();

    await expect(
      adapter.createUpload({
        tenantId: "tenant-1",
        objectKey: "tenant-1/gallery/photo.jpg",
        contentType: "image/jpeg",
        maxBytes: 100,
        contentLength: 101,
      }),
    ).rejects.toThrow("maximum upload size");
  });

  it("signs a short-lived read URL", async () => {
    const { adapter } = createTestAdapter();

    const url = new URL(
      await adapter.createReadUrl("tenant-1/gallery/photo.jpg", 120),
    );

    expect(url.searchParams.get("X-Amz-Expires")).toBe("120");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reads provider metadata and normalizes the quoted ETag", async () => {
    const { adapter, requests } = createTestAdapter();

    await expect(
      adapter.headObject("tenant-1/gallery/photo.jpg"),
    ).resolves.toEqual({
      contentLength: 125_000,
      contentType: "image/jpeg",
      etag: "etag-1",
    });
    expect(requests[0]?.method).toBe("HEAD");
    expect(requests[0]?.input).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
  });

  it("reads only a tenant-scoped bounded object prefix", async () => {
    const { adapter, requests } = createTestAdapter();

    await expect(
      adapter.readPrefix({
        tenantId: "tenant-1",
        objectKey: "tenant-1/gallery/photo.jpg",
        maxBytes: 64,
      }),
    ).resolves.toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
    expect(requests[0]?.method).toBe("GET");
    expect(requests[0]?.headers?.range).toBe("bytes=0-63");
    expect(requests[0]?.input).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");

    await expect(
      adapter.readPrefix({
        tenantId: "tenant-2",
        objectKey: "tenant-1/gallery/photo.jpg",
        maxBytes: 64,
      }),
    ).rejects.toThrow("tenant-scoped");
  });

  it("rejects storage providers that ignore or shift the range request", async () => {
    const fullResponseAdapter = new R2StorageAdapter({
      ...BASE_OPTIONS,
      fetch: async () => response(200, { "content-length": "125000" }),
    });
    const shiftedResponseAdapter = new R2StorageAdapter({
      ...BASE_OPTIONS,
      fetch: async () =>
        response(
          206,
          { "content-length": "3", "content-range": "bytes 1-3/125000" },
          new Uint8Array([0xd8, 0xff, 0xe0]),
        ),
    });

    await expect(
      fullResponseAdapter.readPrefix({
        tenantId: "tenant-1",
        objectKey: "tenant-1/gallery/photo.jpg",
        maxBytes: 64,
      }),
    ).rejects.toThrow("partial content");
    await expect(
      shiftedResponseAdapter.readPrefix({
        tenantId: "tenant-1",
        objectKey: "tenant-1/gallery/photo.jpg",
        maxBytes: 64,
      }),
    ).rejects.toThrow("range was invalid");
  });

  it("deletes the requested private object", async () => {
    const { adapter, requests } = createTestAdapter();

    await adapter.delete("tenant-1/gallery/photo.jpg");

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe("DELETE");
    expect(requests[0]?.input).toContain(
      "/wedding-assets/tenant-1/gallery/photo.jpg",
    );
  });

  it("does not log or include the secret in invalid configuration errors", () => {
    const secret = BASE_ENV.STORAGE_SECRET_ACCESS_KEY;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    expect(
      createStoragePortFromEnv({
        ...BASE_ENV,
        STORAGE_ENDPOINT: "https://user:pass@r2.example.test",
      }),
    ).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain(secret);
    expect(logSpy.mock.calls.flat().join(" ")).not.toContain(secret);
  });
});

import { describe, expect, it } from "vitest";
import {
  beginMediaUpload,
  completeMediaUpload,
  removeMediaAsset,
  type MediaAsset,
  type MediaAssetRepository,
  type MediaStoragePort,
} from "./media";
import {
  AuthRequiredError,
  InvalidInputError,
  ProviderUnavailableError,
} from "./use-case-support";

const OWNER = {
  tenantId: "tenant-1",
  actorId: "user-1",
  roles: ["OWNER"],
} as const;

const SCOPE = { tenantId: "tenant-1", weddingId: "wedding-1" } as const;

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  const now = new Date("2026-09-17T00:00:00.000Z");
  return {
    id: "asset-1",
    tenantId: SCOPE.tenantId,
    weddingId: SCOPE.weddingId,
    objectKey: "tenant-1/wedding-1/media/object.jpg",
    mediaType: "IMAGE",
    state: "PENDING_UPLOAD",
    mimeType: "image/jpeg",
    sizeBytes: 1200,
    checksum: "",
    width: null,
    height: null,
    altText: "Pasangan di taman",
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function repository(
  overrides: Partial<MediaAssetRepository> = {},
): MediaAssetRepository {
  return {
    createPending: async () => asset(),
    completeUpload: async () => ({
      kind: "ok",
      asset: asset({ state: "UPLOADED" }),
    }),
    markScanning: async (_scope, id) => ({
      kind: "ok",
      asset: asset({ id, state: "SCANNING" }),
    }),
    markProcessing: async (_scope, id, dimensions) => ({
      kind: "ok",
      asset: asset({ id, state: "PROCESSING", ...dimensions }),
    }),
    markReady: async () => ({ kind: "ok", asset: asset({ state: "READY" }) }),
    reject: async (_scope, id, reason) => ({
      kind: "rejected",
      reason,
      asset: asset({ id, state: "REJECTED" }),
    }),
    softDelete: async (_scope, id) => ({
      kind: "ok",
      asset: asset({ id, state: "DELETED" }),
    }),
    findById: async () => asset(),
    listForWedding: async () => [],
    ...overrides,
  };
}

function storage(overrides: Partial<MediaStoragePort> = {}): MediaStoragePort {
  return {
    createUpload: async () => ({
      url: "https://signed.example.test/upload",
      expiresAt: "2026-09-17T00:15:00.000Z",
    }),
    headObject: async () => ({
      contentLength: 1200,
      contentType: "image/jpeg",
      etag: "etag-1",
    }),
    delete: async () => undefined,
    ...overrides,
  };
}

describe("beginMediaUpload", () => {
  it("requires an authenticated editor and validates MIME and size before persistence", async () => {
    const media = repository({
      createPending: async () => {
        throw new Error("must not create");
      },
    });

    await expect(
      beginMediaUpload(
        null,
        SCOPE.weddingId,
        {
          filename: "photo.jpg",
          mediaType: "IMAGE",
          mimeType: "image/jpeg",
          sizeBytes: 1200,
        },
        { media, storage: storage() },
      ),
    ).rejects.toBeInstanceOf(AuthRequiredError);

    await expect(
      beginMediaUpload(
        OWNER,
        SCOPE.weddingId,
        {
          filename: "photo.exe",
          mediaType: "IMAGE",
          mimeType: "application/octet-stream",
          sizeBytes: 1200,
        },
        { media, storage: storage() },
      ),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });

  it("creates a server-owned object key and signs the declared upload", async () => {
    const pendingInputs: {
      objectKey: string;
      mimeType: string;
      sizeBytes: number;
    }[] = [];
    const uploadInputs: {
      tenantId: string;
      objectKey: string;
      contentType: string;
      maxBytes: number;
      contentLength?: number;
    }[] = [];
    const media = repository({
      createPending: async (_scope, input) => {
        pendingInputs.push(input);
        return asset({
          objectKey: input.objectKey,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        });
      },
    });
    const storagePort = storage({
      createUpload: async (input) => {
        uploadInputs.push(input);
        return {
          url: "https://signed.example.test/upload",
          expiresAt: "2026-09-17T00:15:00.000Z",
        };
      },
    });

    const result = await beginMediaUpload(
      OWNER,
      SCOPE.weddingId,
      {
        filename: "photo.jpg",
        mediaType: "IMAGE",
        mimeType: "image/jpeg",
        sizeBytes: 1200,
      },
      { media, storage: storagePort },
    );

    expect(result.uploadUrl).toBe("https://signed.example.test/upload");
    const pendingInput = pendingInputs[0];
    const uploadInput = uploadInputs[0];
    expect(pendingInput?.objectKey).toMatch(
      /^tenant-1\/wedding-1\/media\/[0-9a-f-]+\.jpg$/,
    );
    expect(uploadInput).toEqual({
      tenantId: "tenant-1",
      objectKey: pendingInput?.objectKey,
      contentType: "image/jpeg",
      maxBytes: 10 * 1024 * 1024,
      contentLength: 1200,
    });
  });

  it("soft-deletes a pending row when signing fails", async () => {
    let deletedId: string | null = null;
    const media = repository({
      softDelete: async (_scope, id) => {
        deletedId = id;
        return { kind: "ok", asset: asset({ id, state: "DELETED" }) };
      },
    });

    await expect(
      beginMediaUpload(
        OWNER,
        SCOPE.weddingId,
        {
          filename: "photo.jpg",
          mediaType: "IMAGE",
          mimeType: "image/jpeg",
          sizeBytes: 1200,
        },
        {
          media,
          storage: storage({
            createUpload: async () => {
              throw new Error("R2 unavailable");
            },
          }),
        },
      ),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(deletedId).toBe("asset-1");
  });
});

describe("completeMediaUpload", () => {
  it("uses provider-observed metadata and leaves the asset uploaded for async processing", async () => {
    let completedInput: {
      id: string;
      contentLength: number;
      contentType: string;
      checksum: string;
    } | null = null;
    const media = repository({
      completeUpload: async (_scope, input) => {
        completedInput = input;
        return {
          kind: "ok",
          asset: asset({ state: "UPLOADED", checksum: input.checksum }),
        };
      },
    });

    const result = await completeMediaUpload(
      OWNER,
      SCOPE.weddingId,
      "asset-1",
      { media, storage: storage() },
    );

    expect(completedInput).toEqual({
      id: "asset-1",
      contentLength: 1200,
      contentType: "image/jpeg",
      checksum: "etag-1",
    });
    expect(result.state).toBe("UPLOADED");
  });

  it("does not make a mismatched provider object ready", async () => {
    let readyCalled = false;
    const media = repository({
      completeUpload: async () => ({
        kind: "rejected",
        reason: "Ukuran file yang diterima tidak sesuai.",
        asset: asset({ state: "REJECTED" }),
      }),
      markReady: async () => {
        readyCalled = true;
        return { kind: "ok", asset: asset({ state: "READY" }) };
      },
    });

    await expect(
      completeMediaUpload(OWNER, SCOPE.weddingId, "asset-1", {
        media,
        storage: storage({
          headObject: async () => ({
            contentLength: 999,
            contentType: "image/jpeg",
            etag: "etag-1",
          }),
        }),
      }),
    ).rejects.toBeInstanceOf(InvalidInputError);
    expect(readyCalled).toBe(false);
  });
});

describe("removeMediaAsset", () => {
  it("retries provider cleanup for an already soft-deleted asset", async () => {
    let deletedKey: string | null = null;
    const result = await removeMediaAsset(OWNER, SCOPE.weddingId, "asset-1", {
      media: repository({ findById: async () => asset({ state: "DELETED" }) }),
      storage: storage({
        delete: async (objectKey) => {
          deletedKey = objectKey;
        },
      }),
    });

    expect(result.asset.state).toBe("DELETED");
    expect(deletedKey).toBe("tenant-1/wedding-1/media/object.jpg");
  });

  it("soft-deletes the tenant-scoped row and removes its private object", async () => {
    let deletedKey: string | null = null;
    const result = await removeMediaAsset(OWNER, SCOPE.weddingId, "asset-1", {
      media: repository({
        softDelete: async (_scope, id) => ({
          kind: "ok",
          asset: asset({ id, state: "DELETED" }),
        }),
      }),
      storage: storage({
        delete: async (objectKey) => {
          deletedKey = objectKey;
        },
      }),
    });

    expect(result.asset.state).toBe("DELETED");
    expect(deletedKey).toBe("tenant-1/wedding-1/media/object.jpg");
  });
});

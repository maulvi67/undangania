import { describe, expect, it, vi } from "vitest";
import {
  completeMediaAssetUpload,
  createPendingMediaAsset,
  markMediaAssetProcessing,
  markMediaAssetScanning,
  markMediaAssetReady,
  PrismaMediaAssetRepository,
  type MediaAssetClient,
} from "./media-asset";

const SCOPE = {
  tenantId: "tenant-1",
  weddingId: "wedding-1",
  actorId: "user-1",
} as const;

const now = new Date("2026-09-17T00:00:00.000Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset-1",
    tenantId: "tenant-1",
    weddingId: "wedding-1",
    objectKey: "tenant-1/wedding-1/media/photo.jpg",
    mediaType: "IMAGE",
    state: "PENDING_UPLOAD" as const,
    mimeType: "image/jpeg",
    sizeBytes: 1200n,
    checksum: "",
    width: null,
    height: null,
    altText: "Foto pasangan",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function client(overrides: Partial<MediaAssetClient> = {}): MediaAssetClient {
  return {
    mediaAsset: {
      findFirst: vi.fn().mockResolvedValue(row()),
      findMany: vi.fn().mockResolvedValue([row()]),
      create: vi.fn().mockResolvedValue(row()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditEvent: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
    outboxEvent: {
      create: vi.fn().mockResolvedValue({ id: "outbox-1" }),
    },
    ...overrides,
  };
}

describe("media asset repository", () => {
  it("creates a pending asset under the supplied tenant and wedding", async () => {
    const c = client();
    const result = await createPendingMediaAsset(
      c,
      SCOPE,
      {
        objectKey: "tenant-1/wedding-1/media/photo.jpg",
        mediaType: "IMAGE",
        mimeType: "image/jpeg",
        sizeBytes: 1200,
        altText: "Foto pasangan",
      },
      "correlation-1",
    );

    expect(result.state).toBe("PENDING_UPLOAD");
    expect(c.mediaAsset.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        objectKey: "tenant-1/wedding-1/media/photo.jpg",
        mediaType: "IMAGE",
        state: "PENDING_UPLOAD",
        mimeType: "image/jpeg",
        sizeBytes: 1200n,
        checksum: "",
        altText: "Foto pasangan",
      },
      select: expect.anything(),
    });
    expect(c.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(c.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it("does not complete an asset outside the tenant and wedding scope", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const c = client({
      mediaAsset: {
        findFirst,
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    });

    await expect(
      completeMediaAssetUpload(
        c,
        {
          tenantId: "tenant-other",
          weddingId: "wedding-other",
          actorId: "user-1",
        },
        {
          id: "asset-1",
          contentLength: 1200,
          contentType: "image/jpeg",
          checksum: "etag-1",
        },
        "correlation-2",
      ),
    ).resolves.toEqual({ kind: "not-found" });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-other",
          weddingId: "wedding-other",
          id: "asset-1",
        },
      }),
    );
  });

  it("moves a matching pending object to uploaded and records metadata", async () => {
    const c = client({
      mediaAsset: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(row())
          .mockResolvedValueOnce(
            row({ state: "UPLOADED", checksum: "etag-1" }),
          ),
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    });
    const result = await completeMediaAssetUpload(
      c,
      SCOPE,
      {
        id: "asset-1",
        contentLength: 1200,
        contentType: "image/jpeg",
        checksum: "etag-1",
      },
      "correlation-3",
    );

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.asset.state).toBe("UPLOADED");
    expect(c.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        id: "asset-1",
        state: "PENDING_UPLOAD",
      },
      data: { state: "UPLOADED", checksum: "etag-1" },
    });
  });

  it("does not append a rejection event after a concurrent completion wins", async () => {
    const c = client({
      mediaAsset: {
        findFirst: vi.fn().mockResolvedValue(row({ state: "UPLOADED" })),
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });

    await expect(
      completeMediaAssetUpload(
        c,
        SCOPE,
        {
          id: "asset-1",
          contentLength: 999,
          contentType: "image/jpeg",
          checksum: "etag-1",
        },
        "correlation-concurrent",
      ),
    ).resolves.toEqual({ kind: "invalid-state", state: "UPLOADED" });
    expect(c.auditEvent.create).not.toHaveBeenCalled();
    expect(c.outboxEvent.create).not.toHaveBeenCalled();
  });

  it("rejects mismatched provider metadata and never marks it ready", async () => {
    const c = client({
      mediaAsset: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(row())
          .mockResolvedValueOnce(row({ state: "REJECTED" })),
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    });

    const result = await completeMediaAssetUpload(
      c,
      SCOPE,
      {
        id: "asset-1",
        contentLength: 999,
        contentType: "image/jpeg",
        checksum: "etag-1",
      },
      "correlation-4",
    );

    expect(result.kind).toBe("rejected");
    expect(c.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        id: "asset-1",
        state: "PENDING_UPLOAD",
      },
      data: { state: "REJECTED" },
    });
  });

  it("records worker transitions as system audit events without a user id", async () => {
    const c = client({
      mediaAsset: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(row({ state: "UPLOADED" }))
          .mockResolvedValueOnce(row({ state: "SCANNING" })),
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    });
    await markMediaAssetScanning(
      c,
      { ...SCOPE, actorId: "background-worker", actorType: "SYSTEM" },
      "asset-1",
      "correlation-system",
    );
    const audit = c.auditEvent.create as unknown as ReturnType<typeof vi.fn>;
    expect(audit.mock.calls[0]?.[0].data).toMatchObject({
      tenantId: "tenant-1",
      actorType: "SYSTEM",
      action: "MEDIA_SCANNING",
    });
    expect(audit.mock.calls[0]?.[0].data).not.toHaveProperty("userId");
  });

  it("uses compare-and-swap for the processing state transitions", async () => {
    const c = client({
      mediaAsset: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(row({ state: "UPLOADED" }))
          .mockResolvedValueOnce(row({ state: "SCANNING" }))
          .mockResolvedValueOnce(row({ state: "SCANNING" }))
          .mockResolvedValueOnce(row({ state: "PROCESSING" }))
          .mockResolvedValueOnce(row({ state: "PROCESSING" }))
          .mockResolvedValueOnce(row({ state: "READY" })),
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    });
    await expect(
      markMediaAssetScanning(c, SCOPE, "asset-1", "correlation-5"),
    ).resolves.toMatchObject({ kind: "ok" });
    await expect(
      markMediaAssetProcessing(
        c,
        SCOPE,
        "asset-1",
        { width: 1200, height: 800 },
        "correlation-6",
      ),
    ).resolves.toMatchObject({ kind: "ok" });
    await expect(
      markMediaAssetReady(c, SCOPE, "asset-1", "correlation-7"),
    ).resolves.toMatchObject({ kind: "ok" });
    expect(c.auditEvent.create).toHaveBeenCalledTimes(3);
    expect(c.outboxEvent.create).toHaveBeenCalledTimes(3);
  });

  it("lists only ready assets for the exact tenant and wedding", async () => {
    const findMany = vi.fn().mockResolvedValue([row({ state: "READY" })]);
    const repository = new PrismaMediaAssetRepository(
      client({
        mediaAsset: {
          findFirst: vi.fn(),
          findMany,
          create: vi.fn(),
          updateMany: vi.fn(),
        },
      }),
      async (work) => work(client()),
    );

    const assets = await repository.findReadyByIds(
      { tenantId: "tenant-1", weddingId: "wedding-1" },
      ["asset-1", "asset-1", "asset-2"],
    );

    expect(assets).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          weddingId: "wedding-1",
          id: { in: ["asset-1", "asset-2"] },
          state: "READY",
        },
      }),
    );
  });
});

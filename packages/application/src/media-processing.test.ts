import { describe, expect, it, vi } from "vitest";
import {
  createMediaContentInspector,
  detectMediaSignature,
  MEDIA_INSPECTION_MAX_PREFIX_BYTES,
  MEDIA_REJECTION_CODES,
  MediaProcessingRetryableError,
  processMediaAsset,
  type MediaProcessingPorts,
} from "./media-processing";
import type { MediaAsset, MediaAssetRepository } from "./media";

const JOB = {
  idempotencyKey: "media-job-abcdefghijkl",
  assetId: "asset-1",
  tenantId: "tenant-1",
  weddingId: "wedding-1",
} as const;

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  const now = new Date("2026-09-17T00:00:00.000Z");
  return {
    id: JOB.assetId,
    tenantId: JOB.tenantId,
    weddingId: JOB.weddingId,
    objectKey: "tenant-1/wedding-1/media/photo.jpg",
    mediaType: "IMAGE",
    state: "UPLOADED",
    mimeType: "image/jpeg",
    sizeBytes: 1200,
    checksum: "etag-1",
    width: null,
    height: null,
    altText: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function repository(
  current: MediaAsset = asset(),
  overrides: Partial<MediaAssetRepository> = {},
): MediaAssetRepository {
  return {
    createPending: async () => current,
    completeUpload: async () => ({ kind: "ok", asset: current }),
    markScanning: async (_scope, id) => ({
      kind: "ok",
      asset: asset({ id, state: "SCANNING" }),
    }),
    markProcessing: async (_scope, id, dimensions) => ({
      kind: "ok",
      asset: asset({ id, state: "PROCESSING", ...dimensions }),
    }),
    markReady: async (_scope, id) => ({
      kind: "ok",
      asset: asset({ id, state: "READY", width: 1200, height: 800 }),
    }),
    reject: async (_scope, id, reason) => ({
      kind: "rejected",
      reason,
      asset: asset({ id, state: "REJECTED", rejectionReason: reason }),
    }),
    softDelete: async (_scope, id) => ({
      kind: "ok",
      asset: asset({ id, state: "DELETED" }),
    }),
    findById: async () => current,
    listForWedding: async () => [],
    ...overrides,
  };
}

function ports(
  media: MediaAssetRepository,
  overrides: Partial<Omit<MediaProcessingPorts, "media">> = {},
): MediaProcessingPorts {
  return {
    media,
    inspector: {
      inspect: async () => ({
        prefix: new Uint8Array([0xff, 0xd8, 0xff]),
        width: 1200,
        height: 800,
      }),
    },
    scanner: { scan: async () => ({ verdict: "clean" }) },
    derivatives: { generate: async () => undefined },
    ...overrides,
  };
}

describe("media signature detection", () => {
  it("accepts the declared JPEG signature and rejects a spoofed MIME", () => {
    expect(
      detectMediaSignature("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff])),
    ).toBe("JPEG");
    expect(
      detectMediaSignature(
        "image/jpeg",
        new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      ),
    ).toBeNull();
  });
});

describe("media content inspector", () => {
  it("reads a bounded tenant-scoped prefix and extracts PNG dimensions", async () => {
    const prefix = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x01, 0x40, 0x00, 0x00, 0x00, 0xf0,
    ]);
    const readPrefix = vi.fn().mockResolvedValue(prefix);
    const inspector = createMediaContentInspector({ readPrefix });

    await expect(
      inspector.inspect({
        tenantId: "tenant-1",
        objectKey: "tenant-1/wedding-1/media/photo.png",
        mediaType: "IMAGE",
        mimeType: "image/png",
        sizeBytes: 1200,
      }),
    ).resolves.toEqual({ prefix, width: 320, height: 240 });
    expect(readPrefix).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      objectKey: "tenant-1/wedding-1/media/photo.png",
      maxBytes: MEDIA_INSPECTION_MAX_PREFIX_BYTES,
    });
  });

  it("keeps audio dimensions null and rejects an oversized prefix", async () => {
    const readPrefix = vi
      .fn()
      .mockResolvedValueOnce(new Uint8Array([0x49, 0x44, 0x33]))
      .mockResolvedValueOnce(
        new Uint8Array(MEDIA_INSPECTION_MAX_PREFIX_BYTES + 1),
      );
    const inspector = createMediaContentInspector({ readPrefix });

    await expect(
      inspector.inspect({
        tenantId: "tenant-1",
        objectKey: "tenant-1/wedding-1/media/song.mp3",
        mediaType: "AUDIO",
        mimeType: "audio/mpeg",
        sizeBytes: 1200,
      }),
    ).resolves.toMatchObject({ width: null, height: null });
    await expect(
      inspector.inspect({
        tenantId: "tenant-1",
        objectKey: "tenant-1/wedding-1/media/photo.png",
        mediaType: "IMAGE",
        mimeType: "image/png",
        sizeBytes: 1200,
      }),
    ).rejects.toThrow("prefix is invalid");
  });
});

describe("processMediaAsset", () => {
  it("runs scanning, inspection, processing, derivatives, and ready in order", async () => {
    const order: string[] = [];
    const media = repository(asset(), {
      markScanning: async (_scope, id) => {
        order.push("scanning");
        return { kind: "ok", asset: asset({ id, state: "SCANNING" }) };
      },
      markProcessing: async (_scope, id, dimensions) => {
        order.push("processing");
        return {
          kind: "ok",
          asset: asset({ id, state: "PROCESSING", ...dimensions }),
        };
      },
      markReady: async (_scope, id) => {
        order.push("ready");
        return { kind: "ok", asset: asset({ id, state: "READY" }) };
      },
    });
    const result = await processMediaAsset(
      JOB,
      ports(media, {
        inspector: {
          inspect: async () => {
            order.push("inspect");
            return {
              prefix: new Uint8Array([0xff, 0xd8, 0xff]),
              width: 1200,
              height: 800,
            };
          },
        },
        scanner: {
          scan: async () => {
            order.push("scan");
            return { verdict: "clean" };
          },
        },
        derivatives: {
          generate: async () => {
            order.push("derivatives");
          },
        },
      }),
    );

    expect(result.kind).toBe("ready");
    expect(order).toEqual([
      "scanning",
      "inspect",
      "scan",
      "processing",
      "derivatives",
      "ready",
    ]);
  });

  it("rejects a malware verdict without generating derivatives", async () => {
    const generate =
      vi.fn<NonNullable<MediaProcessingPorts["derivatives"]>["generate"]>();
    const result = await processMediaAsset(
      JOB,
      ports(repository(), {
        scanner: { scan: async () => ({ verdict: "malware" }) },
        derivatives: { generate },
      }),
    );
    expect(result).toMatchObject({
      kind: "rejected",
      rejectionCode: MEDIA_REJECTION_CODES.malwareDetected,
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("does not retry provider failures as a rejection", async () => {
    await expect(
      processMediaAsset(
        JOB,
        ports(repository(), {
          inspector: {
            inspect: async () => {
              throw new Error("scanner unavailable");
            },
          },
        }),
      ),
    ).rejects.toBeInstanceOf(MediaProcessingRetryableError);
  });

  it("skips a ready retry idempotently", async () => {
    const media = repository(asset({ state: "READY" }));
    const result = await processMediaAsset(JOB, ports(media));
    expect(result.kind).toBe("skipped");
  });

  it("uses the job tenant and wedding scope for the repository read", async () => {
    const findById = vi
      .fn<MediaAssetRepository["findById"]>()
      .mockResolvedValue(asset());
    const media = repository(asset(), { findById });
    await processMediaAsset(JOB, ports(media));
    expect(findById).toHaveBeenCalledWith(
      { tenantId: JOB.tenantId, weddingId: JOB.weddingId },
      JOB.assetId,
    );
  });
});

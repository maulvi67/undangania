import { describe, expect, it, vi } from "vitest";
import {
  createMediaProcessingPorts,
  MEDIA_PROCESSING_JOB_TYPE,
  processJob,
  type Job,
} from "./index";
import type {
  MediaObjectPrefixReader,
  MediaProcessingPorts,
} from "@wedding/application";

const JOB: Job = {
  id: "job-1",
  type: MEDIA_PROCESSING_JOB_TYPE,
  tenantId: "tenant-1",
  payloadVersion: 1,
  idempotencyKey: "media-job-abcdefghijkl",
  payload: {
    idempotencyKey: "media-job-abcdefghijkl",
    assetId: "asset-1",
    tenantId: "tenant-1",
    weddingId: "wedding-1",
  },
};

function mediaPorts(): MediaProcessingPorts {
  const now = new Date("2026-09-17T00:00:00.000Z");
  const base = {
    id: "asset-1",
    tenantId: "tenant-1",
    weddingId: "wedding-1",
    objectKey: "tenant-1/wedding-1/media/photo.jpg",
    mediaType: "IMAGE",
    state: "READY" as const,
    mimeType: "image/jpeg",
    sizeBytes: 1200,
    checksum: "etag-1",
    width: 1200,
    height: 800,
    altText: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
  };
  return {
    media: {
      createPending: async () => base,
      completeUpload: async () => ({ kind: "ok", asset: base }),
      markScanning: async () => ({ kind: "ok", asset: base }),
      markProcessing: async () => ({ kind: "ok", asset: base }),
      markReady: async () => ({ kind: "ok", asset: base }),
      reject: async () => ({ kind: "ok", asset: base }),
      softDelete: async () => ({ kind: "ok", asset: base }),
      findById: async () => base,
      listForWedding: async () => [],
    },
    inspector: {
      inspect: async () => ({ prefix: new Uint8Array(), width: 1, height: 1 }),
    },
    scanner: { scan: async () => ({ verdict: "clean" }) },
    derivatives: { generate: async () => undefined },
  };
}

describe("background worker", () => {
  it("dispatches a media job through injected application ports", async () => {
    const ports = mediaPorts();
    const findById = vi.spyOn(ports.media, "findById");
    await expect(processJob(JOB, { media: ports })).resolves.toBeUndefined();
    expect(findById).toHaveBeenCalledWith(
      { tenantId: "tenant-1", weddingId: "wedding-1" },
      "asset-1",
    );
  });

  it("rejects malformed payloads before any repository call", async () => {
    const ports = mediaPorts();
    const findById = vi.spyOn(ports.media, "findById");
    await expect(
      processJob({ ...JOB, payload: { assetId: "asset-1" } }, { media: ports }),
    ).rejects.toThrow("Invalid media processing payload");
    expect(findById).not.toHaveBeenCalled();
  });

  it("rejects a media payload whose tenant or idempotency scope differs from the envelope", async () => {
    const ports = mediaPorts();
    const findById = vi.spyOn(ports.media, "findById");
    await expect(
      processJob(
        {
          ...JOB,
          payload: {
            idempotencyKey: JOB.idempotencyKey,
            assetId: "asset-1",
            tenantId: "tenant-2",
            weddingId: "wedding-1",
          },
        },
        { media: ports },
      ),
    ).rejects.toThrow("Invalid media processing job scope");
    await expect(
      processJob(
        {
          ...JOB,
          payload: {
            idempotencyKey: "media-job-qrstuvwx",
            assetId: "asset-1",
            tenantId: "tenant-1",
            weddingId: "wedding-1",
          },
        },
        { media: ports },
      ),
    ).rejects.toThrow("Invalid media processing job scope");
    expect(findById).not.toHaveBeenCalled();
  });

  it("composes a storage-backed inspector without activating scanner or derivative providers", async () => {
    const ports = mediaPorts();
    const objectPrefixReader: MediaObjectPrefixReader = {
      readPrefix: async () =>
        new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
          0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x01, 0x40, 0x00, 0x00,
          0x00, 0xf0,
        ]),
    };
    const composed = createMediaProcessingPorts({
      media: ports.media,
      objectPrefixReader,
      scanner: ports.scanner,
      derivatives: ports.derivatives,
    });

    await expect(
      composed.inspector.inspect({
        tenantId: "tenant-1",
        objectKey: "tenant-1/wedding-1/media/photo.png",
        mediaType: "IMAGE",
        mimeType: "image/png",
        sizeBytes: 1200,
      }),
    ).resolves.toMatchObject({ width: 320, height: 240 });
  });

  it("accepts unknown job types without logging payload data", async () => {
    await expect(
      processJob({ ...JOB, type: "other.job", payload: undefined }),
    ).resolves.toBeUndefined();
  });
});

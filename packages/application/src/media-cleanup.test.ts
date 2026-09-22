import { describe, expect, it, vi } from "vitest";
import {
  dryRunMediaCleanup,
  type MediaCleanupRepository,
} from "./media-cleanup";

const BEFORE = new Date("2026-09-01T00:00:00.000Z");

function repository(): MediaCleanupRepository {
  return {
    listStale: vi.fn().mockResolvedValue([
      {
        assetId: "asset-1",
        weddingId: "wedding-1",
        objectKey: "tenant-1/wedding-1/media/photo.jpg",
        state: "PENDING_UPLOAD",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    ]),
  };
}

describe("dryRunMediaCleanup", () => {
  it("lists bounded stale candidates without exposing a delete operation", async () => {
    const repositoryPort = repository();
    await expect(
      dryRunMediaCleanup(repositoryPort, { tenantId: "tenant-1" }, BEFORE),
    ).resolves.toMatchObject({
      tenantId: "tenant-1",
      before: BEFORE.toISOString(),
      total: 1,
      truncated: false,
    });
    expect(repositoryPort.listStale).toHaveBeenCalledWith(
      { tenantId: "tenant-1" },
      {
        before: BEFORE,
        states: ["PENDING_UPLOAD", "UPLOADED"],
        limit: 101,
      },
    );
  });

  it("truncates a bounded result instead of scheduling destructive work", async () => {
    const repositoryPort: MediaCleanupRepository = {
      listStale: vi.fn().mockResolvedValue([
        {
          assetId: "asset-1",
          weddingId: "wedding-1",
          objectKey: "object-1",
          state: "UPLOADED",
          createdAt: BEFORE,
        },
        {
          assetId: "asset-2",
          weddingId: "wedding-1",
          objectKey: "object-2",
          state: "UPLOADED",
          createdAt: BEFORE,
        },
      ]),
    };
    await expect(
      dryRunMediaCleanup(repositoryPort, { tenantId: "tenant-1" }, BEFORE, 1),
    ).resolves.toMatchObject({ total: 1, truncated: true });
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_RETENTION_MAX_BATCH_SIZE,
  dryRunAnalyticsRetention,
  type AnalyticsRetentionRepository,
} from "./retention";

const BEFORE = new Date("2026-09-01T00:00:00.000Z");

function makeRepository(): {
  repository: AnalyticsRetentionRepository;
  listBefore: ReturnType<typeof vi.fn>;
} {
  const listBefore = vi.fn().mockResolvedValue([
    {
      id: "event-1",
      tenantId: "tenant-1",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    },
  ]);
  return { repository: { listBefore }, listBefore };
}

describe("analytics retention contract", () => {
  it("returns bounded candidates without deleting anything", async () => {
    const { repository, listBefore } = makeRepository();
    await expect(
      dryRunAnalyticsRetention({ repository, before: BEFORE, limit: 50 }),
    ).resolves.toEqual({
      destructive: false,
      before: BEFORE,
      candidates: [
        {
          id: "event-1",
          tenantId: "tenant-1",
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ],
    });
    expect(listBefore).toHaveBeenCalledWith({ before: BEFORE, limit: 50 });
  });

  it("rejects invalid or unbounded retention requests", async () => {
    const { repository } = makeRepository();
    await expect(
      dryRunAnalyticsRetention({
        repository,
        before: new Date("invalid"),
        limit: 50,
      }),
    ).rejects.toThrow();
    await expect(
      dryRunAnalyticsRetention({
        repository,
        before: BEFORE,
        limit: ANALYTICS_RETENTION_MAX_BATCH_SIZE + 1,
      }),
    ).rejects.toThrow();
  });

  it("fails closed when the repository returns out-of-policy candidates", async () => {
    const repository: AnalyticsRetentionRepository = {
      listBefore: vi.fn().mockResolvedValue([
        {
          id: "duplicate",
          tenantId: "tenant-1",
          createdAt: BEFORE,
        },
        {
          id: "duplicate",
          tenantId: "tenant-1",
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ]),
    };

    await expect(
      dryRunAnalyticsRetention({ repository, before: BEFORE, limit: 10 }),
    ).rejects.toThrow("invalid data");
  });
});

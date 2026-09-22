import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  analyticsEventId,
  hashTenantId,
  type AnalyticsEventDraft,
} from "@wedding/analytics";
import {
  AnalyticsRepositoryConsistencyError,
  PrismaAnalyticsRepository,
  type AnalyticsRepositoryClient,
} from "./analytics";

const SECRET = "b".repeat(32);
const NOW = new Date("2026-09-17T10:00:00.000Z");
const SCOPE = { tenantId: "tenant-1" } as const;

const EVENT: AnalyticsEventDraft = {
  id: analyticsEventId(SCOPE.tenantId, "event-key-abcdefghijkl"),
  name: "invitation_viewed",
  schemaVersion: 1,
  tenantIdHash: hashTenantId(SCOPE.tenantId, SECRET),
  actorHash: null,
  properties: { source: "direct", device: "desktop" },
  occurredAt: NOW,
  acceptedAt: NOW,
};

function row(event: AnalyticsEventDraft = EVENT) {
  return {
    id: event.id,
    tenantId: SCOPE.tenantId,
    aggregateType: "AnalyticsEvent",
    eventType: "AnalyticsEventAccepted",
    payload: {
      eventId: event.id,
      eventName: event.name,
      schemaVersion: event.schemaVersion,
      tenantIdHash: event.tenantIdHash,
      actorHash: event.actorHash,
      properties: event.properties,
      occurredAt: event.occurredAt.toISOString(),
    },
    createdAt: event.acceptedAt,
  };
}

function client(
  overrides: Record<string, unknown> = {},
): AnalyticsRepositoryClient {
  return {
    outboxEvent: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(row()),
      ...((overrides.outboxEvent as object) ?? {}),
    },
  };
}

describe("PrismaAnalyticsRepository", () => {
  it("writes a privacy-safe event to the existing outbox model", async () => {
    const c = client();
    const result = await new PrismaAnalyticsRepository(c).append(SCOPE, EVENT);

    expect(result).toEqual({ kind: "created", event: EVENT });
    expect(c.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        id: EVENT.id,
        tenantId: SCOPE.tenantId,
        eventType: "AnalyticsEventAccepted",
        aggregateType: "AnalyticsEvent",
        aggregateId: EVENT.id,
        payload: {
          eventId: EVENT.id,
          eventName: EVENT.name,
          schemaVersion: 1,
          tenantIdHash: EVENT.tenantIdHash,
          actorHash: null,
          properties: EVENT.properties,
          occurredAt: NOW.toISOString(),
        },
        payloadVersion: 1,
        createdAt: NOW,
      },
      select: expect.anything(),
    });
    const create = c.outboxEvent.create as unknown as ReturnType<typeof vi.fn>;
    const createData = create.mock.calls[0]?.[0].data as {
      payload: Record<string, unknown>;
    };
    expect(JSON.stringify(createData.payload)).not.toContain(SCOPE.tenantId);
  });

  it("returns an existing event for a replay", async () => {
    const c = client({
      outboxEvent: { findFirst: vi.fn().mockResolvedValue(row()) },
    });
    await expect(
      new PrismaAnalyticsRepository(c).append(SCOPE, EVENT),
    ).resolves.toEqual({
      kind: "existing",
      event: EVENT,
    });
    expect(c.outboxEvent.create).not.toHaveBeenCalled();
  });

  it("re-reads after a concurrent unique-key race", async () => {
    const c = client({
      outboxEvent: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(row()),
        create: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("duplicate", {
            code: "P2002",
            clientVersion: "6.0.0",
          }),
        ),
      },
    });
    await expect(
      new PrismaAnalyticsRepository(c).append(SCOPE, EVENT),
    ).resolves.toEqual({
      kind: "existing",
      event: EVENT,
    });
    expect(c.outboxEvent.findFirst).toHaveBeenCalledTimes(2);
    expect(c.outboxEvent.findFirst).toHaveBeenCalledWith({
      where: { id: EVENT.id, tenantId: SCOPE.tenantId },
      select: expect.anything(),
    });
  });

  it("rejects a stored row with the wrong aggregate metadata", async () => {
    const c = client({
      outboxEvent: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ ...row(), aggregateType: "Payment" }]),
      },
    });
    const range = {
      from: new Date("2026-09-17T00:00:00.000Z"),
      to: new Date("2026-09-18T00:00:00.000Z"),
    };
    await expect(
      new PrismaAnalyticsRepository(c).listAccepted(SCOPE, range),
    ).rejects.toBeInstanceOf(AnalyticsRepositoryConsistencyError);
  });

  it("applies tenant and time filters to reports", async () => {
    const c = client({
      outboxEvent: { findMany: vi.fn().mockResolvedValue([row()]) },
    });
    const range = {
      from: new Date("2026-09-17T00:00:00.000Z"),
      to: new Date("2026-09-18T00:00:00.000Z"),
    };
    await new PrismaAnalyticsRepository(c).listAccepted(SCOPE, range);
    expect(c.outboxEvent.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: SCOPE.tenantId,
        aggregateType: "AnalyticsEvent",
        eventType: "AnalyticsEventAccepted",
        createdAt: { gte: range.from, lt: range.to },
      },
      orderBy: { createdAt: "asc" },
      take: 10001,
      select: expect.anything(),
    });
  });

  it("lists only bounded analytics retention candidates", async () => {
    const c = client({
      outboxEvent: { findMany: vi.fn().mockResolvedValue([row()]) },
    });
    const before = new Date("2026-09-18T00:00:00.000Z");

    await expect(
      new PrismaAnalyticsRepository(c).listBefore({ before, limit: 25 }),
    ).resolves.toEqual([
      {
        id: EVENT.id,
        tenantId: SCOPE.tenantId,
        createdAt: NOW,
      },
    ]);
    expect(c.outboxEvent.findMany).toHaveBeenCalledWith({
      where: {
        aggregateType: "AnalyticsEvent",
        eventType: "AnalyticsEventAccepted",
        createdAt: { lt: before },
      },
      orderBy: { createdAt: "asc" },
      take: 25,
      select: expect.anything(),
    });
  });
});

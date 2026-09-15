import { describe, expect, it, vi } from "vitest";
import { hashSessionToken } from "../tokens";
import { PrismaSessionRepository } from "./session";

const now = new Date("2026-09-14T00:00:00.000Z");
const expiresAt = new Date("2026-09-15T00:00:00.000Z");

function sessionRow(tokenHash: string) {
  return {
    id: "session-1",
    tokenHash,
    userId: "user-1",
    expiresAt,
    revokedAt: null,
    createdAt: now,
    lastSeenAt: null,
  };
}

describe("PrismaSessionRepository", () => {
  it("creates a session with a digest and returns the raw token once", async () => {
    const create = vi.fn().mockResolvedValue(sessionRow("digest"));
    const repository = new PrismaSessionRepository({
      session: {
        create,
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
    });

    const result = await repository.create("user-1", expiresAt);
    const data = create.mock.calls[0]?.[0].data as {
      tokenHash: string;
      userId: string;
      expiresAt: Date;
    };

    expect(data.userId).toBe("user-1");
    expect(data.expiresAt).toBe(expiresAt);
    expect(data.tokenHash).toHaveLength(64);
    expect(result.token).not.toBe(data.tokenHash);
    expect(result.session).not.toHaveProperty("tokenHash");
  });

  it("looks up only active, unrevoked, unexpired sessions for active users", async () => {
    const token = "session-token";
    const findFirst = vi
      .fn()
      .mockResolvedValue(sessionRow(hashSessionToken(token)));
    const repository = new PrismaSessionRepository({
      session: {
        create: vi.fn(),
        findFirst,
        updateMany: vi.fn(),
      },
    });

    await expect(
      repository.findActiveByToken(token, now),
    ).resolves.toMatchObject({
      id: "session-1",
      userId: "user-1",
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tokenHash: hashSessionToken(token),
          revokedAt: null,
          expiresAt: { gt: now },
          user: { status: "ACTIVE" },
        },
      }),
    );
  });

  it("does not return a row when the stored digest does not match", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValue(sessionRow(hashSessionToken("other-token")));
    const repository = new PrismaSessionRepository({
      session: {
        create: vi.fn(),
        findFirst,
        updateMany: vi.fn(),
      },
    });

    await expect(
      repository.findActiveByToken("session-token", now),
    ).resolves.toBeNull();
  });

  it("limits touch and revoke operations to valid or active sessions", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new PrismaSessionRepository({
      session: {
        create: vi.fn(),
        findFirst: vi.fn(),
        updateMany,
      },
    });

    await expect(repository.touch("session-1", now)).resolves.toBe(true);
    await expect(repository.revokeById("session-1", now)).resolves.toBe(true);
    await expect(repository.revokeAllForUser("user-1", now)).resolves.toBe(1);

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "session-1", revokedAt: null, expiresAt: { gt: now } },
      data: { lastSeenAt: now },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "session-1", revokedAt: null },
      data: { revokedAt: now },
    });
    expect(updateMany).toHaveBeenNthCalledWith(3, {
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: now },
    });
  });
});

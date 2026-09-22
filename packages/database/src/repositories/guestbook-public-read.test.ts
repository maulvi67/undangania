import { describe, expect, it, vi } from "vitest";
import {
  decodeApprovedGuestbookCursor,
  encodeApprovedGuestbookCursor,
  PrismaApprovedGuestbookRepository,
  PUBLIC_GUESTBOOK_MAX_PAGE_SIZE,
  PUBLIC_GUESTBOOK_PAGE_SIZE,
  type GuestbookPublicReadClient,
} from "./guestbook-public-read";

const FIRST = new Date("2026-09-16T10:00:00.000Z");
const SECOND = new Date("2026-09-15T10:00:00.000Z");

function row(id: string, submittedAt: Date) {
  return {
    id,
    displayName: `Tamu ${id}`,
    message: `Ucapan ${id}`,
    submittedAt,
  };
}

function client(
  findMany: ReturnType<typeof vi.fn>,
): GuestbookPublicReadClient {
  return { guestbookMessage: { findMany } };
}

describe("approved guestbook cursor", () => {
  it("round-trips only the stable ordering keys", () => {
    const encoded = encodeApprovedGuestbookCursor({
      id: "message-1",
      submittedAt: FIRST,
    });

    expect(decodeApprovedGuestbookCursor(encoded)).toEqual({
      id: "message-1",
      submittedAt: FIRST,
    });
  });

  it("rejects malformed or oversized cursors", () => {
    expect(decodeApprovedGuestbookCursor("not-a-cursor")).toBeNull();
    expect(decodeApprovedGuestbookCursor("a".repeat(257))).toBeNull();
  });
});

describe("PrismaApprovedGuestbookRepository", () => {
  it("returns approved rows in keyset order and scopes the query", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        row("message-3", FIRST),
        row("message-2", SECOND),
        row("message-1", new Date("2026-09-14T10:00:00.000Z")),
      ]);
    const repository = new PrismaApprovedGuestbookRepository(client(findMany));

    await expect(
      repository.loadApproved(
        { tenantId: "tenant-1", weddingId: "wedding-1" },
        { limit: 2 },
      ),
    ).resolves.toMatchObject({
      rows: [row("message-3", FIRST), row("message-2", SECOND)],
      nextCursor: expect.any(String),
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        moderationStatus: "APPROVED",
      },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        displayName: true,
        message: true,
        submittedAt: true,
      },
      take: 3,
    });
  });

  it("uses the cursor as a strict keyset boundary", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaApprovedGuestbookRepository(client(findMany));
    const cursor = encodeApprovedGuestbookCursor({
      id: "message-2",
      submittedAt: SECOND,
    });

    await repository.loadApproved(
      { tenantId: "tenant-1", weddingId: "wedding-1" },
      { cursor, limit: 4 },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          weddingId: "wedding-1",
          moderationStatus: "APPROVED",
          OR: [
            { submittedAt: { lt: SECOND } },
            { submittedAt: SECOND, id: { lt: "message-2" } },
          ],
        },
        take: 5,
      }),
    );
  });

  it("starts at the first page for an invalid cursor and bounds the page size", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaApprovedGuestbookRepository(client(findMany));

    await repository.loadApproved(
      { tenantId: "tenant-1", weddingId: "wedding-1" },
      { cursor: "invalid", limit: 999 },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          weddingId: "wedding-1",
          moderationStatus: "APPROVED",
        },
        take: PUBLIC_GUESTBOOK_MAX_PAGE_SIZE + 1,
      }),
    );
    expect(PUBLIC_GUESTBOOK_PAGE_SIZE).toBeGreaterThan(0);
  });

  it("does not produce a next cursor when the page is complete", async () => {
    const findMany = vi.fn().mockResolvedValue([row("message-1", FIRST)]);
    const repository = new PrismaApprovedGuestbookRepository(client(findMany));

    await expect(
      repository.loadApproved({ tenantId: "tenant-1", weddingId: "wedding-1" }),
    ).resolves.toEqual({
      rows: [row("message-1", FIRST)],
      nextCursor: null,
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { hashToken } from "../tokens";
import {
  PrismaGuestAccessRepository,
  isWellFormedGuestToken,
} from "./guest-access";

const VALID_TOKEN = "a".repeat(43);
const INVITATION_SLUG = "rani-bima-1a2b3c4d";

function client(findFirst: ReturnType<typeof vi.fn>) {
  return { guestHousehold: { findFirst } };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "household-1",
    tenantId: "tenant-1",
    weddingId: "wedding-1",
    displayName: "Keluarga Rahman",
    maximumPax: 4,
    status: "ACTIVE",
    wedding: {
      timezone: "Asia/Jakarta",
      events: [],
      invitation: {
        slug: "rani-bima-1a2b3c4d",
        status: "PUBLISHED",
        publications: [],
      },
    },
    rsvps: [],
    ...overrides,
  };
}

describe("isWellFormedGuestToken", () => {
  it("accepts the shape the token generator emits", () => {
    expect(isWellFormedGuestToken(VALID_TOKEN)).toBe(true);
    expect(isWellFormedGuestToken("A-z0_9".repeat(6))).toBe(true);
  });

  it("rejects anything that could not be a generated token", () => {
    const rejected = [
      "",
      "short",
      "a".repeat(31),
      "a".repeat(513),
      "has space".padEnd(32, "a"),
      `${"a".repeat(31)}!`,
      `${"a".repeat(31)}.`,
      `${"a".repeat(31)}%`,
      `${"a".repeat(31)}+`,
    ];
    for (const token of rejected) {
      expect(isWellFormedGuestToken(token)).toBe(false);
    }
  });
});

describe("PrismaGuestAccessRepository", () => {
  it("hashes the token and returns the mapped household", async () => {
    const findFirst = vi.fn().mockResolvedValue(
      row({
        events: undefined,
        wedding: {
          timezone: "Asia/Jakarta",
          events: [
            {
              id: "event-1",
              title: "Akad Nikah",
              startsAt: new Date("2026-11-01T01:00:00.000Z"),
              timezone: "Asia/Jakarta",
              venueName: "Masjid Al-Azhar",
              addressSnapshot: "Jl. Sisingamangaraja",
              mapUrl: "https://maps.example.com/akad",
            },
          ],
          invitation: {
            slug: "rani-bima-1a2b3c4d",
            status: "PUBLISHED",
            publications: [{ id: "p1" }],
          },
        },
        rsvps: [
          {
            eventId: "event-1",
            response: "ATTENDING",
            pax: 2,
            optimisticVersion: 3,
          },
        ],
      }),
    );
    const repository = new PrismaGuestAccessRepository(client(findFirst));

    await expect(
      repository.resolveByToken(VALID_TOKEN, INVITATION_SLUG),
    ).resolves.toEqual({
      householdId: "household-1",
      tenantId: "tenant-1",
      weddingId: "wedding-1",
      displayName: "Keluarga Rahman",
      maximumPax: 4,
      status: "ACTIVE",
      timezone: "Asia/Jakarta",
      slug: "rani-bima-1a2b3c4d",
      invitationStatus: "PUBLISHED",
      published: true,
      events: [
        {
          id: "event-1",
          title: "Akad Nikah",
          startsAt: new Date("2026-11-01T01:00:00.000Z"),
          timezone: "Asia/Jakarta",
          venueName: "Masjid Al-Azhar",
          address: "Jl. Sisingamangaraja",
          mapUrl: "https://maps.example.com/akad",
        },
      ],
      rsvps: [
        {
          eventId: "event-1",
          response: "ATTENDING",
          pax: 2,
          optimisticVersion: 3,
        },
      ],
    });

    // The raw token must never reach the query; only its hash does. Anything
    // else would leave a usable credential in a query log.
    const args = findFirst.mock.calls[0]?.[0] as { where: unknown };
    expect(args.where).toEqual({
      tokenHash: hashToken(VALID_TOKEN),
      wedding: { invitation: { slug: INVITATION_SLUG } },
    });
    expect(JSON.stringify(args.where)).not.toContain(VALID_TOKEN);
  });

  it("reports a malformed token as null without querying", async () => {
    const findFirst = vi.fn();
    const repository = new PrismaGuestAccessRepository(client(findFirst));

    for (const token of [
      "",
      "too-short",
      "../../etc/passwd",
      "a".repeat(600),
    ]) {
      await expect(
        repository.resolveByToken(token, INVITATION_SLUG),
      ).resolves.toBe(null);
    }
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("reports an unknown token as null", async () => {
    const repository = new PrismaGuestAccessRepository(
      client(vi.fn().mockResolvedValue(null)),
    );

    await expect(
      repository.resolveByToken(VALID_TOKEN, INVITATION_SLUG),
    ).resolves.toBe(null);
  });

  it("binds a token lookup to the current invitation slug", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaGuestAccessRepository(client(findFirst));

    await expect(
      repository.resolveByToken(VALID_TOKEN, "other-invitation"),
    ).resolves.toBe(null);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tokenHash: hashToken(VALID_TOKEN),
          wedding: { invitation: { slug: "other-invitation" } },
        },
      }),
    );
  });

  it("rejects an invalid invitation slug without querying", async () => {
    const findFirst = vi.fn();
    const repository = new PrismaGuestAccessRepository(client(findFirst));

    await expect(
      repository.resolveByToken(VALID_TOKEN, "../other-invitation"),
    ).resolves.toBe(null);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("reports an unpublished invitation without failing the lookup", async () => {
    const repository = new PrismaGuestAccessRepository(
      client(
        vi.fn().mockResolvedValue(
          row({
            wedding: {
              timezone: "Asia/Makassar",
              events: [],
              invitation: {
                slug: "rani-bima-1a2b3c4d",
                status: "DRAFT",
                publications: [],
              },
            },
          }),
        ),
      ),
    );

    const resolved = await repository.resolveByToken(
      VALID_TOKEN,
      INVITATION_SLUG,
    );
    expect(resolved?.published).toBe(false);
    expect(resolved?.timezone).toBe("Asia/Makassar");
  });

  it("reports a wedding with no invitation yet", async () => {
    const repository = new PrismaGuestAccessRepository(
      client(
        vi.fn().mockResolvedValue(
          row({
            wedding: {
              timezone: "Asia/Jakarta",
              events: [],
              invitation: null,
            },
          }),
        ),
      ),
    );

    const resolved = await repository.resolveByToken(
      VALID_TOKEN,
      INVITATION_SLUG,
    );
    expect(resolved?.slug).toBe(null);
    expect(resolved?.published).toBe(false);
  });

  it("never returns contact values or token material", async () => {
    const repository = new PrismaGuestAccessRepository(
      client(vi.fn().mockResolvedValue(row())),
    );

    const resolved = await repository.resolveByToken(
      VALID_TOKEN,
      INVITATION_SLUG,
    );
    const serialized = JSON.stringify(resolved);
    for (const forbidden of [
      "tokenHash",
      VALID_TOKEN,
      hashToken(VALID_TOKEN),
      "phoneEncrypted",
      "phoneHash",
      "emailEncrypted",
      "emailHash",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

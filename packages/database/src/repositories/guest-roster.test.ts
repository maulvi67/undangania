import { describe, expect, it, vi } from "vitest";
import {
  PrismaGuestRosterRepository,
  type GuestRosterRepository,
} from "./guest-roster";

function householdRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "hh-1",
    displayName: "Keluarga Rahman",
    maximumPax: 4,
    tokenVersion: 1,
    status: "ACTIVE",
    tags: [],
    eventAccess: [],
    updatedAt: new Date("2026-09-11T08:00:00.000Z"),
    _count: { guests: 2 },
    guests: [
      { id: "g-1", displayName: "Ahmad Rahman", category: "ADULT" },
      { id: "g-2", displayName: "Siti Rahman", category: "ADULT" },
    ],
    ...overrides,
  };
}

function client(overrides: Record<string, unknown> = {}) {
  const guestHousehold = {
    findFirst: vi.fn().mockResolvedValue(null),
    findFirstContact: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(householdRow()),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    ...((overrides.guestHousehold as object) ?? {}),
  };
  return {
    wedding: {
      findFirst: vi.fn().mockResolvedValue({ id: "w-1" }),
      ...((overrides.wedding as object) ?? {}),
    },
    weddingEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      ...((overrides.weddingEvent as object) ?? {}),
    },
    guestHousehold,
    guest: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      ...((overrides.guest as object) ?? {}),
    },
    guestEventAccess: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      ...((overrides.guestEventAccess as object) ?? {}),
    },
    auditEvent: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      ...((overrides.auditEvent as object) ?? {}),
    },
  };
}

/**
 * The fake delegates are `vi.fn()`s, but their declared type is the port's own
 * signature. This reads recorded calls without weakening that type.
 */
function calls<T>(fn: unknown): readonly (readonly [T])[] {
  return (fn as { mock: { calls: readonly (readonly [T])[] } }).mock.calls;
}

const SCOPE = { tenantId: "t-1", weddingId: "w-1" };

describe("PrismaGuestRosterRepository.loadOverview", () => {
  it("maps households, events, and the guest total", async () => {
    const c = client({
      weddingEvent: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "e-1", title: "Akad Nikah" }]),
      },
      guestHousehold: {
        findMany: vi.fn().mockResolvedValue([
          householdRow(),
          householdRow({
            id: "hh-2",
            displayName: "Keluarga Wulandari",
            maximumPax: 2,
            _count: { guests: 3 },
            guests: [],
          }),
        ]),
      },
    });

    await expect(
      new PrismaGuestRosterRepository(c).loadOverview(SCOPE),
    ).resolves.toEqual({
      events: [{ id: "e-1", title: "Akad Nikah" }],
      households: [
        {
          id: "hh-1",
          displayName: "Keluarga Rahman",
          maximumPax: 4,
          memberCount: 2,
          tags: [],
          eventIds: ["e-1"],
          linkStatus: "ACTIVE",
          updatedAt: new Date("2026-09-11T08:00:00.000Z"),
        },
        {
          id: "hh-2",
          displayName: "Keluarga Wulandari",
          maximumPax: 2,
          memberCount: 3,
          tags: [],
          eventIds: ["e-1"],
          linkStatus: "ACTIVE",
          updatedAt: new Date("2026-09-11T08:00:00.000Z"),
        },
      ],
      totalGuests: 5,
    });
  });

  it("scopes both reads by tenant and wedding", async () => {
    const c = client();
    await new PrismaGuestRosterRepository(c).loadOverview(SCOPE);

    expect(c.weddingEvent.findMany).toHaveBeenCalledWith({
      where: { tenantId: "t-1", weddingId: "w-1" },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { id: true, title: true },
    });
    expect(c.guestHousehold.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "t-1",
        weddingId: "w-1",
        status: { not: "DELETED" },
        wedding: { tenantId: "t-1" },
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      select: expect.anything(),
    });
  });

  it("reports an unrecognized link status as disabled", async () => {
    const c = client({
      guestHousehold: {
        findMany: vi
          .fn()
          .mockResolvedValue([householdRow({ status: "DELETED" })]),
      },
    });

    const overview = await new PrismaGuestRosterRepository(c).loadOverview(
      SCOPE,
    );
    expect(overview.households[0]?.linkStatus).toBe("DISABLED");
  });
});

describe("PrismaGuestRosterRepository.findById", () => {
  it("reports contact presence without selecting ciphertext", async () => {
    const c = client({
      guestHousehold: {
        findFirst: vi.fn().mockResolvedValue(householdRow()),
        findFirstContact: vi.fn().mockResolvedValue({
          id: "hh-1",
          tokenVersion: 3,
          phoneHash: "hash-phone",
          emailHash: null,
        }),
      },
    });

    const detail = await new PrismaGuestRosterRepository(c).findById(
      SCOPE,
      "hh-1",
    );
    expect(detail).toMatchObject({
      id: "hh-1",
      memberCount: 2,
      linkStatus: "ACTIVE",
      tokenVersion: 1,
      hasPhone: true,
      hasEmail: false,
      members: [
        { id: "g-1", displayName: "Ahmad Rahman", category: "ADULT" },
        { id: "g-2", displayName: "Siti Rahman", category: "ADULT" },
      ],
    });

    // The presence read must not reach for the encrypted columns: selecting them
    // would put confidential data on a path with no use for it.
    const contactArgs = calls<{
      select: Record<string, boolean>;
    }>(c.guestHousehold.findFirstContact)[0]?.[0];
    expect(Object.keys(contactArgs?.select ?? {}).sort()).toEqual([
      "emailHash",
      "id",
      "phoneHash",
      "tokenVersion",
    ]);
  });

  it("returns null when the household is outside the scope", async () => {
    const c = client();
    await expect(
      new PrismaGuestRosterRepository(c).findById(SCOPE, "hh-other"),
    ).resolves.toBe(null);
  });
});

describe("PrismaGuestRosterRepository.create", () => {
  it("refuses a wedding the tenant does not own", async () => {
    const c = client({
      wedding: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      new PrismaGuestRosterRepository(c).create(SCOPE, {
        displayName: "Keluarga Baru",
        maximumPax: 2,
        members: [{ displayName: "Tamu", category: "ADULT" }],
      }),
    ).resolves.toBe(null);
    expect(c.guestHousehold.create).not.toHaveBeenCalled();
  });

  it("hashes the generated token and never stores the plaintext", async () => {
    const c = client({
      guestHousehold: {
        findFirst: vi.fn().mockResolvedValue(householdRow()),
        findFirstContact: vi.fn().mockResolvedValue({
          id: "hh-1",
          tokenVersion: 1,
          phoneHash: null,
          emailHash: null,
        }),
      },
    });

    await new PrismaGuestRosterRepository(c).create(SCOPE, {
      displayName: "Keluarga Baru",
      maximumPax: 2,
      members: [{ displayName: "Tamu Satu", category: "ADULT" }],
    });

    const args = calls<{ data: Record<string, unknown> }>(
      c.guestHousehold.create,
    )[0]?.[0];
    expect(args?.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(args?.data.tokenVersion).toBe(1);
    expect(args?.data.status).toBe("ACTIVE");
    expect(JSON.stringify(args?.data)).not.toContain("tokenHash: undefined");
  });

  it("writes the member list as guests scoped to the new household", async () => {
    const c = client({
      guestHousehold: {
        findFirst: vi.fn().mockResolvedValue(householdRow()),
        findFirstContact: vi.fn().mockResolvedValue({
          id: "hh-1",
          tokenVersion: 1,
          phoneHash: null,
          emailHash: null,
        }),
      },
    });

    await new PrismaGuestRosterRepository(c).create(SCOPE, {
      displayName: "Keluarga Baru",
      maximumPax: 2,
      members: [
        { displayName: "Tamu Satu", category: "ADULT" },
        { displayName: "Tamu Kecil", category: "CHILD" },
      ],
    });

    expect(c.guest.createMany).toHaveBeenCalledWith({
      data: [
        {
          tenantId: "t-1",
          householdId: "hh-1",
          displayName: "Tamu Satu",
          category: "ADULT",
          status: "ACTIVE",
        },
        {
          tenantId: "t-1",
          householdId: "hh-1",
          displayName: "Tamu Kecil",
          category: "CHILD",
          status: "ACTIVE",
        },
      ],
    });
  });
});

describe("PrismaGuestRosterRepository.update", () => {
  it("proves ownership before touching the member list", async () => {
    const c = client({
      guestHousehold: {
        findFirst: vi.fn().mockResolvedValue(null),
        findFirstContact: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(
      new PrismaGuestRosterRepository(c).update(SCOPE, "hh-other", {
        members: [{ displayName: "Injected", category: "ADULT" }],
      }),
    ).resolves.toBe(null);

    // The guard has to run first: a member replacement issued before an ownership
    // check would let a crafted household id write into another tenant's roster.
    expect(c.guest.createMany).not.toHaveBeenCalled();
    expect(c.guest.deleteMany).not.toHaveBeenCalled();
  });

  it("leaves the member list alone when members is absent", async () => {
    const c = client({
      guestHousehold: {
        findFirst: vi.fn().mockResolvedValue(householdRow()),
        findFirstContact: vi.fn().mockResolvedValue({
          id: "hh-1",
          tokenVersion: 1,
          phoneHash: null,
          emailHash: null,
        }),
      },
    });

    await new PrismaGuestRosterRepository(c).update(SCOPE, "hh-1", {
      displayName: "Nama Baru",
    });

    expect(c.guestHousehold.updateMany).toHaveBeenCalledWith({
      where: {
        id: "hh-1",
        tenantId: "t-1",
        weddingId: "w-1",
        status: { not: "DELETED" },
        wedding: { tenantId: "t-1" },
      },
      data: { displayName: "Nama Baru" },
    });
    expect(c.guest.deleteMany).not.toHaveBeenCalled();
  });

  it("replaces the member list when members is provided", async () => {
    const c = client({
      guestHousehold: {
        findFirst: vi.fn().mockResolvedValue(householdRow()),
        findFirstContact: vi.fn().mockResolvedValue({
          id: "hh-1",
          tokenVersion: 1,
          phoneHash: null,
          emailHash: null,
        }),
      },
    });

    await new PrismaGuestRosterRepository(c).update(SCOPE, "hh-1", {
      members: [{ displayName: "Hanya Satu", category: "OTHER" }],
    });

    expect(c.guest.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: "t-1", householdId: "hh-1" },
    });
  });
});

describe("PrismaGuestRosterRepository.rotateLink", () => {
  it("increments the version and returns the plaintext once", async () => {
    const c = client({
      guestHousehold: {
        findFirstContact: vi
          .fn()
          .mockResolvedValue({ id: "hh-1", tokenVersion: 4 }),
      },
    });

    const rotated = await new PrismaGuestRosterRepository(c).rotateLink(
      SCOPE,
      "hh-1",
    );

    expect(rotated?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rotated?.tokenVersion).toBe(4);
    // `increment` rather than a read-then-write, so two concurrent rotations cannot
    // settle on the same version.
    const args = calls<{ data: Record<string, unknown> }>(
      c.guestHousehold.updateMany,
    )[0]?.[0];
    expect(args?.data.tokenVersion).toEqual({ increment: 1 });
    expect(args?.data.status).toBe("ACTIVE");
    expect(typeof args?.data.tokenHash).toBe("string");
    // The plaintext is not part of the write.
    expect(JSON.stringify(args?.data)).not.toContain(rotated?.token);
  });

  it("returns null when the household is out of scope", async () => {
    const c = client({
      guestHousehold: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });

    await expect(
      new PrismaGuestRosterRepository(c).rotateLink(SCOPE, "hh-other"),
    ).resolves.toBe(null);
  });
});

describe("PrismaGuestRosterRepository.setLinkStatus", () => {
  it("reports whether the row was actually updated", async () => {
    const repository: GuestRosterRepository = new PrismaGuestRosterRepository(
      client({
        guestHousehold: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      }),
    );

    await expect(
      repository.setLinkStatus(SCOPE, "hh-missing", "DISABLED"),
    ).resolves.toBe(false);
  });
});

describe("PrismaGuestRosterRepository.exportRoster", () => {
  it("exports only scoped households and records non-PII audit metadata", async () => {
    const c = client({
      weddingEvent: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "e-1", title: "Akad Nikah" }]),
      },
      guestHousehold: {
        findMany: vi.fn().mockResolvedValue([householdRow()]),
      },
    });

    const result = await new PrismaGuestRosterRepository(c).exportRoster(
      SCOPE,
      {
        householdIds: ["hh-1"],
        actorId: "user-1",
        correlationId: "corr-1",
      },
    );

    expect(result).toEqual({
      rows: [
        {
          householdName: "Keluarga Rahman",
          guestName: "Ahmad Rahman",
          category: "ADULT",
          maximumPax: 4,
          eventNames: ["Akad Nikah"],
          linkStatus: "ACTIVE",
        },
        {
          householdName: "Keluarga Rahman",
          guestName: "Siti Rahman",
          category: "ADULT",
          maximumPax: 4,
          eventNames: ["Akad Nikah"],
          linkStatus: "ACTIVE",
        },
      ],
      householdCount: 1,
      guestCount: 2,
    });

    expect(c.guestHousehold.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["hh-1"] },
        tenantId: "t-1",
        weddingId: "w-1",
        status: { not: "DELETED" },
        wedding: { tenantId: "t-1" },
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      select: expect.anything(),
    });
    expect(c.auditEvent.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t-1",
        userId: "user-1",
        actorType: "USER",
        action: "GUEST_ROSTER_EXPORTED",
        targetType: "GuestRoster",
        targetId: "w-1",
        metadata: { householdCount: 1, guestCount: 2, selectedOnly: true },
        correlationId: "corr-1",
      },
    });
    expect(JSON.stringify(c.auditEvent.create.mock.calls)).not.toContain(
      "Ahmad Rahman",
    );
  });

  it("fails closed when a selected household is outside the tenant wedding", async () => {
    const auditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
    const c = client({
      guestHousehold: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      auditEvent: { create: auditCreate },
    });

    await expect(
      new PrismaGuestRosterRepository(c).exportRoster(SCOPE, {
        householdIds: ["hh-other"],
        actorId: "user-1",
        correlationId: "corr-2",
      }),
    ).resolves.toBe(null);
    expect(auditCreate).not.toHaveBeenCalled();
  });
});

describe("PrismaGuestRosterRepository organization", () => {
  it("stores tags and event access when creating a household", async () => {
    const c = client({
      weddingEvent: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "e-1", title: "Akad Nikah" }]),
      },
    });

    await new PrismaGuestRosterRepository(c).create(SCOPE, {
      displayName: "Keluarga Baru",
      maximumPax: 2,
      members: [{ displayName: "Tamu", category: "ADULT" }],
      eventIds: ["e-1"],
      tags: ["Keluarga besar"],
    });

    const args = calls<{ data: Record<string, unknown> }>(
      c.guestHousehold.create,
    )[0]?.[0];
    expect(args?.data.tags).toEqual(["Keluarga besar"]);
    expect(c.guestEventAccess.createMany).toHaveBeenCalledWith({
      data: [{ tenantId: "t-1", householdId: "hh-1", eventId: "e-1" }],
    });
  });

  it("refuses an event id that belongs to another wedding", async () => {
    const c = client({
      weddingEvent: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "e-1", title: "Akad Nikah" }]),
      },
    });

    await expect(
      new PrismaGuestRosterRepository(c).create(SCOPE, {
        displayName: "Keluarga Baru",
        maximumPax: 2,
        members: [{ displayName: "Tamu", category: "ADULT" }],
        eventIds: ["e-other"],
      }),
    ).resolves.toBe(null);
    expect(c.guestHousehold.create).not.toHaveBeenCalled();
  });

  it("soft-deletes a household while keeping history", async () => {
    const c = client();

    await expect(
      new PrismaGuestRosterRepository(c).delete(SCOPE, "hh-1"),
    ).resolves.toBe(true);

    expect(c.guestHousehold.updateMany).toHaveBeenCalledWith({
      where: {
        id: "hh-1",
        tenantId: "t-1",
        weddingId: "w-1",
        status: { not: "DELETED" },
        wedding: { tenantId: "t-1" },
      },
      data: { status: "DELETED" },
    });
  });
});

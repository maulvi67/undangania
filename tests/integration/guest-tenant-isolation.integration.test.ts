import { randomUUID } from "node:crypto";
import {
  createPrismaClient,
  PrismaGuestHouseholdRepository,
  PrismaTenantMembershipRepository,
} from "@wedding/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertHouseholdBelongsToWorkspace,
  tenantScopedGuestResourceKey,
} from "../../apps/customer-web/src/lib/guests/stub-transport";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (testDatabaseUrl === undefined || testDatabaseUrl.length === 0) {
  throw new Error(
    "TEST_DATABASE_URL is required for guest tenant isolation integration tests. " +
      "Set it to an isolated test PostgreSQL database; DATABASE_URL is intentionally not used.",
  );
}

const testPrisma = createPrismaClient(testDatabaseUrl);

const guestHouseholds = new PrismaGuestHouseholdRepository(testPrisma);
const memberships = new PrismaTenantMembershipRepository(testPrisma);

type SyntheticFixture = Readonly<{
  tenantAId: string;
  tenantBId: string;
  userAId: string;
  userBId: string;
  membershipAId: string;
  membershipBId: string;
  weddingAId: string;
  weddingBId: string;
  householdAId: string;
  householdBId: string;
}>;

let syntheticFixture: SyntheticFixture | null = null;

type TestPrismaClient = ReturnType<typeof createPrismaClient>;

async function createSyntheticFixture(
  client: TestPrismaClient,
): Promise<SyntheticFixture> {
  const fixture: SyntheticFixture = {
    tenantAId: randomUUID(),
    tenantBId: randomUUID(),
    userAId: randomUUID(),
    userBId: randomUUID(),
    membershipAId: randomUUID(),
    membershipBId: randomUUID(),
    weddingAId: randomUUID(),
    weddingBId: randomUUID(),
    householdAId: randomUUID(),
    householdBId: randomUUID(),
  };

  await client.$transaction(async (tx) => {
    await tx.tenant.create({
      data: { id: fixture.tenantAId, name: "Synthetic Tenant A" },
    });
    await tx.tenant.create({
      data: { id: fixture.tenantBId, name: "Synthetic Tenant B" },
    });

    await tx.user.create({
      data: {
        id: fixture.userAId,
        email: `tenant-a-${fixture.userAId}@example.test`,
        passwordHash: "synthetic-password-hash-a",
        displayName: "Synthetic User A",
        status: "ACTIVE",
      },
    });
    await tx.user.create({
      data: {
        id: fixture.userBId,
        email: `tenant-b-${fixture.userBId}@example.test`,
        passwordHash: "synthetic-password-hash-b",
        displayName: "Synthetic User B",
        status: "ACTIVE",
      },
    });

    await tx.tenantMembership.create({
      data: {
        id: fixture.membershipAId,
        tenantId: fixture.tenantAId,
        userId: fixture.userAId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    await tx.tenantMembership.create({
      data: {
        id: fixture.membershipBId,
        tenantId: fixture.tenantBId,
        userId: fixture.userBId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    await tx.wedding.create({
      data: {
        id: fixture.weddingAId,
        tenantId: fixture.tenantAId,
        displayName: "Synthetic Wedding A",
      },
    });
    await tx.wedding.create({
      data: {
        id: fixture.weddingBId,
        tenantId: fixture.tenantBId,
        displayName: "Synthetic Wedding B",
      },
    });

    await tx.guestHousehold.create({
      data: {
        id: fixture.householdAId,
        tenantId: fixture.tenantAId,
        weddingId: fixture.weddingAId,
        displayName: "Synthetic Household A",
        phoneEncrypted: "synthetic-phone-encrypted-a",
        phoneHash: "synthetic-phone-hash-a",
        emailEncrypted: "synthetic-email-encrypted-a",
        emailHash: "synthetic-email-hash-a",
        maximumPax: 2,
        tokenHash: `synthetic-token-hash-${fixture.householdAId}`,
      },
    });
    await tx.guestHousehold.create({
      data: {
        id: fixture.householdBId,
        tenantId: fixture.tenantBId,
        weddingId: fixture.weddingBId,
        displayName: "Synthetic Household B",
        phoneEncrypted: "synthetic-phone-encrypted-b",
        phoneHash: "synthetic-phone-hash-b",
        emailEncrypted: "synthetic-email-encrypted-b",
        emailHash: "synthetic-email-hash-b",
        maximumPax: 4,
        tokenHash: `synthetic-token-hash-${fixture.householdBId}`,
      },
    });
  });

  return fixture;
}

function requireSyntheticFixture(): SyntheticFixture {
  if (syntheticFixture === null) {
    throw new Error("Synthetic tenant isolation fixture was not created");
  }

  return syntheticFixture;
}

async function deleteSyntheticFixture(
  client: TestPrismaClient,
  fixture: SyntheticFixture,
): Promise<void> {
  await client.$transaction([
    client.guestHousehold.deleteMany({
      where: { id: { in: [fixture.householdAId, fixture.householdBId] } },
    }),
    client.tenantMembership.deleteMany({
      where: { id: { in: [fixture.membershipAId, fixture.membershipBId] } },
    }),
    client.wedding.deleteMany({
      where: { id: { in: [fixture.weddingAId, fixture.weddingBId] } },
    }),
    client.user.deleteMany({
      where: { id: { in: [fixture.userAId, fixture.userBId] } },
    }),
    client.tenant.deleteMany({
      where: { id: { in: [fixture.tenantAId, fixture.tenantBId] } },
    }),
  ]);
}

describe("guest tenant isolation boundary", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
    syntheticFixture = await createSyntheticFixture(testPrisma);
  });

  afterAll(async () => {
    try {
      if (syntheticFixture !== null) {
        await deleteSyntheticFixture(testPrisma, syntheticFixture);
      }
    } finally {
      await testPrisma.$disconnect();
    }
  });

  it("includes tenant and wedding scope in guest resource keys", () => {
    expect(
      tenantScopedGuestResourceKey("tenant-a", "wedding-a", "household-a"),
    ).toBe("guest:tenant-a:wedding-a:household-a");
    expect(
      tenantScopedGuestResourceKey("tenant-b", "wedding-a", "household-a"),
    ).not.toBe(
      tenantScopedGuestResourceKey("tenant-a", "wedding-a", "household-a"),
    );
  });

  it("rejects a household outside the authorized workspace set", () => {
    expect(() =>
      assertHouseholdBelongsToWorkspace("household-b", ["household-a"]),
    ).toThrow("HOUSEHOLD_NOT_IN_WORKSPACE");
    expect(() =>
      assertHouseholdBelongsToWorkspace("household-a", ["household-a"]),
    ).not.toThrow();
  });

  it("keeps household lists inside the requested tenant and wedding", async () => {
    const fixture = requireSyntheticFixture();

    await expect(
      guestHouseholds.list({
        tenantId: fixture.tenantAId,
        weddingId: fixture.weddingAId,
      }),
    ).resolves.toMatchObject([
      {
        id: fixture.householdAId,
        tenantId: fixture.tenantAId,
        weddingId: fixture.weddingAId,
      },
    ]);
    await expect(
      guestHouseholds.list({
        tenantId: fixture.tenantBId,
        weddingId: fixture.weddingBId,
      }),
    ).resolves.toMatchObject([
      {
        id: fixture.householdBId,
        tenantId: fixture.tenantBId,
        weddingId: fixture.weddingBId,
      },
    ]);

    await expect(
      guestHouseholds.list({
        tenantId: fixture.tenantAId,
        weddingId: fixture.weddingBId,
      }),
    ).resolves.toEqual([]);
    await expect(
      guestHouseholds.list({
        tenantId: fixture.tenantBId,
        weddingId: fixture.weddingAId,
      }),
    ).resolves.toEqual([]);
  });

  it("returns null for a household requested through another tenant", async () => {
    const fixture = requireSyntheticFixture();

    await expect(
      guestHouseholds.findById(
        { tenantId: fixture.tenantAId, weddingId: fixture.weddingBId },
        fixture.householdBId,
      ),
    ).resolves.toBeNull();
    await expect(
      guestHouseholds.findById(
        { tenantId: fixture.tenantBId, weddingId: fixture.weddingAId },
        fixture.householdAId,
      ),
    ).resolves.toBeNull();
  });

  it("rejects memberships outside the requested tenant scope", async () => {
    const fixture = requireSyntheticFixture();

    await expect(
      memberships.resolveForUser({
        tenantId: fixture.tenantAId,
        userId: fixture.userAId,
      }),
    ).resolves.toMatchObject([
      {
        id: fixture.membershipAId,
        tenantId: fixture.tenantAId,
        userId: fixture.userAId,
      },
    ]);
    await expect(
      memberships.resolveForUser({
        tenantId: fixture.tenantAId,
        userId: fixture.userBId,
      }),
    ).resolves.toEqual([]);
    await expect(
      memberships.resolveForUser({
        tenantId: fixture.tenantBId,
        userId: fixture.userAId,
      }),
    ).resolves.toEqual([]);
  });

  it("returns safe household DTOs without token or contact hashes", async () => {
    const fixture = requireSyntheticFixture();
    const household = await guestHouseholds.findById(
      { tenantId: fixture.tenantAId, weddingId: fixture.weddingAId },
      fixture.householdAId,
    );

    expect(household).not.toBeNull();
    if (household === null) return;

    for (const sensitiveField of [
      "tokenHash",
      "phoneHash",
      "emailHash",
      "phoneEncrypted",
      "emailEncrypted",
    ]) {
      expect(household).not.toHaveProperty(sensitiveField);
    }
  });
});

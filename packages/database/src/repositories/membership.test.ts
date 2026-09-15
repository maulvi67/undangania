import { describe, expect, it, vi } from "vitest";
import { PrismaTenantMembershipRepository } from "./membership";

describe("PrismaTenantMembershipRepository", () => {
  it("resolves active roles only inside the requested tenant and user", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "membership-1",
        tenantId: "tenant-1",
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
      },
    ]);
    const repository = new PrismaTenantMembershipRepository({
      tenantMembership: { findMany, findFirst: vi.fn() },
    });

    await expect(
      repository.resolveForUser({ tenantId: "tenant-1", userId: "user-1" }),
    ).resolves.toEqual([
      {
        id: "membership-1",
        tenantId: "tenant-1",
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
      },
    ]);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        userId: "user-1",
        status: "ACTIVE",
        user: { status: "ACTIVE" },
      },
      orderBy: { role: "asc" },
      select: expect.objectContaining({
        id: true,
        tenantId: true,
        userId: true,
        role: true,
        status: true,
      }),
    });
  });

  it("resolves a user through an active membership that owns the wedding", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "membership-1",
      tenantId: "tenant-1",
      userId: "user-1",
      role: "OWNER",
      status: "ACTIVE",
    });
    const repository = new PrismaTenantMembershipRepository({
      tenantMembership: { findMany: vi.fn(), findFirst },
    });

    await expect(
      repository.resolveForUserAndWedding({
        userId: "user-1",
        weddingId: "wedding-1",
      }),
    ).resolves.toMatchObject({ tenantId: "tenant-1", userId: "user-1" });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          status: "ACTIVE",
          user: { status: "ACTIVE" },
          tenant: { weddings: { some: { id: "wedding-1" } } },
        },
      }),
    );
  });
});

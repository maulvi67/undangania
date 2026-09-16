import { describe, expect, it, vi } from "vitest";
import {
  PrismaWeddingWorkspaceRepository,
  type InvitationRef,
  type WorkspaceRef,
} from "./wedding-workspace";

function client(overrides: {
  wedding?: ReturnType<typeof vi.fn>;
  invitation?: ReturnType<typeof vi.fn>;
}) {
  return {
    wedding: { findFirst: overrides.wedding ?? vi.fn() },
    invitation: { findFirst: overrides.invitation ?? vi.fn() },
  };
}

describe("PrismaWeddingWorkspaceRepository", () => {
  it("resolves the oldest wedding for a tenant, scoped by tenantId", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "wedding-1",
      displayName: "Pernikahan kami",
      onboardingCompletedAt: null,
    });
    const repository = new PrismaWeddingWorkspaceRepository(
      client({ wedding: findFirst }),
    );

    await expect(repository.resolveForTenant("tenant-1")).resolves.toEqual({
      weddingId: "wedding-1",
      displayName: "Pernikahan kami",
      onboardingCompletedAt: null,
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
      orderBy: { createdAt: "asc" },
      select: expect.objectContaining({
        id: true,
        displayName: true,
        onboardingCompletedAt: true,
      }),
    });
  });

  it("returns null rather than throwing when a tenant has no wedding", async () => {
    const repository = new PrismaWeddingWorkspaceRepository(
      client({ wedding: vi.fn().mockResolvedValue(null) }),
    );

    await expect(repository.resolveForTenant("tenant-1")).resolves.toBeNull();
  });

  it("does not query for a blank tenant id", async () => {
    const findFirst = vi.fn();
    const repository = new PrismaWeddingWorkspaceRepository(
      client({ wedding: findFirst }),
    );

    await expect(repository.resolveForTenant("   ")).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("resolves the invitation with redundant tenant scope asserted", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "invitation-1",
      slug: "rani-bima-1a2b3c4d",
      status: "DRAFT",
    });
    const repository = new PrismaWeddingWorkspaceRepository(
      client({ invitation: findFirst }),
    );

    await expect(repository.resolveInvitation("tenant-1")).resolves.toEqual({
      invitationId: "invitation-1",
      slug: "rani-bima-1a2b3c4d",
      status: "DRAFT",
    } satisfies InvitationRef);
    // The parent relation is asserted too, so a mis-scoped invitation cannot be
    // reached even if the denormalized column were wrong.
    expect(findFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", wedding: { tenantId: "tenant-1" } },
      select: { id: true, slug: true, status: true },
    });
  });

  it("reports a chosen-design absence as null, not an error", async () => {
    const repository = new PrismaWeddingWorkspaceRepository(
      client({ invitation: vi.fn().mockResolvedValue(null) }),
    );

    await expect(repository.resolveInvitation("tenant-1")).resolves.toBeNull();
  });

  it("does not query the invitation table for a blank tenant id", async () => {
    const findFirst = vi.fn();
    const repository = new PrismaWeddingWorkspaceRepository(
      client({ invitation: findFirst }),
    );

    await expect(repository.resolveInvitation("")).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("exposes the workspace shape the session resolver consumes", async () => {
    const repository = new PrismaWeddingWorkspaceRepository(
      client({
        wedding: vi.fn().mockResolvedValue({
          id: "wedding-1",
          displayName: "Pernikahan kami",
          onboardingCompletedAt: new Date("2026-03-21T00:00:00.000Z"),
        }),
      }),
    );

    const resolved = await repository.resolveForTenant("tenant-1");
    expect(resolved).toEqual({
      weddingId: "wedding-1",
      displayName: "Pernikahan kami",
      onboardingCompletedAt: new Date("2026-03-21T00:00:00.000Z"),
    } satisfies WorkspaceRef);
  });
});

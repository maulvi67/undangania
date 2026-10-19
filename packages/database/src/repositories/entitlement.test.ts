import { describe, expect, it, vi } from "vitest";
import {
  PrismaEntitlementRepository,
  type EntitlementRepositoryClient,
} from "./entitlement";

const NOW = new Date("2026-10-19T08:00:00.000Z");

function client(
  invitation: { templateId: string } | null,
  entitlement: { id: string } | null,
): EntitlementRepositoryClient {
  return {
    invitation: { findFirst: vi.fn().mockResolvedValue(invitation) },
    entitlement: { findFirst: vi.fn().mockResolvedValue(entitlement) },
  };
}

describe("PrismaEntitlementRepository", () => {
  it("accepts an active, unexpired entitlement for the invitation's template", async () => {
    const fake = client({ templateId: "seruni-klasik" }, { id: "ent-1" });
    const repository = new PrismaEntitlementRepository(fake);

    await expect(
      repository.hasActiveForInvitation({
        tenantId: "tenant-1",
        invitationId: "invitation-1",
        at: NOW,
      }),
    ).resolves.toBe(true);

    expect(fake.invitation.findFirst).toHaveBeenCalledWith({
      where: { id: "invitation-1", tenantId: "tenant-1" },
      select: { templateId: true },
    });
    expect(fake.entitlement.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        productCode: "seruni-klasik",
        status: "ACTIVE",
        startsAt: { lte: NOW },
        OR: [{ endsAt: null }, { endsAt: { gt: NOW } }],
      },
      select: { id: true },
    });
  });

  it("rejects an invitation outside the caller's tenant without touching entitlement", async () => {
    const fake = client(null, { id: "ent-1" });
    const repository = new PrismaEntitlementRepository(fake);

    await expect(
      repository.hasActiveForInvitation({
        tenantId: "tenant-1",
        invitationId: "invitation-other",
        at: NOW,
      }),
    ).resolves.toBe(false);

    expect(fake.entitlement.findFirst).not.toHaveBeenCalled();
  });

  it("rejects when no active entitlement exists", async () => {
    const repository = new PrismaEntitlementRepository(
      client({ templateId: "seruni-klasik" }, null),
    );

    await expect(
      repository.hasActiveForInvitation({
        tenantId: "tenant-1",
        invitationId: "invitation-1",
        at: NOW,
      }),
    ).resolves.toBe(false);
  });
});

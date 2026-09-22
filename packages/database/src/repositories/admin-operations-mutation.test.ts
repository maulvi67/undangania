import { describe, expect, it, vi } from "vitest";
import {
  PrismaAdminMutationRepository,
  type AdminMutationAuditInput,
  type AdminMutationClient,
  type AdminMutationDatabaseClient,
} from "./admin-operations";

const NOW = new Date("2026-09-22T09:00:00.000Z");

const AUDIT: AdminMutationAuditInput = {
  tenantId: "tenant-1",
  actorId: "admin-1",
  action: "ADMIN_RECOVER_PUBLICATION",
  targetType: "InvitationPublication",
  targetId: "publication-1",
  reason: "Pulihkan snapshot yang gagal dipromosikan",
  correlationId: "correlation-1",
  metadata: {
    idempotencyKey: "recover-publication-0001",
    targetType: "unspecified",
    fromStatus: "unspecified",
    toStatus: "unspecified",
    environment: "SIMULATION",
  },
};

function createClient(
  overrides: {
    publication?: Partial<AdminMutationClient["invitationPublication"]>;
    invitation?: Partial<AdminMutationClient["invitation"]>;
    outbox?: Partial<AdminMutationClient["outboxEvent"]>;
    audit?: Partial<AdminMutationClient["auditEvent"]>;
  } = {},
): AdminMutationDatabaseClient {
  const publicationUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
  const outboxCreate = vi.fn().mockResolvedValue({ id: "outbox-1" });
  const auditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
  const transactionClient: AdminMutationClient = {
    invitationPublication: {
      findFirst: vi.fn().mockResolvedValue({
        id: "publication-1",
        tenantId: "tenant-1",
        invitationId: "invitation-1",
        publicationVersion: 4,
        active: false,
        invitation: { tenantId: "tenant-1", status: "READY" },
      }),
      updateMany: publicationUpdateMany,
      ...overrides.publication,
    },
    invitation: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      ...overrides.invitation,
    },
    notification: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    outboxEvent: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: outboxCreate,
      ...overrides.outbox,
    },
    supportCase: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    template: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditEvent: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: auditCreate,
      ...overrides.audit,
    },
  };

  return {
    ...transactionClient,
    transaction: <T>(
      work: (client: AdminMutationClient) => Promise<T>,
    ): Promise<T> => work(transactionClient),
  };
}

describe("PrismaAdminMutationRepository.recoverPublication", () => {
  it("demotes active snapshots, promotes the target, restores invitation state, and records outbox plus audit atomically", async () => {
    const client = createClient();
    const repository = new PrismaAdminMutationRepository(client);

    await expect(
      repository.recoverPublication({
        tenantId: "tenant-1",
        targetId: "publication-1",
        now: NOW,
        audit: AUDIT,
      }),
    ).resolves.toBe(true);

    const publication = client.invitationPublication;
    expect(publication.updateMany).toHaveBeenCalledTimes(2);
    expect(publication.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        tenantId: "tenant-1",
        invitationId: "invitation-1",
        active: true,
      },
      data: { active: false },
    });
    expect(publication.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "publication-1",
        tenantId: "tenant-1",
        invitationId: "invitation-1",
        active: false,
      },
      data: { active: true },
    });
    expect(client.invitation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "invitation-1",
        tenantId: "tenant-1",
        status: { in: ["READY", "PUBLISHED", "PAUSED"] },
      },
      data: { status: "PUBLISHED" },
    });
    expect(client.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        eventType: "InvitationPublished",
        aggregateType: "Invitation",
        aggregateId: "invitation-1",
        payload: {
          publicationId: "publication-1",
          invitationId: "invitation-1",
          publicationVersion: 4,
        },
        payloadVersion: 1,
        createdAt: NOW,
      }),
    });
    expect(client.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        action: "ADMIN_RECOVER_PUBLICATION",
        targetType: "InvitationPublication",
        targetId: "publication-1",
        createdAt: NOW,
      }),
    });
    expect(client.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(client.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it("does not write across tenants", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const client = createClient({ publication: { findFirst } });
    const repository = new PrismaAdminMutationRepository(client);

    await expect(
      repository.recoverPublication({
        tenantId: "tenant-2",
        targetId: "publication-1",
        now: NOW,
        audit: AUDIT,
      }),
    ).resolves.toBe(false);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "publication-1", tenantId: "tenant-2" },
      select: expect.anything(),
    });
    expect(client.invitationPublication.updateMany).not.toHaveBeenCalled();
    expect(client.invitation.updateMany).not.toHaveBeenCalled();
    expect(client.outboxEvent.create).not.toHaveBeenCalled();
    expect(client.auditEvent.create).not.toHaveBeenCalled();
  });

  it.each(["EXPIRED", "ARCHIVED", "DRAFT"])(
    "refuses an invitation in %s state",
    async (status) => {
      const client = createClient({
        publication: {
          findFirst: vi.fn().mockResolvedValue({
            id: "publication-1",
            tenantId: "tenant-1",
            invitationId: "invitation-1",
            publicationVersion: 4,
            active: false,
            invitation: { tenantId: "tenant-1", status },
          }),
        },
      });
      const repository = new PrismaAdminMutationRepository(client);

      await expect(
        repository.recoverPublication({
          tenantId: "tenant-1",
          targetId: "publication-1",
          now: NOW,
          audit: AUDIT,
        }),
      ).resolves.toBe(false);
      expect(client.invitationPublication.updateMany).not.toHaveBeenCalled();
      expect(client.outboxEvent.create).not.toHaveBeenCalled();
      expect(client.auditEvent.create).not.toHaveBeenCalled();
    },
  );

  it("refuses an already active publication", async () => {
    const client = createClient({
      publication: {
        findFirst: vi.fn().mockResolvedValue({
          id: "publication-1",
          tenantId: "tenant-1",
          invitationId: "invitation-1",
          publicationVersion: 4,
          active: true,
          invitation: { tenantId: "tenant-1", status: "PUBLISHED" },
        }),
      },
    });
    const repository = new PrismaAdminMutationRepository(client);

    await expect(
      repository.recoverPublication({
        tenantId: "tenant-1",
        targetId: "publication-1",
        now: NOW,
        audit: AUDIT,
      }),
    ).resolves.toBe(false);
    expect(client.invitationPublication.updateMany).not.toHaveBeenCalled();
  });

  it("does not audit when the target CAS loses a race", async () => {
    const client = createClient({
      publication: {
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
    });
    const repository = new PrismaAdminMutationRepository(client);

    await expect(
      repository.recoverPublication({
        tenantId: "tenant-1",
        targetId: "publication-1",
        now: NOW,
        audit: AUDIT,
      }),
    ).resolves.toBe(false);
    expect(client.invitation.updateMany).not.toHaveBeenCalled();
    expect(client.outboxEvent.create).not.toHaveBeenCalled();
    expect(client.auditEvent.create).not.toHaveBeenCalled();
  });
});

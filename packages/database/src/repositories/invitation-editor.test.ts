import { describe, expect, it, vi } from "vitest";
import {
  nextPublicationVersion,
  PrismaEditorRepository,
  readContractVersion,
  isPublishableStatus,
  type EditorScope,
  type EditorTransactionClient,
} from "./invitation-editor";

const SCOPE: EditorScope = {
  tenantId: "tenant-1",
  invitationId: "invitation-1",
  actorId: "user-1",
};

const updatedAt = new Date("2026-09-15T02:30:00.000Z");

const invitationRow = {
  id: "invitation-1",
  tenantId: "tenant-1",
  weddingId: "wedding-1",
  templateId: "seruni-klasik",
  templateVersion: "1",
  slug: "rani-bima",
  status: "DRAFT",
  draftConfig: { couple: { partner1Name: "Rani" } },
  optimisticVersion: 3,
  updatedAt,
};

const templateRow = {
  id: "seruni-klasik",
  version: "1",
  name: "Seruni Klasik",
  category: "Klasik",
  manifest: { contractVersion: 1 },
};

function scopedInvitationWhere(): Record<string, unknown> {
  return {
    id: "invitation-1",
    tenantId: "tenant-1",
    wedding: { tenantId: "tenant-1" },
  };
}

function createClient(overrides: {
  invitation?: Partial<EditorTransactionClient["invitation"]>;
  template?: Partial<EditorTransactionClient["template"]>;
  invitationPublication?: Partial<
    EditorTransactionClient["invitationPublication"]
  >;
}): EditorTransactionClient {
  return {
    invitation: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      ...overrides.invitation,
    },
    template: { findFirst: vi.fn(), ...overrides.template },
    invitationPublication: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      ...overrides.invitationPublication,
    },
  };
}

describe("readContractVersion", () => {
  it("reads an integer contract version from the manifest", () => {
    expect(readContractVersion({ contractVersion: 2 })).toBe(2);
  });

  it("accepts a numeric string so a serialised manifest still publishes", () => {
    expect(readContractVersion({ contractVersion: "3" })).toBe(3);
  });

  it("refuses a manifest that has no usable contract version", () => {
    expect(readContractVersion({})).toBeNull();
    expect(readContractVersion(null)).toBeNull();
    expect(readContractVersion([1])).toBeNull();
    expect(readContractVersion({ contractVersion: 0 })).toBeNull();
    expect(readContractVersion({ contractVersion: -1 })).toBeNull();
    expect(readContractVersion({ contractVersion: 1.5 })).toBeNull();
    expect(readContractVersion({ contractVersion: "latest" })).toBeNull();
  });
});

describe("nextPublicationVersion", () => {
  it("starts at one when the invitation has never been published", () => {
    expect(nextPublicationVersion(null)).toBe(1);
  });

  it("increments from the highest existing version", () => {
    expect(nextPublicationVersion({ publicationVersion: 4 })).toBe(5);
  });
});

describe("isPublishableStatus", () => {
  it("allows draft and published invitations", () => {
    expect(isPublishableStatus("DRAFT")).toBe(true);
    expect(isPublishableStatus("PUBLISHED")).toBe(true);
  });

  it("refuses states that are not draft-shaped", () => {
    expect(isPublishableStatus("ARCHIVED")).toBe(false);
  });
});

describe("PrismaEditorRepository.load", () => {
  it("reads the draft and its template inside tenant scope", async () => {
    const invitationFindFirst = vi.fn().mockResolvedValue(invitationRow);
    const templateFindFirst = vi.fn().mockResolvedValue(templateRow);
    const repository = new PrismaEditorRepository(
      createClient({
        invitation: { findFirst: invitationFindFirst },
        template: { findFirst: templateFindFirst },
      }),
    );

    const loaded = await repository.load(SCOPE);

    expect(invitationFindFirst).toHaveBeenCalledWith({
      where: scopedInvitationWhere(),
      select: expect.anything(),
    });
    expect(templateFindFirst).toHaveBeenCalledWith({
      where: { id: "seruni-klasik", version: "1" },
      select: expect.anything(),
    });
    expect(loaded?.invitation.document.version).toBe(3);
    expect(loaded?.invitation.document.content).toEqual({
      couple: { partner1Name: "Rani" },
    });
  });

  it("fails closed when the invitation is outside the tenant", async () => {
    const repository = new PrismaEditorRepository(
      createClient({
        invitation: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );

    await expect(
      repository.load({ ...SCOPE, tenantId: "tenant-2" }),
    ).resolves.toBeNull();
  });

  it("refuses to invent a template when the schema guarantees one exists", async () => {
    const repository = new PrismaEditorRepository(
      createClient({
        invitation: { findFirst: vi.fn().mockResolvedValue(invitationRow) },
        template: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );

    await expect(repository.load(SCOPE)).rejects.toThrow(
      "The database repository is unavailable",
    );
  });
});

describe("PrismaEditorRepository.save", () => {
  it("guards the write with the base version instead of reading first", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findFirst = vi
      .fn()
      .mockResolvedValue({ ...invitationRow, optimisticVersion: 4 });
    const repository = new PrismaEditorRepository(
      createClient({ invitation: { updateMany, findFirst } }),
    );

    const result = await repository.save(SCOPE, {
      content: { couple: { partner1Name: "Rani", partner2Name: "Bima" } },
      baseVersion: 3,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { ...scopedInvitationWhere(), optimisticVersion: 3 },
      data: {
        draftConfig: { couple: { partner1Name: "Rani", partner2Name: "Bima" } },
        optimisticVersion: 4,
      },
    });
    expect(result).toEqual({
      kind: "saved",
      document: {
        invitationId: "invitation-1",
        version: 4,
        updatedAt,
        content: { couple: { partner1Name: "Rani" } },
      },
    });
  });

  it("returns the server document when the version has moved on", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findFirst = vi
      .fn()
      .mockResolvedValue({ ...invitationRow, optimisticVersion: 7 });
    const repository = new PrismaEditorRepository(
      createClient({ invitation: { updateMany, findFirst } }),
    );

    const result = await repository.save(SCOPE, {
      content: { couple: { partner1Name: "Stale" } },
      baseVersion: 3,
    });

    expect(result.kind).toBe("stale");
    expect(result.kind === "stale" && result.serverDocument.version).toBe(7);
  });

  it("reports not-found rather than stale for a cross-tenant write", async () => {
    const repository = new PrismaEditorRepository(
      createClient({
        invitation: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      }),
    );

    await expect(
      repository.save(
        { ...SCOPE, tenantId: "tenant-2" },
        {
          content: { couple: { partner1Name: "Andi" } },
          baseVersion: 1,
        },
      ),
    ).resolves.toEqual({ kind: "not-found" });
  });

  it("rejects a negative or fractional base version before touching the database", async () => {
    const updateMany = vi.fn();
    const repository = new PrismaEditorRepository(
      createClient({ invitation: { updateMany } }),
    );

    await expect(
      repository.save(SCOPE, {
        content: {},
        baseVersion: -1,
      }),
    ).resolves.toEqual({ kind: "invalid" });
    await expect(
      repository.save(SCOPE, {
        content: {},
        baseVersion: 1.5,
      }),
    ).resolves.toEqual({ kind: "invalid" });
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("PrismaEditorRepository.publish", () => {
  function publishClient(options: {
    invitationStatus?: string;
    invitationVersion?: number;
    latestVersion?: number | null;
  }) {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({
      id: "publication-9",
      publicationVersion: (options.latestVersion ?? 0) + 1,
      active: true,
      publishedAt: updatedAt,
      templateId: "seruni-klasik",
      templateVersion: "1",
      contractVersion: 1,
    });

    return {
      updateMany,
      create,
      client: createClient({
        invitation: {
          findFirst: vi.fn().mockResolvedValue({
            ...invitationRow,
            status: options.invitationStatus ?? "DRAFT",
            optimisticVersion: options.invitationVersion ?? 3,
          }),
        },
        template: { findFirst: vi.fn().mockResolvedValue(templateRow) },
        invitationPublication: {
          findFirst: vi.fn().mockResolvedValue(
            options.latestVersion === null ||
              options.latestVersion === undefined
              ? null
              : {
                  id: "publication-8",
                  publicationVersion: options.latestVersion,
                },
          ),
          updateMany,
          create,
        },
      }),
    };
  }

  it("demotes the active publication before promoting the new one", async () => {
    const { client, updateMany, create } = publishClient({ latestVersion: 4 });
    const repository = new PrismaEditorRepository(client);

    const result = await repository.publish(SCOPE, {
      snapshot: { sections: [] },
      baseVersion: 3,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", invitationId: "invitation-1" },
      data: { active: false },
    });
    // The demotion has to happen first: the schema has no constraint enforcing a
    // single active publication, so ordering is the only guarantee.
    expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      create.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    expect(result).toEqual({
      kind: "published",
      publicationId: "publication-9",
      publicationVersion: 5,
    });
  });

  it("binds the snapshot to the stored template rather than the caller", async () => {
    const { client, create } = publishClient({ latestVersion: null });
    const repository = new PrismaEditorRepository(client);

    await repository.publish(SCOPE, {
      snapshot: { sections: [] },
      baseVersion: 3,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        invitationId: "invitation-1",
        publicationVersion: 1,
        templateId: "seruni-klasik",
        templateVersion: "1",
        contractVersion: 1,
        active: true,
        publishedBy: "user-1",
      }),
      select: expect.anything(),
    });
  });

  it("refuses to publish a draft the caller has not seen", async () => {
    const { client, create, updateMany } = publishClient({
      latestVersion: null,
      invitationVersion: 9,
    });
    const repository = new PrismaEditorRepository(client);

    const result = await repository.publish(SCOPE, {
      snapshot: { sections: [] },
      baseVersion: 3,
    });

    expect(result).toEqual({ kind: "stale", currentVersion: 9 });
    expect(create).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("refuses to publish when the template manifest has no contract version", async () => {
    const { client, create } = publishClient({ latestVersion: null });
    const brokenClient: EditorTransactionClient = {
      ...client,
      template: {
        findFirst: vi.fn().mockResolvedValue({
          ...templateRow,
          manifest: { name: "Seruni" },
        }),
      },
    };
    const repository = new PrismaEditorRepository(brokenClient);

    await expect(
      repository.publish(SCOPE, { snapshot: {}, baseVersion: 3 }),
    ).resolves.toEqual({ kind: "template-unavailable" });
    expect(create).not.toHaveBeenCalled();
  });

  it("scopes the publish to the tenant that owns the invitation", async () => {
    const invitationFindFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaEditorRepository(
      createClient({ invitation: { findFirst: invitationFindFirst } }),
    );

    await expect(
      repository.publish(
        { ...SCOPE, tenantId: "tenant-2" },
        {
          snapshot: {},
          baseVersion: 3,
        },
      ),
    ).resolves.toEqual({ kind: "not-found" });
    // The lookup carries the caller's tenant, so a mutated scope cannot read
    // another tenant's invitation.
    expect(invitationFindFirst).toHaveBeenCalledWith({
      where: {
        id: "invitation-1",
        tenantId: "tenant-2",
        wedding: { tenantId: "tenant-2" },
      },
      select: expect.anything(),
    });
  });

  it("refuses to publish an invitation that is not draft-shaped", async () => {
    const { client, create } = publishClient({
      latestVersion: null,
      invitationStatus: "ARCHIVED",
    });
    const repository = new PrismaEditorRepository(client);

    await expect(
      repository.publish(SCOPE, { snapshot: {}, baseVersion: 3 }),
    ).resolves.toEqual({ kind: "invalid" });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("PrismaEditorRepository.setActive", () => {
  it("pauses a published invitation and deactivates its snapshot", async () => {
    const invitationUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const publicationUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new PrismaEditorRepository(
      createClient({
        invitation: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ ...invitationRow, status: "PUBLISHED" }),
          updateMany: invitationUpdate,
        },
        invitationPublication: { updateMany: publicationUpdate },
      }),
    );

    await expect(
      repository.setActive(SCOPE, { active: false }),
    ).resolves.toEqual({ kind: "paused" });
    expect(invitationUpdate).toHaveBeenCalledWith({
      where: { ...scopedInvitationWhere(), status: "PUBLISHED" },
      data: { status: "PAUSED" },
    });
    expect(publicationUpdate).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", invitationId: "invitation-1" },
      data: { active: false },
    });
  });

  it("promotes the latest snapshot when reactivating", async () => {
    const invitationUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const publicationUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new PrismaEditorRepository(
      createClient({
        invitation: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ ...invitationRow, status: "PAUSED" }),
          updateMany: invitationUpdate,
        },
        invitationPublication: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: "publication-2", publicationVersion: 2 }),
          updateMany: publicationUpdate,
        },
      }),
    );

    await expect(
      repository.setActive(SCOPE, { active: true }),
    ).resolves.toEqual({ kind: "resumed" });
    expect(publicationUpdate).toHaveBeenLastCalledWith({
      where: {
        tenantId: "tenant-1",
        invitationId: "invitation-1",
        id: "publication-2",
      },
      data: { active: true },
    });
  });

  it("refuses to pause a draft that was never public", async () => {
    const invitationUpdate = vi.fn();
    const repository = new PrismaEditorRepository(
      createClient({
        invitation: {
          findFirst: vi.fn().mockResolvedValue(invitationRow),
          updateMany: invitationUpdate,
        },
      }),
    );

    await expect(
      repository.setActive(SCOPE, { active: false }),
    ).resolves.toEqual({ kind: "invalid" });
    expect(invitationUpdate).not.toHaveBeenCalled();
  });
});

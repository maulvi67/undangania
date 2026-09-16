import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  PrismaInvitationProvisioningRepository,
  buildInvitationSlug,
} from "./invitation-provisioning";

const invitationRow = {
  id: "invitation-1",
  tenantId: "tenant-1",
  weddingId: "wedding-1",
  templateId: "seruni-klasik",
  templateVersion: "1",
  slug: "rani-bima-1a2b3c4d",
  status: "DRAFT",
};

function client(
  overrides: {
    invitationFind?: ReturnType<typeof vi.fn>;
    invitationCreate?: ReturnType<typeof vi.fn>;
    templateFind?: ReturnType<typeof vi.fn>;
    weddingFind?: ReturnType<typeof vi.fn>;
  } = {},
) {
  return {
    invitation: {
      findFirst: overrides.invitationFind ?? vi.fn(),
      create: overrides.invitationCreate ?? vi.fn(),
    },
    template: { findFirst: overrides.templateFind ?? vi.fn() },
    wedding: { findFirst: overrides.weddingFind ?? vi.fn() },
  };
}

describe("buildInvitationSlug", () => {
  it("combines the couple's names with a random suffix", () => {
    const slug = buildInvitationSlug({
      templateId: "seruni-klasik",
      partner1Name: "Rani",
      partner2Name: "Bima",
    });

    expect(slug).toMatch(/^rani-bima-[0-9a-f]{8}$/);
  });

  it("falls back to the template id when no names are stored yet", () => {
    const slug = buildInvitationSlug({
      templateId: "seruni-klasik",
      partner1Name: null,
      partner2Name: null,
    });

    expect(slug).toMatch(/^seruni-klasik-[0-9a-f]{8}$/);
  });

  it("strips characters a URL cannot carry, including marks", () => {
    const slug = buildInvitationSlug({
      templateId: "nara-modern",
      partner1Name: "Andi Wijaya",
      partner2Name: "Nurul Aisyah",
    });

    expect(slug).toMatch(/^andi-wijaya-nurul-aisyah-[0-9a-f]{8}$/);
  });

  it("does not leak non-Latin characters into the path", () => {
    const slug = buildInvitationSlug({
      templateId: "nara-modern",
      // Names in a non-Latin script collapse to nothing, leaving the template id
      // as the stem rather than an empty or transliterated one.
      partner1Name: "\u5be6\u73a0",
      partner2Name: "\u6b63\u5b97",
    });

    expect(slug).toMatch(/^nara-modern-[0-9a-f]{8}$/);
  });

  it("uses a generic stem when neither a name nor a template id survives", () => {
    const slug = buildInvitationSlug({
      partner1Name: "\u5be6\u73a0",
      partner2Name: null,
      templateId: "\u6a21\u677f",
    });

    expect(slug).toMatch(/^undangan-[0-9a-f]{8}$/);
  });

  it("normalizes an accented name to its base letters", () => {
    const slug = buildInvitationSlug({
      templateId: "nara-modern",
      partner1Name: "Ren\u00e9e",
      partner2Name: null,
    });

    expect(slug).toMatch(/^renee-[0-9a-f]{8}$/);
  });

  it("produces a different slug on every call", () => {
    const first = buildInvitationSlug({
      templateId: "seruni-klasik",
      partner1Name: "Rani",
      partner2Name: "Bima",
    });
    const second = buildInvitationSlug({
      templateId: "seruni-klasik",
      partner1Name: "Rani",
      partner2Name: "Bima",
    });

    expect(first).not.toBe(second);
  });

  it("stays inside the editor contract's 100 character slug limit", () => {
    const slug = buildInvitationSlug({
      templateId: "seruni-klasik",
      partner1Name: "A".repeat(200),
      partner2Name: "B".repeat(200),
    });

    expect(slug.length).toBeLessThanOrEqual(100);
  });
});

describe("PrismaInvitationProvisioningRepository", () => {
  it("returns the existing invitation without creating a second one", async () => {
    const invitationFind = vi.fn().mockResolvedValue(invitationRow);
    const invitationCreate = vi.fn();
    const repository = new PrismaInvitationProvisioningRepository(
      client({ invitationFind, invitationCreate }),
    );

    await expect(
      repository.ensure({
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        templateId: "seruni-klasik",
      }),
    ).resolves.toEqual({
      kind: "ready",
      invitation: {
        invitationId: "invitation-1",
        templateId: "seruni-klasik",
        templateVersion: "1",
        slug: "rani-bima-1a2b3c4d",
        status: "DRAFT",
      },
    });
    expect(invitationCreate).not.toHaveBeenCalled();
  });

  it("binds the active template and derives the slug from the couple's names", async () => {
    const invitationCreate = vi
      .fn()
      .mockImplementation((args: { data: { slug: string } }) =>
        Promise.resolve({
          ...invitationRow,
          slug: args.data.slug,
          templateVersion: "2",
        }),
      );
    const repository = new PrismaInvitationProvisioningRepository(
      client({
        invitationFind: vi.fn().mockResolvedValue(null),
        invitationCreate,
        templateFind: vi.fn().mockResolvedValue({
          id: "seruni-klasik",
          version: "2",
        }),
        weddingFind: vi.fn().mockResolvedValue({
          partner1Name: "Rani",
          partner2Name: "Bima",
        }),
      }),
    );

    const result = await repository.ensure({
      tenantId: "tenant-1",
      weddingId: "wedding-1",
      templateId: "seruni-klasik",
    });

    expect(result.kind).toBe("ready");
    const args = invitationCreate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(args.data).toMatchObject({
      tenantId: "tenant-1",
      weddingId: "wedding-1",
      templateId: "seruni-klasik",
      templateVersion: "2",
      status: "DRAFT",
    });
    expect(String(args.data.slug)).toMatch(/^rani-bima-[0-9a-f]{8}$/);
  });

  it("selects only an ACTIVE template, newest version first", async () => {
    const templateFind = vi.fn().mockResolvedValue(null);
    const repository = new PrismaInvitationProvisioningRepository(
      client({
        invitationFind: vi.fn().mockResolvedValue(null),
        templateFind,
      }),
    );

    await expect(
      repository.ensure({
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        templateId: "retired-one",
      }),
    ).resolves.toEqual({ kind: "template-unavailable" });

    expect(templateFind).toHaveBeenCalledWith({
      where: { id: "retired-one", status: "ACTIVE" },
      orderBy: { version: "desc" },
      select: { id: true, version: true },
    });
  });

  it("reports the unique-constraint loss of a concurrent first visit as ready", async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "6.0.0" },
    );
    // First read misses, the insert loses the race, the re-read finds the winner.
    const invitationFind = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(invitationRow);
    const repository = new PrismaInvitationProvisioningRepository(
      client({
        invitationFind,
        invitationCreate: vi.fn().mockRejectedValue(duplicate),
        templateFind: vi.fn().mockResolvedValue({
          id: "seruni-klasik",
          version: "1",
        }),
        weddingFind: vi.fn().mockResolvedValue({
          partner1Name: "Rani",
          partner2Name: "Bima",
        }),
      }),
    );

    await expect(
      repository.ensure({
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        templateId: "seruni-klasik",
      }),
    ).resolves.toMatchObject({
      kind: "ready",
      invitation: { invitationId: "invitation-1" },
    });
    expect(invitationFind).toHaveBeenCalledTimes(2);
  });

  it("rethrows a non-unique database failure instead of hiding it", async () => {
    const failure = new Error("connection reset");
    const repository = new PrismaInvitationProvisioningRepository(
      client({
        invitationFind: vi.fn().mockResolvedValue(null),
        invitationCreate: vi.fn().mockRejectedValue(failure),
        templateFind: vi.fn().mockResolvedValue({
          id: "seruni-klasik",
          version: "1",
        }),
        weddingFind: vi.fn().mockResolvedValue({
          partner1Name: null,
          partner2Name: null,
        }),
      }),
    );

    await expect(
      repository.ensure({
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        templateId: "seruni-klasik",
      }),
    ).rejects.toBe(failure);
  });

  it("does not bind an invitation to a wedding the tenant does not own", async () => {
    const invitationCreate = vi.fn();
    const repository = new PrismaInvitationProvisioningRepository(
      client({
        invitationFind: vi.fn().mockResolvedValue(null),
        invitationCreate,
        templateFind: vi.fn().mockResolvedValue({
          id: "seruni-klasik",
          version: "1",
        }),
        weddingFind: vi.fn().mockResolvedValue(null),
      }),
    );

    await expect(
      repository.ensure({
        tenantId: "tenant-1",
        weddingId: "someone-elses-wedding",
        templateId: "seruni-klasik",
      }),
    ).resolves.toEqual({ kind: "not-found" });
    expect(invitationCreate).not.toHaveBeenCalled();
  });

  it("scopes both the lookup and the ownership check by tenant", async () => {
    const invitationFind = vi.fn().mockResolvedValue(null);
    const weddingFind = vi.fn().mockResolvedValue(null);
    const repository = new PrismaInvitationProvisioningRepository(
      client({
        invitationFind,
        templateFind: vi.fn().mockResolvedValue({
          id: "seruni-klasik",
          version: "1",
        }),
        weddingFind,
      }),
    );

    await repository.ensure({
      tenantId: "tenant-1",
      weddingId: "wedding-1",
      templateId: "seruni-klasik",
    });

    expect(invitationFind).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", weddingId: "wedding-1" },
      select: expect.anything(),
    });
    expect(weddingFind).toHaveBeenCalledWith({
      where: { id: "wedding-1", tenantId: "tenant-1" },
      select: { partner1Name: true, partner2Name: true },
    });
  });
});

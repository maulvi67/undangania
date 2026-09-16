import { describe, expect, it, vi } from "vitest";
import {
  PrismaTemplateCatalogueRepository,
  TemplateCatalogueInputError,
  type TemplateCatalogueEntry,
} from "./template-catalogue";

const manifest = {
  id: "seruni-klasik",
  version: "1",
  contractVersion: 1,
  name: "Seruni",
  category: "Klasik",
  supportedSections: ["couple", "events"],
};

function entry(
  overrides: Partial<TemplateCatalogueEntry> = {},
): TemplateCatalogueEntry {
  return {
    id: "seruni-klasik",
    version: "1",
    name: "Seruni",
    category: "Klasik",
    tier: "eksklusif",
    status: "ACTIVE",
    manifest,
    ...overrides,
  };
}

describe("PrismaTemplateCatalogueRepository", () => {
  it("upserts on the composite identity and never rewrites it", async () => {
    const upsert = vi.fn().mockResolvedValue({
      id: "seruni-klasik",
      version: "1",
      name: "Seruni",
      category: "Klasik",
      tier: "eksklusif",
      status: "ACTIVE",
    });
    const repository = new PrismaTemplateCatalogueRepository({
      template: { upsert },
    });

    await expect(repository.sync(entry())).resolves.toMatchObject({
      id: "seruni-klasik",
      version: "1",
    });

    const args = upsert.mock.calls[0]?.[0] as {
      where: unknown;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(args.where).toEqual({
      id_version: { id: "seruni-klasik", version: "1" },
    });
    expect(args.create).toMatchObject({
      id: "seruni-klasik",
      version: "1",
      manifest,
    });
    // Identity columns must not be an update target.
    expect(args.update).not.toHaveProperty("id");
    expect(args.update).not.toHaveProperty("version");
    expect(args.update).toMatchObject({ name: "Seruni", manifest });
  });

  it("accepts a manifest whose contractVersion is a numeric string", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const repository = new PrismaTemplateCatalogueRepository({
      template: { upsert },
    });

    await expect(
      repository.sync(
        entry({ manifest: { ...manifest, contractVersion: "2" } }),
      ),
    ).resolves.toBeDefined();
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("rejects a manifest that publication could not stamp", async () => {
    const upsert = vi.fn();
    const repository = new PrismaTemplateCatalogueRepository({
      template: { upsert },
    });

    const unusable: Array<Record<string, string | number>> = [
      {},
      { contractVersion: 0 },
      { contractVersion: -1 },
      { contractVersion: 1.5 },
      { contractVersion: "satu" },
    ];
    for (const bad of unusable) {
      await expect(
        repository.sync(entry({ manifest: bad })),
      ).rejects.toBeInstanceOf(TemplateCatalogueInputError);
    }
    // A malformed manifest must be refused before it reaches the database.
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a non-object manifest", async () => {
    const repository = new PrismaTemplateCatalogueRepository({
      template: { upsert: vi.fn() },
    });

    for (const bad of [[], null, "manifest", 7]) {
      await expect(
        repository.sync(entry({ manifest: bad as never })),
      ).rejects.toBeInstanceOf(TemplateCatalogueInputError);
    }
  });

  it("rejects a blank id or version", async () => {
    const upsert = vi.fn();
    const repository = new PrismaTemplateCatalogueRepository({
      template: { upsert },
    });

    await expect(repository.sync(entry({ id: "  " }))).rejects.toBeInstanceOf(
      TemplateCatalogueInputError,
    );
    await expect(
      repository.sync(entry({ version: "" })),
    ).rejects.toBeInstanceOf(TemplateCatalogueInputError);
    expect(upsert).not.toHaveBeenCalled();
  });
});

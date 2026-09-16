import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";

/**
 * Template catalogue synchronisation.
 *
 * Designs are authored as fixtures in the customer app (`template-data.ts`) and
 * referenced by id at checkout and in the editor. `Invitation` carries a composite
 * foreign key to `Template [id, version]`, so the catalogue has to exist as rows
 * before any invitation can be created — a fixture list alone cannot satisfy a
 * foreign key.
 *
 * Syncing is an upsert keyed on the composite identity, so it is idempotent and
 * safe to call on the request path: the first visit creates the row, later visits
 * refresh the manifest. It is deliberately not a migration or a seed script,
 * because the catalogue is product content that changes between releases while
 * the schema does not.
 *
 * The manifest is written as given. Its contract version is what publication
 * reads to stamp a snapshot, so a manifest without a usable integer is rejected
 * here rather than at publish time, where the failure would be far from its
 * cause.
 */

const templateRowSelect = {
  id: true,
  version: true,
  name: true,
  category: true,
  tier: true,
  status: true,
} as const satisfies Prisma.TemplateSelect;

type TemplateRow = Prisma.TemplateGetPayload<{
  select: typeof templateRowSelect;
}>;

type TemplateCatalogueClient = Readonly<{
  template: {
    upsert(args: {
      where: Prisma.TemplateWhereUniqueInput;
      create: Prisma.TemplateUncheckedCreateInput;
      update: Prisma.TemplateUncheckedUpdateInput;
      select: typeof templateRowSelect;
    }): Promise<TemplateRow>;
  };
}>;

export function adaptTemplateCatalogueClient(
  client: Pick<PrismaClient, "template">,
): TemplateCatalogueClient {
  return {
    template: {
      upsert: (args) => client.template.upsert(args),
    },
  };
}

export type TemplateCatalogueEntry = Readonly<{
  id: string;
  version: string;
  name: string;
  category: string;
  tier: string;
  status: string;
  /** Opaque to storage; `contractVersion` is read from it at publish time. */
  manifest: Prisma.InputJsonValue;
}>;

export class TemplateCatalogueInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TemplateCatalogueInputError";
  }
}

export interface TemplateCatalogueRepository {
  sync(entry: TemplateCatalogueEntry): Promise<TemplateRow>;
}

function assertSyncable(entry: TemplateCatalogueEntry): void {
  if (entry.id.trim().length === 0) {
    throw new TemplateCatalogueInputError("Template id is required");
  }
  if (entry.version.trim().length === 0) {
    throw new TemplateCatalogueInputError("Template version is required");
  }

  // `readContractVersion` in the editor repository accepts a number or a numeric
  // string. Anything else would make the template unpublishable, so the failure
  // is raised at sync rather than surfacing later as "template unavailable".
  const manifest = entry.manifest;
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest)
  ) {
    throw new TemplateCatalogueInputError(
      "Template manifest must be an object",
    );
  }
  const contractVersion = (manifest as Record<string, unknown>).contractVersion;
  const usable =
    (typeof contractVersion === "number" &&
      Number.isInteger(contractVersion) &&
      contractVersion > 0) ||
    (typeof contractVersion === "string" && /^\d+$/.test(contractVersion));
  if (!usable) {
    throw new TemplateCatalogueInputError(
      "Template manifest needs a positive integer contractVersion",
    );
  }
}

export class PrismaTemplateCatalogueRepository implements TemplateCatalogueRepository {
  public constructor(
    private readonly client: TemplateCatalogueClient = adaptTemplateCatalogueClient(
      prisma,
    ),
  ) {}

  public async sync(entry: TemplateCatalogueEntry): Promise<TemplateRow> {
    assertSyncable(entry);

    return this.client.template.upsert({
      where: { id_version: { id: entry.id, version: entry.version } },
      create: {
        id: entry.id,
        version: entry.version,
        name: entry.name,
        category: entry.category,
        tier: entry.tier,
        manifest: entry.manifest,
        status: entry.status,
      },
      // `id` and `version` are the identity and are never rewritten.
      update: {
        name: entry.name,
        category: entry.category,
        tier: entry.tier,
        manifest: entry.manifest,
        status: entry.status,
      },
      select: templateRowSelect,
    });
  }
}

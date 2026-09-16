import { randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";

/**
 * Invitation provisioning.
 *
 * An `Invitation` is the row the editor edits and the public page renders, and it
 * requires a template. Until the couple picks one there is nothing to edit — but
 * the editor is reached by URL with a template in the query string, so instead of
 * failing on a missing row, the first visit binds the chosen template to the
 * wedding and returns the draft.
 *
 * `Invitation.weddingId` is unique, so "one invitation per wedding" is a schema
 * guarantee rather than a convention here. Provisioning is therefore: return the
 * existing row, or create it.
 *
 * Two concurrent first visits can both reach the create. The unique constraint
 * makes one lose, and the loser re-reads rather than reporting an error — both
 * callers asked for the same end state, so both should receive it. The constraint
 * is the synchronisation point, which is also why the read and the create are not
 * wrapped in one transaction.
 *
 * The slug is generated, never taken from the request: it is the invitation's
 * public address, so a client-supplied value would let one tenant claim another's
 * URL. A random suffix makes collisions impossible rather than merely unlikely.
 * It is not a secret — the row it addresses is public by design.
 */

const invitationSelect = {
  id: true,
  tenantId: true,
  weddingId: true,
  templateId: true,
  templateVersion: true,
  slug: true,
  status: true,
} as const satisfies Prisma.InvitationSelect;

type InvitationRow = Prisma.InvitationGetPayload<{
  select: typeof invitationSelect;
}>;

const templateAvailabilitySelect = {
  id: true,
  version: true,
} as const satisfies Prisma.TemplateSelect;

type TemplateAvailabilityRow = Prisma.TemplateGetPayload<{
  select: typeof templateAvailabilitySelect;
}>;

const weddingNameSelect = {
  partner1Name: true,
  partner2Name: true,
} as const satisfies Prisma.WeddingSelect;

type WeddingNameRow = Prisma.WeddingGetPayload<{
  select: typeof weddingNameSelect;
}>;

/**
 * Structural delegates, deliberately narrow so tests can inject plain objects. A
 * real Prisma client is adapted by `adaptInvitationProvisioningClient`, because
 * Prisma's delegate methods are generic over `SelectSubset` and cannot be
 * compared against a concrete signature structurally.
 */
type InvitationProvisioningClient = Readonly<{
  invitation: {
    findFirst(args: {
      where: Prisma.InvitationWhereInput;
      select: typeof invitationSelect;
    }): Promise<InvitationRow | null>;
    create(args: {
      data: Prisma.InvitationUncheckedCreateInput;
      select: typeof invitationSelect;
    }): Promise<InvitationRow>;
  };
  template: {
    findFirst(args: {
      where: Prisma.TemplateWhereInput;
      orderBy: Prisma.TemplateOrderByWithRelationInput;
      select: typeof templateAvailabilitySelect;
    }): Promise<TemplateAvailabilityRow | null>;
  };
  wedding: {
    findFirst(args: {
      where: Prisma.WeddingWhereInput;
      select: typeof weddingNameSelect;
    }): Promise<WeddingNameRow | null>;
  };
}>;

export function adaptInvitationProvisioningClient(
  client: Pick<PrismaClient, "invitation" | "template" | "wedding">,
): InvitationProvisioningClient {
  return {
    invitation: {
      findFirst: (args) => client.invitation.findFirst(args),
      create: (args) => client.invitation.create(args),
    },
    template: {
      findFirst: (args) => client.template.findFirst(args),
    },
    wedding: {
      findFirst: (args) => client.wedding.findFirst(args),
    },
  };
}

export type ProvisionedInvitation = Readonly<{
  invitationId: string;
  templateId: string;
  templateVersion: string;
  slug: string;
  status: string;
}>;

export type InvitationProvisionResult =
  | Readonly<{ kind: "ready"; invitation: ProvisionedInvitation }>
  | Readonly<{ kind: "template-unavailable" }>
  | Readonly<{ kind: "not-found" }>;

export interface InvitationProvisioningRepository {
  ensure(input: {
    tenantId: string;
    weddingId: string;
    templateId: string;
  }): Promise<InvitationProvisionResult>;
}

/**
 * Derives a public slug from the couple's names, falling back to the template id.
 *
 * Only lowercase ASCII and single dashes survive, so the result is always a safe
 * path segment whatever characters the couple typed. Names are stripped of marks
 * before filtering, so an accented letter becomes its base letter rather than
 * disappearing.
 */
export function buildInvitationSlug(input: {
  templateId: string;
  partner1Name: string | null;
  partner2Name: string | null;
}): string {
  const normalize = (value: string): string =>
    value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "");

  const names = [input.partner1Name, input.partner2Name]
    .map((name) => (name === null ? "" : normalize(name)))
    .filter((name) => name.length > 0);

  const stem = names.length > 0 ? names.join("-") : normalize(input.templateId);
  const safeStem = stem.length === 0 ? "undangan" : stem;

  // 100 is the editor contract's slug limit; 80 leaves room for the suffix.
  return `${safeStem.slice(0, 80)}-${randomSuffix()}`;
}

function randomSuffix(): string {
  return randomBytes(4).toString("hex");
}

export class PrismaInvitationProvisioningRepository implements InvitationProvisioningRepository {
  public constructor(
    private readonly client: InvitationProvisioningClient = adaptInvitationProvisioningClient(
      prisma,
    ),
  ) {}

  public async ensure(input: {
    tenantId: string;
    weddingId: string;
    templateId: string;
  }): Promise<InvitationProvisionResult> {
    const existing = await this.client.invitation.findFirst({
      where: { tenantId: input.tenantId, weddingId: input.weddingId },
      select: invitationSelect,
    });
    if (existing !== null) {
      // The couple may have opened the editor with a different design in the
      // query string. Re-binding is refused here: switching templates is a
      // deliberate product action with its own confirmation, not a side effect of
      // a URL parameter.
      return { kind: "ready", invitation: toProvisioned(existing) };
    }

    const template = await this.client.template.findFirst({
      where: { id: input.templateId, status: "ACTIVE" },
      // Newest version wins, so a released revision is picked up without a data
      // migration.
      orderBy: { version: "desc" },
      select: templateAvailabilitySelect,
    });
    if (template === null) return { kind: "template-unavailable" };

    const wedding = await this.client.wedding.findFirst({
      where: { id: input.weddingId, tenantId: input.tenantId },
      select: weddingNameSelect,
    });
    // Ownership is asserted above; a miss means the caller raced a deletion, so
    // there is no wedding left to bind an invitation to.
    if (wedding === null) return { kind: "not-found" };

    try {
      const created = await this.client.invitation.create({
        data: {
          tenantId: input.tenantId,
          weddingId: input.weddingId,
          templateId: template.id,
          templateVersion: template.version,
          slug: buildInvitationSlug({
            templateId: template.id,
            partner1Name: wedding.partner1Name,
            partner2Name: wedding.partner2Name,
          }),
          status: "DRAFT",
          // An empty draft is valid: the editor contract supplies a default for
          // every section, so nothing is invented here.
          draftConfig: {},
        },
        select: invitationSelect,
      });
      return { kind: "ready", invitation: toProvisioned(created) };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      // A concurrent first visit won the insert; return what it created.
      const winner = await this.client.invitation.findFirst({
        where: { tenantId: input.tenantId, weddingId: input.weddingId },
        select: invitationSelect,
      });
      if (winner === null) throw error;
      return { kind: "ready", invitation: toProvisioned(winner) };
    }
  }
}

function toProvisioned(row: InvitationRow): ProvisionedInvitation {
  return {
    invitationId: row.id,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    slug: row.slug,
    status: row.status,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

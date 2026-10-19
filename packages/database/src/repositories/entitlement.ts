import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";

/**
 * Entitlement lookups.
 *
 * An order item names the product it licensed (`productCode`), and the checkout
 * uses the template id as that product code. A template purchase therefore grants
 * one active row per tenant for that template, independent of which invitation
 * inside the tenant renders it.
 *
 * The check is deliberately a read of the entitlement table rather than a flag on
 * the invitation: entitlement expiry and revocation stay in one place, and no
 * caller can make an invitation publishable by editing its own row.
 */

export type EntitlementScope = Readonly<{
  tenantId: string;
  invitationId: string;
  at: Date;
}>;

export interface EntitlementRepository {
  hasActiveForInvitation(input: EntitlementScope): Promise<boolean>;
}

const invitationSelect = { templateId: true } as const;
const entitlementSelect = { id: true } as const;

type InvitationRow = Prisma.InvitationGetPayload<{
  select: typeof invitationSelect;
}>;
type EntitlementRow = Prisma.EntitlementGetPayload<{
  select: typeof entitlementSelect;
}>;

/**
 * Structural delegates so the repository can be tested without a database. The
 * shapes are the narrow slices this module actually uses.
 */
export type EntitlementRepositoryClient = Readonly<{
  invitation: {
    findFirst(args: {
      where: Prisma.InvitationWhereInput;
      select: typeof invitationSelect;
    }): Promise<InvitationRow | null>;
  };
  entitlement: {
    findFirst(args: {
      where: Prisma.EntitlementWhereInput;
      select: typeof entitlementSelect;
    }): Promise<EntitlementRow | null>;
  };
}>;

export function adaptEntitlementClient(
  client: Pick<PrismaClient, "invitation" | "entitlement">,
): EntitlementRepositoryClient {
  return {
    invitation: {
      findFirst: (args) => client.invitation.findFirst(args),
    },
    entitlement: {
      findFirst: (args) => client.entitlement.findFirst(args),
    },
  };
}

export class PrismaEntitlementRepository implements EntitlementRepository {
  public constructor(
    private readonly client: EntitlementRepositoryClient = adaptEntitlementClient(
      prisma,
    ),
  ) {}

  public async hasActiveForInvitation(
    input: EntitlementScope,
  ): Promise<boolean> {
    const invitation = await this.client.invitation.findFirst({
      where: { id: input.invitationId, tenantId: input.tenantId },
      select: invitationSelect,
    });
    if (invitation === null) return false;

    const entitlement = await this.client.entitlement.findFirst({
      where: {
        tenantId: input.tenantId,
        productCode: invitation.templateId,
        status: "ACTIVE",
        startsAt: { lte: input.at },
        OR: [{ endsAt: null }, { endsAt: { gt: input.at } }],
      },
      select: entitlementSelect,
    });

    return entitlement !== null;
  }
}

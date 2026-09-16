import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";

/**
 * Workspace resolution.
 *
 * Every customer-facing surface — onboarding, the invitation editor, the
 * dashboard, guests — needs to know *which* wedding the signed-in session is
 * working on, but the `Session` row only carries a user and `TenantMembership`
 * only carries a tenant. Neither names a wedding.
 *
 * Registration provisions exactly one wedding per tenant, so "the tenant's
 * wedding" is well defined here: the oldest row, which is the one created at
 * signup. Should a tenant ever hold several weddings, this returns the first and
 * callers must move to an explicit wedding picker rather than silently operating
 * on the wrong one.
 *
 * The identifier is resolved from `tenantId` alone — never from a client-supplied
 * value — so a request cannot reach another tenant's wedding by passing a guessed
 * id.
 */

const weddingWorkspaceSelect = {
  id: true,
  displayName: true,
  onboardingCompletedAt: true,
} as const satisfies Prisma.WeddingSelect;

type WeddingWorkspaceRow = Prisma.WeddingGetPayload<{
  select: typeof weddingWorkspaceSelect;
}>;

const invitationRefSelect = {
  id: true,
  slug: true,
  status: true,
} as const satisfies Prisma.InvitationSelect;

type InvitationRefRow = Prisma.InvitationGetPayload<{
  select: typeof invitationRefSelect;
}>;

/**
 * Structural delegates, deliberately narrow so tests can inject plain objects. A
 * real Prisma client is adapted by `adaptWeddingWorkspaceClient` rather than cast
 * into place: Prisma's delegate methods are generic over `SelectSubset`, so
 * comparing them against a concrete signature is not sound.
 */
type WeddingWorkspaceClient = Readonly<{
  wedding: {
    findFirst(args: {
      where: Prisma.WeddingWhereInput;
      orderBy: Prisma.WeddingOrderByWithRelationInput;
      select: typeof weddingWorkspaceSelect;
    }): Promise<WeddingWorkspaceRow | null>;
  };
  invitation: {
    findFirst(args: {
      where: Prisma.InvitationWhereInput;
      select: typeof invitationRefSelect;
    }): Promise<InvitationRefRow | null>;
  };
}>;

/**
 * Each method is passed through in a lambda so the generic delegate signature is
 * checked against concrete arguments instead of being compared structurally.
 */
export function adaptWeddingWorkspaceClient(
  client: Pick<PrismaClient, "wedding" | "invitation">,
): WeddingWorkspaceClient {
  return {
    wedding: {
      findFirst: (args) => client.wedding.findFirst(args),
    },
    invitation: {
      findFirst: (args) => client.invitation.findFirst(args),
    },
  };
}

export type WorkspaceRef = Readonly<{
  weddingId: string;
  displayName: string;
  onboardingCompletedAt: Date | null;
}>;

export type InvitationRef = Readonly<{
  invitationId: string;
  slug: string;
  status: string;
}>;

export interface WeddingWorkspaceRepository {
  resolveForTenant(tenantId: string): Promise<WorkspaceRef | null>;
  resolveInvitation(tenantId: string): Promise<InvitationRef | null>;
}

export class PrismaWeddingWorkspaceRepository implements WeddingWorkspaceRepository {
  public constructor(
    private readonly client: WeddingWorkspaceClient = adaptWeddingWorkspaceClient(
      prisma,
    ),
  ) {}

  public async resolveForTenant(
    tenantId: string,
  ): Promise<WorkspaceRef | null> {
    if (tenantId.trim().length === 0) return null;

    const row = await this.client.wedding.findFirst({
      where: { tenantId },
      // Oldest first: the wedding provisioned at registration is the workspace
      // the account was created with.
      orderBy: { createdAt: "asc" },
      select: weddingWorkspaceSelect,
    });
    if (row === null) return null;

    return {
      weddingId: row.id,
      displayName: row.displayName,
      onboardingCompletedAt: row.onboardingCompletedAt,
    };
  }

  /**
   * The wedding's invitation, if a design has been chosen yet.
   *
   * `Invitation.weddingId` is unique, so there is at most one. A null result
   * means the couple has not picked a template — not that anything is broken —
   * and callers surface that as "choose a design" rather than an error.
   */
  public async resolveInvitation(
    tenantId: string,
  ): Promise<InvitationRef | null> {
    if (tenantId.trim().length === 0) return null;

    const row = await this.client.invitation.findFirst({
      where: { tenantId, wedding: { tenantId } },
      select: invitationRefSelect,
    });
    if (row === null) return null;

    return { invitationId: row.id, slug: row.slug, status: row.status };
  }
}

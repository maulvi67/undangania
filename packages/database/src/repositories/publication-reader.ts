import {
  Prisma,
  type InvitationStatus,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "../client";

/**
 * Active publication reads for the public invitation page.
 *
 * The public page is unauthenticated, so this is the one query path where the
 * tenant boundary is established by the URL itself. That makes two rules
 * load-bearing:
 *
 *   1. Only `active` rows are returned. The schema cannot enforce a single active
 *      publication, so the editor demotes the previous one before promoting a new
 *      one; reading the active flag is what makes a draft unreachable from the
 *      public address.
 *   2. The repository's internal DTO carries only the tenant and wedding scope
 *      needed for render-time media authorization plus the immutable snapshot
 *      fields. The customer page receives the snapshot and safe resolved media,
 *      never the draft, object keys, or storage credentials.
 *
 * A slug that does not exist, or that belongs to an invitation with no active
 * publication, is reported identically as `null` so the page cannot be used to
 * probe for which slugs are taken.
 */

const publicPublicationSelect = {
  tenantId: true,
  snapshot: true,
  templateId: true,
  templateVersion: true,
  contractVersion: true,
  invitation: { select: { weddingId: true, status: true } },
} as const satisfies Prisma.InvitationPublicationSelect;

type PublicPublicationRow = Prisma.InvitationPublicationGetPayload<{
  select: typeof publicPublicationSelect;
}>;

/**
 * Structural delegate, deliberately narrow so tests can inject a plain object.
 * A real client is adapted by `adaptPublicationReaderClient` rather than cast
 * into place: Prisma's delegate methods are generic over `SelectSubset`, so
 * comparing them against a concrete signature is not sound.
 */
type PublicationReaderClient = Readonly<{
  invitationPublication: {
    findFirst(args: {
      where: Prisma.InvitationPublicationWhereInput;
      select: typeof publicPublicationSelect;
    }): Promise<PublicPublicationRow | null>;
  };
}>;

export function adaptPublicationReaderClient(
  client: Pick<PrismaClient, "invitationPublication">,
): PublicationReaderClient {
  return {
    invitationPublication: {
      findFirst: (args) => client.invitationPublication.findFirst(args),
    },
  };
}

export type PublicPublication = Readonly<{
  slug: string;
  tenantId: string;
  weddingId: string;
  templateId: string;
  templateVersion: string;
  contractVersion: number;
  invitationStatus: InvitationStatus;
  snapshot: unknown;
}>;

export interface PublicationReaderRepository {
  findActiveBySlug(slug: string): Promise<PublicPublication | null>;
}

/**
 * A publication slug is the public address, so it is constrained to what the
 * generator can emit. Rejecting anything else before the query means a hostile
 * slug cannot become a client-side path or a costly scan parameter.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 100;

export function isPublicSlug(slug: string): boolean {
  return (
    slug.length > 0 && slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug)
  );
}

export class PrismaPublicationReaderRepository implements PublicationReaderRepository {
  public constructor(
    private readonly client: PublicationReaderClient = adaptPublicationReaderClient(
      prisma,
    ),
  ) {}

  public async findActiveBySlug(
    slug: string,
  ): Promise<PublicPublication | null> {
    if (!isPublicSlug(slug)) return null;

    const row = await this.client.invitationPublication.findFirst({
      where: {
        active: true,
        invitation: { slug },
      },
      select: publicPublicationSelect,
    });
    if (row === null) return null;

    return {
      slug,
      tenantId: row.tenantId,
      weddingId: row.invitation.weddingId,
      templateId: row.templateId,
      templateVersion: row.templateVersion,
      contractVersion: row.contractVersion,
      invitationStatus: row.invitation.status,
      snapshot: row.snapshot,
    };
  }
}

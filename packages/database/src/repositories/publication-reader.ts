import { Prisma, type PrismaClient } from "@prisma/client";
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
 *   2. Only the snapshot is returned — never the draft, the tenant, or the
 *      invitation id. A published snapshot is already public content; everything
 *      else about the row is internal, so it is not selected in the first place.
 *
 * A slug that does not exist, or that belongs to an invitation with no active
 * publication, is reported identically as `null` so the page cannot be used to
 * probe for which slugs are taken.
 */

const publicPublicationSelect = {
  snapshot: true,
  templateId: true,
  templateVersion: true,
  contractVersion: true,
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
  templateId: string;
  templateVersion: string;
  contractVersion: number;
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
      templateId: row.templateId,
      templateVersion: row.templateVersion,
      contractVersion: row.contractVersion,
      snapshot: row.snapshot,
    };
  }
}

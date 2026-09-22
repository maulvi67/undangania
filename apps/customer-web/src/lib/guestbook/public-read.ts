import {
  isPublicSlug,
  PrismaApprovedGuestbookRepository,
  PrismaPublicationReaderRepository,
  type ApprovedGuestbookPage,
} from "@wedding/database";

export type PublicGuestbookReadResult =
  | Readonly<{ kind: "ok"; page: ApprovedGuestbookPage }>
  | Readonly<{ kind: "unavailable" }>;

/**
 * Loads the approved guestbook for the active publication behind a public slug.
 *
 * The slug establishes publication scope on the server. The public repository is
 * then called with the tenant and wedding ids returned by that publication; the
 * browser never supplies either identifier and a database failure is intentionally
 * indistinguishable from an empty public guestbook.
 */
export async function loadApprovedGuestbook(
  slug: string,
  cursor?: string,
): Promise<PublicGuestbookReadResult> {
  if (!isPublicSlug(slug)) return { kind: "unavailable" };

  try {
    const publication = await new PrismaPublicationReaderRepository().findActiveBySlug(
      slug,
    );
    if (publication === null) return { kind: "unavailable" };

    const page = await new PrismaApprovedGuestbookRepository().loadApproved(
      {
        tenantId: publication.tenantId,
        weddingId: publication.weddingId,
      },
      { cursor: cursor ?? null },
    );
    return { kind: "ok", page };
  } catch {
    return { kind: "unavailable" };
  }
}

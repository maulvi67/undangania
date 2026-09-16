import {
  PrismaPublicationReaderRepository,
  type PublicPublication,
} from "@wedding/database";
import { invitationViewModelSchema } from "@wedding/template-engine";
import {
  isPublicInvitationFixture,
  type PublicInvitationFixture,
} from "./fixtures";

/**
 * Public invitation lookup.
 *
 * The public page is unauthenticated, so the URL is the only thing that scopes
 * the request. The repository returns an active publication or nothing; this
 * module turns that row into something renderable, or `null` so the page shows a
 * 404 rather than distinguishing "no such slug" from "not published yet".
 *
 * A snapshot that fails the current view-model contract is treated as absent
 * rather than rendered best-effort: a half-rendered public page would be worse
 * than a clean not-found, and it would silently publish content the contract
 * cannot describe.
 *
 * The fixture path exists for the design-in-development flow. It is consulted
 * only when no real publication exists *and* the search parameter names a known
 * fixture, so a real slug always wins and production cannot be switched to
 * fixture content from the query string.
 */

export type PublicInvitationPage =
  | Readonly<{
      kind: "published";
      slug: string;
      templateId: string;
      templateVersion: string;
      contractVersion: number;
      model: unknown;
    }>
  | Readonly<{ kind: "missing" }>;

export async function resolvePublicInvitation(input: {
  slug: string;
  /** Set only in development; ignored for a real publication. */
  fixture?: string;
}): Promise<PublicInvitationPage> {
  const publication = await findActivePublication(input.slug);
  if (publication !== null) {
    const parsed = invitationViewModelSchema.safeParse(publication.snapshot);
    if (!parsed.success) return { kind: "missing" };

    return {
      kind: "published",
      slug: publication.slug,
      templateId: publication.templateId,
      templateVersion: publication.templateVersion,
      contractVersion: publication.contractVersion,
      model: parsed.data,
    };
  }

  return { kind: "missing" };
}

async function findActivePublication(
  slug: string,
): Promise<PublicPublication | null> {
  try {
    return await new PrismaPublicationReaderRepository().findActiveBySlug(slug);
  } catch {
    // A database outage must not surface as a 500 on a public page; the caller
    // renders the same not-found it would for an unpublished slug.
    return null;
  }
}

/**
 * True when dev fixture content may be substituted for a missing publication.
 *
 * A type predicate as well as a runtime check, so callers narrow without a cast.
 */
export function fixtureAllowed(
  value: string | undefined,
): value is PublicInvitationFixture {
  return (
    process.env.NODE_ENV !== "production" && isPublicInvitationFixture(value)
  );
}

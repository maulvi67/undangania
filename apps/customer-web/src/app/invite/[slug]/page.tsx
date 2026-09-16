import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { invitationViewModelSchema } from "@wedding/template-engine";
import {
  getPublicInvitationSnapshot,
  getPublicInvitationSlugs,
  type PublicInvitationFixture,
} from "../../../lib/public-invitation/fixtures";
import {
  fixtureAllowed,
  resolvePublicInvitation,
} from "../../../lib/public-invitation/server";
import {
  GUEST_TOKEN_PARAM,
  invalidGuestContext,
  resolveGuestContext,
  unavailableGuestContext,
} from "../../../lib/public-invitation/guest-access";
import {
  getGuestExperienceFixture,
  isGuestExperienceFixture,
  type GuestExperienceFixture,
} from "../../../lib/public-invitation/guest-context-fixtures";
import type { GuestContext } from "../../../lib/public-invitation/guest-context";
import { renderPublicationSnapshot } from "../../../components/public-invitation/registry";
import { GuestInvitationExperience } from "../../../components/public-invitation/guest-invitation-experience";
import type { GuestbookSimulation } from "../../../lib/guestbook/stub-transport";
import type { RsvpSimulation } from "../../../lib/rsvp/stub-transport";
import "../../golden-invitation.css";

interface PublicInvitationPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Only development fixtures are prerendered. Real invitations depend on the
 * request's slug and on whether a publication is currently active, so they are
 * rendered on demand.
 */
export function generateStaticParams() {
  if (process.env.NODE_ENV === "production") return [];
  return getPublicInvitationSlugs().map((slug) => ({ slug }));
}

/**
 * The snapshot a request should render.
 *
 * A real, active publication always wins. The fixture path is consulted only in
 * development and only when the search parameter names a known fixture, so
 * production content can never be replaced from the query string.
 */
async function snapshotFor(slug: string, fixture: PublicInvitationFixture) {
  if (fixtureAllowed(fixture) && fixture !== "normal") {
    return getPublicInvitationSnapshot(slug, fixture) ?? null;
  }

  const resolved = await resolvePublicInvitation({ slug });
  if (resolved.kind === "published") return resolved;

  // Nothing published under this slug; fall back to a fixture only in dev.
  return fixtureAllowed(fixture)
    ? (getPublicInvitationSnapshot(slug, fixture) ?? null)
    : null;
}

export async function generateMetadata({
  params,
}: PublicInvitationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const snapshot = await snapshotFor(slug, "normal");
  if (!snapshot) return { title: "Undangan tidak tersedia — Wedding System" };

  const parsed = invitationViewModelSchema.safeParse(snapshot.model);
  if (!parsed.success) {
    return { title: "Undangan tidak tersedia — Wedding System" };
  }

  return {
    title: `Undangan pernikahan ${parsed.data.couple.displayNames}`,
    description: `Undangan pernikahan ${parsed.data.couple.displayNames}.`,
    // A personalized link is not public content, and neither is the invitation
    // page itself: it must never be indexed under the couple's slug.
    robots: { index: false, follow: false },
  };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function fixtureFromSearch(value: string | undefined): PublicInvitationFixture {
  return fixtureAllowed(value) ? value : "normal";
}

function guestFixtureFromSearch(
  value: string | undefined,
): GuestExperienceFixture {
  if (fixtureAllowed(value) && isGuestExperienceFixture(value)) return value;
  return "normal";
}

/**
 * The guest experience for this request.
 *
 * A real personalized link is resolved server-side and always wins over the
 * development fixture — the same precedence the snapshot uses. The fixture path
 * exists only so the RSVP and guestbook states can be designed without a database,
 * and it is unreachable in production.
 */
async function guestExperienceFor(input: {
  slug: string;
  token: string | undefined;
  guestFixture: string | undefined;
  publicFixture: PublicInvitationFixture;
}): Promise<
  | Readonly<{
      context: GuestContext;
      rsvpSimulation: RsvpSimulation | null;
      guestbookSimulation: GuestbookSimulation | null;
      token: string | undefined;
    }>
  | undefined
> {
  if (input.token !== undefined) {
    const resolved = await resolveGuestContext(input.token);
    if (resolved.kind === "ok") {
      return {
        context: resolved.context,
        rsvpSimulation: null,
        guestbookSimulation: null,
        token: input.token,
      };
    }
    return {
      context:
        resolved.kind === "invalid"
          ? invalidGuestContext()
          : unavailableGuestContext(),
      rsvpSimulation: null,
      guestbookSimulation: null,
      token: undefined,
    };
  }

  // Development fixture path: only reachable when a known fixture is named and the
  // environment is not production.
  if (
    process.env.NODE_ENV !== "production" &&
    isGuestExperienceFixture(input.guestFixture)
  ) {
    const fixture = getGuestExperienceFixture(
      input.publicFixture,
      guestFixtureFromSearch(input.guestFixture),
    );
    return {
      context: fixture.context,
      rsvpSimulation: fixture.rsvpSimulation,
      guestbookSimulation: fixture.guestbookSimulation,
      token: undefined,
    };
  }

  return undefined;
}

export default async function PublicInvitationPage({
  params,
  searchParams,
}: PublicInvitationPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const fixture = fixtureFromSearch(first(query.fixture));

  const snapshot = await snapshotFor(slug, fixture);
  if (!snapshot) notFound();

  const model = invitationViewModelSchema.parse(snapshot.model);
  const guest = await guestExperienceFor({
    slug,
    token: first(query[GUEST_TOKEN_PARAM]),
    guestFixture: first(query.guestFixture),
    publicFixture: fixture,
  });
  const invitation = renderPublicationSnapshot({
    templateId: snapshot.templateId,
    templateVersion: snapshot.templateVersion,
    contractVersion: snapshot.contractVersion,
    model,
  });

  return (
    <div className="gld-page">
      <a className="ui-skip-link" href="#undangan">
        Langsung ke isi undangan
      </a>
      <header className="gld-header">
        <Link
          className="gld-header__brand"
          href="/"
          aria-label="Wedding System"
        >
          Wedding System
        </Link>
        <span className="gld-header__note">Undangan digital</span>
      </header>
      <main id="undangan" tabIndex={-1}>
        {invitation}
        {guest ? (
          <GuestInvitationExperience
            coupleNames={model.couple.displayNames}
            context={guest.context}
            {...(guest.token === undefined ? {} : { guestToken: guest.token })}
          />
        ) : (
          <span id="rsvp" className="ui-visually-hidden" aria-hidden="true" />
        )}
      </main>
      <footer className="gld-page__footer">
        <p>Dibuat dengan tenang oleh Wedding System.</p>
      </footer>
    </div>
  );
}

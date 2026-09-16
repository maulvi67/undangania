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
  getGuestExperienceFixture,
  isGuestExperienceFixture,
  type GuestExperienceFixture,
} from "../../../lib/public-invitation/guest-context-fixtures";
import { renderPublicationSnapshot } from "../../../components/public-invitation/registry";
import { GuestInvitationExperience } from "../../../components/public-invitation/guest-invitation-experience";
import "../../golden-invitation.css";

interface PublicInvitationPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fixture?: string; guestFixture?: string }>;
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
    robots: { index: false, follow: false },
  };
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

export default async function PublicInvitationPage({
  params,
  searchParams,
}: PublicInvitationPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const fixture = fixtureFromSearch(query.fixture);
  const hasGuestFixture =
    process.env.NODE_ENV !== "production" &&
    isGuestExperienceFixture(query.guestFixture);
  const guestFixture = guestFixtureFromSearch(query.guestFixture);

  const snapshot = await snapshotFor(slug, fixture);
  if (!snapshot) notFound();

  const model = invitationViewModelSchema.parse(snapshot.model);
  const guestExperience = hasGuestFixture
    ? getGuestExperienceFixture(fixture, guestFixture)
    : undefined;
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
        {guestExperience ? (
          <GuestInvitationExperience
            coupleNames={model.couple.displayNames}
            context={guestExperience.context}
            rsvpSimulation={guestExperience.rsvpSimulation}
            guestbookSimulation={guestExperience.guestbookSimulation}
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

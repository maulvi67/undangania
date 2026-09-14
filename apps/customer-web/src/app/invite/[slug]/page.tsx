import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { invitationViewModelSchema } from "@wedding/template-engine";
import {
  getPublicInvitationSnapshot,
  getPublicInvitationSlugs,
  isPublicInvitationFixture,
  type PublicInvitationFixture,
} from "../../../lib/public-invitation/fixtures";
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

export function generateStaticParams() {
  return getPublicInvitationSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PublicInvitationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const snapshot = getPublicInvitationSnapshot(slug);
  if (!snapshot) return { title: "Undangan tidak tersedia — Wedding System" };
  const model = invitationViewModelSchema.parse(snapshot.model);
  const title = `Undangan pernikahan ${model.couple.displayNames}`;
  return {
    title,
    description: `Undangan pernikahan ${model.couple.displayNames}.`,
    robots: { index: false, follow: false },
  };
}

function fixtureFromSearch(value: string | undefined): PublicInvitationFixture {
  if (process.env.NODE_ENV !== "production" && isPublicInvitationFixture(value))
    return value;
  return "normal";
}

function guestFixtureFromSearch(
  value: string | undefined,
): GuestExperienceFixture {
  if (process.env.NODE_ENV !== "production" && isGuestExperienceFixture(value))
    return value;
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
  const snapshot = getPublicInvitationSnapshot(slug, fixture);
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

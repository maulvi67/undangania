import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { invitationViewModelSchema } from "@wedding/template-engine";
import { resolvePublicInvitation } from "../../../lib/public-invitation/server";
import {
  GUEST_TOKEN_PARAM,
  invalidGuestContext,
  resolveGuestContext,
  unavailableGuestContext,
} from "../../../lib/public-invitation/guest-access";
import type { GuestContext } from "../../../lib/public-invitation/guest-context";
import { renderPublicationSnapshot } from "../../../components/public-invitation/registry";
import { ApprovedGuestbook } from "../../../components/public-invitation/approved-guestbook";
import { GuestInvitationExperience } from "../../../components/public-invitation/guest-invitation-experience";
import { loadApprovedGuestbook } from "../../../lib/guestbook/public-read";
import "../../golden-invitation.css";

interface PublicInvitationPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Real invitations depend on the request's slug and on whether a publication is
 * currently active, so they are rendered on demand.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: PublicInvitationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const snapshot = await resolvePublicInvitation({ slug });
  if (snapshot.kind === "missing") {
    return { title: "Undangan tidak tersedia — Undangania" };
  }
  if (snapshot.kind !== "published") {
    return {
      title:
        snapshot.kind === "paused"
          ? "Undangan sedang dijeda — Undangania"
          : "Undangan sudah berakhir — Undangania",
    };
  }

  const parsed = invitationViewModelSchema.safeParse(snapshot.model);
  if (!parsed.success) {
    return { title: "Undangan tidak tersedia — Undangania" };
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

/**
 * The guest experience for this request.
 *
 * A personalized link is resolved server-side: the token is the bearer
 * credential and the slug binds it to this page, so a household can only ever
 * read and write its own context.
 */
async function guestExperienceFor(input: {
  slug: string;
  token: string | undefined;
}): Promise<
  | Readonly<{
      context: GuestContext;
      token: string | undefined;
    }>
  | undefined
> {
  if (input.token !== undefined) {
    const resolved = await resolveGuestContext(input.token, input.slug);
    if (resolved.kind === "ok") {
      return {
        context: resolved.context,
        token: input.token,
      };
    }
    return {
      context:
        resolved.kind === "invalid"
          ? invalidGuestContext()
          : unavailableGuestContext(),
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

  const snapshot = await resolvePublicInvitation({ slug });
  if (snapshot.kind === "missing") notFound();

  if (snapshot.kind !== "published") {
    const paused = snapshot.kind === "paused";
    return (
      <div className="gld-page">
        <header className="gld-header">
          <Link className="gld-header__brand" href="/" aria-label="Undangania">
            Undangania
          </Link>
          <span className="gld-header__note">Undangan digital</span>
        </header>
        <main className="gld-availability" id="undangan">
          <p className="gld-kicker">Status undangan</p>
          <h1>
            {paused ? "Undangan sedang dijeda" : "Undangan sudah berakhir"}
          </h1>
          <p>
            {paused
              ? "Undangan ini sedang tidak tersedia untuk tamu. Silakan coba lagi nanti."
              : "Masa aktif undangan ini telah selesai sehingga halaman dan konfirmasi tamu tidak dapat digunakan."}
          </p>
          <Link className="gld-button" href="/">
            Kembali ke Undangania
          </Link>
        </main>
      </div>
    );
  }

  const model = invitationViewModelSchema.parse(snapshot.model);
  const guest = await guestExperienceFor({
    slug,
    token: first(query[GUEST_TOKEN_PARAM]),
  });
  const invitation = renderPublicationSnapshot({
    templateId: snapshot.templateId,
    templateVersion: snapshot.templateVersion,
    contractVersion: snapshot.contractVersion,
    model,
    media: snapshot.media,
  });
  const approvedGuestbook = await loadApprovedGuestbook(
    slug,
    first(query.guestbookCursor),
  );

  return (
    <div
      className={`gld-page${
        snapshot.templateId === "nara-modern"
          ? " gld-page--nara"
          : snapshot.templateId === "kenanga-tradisi"
            ? " gld-page--kenanga"
            : ""
      }`}
    >
      <a className="ui-skip-link" href="#undangan">
        Langsung ke isi undangan
      </a>
      <header className="gld-header">
        <Link className="gld-header__brand" href="/" aria-label="Undangania">
          Undangania
        </Link>
        <span className="gld-header__note">Undangan digital</span>
      </header>
      <main id="undangan" tabIndex={-1}>
        {invitation}
        {approvedGuestbook.kind === "ok" ? (
          <ApprovedGuestbook page={approvedGuestbook.page} slug={slug} />
        ) : null}
        {guest ? (
          <GuestInvitationExperience
            coupleNames={model.couple.displayNames}
            invitationSlug={slug}
            context={guest.context}
            {...(guest.token === undefined ? {} : { guestToken: guest.token })}
          />
        ) : (
          <span id="rsvp" className="ui-visually-hidden" aria-hidden="true" />
        )}
      </main>
      <footer className="gld-page__footer">
        <p>Dibuat dengan tenang oleh Undangania.</p>
      </footer>
    </div>
  );
}

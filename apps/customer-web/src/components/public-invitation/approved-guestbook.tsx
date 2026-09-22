import Link from "next/link";
import type { ApprovedGuestbookPage } from "@wedding/database";

type ApprovedGuestbookProps = Readonly<{
  page: ApprovedGuestbookPage;
  slug: string;
}>;

/**
 * Renders only the public repository's approved rows. The page is a Server
 * Component, so the cursor link causes a new scoped server load rather than
 * exposing a tenant, wedding, or guest token to the browser.
 */
export function ApprovedGuestbook({
  page,
  slug,
}: ApprovedGuestbookProps) {
  if (page.rows.length === 0) return null;

  const nextHref = page.nextCursor
    ? `/invite/${encodeURIComponent(slug)}?guestbookCursor=${encodeURIComponent(page.nextCursor)}`
    : null;

  return (
    <section className="gld-section" aria-labelledby="gld-approved-guestbook-title">
      <p className="gld-kicker">Dari para tamu</p>
      <h2 id="gld-approved-guestbook-title">Ucapan untuk kami</h2>
      <ul className="gld-wishes">
        {page.rows.map((row) => (
          <li className="gld-wish" key={row.id}>
            <p className="gld-wish__text">“{row.message}”</p>
            <p className="gld-wish__name">{row.displayName}</p>
          </li>
        ))}
      </ul>
      {nextHref ? (
        <Link className="gld-link" href={nextHref}>
          Lihat ucapan berikutnya <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </section>
  );
}

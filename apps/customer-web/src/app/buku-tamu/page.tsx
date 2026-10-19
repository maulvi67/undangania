import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationShell, StatePanel } from "@wedding/ui";
import { GuestbookModerationView } from "../../components/oversight/guestbook-moderation-view";
import { loadGuestbookOverview } from "../../lib/oversight/server";
import { guestRequestScope } from "../../lib/guests/request";
import { GUEST_WRITE_ROLES } from "../../lib/guests/outcomes";
import { hasAnyRole } from "@wedding/application";
import "../guests.css";

export const metadata: Metadata = {
  title: "Buku tamu — Undangania",
  description: "Tinjau doa dan ucapan dari tamu undangan Anda.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "Dasbor" },
  { href: "/editor", label: "Editor" },
  { href: "/tamu", label: "Tamu" },
  { href: "/rsvp", label: "RSVP" },
  { href: "/buku-tamu", label: "Buku tamu", current: true },
  { href: "/notifikasi", label: "Notifikasi" },
] as const;

export default async function GuestbookPage() {
  const [result, { request }] = await Promise.all([
    loadGuestbookOverview(),
    guestRequestScope(),
  ]);
  // A viewer reads the queue but cannot decide it; the component hides the controls
  // and the action re-checks the role regardless.
  const canModerate =
    request !== null && hasAnyRole(request.context, GUEST_WRITE_ROLES);

  return (
    <ApplicationShell
      nav={NAV}
      footerNote="Ucapan baru tampil di undangan setelah Anda setujui."
    >
      {result.kind === "ok" ? (
        <GuestbookModerationView data={result.data} canModerate={canModerate} />
      ) : null}
      {result.kind === "unauthenticated" ? (
        <div className="gst-state">
          <StatePanel
            title="Masuk untuk melihat buku tamu"
            description="Masuk ke akun Undangania untuk meninjau ucapan dari tamu Anda."
            action={
              <Link
                className="ui-button ui-button--primary ui-button--md"
                href="/masuk?next=%2Fbuku-tamu"
              >
                Masuk
              </Link>
            }
          />
        </div>
      ) : null}
      {result.kind === "unavailable" ? (
        <div className="gst-state">
          <StatePanel
            title="Buku tamu belum dapat dimuat"
            description="Layanan workspace sedang tidak tersedia. Coba muat ulang halaman ini."
            action={
              <Link
                className="ui-button ui-button--primary ui-button--md"
                href="/buku-tamu"
              >
                Coba lagi
              </Link>
            }
          />
        </div>
      ) : null}
    </ApplicationShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationShell, StatePanel } from "@wedding/ui";
import { RsvpOversightView } from "../../components/oversight/rsvp-oversight-view";
import { loadRsvpOverview } from "../../lib/oversight/server";
import "../guests.css";

export const metadata: Metadata = {
  title: "RSVP — Undangania",
  description: "Jawaban konfirmasi kehadiran dari tamu undangan Anda.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "Dasbor" },
  { href: "/editor", label: "Editor" },
  { href: "/tamu", label: "Tamu" },
  { href: "/rsvp", label: "RSVP", current: true },
  { href: "/buku-tamu", label: "Buku tamu" },
] as const;

export default async function RsvpPage() {
  const result = await loadRsvpOverview();

  return (
    <ApplicationShell
      nav={NAV}
      footerNote="Konfirmasi kehadiran diperbarui saat tamu menyimpan jawabannya."
    >
      {result.kind === "ok" ? <RsvpOversightView data={result.data} /> : null}
      {result.kind === "unauthenticated" ? (
        <div className="gst-state">
          <StatePanel
            title="Masuk untuk melihat konfirmasi"
            description="Masuk ke akun Undangania untuk melihat jawaban kehadiran dari tamu Anda."
            action={
              <Link
                className="ui-button ui-button--primary ui-button--md"
                href="/masuk?next=%2Frsvp"
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
            title="Konfirmasi belum dapat dimuat"
            description="Layanan workspace sedang tidak tersedia. Coba muat ulang halaman ini."
            action={
              <Link
                className="ui-button ui-button--primary ui-button--md"
                href="/rsvp"
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

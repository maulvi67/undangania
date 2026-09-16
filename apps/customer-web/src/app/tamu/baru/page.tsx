import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationShell, StatePanel } from "@wedding/ui";
import { GuestHouseholdForm } from "../../../components/guests/guest-household-form";
import { GuestPermissionDenied } from "../../../components/guests/guest-state-panels";
import { loadGuestFormOptions } from "../../../lib/guests/actions";
import { guestRequestScope } from "../../../lib/guests/request";
import "../../guests.css";

export const metadata: Metadata = {
  title: "Tambah rumah tangga — Wedding System",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "Dasbor" },
  { href: "/editor", label: "Editor" },
  { href: "/tamu", label: "Tamu", current: true },
  { href: "/rsvp", label: "RSVP" },
  { href: "/buku-tamu", label: "Buku tamu" },
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ApplicationShell
      nav={NAV}
      footerNote="Kelola tamu dengan tenang, dari satu workspace."
    >
      {children}
    </ApplicationShell>
  );
}

export default async function NewGuestHouseholdPage() {
  const { request } = await guestRequestScope();
  if (request === null) {
    return (
      <Shell>
        <div className="gst-state">
          <StatePanel
            title="Masuk untuk menambah tamu"
            description="Masuk ke akun Wedding System untuk mengelola rumah tangga di workspace Anda."
            action={
              <a
                className="ui-button ui-button--primary ui-button--md"
                href="/masuk?next=%2Ftamu%2Fbaru"
              >
                Masuk
              </a>
            }
          />
        </div>
      </Shell>
    );
  }

  const options = await loadGuestFormOptions();
  if (options.kind === "forbidden") {
    return (
      <Shell>
        <GuestPermissionDenied />
      </Shell>
    );
  }
  if (options.kind === "unavailable") {
    return (
      <Shell>
        <div className="gst-state">
          <StatePanel
            title="Formulir tamu belum dapat dimuat"
            description="Layanan workspace sedang tidak tersedia. Coba muat ulang halaman ini."
            action={
              <Link
                className="ui-button ui-button--primary ui-button--md"
                href="/tamu"
              >
                Kembali ke daftar tamu
              </Link>
            }
          />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="gst-page gst-page--detail">
        <Link className="gst-backlink" href="/tamu">
          ← Kembali ke daftar tamu
        </Link>
        <header className="gst-page__header">
          <div>
            <p className="gst-eyebrow">Tambah tamu</p>
            <h1>Rumah tangga baru</h1>
            <p className="gst-page__lead">
              Buat satu rumah tangga dan tambahkan anggotanya. Tautan personal
              dibuat otomatis dan dapat Anda bagikan dari halaman detail.
            </p>
          </div>
        </header>
        <GuestHouseholdForm events={options.events} tags={[]} />
      </div>
    </Shell>
  );
}

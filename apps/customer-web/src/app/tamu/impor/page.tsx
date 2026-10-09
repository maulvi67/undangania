import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationShell, StatePanel } from "@wedding/ui";
import { GuestImportWizard } from "../../../components/guests/guest-import-wizard";
import { GuestPermissionDenied } from "../../../components/guests/guest-state-panels";
import { loadGuestFormOptions } from "../../../lib/guests/actions";
import { guestRequestScope } from "../../../lib/guests/request";
import "../../guests.css";

export const metadata: Metadata = {
  title: "Impor tamu — Undangania",
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
      footerNote="Impor tamu hanya setelah Anda meninjau hasilnya."
    >
      {children}
    </ApplicationShell>
  );
}

export default async function GuestImportPage() {
  const { request } = await guestRequestScope();
  if (request === null) {
    return (
      <Shell>
        <div className="gst-state">
          <StatePanel
            title="Masuk untuk mengimpor tamu"
            description="Masuk ke akun Undangania untuk mengelola daftar tamu di workspace Anda."
            action={
              <a
                className="ui-button ui-button--primary ui-button--md"
                href="/masuk?next=%2Ftamu%2Fimpor"
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
            title="Impor tamu belum dapat dimuat"
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
      <GuestImportWizard
        events={options.events}
        existingHouseholds={options.households}
      />
    </Shell>
  );
}

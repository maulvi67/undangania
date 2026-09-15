import type { Metadata } from "next";
import { ApplicationShell, StatePanel } from "@wedding/ui";
import { GuestImportWizard } from "../../../components/guests/guest-import-wizard";
import { GuestPermissionDenied } from "../../../components/guests/guest-state-panels";
import { parseGuestFixture } from "../../../lib/guests/contract";
import { getGuestManagementData } from "../../../lib/guests/fixtures";
import { getAuthenticatedRequest } from "../../../lib/auth/server";
import "../../guests.css";

export const metadata: Metadata = {
  title: "Impor tamu — Wedding System",
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

type Props = { searchParams: Promise<{ fixture?: string | string[] }> };

export default async function GuestImportPage({ searchParams }: Props) {
  if (process.env.NODE_ENV === "production") {
    const authenticated = await getAuthenticatedRequest();
    return (
      <ApplicationShell
        nav={NAV}
        footerNote="Impor tamu hanya setelah Anda meninjau hasilnya."
      >
        <div className="gst-state">
          <StatePanel
            title={
              authenticated === null
                ? "Masuk untuk mengimpor tamu"
                : "Impor tamu belum tersedia"
            }
            description={
              authenticated === null
                ? "Masuk ke akun Wedding System untuk mengelola daftar tamu di workspace Anda."
                : "Impor tamu belum dapat diproses dari layanan workspace."
            }
            action={
              <a
                className="ui-button ui-button--primary ui-button--md"
                href={
                  authenticated === null
                    ? "/masuk?next=%2Ftamu%2Fimpor"
                    : "/tamu"
                }
              >
                {authenticated === null ? "Masuk" : "Kembali ke daftar tamu"}
              </a>
            }
          />
        </div>
      </ApplicationShell>
    );
  }

  const params = await searchParams;
  const fixture = parseGuestFixture(params.fixture);
  const data = getGuestManagementData(fixture);
  return (
    <ApplicationShell
      nav={NAV}
      footerNote="Impor tamu hanya setelah Anda meninjau hasilnya."
    >
      {!data.capabilities.canImport ? (
        <GuestPermissionDenied />
      ) : (
        <GuestImportWizard management={data} fixture={fixture} />
      )}
    </ApplicationShell>
  );
}

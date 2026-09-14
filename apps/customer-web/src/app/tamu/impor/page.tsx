import type { Metadata } from "next";
import { ApplicationShell } from "@wedding/ui";
import { GuestImportWizard } from "../../../components/guests/guest-import-wizard";
import { GuestPermissionDenied } from "../../../components/guests/guest-state-panels";
import { parseGuestFixture } from "../../../lib/guests/contract";
import { getGuestManagementData } from "../../../lib/guests/fixtures";
import "../../guests.css";

export const metadata: Metadata = { title: "Impor tamu — Wedding System", robots: { index: false, follow: false } };
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
  const params = await searchParams;
  const fixture = parseGuestFixture(params.fixture);
  const data = getGuestManagementData(fixture);
  return (
    <ApplicationShell nav={NAV} footerNote="Impor tamu hanya setelah Anda meninjau hasilnya.">
      {!data.capabilities.canImport ? <GuestPermissionDenied /> : <GuestImportWizard management={data} fixture={fixture} />}
    </ApplicationShell>
  );
}

import type { Metadata } from "next";
import { ApplicationShell } from "@wedding/ui";
import { GuestHouseholdForm } from "../../../components/guests/guest-household-form";
import { GuestPermissionDenied } from "../../../components/guests/guest-state-panels";
import { parseGuestFixture } from "../../../lib/guests/contract";
import { getGuestManagementData } from "../../../lib/guests/fixtures";
import "../../guests.css";

export const metadata: Metadata = { title: "Tambah rumah tangga — Wedding System", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "Dasbor" },
  { href: "/editor", label: "Editor" },
  { href: "/tamu", label: "Tamu", current: true },
  { href: "/rsvp", label: "RSVP" },
  { href: "/buku-tamu", label: "Buku tamu" },
] as const;

type Props = { searchParams: Promise<{ fixture?: string | string[] }> };

export default async function NewGuestHouseholdPage({ searchParams }: Props) {
  const params = await searchParams;
  const fixture = parseGuestFixture(params.fixture);
  const data = getGuestManagementData(fixture);
  return (
    <ApplicationShell nav={NAV} footerNote="Kelola tamu dengan tenang, dari satu workspace.">
      {!data.capabilities.canWrite ? <GuestPermissionDenied /> : (
        <div className="gst-page gst-page--detail">
          <a className="gst-backlink" href={`/tamu${fixture === "normal" ? "" : `?fixture=${fixture}`}`}>← Kembali ke daftar tamu</a>
          <header className="gst-page__header">
            <div>
              <p className="gst-eyebrow">Tambah tamu</p>
              <h1>Rumah tangga baru</h1>
              <p className="gst-page__lead">Buat satu rumah tangga, tambahkan anggota, lalu tentukan acara yang dapat mereka akses.</p>
            </div>
          </header>
          <GuestHouseholdForm events={data.events} tags={data.tags} />
        </div>
      )}
    </ApplicationShell>
  );
}

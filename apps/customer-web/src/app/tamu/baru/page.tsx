import type { Metadata } from "next";
import { ApplicationShell, StatePanel } from "@wedding/ui";
import { GuestHouseholdForm } from "../../../components/guests/guest-household-form";
import { GuestPermissionDenied } from "../../../components/guests/guest-state-panels";
import { parseGuestFixture } from "../../../lib/guests/contract";
import { getGuestManagementData } from "../../../lib/guests/fixtures";
import { getAuthenticatedRequest } from "../../../lib/auth/server";
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

type Props = { searchParams: Promise<{ fixture?: string | string[] }> };

export default async function NewGuestHouseholdPage({ searchParams }: Props) {
  if (process.env.NODE_ENV === "production") {
    const authenticated = await getAuthenticatedRequest();
    return (
      <ApplicationShell
        nav={NAV}
        footerNote="Kelola tamu dengan tenang, dari satu workspace."
      >
        <div className="gst-state">
          <StatePanel
            title={
              authenticated === null
                ? "Masuk untuk menambah tamu"
                : "Penambahan tamu belum tersedia"
            }
            description={
              authenticated === null
                ? "Masuk ke akun Wedding System untuk mengelola rumah tangga di workspace Anda."
                : "Data tamu belum dapat disimpan dari layanan workspace."
            }
            action={
              <a
                className="ui-button ui-button--primary ui-button--md"
                href={
                  authenticated === null
                    ? "/masuk?next=%2Ftamu%2Fbaru"
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
      footerNote="Kelola tamu dengan tenang, dari satu workspace."
    >
      {!data.capabilities.canWrite ? (
        <GuestPermissionDenied />
      ) : (
        <div className="gst-page gst-page--detail">
          <a
            className="gst-backlink"
            href={`/tamu${fixture === "normal" ? "" : `?fixture=${fixture}`}`}
          >
            ← Kembali ke daftar tamu
          </a>
          <header className="gst-page__header">
            <div>
              <p className="gst-eyebrow">Tambah tamu</p>
              <h1>Rumah tangga baru</h1>
              <p className="gst-page__lead">
                Buat satu rumah tangga, tambahkan anggota, lalu tentukan acara
                yang dapat mereka akses.
              </p>
            </div>
          </header>
          <GuestHouseholdForm events={data.events} tags={data.tags} />
        </div>
      )}
    </ApplicationShell>
  );
}

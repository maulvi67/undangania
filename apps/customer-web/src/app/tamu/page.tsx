import type { Metadata } from "next";
import { ApplicationShell, StatePanel } from "@wedding/ui";
import { GuestManagementView } from "../../components/guests/guest-management-view";
import { GuestPermissionDenied, GuestUnavailable } from "../../components/guests/guest-state-panels";
import { parseGuestQuery } from "../../lib/guests/contract";
import { loadGuests } from "../../lib/guests/stub-transport";
import "../guests.css";

export const metadata: Metadata = {
  title: "Tamu — Wedding System",
  description: "Kelola rumah tangga, akses acara, dan tautan personal undangan.",
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

type GuestPageProps = {
  searchParams: Promise<{
    fixture?: string | string[];
    q?: string | string[];
    tag?: string | string[];
    event?: string | string[];
    link?: string | string[];
    sort?: string | string[];
  }>;
};

function Shell({ children }: { children: React.ReactNode }) {
  return <ApplicationShell nav={NAV} footerNote="Kelola tamu dengan tenang, dari satu workspace." >{children}</ApplicationShell>;
}

export default async function GuestPage({ searchParams }: GuestPageProps) {
  const params = await searchParams;
  const query = parseGuestQuery(params);
  const result = await loadGuests(query.fixture, query);
  if (result.kind === "unauthenticated") {
    return (
      <Shell>
        <div className="gst-state">
          <StatePanel
            title="Masuk untuk melihat tamu"
            description="Masuk ke akun Wedding System untuk mengelola rumah tangga dan tautan personal."
            action={<a className="ui-button ui-button--primary ui-button--md" href="/masuk?next=%2Ftamu">Masuk</a>}
          />
        </div>
      </Shell>
    );
  }
  if (result.kind === "forbidden") return <Shell><GuestPermissionDenied /></Shell>;
  if (result.kind === "unavailable") return <Shell><GuestUnavailable /></Shell>;
  return <Shell><GuestManagementView data={result.data} query={query} /></Shell>;
}

export function GuestRoutePlaceholder() {
  return <StatePanel title="Daftar tamu" description="Memuat data rumah tangga…" />;
}

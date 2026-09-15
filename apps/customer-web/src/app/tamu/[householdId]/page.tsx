import type { Metadata } from "next";
import { ApplicationShell, StatePanel } from "@wedding/ui";
import {
  GuestHouseholdDetailView,
  GuestNotFound,
} from "../../../components/guests/guest-household-detail";
import {
  GuestPermissionDenied,
  GuestUnavailable,
} from "../../../components/guests/guest-state-panels";
import { parseGuestFixture } from "../../../lib/guests/contract";
import { loadGuestHousehold } from "../../../lib/guests/stub-transport";
import { getAuthenticatedRequest } from "../../../lib/auth/server";
import "../../guests.css";

export const metadata: Metadata = {
  title: "Rumah tangga — Wedding System",
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

type Props = {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ fixture?: string | string[] }>;
};

export default async function GuestHouseholdPage({
  params,
  searchParams,
}: Props) {
  if (process.env.NODE_ENV === "production") {
    const authenticated = await getAuthenticatedRequest();
    return (
      <ApplicationShell
        nav={NAV}
        footerNote="Kelola tautan personal dengan aman."
      >
        <div className="gst-state">
          <StatePanel
            title={
              authenticated === null
                ? "Masuk untuk melihat rumah tangga"
                : "Rumah tangga belum tersedia"
            }
            description={
              authenticated === null
                ? "Masuk ke akun Wedding System untuk mengelola rumah tangga dan tautan personal."
                : "Data rumah tangga belum dapat dimuat dari layanan workspace."
            }
            action={
              <a
                className="ui-button ui-button--primary ui-button--md"
                href={authenticated === null ? "/masuk?next=%2Ftamu" : "/tamu"}
              >
                {authenticated === null ? "Masuk" : "Kembali ke daftar tamu"}
              </a>
            }
          />
        </div>
      </ApplicationShell>
    );
  }

  const { householdId } = await params;
  const query = await searchParams;
  const fixture = parseGuestFixture(query.fixture);
  const result = await loadGuestHousehold(householdId, fixture);
  return (
    <ApplicationShell
      nav={NAV}
      footerNote="Kelola tautan personal dengan aman."
    >
      {result.kind === "forbidden" ? <GuestPermissionDenied /> : null}
      {result.kind === "unavailable" ? <GuestUnavailable /> : null}
      {result.kind === "not-found" ? <GuestNotFound /> : null}
      {result.kind === "ok" ? (
        <GuestHouseholdDetailView
          household={result.data.household}
          management={result.data.management}
          fixture={fixture}
        />
      ) : null}
    </ApplicationShell>
  );
}

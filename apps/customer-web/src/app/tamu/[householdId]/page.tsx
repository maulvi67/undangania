import type { Metadata } from "next";
import { ApplicationShell } from "@wedding/ui";
import { GuestHouseholdDetailView, GuestNotFound } from "../../../components/guests/guest-household-detail";
import { GuestPermissionDenied, GuestUnavailable } from "../../../components/guests/guest-state-panels";
import { parseGuestFixture } from "../../../lib/guests/contract";
import { loadGuestHousehold } from "../../../lib/guests/stub-transport";
import "../../guests.css";

export const metadata: Metadata = { title: "Rumah tangga — Wedding System", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "Dasbor" },
  { href: "/editor", label: "Editor" },
  { href: "/tamu", label: "Tamu", current: true },
  { href: "/rsvp", label: "RSVP" },
  { href: "/buku-tamu", label: "Buku tamu" },
] as const;

type Props = { params: Promise<{ householdId: string }>; searchParams: Promise<{ fixture?: string | string[] }> };

export default async function GuestHouseholdPage({ params, searchParams }: Props) {
  const { householdId } = await params;
  const query = await searchParams;
  const fixture = parseGuestFixture(query.fixture);
  const result = await loadGuestHousehold(householdId, fixture);
  return (
    <ApplicationShell nav={NAV} footerNote="Kelola tautan personal dengan aman.">
      {result.kind === "forbidden" ? <GuestPermissionDenied /> : null}
      {result.kind === "unavailable" ? <GuestUnavailable /> : null}
      {result.kind === "not-found" ? <GuestNotFound /> : null}
      {result.kind === "ok" ? <GuestHouseholdDetailView household={result.data.household} management={result.data.management} fixture={fixture} /> : null}
    </ApplicationShell>
  );
}

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
import { loadGuestHouseholdDetail } from "../../../lib/guests/server";
import { guestRequestScope } from "../../../lib/guests/request";
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

type Props = { params: Promise<{ householdId: string }> };

export default async function GuestHouseholdPage({ params }: Props) {
  const { householdId } = await params;
  const { request } = await guestRequestScope();
  const result = await loadGuestHouseholdDetail(
    { context: request?.context ?? null },
    householdId,
  );

  return (
    <ApplicationShell
      nav={NAV}
      footerNote="Kelola tautan personal dengan aman."
    >
      {result.kind === "unauthenticated" ? (
        <div className="gst-state">
          <StatePanel
            title="Masuk untuk melihat rumah tangga"
            description="Masuk ke akun Wedding System untuk mengelola rumah tangga dan tautan personal."
            action={
              <a
                className="ui-button ui-button--primary ui-button--md"
                href="/masuk?next=%2Ftamu"
              >
                Masuk
              </a>
            }
          />
        </div>
      ) : null}
      {result.kind === "forbidden" ? <GuestPermissionDenied /> : null}
      {result.kind === "unavailable" ? <GuestUnavailable /> : null}
      {result.kind === "not-found" ? <GuestNotFound /> : null}
      {result.kind === "ok" ? (
        <GuestHouseholdDetailView
          household={result.data.household}
          management={result.data.management}
          invitationSlug={result.data.invitationSlug}
        />
      ) : null}
    </ApplicationShell>
  );
}

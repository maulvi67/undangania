import type { Metadata } from "next";
import { ApplicationShell, StatePanel } from "@wedding/ui";
import { GuestManagementView } from "../../components/guests/guest-management-view";
import {
  GuestPermissionDenied,
  GuestUnavailable,
} from "../../components/guests/guest-state-panels";
import {
  filterGuestHouseholds,
  guestListItemSchema,
  parseGuestQuery,
} from "../../lib/guests/contract";
import { loadGuestManagement } from "../../lib/guests/server";
import { guestRequestScope } from "../../lib/guests/request";
import "../guests.css";

export const metadata: Metadata = {
  title: "Tamu — Undangania",
  description:
    "Kelola rumah tangga, akses acara, dan tautan personal undangan.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/dashboard", label: "Dasbor" },
  { href: "/editor", label: "Editor" },
  { href: "/tamu", label: "Tamu", current: true },
  { href: "/rsvp", label: "RSVP" },
  { href: "/buku-tamu", label: "Buku tamu" },
  { href: "/notifikasi", label: "Notifikasi" },
] as const;

type GuestPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    tag?: string | string[];
    event?: string | string[];
    link?: string | string[];
    sort?: string | string[];
  }>;
};

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

function SignInPrompt() {
  return (
    <div className="gst-state">
      <StatePanel
        title="Masuk untuk melihat tamu"
        description="Masuk ke akun Undangania untuk mengelola rumah tangga dan tautan personal."
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
  );
}

export default async function GuestPage({ searchParams }: GuestPageProps) {
  const { request } = await guestRequestScope();
  const result = await loadGuestManagement({
    context: request?.context ?? null,
  });

  if (result.kind === "unauthenticated") {
    return (
      <Shell>
        <SignInPrompt />
      </Shell>
    );
  }
  if (result.kind === "forbidden") {
    return (
      <Shell>
        <GuestPermissionDenied />
      </Shell>
    );
  }
  if (result.kind === "unavailable") {
    return (
      <Shell>
        <GuestUnavailable />
      </Shell>
    );
  }

  // Filtering is applied to the loaded rows rather than pushed into the query, so
  // the same predicate the UI displays is the one that decided the result.
  const params = await searchParams;
  const query = parseGuestQuery(params);
  const households = filterGuestHouseholds(result.data.households, query).map(
    (household) => guestListItemSchema.parse(household),
  );

  return (
    <Shell>
      <GuestManagementView
        data={{ ...result.data, households }}
        query={query}
      />
    </Shell>
  );
}

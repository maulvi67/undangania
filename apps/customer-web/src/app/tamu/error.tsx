"use client";

import { useEffect } from "react";
import { ApplicationShell, ErrorState } from "@wedding/ui";
import "../guests.css";

const NAV = [
  { href: "/dashboard", label: "Dasbor" },
  { href: "/editor", label: "Editor" },
  { href: "/tamu", label: "Tamu", current: true },
  { href: "/rsvp", label: "RSVP" },
  { href: "/buku-tamu", label: "Buku tamu" },
] as const;

export default function GuestError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The error boundary intentionally does not log guest names, contacts, or links.
  }, []);
  return (
    <ApplicationShell nav={NAV} footerNote="Daftar tamu tidak dapat dimuat.">
      <div className="gst-state">
        <ErrorState
          title="Daftar tamu tidak dapat dimuat"
          description="Coba muat ulang halaman ini. Data kontak dan tautan personal tidak dicatat di pesan kesalahan."
          action={
            <button
              type="button"
              className="ui-button ui-button--primary ui-button--md"
              onClick={reset}
            >
              Coba lagi
            </button>
          }
        />
      </div>
    </ApplicationShell>
  );
}

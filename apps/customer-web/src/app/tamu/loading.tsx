import { ApplicationShell, Skeleton } from "@wedding/ui";
import "../guests.css";

const NAV = [
  { href: "/dashboard", label: "Dasbor" },
  { href: "/editor", label: "Editor" },
  { href: "/tamu", label: "Tamu", current: true },
  { href: "/rsvp", label: "RSVP" },
  { href: "/buku-tamu", label: "Buku tamu" },
] as const;

export default function GuestLoading() {
  return (
    <ApplicationShell nav={NAV} footerNote="Memuat daftar tamu…">
      <div className="gst-loading" role="status" aria-live="polite">
        <span className="ui-visually-hidden">Memuat daftar tamu…</span>
        <Skeleton height="0.75rem" width="9rem" />
        <Skeleton height="2.75rem" width="12rem" />
        <Skeleton height="1rem" width="24rem" />
        <div className="gst-loading__summary">
          <Skeleton height="5rem" />
          <Skeleton height="5rem" />
          <Skeleton height="5rem" />
        </div>
        <Skeleton height="5rem" />
        <div className="gst-loading__cards">
          <Skeleton height="12rem" />
          <Skeleton height="12rem" />
          <Skeleton height="12rem" />
        </div>
      </div>
    </ApplicationShell>
  );
}

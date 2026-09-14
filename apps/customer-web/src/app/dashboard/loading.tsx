import { ApplicationShell, Skeleton } from "@wedding/ui";
import "../dashboard.css";

const NAV = [
  { href: "/dashboard", label: "Dasbor", current: true },
  { href: "/editor", label: "Editor" },
  { href: "/tamu", label: "Tamu" },
  { href: "/rsvp", label: "RSVP" },
  { href: "/buku-tamu", label: "Buku tamu" },
  { href: "/pesanan", label: "Pesanan" },
] as const;

export default function DashboardLoading() {
  return (
    <ApplicationShell nav={NAV} footerNote="Memuat workspace pernikahan…">
      <div className="dash-loading" role="status" aria-live="polite">
        <span className="ui-visually-hidden">Memuat dasbor…</span>
        <Skeleton
          className="dash-loading__eyebrow"
          height="0.75rem"
          width="9rem"
        />
        <Skeleton
          className="dash-loading__title"
          height="2.75rem"
          width="12rem"
        />
        <Skeleton className="dash-loading__lead" height="1rem" width="18rem" />
        <div className="dash-loading__band">
          <Skeleton height="1rem" width="12rem" />
          <Skeleton height="2rem" width="9rem" />
        </div>
        <div className="dash-loading__next">
          <Skeleton height="1.5rem" width="14rem" />
          <Skeleton height="1rem" width="28rem" />
          <Skeleton height="2.75rem" width="11rem" />
        </div>
        <div className="dash-loading__grid">
          <Skeleton height="14rem" />
          <Skeleton height="14rem" />
          <Skeleton height="12rem" />
          <Skeleton height="12rem" />
        </div>
      </div>
    </ApplicationShell>
  );
}

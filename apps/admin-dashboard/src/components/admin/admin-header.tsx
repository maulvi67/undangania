import Link from "next/link";
import { IconLock, IconShield } from "@wedding/ui";
import type { AdminDashboard } from "../../lib/admin/contract";
import { formatAdminTimestamp } from "../../lib/admin/formatters";

export function AdminHeader({
  session,
  freshness,
}: {
  session: AdminDashboard["session"];
  freshness: AdminDashboard["freshness"];
}) {
  return (
    <header className="admin-topbar">
      <div className="admin-topbar__brand-block">
        <Link
          className="admin-brand"
          href="/"
          aria-label="Wedding System, ringkasan operasi"
        >
          <span className="admin-brand__mark" aria-hidden="true">
            W
          </span>
          <span>
            <strong>Wedding System</strong>
            <small>Operations</small>
          </span>
        </Link>
        <span
          className="admin-environment"
          title="Tampilan ini menggunakan data simulasi lokal"
        >
          {session.environmentLabel}
        </span>
      </div>

      <div className="admin-security-summary" aria-label="Status akses admin">
        <span className="admin-security-item">
          <IconShield aria-hidden="true" />
          <span>
            <strong>{session.roleLabel}</strong>
            <small>{session.scope}</small>
          </span>
        </span>
        <span className="admin-security-item">
          <IconLock aria-hidden="true" />
          <span>
            <strong>
              {session.mfaActive ? "MFA aktif" : "MFA belum aktif"}
            </strong>
            <small>Perlindungan admin</small>
          </span>
        </span>
        <span
          className="admin-freshness"
          data-stale={freshness.status === "stale"}
        >
          <strong>
            {freshness.status === "stale"
              ? "Data perlu diperbarui"
              : "Data terbaru"}
          </strong>
          <small>{formatAdminTimestamp(session.lastRefreshed)} WIB</small>
        </span>
        <Link className="admin-refresh-link" href="/?state=attention">
          Perbarui
        </Link>
      </div>
    </header>
  );
}

import Link from "next/link";
import { IconLock, IconShield } from "@wedding/ui";
import { Badge } from "../ui/badge";
import { AdminRefreshControl } from "./admin-refresh-control";
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
      <div className="admin-topbar__inner">
        <Link
          className="admin-brand"
          href="/"
          aria-label="Wedding System, ringkasan operasi"
        >
          <span className="admin-brand__mark" aria-hidden="true">
            W
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-sm leading-tight sm:text-base">Wedding System</strong>
            <small className="block truncate text-xs text-[var(--color-ink-soft)]">Admin operations</small>
          </span>
        </Link>

        <div className="admin-topbar__status" aria-label="Status akses admin">
          <div className="admin-topbar__access hidden xl:flex">
            <IconShield className="size-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>{session.roleLabel}</strong>
              <small>{session.scope}</small>
            </span>
          </div>
          <div className="admin-topbar__access hidden md:flex">
            <IconLock className="size-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>{session.mfaActive ? "MFA aktif" : "MFA fixture"}</strong>
              <small>Perlindungan admin</small>
            </span>
          </div>
          <Badge className={freshness.status === "stale" ? "admin-badge--warning" : "admin-badge--success"}>
            {freshness.status === "stale" ? "Perlu diperbarui" : "Data terbaru"}
          </Badge>
          <span className="hidden text-xs text-[var(--color-ink-soft)] lg:block">
            {formatAdminTimestamp(session.lastRefreshed)} WIB
          </span>
          <AdminRefreshControl />
        </div>
      </div>
    </header>
  );
}

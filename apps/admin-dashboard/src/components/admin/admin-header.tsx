import Link from "next/link";
import { Badge } from "../ui/badge";
import type { AdminDashboard } from "../../lib/admin/contract";
import { formatAdminTimestamp } from "../../lib/admin/formatters";
import { AdminRefreshControl } from "./admin-refresh-control";
import { AdminToolbar, type AdminToolbarNotification } from "./admin-toolbar";

const SECTION_ANCHORS = new Map<string, string>([
  ["payments", "pembayaran"],
  ["publication-failures", "publikasi"],
  ["failed-jobs", "pekerjaan-gagal"],
  ["printing", "pesanan-cetak"],
  ["support", "dukungan"],
  ["templates", "template"],
  ["lifecycle", "pengecualian"],
  ["audit", "audit"],
]);

export function AdminHeader({ data }: { data: AdminDashboard }) {
  const notifications: readonly AdminToolbarNotification[] | null =
    data.attention.status === "ok"
      ? data.attention.rows.map((row) => ({
          id: row.id,
          issue: row.issue,
          reference: row.reference,
          severity: row.severity,
          updatedAt: row.updatedAt,
          href: `#${SECTION_ANCHORS.get(row.targetSection) ?? "ringkasan"}`,
        }))
      : null;
  const toolbarSession = {
    roleLabel: data.session.roleLabel,
    scope: data.session.scope,
    mfaActive: data.session.mfaActive,
    environmentLabel: data.session.environmentLabel,
  };

  return (
    <header className="admin-topbar">
      <div className="admin-topbar__inner">
        <Link
          className="admin-brand"
          href="/"
          aria-label="Undangania, ringkasan operasi"
        >
          <span className="admin-brand__mark" aria-hidden="true">
            U
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-sm leading-tight sm:text-base">
              Undangania
            </strong>
            <small className="block truncate text-xs text-[var(--color-ink-soft)]">
              Admin operations
            </small>
          </span>
        </Link>

        <div className="admin-topbar__status" aria-label="Status akses admin">
          <Badge
            className={`hidden sm:inline-flex ${data.freshness.status === "stale" ? "admin-badge--warning" : "admin-badge--success"}`}
          >
            {data.freshness.status === "stale"
              ? "Perlu diperbarui"
              : "Data terbaru"}
          </Badge>
          <span className="hidden text-xs text-[var(--color-ink-soft)] xl:block">
            {formatAdminTimestamp(data.session.lastRefreshed)} WIB
          </span>
          <AdminRefreshControl />
          <AdminToolbar
            session={toolbarSession}
            notifications={notifications}
          />
        </div>
      </div>
    </header>
  );
}

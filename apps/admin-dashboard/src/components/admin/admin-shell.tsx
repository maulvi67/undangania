import type { ReactNode } from "react";
import type { AdminDashboard } from "../../lib/admin/contract";
import { AdminHeader } from "./admin-header";
import { AdminSidebar } from "./admin-sidebar";

export function AdminShell({
  children,
  session,
  freshness,
}: {
  children: ReactNode;
  session: AdminDashboard["session"];
  freshness: AdminDashboard["freshness"];
}) {
  return (
    <div className="admin-shell">
      <a className="admin-skip-link" href="#konten-utama">
        Langsung ke konten utama
      </a>
      <AdminHeader session={session} freshness={freshness} />
      <div className="admin-mobile-shell-nav">
        <AdminSidebar />
      </div>
      <div className="admin-layout">
        <aside className="admin-sidebar-column">
          <AdminSidebar />
        </aside>
        <main className="admin-main" id="konten-utama">
          {children}
        </main>
      </div>
      <footer className="admin-footer">
        <div>
          <strong>Wedding System Operations</strong>
          <span>
            Ringkasan read-only · tindakan sensitif memerlukan otorisasi server.
          </span>
        </div>
      </footer>
    </div>
  );
}

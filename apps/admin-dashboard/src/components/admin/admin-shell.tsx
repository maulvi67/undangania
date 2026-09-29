import type { ReactNode } from "react";
import type { AdminDashboard } from "../../lib/admin/contract";
import { AdminHeader } from "./admin-header";
import { AdminSidebar } from "./admin-sidebar";

export function AdminShell({
  children,
  dashboard,
}: {
  children: ReactNode;
  dashboard: AdminDashboard;
}) {
  return (
    <div className="admin-shell">
      <a className="admin-skip-link" href="#konten-utama">
        Langsung ke konten utama
      </a>
      <AdminHeader data={dashboard} />
      <div className="lg:hidden">
        <AdminSidebar mobile />
      </div>
      <div className="admin-layout">
        <aside className="admin-sidebar-panel hidden lg:block">
          <AdminSidebar />
        </aside>
        <main className="admin-main" id="konten-utama">
          {children}
        </main>
      </div>
      <footer className="admin-footer">
        <div className="mx-auto flex w-full max-w-[96rem] flex-wrap items-center justify-between gap-x-5 gap-y-2">
          <strong>Undangania Operations</strong>
          <span>
            Data masked · tindakan sensitif memerlukan otorisasi server dan
            audit.
          </span>
        </div>
      </footer>
    </div>
  );
}

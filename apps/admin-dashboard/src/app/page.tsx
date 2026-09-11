import type { Metadata } from "next";
import { AdminDashboardView } from "../components/admin/admin-dashboard";
import { parseAdminFixture } from "../lib/admin/contract";
import { loadAdminDashboard } from "../lib/admin/fixture-transport";

export const metadata: Metadata = {
  title: "Ringkasan operasi — Wedding System",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{ state?: string | string[] }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const fixture = parseAdminFixture(params.state);
  const result = await loadAdminDashboard(fixture);

  return <AdminDashboardView result={result} />;
}

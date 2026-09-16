import type { Metadata } from "next";
import { DashboardView } from "../../components/dashboard/dashboard-view";
import { loadDashboardForSession } from "../../lib/dashboard/server";
import "../dashboard.css";

export const metadata: Metadata = {
  title: "Dasbor — Wedding System",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  return <DashboardView result={await loadDashboardForSession()} />;
}

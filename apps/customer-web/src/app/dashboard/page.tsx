import type { Metadata } from "next";
import { DashboardView } from "../../components/dashboard/dashboard-view";
import {
  loadDashboard,
  parseDashboardFixture,
} from "../../lib/dashboard/stub-transport";
import { getAuthenticatedRequest } from "../../lib/auth/server";
import "../dashboard.css";

export const metadata: Metadata = {
  title: "Dasbor — Wedding System",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{ state?: string | string[] }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  if (process.env.NODE_ENV === "production") {
    const authenticated = await getAuthenticatedRequest();
    return authenticated === null ? (
      <DashboardView result={{ kind: "unauthenticated" }} />
    ) : (
      <DashboardView result={{ kind: "unavailable" }} />
    );
  }

  const params = await searchParams;
  const fixture = parseDashboardFixture(params.state);
  const result = await loadDashboard(fixture);

  return <DashboardView result={result} />;
}

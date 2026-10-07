import type { Metadata } from "next";
import { DashboardPage } from "../../components/prototype/pages/dashboard";

export const metadata: Metadata = {
  title: "Dashboard — Prototype Undangania",
};

export default function PrototypeDashboardRoute() {
  return <DashboardPage />;
}

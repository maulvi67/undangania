import type { Metadata } from "next";
import { DashboardApp } from "../../components/dashboard/dashboard-app";
import type { DashboardAppProps } from "../../components/dashboard/dashboard-app";
import { getActiveTemplates } from "../../components/templates/template-data";
import { loadOrderList } from "../../lib/checkout/orders";
import { loadDashboardForSession } from "../../lib/dashboard/server";
import {
  buildDashboardViewModel,
  buildGuestbookPanel,
  buildOrdersPanel,
  buildTemplateCards,
} from "../../lib/dashboard/view-model";
import { loadGuestbookOverview } from "../../lib/oversight/server";
import "../dashboard-app.css";

export const metadata: Metadata = {
  title: "Dasbor — Undangania",
  description:
    "Kelola undangan pernikahan digital Anda: status undangan, RSVP, buku tamu, dan pesanan.",
  robots: { index: false },
};

/**
 * The dashboard reads the session's own workspace. Every loader below resolves
 * tenant and wedding from the session, so the page can never be pointed at
 * another couple's data; a signed-out visitor gets the sign-in state instead.
 */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [dashboard, guestbook, orders] = await Promise.all([
    loadDashboardForSession(),
    loadGuestbookOverview(),
    loadOrderList(),
  ]);

  const dashboardState: DashboardAppProps["dashboard"] =
    dashboard.kind === "ok"
      ? { kind: "ready", view: buildDashboardViewModel(dashboard.data) }
      : dashboard.kind === "unauthenticated"
        ? { kind: "unauthenticated" }
        : { kind: "unavailable" };

  return (
    <DashboardApp
      dashboard={dashboardState}
      guestbook={buildGuestbookPanel(guestbook)}
      orders={buildOrdersPanel(orders)}
      templates={buildTemplateCards(getActiveTemplates())}
    />
  );
}

import Link from "next/link";
import {
  Alert,
  ApplicationShell,
  ErrorState,
  StatePanel,
  type NavItem,
} from "@wedding/ui";
import { signInHref } from "../../lib/auth/redirect";
import {
  DASHBOARD_ROUTES,
  completionItems,
  derivedStatus,
  expiryWarningText,
  nextActions,
  type DashboardAggregate,
  type DashboardLoad,
} from "../../lib/dashboard/contract";
import { todayYmd } from "../../lib/onboarding/contract";
import { CompletionProgress } from "./completion-progress";
import { CountdownBand } from "./countdown-band";
import { GuestSummary } from "./guest-summary";
import { InvitationStatus } from "./invitation-status";
import { NextActions } from "./next-actions";
import { RsvpSummary } from "./rsvp-summary";

function navigation(role?: DashboardAggregate["role"]): ReadonlyArray<NavItem> {
  const items: NavItem[] = [
    { href: DASHBOARD_ROUTES.dashboard, label: "Dasbor", current: true },
    { href: DASHBOARD_ROUTES.editor, label: "Editor" },
    { href: DASHBOARD_ROUTES.guests, label: "Tamu" },
    { href: DASHBOARD_ROUTES.rsvp, label: "RSVP" },
    { href: DASHBOARD_ROUTES.guestbook, label: "Buku tamu" },
  ];
  if (role === "OWNER")
    items.push({ href: DASHBOARD_ROUTES.orders, label: "Pesanan" });
  return items;
}

function Shell({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: DashboardAggregate["role"];
}) {
  return (
    <ApplicationShell
      nav={navigation(role)}
      footerNote="Satu workspace untuk mengelola undangan, tamu, dan konfirmasi kehadiran."
    >
      {children}
    </ApplicationShell>
  );
}

function UnauthenticatedDashboard() {
  return (
    <Shell>
      <div className="dash-state">
        <h1 className="ui-visually-hidden">Dasbor</h1>
        <StatePanel
          title="Anda belum masuk"
          description="Masuk untuk melihat workspace pernikahan dan melanjutkan persiapan undangan Anda."
          action={
            <div className="dash-state__actions">
              <a
                className="ui-button ui-button--primary ui-button--md"
                href={signInHref(DASHBOARD_ROUTES.dashboard)}
              >
                Masuk
              </a>
              <a
                className="ui-button ui-button--secondary ui-button--md"
                href="/daftar?next=%2Fdashboard"
              >
                Buat akun
              </a>
            </div>
          }
        />
      </div>
    </Shell>
  );
}

function UnavailableDashboard() {
  return (
    <Shell>
      <div className="dash-state">
        <h1 className="ui-visually-hidden">Dasbor</h1>
        <ErrorState
          title="Dasbor tidak dapat dimuat"
          description="Layanan workspace sedang tidak tersedia. Coba muat ulang halaman ini atau hubungi bantuan bila masalah berlanjut."
          action={
            <a
              className="ui-button ui-button--primary ui-button--md"
              href={DASHBOARD_ROUTES.dashboard}
            >
              Coba lagi
            </a>
          }
        />
        <p className="dash-state__help">
          Butuh bantuan? <Link href="/#faq">Lihat pertanyaan umum.</Link>
        </p>
      </div>
    </Shell>
  );
}

function DashboardContent({ aggregate }: { aggregate: DashboardAggregate }) {
  const today = todayYmd(aggregate.workspace.timezone ?? "Asia/Jakarta");
  const status = derivedStatus(aggregate, today);
  const actions = nextActions(aggregate, today);
  const completion = completionItems(aggregate);
  const expiryWarning = expiryWarningText(
    status.state,
    aggregate.workspace.weddingDate,
    today,
  );
  const paymentPending =
    aggregate.payment.status === "ok" &&
    aggregate.payment.data.state === "PENDING";
  const lead = aggregate.workspace.coupleNames
    ? `${aggregate.workspace.coupleNames}${aggregate.workspace.city ? ` · ${aggregate.workspace.city}` : ""}`
    : "Mulai dengan data dasar pernikahan Anda.";

  return (
    <div className="dash-page">
      <header className="dash-page__header">
        <p className="dash-section__eyebrow">Workspace pernikahan</p>
        <h1>Dasbor</h1>
        <p className="dash-page__lead">{lead}</p>
      </header>

      <CountdownBand aggregate={aggregate} today={today} />

      {paymentPending || expiryWarning !== null ? (
        <div className="dash-alerts">
          {paymentPending ? (
            <Alert variant="warning" title="Pembayaran belum selesai">
              {aggregate.role === "OWNER"
                ? "Undangan belum bisa diterbitkan sebelum pembayaran selesai."
                : "Pemilik undangan perlu menyelesaikan pembayaran agar undangan bisa diterbitkan."}
            </Alert>
          ) : null}
          {expiryWarning !== null ? (
            <Alert
              variant={status.state === "EXPIRED" ? "info" : "warning"}
              title={
                status.state === "EXPIRED"
                  ? "Masa aktif undangan berakhir"
                  : "Masa aktif undangan segera berakhir"
              }
            >
              {expiryWarning}
            </Alert>
          ) : null}
        </div>
      ) : null}

      <NextActions aggregate={aggregate} status={status} actions={actions} />

      <div className="dash-grid dash-grid--two">
        <InvitationStatus aggregate={aggregate} status={status} today={today} />
        <CompletionProgress items={completion} />
      </div>

      <div className="dash-grid dash-grid--two">
        <RsvpSummary aggregate={aggregate} />
        <GuestSummary aggregate={aggregate} />
      </div>

      <p className="dash-help">
        Butuh bantuan? <Link href="/#faq">Lihat pertanyaan umum.</Link>
      </p>
    </div>
  );
}

export function DashboardView({ result }: { result: DashboardLoad }) {
  if (result.kind === "unauthenticated") return <UnauthenticatedDashboard />;
  if (result.kind === "unavailable") return <UnavailableDashboard />;
  return (
    <Shell role={result.data.role}>
      <DashboardContent aggregate={result.data} />
    </Shell>
  );
}

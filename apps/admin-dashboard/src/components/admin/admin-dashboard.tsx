import Link from "next/link";
import { IconAlert, IconCheck, IconInbox, IconShield } from "@wedding/ui";
import { Alert } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader } from "../ui/card";
import { AdminPagination } from "./admin-pagination";
import { AdminQueryControls } from "./admin-query-controls";
import { AdminRefreshControl } from "./admin-refresh-control";
import type { AdminDashboard, AdminLoad } from "../../lib/admin/contract";
import { formatAdminTimestamp } from "../../lib/admin/formatters";
import { AdminShell } from "./admin-shell";
import { AdminMotion } from "./admin-motion";
import { AttentionQueue } from "./attention-queue";
import { AuditAccess } from "./audit-access";
import { FailedJobs } from "./failed-jobs";
import { LifecycleExceptions } from "./lifecycle-exceptions";
import { PaymentReconciliation } from "./payment-reconciliation";
import { PrintingStatus } from "./printing-status";
import { PublicationFailures } from "./publication-failures";
import { SupportCases } from "./support-cases";
import { TemplateStatus } from "./template-status";
import type { ReactNode } from "react";

function UnavailableView({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action: "signin" | "refresh";
}) {
  return (
    <main
      className="grid min-h-[100dvh] place-items-center bg-[var(--color-ivory)] px-4 py-8"
      aria-labelledby="admin-state-title"
    >
      <section className="admin-state-card grid w-full max-w-xl gap-5" aria-live="polite">
        <div className="admin-state-card__mark" aria-hidden="true">
          <IconShield className="size-5" />
        </div>
        <div className="grid gap-2">
          <p className="admin-eyebrow">Wedding System operations</p>
          <h1 id="admin-state-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">{message}</p>
        </div>
        {action === "signin" ? (
          <Link
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--color-accent-strong)] px-4 text-sm font-bold text-white no-underline transition hover:-translate-y-px hover:bg-[var(--color-accent)] active:translate-y-px sm:w-fit"
            href="/masuk?next=%2F"
          >
            Masuk kembali
          </Link>
        ) : (
          <span className="w-fit">
            <AdminRefreshControl />
          </span>
        )}
      </section>
    </main>
  );
}

function rowCount(section: {
  status: "ok" | "unavailable" | "permission-denied";
  rows?: readonly unknown[];
}) {
  return section.status === "ok" ? String(section.rows?.length ?? 0) : "—";
}

type MetricTone = "danger" | "warning" | "success" | "neutral";

function SummaryMetric({
  label,
  value,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone: MetricTone;
  icon: ReactNode;
}) {
  return (
    <article className={`admin-metric admin-metric--${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="admin-metric__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="admin-metric__value">{value}</span>
      </div>
      <div className="mt-5 grid gap-1">
        <h2 className="text-sm font-bold text-[var(--color-ink)]">{label}</h2>
        <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">{detail}</p>
      </div>
    </article>
  );
}

function AccessPosture({ data }: { data: AdminDashboard }) {
  return (
    <Card className="admin-access-card">
      <CardHeader className="admin-access-card__header">
        <div>
          <p className="admin-eyebrow">Access posture</p>
          <h2 className="mt-1 text-base font-bold">Ruang kerja terproteksi</h2>
        </div>
        <span className="admin-access-card__icon" aria-hidden="true">
          <IconShield className="size-5" />
        </span>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="admin-access-status">
          <span className="admin-status-dot admin-status-dot--success" aria-hidden="true" />
          <div>
            <strong className="block text-sm">{data.session.roleLabel}</strong>
            <span className="text-xs text-[var(--color-ink-soft)]">{data.session.scope}</span>
          </div>
        </div>
        <dl className="grid gap-3 border-t border-[var(--color-line)] pt-4 text-xs">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[var(--color-ink-soft)]">MFA</dt>
            <dd className="m-0 font-bold text-[var(--color-ink)]">
              {data.session.mfaActive ? "Aktif" : "Belum aktif di fixture"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[var(--color-ink-soft)]">Lingkungan</dt>
            <dd className="m-0 font-bold text-[var(--color-ink)]">{data.session.environmentLabel}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[var(--color-ink-soft)]">Data</dt>
            <dd className="m-0 font-bold text-[var(--color-ink)]">Masked by default</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function DashboardContent({ data }: { data: AdminDashboard }) {
  return (
    <AdminMotion>
      <div className="admin-content mx-auto w-full max-w-[96rem] space-y-6">
        <header className="admin-page-heading">
          <div className="min-w-0">
            <nav className="admin-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">Admin</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Platform overview</span>
            </nav>
            <div className="mt-5 grid gap-2">
              <p className="admin-eyebrow">Platform overview</p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Ringkasan operasi</h1>
              <p className="max-w-2xl text-sm leading-relaxed text-[var(--color-ink-soft)]">
                Temukan isu paling penting, pahami pemiliknya, lalu ambil langkah aman yang tercatat.
              </p>
            </div>
          </div>
          <div className="admin-page-heading__actions">
            <Badge className="w-fit">{data.session.environmentLabel}</Badge>
            <AdminQueryControls page={data.query.page} limit={data.query.limit} search={data.query.search} />
          </div>
        </header>

        <div className="grid gap-3">
          {data.session.environment === "SIMULATION" ? (
            <Alert variant="info" title="Data simulasi — bukan data produksi">
              Fixture lokal memvalidasi masking, permission, dan state UI. Tidak ada pembayaran, retry,
              perubahan template, atau data pelanggan yang dimutasi.
            </Alert>
          ) : null}
          {data.freshness.status === "stale" ? (
            <Alert variant="warning" title="Data perlu diperbarui">
              {data.freshness.message}
            </Alert>
          ) : null}
        </div>

        <div className="admin-context-bar" aria-label="Konteks data">
          <span>
            Terakhir disegarkan <strong>{formatAdminTimestamp(data.session.lastRefreshed)} WIB</strong>
          </span>
          <span>
            Scope <strong>{data.session.scope}</strong>
          </span>
          <span>
            Pencarian <strong>{data.query.search || "semua"}</strong>
          </span>
        </div>

        <section className="admin-metrics" aria-label="Ringkasan operasional">
          <SummaryMetric
            label="Perlu perhatian"
            value={rowCount(data.attention)}
            detail="Isu dengan dampak atau urgensi tinggi"
            tone="danger"
            icon={<IconAlert className="size-5" />}
          />
          <SummaryMetric
            label="Rekonsiliasi pembayaran"
            value={rowCount(data.payments)}
            detail="Status internal yang perlu dibandingkan"
            tone="warning"
            icon={<IconInbox className="size-5" />}
          />
          <SummaryMetric
            label="Pekerjaan gagal"
            value={rowCount(data.failedJobs)}
            detail="Antrean worker yang menunggu diagnosis"
            tone="warning"
            icon={<IconAlert className="size-5" />}
          />
          <SummaryMetric
            label="Audit event"
            value={rowCount(data.audit)}
            detail="Event yang tersedia untuk akses terbatas"
            tone="success"
            icon={<IconCheck className="size-5" />}
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
          <AttentionQueue section={data.attention} />
          <AccessPosture data={data} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <PaymentReconciliation section={data.payments} />
          <FailedJobs section={data.failedJobs} />
        </div>
        <PublicationFailures section={data.publicationFailures} />
        <div className="grid gap-6 xl:grid-cols-2">
          <PrintingStatus section={data.printing} />
          <SupportCases section={data.support} />
        </div>
        <TemplateStatus section={data.templates} />
        <LifecycleExceptions section={data.lifecycle} />
        <AuditAccess section={data.audit} />
        <AdminPagination
          page={data.query.page}
          limit={data.query.limit}
          search={data.query.search}
          hasNextPage={[
            data.payments,
            data.failedJobs,
            data.publicationFailures,
            data.printing,
            data.support,
            data.templates,
            data.lifecycle,
            data.audit,
          ].some((section) => section.status === "ok" && section.pagination?.hasNextPage)}
        />

        <section className="admin-guardrail" aria-labelledby="permission-note-title">
          <div className="min-w-0">
            <p className="admin-eyebrow">Guardrail</p>
            <h2 id="permission-note-title" className="mt-1 text-base font-bold">
              Guardrail operasi produksi
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[var(--color-ink-soft)]">
              Data operasional tetap masked. Mutasi memerlukan API terotorisasi, MFA/step-up, reason,
              konfirmasi, idempotensi, transaksi bila diperlukan, dan audit event.
            </p>
          </div>
          <Badge className="w-fit shrink-0">Masked + audited</Badge>
        </section>
      </div>
    </AdminMotion>
  );
}

export function AdminDashboardView({ result }: { result: AdminLoad }) {
  if (result.kind === "permission-denied") {
    return <UnavailableView title="Akses admin diperlukan" message={result.message} action="signin" />;
  }
  if (result.kind === "session-expired") {
    return <UnavailableView title="Sesi admin berakhir" message={result.message} action="signin" />;
  }
  if (result.kind === "unavailable") {
    return <UnavailableView title="Konsol operasi tidak tersedia" message={result.message} action="refresh" />;
  }
  return (
    <AdminShell session={result.data.session} freshness={result.data.freshness}>
      <DashboardContent data={result.data} />
    </AdminShell>
  );
}

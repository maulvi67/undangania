import Link from "next/link";
import { Alert, Button } from "@wedding/ui";
import type { AdminDashboard, AdminLoad } from "../../lib/admin/contract";
import { formatAdminTimestamp } from "../../lib/admin/formatters";
import { AdminShell } from "./admin-shell";
import { AttentionQueue } from "./attention-queue";
import { AuditAccess } from "./audit-access";
import { FailedJobs } from "./failed-jobs";
import { LifecycleExceptions } from "./lifecycle-exceptions";
import { PaymentReconciliation } from "./payment-reconciliation";
import { PrintingStatus } from "./printing-status";
import { PublicationFailures } from "./publication-failures";

import { SupportCases } from "./support-cases";
import { TemplateStatus } from "./template-status";

function UnavailableView({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action: string;
}) {
  return (
    <main className="admin-state-page" aria-labelledby="admin-state-title">
      <div className="admin-state-page__inner">
        <p className="admin-eyebrow">Wedding System Operations</p>
        <h1 id="admin-state-title">{title}</h1>
        <p>{message}</p>
        <Button variant="primary">{action}</Button>
      </div>
    </main>
  );
}

function DashboardContent({ data }: { data: AdminDashboard }) {
  return (
    <div className="admin-page">
      <header className="admin-page__heading">
        <div>
          <p className="admin-eyebrow">Admin operations</p>
          <h1>Ringkasan operasi</h1>
          <p className="admin-page__lead">
            Temukan kegagalan paling penting, pahami pemiliknya, lalu ambil
            langkah yang aman dan dapat diaudit.
          </p>
        </div>
        <div className="admin-page__actions">
          <span className="admin-fixture-label">Mode: {data.session.environmentLabel}</span>
          <Link
            className="ui-button ui-button--secondary ui-button--md"
            href="/?state=healthy"
          >
            Lihat kondisi sehat
          </Link>
        </div>
      </header>

      {data.session.environment === "SIMULATION" ? (
        <Alert variant="info" title="Data simulasi — bukan data produksi">
          Konsol ini sedang menggunakan fixture lokal untuk memvalidasi informasi,
          masking, dan state UI. Tidak ada pembayaran, retry, perubahan template,
          atau data pelanggan yang dimutasi.
        </Alert>
      ) : null}

      {data.freshness.status === "stale" ? (
        <Alert variant="warning" title="Data perlu diperbarui">
          {data.freshness.message}
        </Alert>
      ) : null}

      <div className="admin-page__context" aria-label="Konteks data">
        <span>
          Terakhir disegarkan:{" "}
          <strong>
            {formatAdminTimestamp(data.session.lastRefreshed)} WIB
          </strong>
        </span>
        <span>
          Scope: <strong>{data.session.scope}</strong>
        </span>
        <span>
          Semua tindakan sensitif: <strong>ditahan</strong>
        </span>
      </div>

      <AttentionQueue section={data.attention} />
      <div className="admin-section-grid">
        <PaymentReconciliation section={data.payments} />
        <FailedJobs section={data.failedJobs} />
      </div>
      <PublicationFailures section={data.publicationFailures} />
      <div className="admin-section-grid">
        <PrintingStatus section={data.printing} />
        <SupportCases section={data.support} />
      </div>
      <TemplateStatus section={data.templates} />
      <LifecycleExceptions section={data.lifecycle} />
      <AuditAccess section={data.audit} />

      <section
        className="admin-permission-note"
        aria-labelledby="permission-note-title"
      >
        <div>
          <p className="admin-eyebrow">Guardrail</p>
          <h2 id="permission-note-title">Tindakan sensitif belum diaktifkan</h2>
          <p>
            Rekonsiliasi, retry job, perubahan status template, eskalasi
            support, reveal audit, dan export memerlukan API admin terotorisasi,
            MFA/step-up, reason, konfirmasi, transaksi bila diperlukan, dan
            audit event.
          </p>
        </div>
        <span className="admin-lock-label">Read-only phase</span>
      </section>
    </div>
  );
}

export function AdminDashboardView({ result }: { result: AdminLoad }) {
  if (result.kind === "permission-denied") {
    return (
      <UnavailableView
        title="Akses admin diperlukan"
        message={result.message}
        action="Kembali ke halaman masuk"
      />
    );
  }
  if (result.kind === "session-expired") {
    return (
      <UnavailableView
        title="Sesi admin berakhir"
        message={result.message}
        action="Masuk kembali"
      />
    );
  }
  if (result.kind === "unavailable") {
    return (
      <UnavailableView
        title="Konsol operasi tidak tersedia"
        message={result.message}
        action="Coba lagi"
      />
    );
  }

  return (
    <AdminShell session={result.data.session} freshness={result.data.freshness}>
      <DashboardContent data={result.data} />
    </AdminShell>
  );
}

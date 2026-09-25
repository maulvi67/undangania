import type { AdminDashboard, FailedJobRow } from "../../lib/admin/contract";
import { formatAdminTimestamp } from "../../lib/admin/formatters";
import { OperationsTable } from "./operations-table";
import { SectionState } from "./section-state";
import { SeverityLabel } from "./attention-queue";
import { AdminMutationAction } from "./admin-mutation-action";

function jobDetails(row: FailedJobRow) {
  return (
    <details className="admin-row-details">
      <summary>Diagnosis ringkas</summary>
      <dl>
        {row.details.map((detail) => (
          <div key={detail.label}>
            <dt>{detail.label}</dt>
            <dd>{detail.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function FailedJobs({
  section,
}: {
  section: AdminDashboard["failedJobs"];
}) {
  return (
    <section
      className="admin-section min-w-0 overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-[0_12px_32px_rgba(36,52,47,0.06)]"
      id="pekerjaan-gagal"
      aria-labelledby="jobs-title"
    >
      <div className="admin-section__heading flex items-start justify-between gap-4 border-b border-[var(--color-line)] bg-[var(--color-panel-muted)] px-5 py-4">
        <div>
          <p className="admin-eyebrow">Worker operations</p>
          <h2 id="jobs-title">Pekerjaan gagal</h2>
          <p className="admin-section__description">
            Stack trace mentah tidak ditampilkan. Ringkasan dibatasi agar
            diagnosis tetap aman.
          </p>
        </div>
      </div>
      {section.status !== "ok" ? (
        <SectionState status={section.status} message={section.message} />
      ) : section.rows.length === 0 ? (
        <SectionState
          status="ok"
          emptyTitle="Tidak ada pekerjaan gagal"
          emptyDescription="Antrean worker tidak memiliki kegagalan yang perlu ditinjau."
        />
      ) : (
        <OperationsTable
          caption="Daftar pekerjaan gagal"
          rows={section.rows}
          columns={[
            {
              key: "job",
              label: "Pekerjaan",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.reference}</strong>
                  <span>{row.jobType}</span>
                  <span>{row.queue}</span>
                </div>
              ),
            },
            {
              key: "failure",
              label: "Kegagalan",
              render: (row) => (
                <div className="admin-cell-primary">
                  <SeverityLabel severity={row.severity} />
                  <strong>{row.status}</strong>
                  <span>{row.failureReason}</span>
                </div>
              ),
            },
            {
              key: "attempts",
              label: "Percobaan",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.attempts} kali</strong>
                  <span>
                    Terakhir {formatAdminTimestamp(row.lastFailedAt)} WIB
                  </span>
                  <span>{row.retryState}</span>
                </div>
              ),
            },
            {
              key: "owner",
              label: "Pemilik",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.owner}</strong>
                  <span>Usia {row.age}</span>
                  <span>{row.relatedResource}</span>
                </div>
              ),
            },
            {
              key: "action",
              label: "Tindakan",
              render: (row) => (
                <div className="admin-cell-action">
                  {jobDetails(row)}
                  <AdminMutationAction
                    action="retry_failed_job"
                    targetId={row.id}
                    targetType={row.queue === "notifikasi" ? "notification" : "outbox"}
                    label="Retry dengan audit"
                  />
                </div>
              ),
            },
          ]}
        />
      )}
    </section>
  );
}

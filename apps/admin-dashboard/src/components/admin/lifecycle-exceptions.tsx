import type { AdminDashboard } from "../../lib/admin/contract";
import { formatAdminTimestamp } from "../../lib/admin/formatters";
import { OperationsTable } from "./operations-table";
import { SectionState } from "./section-state";
import { SeverityLabel } from "./attention-queue";

export function LifecycleExceptions({
  section,
}: {
  section: AdminDashboard["lifecycle"];
}) {
  return (
    <section
      className="admin-section min-w-0 overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-[0_12px_32px_rgba(36,52,47,0.06)]"
      id="pengecualian"
      aria-labelledby="lifecycle-title"
    >
      <div className="admin-section__heading flex items-start justify-between gap-4 border-b border-[var(--color-line)] bg-[var(--color-panel-muted)] px-5 py-4">
        <div>
          <p className="admin-eyebrow">Consistency checks</p>
          <h2 id="lifecycle-title">Pengecualian lifecycle</h2>
          <p className="admin-section__description">
            Bandingkan state saat ini dengan state yang diharapkan sebelum
            melakukan tindakan lanjutan.
          </p>
        </div>
      </div>
      {section.status !== "ok" ? (
        <SectionState status={section.status} message={section.message} />
      ) : section.rows.length === 0 ? (
        <SectionState
          status="ok"
          emptyTitle="Tidak ada pengecualian lifecycle"
          emptyDescription="Tidak ditemukan state yang menyimpang pada data simulasi ini."
        />
      ) : (
        <OperationsTable
          caption="Daftar pengecualian lifecycle"
          rows={section.rows}
          columns={[
            {
              key: "resource",
              label: "Resource",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.reference}</strong>
                  <span>{row.resourceType}</span>
                  <SeverityLabel severity={row.severity} />
                </div>
              ),
            },
            {
              key: "state",
              label: "State",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>Saat ini: {row.currentState}</strong>
                  <span>Diharapkan: {row.expectedState}</span>
                  <span>{row.impact}</span>
                </div>
              ),
            },
            {
              key: "owner",
              label: "Pemilik / usia",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.owner}</strong>
                  <span>Usia {row.age}</span>
                  <span>
                    Transisi {formatAdminTimestamp(row.lastTransition)} WIB
                  </span>
                </div>
              ),
            },
            {
              key: "action",
              label: "Langkah aman",
              render: (row) => (
                <div className="admin-cell-action">
                  <strong>{row.suggestedAction}</strong>
                  <span className="admin-disabled-action">
                    Perubahan state memerlukan use case server
                  </span>
                </div>
              ),
            },
          ]}
        />
      )}
    </section>
  );
}

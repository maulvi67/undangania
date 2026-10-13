import type { AdminDashboard } from "../../lib/admin/contract";
import { nextTemplateStatus } from "@wedding/application";
import { formatAdminDate } from "../../lib/admin/formatters";
import { OperationsTable } from "./operations-table";
import { SectionState } from "./section-state";
import { SeverityLabel } from "./attention-queue";
import { AdminMutationAction } from "./admin-mutation-action";

export function TemplateStatus({
  section,
}: {
  section: AdminDashboard["templates"];
}) {
  return (
    <section
      className="admin-section min-w-0 overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-[0_12px_32px_rgba(36,52,47,0.06)]"
      id="template"
      aria-labelledby="template-title"
    >
      <div className="admin-section__heading flex items-start justify-between gap-4 border-b border-[var(--color-line)] bg-[var(--color-panel-muted)] px-5 py-4">
        <div>
          <p className="admin-eyebrow">Catalog governance</p>
          <h2 id="template-title">Status template</h2>
          <p className="admin-section__description">
            Ketersediaan mengikuti status lisensi, versi, manifest, dan kesiapan
            publikasi.
          </p>
        </div>
      </div>
      {section.status !== "ok" ? (
        <SectionState status={section.status} message={section.message} />
      ) : section.rows.length === 0 ? (
        <SectionState
          status="ok"
          emptyTitle="Tidak ada template untuk ditampilkan"
        />
      ) : (
        <OperationsTable
          caption="Daftar status template"
          rows={section.rows}
          columns={[
            {
              key: "template",
              label: "Template",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.name}</strong>
                  <span>
                    {row.templateId} · {row.version}
                  </span>
                  <span>{row.packageLink}</span>
                </div>
              ),
            },
            {
              key: "availability",
              label: "Ketersediaan",
              render: (row) => (
                <div className="admin-cell-primary">
                  <SeverityLabel severity={row.severity} />
                  <strong>{row.availability}</strong>
                  <span>{row.reason}</span>
                </div>
              ),
            },
            {
              key: "readiness",
              label: "Kesiapan",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.readiness}</strong>
                  <span>Diubah {formatAdminDate(row.lastChanged)}</span>
                </div>
              ),
            },
            {
              key: "owner",
              label: "Pemilik",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.owner}</strong>
                  <span>Status: {row.status}</span>
                </div>
              ),
            },
            {
              key: "action",
              label: "Tindakan",
              render: (row) => {
                // The console must only offer the one transition the platform
                // accepts (DRAFT→REVIEW→APPROVED→ACTIVE→RETIRED); anything else
                // is rejected server-side with a 400.
                const toStatus = nextTemplateStatus(row.status);
                if (toStatus === null) {
                  return (
                    <span className="text-xs text-[var(--color-ink-soft)]">
                      Status akhir — tidak ada transisi lanjutan
                    </span>
                  );
                }
                return (
                  <div className="admin-cell-action">
                    <AdminMutationAction
                      action="moderate_template"
                      targetId={row.templateId}
                      templateVersion={row.version}
                      fromStatus={row.status}
                      toStatus={toStatus}
                      label={`Moderasi ke ${toStatus}`}
                    />
                    <span className="ui-visually-hidden"> untuk {row.name}</span>
                  </div>
                );
              },
            },
          ]}
        />
      )}
    </section>
  );
}

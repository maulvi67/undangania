import type { AdminDashboard } from "../../lib/admin/contract";
import { MaskedValue } from "./masked-value";
import { OperationsTable } from "./operations-table";
import { SectionState } from "./section-state";
import { SeverityLabel } from "./attention-queue";
import { AdminMutationAction } from "./admin-mutation-action";

export function SupportCases({
  section,
}: {
  section: AdminDashboard["support"];
}) {
  return (
    <section
      className="admin-section min-w-0 overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-[0_12px_32px_rgba(36,52,47,0.06)]"
      id="dukungan"
      aria-labelledby="support-title"
    >
      <div className="admin-section__heading flex items-start justify-between gap-4 border-b border-[var(--color-line)] bg-[var(--color-panel-muted)] px-5 py-4">
        <div>
          <p className="admin-eyebrow">Customer support</p>
          <h2 id="support-title">Kasus dukungan</h2>
          <p className="admin-section__description">
            Identitas workspace dan kontak tetap disamarkan sampai akses yang
            tepat diberikan.
          </p>
        </div>
      </div>
      {section.status !== "ok" ? (
        <SectionState status={section.status} message={section.message} />
      ) : section.rows.length === 0 ? (
        <SectionState
          status="ok"
          emptyTitle="Tidak ada kasus dukungan terbuka"
        />
      ) : (
        <OperationsTable
          caption="Daftar kasus dukungan"
          rows={section.rows}
          columns={[
            {
              key: "case",
              label: "Kasus",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.caseId}</strong>
                  <span>{row.category}</span>
                  <MaskedValue value={row.maskedWorkspace} label="Workspace" />
                </div>
              ),
            },
            {
              key: "severity",
              label: "Prioritas",
              render: (row) => (
                <div className="admin-cell-primary">
                  <SeverityLabel severity={row.severity} />
                  <strong>{row.status}</strong>
                  <span>Usia {row.age}</span>
                </div>
              ),
            },
            {
              key: "response",
              label: "Respons",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.lastResponse}</strong>
                  <span>{row.escalationState}</span>
                </div>
              ),
            },
            {
              key: "owner",
              label: "Pemilik",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.owner}</strong>
                  <span>Diperbarui {row.updatedAt.slice(0, 10)}</span>
                </div>
              ),
            },
            {
              key: "action",
              label: "Tindakan",
              render: (row) => (
                <div className="admin-cell-action">
                  <AdminMutationAction
                    action="escalate_support"
                    targetId={row.id}
                    label="Eskalasi dengan audit"
                  />
                  <span className="ui-visually-hidden">
                    {" "}
                    untuk {row.caseId}
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

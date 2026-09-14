import type { AdminDashboard } from "../../lib/admin/contract";
import { formatAdminTimestamp } from "../../lib/admin/formatters";
import { MaskedValue } from "./masked-value";
import { OperationsTable } from "./operations-table";
import { SectionState } from "./section-state";

export function AuditAccess({ section }: { section: AdminDashboard["audit"] }) {
  return (
    <section className="admin-section" id="audit" aria-labelledby="audit-title">
      <div className="admin-section__heading">
        <div>
          <p className="admin-eyebrow">Accountability</p>
          <h2 id="audit-title">Akses audit</h2>
          <p className="admin-section__description">
            Audit bersifat append-only. Field sensitif tetap masked dan tidak
            tersedia melalui hover.
          </p>
        </div>
        <span className="admin-read-only-note">Read-only</span>
      </div>
      {section.status !== "ok" ? (
        <SectionState status={section.status} message={section.message} />
      ) : section.rows.length === 0 ? (
        <SectionState status="ok" emptyTitle="Belum ada audit event" />
      ) : (
        <OperationsTable
          caption="Daftar audit event"
          rows={section.rows}
          columns={[
            {
              key: "when",
              label: "Waktu",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{formatAdminTimestamp(row.timestamp)} WIB</strong>
                  <span>{row.correlationId}</span>
                </div>
              ),
            },
            {
              key: "actor",
              label: "Aktor",
              render: (row) => (
                <div className="admin-cell-primary">
                  <MaskedValue value={row.actor} label="Aktor" />
                  <span>{row.role}</span>
                </div>
              ),
            },
            {
              key: "action",
              label: "Aksi",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.action}</strong>
                  <span>{row.target}</span>
                </div>
              ),
            },
            {
              key: "reason",
              label: "Reason / hasil",
              render: (row) => (
                <div className="admin-cell-primary">
                  <span>{row.reason}</span>
                  <strong>{row.result}</strong>
                </div>
              ),
            },
            {
              key: "access",
              label: "Akses",
              render: (row) => (
                <div className="admin-cell-action">
                  <span className="admin-disabled-action">
                    Reveal / export · perlu permission + reason
                  </span>
                  <span className="ui-visually-hidden">
                    {" "}
                    untuk audit {row.id}
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

import type {
  AdminDashboard,
  PublicationFailureRow,
} from "../../lib/admin/contract";
import { formatAdminTimestamp } from "../../lib/admin/formatters";
import { OperationsTable } from "./operations-table";
import { SectionState } from "./section-state";
import { SeverityLabel } from "./attention-queue";
import { AdminMutationAction } from "./admin-mutation-action";

function publicationDetails(row: PublicationFailureRow) {
  return (
    <details className="admin-row-details">
      <summary>Versi snapshot</summary>
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

export function PublicationFailures({
  section,
}: {
  section: AdminDashboard["publicationFailures"];
}) {
  return (
    <section
      className="admin-section"
      id="publikasi"
      aria-labelledby="publication-title"
    >
      <div className="admin-section__heading">
        <div>
          <p className="admin-eyebrow">Publication safety</p>
          <h2 id="publication-title">Kegagalan publikasi</h2>
          <p className="admin-section__description">
            Versi yang gagal dan versi publik yang masih aktif selalu dibedakan.
          </p>
        </div>
      </div>
      {section.status !== "ok" ? (
        <SectionState status={section.status} message={section.message} />
      ) : section.rows.length === 0 ? (
        <SectionState
          status="ok"
          emptyTitle="Tidak ada publikasi gagal"
          emptyDescription="Tidak ada percobaan snapshot yang gagal pada data simulasi ini."
        />
      ) : (
        <OperationsTable
          caption="Daftar kegagalan publikasi"
          rows={section.rows}
          columns={[
            {
              key: "reference",
              label: "Percobaan",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.reference}</strong>
                  <span>{row.invitationReference}</span>
                  <span>Versi dicoba: {row.attemptedVersion}</span>
                </div>
              ),
            },
            {
              key: "stage",
              label: "Tahap",
              render: (row) => (
                <div className="admin-cell-primary">
                  <SeverityLabel severity={row.severity} />
                  <strong>{row.failureStage}</strong>
                  <span>Gagal {formatAdminTimestamp(row.failedAt)} WIB</span>
                </div>
              ),
            },
            {
              key: "active",
              label: "Status publik",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>
                    {row.previousSnapshotActive
                      ? "Versi sebelumnya masih aktif"
                      : "Tidak ada versi aktif"}
                  </strong>
                  <span>
                    {row.currentPublishedVersion === null
                      ? "Belum ada snapshot publik"
                      : `Snapshot v${row.currentPublishedVersion} sedang aktif`}
                  </span>
                </div>
              ),
            },
            {
              key: "ownership",
              label: "Pemilik",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.owner}</strong>
                  <span>{row.retryState}</span>
                  <span>Usia {row.age}</span>
                </div>
              ),
            },
            {
              key: "action",
              label: "Detail",
              render: (row) => (
                <div className="admin-cell-action">
                  {publicationDetails(row)}
                  <AdminMutationAction
                    action="recover_publication"
                    targetId={row.id}
                    label="Pulihkan snapshot"
                  />
                  <span className="ui-visually-hidden">
                    {" "}
                    untuk {row.invitationReference}
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

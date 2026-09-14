import type { AdminDashboard } from "../../lib/admin/contract";
import { formatAdminTimestamp } from "../../lib/admin/formatters";
import { MaskedValue } from "./masked-value";
import { OperationsTable } from "./operations-table";
import { SectionState } from "./section-state";
import { SeverityLabel } from "./attention-queue";

export function PrintingStatus({
  section,
}: {
  section: AdminDashboard["printing"];
}) {
  return (
    <section
      className="admin-section"
      id="pesanan-cetak"
      aria-labelledby="printing-title"
    >
      <div className="admin-section__heading">
        <div>
          <p className="admin-eyebrow">Fulfillment</p>
          <h2 id="printing-title">Status pesanan cetak</h2>
          <p className="admin-section__description">
            Status produksi dan pengiriman ditampilkan tanpa membuka alamat atau
            dokumen vendor.
          </p>
        </div>
      </div>
      {section.status !== "ok" ? (
        <SectionState status={section.status} message={section.message} />
      ) : section.rows.length === 0 ? (
        <SectionState
          status="ok"
          emptyTitle="Tidak ada pesanan cetak untuk ditinjau"
        />
      ) : (
        <OperationsTable
          caption="Daftar status pesanan cetak"
          rows={section.rows}
          columns={[
            {
              key: "order",
              label: "Pesanan",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.reference}</strong>
                  <span>{row.orderReference}</span>
                  <MaskedValue value={row.maskedWorkspace} label="Workspace" />
                </div>
              ),
            },
            {
              key: "production",
              label: "Produksi",
              render: (row) => (
                <div className="admin-cell-primary">
                  <SeverityLabel severity={row.severity} />
                  <strong>{row.productionStatus}</strong>
                  <span>Vendor: {row.vendor}</span>
                </div>
              ),
            },
            {
              key: "shipping",
              label: "Pengiriman",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.shippingStatus}</strong>
                  <span>
                    Pembaruan {formatAdminTimestamp(row.lastProviderUpdate)} WIB
                  </span>
                </div>
              ),
            },
            {
              key: "ownership",
              label: "Pemilik / eskalasi",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.owner}</strong>
                  <span>{row.stuckFor}</span>
                  <span>{row.escalationState}</span>
                </div>
              ),
            },
          ]}
        />
      )}
    </section>
  );
}

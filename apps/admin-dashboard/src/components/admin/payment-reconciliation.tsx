import type { AdminDashboard, PaymentRow } from "../../lib/admin/contract";
import {
  formatAdminTimestamp,
  formatIdrMinor,
} from "../../lib/admin/formatters";
import { MaskedValue } from "./masked-value";
import { OperationsTable } from "./operations-table";
import { SectionState } from "./section-state";
import { SeverityLabel } from "./attention-queue";

function paymentDetails(row: PaymentRow) {
  return (
    <details className="admin-row-details">
      <summary>Detail aman</summary>
      <dl>
        {row.details.map((detail) => (
          <div key={detail.label}>
            <dt>{detail.label}</dt>
            <dd>
              {detail.masked ? (
                <MaskedValue value={detail.value} label={detail.label} />
              ) : (
                detail.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function PaymentReconciliation({
  section,
}: {
  section: AdminDashboard["payments"];
}) {
  return (
    <section
      className="admin-section"
      id="pembayaran"
      aria-labelledby="payments-title"
    >
      <div className="admin-section__heading">
        <div>
          <p className="admin-eyebrow">Finance operations</p>
          <h2 id="payments-title">Rekonsiliasi pembayaran</h2>
          <p className="admin-section__description">
            QRIS dan status provider ditampilkan bersama status internal.
            Redirect browser bukan sumber kebenaran pembayaran.
          </p>
        </div>
        <span className="admin-read-only-note">Read-only</span>
      </div>
      {section.status !== "ok" ? (
        <SectionState status={section.status} message={section.message} />
      ) : section.rows.length === 0 ? (
        <SectionState
          status="ok"
          emptyTitle="Tidak ada pembayaran untuk ditinjau"
        />
      ) : (
        <OperationsTable
          caption="Daftar rekonsiliasi pembayaran"
          rows={section.rows}
          columns={[
            {
              key: "reference",
              label: "Pembayaran",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.reference}</strong>
                  <span>{row.orderReference}</span>
                  <span>{row.paymentReference}</span>
                </div>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <div className="admin-cell-primary">
                  <SeverityLabel severity={row.severity} />
                  <strong>{row.reconciliation}</strong>
                  <span>
                    Internal: {row.internalStatus} · Provider:{" "}
                    {row.providerStatus}
                  </span>
                </div>
              ),
            },
            {
              key: "amount",
              label: "Nilai",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>
                    {formatIdrMinor(row.amountMinor, row.currency)}
                  </strong>
                  <span>
                    {row.provider} · {row.method}
                  </span>
                  <MaskedValue value={row.maskedCustomer} label="Pelanggan" />
                </div>
              ),
            },
            {
              key: "ownership",
              label: "Pemilik / usia",
              render: (row) => (
                <div className="admin-cell-primary">
                  <strong>{row.owner}</strong>
                  <span>{row.age}</span>
                  <span>
                    Diperiksa {formatAdminTimestamp(row.lastProviderCheck)} WIB
                  </span>
                </div>
              ),
            },
            {
              key: "action",
              label: "Tindakan",
              render: (row) => (
                <div className="admin-cell-action">
                  {paymentDetails(row)}
                  <span className="admin-disabled-action">
                    Periksa kembali · perlu backend terotorisasi
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

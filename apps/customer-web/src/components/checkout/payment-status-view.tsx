import { Alert } from "@wedding/ui";
import { reconcilePaymentAction } from "../../lib/checkout/actions";
import {
  safeOrderReference,
  statusCopy,
  type CheckoutOrder,
  type PaymentStatusState,
} from "../../lib/checkout/contract";
import { LinkButton } from "../marketing/link-button";
import type { TemplateRecord } from "../templates/template-contract";
import { OrderReference } from "./order-reference";
import { SupportLink } from "./support-link";

/**
 * Submits the session's order for provider-status reconciliation.
 *
 * The order number travels as a form field because it is the lookup key the
 * server action scopes to the session; the action reads the provider transaction
 * from the stored order, never from the form.
 */
function ReconcileButton({
  order,
  label,
  variant = "primary",
}: {
  order: CheckoutOrder;
  label: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <form action={reconcilePaymentAction}>
      <input type="hidden" name="order" value={order.orderNumber} />
      <input type="hidden" name="template" value={order.templateId} />
      <button
        type="submit"
        className={`ui-button ui-button--${variant} ui-button--md`}
      >
        {label}
      </button>
    </form>
  );
}

function QrisPlaceholder({ state }: { state: PaymentStatusState }) {
  if (state !== "PENDING" && state !== "DELAYED") return null;
  return (
    <section className="ck-qris" aria-labelledby="ck-qris-title">
      <div className="ck-qris__placeholder" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div>
        <h2 className="ck-info-block__title" id="ck-qris-title">
          QRIS dari penyedia pembayaran
        </h2>
        <p>
          Pada integrasi sandbox ini, area QR ditampilkan sebagai placeholder.
          QR yang dapat dibayar hanya boleh berasal dari sesi transaksi yang
          dibuat server.
        </p>
      </div>
    </section>
  );
}

function ActionGroup({
  order,
  state,
}: {
  order: CheckoutOrder;
  state: PaymentStatusState;
}) {
  switch (state) {
    case "PAID":
    case "ALREADY_PAID":
      return (
        <div className="ck-status__actions">
          <LinkButton href="/dashboard">Lanjut ke workspace</LinkButton>
          <LinkButton href="/templates" variant="secondary">
            Lihat katalog desain
          </LinkButton>
        </div>
      );
    case "FAILED":
    case "EXPIRED":
      return (
        <div className="ck-status__actions">
          <LinkButton
            href={`/checkout?template=${encodeURIComponent(order.templateId)}`}
          >
            Buat pembayaran baru
          </LinkButton>
          <ReconcileButton
            order={order}
            label="Periksa status pesanan"
            variant="secondary"
          />
        </div>
      );
    case "PENDING":
    case "DELAYED":
    case "VERIFYING":
      return (
        <div className="ck-status__actions">
          <ReconcileButton order={order} label="Periksa kembali status" />
          <LinkButton
            href={`/checkout?template=${encodeURIComponent(order.templateId)}`}
            variant="secondary"
          >
            Kembali ke pesanan
          </LinkButton>
        </div>
      );
    case "ENTITLEMENT_PENDING":
      return (
        <div className="ck-status__actions">
          <ReconcileButton order={order} label="Periksa kembali" />
        </div>
      );
    case "AMOUNT_MISMATCH":
      return (
        <div className="ck-status__actions">
          <LinkButton href="/#faq" variant="secondary">
            Hubungi bantuan
          </LinkButton>
        </div>
      );
  }
}

export function PaymentStatusView({
  order,
  template,
  state,
}: {
  order: CheckoutOrder;
  template: Pick<TemplateRecord, "name">;
  state: PaymentStatusState;
}) {
  const copy = statusCopy(state);
  const reference = safeOrderReference(order.orderNumber);

  return (
    <div className="ck-status-layout">
      <header className="ck-heading ck-heading--status">
        <p className="ck-eyebrow">Langkah 2 dari 2 · Konfirmasi</p>
        <h1 className="ck-title">{copy.title}</h1>
        <p className="ck-lede">{copy.description}</p>
      </header>

      <div className="ck-status-card">
        <Alert variant={copy.tone} title={copy.title}>
          {state === "PAID" || state === "ALREADY_PAID"
            ? "Status ini berasal dari konfirmasi server yang sudah diverifikasi."
            : "Status ini belum memberikan akses berbayar atau mengubah entitlement workspace."}
        </Alert>
        <OrderReference orderNumber={reference} />
        <div className="ck-status__summary">
          <div>
            <span className="ck-status__label">Desain</span>
            <strong>{template.name}</strong>
          </div>
          <div>
            <span className="ck-status__label">Total pesanan</span>
            <strong>
              {new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0,
              }).format(BigInt(order.totalMinor))}
            </strong>
          </div>
        </div>
        <QrisPlaceholder state={state} />
        {state === "DELAYED" ? (
          <p className="ck-status__warning">
            Jika saldo Anda sudah terpotong, jangan membayar ulang. Simpan nomor
            pesanan dan periksa kembali nanti atau hubungi bantuan.
          </p>
        ) : null}
        {state === "PAID" ? (
          <p className="ck-status__success">
            Pembayaran terverifikasi. Akses workspace akan mengikuti entitlement
            yang diberikan oleh server secara idempoten.
          </p>
        ) : null}
        <ActionGroup order={order} state={state} />
        <p className="ck-status__support">
          Ada masalah dengan pesanan? <SupportLink>Hubungi bantuan</SupportLink>{" "}
          dan sertakan nomor pesanan di atas.
        </p>
      </div>
    </div>
  );
}

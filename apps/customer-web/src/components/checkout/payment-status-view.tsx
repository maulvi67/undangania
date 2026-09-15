import { Alert } from "@wedding/ui";
import type {
  CheckoutOrder,
  PaymentStatusState,
} from "../../lib/checkout/contract";
import {
  safeOrderReference,
  statusCopy,
} from "../../lib/checkout/stub-transport";
import { LinkButton } from "../marketing/link-button";
import type { TemplateRecord } from "../templates/template-contract";
import { OrderReference } from "./order-reference";
import { SupportLink } from "./support-link";

function statusHref(
  orderNumber: string,
  templateId: string,
  state: PaymentStatusState,
): string {
  return `/checkout/status?order=${encodeURIComponent(orderNumber)}&template=${encodeURIComponent(templateId)}&state=${state.toLowerCase()}`;
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
          <LinkButton
            href={statusHref(order.orderNumber, order.templateId, "VERIFYING")}
            variant="secondary"
          >
            Periksa status pesanan
          </LinkButton>
        </div>
      );
    case "PENDING":
    case "DELAYED":
    case "VERIFYING":
      return (
        <div className="ck-status__actions">
          <LinkButton
            href={statusHref(order.orderNumber, order.templateId, "VERIFYING")}
          >
            Periksa kembali status
          </LinkButton>
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
          <LinkButton
            href={statusHref(order.orderNumber, order.templateId, "VERIFYING")}
          >
            Periksa kembali
          </LinkButton>
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

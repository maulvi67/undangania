import type { Metadata } from "next";
import { MarketingFooter } from "../../../components/marketing/marketing-footer";
import { MarketingHeader } from "../../../components/marketing/marketing-header";
import { PaymentStatusView } from "../../../components/checkout/payment-status-view";
import { parsePaymentStatusState } from "../../../lib/checkout/contract";
import {
  loadCheckoutFixture,
  loadDefaultCheckoutFixture,
  safeOrderReference,
} from "../../../lib/checkout/stub-transport";
import "../../templates.css";
import "../checkout.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Status pembayaran — Wedding System",
  description: "Periksa status pembayaran pesanan Wedding System.",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PaymentStatusPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const templateId = first(params.template);
  const fixture = templateId
    ? loadCheckoutFixture(templateId)
    : loadDefaultCheckoutFixture();
  if (!fixture) {
    return null;
  }

  const orderNumber = safeOrderReference(
    first(params.order) ?? fixture.order.orderNumber,
  );
  const order = { ...fixture.order, orderNumber };
  const state = parsePaymentStatusState(first(params.state));

  return (
    <div className="ui-shell">
      <a className="ui-skip-link" href="#konten-utama">
        Langsung ke konten utama
      </a>
      <MarketingHeader />
      <main id="konten-utama" tabIndex={-1} className="ck-page">
        <div className="ui-container">
          <PaymentStatusView
            order={order}
            template={fixture.template}
            state={state}
          />
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

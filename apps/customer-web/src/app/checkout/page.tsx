import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingFooter } from "../../components/marketing/marketing-footer";
import { MarketingHeader } from "../../components/marketing/marketing-header";
import { CheckoutView } from "../../components/checkout/checkout-view";
import {
  parseCheckoutState,
  type CheckoutState,
} from "../../lib/checkout/contract";
import {
  loadCheckoutFixture,
  loadDefaultCheckoutFixture,
} from "../../lib/checkout/stub-transport";
import "../templates.css";
import "./checkout.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Periksa pesanan — Wedding System",
  description:
    "Periksa desain, harga, masa aktif, dan metode QRIS sebelum melanjutkan pembayaran.",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const templateId = first(params.template);
  const fixture = templateId
    ? loadCheckoutFixture(templateId)
    : loadDefaultCheckoutFixture();
  if (!fixture) notFound();

  const state: CheckoutState = parseCheckoutState(first(params.state));

  return (
    <div className="ui-shell">
      <a className="ui-skip-link" href="#konten-utama">
        Langsung ke konten utama
      </a>
      <MarketingHeader />
      <main id="konten-utama" tabIndex={-1} className="ck-page">
        <div className="ui-container">
          <CheckoutView
            order={fixture.order}
            template={fixture.template}
            initialState={state}
          />
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

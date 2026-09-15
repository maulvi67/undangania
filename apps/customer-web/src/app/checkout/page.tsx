import type { Metadata } from "next";
import Link from "next/link";
import { StatePanel } from "@wedding/ui";
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

function ProductionCheckoutUnavailable() {
  return (
    <div className="ui-shell">
      <a className="ui-skip-link" href="#konten-utama">
        Langsung ke konten utama
      </a>
      <MarketingHeader />
      <main id="konten-utama" tabIndex={-1} className="ck-page">
        <div className="ui-container">
          <div className="ck-status-layout">
            <header className="ck-heading ck-heading--status">
              <p className="ck-eyebrow">Pesanan</p>
              <h1 className="ck-title">Checkout belum tersedia</h1>
              <p className="ck-lede">
                Rincian pesanan dan pembayaran belum dapat diverifikasi dari
                layanan produksi.
              </p>
            </header>
            <div className="ck-status-card">
              <StatePanel
                title="Rincian pesanan belum dapat dimuat"
                description="Tidak ada pembayaran yang dibuat dari halaman ini. Silakan kembali ke katalog atau coba lagi setelah layanan pesanan tersedia."
                action={
                  <Link
                    className="ui-button ui-button--primary ui-button--md"
                    href="/templates"
                  >
                    Kembali ke katalog desain
                  </Link>
                }
              />
            </div>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (process.env.NODE_ENV === "production") {
    return <ProductionCheckoutUnavailable />;
  }

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

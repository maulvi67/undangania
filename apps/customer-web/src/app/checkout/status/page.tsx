import type { Metadata } from "next";
import Link from "next/link";
import { StatePanel } from "@wedding/ui";
import { getAuthenticatedRequest } from "../../../lib/auth/server";
import { loadOwnedPaymentStatus } from "../../../lib/checkout/server";
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

function ProductionPaymentStatusUnavailable({
  title = "Status pembayaran belum tersedia",
  description = "Pembayaran hanya dianggap berhasil setelah konfirmasi server yang terverifikasi.",
}: {
  title?: string;
  description?: string;
}) {
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
              <p className="ck-eyebrow">Konfirmasi pembayaran</p>
              <h1 className="ck-title">
                Status pembayaran sedang diverifikasi
              </h1>
              <p className="ck-lede">
                Status pembayaran belum dapat ditampilkan dari layanan produksi.
              </p>
            </header>
            <div className="ck-status-card">
              <StatePanel
                title={title}
                description={`${description} Parameter URL atau kembali dari penyedia pembayaran tidak menentukan hasil pembayaran.`}
                action={
                  <Link
                    className="ui-button ui-button--secondary ui-button--md"
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

export default async function PaymentStatusPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (process.env.NODE_ENV === "production") {
    const authenticated = await getAuthenticatedRequest();
    if (authenticated === null) {
      return (
        <ProductionPaymentStatusUnavailable
          title="Masuk untuk melihat status pembayaran"
          description="Nomor pesanan hanya dapat diperiksa oleh akun dan workspace pemilik pesanan."
        />
      );
    }

    const params = await searchParams;
    const orderNumber = first(params.order);
    if (orderNumber === undefined) {
      return <ProductionPaymentStatusUnavailable />;
    }
    const status = await loadOwnedPaymentStatus(
      authenticated.membership.tenantId,
      authenticated.user.id,
      orderNumber,
    );
    if (status === null) return <ProductionPaymentStatusUnavailable />;
    return (
      <div className="ui-shell">
        <a className="ui-skip-link" href="#konten-utama">
          Langsung ke konten utama
        </a>
        <MarketingHeader />
        <main id="konten-utama" tabIndex={-1} className="ck-page">
          <div className="ui-container">
            <PaymentStatusView
              order={status.order}
              template={{ name: status.templateName }}
              state={status.state}
            />
          </div>
        </main>
        <MarketingFooter />
      </div>
    );
  }

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

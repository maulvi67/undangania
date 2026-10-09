import type { Metadata } from "next";
import Link from "next/link";
import { StatePanel } from "@wedding/ui";
import { getAuthenticatedRequest } from "../../../lib/auth/server";
import { loadOwnedPaymentStatus } from "../../../lib/checkout/server";
import { MarketingFooter } from "../../../components/marketing/marketing-footer";
import { MarketingHeader } from "../../../components/marketing/marketing-header";
import { PaymentStatusView } from "../../../components/checkout/payment-status-view";
import "../../templates.css";
import "../checkout.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Status pembayaran — Undangania",
  description: "Periksa status pembayaran pesanan Undangania.",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function PaymentStatusUnavailable({
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
                Status pembayaran belum dapat ditampilkan.
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

/**
 * Payment status for the session's own order.
 *
 * The order number is only a lookup key: it is scoped to the authenticated
 * workspace server-side, and the state comes from the stored payment row that a
 * verified server-to-server notification updates. A redirect parameter never
 * decides the result.
 */
export default async function PaymentStatusPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const authenticated = await getAuthenticatedRequest();
  if (authenticated === null) {
    return (
      <PaymentStatusUnavailable
        title="Masuk untuk melihat status pembayaran"
        description="Nomor pesanan hanya dapat diperiksa oleh akun dan workspace pemilik pesanan."
      />
    );
  }

  const params = await searchParams;
  const orderNumber = first(params.order);
  if (orderNumber === undefined) {
    return <PaymentStatusUnavailable />;
  }

  const status = await loadOwnedPaymentStatus(
    authenticated.membership.tenantId,
    authenticated.user.id,
    orderNumber,
  );
  if (status === null) return <PaymentStatusUnavailable />;

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

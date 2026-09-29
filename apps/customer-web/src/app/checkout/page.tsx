import type { Metadata } from "next";
import Link from "next/link";
import { StatePanel } from "@wedding/ui";
import { MarketingFooter } from "../../components/marketing/marketing-footer";
import { MarketingHeader } from "../../components/marketing/marketing-header";
import { CheckoutView } from "../../components/checkout/checkout-view";
import { getTemplate } from "../../components/templates/template-data";
import { parseCheckoutState } from "../../lib/checkout/contract";
import {
  loadTemplatePriceMinor,
  previewOrder,
} from "../../lib/checkout/server";
import { ensurePackagePricePersisted } from "../../lib/templates/packages";
import "../templates.css";
import "./checkout.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Periksa pesanan — Undangania",
  description:
    "Periksa desain, harga, masa aktif, dan metode QRIS sebelum melanjutkan pembayaran.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ui-shell">
      <a className="ui-skip-link" href="#konten-utama">
        Langsung ke konten utama
      </a>
      <MarketingHeader />
      <main id="konten-utama" tabIndex={-1} className="ck-page">
        <div className="ui-container">{children}</div>
      </main>
      <MarketingFooter />
    </div>
  );
}

function NotSellable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Shell>
      <div className="ck-status-layout">
        <header className="ck-heading ck-heading--status">
          <p className="ck-eyebrow">Pesanan</p>
          <h1 className="ck-title">Pesanan belum dapat dilanjutkan</h1>
        </header>
        <div className="ck-status-card">
          <StatePanel
            title={title}
            description={description}
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
    </Shell>
  );
}

/**
 * Checkout.
 *
 * The price is read from the catalog tables — the same source `createCheckout`
 * charges from — so the figure shown here is the figure that will be billed. The
 * order itself is created only when the customer confirms; this page is a preview.
 *
 * `?state=` is honoured for the design states (loading, provider unavailable, and
 * so on), which have no server-side equivalent. It never selects a paid state: that
 * requires a payment row a verified notification wrote.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const templateId = first(params.template);

  if (templateId === undefined) {
    return (
      <NotSellable
        title="Pilih desain terlebih dahulu"
        description="Checkout dimulai dari halaman desain yang ingin Anda gunakan."
      />
    );
  }

  const record = getTemplate(templateId);
  if (record === undefined || record.status !== "ACTIVE") {
    return (
      <NotSellable
        title="Desain tidak tersedia"
        description="Desain ini sudah tidak dijual. Silakan pilih desain lain dari katalog."
      />
    );
  }

  // The price a design is sold at lives in the `Package`/`Price` tables, which the
  // catalog fixtures do not create. Syncing first is what makes the first checkout
  // after a release work without a separate seed step; it is idempotent, and a
  // database failure here falls through to the not-sellable state below rather than
  // reaching the customer as an error page.
  try {
    await ensurePackagePricePersisted(record.id);
  } catch {
    // Reported through the price lookup below, which returns null on the same
    // failure and gives the customer one consistent message.
  }

  const price = await loadTemplatePriceMinor({ templateId, at: new Date() });
  if (price === null) {
    return (
      <NotSellable
        title="Harga desain belum tersedia"
        description="Desain ini belum memiliki harga aktif sehingga pesanan belum dapat dibuat. Hubungi bantuan bila masalah berlanjut."
      />
    );
  }

  const order = previewOrder({
    templateId: record.id,
    templateName: record.name,
    templateCategory: record.category,
    templateCharacter: record.designCharacter,
    templateTierLabel: record.tier,
    unitPriceMinor: price,
    quantity: 1,
  });

  return (
    <Shell>
      <CheckoutView
        order={order}
        template={record}
        initialState={parseCheckoutState(first(params.state))}
      />
    </Shell>
  );
}

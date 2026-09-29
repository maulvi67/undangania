import type { Metadata } from "next";
import { EmptyState } from "@wedding/ui";
import { MarketingHeader } from "../../components/marketing/marketing-header";
import { MarketingFooter } from "../../components/marketing/marketing-footer";
import { LinkButton } from "../../components/marketing/link-button";
import { ActiveFilterTokens } from "../../components/catalog/active-filter-tokens";
import { CatalogFilters } from "../../components/catalog/catalog-filters";
import { CatalogResults } from "../../components/catalog/catalog-results";
import {
  applyCatalogQuery,
  hasActiveFilters,
  parseCatalogQuery,
  type RawSearchParams,
} from "../../components/catalog/catalog-query";
import {
  TEMPLATES,
  getActiveTemplates,
} from "../../components/templates/template-data";
import "../catalog.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const title = "Katalog Desain Undangan Pernikahan — Undangania";
const description =
  "Telusuri koleksi desain undangan pernikahan digital. Semua desain memiliki fitur inti yang sama — RSVP, buku tamu, galeri, dan manajemen tamu; perbedaan harga mencerminkan kompleksitas visual dan aset.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: { canonical: "/templates" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/templates",
    title,
    description,
    siteName: "Undangania",
  },
  twitter: { card: "summary" },
};

const collectionJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: title,
  inLanguage: "id-ID",
  mainEntity: {
    "@type": "ItemList",
    itemListElement: getActiveTemplates().map((template, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: template.name,
      url: `${siteUrl}/templates/${template.id}`,
    })),
  },
};

interface CatalogPageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const query = parseCatalogQuery(await searchParams);
  const active = getActiveTemplates();
  const results = applyCatalogQuery(TEMPLATES, query);

  return (
    <div className="ui-shell">
      <a className="ui-skip-link" href="#konten-utama">
        Langsung ke konten utama
      </a>
      <MarketingHeader />
      <main id="konten-utama" tabIndex={-1}>
        <div className="ui-container ctlg-page">
          <header className="ctlg-header">
            <h1>Pilih desain undangan Anda</h1>
            <p className="ctlg-lede">
              Semua desain dilengkapi fitur inti undangan digital yang sama —
              perbedaan harga antar desain hanya mencerminkan kompleksitas
              visual dan asetnya.
            </p>
          </header>

          {active.length > 0 ? (
            <>
              <CatalogFilters query={query} />
              <ActiveFilterTokens query={query} />
              {results.length > 0 ? (
                <CatalogResults templates={results} />
              ) : (
                <EmptyState
                  title="Tidak ada desain yang cocok"
                  description="Coba ubah kata kunci pencarian atau hapus filter untuk melihat seluruh koleksi."
                  action={
                    hasActiveFilters(query) ? (
                      <LinkButton href="/templates">
                        Hapus semua filter
                      </LinkButton>
                    ) : null
                  }
                />
              )}
            </>
          ) : (
            <EmptyState
              title="Koleksi belum tersedia"
              description="Koleksi desain sedang disiapkan. Silakan periksa kembali dalam waktu dekat."
              action={<LinkButton href="/">Kembali ke beranda</LinkButton>}
            />
          )}
        </div>
      </main>
      <MarketingFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingHeader } from "../../../components/marketing/marketing-header";
import { MarketingFooter } from "../../../components/marketing/marketing-footer";
import { INVITATION_ACTIVE_PERIOD } from "../../../components/marketing/pricing-explanation";
import { DevicePreview } from "../../../components/templates/device-preview";
import { StickySelectBar } from "../../../components/templates/sticky-select-bar";
import { TemplatePreview } from "../../../components/templates/template-preview";
import { LinkButton } from "../../../components/marketing/link-button";
import { signInHref } from "../../../lib/auth/redirect";
import {
  SECTION_LABELS,
  formatIdr,
  type TemplateRecord,
  type TemplateSectionId,
} from "../../../components/templates/template-contract";
import {
  getActiveTemplates,
  getTemplate,
} from "../../../components/templates/template-data";
import "../../templates.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface TemplateDetailProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return getActiveTemplates().map((template) => ({ id: template.id }));
}

export async function generateMetadata({
  params,
}: TemplateDetailProps): Promise<Metadata> {
  const { id } = await params;
  const template = getTemplate(id);
  if (!template || template.status !== "ACTIVE") {
    return { title: "Desain tidak tersedia — Undangania" };
  }
  const title = `${template.name} — Desain Undangan — Undangania`;
  const description = `${template.designCharacter} Harga final, semua fitur inti undangan termasuk.`;
  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: { canonical: `/templates/${template.id}` },
    openGraph: {
      type: "website",
      locale: "id_ID",
      url: `/templates/${template.id}`,
      title,
      description,
      siteName: "Undangania",
    },
    twitter: { card: "summary" },
  };
}

const AFTER_PURCHASE_STEPS = [
  {
    title: "Buat akun dan selesaikan pembayaran",
    body: "Pembayaran dilakukan sekali di awal; tidak ada biaya langganan.",
  },
  {
    title: "Isi detail acara lewat editor terpandu",
    body: "Editor menuntun Anda mengisi nama, tanggal, dan lokasi — tanpa keahlian desain.",
  },
  {
    title: "Pratinjau dan periksa",
    body: "Lihat hasil akhir dari sudut pandang tamu sebelum dipublikasikan.",
  },
  {
    title: "Terbitkan dan bagikan tautan",
    body: "Undangan aktif dan siap dibagikan kepada keluarga dan tamu.",
  },
] as const;

function SectionList({ sections }: { sections: readonly TemplateSectionId[] }) {
  return (
    <ul className="tpl-sectionlist">
      {sections.map((section) => (
        <li key={section}>{SECTION_LABELS[section]}</li>
      ))}
    </ul>
  );
}

function PriceCard({ template }: { template: TemplateRecord }) {
  return (
    <div className="tpl-price">
      {template.priceIdr !== null ? (
        <>
          <p className="tpl-price__amount">{formatIdr(template.priceIdr)}</p>
          <p className="tpl-price__note">
            Harga final — dibayar sekali, tanpa biaya tambahan yang muncul
            belakangan.
          </p>
        </>
      ) : (
        <p className="tpl-price__unavailable">
          Harga untuk desain ini sedang diperbarui. Silakan periksa kembali
          nanti.
        </p>
      )}
      <ul className="tpl-price__includes">
        <li>Semua fitur inti undangan digital</li>
        <li>Masa aktif: {INVITATION_ACTIVE_PERIOD}</li>
        <li>Pratinjau sebelum publikasi</li>
      </ul>
    </div>
  );
}

export default async function TemplateDetailPage({
  params,
}: TemplateDetailProps) {
  const { id } = await params;
  const template = getTemplate(id);
  if (!template || template.status !== "ACTIVE") {
    notFound();
  }

  return (
    <div className="ui-shell">
      <a className="ui-skip-link" href="#konten-utama">
        Langsung ke konten utama
      </a>
      <MarketingHeader />
      <main id="konten-utama" tabIndex={-1}>
        <div className="ui-container tpl-page">
          <Link className="tpl-backlink" href="/templates">
            ← Kembali ke katalog desain
          </Link>

          <div className="tpl-page__preview-col">
            <DevicePreview>
              <TemplatePreview template={template} />
            </DevicePreview>
          </div>

          <div className="tpl-info">
            <header>
              <p className="tpl-info__eyebrow">
                Desain {template.category} · {template.name}
              </p>
              <h1 className="tpl-info__title">{template.name}</h1>
              <p className="tpl-info__character">{template.designCharacter}</p>
            </header>

            <section
              className="tpl-block"
              aria-labelledby="tpl-character-title"
            >
              <h2 className="tpl-block__title" id="tpl-character-title">
                Karakter desain
              </h2>
              <p className="tpl-block__body">{template.designStory}</p>
            </section>

            <section className="tpl-block" aria-labelledby="tpl-sections-title">
              <h2 className="tpl-block__title" id="tpl-sections-title">
                Bagian undangan yang didukung
              </h2>
              <SectionList sections={template.sections} />
              <p className="tpl-block__body">
                Semua desain memiliki fitur inti yang sama — daftar di atas
                adalah bagian undangan yang disusun oleh desain ini.
              </p>
            </section>

            <section className="tpl-block" aria-labelledby="tpl-price-title">
              <h2 className="tpl-block__title" id="tpl-price-title">
                Harga
              </h2>
              <PriceCard template={template} />
            </section>

            <section className="tpl-block" aria-labelledby="tpl-next-title">
              <h2 className="tpl-block__title" id="tpl-next-title">
                Setelah memilih desain ini
              </h2>
              <ol className="tpl-steps">
                {AFTER_PURCHASE_STEPS.map((step) => (
                  <li key={step.title}>
                    <p className="tpl-steps__text">
                      <strong>{step.title}</strong>
                      {step.body}
                    </p>
                  </li>
                ))}
              </ol>
              <p className="tpl-block__body">
                Masa aktif undangan: {INVITATION_ACTIVE_PERIOD}. Sebelum masa
                aktif berakhir, Anda dapat mengunduh data tamu dan buku tamu.
              </p>
            </section>

            <div className="tpl-ctas">
              {template.demo.available ? (
                <LinkButton
                  href={`/templates/${template.id}/demo`}
                  variant="secondary"
                >
                  Lihat demo undangan
                </LinkButton>
              ) : (
                <p className="tpl-ctas__demo-unavailable">
                  Demo undangan untuk desain ini sedang disiapkan.
                </p>
              )}
              {template.priceIdr !== null ? (
                <LinkButton
                  href={signInHref(
                    `/checkout?template=${encodeURIComponent(template.id)}`,
                  )}
                  variant="primary"
                >
                  Pilih desain
                </LinkButton>
              ) : null}
              <p className="tpl-ctas__note">
                Anda akan diminta membuat akun terlebih dahulu sebelum
                melanjutkan.
              </p>
            </div>
          </div>
        </div>
        <StickySelectBar template={template} />
      </main>
      <MarketingFooter />
    </div>
  );
}

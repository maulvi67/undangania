import Link from "next/link";
import { EmptyState } from "@wedding/ui";
import { LinkButton } from "./link-button";
import { TemplatePreview } from "../templates/template-preview";
import { TIER_LABELS, formatIdr } from "../templates/template-contract";
import { getActiveTemplates } from "../templates/template-data";

/**
 * Featured collection.
 *
 * Reads the real catalog fixtures instead of a landing-only sample, so the
 * names, character copy, tiers, and prices shown here are the same values the
 * customer sees in the catalog. Every tile links to its detail page — the
 * previous version rendered non-interactive tiles whose only onward path was
 * a trailing text link.
 */
export function FeaturedTemplates() {
  const templates = getActiveTemplates().slice(0, 3);

  return (
    <section
      className="lnd-section lnd-stagger-host"
      aria-labelledby="koleksi-title"
      id="koleksi"
    >
      <div className="ui-container lnd-stagger">
        <header className="lnd-head">
          <p className="lnd-eyebrow">Koleksi</p>
          <h2 className="lnd-head__title" id="koleksi-title">
            Arah desain yang bisa Anda pilih
          </h2>
          <p className="lnd-lede">
            Setiap desain memakai fitur inti yang sama. Yang berbeda adalah
            karakter visual dan tingkat detailnya — bukan kelengkapan fungsinya.
          </p>
        </header>
        {templates.length > 0 ? (
          <ul className="lnd-tiles lnd-cascade">
            {templates.map((template) => (
              <li key={template.id} className="lnd-tile">
                <div className="lnd-tile__preview">
                  <TemplatePreview template={template} />
                </div>
                <div className="lnd-tile__body">
                  <p className="lnd-tile__eyebrow">
                    Desain {template.category}
                  </p>
                  <h3 className="lnd-tile__title">
                    <Link href={`/templates/${template.id}`}>
                      {template.name}
                    </Link>
                  </h3>
                  <p className="lnd-tile__character">
                    {template.designCharacter}
                  </p>
                  {template.priceIdr !== null ? (
                    <p className="lnd-tile__price">
                      <span className="lnd-tile__amount">
                        {formatIdr(template.priceIdr)}
                      </span>
                      <span className="lnd-tile__tier">
                        {TIER_LABELS[template.tier]}
                      </span>
                    </p>
                  ) : null}
                  <div className="lnd-tile__actions">
                    <LinkButton
                      href={`/templates/${template.id}`}
                      variant="secondary"
                      size="sm"
                    >
                      Lihat detail desain
                    </LinkButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Koleksi sedang disiapkan"
            description="Katalog desain akan tersedia dalam waktu dekat. Silakan kembali lagi nanti."
          />
        )}
        <p className="lnd-section__tail">
          <Link className="lnd-textlink" href="/templates">
            Lihat semua desain
          </Link>
        </p>
      </div>
    </section>
  );
}

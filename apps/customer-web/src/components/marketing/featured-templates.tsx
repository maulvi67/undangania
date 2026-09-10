import { Badge, EmptyState } from "@wedding/ui";
import { FEATURED_TEMPLATES } from "./featured-templates-data";
import { InvitationPreviewCard } from "./invitation-preview-card";

export function FeaturedTemplates() {
  return (
    <section className="lnd-section" aria-labelledby="koleksi-title" id="koleksi">
      <div className="ui-container">
        <header className="lnd-section__head">
          <p className="lnd-eyebrow">
            Koleksi <Badge tone="neutral">Ilustrasi</Badge>
          </p>
          <h2 className="lnd-section__title" id="koleksi-title">
            Arah desain yang bisa Anda pilih
          </h2>
          <p className="lnd-lede">
            Tiga arah desain berikut menggambarkan karakter koleksi kami. Pratinjau bersifat
            ilustratif; koleksi lengkap ada di katalog.
          </p>
        </header>
        {FEATURED_TEMPLATES.length > 0 ? (
          <ul className="lnd-tiles">
            {FEATURED_TEMPLATES.map((template) => (
              <li key={template.id} className="lnd-tile">
                <InvitationPreviewCard variant={template.preview} />
                <h3 className="lnd-tile__title">{template.name}</h3>
                <p className="lnd-tile__desc">{template.character}</p>
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
          <a className="lnd-textlink" href="/templates">
            Lihat semua desain
          </a>
        </p>
      </div>
    </section>
  );
}

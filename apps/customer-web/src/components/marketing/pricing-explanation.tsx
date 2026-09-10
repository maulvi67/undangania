/**
 * Lifecycle copy for the invitation active period.
 * TODO(product): confirm the exact policy wording with the Product Manager —
 * the duration below is the proposed default and is the single source of
 * truth for both the pricing section and the FAQ.
 */
export const INVITATION_ACTIVE_PERIOD =
  "Undangan Anda aktif mulai saat dipublikasikan hingga 30 hari setelah tanggal acara. " +
  "Sebelum masa aktif berakhir, Anda dapat mengunduh data tamu dan buku tamu.";

const ALWAYS_INCLUDED = [
  "Semua fitur inti undangan",
  "Masa aktif undangan yang jelas",
  "Pratinjau sebelum publikasi",
  "Harga final yang tertera di katalog",
] as const;

export function PricingExplanation() {
  return (
    <section className="lnd-section" aria-labelledby="harga-title" id="harga">
      <div className="ui-container">
        <header className="lnd-section__head">
          <p className="lnd-eyebrow">Harga</p>
          <h2 className="lnd-section__title" id="harga-title">
            Harga mencerminkan desain, bukan fitur
          </h2>
          <p className="lnd-lede">
            Perbedaan harga antar desain berasal dari kompleksitas visual, aset, dan lisensi
            desainnya — bukan dari kelengkapan fitur.
          </p>
        </header>
        <div className="lnd-pricing">
          <div className="lnd-pricing__body">
            <p>
              Undangan dengan desain yang sederhana bekerja sama baiknya dengan desain yang paling
              detail. Anda memilih desain karena selera dan karakter perayaan Anda — bukan karena
              fitur.
            </p>
            <p>
              Harga setiap desain tertera di katalog sebelum Anda memutuskan. Tidak ada biaya yang
              muncul belakangan.
            </p>
            <p className="lnd-pricing__period">
              <span className="lnd-pricing__period-label">Masa aktif undangan</span>
              {INVITATION_ACTIVE_PERIOD}
            </p>
          </div>
          <aside className="lnd-pricing__panel" aria-label="Yang selalu termasuk">
            <h3 className="lnd-pricing__panel-title">Selalu termasuk</h3>
            <ul className="lnd-checklist">
              {ALWAYS_INCLUDED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}

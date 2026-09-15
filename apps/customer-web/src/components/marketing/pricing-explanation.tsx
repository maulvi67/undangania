import { IconCheck } from "@wedding/ui";
import { LinkButton } from "./link-button";
import { formatIdr } from "../templates/template-contract";
import { getActiveTemplates } from "../templates/template-data";

/**
 * Lifecycle copy for the invitation active period.
 * Single source of truth for the pricing section and the FAQ.
 *
 * TODO(product): confirm the exact policy wording with the Product Manager —
 * the duration below is the proposed default.
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

/**
 * Price range derived from the live catalog fixtures, so the landing page can
 * never advertise a number the catalog does not offer. Returns null when no
 * priced template is available, and the copy falls back to a range-free
 * sentence rather than inventing a figure.
 */
function priceRange(): { min: number; max: number } | null {
  const prices = getActiveTemplates()
    .map((template) => template.priceIdr)
    .filter((price): price is number => price !== null);

  if (prices.length === 0) return null;

  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function PricingExplanation() {
  const range = priceRange();

  return (
    <section className="lnd-section" aria-labelledby="harga-title" id="harga">
      <div className="ui-container">
        <header className="lnd-head">
          <p className="lnd-eyebrow">Harga</p>
          <h2 className="lnd-head__title" id="harga-title">
            Harga mencerminkan desain, bukan fitur
          </h2>
          <p className="lnd-lede">
            Perbedaan harga antar desain berasal dari kompleksitas visual, aset,
            dan lisensi desainnya — bukan dari kelengkapan fitur.
          </p>
        </header>
        <div className="lnd-pricing">
          <div className="lnd-pricing__body">
            <p>
              Undangan dengan desain yang sederhana bekerja sama baiknya dengan
              desain yang paling detail. Anda memilih desain karena selera dan
              karakter perayaan Anda — bukan karena fitur.
            </p>
            {range !== null ? (
              <p className="lnd-pricing__range">
                <span className="lnd-pricing__range-label">
                  Rentang harga koleksi saat ini
                </span>
                <span className="lnd-pricing__range-value">
                  {formatIdr(range.min)}–{formatIdr(range.max)}
                </span>
              </p>
            ) : null}
            <p>
              Harga setiap desain tertera di katalog sebelum Anda memutuskan.
              Tidak ada biaya yang muncul belakangan.
            </p>
            <p className="lnd-pricing__period">
              <span className="lnd-pricing__period-label">
                Masa aktif undangan
              </span>
              {INVITATION_ACTIVE_PERIOD}
            </p>
          </div>
          <aside className="lnd-panel" aria-label="Yang selalu termasuk">
            <h3 className="lnd-panel__title">Selalu termasuk</h3>
            <ul className="lnd-panel__list">
              {ALWAYS_INCLUDED.map((item) => (
                <li key={item} className="lnd-panel__row">
                  <IconCheck className="lnd-panel__mark" />
                  <span className="lnd-panel__label">{item}</span>
                </li>
              ))}
            </ul>
            <p className="lnd-section__tail">
              <LinkButton href="/templates" variant="secondary" size="sm">
                Bandingkan harga di katalog
              </LinkButton>
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}

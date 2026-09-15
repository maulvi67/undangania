import {
  LOCALE_OPTIONS,
  formatEventLine,
  formatWeddingDate,
  type OnboardingData,
} from "../../lib/onboarding/contract";

type SummaryCardProps = {
  data: OnboardingData;
  title?: string;
  /** Hanya pada langkah 3: tautan "Ubah" kembali ke langkah 1/2. */
  onEditStep?: (step: 1 | 2) => void;
};

function partnerNames(data: OnboardingData): string {
  const names = [data.partner1Name.trim(), data.partner2Name.trim()].filter(
    (name) => name !== "",
  );
  return names.length > 0 ? names.join(" & ") : "—";
}

/**
 * Ringkasan baca-saja yang dipakai di tiga tempat: langkah 3 (dengan
 * tombol Ubah), panel konflik (draf server), dan layar selesai.
 */
export function SummaryCard({ data, title, onEditStep }: SummaryCardProps) {
  const location = [data.venueName.trim(), data.city.trim()]
    .filter((part) => part !== "")
    .join(", ");
  const localeLabel =
    LOCALE_OPTIONS.find((option) => option.value === data.locale)?.label ??
    data.locale;
  const address = data.venueAddress.trim();

  return (
    <section className="onb-summary" aria-label={title ?? "Ringkasan isian"}>
      {title ? <h2 className="onb-summary__title">{title}</h2> : null}
      <dl className="onb-summary__list">
        <div className="onb-summary__row">
          <dt className="onb-summary__term">Mempelai</dt>
          <dd className="onb-summary__value">{partnerNames(data)}</dd>
        </div>
        <div className="onb-summary__row">
          <dt className="onb-summary__term">Tanggal pernikahan</dt>
          <dd className="onb-summary__value">
            {formatWeddingDate(data, data.locale)}
          </dd>
        </div>
        <div className="onb-summary__row">
          <dt className="onb-summary__term">Acara pertama</dt>
          <dd className="onb-summary__value">
            {formatEventLine(data, data.locale)}
            {location !== "" ? (
              <>
                <br />
                {location}
              </>
            ) : null}
            {address !== "" ? (
              <>
                <br />
                {address}
              </>
            ) : null}
          </dd>
        </div>
        <div className="onb-summary__row">
          <dt className="onb-summary__term">Bahasa undangan</dt>
          <dd className="onb-summary__value">{localeLabel}</dd>
        </div>
      </dl>
      {onEditStep ? (
        <div className="onb-summary__edits">
          <button
            type="button"
            className="onb-summary__edit"
            onClick={() => onEditStep(1)}
          >
            Ubah data mempelai
          </button>
          <button
            type="button"
            className="onb-summary__edit"
            onClick={() => onEditStep(2)}
          >
            Ubah data acara
          </button>
        </div>
      ) : null}
    </section>
  );
}

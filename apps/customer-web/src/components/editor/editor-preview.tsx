import type { InvitationViewModel } from "@wedding/template-engine";
import type { EditorTemplate } from "../../lib/editor/contract";

function parseLocalDateTime(value: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  if (!year || !month || !day || !hour || !minute) return null;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
}

function formatDate(value: string, locale: string): string {
  const parts = parseLocalDateTime(value);
  if (!parts) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}

function formatTime(value: string, locale: string): string {
  const parts = parseLocalDateTime(value);
  if (!parts) return value;
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, parts.hour, parts.minute)));
}

export function EditorPreview({
  model,
  template,
  mode,
}: {
  model: InvitationViewModel;
  template: EditorTemplate;
  mode: "phone" | "desktop";
}) {
  const couple = model.couple.displayNames || "Undangan Pernikahan";
  const visibleSections = model.sections.filter((section) => section.visible);
  return (
    <div className={`ed-device ed-device--${mode}`}>
      <div className="ed-device__chrome" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <article
        className="ed-invitation"
        aria-label={`Pratinjau undangan ${couple}`}
      >
        <section className="ed-invitation__hero">
          <p className="ed-invitation__eyebrow">
            {template.manifest.category} · Pratinjau draf
          </p>
          <h2>{couple}</h2>
          <span className="ed-invitation__rule" aria-hidden="true" />
          <p>
            {model.events[0]
              ? formatDate(model.events[0].startsAt, model.locale)
              : "Tanggal acara belum diisi"}
          </p>
        </section>
        {visibleSections.map((section) => {
          if (section.type === "hero") return null;
          if (section.type === "couple") {
            return (
              <section className="ed-invitation__section" key={section.id}>
                <p className="ed-invitation__section-label">Tentang kami</p>
                <h3>{couple}</h3>
                <p>
                  {typeof section.payload.body === "string" &&
                  section.payload.body
                    ? section.payload.body
                    : "Cerita singkat Anda akan tampil di sini."}
                </p>
              </section>
            );
          }
          if (section.type === "events" || section.type === "venue") {
            return (
              <section className="ed-invitation__section" key={section.id}>
                <p className="ed-invitation__section-label">Rangkaian acara</p>
                <h3>Hari bahagia kami</h3>
                <ul className="ed-invitation__events">
                  {model.events.map((event) => (
                    <li key={event.id}>
                      <strong>{event.title}</strong>
                      <span>{formatDate(event.startsAt, model.locale)}</span>
                      <span>
                        {formatTime(event.startsAt, model.locale)} ·{" "}
                        {event.venueName || "Lokasi menyusul"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          }
          if (section.type === "story") {
            return (
              <section className="ed-invitation__section" key={section.id}>
                <p className="ed-invitation__section-label">Kisah kami</p>
                <h3>
                  {typeof section.payload.title === "string" &&
                  section.payload.title
                    ? section.payload.title
                    : "Kisah kami"}
                </h3>
                <p>
                  {typeof section.payload.body === "string" &&
                  section.payload.body
                    ? section.payload.body
                    : "Kisah Anda akan tampil di sini."}
                </p>
              </section>
            );
          }
          if (section.type === "cover" || section.type === "gallery") {
            return (
              <section className="ed-invitation__section" key={section.id}>
                <p className="ed-invitation__section-label">
                  {section.type === "cover" ? "Sampul" : "Galeri"}
                </p>
                <div className="ed-invitation__media-placeholder">
                  {model.sections.some(
                    (item) =>
                      item.type === section.type &&
                      item.payload.assetIds?.length,
                  )
                    ? "Media siap ditampilkan"
                    : "Tambahkan foto untuk mengisi bagian ini"}
                </div>
              </section>
            );
          }
          if (section.type === "music") {
            return (
              <section className="ed-invitation__section" key={section.id}>
                <p className="ed-invitation__section-label">Musik</p>
                <p>
                  {section.payload.enabled
                    ? "Musik tersedia bagi tamu untuk diputar secara manual."
                    : "Musik belum diaktifkan."}
                </p>
              </section>
            );
          }
          if (section.type === "gift") {
            return (
              <section className="ed-invitation__section" key={section.id}>
                <p className="ed-invitation__section-label">Tanda kasih</p>
                <p>
                  Informasi hadiah dapat ditampilkan di sini bila Anda
                  mengaktifkannya.
                </p>
              </section>
            );
          }
          if (section.type === "faq") {
            return (
              <section className="ed-invitation__section" key={section.id}>
                <p className="ed-invitation__section-label">Pertanyaan umum</p>
                <p>Jawaban untuk pertanyaan tamu akan tampil di sini.</p>
              </section>
            );
          }
          return null;
        })}
        <footer className="ed-invitation__footer">
          Data contoh dan draf hanya terlihat oleh Anda.
        </footer>
      </article>
    </div>
  );
}

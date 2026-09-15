import type { TemplateRecord, TemplateSectionId } from "../template-contract";
import { themeClasses } from "../theme-classes";
import { RsvpForm } from "./rsvp-form";

/**
 * Full synthetic invitation demo themed by allowlisted template tokens.
 * Every value here is sample data ("Rai & Anisa"), the same illustrative
 * couple used across the landing page — never a real customer.
 */

const SAMPLE_WISHES = [
  {
    name: "Tante Dewi",
    text: "Selamat menempuh hidup baru! Semoga sakinah dan bahagia selalu.",
  },
  {
    name: "Bagas",
    text: "Turut berbahagia untuk kalian berdua. Sampai jumpa di resepsi!",
  },
  {
    name: "Keluarga Rahmadi",
    text: "Barakallahu lakuma. Doa terbaik untuk keluarga baru kalian.",
  },
] as const;

export function DemoInvitation({ template }: { template: TemplateRecord }) {
  const has = (section: TemplateSectionId) =>
    template.sections.includes(section);

  return (
    <div className={`${themeClasses(template)} dmv`}>
      {has("hero") ? (
        <section
          className="dmv__section dmv__hero"
          aria-label="Pembuka undangan"
        >
          <p className="dmv__eyebrow">
            {template.category === "Tradisi"
              ? "Walimatul Urs"
              : "Undangan Pernikahan"}
          </p>
          <h2 className="dmv__names">
            Rai <span className="dmv__amp">&amp;</span> Anisa
          </h2>
          <span className="dmv__rule" />
          <p className="dmv__date">Sabtu, 12 September 2026</p>
        </section>
      ) : null}

      {has("couple") ? (
        <section className="dmv__section" aria-labelledby="dmv-couple-title">
          <h3 className="dmv__heading" id="dmv-couple-title">
            Rai &amp; Anisa
          </h3>
          <p className="dmv__body">
            Dengan memohon rahmat dan ridha Tuhan, kami mengundang Anda untuk
            menghadiri pernikahan kami — dua keluarga besar yang bertemu di satu
            hari bahagia.
          </p>
        </section>
      ) : null}

      {has("events") ? (
        <section className="dmv__section" aria-labelledby="dmv-events-title">
          <h3 className="dmv__heading" id="dmv-events-title">
            Rangkaian acara
          </h3>
          <ul className="dmv__events">
            <li className="dmv__event">
              <p className="dmv__event-name">Akad Nikah</p>
              <p className="dmv__event-time">
                Sabtu, 12 September 2026 · 08.00 – 10.00 WIB
              </p>
              <p className="dmv__event-venue">Masjid Agung Contoh, Jakarta</p>
            </li>
            <li className="dmv__event">
              <p className="dmv__event-name">Resepsi</p>
              <p className="dmv__event-time">
                Sabtu, 12 September 2026 · 11.00 – 14.00 WIB
              </p>
              <p className="dmv__event-venue">Balai Kartini Contoh, Jakarta</p>
            </li>
          </ul>
          <p className="dmv__rsvp-note">
            Nama dan lokasi pada demo ini adalah data contoh.
          </p>
        </section>
      ) : null}

      {has("gallery") ? (
        <section className="dmv__section" aria-labelledby="dmv-gallery-title">
          <h3 className="dmv__heading" id="dmv-gallery-title">
            Galeri
          </h3>
          <div className="dmv__gallery" aria-hidden="true">
            <div className="dmv__figure" />
            <div className="dmv__figure" />
            <div className="dmv__figure" />
            <div className="dmv__figure" />
          </div>
          <p className="dmv__rsvp-note">
            Pada undangan sungguhan, bagian ini menampilkan foto pra-pernikahan
            Anda.
          </p>
        </section>
      ) : null}

      {has("gift") ? (
        <section className="dmv__section" aria-labelledby="dmv-gift-title">
          <h3 className="dmv__heading" id="dmv-gift-title">
            Tanda kasih
          </h3>
          <p className="dmv__body">
            Kehadiran dan doa Anda adalah hadiah terbaik bagi kami. Apabila
            berkenan memberi tanda kasih, informasi pengirimannya tersedia di
            undangan sungguhan.
          </p>
        </section>
      ) : null}

      {has("guestbook") ? (
        <section className="dmv__section" aria-labelledby="dmv-guestbook-title">
          <h3 className="dmv__heading" id="dmv-guestbook-title">
            Buku tamu
          </h3>
          <ul className="dmv__guestbook">
            {SAMPLE_WISHES.map((wish) => (
              <li className="dmv__wish" key={wish.name}>
                <p className="dmv__wish-name">{wish.name}</p>
                <p className="dmv__wish-text">{wish.text}</p>
              </li>
            ))}
          </ul>
          <p className="dmv__rsvp-note">Ucapan di atas adalah contoh.</p>
        </section>
      ) : null}

      {has("rsvp") ? (
        <section className="dmv__section" aria-labelledby="dmv-rsvp-title">
          <h3 className="dmv__heading" id="dmv-rsvp-title">
            Konfirmasi kehadiran
          </h3>
          <RsvpForm />
        </section>
      ) : null}

      {has("closing") ? (
        <section
          className="dmv__section dmv__closing"
          aria-label="Penutup undangan"
        >
          <p className="dmv__body">
            Merupakan suatu kehormatan bila Anda berkenan hadir.
          </p>
          <p className="dmv__closing-names">Rai &amp; Anisa</p>
        </section>
      ) : null}
    </div>
  );
}

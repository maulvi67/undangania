import * as React from "react";
import type {
  InvitationSectionType,
  InvitationViewModel,
  TemplateManifest,
  TemplateRenderer,
} from "@wedding/template-engine";
import type { ReactNode } from "react";
import { Countdown } from "./countdown";

export const SERUNI_MANIFEST: TemplateManifest = {
  id: "seruni-klasik",
  version: "1",
  contractVersion: 1,
  name: "Seruni",
  category: "Klasik",
  supportedSections: [
    "hero",
    "couple",
    "events",
    "venue",
    "cover",
    "story",
    "gallery",
    "music",
    "gift",
    "faq",
    "guestbook",
    "rsvp",
    "closing",
  ],
  requiredSections: ["hero", "couple", "events", "closing"],
  reorderableSections: [
    "story",
    "gallery",
    "music",
    "gift",
    "faq",
    "guestbook",
  ],
  sectionOrder: [
    "hero",
    "couple",
    "events",
    "venue",
    "cover",
    "story",
    "gallery",
    "music",
    "gift",
    "faq",
    "guestbook",
    "rsvp",
    "closing",
  ],
};

type InvitationSection = InvitationViewModel["sections"][number];
type Event = InvitationViewModel["events"][number];
type Item = Record<string, unknown>;

function isRecord(value: unknown): value is Item {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sectionOf(
  model: InvitationViewModel,
  type: InvitationSectionType,
): InvitationSection | undefined {
  return model.sections.find((section) => section.type === type);
}

function isVisible(
  model: InvitationViewModel,
  type: InvitationSectionType,
): boolean {
  return sectionOf(model, type)?.visible === true;
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function sectionText(
  section: InvitationSection | undefined,
  key: "title" | "body",
  fallback: string,
): string {
  return textValue(section?.payload[key], fallback);
}

function sectionItems(section: InvitationSection | undefined): readonly Item[] {
  return (section?.payload.items ?? []).filter(isRecord);
}

function itemText(item: Item, key: string, fallback = ""): string {
  return textValue(item[key], fallback);
}

function parseLocalDateTime(
  value: string,
): [number, number, number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  if (!year || !month || !day || !hour || !minute) return null;
  return [
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
  ];
}

function formatDate(value: string, locale: string): string {
  const parts = parseLocalDateTime(value);
  if (!parts) return value;
  const [year, month, day] = parts;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatTime(value: string, locale: string): string {
  const parts = parseLocalDateTime(value);
  if (!parts) return value;
  const [, , , hour, minute] = parts;
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

function timezoneLabel(timezone: string): string {
  if (timezone === "Asia/Jakarta") return "WIB";
  if (timezone === "Asia/Makassar") return "WITA";
  if (timezone === "Asia/Jayapura") return "WIT";
  return timezone;
}

function safeExternalHref(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function eventDateTime(event: Event, locale: string): string {
  const date = formatDate(event.startsAt, locale);
  const start = formatTime(event.startsAt, locale);
  const end = event.endsAt ? `–${formatTime(event.endsAt, locale)}` : "";
  return `${date} · ${start}${end} ${timezoneLabel(event.timezone ?? "")}`;
}

function TextBlock({ children }: { children: string }) {
  return <p className="gld-copy">{children}</p>;
}

function CoupleSection({ model }: { model: InvitationViewModel }) {
  const section = sectionOf(model, "couple");
  if (!section?.visible) return null;
  return (
    <section
      className="gld-section gld-section--couple"
      aria-labelledby="gld-couple-title"
    >
      <p className="gld-kicker">Tentang kami</p>
      <h2 id="gld-couple-title">{model.couple.displayNames}</h2>
      <TextBlock>
        {sectionText(
          section,
          "body",
          "Dengan penuh syukur, kami mengundang Anda untuk hadir di hari bahagia kami.",
        )}
      </TextBlock>
      <div className="gld-signature" aria-hidden="true">
        <span>R</span>
        <span>&amp;</span>
        <span>B</span>
      </div>
    </section>
  );
}

function EventsSection({ model }: { model: InvitationViewModel }) {
  if (!isVisible(model, "events") && !isVisible(model, "venue")) return null;
  const section = sectionOf(model, "events");
  return (
    <section className="gld-section" aria-labelledby="gld-events-title">
      <p className="gld-kicker">Hari yang kami nantikan</p>
      <h2 id="gld-events-title">
        {sectionText(section, "title", "Rangkaian acara")}
      </h2>
      <ol className="gld-events">
        {model.events.map((event, index) => {
          const href = safeExternalHref(event.mapUrl);
          return (
            <li className="gld-event" key={event.id}>
              <span className="gld-event__number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="gld-event__body">
                <h3>{event.title}</h3>
                <p className="gld-event__date">
                  <time dateTime={event.startsAt}>
                    {eventDateTime(event, model.locale)}
                  </time>
                </p>
                <p className="gld-event__venue">
                  {event.venueName || "Lokasi menyusul"}
                </p>
                {event.address ? (
                  <p className="gld-event__address">{event.address}</p>
                ) : null}
                {href ? (
                  <a className="gld-link" href={href}>
                    Buka peta <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <p className="gld-muted">Tautan peta belum tersedia.</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StorySection({ model }: { model: InvitationViewModel }) {
  const section = sectionOf(model, "story");
  const body = sectionText(section, "body", "");
  if (!section?.visible || body.trim() === "") return null;
  return (
    <section
      className="gld-section gld-section--story"
      aria-labelledby="gld-story-title"
    >
      <p className="gld-kicker">Sepenggal cerita</p>
      <h2 id="gld-story-title">
        {sectionText(section, "title", "Kisah kami")}
      </h2>
      <TextBlock>{body}</TextBlock>
    </section>
  );
}

function GallerySection({ model }: { model: InvitationViewModel }) {
  const section = sectionOf(model, "gallery");
  if (!section?.visible) return null;
  const assetIds = section.payload.assetIds ?? [];
  if (assetIds.length === 0) return null;
  return (
    <section className="gld-section" aria-labelledby="gld-gallery-title">
      <p className="gld-kicker">Momen yang disimpan</p>
      <h2 id="gld-gallery-title">{sectionText(section, "title", "Galeri")}</h2>
      <ol
        className="gld-gallery"
        aria-label={`Galeri foto ${model.couple.displayNames}`}
      >
        {assetIds.map((assetId, index) => (
          <li key={assetId}>
            <span
              className={`gld-gallery__tile gld-gallery__tile--${(index % 6) + 1}`}
              aria-label={`Foto ${index + 1}`}
              role="img"
            />
          </li>
        ))}
      </ol>
      <p className="gld-muted">
        Foto-foto pilihan kami akan mengisi ruang ini.
      </p>
    </section>
  );
}

function GiftSection({ model }: { model: InvitationViewModel }) {
  const section = sectionOf(model, "gift");
  const items = sectionItems(section);
  if (!section?.visible || items.length === 0) return null;
  return (
    <section className="gld-section" aria-labelledby="gld-gift-title">
      <p className="gld-kicker">Tanda kasih</p>
      <h2 id="gld-gift-title">
        {sectionText(section, "title", "Tanda kasih")}
      </h2>
      <TextBlock>
        Kehadiran dan doa Anda adalah hadiah terbaik bagi kami.
      </TextBlock>
      <ul className="gld-gifts">
        {items.map((item, index) => (
          <li
            className="gld-gift"
            key={`${itemText(item, "provider", "rekening")}-${index}`}
          >
            <p className="gld-gift__provider">
              {itemText(item, "provider", "Informasi rekening")}
            </p>
            <p className="gld-gift__account">
              {itemText(item, "accountName", model.couple.displayNames)}
            </p>
            <p className="gld-gift__value">
              {itemText(
                item,
                "accountValue",
                "Informasi tersedia setelah konfirmasi",
              )}
            </p>
            {itemText(item, "note") ? (
              <p className="gld-muted">{itemText(item, "note")}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function GuestbookSection({ model }: { model: InvitationViewModel }) {
  const section = sectionOf(model, "guestbook");
  if (!section?.visible) return null;
  const items = sectionItems(section);
  return (
    <section className="gld-section" aria-labelledby="gld-guestbook-title">
      <p className="gld-kicker">Doa dan ucapan</p>
      <h2 id="gld-guestbook-title">
        {sectionText(section, "title", "Buku tamu")}
      </h2>
      {items.length > 0 ? (
        <ul className="gld-wishes">
          {items.map((item, index) => (
            <li
              className="gld-wish"
              key={`${itemText(item, "name", "tamu")}-${index}`}
            >
              <p className="gld-wish__text">
                “{itemText(item, "text", "Semoga bahagia selalu.")}”
              </p>
              <p className="gld-wish__name">
                {itemText(item, "name", "Tamu undangan")}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <TextBlock>Bagikan doa dan ucapan hangat Anda untuk kami.</TextBlock>
      )}
    </section>
  );
}

function FaqSection({ model }: { model: InvitationViewModel }) {
  const section = sectionOf(model, "faq");
  const items = sectionItems(section);
  if (!section?.visible || items.length === 0) return null;
  return (
    <section
      className="gld-section gld-section--faq"
      aria-labelledby="gld-faq-title"
    >
      <p className="gld-kicker">Untuk membantu persiapan Anda</p>
      <h2 id="gld-faq-title">
        {sectionText(section, "title", "Pertanyaan umum")}
      </h2>
      <div className="gld-faq">
        {items.map((item, index) => (
          <details key={`${itemText(item, "question", "pertanyaan")}-${index}`}>
            <summary>{itemText(item, "question", "Pertanyaan")}</summary>
            <p>
              {itemText(
                item,
                "answer",
                "Informasi akan kami sampaikan segera.",
              )}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function RsvpSection({ model }: { model: InvitationViewModel }) {
  const section = sectionOf(model, "rsvp");
  if (!section?.visible) return null;
  return (
    <div
      className="gld-section gld-section--rsvp"
      aria-labelledby="gld-rsvp-title"
    >
      <p className="gld-kicker">Kehadiran Anda berarti</p>
      <h2 id="gld-rsvp-title">
        {sectionText(section, "title", "Konfirmasi kehadiran")}
      </h2>
      <TextBlock>
        Mohon konfirmasi kehadiran agar kami dapat menyiapkan hari ini dengan
        baik.
      </TextBlock>
      <a className="gld-button" href="#rsvp">
        Konfirmasi kehadiran <span aria-hidden="true">→</span>
      </a>
      <p className="gld-muted">
        Tautan konfirmasi pada undangan terbit akan terhubung ke buku tamu Anda.
      </p>
    </div>
  );
}

function ClosingSection({ model }: { model: InvitationViewModel }) {
  const section = sectionOf(model, "closing");
  if (!section?.visible) return null;
  return (
    <footer className="gld-closing" aria-labelledby="gld-closing-title">
      <p className="gld-kicker">Dengan cinta</p>
      <h2 id="gld-closing-title">
        {sectionText(section, "title", "Sampai jumpa")}
      </h2>
      <TextBlock>
        {sectionText(
          section,
          "body",
          "Merupakan suatu kehormatan bagi kami apabila Anda berkenan hadir.",
        )}
      </TextBlock>
      <p className="gld-closing__names">{model.couple.displayNames}</p>
    </footer>
  );
}

function OptionalMusicSection({ model }: { model: InvitationViewModel }) {
  const section = sectionOf(model, "music");
  if (!section?.visible) return null;
  const url = safeExternalHref(textValue(section.payload.url));
  return (
    <section className="gld-section" aria-labelledby="gld-music-title">
      <p className="gld-kicker">Suasana pilihan</p>
      <h2 id="gld-music-title">Musik</h2>
      <TextBlock>
        Musik hanya akan diputar setelah Anda memilih untuk memulainya.
      </TextBlock>
      {url ? (
        <a className="gld-link" href={url}>
          Buka sumber musik <span aria-hidden="true">↗</span>
        </a>
      ) : null}
    </section>
  );
}

function Opening({ model }: { model: InvitationViewModel }) {
  const firstEvent = model.events[0];
  const hero = sectionOf(model, "hero");
  return (
    <details className="gld-opening">
      <summary className="gld-opening__summary">
        <span className="gld-opening__eyebrow">
          {sectionText(hero, "title", "Undangan Pernikahan")}
        </span>
        <span className="gld-opening__names">{model.couple.displayNames}</span>
        <span className="gld-opening__date">
          {firstEvent
            ? formatDate(firstEvent.startsAt, model.locale)
            : "Hari bahagia kami"}
        </span>
        <span className="gld-opening__action">Buka undangan</span>
      </summary>
      <div className="gld-opening__content">
        <section className="gld-hero" aria-label="Pembuka undangan">
          <p className="gld-kicker">
            {sectionText(hero, "title", "Undangan Pernikahan")}
          </p>
          <h2 id="gld-hero-title">{model.couple.displayNames}</h2>
          <span className="gld-hero__ornament" aria-hidden="true">
            ✦
          </span>
          <p className="gld-hero__date">
            {firstEvent
              ? formatDate(firstEvent.startsAt, model.locale)
              : "Tanggal menyusul"}
          </p>
          {firstEvent ? (
            <Countdown
              startsAt={firstEvent.startsAt}
              timezone={firstEvent.timezone ?? model.timezone}
            />
          ) : null}
        </section>
        <div className="gld-content">
          <CoupleSection model={model} />
          <EventsSection model={model} />
          <StorySection model={model} />
          <GallerySection model={model} />
          <OptionalMusicSection model={model} />
          <GiftSection model={model} />
          <FaqSection model={model} />
          <GuestbookSection model={model} />
          <RsvpSection model={model} />
          <ClosingSection model={model} />
        </div>
      </div>
    </details>
  );
}

export function SeruniInvitation({ model }: { model: InvitationViewModel }) {
  return (
    <article
      className="gld-invitation"
      aria-label={`Undangan pernikahan ${model.couple.displayNames}`}
    >
      <h1 className="ui-visually-hidden">
        Undangan pernikahan {model.couple.displayNames}
      </h1>
      <Opening model={model} />
    </article>
  );
}

export const seruniRenderer: TemplateRenderer<ReactNode> = {
  manifest: SERUNI_MANIFEST,
  render: (model) => <SeruniInvitation model={model} />,
};

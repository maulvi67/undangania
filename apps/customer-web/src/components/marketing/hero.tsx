import { LinkButton } from "./link-button";

export function Hero() {
  return (
    <section className="lnd-hero" aria-labelledby="hero-title">
      <div className="ui-container lnd-hero__inner">
        <div className="lnd-hero__content">
          <p className="lnd-eyebrow">Undangan pernikahan digital</p>
          <h1 className="lnd-hero__title" id="hero-title">
            Undangan pernikahan digital yang elegan, tanpa perlu jago desain.
          </h1>
          <p className="lnd-hero__sub">
            Pilih desain, isi detail acara, dan bagikan undangan ke tamu dalam hitungan menit.
            Semua desain sudah dilengkapi fitur undangan lengkap — dari RSVP hingga galeri foto.
          </p>
          <div className="lnd-hero__cta">
            <LinkButton href="/templates" variant="primary" size="lg">
              Lihat koleksi desain
            </LinkButton>
            <LinkButton href="/demo" variant="secondary" size="lg">
              Lihat demo undangan lengkap
            </LinkButton>
          </div>
        </div>
        <div className="lnd-hero__visual" aria-hidden="true">
          <div className="lnd-invite">
            <span className="lnd-invite__eyebrow">Undangan Pernikahan</span>
            <span className="lnd-invite__names">Rai &amp; Anisa</span>
            <span className="lnd-invite__rule" />
            <span className="lnd-invite__date">Sabtu, 12 September 2026</span>
          </div>
        </div>
      </div>
    </section>
  );
}

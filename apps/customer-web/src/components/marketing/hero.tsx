import { LinkButton } from "./link-button";

export function Hero() {
  return (
    <section className="lnd-hero" aria-labelledby="hero-title">
      {/*
        Ambient depth. Both layers are decorative and `aria-hidden`, and both
        are washed out of the way of the heading — the aurora drifts, the bokeh
        floats. Gradients rather than images, so the hero costs no request.
      */}
      <span className="lnd-hero__aurora" aria-hidden="true" />
      <span className="lnd-hero__bokeh" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <div className="ui-container lnd-hero__inner">
        <div className="lnd-hero__content">
          <p className="lnd-eyebrow">Undangan pernikahan digital</p>
          <h1 className="lnd-hero__title" id="hero-title">
            Undangan pernikahan digital yang elegan, tanpa perlu jago desain.
          </h1>
          <p className="lnd-hero__sub">
            Pilih desain, isi detail acara, dan bagikan undangan ke tamu dalam
            hitungan menit. Semua desain sudah dilengkapi fitur undangan lengkap
            — dari RSVP hingga galeri foto.
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
        <div className="lnd-hero__visual">
          {/*
            Layered cover deck. Purely decorative — the same illustrative
            couple used in the catalog previews, so the hero never implies a
            real customer. The halo and sheen are inside the same `aria-hidden`
            subtree, so a screen reader is told nothing about them.

            The two back layers are empty: they exist only to give the front
            card physical depth, so they carry no text at all.
          */}
          <div className="lnd-stack" aria-hidden="true">
            <span className="lnd-hero__halo" />
            <div className="lnd-invite lnd-invite--deep" />
            <div className="lnd-invite lnd-invite--back" />
            <div className="lnd-invite">
              <span className="lnd-invite__sheen" />
              <span className="lnd-invite__eyebrow">Undangan Pernikahan</span>
              <span className="lnd-invite__names">Rai &amp; Anisa</span>
              <span className="lnd-invite__rule" />
              <span className="lnd-invite__date">Sabtu, 12 September 2026</span>
              <span className="lnd-invite__open">Buka Undangan</span>
            </div>
          </div>
          <p className="lnd-hero__note">
            Contoh tampilan undangan. Nama dan tanggal pada pratinjau adalah
            data contoh.
          </p>
        </div>
      </div>
    </section>
  );
}

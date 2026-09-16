import { LinkButton } from "./link-button";

export function FinalCta() {
  return (
    <section
      className="lnd-final lnd-stagger-host"
      aria-labelledby="final-title"
    >
      <div className="ui-container lnd-final__inner lnd-stagger">
        <h2 className="lnd-final__title" id="final-title">
          Temukan desain undangan Anda
        </h2>
        <p className="lnd-final__sub">
          Jelajahi koleksi desain, atau lihat dulu seperti apa undangan yang
          lengkap.
        </p>
        <div className="lnd-final__cta">
          <LinkButton href="/templates" variant="primary" size="lg">
            Lihat koleksi desain
          </LinkButton>
          <LinkButton href="/demo" variant="secondary" size="lg">
            Lihat demo undangan lengkap
          </LinkButton>
        </div>
      </div>
    </section>
  );
}

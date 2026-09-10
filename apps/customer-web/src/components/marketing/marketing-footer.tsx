const FOOTER_LINKS = [
  { href: "/templates", label: "Katalog desain" },
  { href: "/demo", label: "Demo undangan" },
  { href: "/#faq", label: "Pertanyaan umum" },
] as const;

export function MarketingFooter() {
  return (
    <footer className="lnd-footer">
      <div className="ui-container">
        <div className="lnd-footer__grid">
          <div>
            <p className="lnd-footer__brand">Wedding System</p>
            <p className="lnd-footer__tagline">Dibuat untuk momen yang benar-benar milik Anda.</p>
          </div>
          <nav aria-label="Tautan kaki halaman">
            <p className="lnd-footer__heading">Jelajahi</p>
            <ul className="lnd-footer__list">
              {FOOTER_LINKS.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="lnd-footer__heading">Catatan</p>
            <p className="lnd-footer__note">
              Pratinjau desain pada halaman ini bersifat ilustratif dan belum merepresentasikan
              koleksi final.
            </p>
          </div>
        </div>
        <p className="lnd-footer__legal">
          © {new Date().getFullYear()} Wedding System. Undangan pernikahan digital untuk pasangan
          Indonesia.
        </p>
      </div>
    </footer>
  );
}

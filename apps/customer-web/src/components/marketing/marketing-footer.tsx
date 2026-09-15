const FOOTER_LINKS = [
  { href: "/templates", label: "Katalog desain" },
  { href: "/demo", label: "Demo undangan" },
  { href: "/#cara-kerja", label: "Cara kerja" },
  { href: "/#harga", label: "Harga" },
  { href: "/#faq", label: "Pertanyaan umum" },
] as const;

/**
 * Every link points at a route that exists. Privacy and terms pages do not
 * exist yet, so no placeholder legal links are rendered — a footer link that
 * 404s is worse than an absent one.
 */
export function MarketingFooter() {
  return (
    <footer className="lnd-footer">
      <div className="ui-container">
        <div className="lnd-footer__top">
          <div>
            <p className="lnd-footer__brand">Wedding System</p>
            <p className="lnd-footer__tagline">
              Undangan pernikahan digital untuk pasangan Indonesia.
            </p>
          </div>
          <nav aria-label="Tautan kaki halaman">
            <ul className="lnd-footer__nav">
              {FOOTER_LINKS.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="lnd-footer__legal">
          © {new Date().getFullYear()} Wedding System. Pratinjau desain dan nama
          pada halaman ini adalah data contoh, bukan pelanggan sebenarnya.
        </p>
      </div>
    </footer>
  );
}

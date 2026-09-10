import { Drawer } from "@wedding/ui";
import { LinkButton } from "./link-button";

const NAV_ITEMS = [
  { href: "/templates", label: "Katalog" },
  { href: "/#cara-kerja", label: "Cara kerja" },
  { href: "/#harga", label: "Harga" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function MarketingHeader() {
  return (
    <header className="ui-header">
      <div className="ui-container ui-header__inner">
        <a className="ui-brand" href="/">
          Wedding System
        </a>
        <nav className="ui-nav" aria-label="Utama">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} className="ui-nav__link" href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="lnd-header__actions">
          <LinkButton href="/templates" size="sm" className="lnd-header__cta">
            Lihat koleksi desain
          </LinkButton>
          <div className="ui-mobile-nav">
            <Drawer triggerLabel="Menu" triggerVariant="tertiary" title="Menu" side="left">
              <ul className="ui-drawer-nav">
                {NAV_ITEMS.map((item) => (
                  <li key={item.href}>
                    <a href={item.href}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </Drawer>
          </div>
        </div>
      </div>
    </header>
  );
}

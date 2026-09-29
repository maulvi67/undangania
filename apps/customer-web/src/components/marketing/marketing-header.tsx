import Link from "next/link";
import { Drawer } from "@wedding/ui";
import { LinkButton } from "./link-button";

const NAV_ITEMS = [
  { href: "/templates", label: "Katalog desain" },
  { href: "/demo", label: "Demo undangan" },
  { href: "/#cara-kerja", label: "Cara kerja" },
  { href: "/#harga", label: "Harga" },
  { href: "/#faq", label: "Pertanyaan umum" },
] as const;

export function MarketingHeader() {
  return (
    <header className="ui-header">
      <div className="ui-container ui-header__inner">
        <Link className="ui-brand" href="/">
          Undangania
        </Link>
        <nav className="ui-nav" aria-label="Utama">
          {NAV_ITEMS.slice(0, 4).map((item) => (
            <Link key={item.href} className="ui-nav__link" href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="lnd-header__actions">
          <LinkButton href="/templates" size="sm" className="lnd-header__cta">
            Lihat koleksi desain
          </LinkButton>
          <div className="ui-mobile-nav">
            <Drawer
              triggerLabel="Menu"
              triggerVariant="tertiary"
              title="Menu"
              side="left"
            >
              <ul className="ui-drawer-nav">
                {NAV_ITEMS.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
              {/*
                The primary action is hidden in the header bar below 48rem, so
                the drawer has to carry it — otherwise the mobile composition
                has no route to the catalog from the top of the page.
              */}
              <p className="lnd-drawer__cta">
                <LinkButton href="/templates">Lihat koleksi desain</LinkButton>
              </p>
            </Drawer>
          </div>
        </div>
      </div>
    </header>
  );
}

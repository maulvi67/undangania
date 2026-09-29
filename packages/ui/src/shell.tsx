import type { ReactNode } from "react";
import { cx } from "./cx";
import { Drawer } from "./overlays";

export type NavItem = { href: string; label: string; current?: boolean };

export type ApplicationShellProps = {
  brand?: string;
  nav: ReadonlyArray<NavItem>;
  children: ReactNode;
  footerNote?: string;
};

function navList(nav: ReadonlyArray<NavItem>, className: string) {
  return nav.map((item) => (
    <a
      key={item.href}
      href={item.href}
      className={cx(
        className,
        item.current ? `${className}--current` : undefined,
      )}
      aria-current={item.current ? "page" : undefined}
    >
      {item.label}
    </a>
  ));
}

export function ApplicationShell({
  brand = "Undangania",
  nav,
  children,
  footerNote,
}: ApplicationShellProps) {
  return (
    <div className="ui-shell">
      <a className="ui-skip-link" href="#konten-utama">
        Langsung ke konten utama
      </a>
      <header className="ui-header">
        <div className="ui-container ui-header__inner">
          <a className="ui-brand" href="/">
            {brand}
          </a>
          <nav className="ui-nav" aria-label="Utama">
            {navList(nav, "ui-nav__link")}
          </nav>
          <div className="ui-mobile-nav">
            <Drawer
              triggerLabel="Menu"
              triggerVariant="tertiary"
              title="Menu"
              side="left"
            >
              <ul className="ui-drawer-nav">
                {navList(nav, "ui-drawer-nav__link")}
              </ul>
            </Drawer>
          </div>
        </div>
      </header>
      <main className="ui-main" id="konten-utama">
        <div className="ui-container">{children}</div>
      </main>
      <footer className="ui-footer">
        <div className="ui-container">
          <p>
            {footerNote ?? "Dibuat untuk momen yang benar-benar milik Anda."}
          </p>
        </div>
      </footer>
    </div>
  );
}

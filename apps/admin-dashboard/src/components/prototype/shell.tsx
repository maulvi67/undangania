"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  BottomNav,
  DesktopSidebar,
  MobileDrawer,
  NAV_ITEMS,
  TopBar,
  isNavActive,
} from "./chrome";
import { usePrototype } from "./store";

/* -------------------------------------------------------------------------- */
/* Prototype shell                                                             */
/*                                                                            */
/* Everything that is shared by the thirteen routes lives here: the sidebar,   */
/* the sticky header, the mobile bottom bar, and the paddings of the content   */
/* area. The route itself only renders the page body.                          */
/* -------------------------------------------------------------------------- */

export function PrototypeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { orders, query, setQuery, notify, openOrder } = usePrototype();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeLabel =
    NAV_ITEMS.find((item) => isNavActive(item.href, pathname))?.label ??
    "Dashboard";

  return (
    <div className="min-h-[100dvh]">
      <DesktopSidebar />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="lg:pl-[240px]">
        <TopBar
          activeLabel={activeLabel}
          query={query}
          onQueryChange={setQuery}
          orders={orders}
          onOpenOrder={openOrder}
          onOpenDrawer={() => setDrawerOpen(true)}
          onNotify={notify}
        />

        <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-4 md:px-6 md:pt-6 lg:pb-10">
          {children}
        </main>
      </div>

      <BottomNav onOpenMenu={() => setDrawerOpen(true)} />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bell,
  CalendarDays,
  ChartColumnBig,
  CheckCheck,
  ChevronDown,
  CircleUserRound,
  CreditCard,
  Heart,
  House,
  Info,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  type LucideIcon,
  Megaphone,
  Menu,
  MessageCircle,
  Quote,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Users,
  X,
} from "lucide-react";
import { cn } from "../ui/cn";
import {
  NOTIFICATIONS,
  formatRupiah,
  type NotificationItem,
  type NotificationTone,
  type Order,
} from "./data";
import { IconButton, OrderBadge, PayBadge } from "./ui";

/* -------------------------------------------------------------------------- */
/* Navigation model                                                            */
/* -------------------------------------------------------------------------- */

export type NavKey =
  | "dashboard"
  | "pesanan"
  | "pembayaran"
  | "template"
  | "kategori"
  | "pengguna"
  | "undangan"
  | "acara"
  | "promo"
  | "testimoni"
  | "pesan"
  | "laporan"
  | "pengaturan";

export const NAV_ITEMS: {
  key: NavKey;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/prototype",
    icon: LayoutDashboard,
  },
  {
    key: "pesanan",
    label: "Pesanan",
    href: "/prototype/pesanan",
    icon: ShoppingCart,
    badge: 5,
  },
  {
    key: "pembayaran",
    label: "Pembayaran",
    href: "/prototype/pembayaran",
    icon: CreditCard,
    badge: 5,
  },
  {
    key: "template",
    label: "Template",
    href: "/prototype/template",
    icon: LayoutTemplate,
  },
  {
    key: "kategori",
    label: "Kategori",
    href: "/prototype/kategori",
    icon: Tag,
  },
  {
    key: "pengguna",
    label: "Pengguna",
    href: "/prototype/pengguna",
    icon: Users,
  },
  {
    key: "undangan",
    label: "Undangan Aktif",
    href: "/prototype/undangan-aktif",
    icon: Heart,
  },
  {
    key: "acara",
    label: "Data Acara",
    href: "/prototype/data-acara",
    icon: CalendarDays,
  },
  { key: "promo", label: "Promo", href: "/prototype/promo", icon: Megaphone },
  {
    key: "testimoni",
    label: "Testimoni",
    href: "/prototype/testimoni",
    icon: Quote,
  },
  {
    key: "pesan",
    label: "Pesan Masuk",
    href: "/prototype/pesan-masuk",
    icon: MessageCircle,
    badge: 4,
  },
  {
    key: "laporan",
    label: "Laporan",
    href: "/prototype/laporan",
    icon: ChartColumnBig,
  },
  {
    key: "pengaturan",
    label: "Pengaturan",
    href: "/prototype/pengaturan",
    icon: Settings,
  },
];

/** The dashboard lives at the section root, every other item is a child route. */
export function isNavActive(href: string, pathname: string): boolean {
  return href === "/prototype"
    ? pathname === "/prototype"
    : pathname.startsWith(href);
}

const NOTIFICATION_TONE: Record<NotificationTone, string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Closes a popover on outside pointer-down. Escape is handled by the caller. */
function useOutsideClick<T extends HTMLElement>(
  active: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!active) return;
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onCloseRef.current();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [active]);

  return ref;
}

/* -------------------------------------------------------------------------- */
/* Sidebar                                                                     */
/* -------------------------------------------------------------------------- */

function SidebarBody({
  onNavigate,
}: {
  onNavigate?: (() => void) | undefined;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-[var(--p-sidebar)]">
      <div className="flex items-center gap-3 border-b border-[var(--p-line)] px-5 py-[18px]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#D98E9B] to-[#963D4A] text-white shadow-[0_12px_26px_-14px_rgba(150,61,74,0.9)]">
          <Heart className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="proto-display truncate text-lg font-semibold leading-tight text-[var(--p-ink)]">
            Undangania
          </p>
          <p className="truncate text-[10px] text-[var(--p-ink-soft)]">
            Undangan Digital, Cerita Abadi
          </p>
        </div>
      </div>

      <nav
        aria-label="Navigasi utama"
        className="proto-scrollbar-none flex-1 overflow-y-auto px-3 py-4"
      >
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = isNavActive(item.href, pathname);
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  {...(onNavigate ? { onClick: onNavigate } : null)}
                  className={cn(
                    "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition",
                    isActive
                      ? "bg-[var(--p-rose-soft)] font-semibold text-[var(--p-rose-strong)]"
                      : "text-[var(--p-ink-soft)] hover:bg-[var(--p-rose-soft)] hover:text-[var(--p-ink)]",
                  )}
                >
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-0 w-1 rounded-full bg-[var(--p-rose)]"
                    />
                  ) : null}
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span className="proto-nums grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[var(--p-rose)] px-1 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3">
        <div className="rounded-2xl border border-[var(--p-line)] bg-[var(--p-rose-soft)] p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--p-rose-strong)]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Mode Prototype
          </p>
          <p className="proto-display mt-1.5 text-[13px] leading-snug text-[var(--p-ink)]">
            Seluruh angka pada halaman ini adalah data contoh.
          </p>
        </div>
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] border-r border-[var(--p-line)] lg:block">
      <SidebarBody />
    </aside>
  );
}

export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#2A1A1F]/45 backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ duration: reduceMotion ? 0 : 0.24 }}
            className="absolute inset-y-0 left-0 z-50 w-[260px] border-r border-[var(--p-line)] shadow-2xl"
            aria-label="Menu navigasi"
          >
            <IconButton
              label="Tutup menu"
              onClick={onClose}
              className="absolute right-3 top-[18px] z-10 h-9 w-9 border-transparent bg-transparent"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </IconButton>
            <SidebarBody onNavigate={onClose} />
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/* Top bar                                                                     */
/* -------------------------------------------------------------------------- */

export function TopBar({
  activeLabel,
  query,
  onQueryChange,
  orders,
  onOpenOrder,
  onOpenDrawer,
  onNotify,
}: {
  activeLabel: string;
  query: string;
  onQueryChange: (next: string) => void;
  orders: Order[];
  onOpenOrder: (order: Order) => void;
  onOpenDrawer: () => void;
  onNotify: (message: string) => void;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(NOTIFICATIONS);

  const notificationsRef = useOutsideClick<HTMLDivElement>(
    notificationsOpen,
    () => setNotificationsOpen(false),
  );
  const profileRef = useOutsideClick<HTMLDivElement>(profileOpen, () =>
    setProfileOpen(false),
  );
  const searchRef = useOutsideClick<HTMLDivElement>(searchOpen, () =>
    setSearchOpen(false),
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setNotificationsOpen(false);
      setProfileOpen(false);
      setSearchOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const unreadCount = notifications.filter((item) => item.unread).length;

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return [];
    return orders
      .filter((order) =>
        [order.id, order.customer, order.event, order.template].some((field) =>
          field.toLowerCase().includes(needle),
        ),
      )
      .slice(0, 5);
  }, [orders, query]);

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--p-line)] bg-[var(--p-canvas)]/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-4 md:gap-3 md:px-6">
        <IconButton
          label="Buka menu navigasi"
          className="lg:hidden"
          onClick={onOpenDrawer}
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </IconButton>

        <p className="proto-display min-w-0 flex-1 truncate text-base font-semibold text-[var(--p-ink)] md:hidden">
          {activeLabel}
        </p>

        <div
          ref={searchRef}
          className="relative hidden min-w-0 flex-1 md:block"
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--p-ink-soft)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Cari pesanan, pelanggan, atau template..."
            aria-label="Pencarian global"
            className="h-10 w-full max-w-xl rounded-xl border border-[var(--p-line)] bg-white pl-9 pr-3 text-[13px] text-[var(--p-ink)] outline-none placeholder:text-[var(--p-ink-soft)] focus:border-[var(--p-rose)]"
          />

          <AnimatePresence>
            {searchOpen && query.trim().length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="absolute left-0 right-0 top-12 max-w-xl overflow-hidden rounded-2xl border border-[var(--p-line)] bg-white shadow-2xl"
              >
                {results.length === 0 ? (
                  <p className="px-4 py-5 text-center text-xs text-[var(--p-ink-soft)]">
                    Tidak ada hasil untuk &ldquo;{query.trim()}&rdquo;.
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--p-line)]">
                    {results.map((order) => (
                      <li key={order.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenOrder(order);
                            setSearchOpen(false);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--p-rose-soft)]"
                        >
                          <span className="proto-nums shrink-0 text-[12px] font-semibold text-[var(--p-ink)]">
                            {order.id}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-semibold text-[var(--p-ink)]">
                              {order.customer}
                            </span>
                            <span className="block truncate text-[11px] text-[var(--p-ink-soft)]">
                              {order.event} · {order.template}
                            </span>
                          </span>
                          <span className="proto-nums shrink-0 text-[11px] font-semibold text-[var(--p-ink-soft)]">
                            {formatRupiah(order.total)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div ref={notificationsRef} className="relative">
            <IconButton
              label="Notifikasi"
              aria-expanded={notificationsOpen}
              onClick={() => {
                setNotificationsOpen((open) => !open);
                setProfileOpen(false);
              }}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              {unreadCount > 0 ? (
                <span className="proto-nums absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--p-rose)] px-1 text-[9px] font-semibold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </IconButton>

            <AnimatePresence>
              {notificationsOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-12 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--p-line)] bg-white shadow-2xl"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--p-line)] px-4 py-3">
                    <p className="proto-display text-sm font-semibold text-[var(--p-ink)]">
                      Notifikasi
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setNotifications((items) =>
                          items.map((item) => ({ ...item, unread: false })),
                        );
                        onNotify("Semua notifikasi ditandai sudah dibaca");
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--p-rose-strong)]"
                    >
                      <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Tandai dibaca
                    </button>
                  </div>

                  <ul className="max-h-[320px] divide-y divide-[var(--p-line)] overflow-y-auto">
                    {notifications.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifications((items) =>
                              items.map((entry) =>
                                entry.id === item.id
                                  ? { ...entry, unread: false }
                                  : entry,
                              ),
                            );
                            onNotify(item.title);
                            setNotificationsOpen(false);
                          }}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[var(--p-rose-soft)]"
                        >
                          <span
                            className={cn(
                              "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border",
                              NOTIFICATION_TONE[item.tone],
                            )}
                          >
                            <Info className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start gap-2">
                              <span className="min-w-0 flex-1 text-[12px] font-semibold text-[var(--p-ink)]">
                                {item.title}
                              </span>
                              {item.unread ? (
                                <span
                                  aria-label="Belum dibaca"
                                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--p-rose)]"
                                />
                              ) : null}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--p-ink-soft)]">
                              {item.detail}
                            </span>
                            <span className="mt-1 block text-[10px] text-[var(--p-ink-soft)]">
                              {item.time}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div ref={profileRef} className="relative">
            <button
              type="button"
              aria-expanded={profileOpen}
              onClick={() => {
                setProfileOpen((open) => !open);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl border border-[var(--p-line)] bg-white py-1.5 pl-1.5 pr-2 transition hover:bg-[var(--p-rose-soft)]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#D98E9B] to-[#963D4A] text-[11px] font-semibold text-white">
                MA
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-[12px] font-semibold text-[var(--p-ink)]">
                  Maulvi
                </span>
                <span className="block text-[10px] text-[var(--p-ink-soft)]">
                  Super Admin
                </span>
              </span>
              <ChevronDown
                className="hidden h-3.5 w-3.5 text-[var(--p-ink-soft)] sm:block"
                aria-hidden="true"
              />
            </button>

            <AnimatePresence>
              {profileOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl border border-[var(--p-line)] bg-white shadow-2xl"
                >
                  <div className="border-b border-[var(--p-line)] px-4 py-3">
                    <p className="text-[13px] font-semibold text-[var(--p-ink)]">
                      Maulvi
                    </p>
                    <p className="text-[11px] text-[var(--p-ink-soft)]">
                      maulvi@undangania.id
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-[var(--p-rose)]/30 bg-[var(--p-rose-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--p-rose-strong)]">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      Super Admin
                    </span>
                  </div>
                  <ul className="p-1.5">
                    {[
                      {
                        label: "Profil Saya",
                        icon: CircleUserRound,
                        href: "/prototype/pengaturan",
                      },
                      {
                        label: "Pengaturan Akun",
                        icon: Settings,
                        href: "/prototype/pengaturan",
                      },
                      { label: "Keluar", icon: LogOut, href: null },
                    ].map((entry) => {
                      const itemClass =
                        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12px] font-medium text-[var(--p-ink-soft)] transition hover:bg-[var(--p-rose-soft)] hover:text-[var(--p-ink)]";
                      return (
                        <li key={entry.label}>
                          {entry.href === null ? (
                            <button
                              type="button"
                              onClick={() => {
                                onNotify(
                                  `${entry.label} belum tersedia di prototype`,
                                );
                                setProfileOpen(false);
                              }}
                              className={itemClass}
                            >
                              <entry.icon
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              {entry.label}
                            </button>
                          ) : (
                            <Link
                              href={entry.href}
                              onClick={() => setProfileOpen(false)}
                              className={itemClass}
                            >
                              <entry.icon
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              {entry.label}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Bottom navigation (mobile)                                                  */
/* -------------------------------------------------------------------------- */

export function BottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();

  const items: {
    key: string;
    label: string;
    href?: string;
    icon: LucideIcon;
  }[] = [
    { key: "beranda", label: "Beranda", href: "/prototype", icon: House },
    {
      key: "pesanan",
      label: "Pesanan",
      href: "/prototype/pesanan",
      icon: ShoppingCart,
    },
    {
      key: "template",
      label: "Template",
      href: "/prototype/template",
      icon: LayoutTemplate,
    },
    {
      key: "pengguna",
      label: "Pengguna",
      href: "/prototype/pengguna",
      icon: Users,
    },
    { key: "menu", label: "Menu", icon: Menu },
  ];

  const isMenuActive = !items.some(
    (item) => item.href !== undefined && isNavActive(item.href, pathname),
  );

  return (
    <nav
      aria-label="Navigasi bawah"
      className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-[var(--p-line)] bg-white/95 shadow-[0_18px_44px_-24px_rgba(94,48,56,0.6)] backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5 gap-1 p-2">
        {items.map((item) => {
          const isActive =
            item.href === undefined
              ? isMenuActive
              : isNavActive(item.href, pathname);
          const Icon = item.icon;
          const itemClass = cn(
            "flex w-full flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-semibold transition",
            isActive
              ? "bg-[var(--p-rose-soft)] text-[var(--p-rose-strong)]"
              : "text-[var(--p-ink-soft)] hover:bg-[var(--p-rose-soft)]",
          );

          return (
            <li key={item.key}>
              {item.href === undefined ? (
                <button
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={onOpenMenu}
                  className={itemClass}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  {item.label}
                </button>
              ) : (
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={itemClass}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Search-result helpers reused by the header popover                          */
/* -------------------------------------------------------------------------- */

export function SearchResultMeta({ order }: { order: Order }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <PayBadge status={order.payment} />
      <OrderBadge status={order.status} />
    </span>
  );
}

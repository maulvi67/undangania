"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Command,
  LogOut,
  Moon,
  Search,
  ShieldCheck,
  Sun,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { adminSignOutAction } from "../../lib/admin/actions";
import type { AdminDashboard, Severity } from "../../lib/admin/contract";
import { formatAdminTimestamp } from "../../lib/admin/formatters";

const SEARCH_TARGETS = [
  {
    label: "Ringkasan operasi",
    terms: "dashboard ringkasan overview",
    href: "#ringkasan",
  },
  {
    label: "Perlu perhatian",
    terms: "isu prioritas alert attention",
    href: "#ringkasan",
  },
  {
    label: "Rekonsiliasi pembayaran",
    terms: "payment transaksi qris",
    href: "#pembayaran",
  },
  {
    label: "Pekerjaan gagal",
    terms: "job worker antrean",
    href: "#pekerjaan-gagal",
  },
  {
    label: "Kegagalan publikasi",
    terms: "publikasi undangan snapshot",
    href: "#publikasi",
  },
  {
    label: "Status produksi cetak",
    terms: "printing produksi vendor",
    href: "#pesanan-cetak",
  },
  {
    label: "Kasus dukungan",
    terms: "support tiket bantuan",
    href: "#dukungan",
  },
  { label: "Status template", terms: "template moderasi", href: "#template" },
  {
    label: "Pengecualian siklus hidup",
    terms: "lifecycle state",
    href: "#pengecualian",
  },
  { label: "Log audit", terms: "audit log keamanan", href: "#audit" },
] as const;

type Theme = "light" | "dark";
const THEME_CHANGE_EVENT = "wedding-admin-theme-change";

function subscribeToTheme(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
}

function getThemeSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerThemeSnapshot(): Theme {
  return "light";
}

function setDocumentTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export type AdminToolbarNotification = {
  id: string;
  issue: string;
  reference: string;
  severity: Severity;
  updatedAt: string;
  href: string;
};

type AdminToolbarSession = Pick<
  AdminDashboard["session"],
  "roleLabel" | "scope" | "mfaActive" | "environmentLabel"
>;

type AdminToolbarProps = {
  session: AdminToolbarSession;
  notifications: readonly AdminToolbarNotification[] | null;
};

export function AdminToolbar({ session, notifications }: AdminToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const unreadCount =
    notifications?.filter(
      (notification) => !readNotificationIds.includes(notification.id),
    ).length ?? 0;
  const filteredTargets = SEARCH_TARGETS.filter((target) => {
    const query = commandQuery.trim().toLocaleLowerCase("id-ID");
    return (
      query.length === 0 ||
      target.label.toLocaleLowerCase("id-ID").includes(query) ||
      target.terms.toLocaleLowerCase("id-ID").includes(query)
    );
  });

  useEffect(() => {
    let savedTheme: string | null = null;
    try {
      savedTheme = window.localStorage.getItem("wedding-admin-theme");
    } catch {
      savedTheme = null;
    }

    const nextTheme: Theme =
      savedTheme === "dark" ||
      (savedTheme !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
    setDocumentTheme(nextTheme);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (commandOpen && !dialog.open) {
      dialog.showModal();
      commandInputRef.current?.focus();
    } else if (!commandOpen && dialog.open) {
      dialog.close();
    }
  }, [commandOpen]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setDocumentTheme(nextTheme);
    try {
      window.localStorage.setItem("wedding-admin-theme", nextTheme);
    } catch {
      // Theme still works for this page view when storage is unavailable.
    }
  }

  function submitGlobalSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const query = commandQuery.trim();
    params.set("page", "1");
    if (query) params.set("search", query);
    else params.delete("search");
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
    setCommandOpen(false);
  }

  function markAllRead() {
    setReadNotificationIds(
      notifications?.map((notification) => notification.id) ?? [],
    );
  }

  function markRead(id: string) {
    setReadNotificationIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
  }

  return (
    <div className="admin-toolbar" role="group" aria-label="Kontrol dashboard">
      <button
        className="admin-toolbar__button admin-toolbar__search"
        type="button"
        onClick={() => setCommandOpen(true)}
        aria-label="Cari operasi; tekan Control atau Command K untuk membuka pencarian"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="admin-toolbar__search-label">Cari operasi</span>
        <kbd aria-hidden="true">Ctrl K</kbd>
      </button>

      <details className="admin-toolbar__menu">
        <summary
          className="admin-toolbar__button admin-toolbar__icon-button"
          aria-label={`Notifikasi operasional, ${unreadCount} belum dibaca`}
        >
          <Bell className="size-4" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="admin-toolbar__notification-count">
              {unreadCount}
            </span>
          ) : null}
        </summary>
        <div className="admin-toolbar__popover admin-toolbar__notifications">
          <div className="admin-toolbar__popover-heading">
            <div>
              <h2>Notifikasi</h2>
              <p>Dari antrean operasional halaman aktif.</p>
            </div>
            {unreadCount > 0 ? (
              <button
                className="admin-toolbar__text-button"
                type="button"
                onClick={markAllRead}
              >
                <CheckCheck className="size-4" aria-hidden="true" />
                Tandai semua dibaca
              </button>
            ) : null}
          </div>
          {notifications === null ? (
            <p className="admin-toolbar__empty" role="status">
              Antrean tidak tersedia atau aksesnya dibatasi.
            </p>
          ) : notifications.length === 0 ? (
            <p className="admin-toolbar__empty" role="status">
              Belum ada item perhatian pada halaman aktif.
            </p>
          ) : (
            <ul className="admin-toolbar__notification-list">
              {notifications.map((notification) => {
                const isRead = readNotificationIds.includes(notification.id);
                return (
                  <li className={isRead ? "is-read" : ""} key={notification.id}>
                    <Link
                      className="admin-toolbar__notification-link"
                      href={notification.href}
                      onClick={() => markRead(notification.id)}
                    >
                      <span
                        className={`admin-severity admin-severity--${notification.severity}`}
                      >
                        <span
                          className="admin-severity__dot"
                          aria-hidden="true"
                        />
                        <span>{notification.issue}</span>
                      </span>
                      <span className="admin-toolbar__notification-reference">
                        {notification.reference}
                      </span>
                      <time dateTime={notification.updatedAt}>
                        {formatAdminTimestamp(notification.updatedAt)} WIB
                      </time>
                    </Link>
                    {!isRead ? (
                      <button
                        className="admin-toolbar__mark-read"
                        type="button"
                        onClick={() => markRead(notification.id)}
                        aria-label={`Tandai ${notification.reference} sudah dibaca`}
                      >
                        Tandai dibaca
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="admin-toolbar__local-note">
            Status baca hanya tersimpan selama halaman ini terbuka.
          </p>
        </div>
      </details>

      <button
        className="admin-toolbar__button admin-toolbar__icon-button"
        type="button"
        onClick={toggleTheme}
        aria-label={`Beralih ke tema ${theme === "dark" ? "terang" : "gelap"}`}
        aria-pressed={theme === "dark"}
        title={`Tema ${theme === "dark" ? "gelap" : "terang"}`}
      >
        {theme === "dark" ? (
          <Sun className="size-4" aria-hidden="true" />
        ) : (
          <Moon className="size-4" aria-hidden="true" />
        )}
      </button>

      <details className="admin-toolbar__menu admin-toolbar__profile">
        <summary
          className="admin-toolbar__button admin-toolbar__profile-button"
          aria-label={`Konteks akses, ${session.roleLabel}`}
        >
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          <span>{session.roleLabel}</span>
        </summary>
        <div className="admin-toolbar__popover admin-toolbar__profile-popover">
          <p className="admin-eyebrow">Konteks akses</p>
          <strong>{session.roleLabel}</strong>
          <dl>
            <div>
              <dt>Scope</dt>
              <dd>{session.scope}</dd>
            </div>
            <div>
              <dt>MFA</dt>
              <dd>{session.mfaActive ? "Aktif" : "Belum aktif"}</dd>
            </div>
            <div>
              <dt>Lingkungan</dt>
              <dd>{session.environmentLabel}</dd>
            </div>
          </dl>
          <form action={adminSignOutAction} className="admin-toolbar__signout">
            <button className="admin-toolbar__text-button" type="submit">
              <LogOut className="size-4" aria-hidden="true" />
              Keluar
            </button>
          </form>
        </div>
      </details>

      <dialog
        className="admin-command-dialog"
        ref={dialogRef}
        aria-labelledby="admin-command-title"
        onClose={() => setCommandOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          setCommandOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setCommandOpen(false);
        }}
      >
        <div className="admin-command-dialog__content">
          <div className="admin-command-dialog__title-row">
            <h2 id="admin-command-title">Cari operasi</h2>
            <kbd>Esc</kbd>
          </div>
          <form
            className="admin-command-dialog__form"
            onSubmit={submitGlobalSearch}
            role="search"
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <input
              ref={commandInputRef}
              aria-label="Cari operasi di seluruh bagian"
              type="search"
              maxLength={100}
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
              placeholder="ID, referensi, status…"
            />
            <button type="submit">Cari semua</button>
          </form>
          <p className="admin-command-dialog__hint">
            Pencarian memakai filter operasi aktif. Pintasan: Ctrl K.
          </p>
          <div className="admin-command-dialog__section-heading">
            Bagian cepat
          </div>
          {filteredTargets.length > 0 ? (
            <ul className="admin-command-dialog__targets">
              {filteredTargets.map((target) => (
                <li key={target.href + target.label}>
                  <Link
                    href={target.href}
                    onClick={() => setCommandOpen(false)}
                  >
                    <Command className="size-4 shrink-0" aria-hidden="true" />
                    <span>{target.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-command-dialog__empty">
              Tidak ada bagian yang cocok. Tekan Enter untuk mencari data
              operasi.
            </p>
          )}
        </div>
      </dialog>
    </div>
  );
}

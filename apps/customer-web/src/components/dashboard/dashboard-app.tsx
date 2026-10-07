"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  Globe2,
  Heart,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Menu,
  MessageCircle,
  Music2,
  Plus,
  Search,
  Settings,
  Share2,
  Smartphone,
  Sparkles,
  UserRound,
  Users,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { signInHref } from "../../lib/auth/redirect";
import { moderateGuestbookAction } from "../../lib/oversight/actions";
import type {
  DashboardViewModel,
  GuestbookMessageView,
  GuestbookModerationStatus,
  GuestbookPanelState,
  OrderView,
  OrdersPanelState,
  TemplateCardView,
} from "../../lib/dashboard/view-model";

/**
 * Customer dashboard.
 *
 * Every figure on this page comes from the session-scoped loaders the page
 * passed in: the workspace aggregate, the guestbook queue, the order list, and
 * the template catalogue. Nothing here is simulated — panels that have no data
 * render their empty or unavailable state instead of a placeholder number.
 *
 * The visual language is the promoted Undangania dashboard design; the
 * `prototype-*` class names are its stylesheet's namespace and are kept as-is.
 */

export type DashboardAppProps = {
  dashboard:
    | Readonly<{ kind: "unauthenticated" }>
    | Readonly<{ kind: "unavailable" }>
    | Readonly<{ kind: "ready"; view: DashboardViewModel }>;
  guestbook: GuestbookPanelState;
  orders: OrdersPanelState;
  templates: readonly TemplateCardView[];
};

type DialogName = "share" | "preview" | "steps" | "message" | "confirm-reject";

type NavItem = Readonly<{
  label: string;
  icon: LucideIcon;
  /** Null while the destination does not exist yet. */
  href: string | null;
}>;

const NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", icon: Heart, href: "/dashboard" },
  { label: "Pesanan Saya", icon: CreditCard, href: "/pesanan" },
  { label: "Undangan Saya", icon: Edit3, href: "/editor" },
  { label: "Pilih Template", icon: LayoutGrid, href: "/templates" },
  { label: "Data Acara", icon: CalendarDays, href: "/editor?section=events" },
  { label: "Galeri Foto", icon: ImageIcon, href: "/editor?section=gallery" },
  { label: "Musik", icon: Music2, href: "/editor?section=music" },
  { label: "Tamu & RSVP", icon: Users, href: "/tamu" },
  { label: "Buku Tamu", icon: BookOpen, href: "/buku-tamu" },
  { label: "Pesan Masuk", icon: MessageCircle, href: null },
  { label: "Bantuan", icon: HelpCircle, href: "/#faq" },
  { label: "Pengaturan Akun", icon: Settings, href: null },
];

const MOBILE_NAV_ITEMS: readonly NavItem[] = [
  { label: "Beranda", icon: Heart, href: "/dashboard" },
  { label: "Undangan", icon: Edit3, href: "/editor" },
  { label: "Tamu", icon: Users, href: "/tamu" },
  { label: "Pesanan", icon: CreditCard, href: "/pesanan" },
  { label: "Akun", icon: UserRound, href: null },
];

const numberFormatter = new Intl.NumberFormat("id-ID");

/** Stable empty collections, so memo dependencies do not change per render. */
const NO_GUESTBOOK_ROWS: readonly GuestbookMessageView[] = [];
const NO_ORDERS: readonly OrderView[] = [];

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function toneVariant(tone: DashboardViewModel["status"]["tone"]): string {
  if (tone === "olive") return "green";
  if (tone === "gold") return "gold";
  if (tone === "blush") return "rose";
  return "neutral";
}

const MODERATION_LABELS: Record<GuestbookModerationStatus, string> = {
  PENDING: "Menunggu tinjauan",
  APPROVED: "Ditampilkan",
  REJECTED: "Ditolak",
  HIDDEN: "Disembunyikan",
};

function moderationVariant(status: GuestbookModerationStatus): string {
  if (status === "APPROVED") return "green";
  if (status === "PENDING") return "amber";
  if (status === "REJECTED") return "rose";
  return "neutral";
}

type DashboardNotice = Readonly<{
  id: string;
  text: string;
  hint: string;
  href: string;
  amber: boolean;
}>;

function buildNotices(
  view: DashboardViewModel,
  guestbookPending: number,
): readonly DashboardNotice[] {
  const notices: DashboardNotice[] = [];
  if (view.paymentPending) {
    notices.push({
      id: "payment",
      text: "Pembayaran belum selesai",
      hint: "Pesanan",
      href: "/pesanan",
      amber: true,
    });
  }
  if (view.expiryWarning !== null) {
    notices.push({
      id: "expiry",
      text: "Masa aktif undangan segera berakhir",
      hint: "Pesanan",
      href: "/pesanan",
      amber: true,
    });
  }
  if (view.invitation !== null && view.invitation.shareUrl === null) {
    notices.push({
      id: "publish",
      text: "Undangan belum diterbitkan",
      hint: "Editor",
      href: "/editor",
      amber: false,
    });
  }
  if (guestbookPending > 0) {
    notices.push({
      id: "guestbook",
      text: `${formatNumber(guestbookPending)} ucapan menunggu persetujuan`,
      hint: "Buku tamu",
      href: "/buku-tamu",
      amber: true,
    });
  }
  if (view.rsvp !== null && view.rsvp.pending > 0) {
    notices.push({
      id: "rsvp",
      text: `${formatNumber(view.rsvp.pending)} tamu belum menjawab RSVP`,
      hint: "RSVP",
      href: "/rsvp",
      amber: false,
    });
  }
  if (view.guests !== null && view.guests.guestCount === 0) {
    notices.push({
      id: "guests",
      text: "Belum ada tamu di daftar undangan",
      hint: "Tamu",
      href: "/tamu",
      amber: false,
    });
  }
  return notices;
}

function Card({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`prototype-card ${className}`} id={id}>
      {children}
    </section>
  );
}

function SectionHeading({
  title,
  description,
  action,
  id,
}: {
  title: string;
  description?: string | undefined;
  action?: ReactNode;
  id?: string | undefined;
}) {
  return (
    <div className="prototype-section-heading" id={id}>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function StatusBadge({
  children,
  variant = "rose",
}: {
  children: ReactNode;
  variant?: string;
}) {
  return (
    <span className={`prototype-badge prototype-badge--${variant}`}>
      {children}
    </span>
  );
}

function OverlayDialog({
  title,
  description,
  children,
  onClose,
  size = "standard",
  reduceMotion,
}: {
  title: string;
  description?: string | undefined;
  children: ReactNode;
  onClose: () => void;
  size?: "standard" | "wide" | "preview";
  reduceMotion: boolean;
}) {
  return (
    <AnimatePresence>
      <motion.div
        key={title}
        className="prototype-dialog-backdrop"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.section
          className={`prototype-dialog prototype-dialog--${size}`}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        >
          <header className="prototype-dialog__header">
            <div>
              <h2>{title}</h2>
              {description ? <p>{description}</p> : null}
            </div>
            <button
              className="prototype-icon-button"
              onClick={onClose}
              aria-label="Tutup dialog"
            >
              <X size={19} />
            </button>
          </header>
          {children}
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}

function InvitationArtwork({
  title,
  date,
  compact = false,
}: {
  title: string;
  date: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`prototype-invitation-art ${compact ? "prototype-invitation-art--compact" : ""}`}
    >
      <div className="prototype-invitation-art__frame">
        <Heart aria-hidden="true" size={compact ? 22 : 28} strokeWidth={1.5} />
        <p>The Wedding Of</p>
        <h3>{title}</h3>
        <span>{date}</span>
      </div>
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="prototype-empty-state">
      <span className="prototype-empty-state__icon">
        <Icon size={22} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function MobileInvitationPreview({
  title,
  date,
  href,
}: {
  title: string;
  date: string;
  href: string | null;
}) {
  const names = title.split(" & ");
  return (
    <div className="prototype-phone">
      <div className="prototype-phone__speaker" />
      <div className="prototype-phone__screen">
        <div className="prototype-phone__ornament">
          <Heart size={19} strokeWidth={1.4} />
        </div>
        <p>The Wedding Of</p>
        <h3>
          {names.map((name, index) => (
            <span key={name}>
              {index > 0 ? "& " : ""}
              {name}
            </span>
          ))}
        </h3>
        <div className="prototype-phone__rule" />
        <p className="prototype-phone__date">{date}</p>
        {href === null ? (
          <p className="prototype-section-note">
            <Globe2 size={15} /> Undangan belum diterbitkan, tautan belum dapat
            dibuka.
          </p>
        ) : (
          <a
            className="prototype-button prototype-button--primary prototype-phone__open"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            Buka Undangan <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

export function DashboardApp({
  dashboard,
  guestbook,
  orders,
  templates,
}: DashboardAppProps) {
  const reduceMotion = useReducedMotion() === true;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const [offline, setOffline] = useState(false);
  const [selectedMessage, setSelectedMessage] =
    useState<GuestbookMessageView | null>(null);
  const [moderation, setModeration] = useState<
    Record<string, GuestbookModerationStatus>
  >({});
  const [moderationPending, setModerationPending] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const view = dashboard.kind === "ready" ? dashboard.view : null;

  const guestbookRows = useMemo(
    () => (guestbook.kind === "ok" ? guestbook.rows : NO_GUESTBOOK_ROWS),
    [guestbook],
  );
  const guestbookRowsWithStatus = useMemo(
    () =>
      guestbookRows.map((row) => ({
        ...row,
        status: moderation[row.id] ?? row.status,
      })),
    [guestbookRows, moderation],
  );
  const guestbookPendingCount = guestbookRowsWithStatus.filter(
    (row) => row.status === "PENDING",
  ).length;

  const orderList = useMemo(
    () => (orders.kind === "ok" ? orders.orders : NO_ORDERS),
    [orders],
  );

  const notices = useMemo(
    () =>
      view === null ? [] : buildNotices(view, guestbookPendingCount),
    [view, guestbookPendingCount],
  );

  const searchResults = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    if (query === "") return [];
    const navMatches = NAV_ITEMS.filter(
      (item) =>
        item.href !== null &&
        item.label.toLocaleLowerCase("id-ID").includes(query),
    )
      .slice(0, 3)
      .map((item) => ({
        label: item.label,
        kind: "Menu",
        href: item.href ?? "/dashboard",
      }));
    const templateMatches = templates
      .filter((template) =>
        template.name.toLocaleLowerCase("id-ID").includes(query),
      )
      .slice(0, 3)
      .map((template) => ({
        label: template.name,
        kind: "Template",
        href: `/templates/${template.id}`,
      }));
    const orderMatches = orderList
      .filter((order) =>
        `${order.orderNumber} ${order.productName}`
          .toLocaleLowerCase("id-ID")
          .includes(query),
      )
      .slice(0, 2)
      .map((order) => ({
        label: order.orderNumber,
        kind: "Pesanan",
        href: `/checkout/status?order=${encodeURIComponent(order.orderNumber)}`,
      }));
    return [...navMatches, ...templateMatches, ...orderMatches].slice(0, 5);
  }, [search, templates, orderList]);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  // Real offline detection: the banner reflects the browser's own state.
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dialog]);

  const notify = (message: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  };

  const closeDialog = () => setDialog(null);

  const shareUrl = view?.invitation?.shareUrl ?? null;
  const displayUrl = view?.invitation?.displayUrl ?? null;
  const coupleNames = view?.coupleNames ?? "Undangan Anda";
  const eventDateLabel = view?.invitation?.eventDateLabel ?? null;
  const primaryAction = view?.nextActions[0] ?? {
    id: "editor",
    title: "Buka editor",
    description: "Buka editor untuk memeriksa undangan Anda.",
    href: "/editor",
    variant: "primary" as const,
  };
  const invitationArtDate =
    eventDateLabel ?? "Tanggal acara belum diisi";

  const copyInvitationUrl = async () => {
    if (shareUrl === null) {
      notify("Undangan belum diterbitkan, tautan belum tersedia.");
      return;
    }
    let success = false;
    try {
      await navigator.clipboard.writeText(shareUrl);
      success = true;
    } catch {
      const temporaryInput = document.createElement("textarea");
      temporaryInput.value = shareUrl;
      temporaryInput.setAttribute("readonly", "true");
      temporaryInput.style.position = "fixed";
      temporaryInput.style.opacity = "0";
      document.body.append(temporaryInput);
      temporaryInput.select();
      success = document.execCommand("copy");
      temporaryInput.remove();
    }
    if (!success) {
      notify("URL belum tersalin. Salin tautan secara manual.");
      return;
    }
    setCopied(true);
    notify("URL undangan berhasil disalin");
    window.setTimeout(() => setCopied(false), 1800);
  };

  const shareWithApps = async () => {
    if (shareUrl === null) {
      notify("Undangan belum diterbitkan, tautan belum tersedia.");
      return;
    }
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Undangan ${coupleNames}`,
          text:
            eventDateLabel === null
              ? `Undangan pernikahan ${coupleNames}.`
              : `Kami mengundang Anda ke acara pernikahan kami pada ${eventDateLabel}.`,
          url: shareUrl,
        });
        notify("Bagikan dibuka");
      } catch {
        notify("Berbagi dibatalkan");
      }
      return;
    }
    await copyInvitationUrl();
  };

  const shareToWhatsApp = () => {
    if (shareUrl === null) {
      notify("Undangan belum diterbitkan, tautan belum tersedia.");
      return;
    }
    const text = encodeURIComponent(
      eventDateLabel === null
        ? `Undangan pernikahan ${coupleNames}: ${shareUrl}`
        : `Undangan pernikahan ${coupleNames} pada ${eventDateLabel}: ${shareUrl}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
    notify("WhatsApp dibuka di tab baru");
  };

  const downloadInvitationArtwork = () => {
    const safeNames = coupleNames.replaceAll("&", "dan");
    const artwork = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c98283"/><stop offset=".52" stop-color="#f0d5cd"/><stop offset="1" stop-color="#fff7f2"/></linearGradient></defs><rect width="1080" height="1350" fill="url(#bg)"/><rect x="58" y="58" width="964" height="1234" rx="42" fill="none" stroke="#ffffff" stroke-opacity=".8" stroke-width="3"/><text x="540" y="445" text-anchor="middle" fill="#fff" font-family="Georgia,serif" font-size="36" letter-spacing="12">THE WEDDING OF</text><text x="540" y="650" text-anchor="middle" fill="#fff" font-family="Georgia,serif" font-size="104">${safeNames}</text><text x="540" y="770" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="31" letter-spacing="5">${(eventDateLabel ?? "TANGGAL ACARA BELUM DIISI").toUpperCase()}</text></svg>`;
    const file = new Blob([artwork], { type: "image/svg+xml;charset=utf-8" });
    const href = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = href;
    link.download = `undangan-${coupleNames
      .toLocaleLowerCase("id-ID")
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-+|-+$/g, "")}.svg`;
    link.click();
    URL.revokeObjectURL(href);
    notify("Gambar undangan berhasil diunduh");
  };

  const downloadQrCode = () => {
    const svg = document.querySelector<SVGElement>("#prototype-invitation-qr");
    if (!svg) {
      notify("QR Code belum siap diunduh");
      return;
    }
    const source = new XMLSerializer().serializeToString(svg);
    const file = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const href = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = href;
    link.download = "qr-undangan.svg";
    link.click();
    URL.revokeObjectURL(href);
    notify("QR Code berhasil diunduh");
  };

  const decideMessage = async (decision: GuestbookModerationStatus) => {
    if (selectedMessage === null) return;
    setModerationPending(true);
    try {
      const outcome = await moderateGuestbookAction(
        selectedMessage.id,
        decision,
      );
      if (outcome.kind !== "ok") {
        notify(
          outcome.kind === "forbidden"
            ? "Anda tidak memiliki izin untuk meninjau ucapan ini."
            : outcome.kind === "not-found"
              ? "Ucapan ini tidak ditemukan di workspace Anda."
              : "Keputusan belum dapat disimpan. Silakan coba lagi.",
        );
        return;
      }
      setModeration((current) => ({
        ...current,
        [selectedMessage.id]: decision,
      }));
      notify(
        decision === "APPROVED"
          ? "Ucapan ditampilkan pada undangan."
          : decision === "REJECTED"
            ? "Ucapan ditolak dan tidak ditampilkan."
            : "Ucapan disembunyikan.",
      );
      closeDialog();
      setSelectedMessage(null);
    } finally {
      setModerationPending(false);
    }
  };

  const closeSearch = () => {
    setSearch("");
    setSearchOpen(false);
  };

  const sidebar = (onNavigate: () => void) => (
    <div className="prototype-sidebar-inner">
      <div className="prototype-brand-lockup">
        <span className="prototype-brand-mark">
          <Heart size={20} />
        </span>
        <span>
          <strong>Undangania</strong>
          <small>Undangan Digital, Cerita Abadi</small>
        </span>
      </div>
      <div className="prototype-workspace-switcher">
        <span className="prototype-avatar">{view?.initials ?? "U"}</span>
        <span>
          <small>{view?.roleLabel ?? "Workspace"}</small>
          <strong>{coupleNames}</strong>
        </span>
        <ChevronDown size={15} />
      </div>
      <nav className="prototype-sidebar-nav" aria-label="Menu dashboard">
        <span className="prototype-sidebar-nav__label">MENU UTAMA</span>
        {NAV_ITEMS.map(({ label, icon: Icon, href }) =>
          href === null ? (
            <span
              key={label}
              className="prototype-sidebar-link is-unavailable"
              aria-disabled="true"
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              <span className="prototype-sidebar-link__soon">Segera hadir</span>
            </span>
          ) : (
            <Link
              key={label}
              className={`prototype-sidebar-link ${label === "Dashboard" ? "is-active" : ""}`}
              aria-current={label === "Dashboard" ? "page" : undefined}
              href={href}
              onClick={onNavigate}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Buku Tamu" && guestbookPendingCount > 0 ? (
                <span className="prototype-sidebar-count">
                  {guestbookPendingCount}
                </span>
              ) : null}
            </Link>
          ),
        )}
      </nav>
      <div className="prototype-sidebar-bottom">
        <div className="prototype-sidebar-help">
          <span className="prototype-sidebar-help__icon">
            <HelpCircle size={16} />
          </span>
          <strong>Butuh bantuan?</strong>
          <p>Lihat pertanyaan umum atau hubungi tim kami.</p>
          <Link href="/#faq">
            Pusat bantuan <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );

  const renderDialog = () => {
    if (!dialog) return null;

    if (dialog === "preview") {
      return (
        <OverlayDialog
          title="Preview Mobile"
          description="Begini tampilan undangan Anda di ponsel tamu."
          onClose={closeDialog}
          size="preview"
          reduceMotion={reduceMotion}
        >
          <div className="prototype-preview-stage">
            <MobileInvitationPreview
              title={coupleNames}
              date={invitationArtDate}
              href={shareUrl}
            />
          </div>
        </OverlayDialog>
      );
    }

    if (dialog === "share") {
      return (
        <OverlayDialog
          title="Bagikan Undangan"
          description="Pilih cara membagikan tautan undangan Anda."
          onClose={closeDialog}
          size="wide"
          reduceMotion={reduceMotion}
        >
          <div className="prototype-share-layout">
            <div className="prototype-share-options">
              {shareUrl === null ? (
                <p className="prototype-section-note">
                  <Globe2 size={15} /> Undangan belum diterbitkan. Terbitkan
                  undangan Anda dari editor agar tautan dapat dibagikan.
                </p>
              ) : (
                <div className="prototype-share-link">
                  <Link2 size={17} />
                  <span>{displayUrl}</span>
                  <button
                    className="prototype-icon-button"
                    onClick={() => void copyInvitationUrl()}
                    aria-label="Salin URL undangan"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              )}
              <div className="prototype-share-grid">
                <button onClick={() => void copyInvitationUrl()}>
                  <Copy size={17} />
                  <span>Salin URL</span>
                </button>
                <button onClick={shareToWhatsApp}>
                  <MessageCircle size={17} />
                  <span>WhatsApp</span>
                </button>
                <button onClick={() => void shareWithApps()}>
                  <Share2 size={17} />
                  <span>Aplikasi lain</span>
                </button>
                <button onClick={downloadInvitationArtwork}>
                  <ImageIcon size={17} />
                  <span>Unduh gambar undangan</span>
                </button>
                <Link href="/tamu">
                  <Users size={17} />
                  <span>Kirim ke daftar tamu</span>
                </Link>
              </div>
            </div>
            <div className="prototype-qr-panel">
              <div id="prototype-qr-download" className="prototype-qr-panel__code">
                {shareUrl === null ? (
                  <p className="prototype-section-note">
                    QR Code tampil setelah undangan diterbitkan.
                  </p>
                ) : (
                  <QRCodeSVG
                    id="prototype-invitation-qr"
                    value={shareUrl}
                    size={144}
                    level="H"
                    includeMargin
                    title={`QR Code undangan ${coupleNames}`}
                    bgColor="#ffffff"
                    fgColor="#633f43"
                  />
                )}
              </div>
              <h3>QR Code undangan</h3>
              <p>Pindai kode ini untuk membuka undangan Anda.</p>
              <button
                className="prototype-button prototype-button--outline prototype-button--full"
                onClick={downloadQrCode}
                disabled={shareUrl === null}
              >
                <Download size={16} /> Unduh QR Code
              </button>
            </div>
          </div>
        </OverlayDialog>
      );
    }

    if (dialog === "steps" && view !== null) {
      return (
        <OverlayDialog
          title="Langkah pengaturan"
          description={`${view.completion.done} dari ${view.completion.total} langkah selesai.`}
          onClose={closeDialog}
          size="standard"
          reduceMotion={reduceMotion}
        >
          <div className="prototype-step-list">
            {view.completion.items.map((step, index) =>
              step.href === null ? (
                <div className="prototype-step-row" key={step.id}>
                  <span
                    className={`prototype-step-row__number ${step.done ? "is-done" : ""}`}
                  >
                    {step.done ? <Check size={15} /> : index + 1}
                  </span>
                  <span>{step.label}</span>
                  <span className="prototype-step-row__status">
                    {step.done ? "Selesai" : "Perlu dilengkapi"}
                  </span>
                </div>
              ) : (
                <Link
                  className="prototype-step-row"
                  key={step.id}
                  href={step.href}
                  onClick={closeDialog}
                >
                  <span
                    className={`prototype-step-row__number ${step.done ? "is-done" : ""}`}
                  >
                    {step.done ? <Check size={15} /> : index + 1}
                  </span>
                  <span>{step.label}</span>
                  <span className="prototype-step-row__status">
                    {step.done ? "Selesai" : "Perlu dilengkapi"}
                  </span>
                  <ChevronRight size={16} />
                </Link>
              ),
            )}
          </div>
        </OverlayDialog>
      );
    }

    if (dialog === "message" && selectedMessage !== null) {
      const status = moderation[selectedMessage.id] ?? selectedMessage.status;
      return (
        <OverlayDialog
          title="Pesan buku tamu"
          description={`${selectedMessage.displayName} · ${selectedMessage.submittedLabel}`}
          onClose={closeDialog}
          size="standard"
          reduceMotion={reduceMotion}
        >
          <blockquote className="prototype-message-quote">
            “{selectedMessage.message}”
          </blockquote>
          <div className="prototype-message-status">
            <span>Status moderasi</span>
            <StatusBadge variant={moderationVariant(status)}>
              {MODERATION_LABELS[status]}
            </StatusBadge>
          </div>
          <div className="prototype-dialog__actions prototype-dialog__actions--moderation">
            <button
              className="prototype-button prototype-button--soft-green"
              onClick={() => void decideMessage("APPROVED")}
              disabled={moderationPending || status === "APPROVED"}
            >
              Tampilkan
            </button>
            <button
              className="prototype-button prototype-button--soft-amber"
              onClick={() => void decideMessage("HIDDEN")}
              disabled={moderationPending || status === "HIDDEN"}
            >
              Sembunyikan
            </button>
            <button
              className="prototype-button prototype-button--soft-rose"
              onClick={() => setDialog("confirm-reject")}
              disabled={moderationPending || status === "REJECTED"}
            >
              Tolak
            </button>
          </div>
        </OverlayDialog>
      );
    }

    if (dialog === "confirm-reject" && selectedMessage !== null) {
      return (
        <OverlayDialog
          title="Tolak pesan ini?"
          description="Pesan ini tidak akan ditampilkan pada undangan Anda."
          onClose={closeDialog}
          size="standard"
          reduceMotion={reduceMotion}
        >
          <div className="prototype-confirm-preview">
            <MessageCircle size={18} />
            <span>{selectedMessage.displayName}</span>
          </div>
          <div className="prototype-dialog__actions">
            <button
              className="prototype-button prototype-button--outline"
              onClick={() => setDialog("message")}
              disabled={moderationPending}
            >
              Kembali
            </button>
            <button
              className="prototype-button prototype-button--danger"
              onClick={() => void decideMessage("REJECTED")}
              disabled={moderationPending}
            >
              Ya, tolak
            </button>
          </div>
        </OverlayDialog>
      );
    }

    return null;
  };

  return (
    <div className="prototype-app min-h-dvh">
      <aside className="prototype-sidebar" aria-label="Navigasi utama">
        {sidebar(() => undefined)}
      </aside>

      <AnimatePresence>
        {drawerOpen ? (
          <>
            <motion.button
              className="prototype-drawer-scrim"
              aria-label="Tutup navigasi"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className="prototype-drawer"
              aria-label="Navigasi utama"
              initial={reduceMotion ? false : { x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            >
              <button
                className="prototype-drawer__close prototype-icon-button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Tutup navigasi"
              >
                <X size={20} />
              </button>
              {sidebar(() => setDrawerOpen(false))}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className="prototype-main-column">
        <header className="prototype-topbar">
          <button
            className="prototype-menu-button prototype-icon-button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Buka navigasi"
          >
            <Menu size={20} />
          </button>
          <div className="prototype-mobile-brand">
            <span className="prototype-brand-mark">
              <Heart size={18} />
            </span>
            <span>Undangania</span>
          </div>

          {view !== null ? (
            <div className="prototype-search-wrap">
              <div className="prototype-search">
                <Search size={17} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") closeSearch();
                    if (event.key === "Enter" && searchResults[0]) {
                      window.location.assign(searchResults[0].href);
                    }
                  }}
                  placeholder="Cari menu, template, atau pesanan..."
                  aria-label="Cari menu, template, atau pesanan"
                  role="combobox"
                  aria-expanded={searchOpen && search.trim().length > 0}
                  aria-controls="prototype-search-results"
                />
                {search ? (
                  <button
                    className="prototype-search__clear"
                    onClick={() => setSearch("")}
                    aria-label="Hapus pencarian"
                  >
                    <X size={15} />
                  </button>
                ) : null}
              </div>
              <AnimatePresence>
                {searchOpen && search.trim() ? (
                  <motion.div
                    id="prototype-search-results"
                    className="prototype-search-results"
                    initial={reduceMotion ? false : { opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    role="listbox"
                  >
                    {searchResults.length > 0 ? (
                      searchResults.map((result) => (
                        <Link
                          key={`${result.kind}-${result.label}`}
                          href={result.href}
                          onClick={closeSearch}
                          role="option"
                          aria-selected="false"
                        >
                          <span>{result.label}</span>
                          <small>{result.kind}</small>
                        </Link>
                      ))
                    ) : (
                      <p>Tidak ada hasil yang cocok.</p>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}

          <div className="prototype-topbar__actions">
            {view !== null ? (
              <button
                className="prototype-icon-button prototype-mobile-search-button"
                onClick={() => {
                  setSearchOpen((current) => !current);
                  window.setTimeout(() => searchInputRef.current?.focus(), 0);
                }}
                aria-label="Cari"
              >
                <Search size={19} />
              </button>
            ) : null}

            {view !== null ? (
              <div className="prototype-menu-anchor">
                <button
                  className="prototype-icon-button prototype-notification-button"
                  onClick={() => setNotificationsOpen((current) => !current)}
                  aria-label={`Notifikasi, ${notices.length} item`}
                  aria-expanded={notificationsOpen}
                >
                  <Bell size={19} />
                  {notices.length > 0 ? (
                    <span className="prototype-notification-count">
                      {notices.length}
                    </span>
                  ) : null}
                </button>
                <AnimatePresence>
                  {notificationsOpen ? (
                    <motion.div
                      className="prototype-popover prototype-notifications"
                      initial={reduceMotion ? false : { opacity: 0, y: -7 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -7 }}
                    >
                      <div className="prototype-popover__heading">
                        <strong>Notifikasi</strong>
                        <button
                          className="prototype-icon-button"
                          onClick={() => setNotificationsOpen(false)}
                          aria-label="Tutup notifikasi"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {notices.length === 0 ? (
                        <p className="prototype-notification-empty">
                          Tidak ada pemberitahuan. Semua sudah beres.
                        </p>
                      ) : (
                        notices.map((notice) => (
                          <Link
                            className="prototype-notification-item"
                            key={notice.id}
                            href={notice.href}
                            onClick={() => setNotificationsOpen(false)}
                          >
                            <span
                              className={`prototype-notification-item__icon ${notice.amber ? "is-amber" : ""}`}
                            >
                              <Bell size={15} />
                            </span>
                            <span>
                              {notice.text}
                              <small>{notice.hint}</small>
                            </span>
                          </Link>
                        ))
                      )}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}

            {view !== null ? (
              <div className="prototype-menu-anchor prototype-profile-anchor">
                <button
                  className="prototype-profile-button"
                  onClick={() => setProfileOpen((current) => !current)}
                  aria-expanded={profileOpen}
                >
                  <span className="prototype-avatar">{view.initials}</span>
                  <span className="prototype-profile-copy">
                    <strong>{coupleNames}</strong>
                    <small>{view.roleLabel}</small>
                  </span>
                  <ChevronDown size={16} />
                </button>
                <AnimatePresence>
                  {profileOpen ? (
                    <motion.div
                      className="prototype-popover prototype-profile-menu"
                      initial={reduceMotion ? false : { opacity: 0, y: -7 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -7 }}
                    >
                      <div className="prototype-profile-menu__summary">
                        <span className="prototype-avatar">{view.initials}</span>
                        <span>
                          <strong>{coupleNames}</strong>
                          <small>{view.roleLabel}</small>
                        </span>
                      </div>
                      <Link href="/mulai" onClick={() => setProfileOpen(false)}>
                        <Settings size={16} /> Profil pernikahan
                      </Link>
                      <Link href="/#faq" onClick={() => setProfileOpen(false)}>
                        <HelpCircle size={16} /> Bantuan &amp; pertanyaan umum
                      </Link>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : (
              <div className="prototype-topbar__guest">
                <Link
                  className="prototype-button prototype-button--outline"
                  href={signInHref("/dashboard")}
                >
                  Masuk
                </Link>
                <Link
                  className="prototype-button prototype-button--primary"
                  href="/daftar?next=%2Fdashboard"
                >
                  Buat akun
                </Link>
              </div>
            )}
          </div>
          <AnimatePresence>
            {searchOpen && search.trim() ? (
              <button
                className="prototype-search-dismiss"
                aria-label="Tutup hasil pencarian"
                onClick={() => setSearchOpen(false)}
              />
            ) : null}
          </AnimatePresence>
        </header>

        {searchOpen && view !== null ? (
          <div className="prototype-mobile-search-row">
            <div className="prototype-search">
              <Search size={17} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari menu, template, atau pesanan..."
                aria-label="Cari"
              />
              <button
                className="prototype-search__clear"
                onClick={closeSearch}
                aria-label="Tutup pencarian"
              >
                <X size={15} />
              </button>
            </div>
            {search.trim() ? (
              <div className="prototype-search-results prototype-search-results--mobile">
                {searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <Link
                      key={`${result.kind}-${result.label}`}
                      href={result.href}
                      onClick={closeSearch}
                    >
                      <span>{result.label}</span>
                      <small>{result.kind}</small>
                    </Link>
                  ))
                ) : (
                  <p>Tidak ada hasil yang cocok.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <main className="prototype-main" id="prototype-home">
          <div className="prototype-main__inner">
            {dashboard.kind === "unauthenticated" ? (
              <header className="prototype-welcome">
                <div>
                  <p className="prototype-eyebrow">Dashboard customer</p>
                  <h1>Anda belum masuk</h1>
                  <p>
                    Masuk untuk melihat workspace pernikahan dan melanjutkan
                    persiapan undangan Anda.
                  </p>
                </div>
              </header>
            ) : null}

            {dashboard.kind === "unavailable" ? (
              <div className="prototype-error-panel" role="alert">
                <span className="prototype-error-panel__icon">
                  <AlertCircle size={22} />
                </span>
                <div>
                  <h2>Dasbor tidak dapat dimuat</h2>
                  <p>
                    Layanan workspace sedang tidak tersedia. Coba muat ulang
                    halaman ini atau hubungi bantuan bila masalah berlanjut.
                  </p>
                </div>
                <Link
                  className="prototype-button prototype-button--outline"
                  href="/dashboard"
                >
                  Coba lagi
                </Link>
              </div>
            ) : null}

            {dashboard.kind === "unauthenticated" ? (
              <Card className="prototype-span-8">
                <EmptyPanel
                  icon={UserRound}
                  title="Masuk ke Undangania"
                  description="Gunakan email dan kata sandi, atau lanjutkan dengan akun Google untuk membuka dashboard Anda."
                  action={
                    <div className="prototype-action-row">
                      <Link
                        className="prototype-button prototype-button--primary"
                        href={signInHref("/dashboard")}
                      >
                        Masuk
                      </Link>
                      <Link
                        className="prototype-button prototype-button--outline"
                        href="/daftar?next=%2Fdashboard"
                      >
                        Buat akun
                      </Link>
                    </div>
                  }
                />
              </Card>
            ) : null}

            {view !== null ? (
              <>
                <header className="prototype-welcome">
                  <div>
                    <p className="prototype-eyebrow">Ringkasan workspace</p>
                    <h1>
                      Selamat datang, {coupleNames}!{" "}
                      <span aria-hidden="true">👋</span>
                    </h1>
                    <p>
                      {view.status.reason}
                      {view.city === null ? "" : ` · ${view.city}`}
                    </p>
                  </div>
                  <StatusBadge variant={toneVariant(view.status.tone)}>
                    {view.status.label}
                  </StatusBadge>
                </header>

                {offline ? (
                  <div
                    className="prototype-state-banner prototype-state-banner--offline"
                    role="status"
                  >
                    <WifiOff size={19} />
                    <div>
                      <strong>Anda sedang offline</strong>
                      <span>
                        Data yang tampil mungkin sudah lama. Sambungkan kembali
                        internet untuk memperbarui.
                      </span>
                    </div>
                    <button onClick={() => window.location.reload()}>
                      Muat ulang
                    </button>
                  </div>
                ) : null}

                {view.status.state === "NEW" ? (
                  <div className="prototype-empty-invitation">
                    <EmptyPanel
                      icon={Heart}
                      title="Mulai dengan undangan pertama Anda"
                      description="Pilih desain, isi detail acara, lalu bagikan undangan digital kepada tamu."
                      action={
                        <div className="prototype-action-row">
                          <Link
                            className="prototype-button prototype-button--primary"
                            href="/templates"
                          >
                            <LayoutGrid size={16} /> Pilih Template
                          </Link>
                          <Link
                            className="prototype-button prototype-button--outline"
                            href="/mulai"
                          >
                            Isi Data Pernikahan
                          </Link>
                        </div>
                      }
                    />
                    {templates.length > 0 ? (
                      <TemplateRecommendations templates={templates} />
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="prototype-grid-12">
                      <Card className="prototype-span-7 prototype-invitation-card">
                        <div className="prototype-invitation-card__art">
                          <InvitationArtwork
                            title={coupleNames}
                            date={invitationArtDate}
                            compact
                          />
                        </div>
                        <div
                          className="prototype-invitation-card__body"
                          id="prototype-invitation"
                        >
                          <div className="prototype-invitation-card__topline">
                            <div className="prototype-invitation-card__badges">
                              <StatusBadge
                                variant={toneVariant(view.status.tone)}
                              >
                                {view.status.label}
                              </StatusBadge>
                              {view.invitation?.templateName ? (
                                <StatusBadge variant="gold">
                                  {view.invitation.templateName}
                                </StatusBadge>
                              ) : null}
                            </div>
                            <div className="prototype-invitation-progress">
                              <span>Progress undangan</span>
                              <strong>{view.completion.percent}%</strong>
                            </div>
                          </div>
                          <h2>{coupleNames}</h2>
                          <p className="prototype-invitation-card__template">
                            {view.invitation?.templateName === null ||
                            view.invitation === null
                              ? "Desain belum dipilih"
                              : `Template ${view.invitation.templateName}`}
                          </p>

                          {view.invitation === null ? (
                            <p className="prototype-section-note">
                              <AlertCircle size={15} /> Detail undangan belum
                              dapat dimuat. Muat ulang halaman ini untuk
                              mencoba lagi.
                            </p>
                          ) : view.invitation.shareUrl === null ? (
                            <p className="prototype-section-note">
                              <Globe2 size={15} /> Tautan undangan aktif setelah
                              undangan diterbitkan dari editor.
                            </p>
                          ) : (
                            <div className="prototype-link-row">
                              <Globe2 size={16} />
                              <span>{view.invitation.displayUrl}</span>
                              <button
                                className="prototype-icon-button"
                                onClick={() => void copyInvitationUrl()}
                                aria-label="Salin URL undangan"
                              >
                                {copied ? (
                                  <Check size={16} />
                                ) : (
                                  <Copy size={16} />
                                )}
                              </button>
                            </div>
                          )}

                          <div className="prototype-invitation-meta">
                            {view.invitation?.activeUntilLabel ? (
                              <span>
                                <Clock3 size={14} /> Masa aktif hingga{" "}
                                {view.invitation.activeUntilLabel}
                              </span>
                            ) : null}
                            <span>
                              <CalendarDays size={14} />{" "}
                              {eventDateLabel === null
                                ? "Tanggal acara belum diisi"
                                : `Acara ${eventDateLabel}`}
                            </span>
                          </div>

                          {view.paymentPending ? (
                            <p className="prototype-inline-notice">
                              <CreditCard size={14} /> Pembayaran belum selesai.
                              Selesaikan pembayaran agar undangan dapat
                              diterbitkan.
                            </p>
                          ) : null}
                          {view.expiryWarning !== null ? (
                            <p className="prototype-inline-notice prototype-inline-notice--amber">
                              <Clock3 size={14} /> {view.expiryWarning}
                            </p>
                          ) : null}

                          <div className="prototype-invitation-actions">
                            <Link
                              className="prototype-button prototype-button--primary"
                              href={primaryAction.href}
                            >
                              <Edit3 size={16} /> {primaryAction.title}
                            </Link>
                            {view.invitation?.shareUrl ? (
                              <a
                                className="prototype-button prototype-button--outline"
                                href={view.invitation.shareUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Eye size={16} /> Preview
                              </a>
                            ) : (
                              <Link
                                className="prototype-button prototype-button--outline"
                                href="/editor"
                              >
                                <Eye size={16} /> Preview
                              </Link>
                            )}
                            <button
                              className="prototype-button prototype-button--outline"
                              onClick={() => setDialog("share")}
                            >
                              <Share2 size={16} /> Bagikan
                            </button>
                            <button
                              className="prototype-button prototype-button--quiet"
                              onClick={() => setDialog("preview")}
                            >
                              <Smartphone size={16} /> Preview Mobile
                            </button>
                          </div>
                        </div>
                      </Card>

                      <Card className="prototype-span-5 prototype-progress-card">
                        <SectionHeading
                          title="Progress undangan"
                          description={`${view.completion.done} dari ${view.completion.total} langkah selesai`}
                          action={
                            <span className="prototype-progress-ring">
                              {view.completion.percent}%
                            </span>
                          }
                        />
                        <div
                          className="prototype-progress-track"
                          role="progressbar"
                          aria-label="Progress undangan"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={view.completion.percent}
                        >
                          <motion.span
                            initial={reduceMotion ? false : { width: 0 }}
                            animate={{ width: `${view.completion.percent}%` }}
                            transition={{ duration: reduceMotion ? 0 : 0.7 }}
                          />
                        </div>
                        <div className="prototype-progress-preview">
                          {view.completion.items.slice(0, 4).map((step, index) => (
                            <div className="prototype-progress-row" key={step.id}>
                              <span
                                className={`prototype-progress-row__icon ${step.done ? "is-done" : ""}`}
                              >
                                {step.done ? <Check size={13} /> : <span>{index + 1}</span>}
                              </span>
                              <span>{step.label}</span>
                              {step.done ? (
                                <small>Selesai</small>
                              ) : (
                                <small>Berikutnya</small>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="prototype-next-step">
                          <Sparkles size={17} />
                          <span>
                            <strong>Langkah berikutnya</strong>{" "}
                            {view.completion.nextStep === null
                              ? "Semua langkah selesai. Bagikan undangan Anda kepada tamu."
                              : view.completion.nextStep.label}
                          </span>
                        </div>
                        <div className="prototype-progress-actions">
                          {view.completion.nextStep?.href ? (
                            <Link
                              className="prototype-button prototype-button--primary"
                              href={view.completion.nextStep.href}
                            >
                              Lanjutkan <ArrowRight size={15} />
                            </Link>
                          ) : (
                            <button
                              className="prototype-button prototype-button--primary"
                              onClick={() => setDialog("share")}
                            >
                              Bagikan <ArrowRight size={15} />
                            </button>
                          )}
                          <button
                            className="prototype-button prototype-button--outline"
                            onClick={() => setDialog("steps")}
                          >
                            Lihat Semua Langkah
                          </button>
                        </div>
                      </Card>
                    </div>

                    <section
                      className="prototype-quick-section"
                      aria-labelledby="prototype-quick-title"
                    >
                      <SectionHeading
                        id="prototype-quick-title"
                        title="Aksi cepat"
                        description="Akses fitur undangan yang paling sering digunakan."
                      />
                      <div className="prototype-quick-grid">
                        {QUICK_ACTIONS.map(
                          ({ label, description, icon: Icon, color, href }) =>
                            href === null ? (
                              <button
                                key={label}
                                className="prototype-quick-action"
                                onClick={() => setDialog("share")}
                              >
                                <span
                                  className={`prototype-quick-action__icon prototype-quick-action__icon--${color}`}
                                >
                                  <Icon size={18} />
                                </span>
                                <span className="prototype-quick-action__copy">
                                  <strong>{label}</strong>
                                  <small>{description}</small>
                                </span>
                                <ChevronRight
                                  size={15}
                                  className="prototype-quick-action__chevron"
                                />
                              </button>
                            ) : (
                              <Link
                                key={label}
                                className="prototype-quick-action"
                                href={href}
                              >
                                <span
                                  className={`prototype-quick-action__icon prototype-quick-action__icon--${color}`}
                                >
                                  <Icon size={18} />
                                </span>
                                <span className="prototype-quick-action__copy">
                                  <strong>{label}</strong>
                                  <small>{description}</small>
                                </span>
                                <ChevronRight
                                  size={15}
                                  className="prototype-quick-action__chevron"
                                />
                              </Link>
                            ),
                        )}
                      </div>
                    </section>

                    <div className="prototype-grid-12">
                      <Card className="prototype-span-8 prototype-analytics-card">
                        <SectionHeading
                          title="Statistik undangan"
                          description="Interaksi tamu dari data tamu dan RSVP Anda."
                        />
                        {view.rsvp === null && view.guests === null ? (
                          <p className="prototype-section-note">
                            <AlertCircle size={15} /> Statistik belum dapat
                            dimuat. Muat ulang halaman ini untuk mencoba lagi.
                          </p>
                        ) : (
                          <div
                            className="prototype-metrics"
                            aria-label="Ringkasan statistik undangan"
                          >
                            <StatMetric
                              icon={Users}
                              label="Tamu diundang"
                              value={
                                view.guests === null
                                  ? "—"
                                  : formatNumber(view.guests.guestCount)
                              }
                            />
                            <StatMetric
                              icon={UserRound}
                              label="Grup tamu"
                              value={
                                view.guests === null
                                  ? "—"
                                  : formatNumber(view.guests.householdCount)
                              }
                            />
                            <StatMetric
                              icon={CheckCheck}
                              label="Sudah menjawab"
                              value={
                                view.rsvp === null
                                  ? "—"
                                  : formatNumber(view.rsvp.answered)
                              }
                            />
                            <StatMetric
                              icon={Check}
                              label="Hadir"
                              value={
                                view.rsvp === null
                                  ? "—"
                                  : formatNumber(view.rsvp.attending)
                              }
                            />
                            <StatMetric
                              icon={X}
                              label="Berhalangan"
                              value={
                                view.rsvp === null
                                  ? "—"
                                  : formatNumber(view.rsvp.declined)
                              }
                            />
                            <StatMetric
                              icon={Clock3}
                              label="Mungkin"
                              value={
                                view.rsvp === null
                                  ? "—"
                                  : formatNumber(view.rsvp.tentative)
                              }
                            />
                            <StatMetric
                              icon={MessageCircle}
                              label="Belum menjawab"
                              value={
                                view.rsvp === null
                                  ? "—"
                                  : formatNumber(view.rsvp.pending)
                              }
                            />
                            <StatMetric
                              icon={BookOpen}
                              label="Ucapan buku tamu"
                              value={formatNumber(guestbookRows.length)}
                            />
                          </div>
                        )}
                        <div className="prototype-chart-heading">
                          <div>
                            <strong>Kunjungan undangan</strong>
                            <span>Jumlah kunjungan harian undangan Anda</span>
                          </div>
                        </div>
                        <figure
                          className="prototype-chart"
                          aria-label="Grafik kunjungan undangan"
                        >
                          <p className="prototype-section-note">
                            <AlertCircle size={15} /> Grafik kunjungan belum
                            tersedia. Statistik kunjungan per hari belum dapat
                            ditampilkan; angka RSVP di atas selalu diperbarui
                            dari data tamu Anda.
                          </p>
                        </figure>
                      </Card>

                      <Card className="prototype-span-4 prototype-countdown-card">
                        <div className="prototype-countdown-card__top">
                          <span className="prototype-countdown-icon">
                            <CalendarDays size={19} />
                          </span>
                          <span className="prototype-countdown-caption">
                            Menuju hari bahagia
                          </span>
                        </div>
                        <h2>{view.weddingDateLabel ?? "Tanggal acara belum diisi"}</h2>
                        {view.countdown.kind === "future" ? (
                          <div className="prototype-countdown-values prototype-countdown-values--duo">
                            <div>
                              <strong>{formatNumber(view.countdown.days)}</strong>
                              <span>Hari</span>
                            </div>
                            <div>
                              <strong>{formatNumber(view.countdown.weeks)}</strong>
                              <span>Minggu</span>
                            </div>
                          </div>
                        ) : (
                          <p className="prototype-section-note">
                            <CalendarDays size={15} /> {view.countdown.label}
                          </p>
                        )}
                        <Link
                          className="prototype-button prototype-button--outline prototype-button--full"
                          href="/editor?section=events"
                        >
                          Ubah Tanggal
                        </Link>
                        <div className="prototype-countdown-divider" />
                        {view.rsvp === null ? (
                          <p className="prototype-section-note">
                            <AlertCircle size={15} /> Ringkasan RSVP belum
                            tersedia.
                          </p>
                        ) : (
                          <>
                            <div className="prototype-response-rate">
                              <strong>Tingkat respons</strong>
                              <span>{view.rsvp.responseRate}%</span>
                            </div>
                            <div className="prototype-response-track">
                              <span
                                className={view.rsvp.invited === 0 ? "is-empty" : ""}
                                style={{ width: `${view.rsvp.responseRate}%` }}
                              />
                            </div>
                            <div className="prototype-countdown-attendance">
                              <div>
                                <strong>{formatNumber(view.rsvp.attending)}</strong>
                                <span>Hadir</span>
                              </div>
                              <div>
                                <strong>{formatNumber(view.rsvp.declined)}</strong>
                                <span>Tidak hadir</span>
                              </div>
                              <div>
                                <strong>{formatNumber(view.rsvp.tentative)}</strong>
                                <span>Ragu</span>
                              </div>
                            </div>
                          </>
                        )}
                      </Card>
                    </div>

                    <div className="prototype-grid-12">
                      <Card
                        className="prototype-span-7 prototype-rsvp-card"
                        id="prototype-rsvp"
                      >
                        <SectionHeading
                          title="Tamu & RSVP"
                          description="Ringkasan respons tamu undangan."
                          action={
                            <Link className="prototype-text-button" href="/tamu">
                              Kelola Tamu <ChevronRight size={15} />
                            </Link>
                          }
                        />
                        {view.rsvp === null ? (
                          <p className="prototype-section-note">
                            <AlertCircle size={15} /> Ringkasan RSVP belum
                            tersedia.{" "}
                            <Link href="/rsvp">Buka halaman RSVP</Link> atau{" "}
                            <Link href="/dashboard">muat ulang</Link> halaman
                            ini.
                          </p>
                        ) : view.rsvp.invited === 0 ? (
                          <EmptyPanel
                            icon={Users}
                            title="Belum ada tamu"
                            description="Tambahkan daftar tamu agar Anda dapat mengirim undangan dan memantau konfirmasi kehadiran."
                            action={
                              <div className="prototype-action-row">
                                <Link
                                  className="prototype-button prototype-button--primary"
                                  href="/tamu/baru"
                                >
                                  <Plus size={15} /> Tambah Tamu
                                </Link>
                                <Link
                                  className="prototype-button prototype-button--outline"
                                  href="/tamu/impor"
                                >
                                  Impor Daftar Tamu
                                </Link>
                              </div>
                            }
                          />
                        ) : (
                          <>
                            <div className="prototype-rsvp-total">
                              <strong>
                                {view.guests === null
                                  ? formatNumber(view.rsvp.invited)
                                  : formatNumber(view.guests.guestCount)}
                              </strong>
                              <span>Tamu diundang</span>
                              <StatusBadge variant="green">
                                {view.rsvp.responseRate}% merespons
                              </StatusBadge>
                            </div>
                            <div className="prototype-rsvp-metrics">
                              <div>
                                <strong>{formatNumber(view.rsvp.answered)}</strong>
                                <span>Sudah menjawab</span>
                              </div>
                              <div>
                                <strong>{formatNumber(view.rsvp.attending)}</strong>
                                <span>Hadir</span>
                              </div>
                              <div>
                                <strong>{formatNumber(view.rsvp.declined)}</strong>
                                <span>Tidak hadir</span>
                              </div>
                              <div>
                                <strong>{formatNumber(view.rsvp.tentative)}</strong>
                                <span>Masih ragu</span>
                              </div>
                              <div>
                                <strong>{formatNumber(view.rsvp.pending)}</strong>
                                <span>Belum merespons</span>
                              </div>
                              <div>
                                <strong>
                                  {view.guests === null
                                    ? "—"
                                    : formatNumber(view.guests.householdCount)}
                                </strong>
                                <span>Grup tamu</span>
                              </div>
                            </div>
                          </>
                        )}
                        <div className="prototype-action-row">
                          <Link
                            className="prototype-button prototype-button--outline"
                            href="/tamu/baru"
                          >
                            <Plus size={15} /> Tambah Tamu
                          </Link>
                          <Link
                            className="prototype-button prototype-button--outline"
                            href="/rsvp"
                          >
                            <CheckCheck size={15} /> Lihat RSVP
                          </Link>
                          <Link
                            className="prototype-button prototype-button--quiet"
                            href="/tamu"
                          >
                            Kelola Tamu <ArrowRight size={15} />
                          </Link>
                        </div>
                      </Card>

                      <Card
                        className="prototype-span-5 prototype-guestbook-card"
                        id="prototype-guestbook"
                      >
                        <SectionHeading
                          title="Buku tamu"
                          description="Ucapan terbaru dari keluarga dan teman."
                          action={
                            <Link
                              className="prototype-text-button"
                              href="/buku-tamu"
                            >
                              Moderasi <ChevronRight size={15} />
                            </Link>
                          }
                        />
                        {guestbook.kind === "unavailable" ? (
                          <p className="prototype-section-note">
                            <AlertCircle size={15} /> Buku tamu belum dapat
                            dimuat.{" "}
                            <Link href="/buku-tamu">Buka halaman buku tamu</Link>{" "}
                            atau <Link href="/dashboard">muat ulang</Link>.
                          </p>
                        ) : guestbookRowsWithStatus.length === 0 ? (
                          <EmptyPanel
                            icon={MessageCircle}
                            title="Belum ada ucapan"
                            description="Ucapan dari tamu akan muncul di sini setelah undangan dibuka dan mereka mengirim pesan."
                            action={
                              <Link
                                className="prototype-button prototype-button--outline"
                                href="/tamu"
                              >
                                Bagikan Undangan
                              </Link>
                            }
                          />
                        ) : (
                          <div className="prototype-guestbook-list">
                            {guestbookRowsWithStatus
                              .slice(0, 4)
                              .map((message) => (
                                <button
                                  className="prototype-guestbook-message"
                                  key={message.id}
                                  onClick={() => {
                                    setSelectedMessage(message);
                                    setDialog("message");
                                  }}
                                >
                                  <span className="prototype-guestbook-message__mark">
                                    <MessageCircle size={16} />
                                  </span>
                                  <span className="prototype-guestbook-message__copy">
                                    <span className="prototype-guestbook-message__top">
                                      <strong>{message.displayName}</strong>
                                      <small>{message.submittedLabel}</small>
                                    </span>
                                    <span className="prototype-guestbook-message__text">
                                      {message.message}
                                    </span>
                                    <span className="prototype-guestbook-message__status">
                                      <StatusBadge
                                        variant={moderationVariant(message.status)}
                                      >
                                        {MODERATION_LABELS[message.status]}
                                      </StatusBadge>
                                    </span>
                                  </span>
                                  <ChevronRight
                                    className="prototype-guestbook-message__chevron"
                                    size={16}
                                  />
                                </button>
                              ))}
                          </div>
                        )}
                        <div className="prototype-guestbook-footer">
                          <span>
                            {formatNumber(guestbookRowsWithStatus.length)} ucapan
                            {guestbookPendingCount > 0
                              ? ` · ${formatNumber(guestbookPendingCount)} menunggu tinjauan`
                              : ""}
                          </span>
                          <Link className="prototype-text-button" href="/buku-tamu">
                            Kelola buku tamu <ArrowRight size={14} />
                          </Link>
                        </div>
                      </Card>
                    </div>

                    <Card className="prototype-orders-card" id="prototype-orders">
                      <SectionHeading
                        title="Pesanan saya"
                        description="Riwayat pembelian desain dan paket undangan."
                        action={
                          <Link className="prototype-text-button" href="/pesanan">
                            Lihat semua pesanan <ArrowRight size={15} />
                          </Link>
                        }
                      />
                      {orders.kind === "unavailable" ? (
                        <p className="prototype-section-note">
                          <AlertCircle size={15} /> Riwayat pesanan belum dapat
                          dimuat.{" "}
                          <Link href="/pesanan">Buka halaman pesanan</Link> atau{" "}
                          <Link href="/dashboard">muat ulang</Link>.
                        </p>
                      ) : orderList.length === 0 ? (
                        <EmptyPanel
                          icon={CreditCard}
                          title="Belum ada pesanan"
                          description="Pesanan dibuat saat Anda melanjutkan pembayaran dari halaman checkout sebuah desain."
                          action={
                            <Link
                              className="prototype-button prototype-button--primary"
                              href="/templates"
                            >
                              Lihat Katalog Desain
                            </Link>
                          }
                        />
                      ) : (
                        <>
                          <div className="prototype-orders-table-wrap">
                            <table className="prototype-orders-table">
                              <thead>
                                <tr>
                                  <th>Nomor pesanan</th>
                                  <th>Tanggal</th>
                                  <th>Desain</th>
                                  <th>Total</th>
                                  <th>Status pembayaran</th>
                                  <th>Aksi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {orderList.map((order) => (
                                  <tr key={order.orderNumber}>
                                    <td>
                                      <strong>{order.orderNumber}</strong>
                                    </td>
                                    <td>{order.createdLabel ?? "—"}</td>
                                    <td>{order.productName}</td>
                                    <td>{order.totalLabel}</td>
                                    <td>
                                      <StatusBadge variant={order.stateTone}>
                                        {order.stateLabel}
                                      </StatusBadge>
                                    </td>
                                    <td>
                                      <Link
                                        className={`prototype-order-action ${
                                          order.state === "PAID" ? "" : "is-primary"
                                        }`}
                                        href={`/checkout/status?order=${encodeURIComponent(order.orderNumber)}`}
                                      >
                                        {order.state === "PAID"
                                          ? "Lihat detail"
                                          : "Bayar / periksa status"}
                                        <ChevronRight size={14} />
                                      </Link>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="prototype-order-cards">
                            {orderList.map((order) => (
                              <article
                                className="prototype-order-mobile-card"
                                key={order.orderNumber}
                              >
                                <div className="prototype-order-mobile-card__top">
                                  <strong>{order.orderNumber}</strong>
                                  <StatusBadge variant={order.stateTone}>
                                    {order.stateLabel}
                                  </StatusBadge>
                                </div>
                                <div className="prototype-order-mobile-card__details">
                                  {order.createdLabel ? (
                                    <span>{order.createdLabel}</span>
                                  ) : null}
                                  <span>{order.productName}</span>
                                  <strong>{order.totalLabel}</strong>
                                </div>
                                <div className="prototype-order-mobile-card__bottom">
                                  <Link
                                    className={`prototype-order-action ${
                                      order.state === "PAID" ? "" : "is-primary"
                                    }`}
                                    href={`/checkout/status?order=${encodeURIComponent(order.orderNumber)}`}
                                  >
                                    {order.state === "PAID"
                                      ? "Lihat detail"
                                      : "Bayar / periksa status"}
                                    <ChevronRight size={14} />
                                  </Link>
                                </div>
                              </article>
                            ))}
                          </div>
                        </>
                      )}
                    </Card>

                    {templates.length > 0 ? (
                      <TemplateRecommendations templates={templates} />
                    ) : null}

                    <footer className="prototype-footer">
                      <div>
                        <span className="prototype-brand-mark">
                          <Heart size={15} />
                        </span>
                        <span>Undangan Digital, Cerita Abadi</span>
                      </div>
                      <Link href="/#faq">Butuh bantuan? Hubungi kami</Link>
                    </footer>
                  </>
                )}
              </>
            ) : null}
          </div>
        </main>
      </div>

      <nav className="prototype-mobile-bottom-nav" aria-label="Navigasi bawah">
        {MOBILE_NAV_ITEMS.map(({ label, icon: Icon, href }) =>
          href === null ? (
            <button
              key={label}
              onClick={() => setDrawerOpen(true)}
              aria-label="Buka menu akun"
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ) : (
            <Link
              key={label}
              className={label === "Beranda" ? "is-active" : ""}
              aria-current={label === "Beranda" ? "page" : undefined}
              href={href}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          ),
        )}
      </nav>

      {view !== null && view.status.state !== "NEW" ? (
        <div className="prototype-sticky-action">
          <Link
            className="prototype-button prototype-button--primary"
            href={primaryAction.href}
          >
            <Edit3 size={17} /> {primaryAction.title}
          </Link>
        </div>
      ) : null}

      <AnimatePresence>{dialog ? renderDialog() : null}</AnimatePresence>
      <AnimatePresence>
        {toast ? (
          <motion.div
            className="prototype-toast"
            role="status"
            aria-live="polite"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
          >
            <Check size={17} />
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const QUICK_ACTIONS = [
  {
    label: "Edit Undangan",
    description: "Ubah isi dan tampilan",
    icon: Edit3,
    color: "rose",
    href: "/editor",
  },
  {
    label: "Data Acara",
    description: "Perbarui tanggal dan lokasi",
    icon: CalendarDays,
    color: "amber",
    href: "/editor?section=events",
  },
  {
    label: "Upload Foto",
    description: "Lengkapi galeri undangan",
    icon: Camera,
    color: "rose",
    href: "/editor?section=gallery",
  },
  {
    label: "Pilih Musik",
    description: "Atur musik undangan",
    icon: Music2,
    color: "amber",
    href: "/editor?section=music",
  },
  {
    label: "Kelola Tamu",
    description: "Atur daftar undangan",
    icon: Users,
    color: "green",
    href: "/tamu",
  },
  {
    label: "Lihat RSVP",
    description: "Pantau konfirmasi hadir",
    icon: CheckCheck,
    color: "green",
    href: "/rsvp",
  },
  {
    label: "Buku Tamu",
    description: "Moderasi ucapan tamu",
    icon: BookOpen,
    color: "amber",
    href: "/buku-tamu",
  },
  {
    label: "Bagikan",
    description: "Kirim tautan undangan",
    icon: Share2,
    color: "rose",
    href: null,
  },
] as const satisfies ReadonlyArray<{
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  href: string | null;
}>;

function StatMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="prototype-metric">
      <span className="prototype-metric__icon">
        <Icon size={15} />
      </span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function TemplateRecommendations({
  templates,
}: {
  templates: readonly TemplateCardView[];
}) {
  return (
    <section
      className="prototype-template-section"
      id="prototype-templates"
      aria-labelledby="prototype-template-heading"
    >
      <SectionHeading
        id="prototype-template-heading"
        title="Rekomendasi template"
        description="Temukan desain yang sesuai dengan cerita Anda."
        action={
          <Link className="prototype-text-button" href="/templates">
            Lihat semua desain <ArrowRight size={15} />
          </Link>
        }
      />
      <div className="prototype-template-grid">
        {templates.map((template) => (
          <article className="prototype-template-card" key={template.id}>
            <div
              className={`prototype-template-art prototype-template-art--${template.art}`}
            >
              <span className="prototype-template-art__badge">
                {template.tierLabel}
              </span>
              <span className="prototype-template-art__ornament">
                <Heart size={21} strokeWidth={1.4} />
              </span>
              <span className="prototype-template-art__names">
                {template.name}
              </span>
              <span className="prototype-template-art__date">
                {template.category.toUpperCase()}
              </span>
            </div>
            <div className="prototype-template-card__body">
              <div className="prototype-template-card__heading">
                <div>
                  <h3>{template.name}</h3>
                  <span>{template.character}</span>
                </div>
                <strong>{template.priceLabel ?? "Harga belum tersedia"}</strong>
              </div>
              <div className="prototype-template-card__actions">
                <Link
                  className="prototype-button prototype-button--outline"
                  href={`/templates/${template.id}/demo`}
                >
                  <Eye size={15} /> Preview
                </Link>
                <Link
                  className="prototype-button prototype-button--primary"
                  href={`/templates/${template.id}`}
                >
                  Gunakan Template
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

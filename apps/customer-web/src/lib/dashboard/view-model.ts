import {
  completionCount,
  completionItems,
  countdownText,
  derivedStatus,
  expiryWarningText,
  formatInvitationDate,
  nextActions,
  type DashboardAction,
  type DashboardAggregate,
  type DashboardRole,
  type DerivedDashboardState,
  type InvitationLifecycle,
  type StatusTone,
} from "./contract";
import { formatIdrMinor, type PaymentStatusState } from "../checkout/contract";
import { todayYmd } from "../onboarding/contract";
import type { OrderListLoad } from "../checkout/orders";
import type { GuestbookOverviewLoad } from "../oversight/server";
import type { VisitStatsLoad } from "./visit-stats-contract";
import {
  TIER_LABELS,
  formatIdr,
  type TemplateRecord,
} from "../../components/templates/template-contract";

/**
 * Dashboard view model.
 *
 * The dashboard page loads real, tenant-scoped data and derives every
 * time-dependent value here, on the server, before handing a plain view model to
 * the interactive client component. Two reasons:
 *
 *   - The contract helpers are business rules; they stay out of the client
 *     bundle (the contract module pulls in Zod) and out of the component tree.
 *   - "Today" is evaluated once per request. Computing a countdown during
 *     hydration could disagree with the server across a midnight boundary.
 *
 * The view model never invents a figure. A section that has no data is `null`
 * and the panel renders its own empty or unavailable state.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Absolute share URL for a path, or null when the site URL is unusable. */
function absoluteUrl(path: string): string | null {
  try {
    return new URL(path, SITE_URL).toString();
  } catch {
    return null;
  }
}

/** Host + path for display, e.g. `undangania.id/invite/andi-siska`. */
function displayUrl(path: string): string | null {
  try {
    const url = new URL(path, SITE_URL);
    return `${url.host}${url.pathname}`;
  } catch {
    return null;
  }
}

/** Initials for the couple avatar; "AS" for "Andi & Siska". */
export function coupleInitials(coupleNames: string | null): string {
  if (coupleNames === null) return "U";
  const words = coupleNames.replaceAll("&", " ").split(/\s+/).filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  return letters === "" ? "U" : letters;
}

export type DashboardStatusView = Readonly<{
  state: DerivedDashboardState;
  label: string;
  tone: StatusTone;
  reason: string;
}>;

export type DashboardInvitationView = Readonly<{
  lifecycle: InvitationLifecycle;
  templateName: string | null;
  slug: string;
  /** Absolute URL of the live invitation, null until it is published. */
  shareUrl: string | null;
  /** Host + path, for display next to the copy control. */
  displayUrl: string | null;
  activeUntilLabel: string | null;
  eventDateLabel: string | null;
}>;

export type DashboardCompletionItemView = Readonly<{
  id: string;
  label: string;
  done: boolean;
  href: string | null;
}>;

export type DashboardCompletionView = Readonly<{
  items: readonly DashboardCompletionItemView[];
  done: number;
  total: number;
  percent: number;
  /** The first unfinished step, i.e. the recommended next action. */
  nextStep: DashboardCompletionItemView | null;
}>;

export type DashboardCountdownView =
  | Readonly<{ kind: "undecided"; label: string }>
  | Readonly<{ kind: "future"; days: number; weeks: number; label: string }>
  | Readonly<{ kind: "today"; label: string }>
  | Readonly<{ kind: "past"; label: string }>;

export type DashboardRsvpView = Readonly<{
  invited: number;
  attending: number;
  declined: number;
  tentative: number;
  pending: number;
  /** invited − pending, the same figure the workspace's RSVP panel reports. */
  answered: number;
  responseRate: number;
}>;

export type DashboardViewModel = Readonly<{
  role: DashboardRole;
  roleLabel: string;
  coupleNames: string | null;
  initials: string;
  city: string | null;
  weddingDateLabel: string | null;
  status: DashboardStatusView;
  invitation: DashboardInvitationView | null;
  completion: DashboardCompletionView;
  countdown: DashboardCountdownView;
  expiryWarning: string | null;
  paymentAvailable: boolean;
  paymentPending: boolean;
  guests: Readonly<{ guestCount: number; householdCount: number }> | null;
  rsvp: DashboardRsvpView | null;
  nextActions: readonly DashboardAction[];
}>;

export function buildDashboardViewModel(
  aggregate: DashboardAggregate,
  today: string = todayYmd(aggregate.workspace.timezone ?? "Asia/Jakarta"),
): DashboardViewModel {
  const status = derivedStatus(aggregate, today);
  const actions = nextActions(aggregate, today);
  const items = completionItems(aggregate);
  const counts = completionCount(items);
  const percent =
    counts.total === 0 ? 0 : Math.round((counts.done / counts.total) * 100);
  const nextStep = items.find((item) => !item.done) ?? null;

  const countdownResult = countdownText(
    aggregate.workspace.weddingDate,
    aggregate.workspace.timezone,
    today,
  );
  const countdown: DashboardCountdownView =
    countdownResult.kind === "future"
      ? {
          kind: "future",
          days: countdownResult.days,
          weeks: Math.floor(countdownResult.days / 7),
          label: countdownResult.label,
        }
      : { kind: countdownResult.kind, label: countdownResult.label };

  const invitationData =
    aggregate.invitation.status === "ok" ? aggregate.invitation.data : null;
  // The share URL follows the stored publication, not the derived lifecycle: the
  // active publication row is what actually makes the invitation reachable.
  const publicPath = invitationData?.publicUrl ?? null;
  const invitation: DashboardInvitationView | null =
    invitationData === null
      ? null
      : {
          lifecycle: invitationData.status,
          templateName: invitationData.templateName,
          slug: invitationData.slug,
          shareUrl: publicPath === null ? null : absoluteUrl(publicPath),
          displayUrl: publicPath === null ? null : displayUrl(publicPath),
          activeUntilLabel:
            invitationData.activeUntil === null
              ? null
              : formatInvitationDate(invitationData.activeUntil),
          eventDateLabel: formatInvitationDate(aggregate.workspace.weddingDate),
        };

  const rsvpData = aggregate.rsvp.status === "ok" ? aggregate.rsvp.data : null;
  const answered =
    rsvpData === null ? 0 : Math.max(0, rsvpData.invited - rsvpData.pending);
  const rsvp: DashboardRsvpView | null =
    rsvpData === null
      ? null
      : {
          ...rsvpData,
          answered,
          responseRate:
            rsvpData.invited === 0
              ? 0
              : Math.round((answered / rsvpData.invited) * 100),
        };

  const guestsData =
    aggregate.guests.status === "ok" ? aggregate.guests.data : null;

  return {
    role: aggregate.role,
    roleLabel:
      aggregate.role === "OWNER" ? "Pemilik undangan" : "Editor undangan",
    coupleNames: aggregate.workspace.coupleNames,
    initials: coupleInitials(aggregate.workspace.coupleNames),
    city: aggregate.workspace.city,
    weddingDateLabel: formatInvitationDate(aggregate.workspace.weddingDate),
    status: {
      state: status.state,
      label: status.label,
      tone: status.tone,
      reason: status.reason,
    },
    invitation,
    completion: {
      items: items.map((item) => ({
        id: item.id,
        label: item.label,
        done: item.done,
        href: item.href ?? null,
      })),
      done: counts.done,
      total: counts.total,
      percent,
      nextStep:
        nextStep === null
          ? null
          : {
              id: nextStep.id,
              label: nextStep.label,
              done: nextStep.done,
              href: nextStep.href ?? null,
            },
    },
    countdown,
    expiryWarning: expiryWarningText(
      status.state,
      aggregate.workspace.weddingDate,
      today,
    ),
    paymentAvailable: aggregate.payment.status === "ok",
    paymentPending:
      aggregate.payment.status === "ok" &&
      aggregate.payment.data.state === "PENDING",
    guests: guestsData,
    rsvp,
    nextActions: actions,
  };
}

/* -------------------------------------------------------------------------- */
/* Guestbook panel                                                            */
/* -------------------------------------------------------------------------- */

export type GuestbookModerationStatus =
  "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN" | "DELETED";

export type GuestbookMessageView = Readonly<{
  id: string;
  displayName: string;
  message: string;
  status: GuestbookModerationStatus;
  /** Already formatted in the workspace timezone, e.g. `3 Okt 2026, 14.05`. */
  submittedLabel: string;
}>;

export type GuestbookPanelState =
  | Readonly<{
      kind: "ok";
      /** Newest first; the loader returns the complete queue, so counts derive from it. */
      rows: readonly GuestbookMessageView[];
    }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{ kind: "unavailable" }>;

const JAKARTA_TIME = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export function buildGuestbookPanel(
  load: GuestbookOverviewLoad,
): GuestbookPanelState {
  if (load.kind !== "ok") return { kind: load.kind };
  return {
    kind: "ok",
    rows: load.data.rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      message: row.message,
      status: row.moderationStatus,
      submittedLabel: JAKARTA_TIME.format(row.submittedAt),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Orders panel                                                               */
/* -------------------------------------------------------------------------- */

export type OrderView = Readonly<{
  orderNumber: string;
  productName: string;
  totalLabel: string;
  createdLabel: string | null;
  state: PaymentStatusState;
  stateLabel: string;
  stateTone: "olive" | "gold" | "blush" | "neutral";
}>;

export type OrdersPanelState =
  | Readonly<{ kind: "ok"; orders: readonly OrderView[] }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{ kind: "unavailable" }>;

/** Customer-facing words for every stored payment state. */
export const ORDER_STATE_LABELS: Record<PaymentStatusState, string> = {
  VERIFYING: "Menunggu konfirmasi",
  PENDING: "Menunggu pembayaran",
  DELAYED: "Tertunda",
  PAID: "Lunas",
  ENTITLEMENT_PENDING: "Pembayaran diterima",
  FAILED: "Gagal",
  EXPIRED: "Kedaluwarsa",
  AMOUNT_MISMATCH: "Perlu peninjauan",
  ALREADY_PAID: "Sudah dibayar",
};

export const ORDER_STATE_TONES: Record<
  PaymentStatusState,
  "olive" | "gold" | "blush" | "neutral"
> = {
  VERIFYING: "gold",
  PENDING: "gold",
  DELAYED: "gold",
  PAID: "olive",
  ENTITLEMENT_PENDING: "olive",
  FAILED: "blush",
  EXPIRED: "blush",
  AMOUNT_MISMATCH: "blush",
  ALREADY_PAID: "olive",
};

const ORDER_DATE = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

export function buildOrdersPanel(load: OrderListLoad): OrdersPanelState {
  if (load.kind !== "ok") return { kind: load.kind };
  return {
    kind: "ok",
    orders: load.orders.map((order) => ({
      orderNumber: order.orderNumber,
      productName: order.productName,
      totalLabel: formatIdrMinor(order.totalMinor),
      createdLabel:
        order.createdAt === null ? null : ORDER_DATE.format(order.createdAt),
      state: order.current,
      stateLabel: ORDER_STATE_LABELS[order.current],
      stateTone: ORDER_STATE_TONES[order.current],
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Visit statistics                                                           */
/* -------------------------------------------------------------------------- */

export type VisitStatsDayView = Readonly<{
  /** Calendar day, `YYYY-MM-DD`; the row key and the accessible date. */
  date: string;
  /** Short Indonesian label for the axis and the table, e.g. `17 Sep`. */
  label: string;
  views: number;
}>;

export type VisitStatsPanelState =
  | Readonly<{
      kind: "ok";
      total: number;
      peak: number;
      days: readonly VisitStatsDayView[];
    }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{ kind: "unavailable" }>;

/** Formatted from a UTC-noon instant so the label never shifts a day. */
const VISIT_DAY_FORMAT = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function visitDayLabel(date: string): string {
  const [yearText, monthText, dayText] = date.split("-");
  if (
    yearText === undefined ||
    monthText === undefined ||
    dayText === undefined
  ) {
    return date;
  }
  const instant = new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText), 12),
  );
  if (!Number.isFinite(instant.getTime())) return date;
  return VISIT_DAY_FORMAT.format(instant);
}

export function buildVisitStatsPanel(
  load: VisitStatsLoad,
): VisitStatsPanelState {
  if (load.kind !== "ok") return { kind: load.kind };
  return {
    kind: "ok",
    total: load.data.total,
    peak: load.data.peak,
    days: load.data.days.map((day) => ({
      date: day.date,
      label: visitDayLabel(day.date),
      views: day.views,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Template recommendations                                                   */
/* -------------------------------------------------------------------------- */

export type TemplateCardView = Readonly<{
  id: string;
  name: string;
  category: string;
  character: string;
  priceLabel: string | null;
  tierLabel: string;
  /** Artwork gradient variant from the dashboard's own stylesheet. */
  art: string;
}>;

/** Palette → artwork variant; anything unknown cycles through the set. */
const ART_BY_PALETTE: Record<string, string> = {
  blush: "blush",
  ivory: "linen",
  paper: "white",
};

const ART_FALLBACK = ["blush", "garden", "gold", "classic", "linen", "white"];

export function buildTemplateCards(
  templates: readonly TemplateRecord[],
): readonly TemplateCardView[] {
  return templates.map((template, index) => ({
    id: template.id,
    name: template.name,
    category: template.category,
    character: template.designCharacter,
    priceLabel:
      template.priceIdr === null ? null : formatIdr(template.priceIdr),
    tierLabel: TIER_LABELS[template.tier],
    art:
      ART_BY_PALETTE[template.theme.palette] ??
      ART_FALLBACK[index % ART_FALLBACK.length] ??
      "blush",
  }));
}

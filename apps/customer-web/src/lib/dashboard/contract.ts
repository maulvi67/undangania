import { z } from "zod";
import { todayYmd } from "../onboarding/contract";

/**
 * Customer dashboard aggregate contract (MVP-UI-007).
 *
 * This is the contract between the `/dashboard` page and its loader in
 * `server.ts`. Scope comes from the session's own workspace and the aggregate
 * is read through database repositories.
 */

export const DASHBOARD_STATES = [
  "baru",
  "draf",
  "siap",
  "aktif",
  "jeda",
  "segera-berakhir",
  "berakhir",
  "menunggu-pembayaran",
  "peninjau",
  "belum-masuk",
  "gangguan",
  "ringkasan-gagal",
] as const;

export type DashboardFixture = (typeof DASHBOARD_STATES)[number];

export function isDashboardFixture(value: string): value is DashboardFixture {
  return (DASHBOARD_STATES as readonly string[]).includes(value);
}

export const DASHBOARD_ROUTES = {
  dashboard: "/dashboard",
  editor: "/editor",
  templates: "/templates",
  onboarding: "/mulai",
  guests: "/tamu",
  rsvp: "/rsvp",
  guestbook: "/buku-tamu",
  orders: "/pesanan",
} as const;

export type DashboardRole = "OWNER" | "EDITOR";
export type InvitationLifecycle =
  "DRAFT" | "READY" | "PUBLISHED" | "PAUSED" | "EXPIRED";
export type PaymentState = "OK" | "PENDING";

export type AvailableSection<T> = { status: "ok"; data: T };
export type UnavailableSection = { status: "unavailable" };
export type DashboardSection<T> = AvailableSection<T> | UnavailableSection;

export type WorkspaceSummary = {
  coupleNames: string | null;
  weddingDate: string | null;
  timezone: string | null;
  city: string | null;
};

export type InvitationSummary = {
  status: InvitationLifecycle;
  slug: string;
  templateName: string | null;
  contentComplete: boolean;
  publishedAt: string | null;
  publicUrl: string | null;
  activeUntil: string | null;
};

export type PaymentSummary = { state: PaymentState };

export type GuestSummary = {
  guestCount: number;
  householdCount: number;
};

export type RsvpSummary = {
  invited: number;
  attending: number;
  declined: number;
  tentative: number;
  pending: number;
};

export type DashboardAggregate = {
  role: DashboardRole;
  workspace: WorkspaceSummary;
  invitation: DashboardSection<InvitationSummary>;
  payment: DashboardSection<PaymentSummary>;
  guests: DashboardSection<GuestSummary>;
  rsvp: DashboardSection<RsvpSummary>;
};

export type DashboardLoad =
  | { kind: "ok"; data: DashboardAggregate }
  | { kind: "unauthenticated" }
  | { kind: "unavailable" };

export const dashboardRoleSchema = z.enum(["OWNER", "EDITOR"]);
export const invitationLifecycleSchema = z.enum([
  "DRAFT",
  "READY",
  "PUBLISHED",
  "PAUSED",
  "EXPIRED",
]);

const ymdSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const sectionSchema = <T extends z.ZodType>(schema: T) =>
  z.union([
    z.object({ status: z.literal("ok"), data: schema }),
    z.object({ status: z.literal("unavailable") }),
  ]);

export const dashboardAggregateSchema = z.object({
  role: dashboardRoleSchema,
  workspace: z.object({
    coupleNames: z.string().nullable(),
    weddingDate: ymdSchema.nullable(),
    timezone: z.string().nullable(),
    city: z.string().nullable(),
  }),
  invitation: sectionSchema(
    z.object({
      status: invitationLifecycleSchema,
      slug: z.string().min(1),
      templateName: z.string().nullable(),
      contentComplete: z.boolean(),
      publishedAt: z.string().datetime().nullable(),
      publicUrl: z.string().nullable(),
      activeUntil: ymdSchema.nullable(),
    }),
  ),
  payment: sectionSchema(z.object({ state: z.enum(["OK", "PENDING"]) })),
  guests: sectionSchema(
    z.object({
      guestCount: z.number().int().nonnegative(),
      householdCount: z.number().int().nonnegative(),
    }),
  ),
  rsvp: sectionSchema(
    z.object({
      invited: z.number().int().nonnegative(),
      attending: z.number().int().nonnegative(),
      declined: z.number().int().nonnegative(),
      tentative: z.number().int().nonnegative(),
      pending: z.number().int().nonnegative(),
    }),
  ),
});

export type DerivedDashboardState =
  | "NEW"
  | "DRAFT"
  | "READY"
  | "PUBLISHED"
  | "PAUSED"
  | "EXPIRING"
  | "EXPIRED"
  | "PAYMENT_PENDING";

export type StatusTone = "neutral" | "olive" | "gold" | "blush";

export type DerivedStatus = {
  state: DerivedDashboardState;
  label: string;
  tone: StatusTone;
  reason: string;
};

export type DashboardAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  variant: "primary" | "secondary";
};

export type CompletionItem = {
  id: string;
  label: string;
  done: boolean;
  href?: string;
};

export type CountdownResult =
  | { kind: "undecided"; label: string }
  | { kind: "future"; days: number; label: string }
  | { kind: "today"; label: string }
  | { kind: "past"; label: string };

export const EXPIRING_SOON_DAYS = 14;
export const INVITATION_ACTIVE_DAYS_AFTER_EVENT = 30;

function dateParts(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (![year, month, day].every(Number.isFinite)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function dateOrdinal(value: string): number | null {
  const parts = dateParts(value);
  if (parts === null) return null;
  return Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000;
}

export function addDaysYmd(value: string, days: number): string | null {
  const parts = dateParts(value);
  if (parts === null || !Number.isInteger(days)) return null;
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days),
  );
  return date.toISOString().slice(0, 10);
}

export function dayDifference(from: string, to: string): number | null {
  const fromOrdinal = dateOrdinal(from);
  const toOrdinal = dateOrdinal(to);
  if (fromOrdinal === null || toOrdinal === null) return null;
  return toOrdinal - fromOrdinal;
}

function formatIdDate(value: string): string {
  const parts = dateParts(value);
  if (parts === null) return value;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}

function timezoneLabel(timezone: string | null): string {
  if (timezone === "Asia/Makassar") return "WITA";
  if (timezone === "Asia/Jayapura") return "WIT";
  return timezone === "Asia/Jakarta" ? "WIB" : "";
}

export function countdownText(
  weddingDate: string | null,
  timezone: string | null,
  today = todayYmd(timezone ?? "Asia/Jakarta"),
): CountdownResult {
  if (weddingDate === null || dateParts(weddingDate) === null) {
    return { kind: "undecided", label: "Tanggal pernikahan belum ditentukan." };
  }
  const days = dayDifference(today, weddingDate);
  if (days === null)
    return { kind: "undecided", label: "Tanggal pernikahan belum ditentukan." };
  const dateText = formatIdDate(weddingDate);
  const zone = timezoneLabel(timezone);
  const suffix = zone === "" ? "" : ` · ${zone}`;
  if (days > 0)
    return { kind: "future", days, label: `H-${days} · ${dateText}${suffix}` };
  if (days === 0)
    return {
      kind: "today",
      label: `Hari ini hari pernikahan Anda · ${dateText}${suffix}`,
    };
  return {
    kind: "past",
    label: `Acara Anda telah berlangsung pada ${dateText}${suffix}.`,
  };
}

export function activePeriodRemaining(
  eventDate: string | null,
  today = todayYmd("Asia/Jakarta"),
): number | null {
  if (eventDate === null) return null;
  const activeUntil = addDaysYmd(eventDate, INVITATION_ACTIVE_DAYS_AFTER_EVENT);
  if (activeUntil === null) return null;
  return dayDifference(today, activeUntil);
}

export function activeUntilDate(eventDate: string | null): string | null {
  return eventDate === null
    ? null
    : addDaysYmd(eventDate, INVITATION_ACTIVE_DAYS_AFTER_EVENT);
}

function isPublishedLifecycle(status: InvitationLifecycle): boolean {
  return status === "PUBLISHED" || status === "PAUSED" || status === "EXPIRED";
}

export function deriveDashboardState(
  aggregate: DashboardAggregate,
  today = todayYmd(aggregate.workspace.timezone ?? "Asia/Jakarta"),
): DerivedDashboardState {
  if (
    aggregate.workspace.coupleNames === null ||
    aggregate.invitation.status === "unavailable"
  ) {
    return aggregate.workspace.coupleNames === null ? "NEW" : "DRAFT";
  }
  if (
    aggregate.payment.status === "ok" &&
    aggregate.payment.data.state === "PENDING"
  ) {
    return "PAYMENT_PENDING";
  }
  const invitation = aggregate.invitation.data;
  if (isPublishedLifecycle(invitation.status)) {
    const remaining = activePeriodRemaining(
      aggregate.workspace.weddingDate,
      today,
    );
    if (remaining !== null && remaining < 0) return "EXPIRED";
    if (remaining !== null && remaining <= EXPIRING_SOON_DAYS)
      return "EXPIRING";
  }
  if (invitation.status === "READY") return "READY";
  if (invitation.status === "PUBLISHED") return "PUBLISHED";
  if (invitation.status === "PAUSED") return "PAUSED";
  if (invitation.status === "EXPIRED") return "EXPIRED";
  return "DRAFT";
}

const STATUS_DETAILS: Record<
  DerivedDashboardState,
  Omit<DerivedStatus, "state">
> = {
  NEW: {
    label: "Belum dimulai",
    tone: "neutral",
    reason:
      "Isi nama mempelai dan acara pertama untuk mulai menyusun undangan.",
  },
  DRAFT: {
    label: "Draf undangan",
    tone: "neutral",
    reason: "Undangan Anda belum selesai. Buka editor untuk melanjutkan.",
  },
  READY: {
    label: "Siap diterbitkan",
    tone: "gold",
    reason: "Semua isian lengkap. Periksa hasil akhir, lalu terbitkan.",
  },
  PUBLISHED: {
    label: "Undangan aktif",
    tone: "olive",
    reason: "Undangan aktif dan bisa dibuka tamu. Bagikan tautannya.",
  },
  PAUSED: {
    label: "Dijeda",
    tone: "neutral",
    reason: "Undangan sedang dijeda — tamu tidak dapat membukanya.",
  },
  EXPIRING: {
    label: "Segera berakhir",
    tone: "gold",
    reason:
      "Masa aktif undangan akan segera berakhir. Unduh data tamu sebelum batas ini.",
  },
  EXPIRED: {
    label: "Berakhir",
    tone: "neutral",
    reason: "Masa aktif undangan telah berakhir.",
  },
  PAYMENT_PENDING: {
    label: "Menunggu pembayaran",
    tone: "gold",
    reason:
      "Undangan Anda sudah disusun — selesaikan pembayaran untuk menerbitkannya.",
  },
};

export function derivedStatus(
  aggregate: DashboardAggregate,
  today = todayYmd(aggregate.workspace.timezone ?? "Asia/Jakarta"),
): DerivedStatus {
  const state = deriveDashboardState(aggregate, today);
  return { state, ...STATUS_DETAILS[state] };
}

function expiryDateText(eventDate: string | null): string | null {
  const activeUntil = activeUntilDate(eventDate);
  return activeUntil === null ? null : formatIdDate(activeUntil);
}

function action(
  id: string,
  title: string,
  description: string,
  href: string,
  variant: DashboardAction["variant"] = "secondary",
): DashboardAction {
  return { id, title, description, href, variant };
}

function lifecycleAction(
  state: DerivedDashboardState,
  aggregate: DashboardAggregate,
  today: string,
): DashboardAction | null {
  switch (state) {
    case "NEW":
      return action(
        "onboarding",
        "Mulai isi data",
        STATUS_DETAILS.NEW.reason,
        DASHBOARD_ROUTES.onboarding,
        "primary",
      );
    case "DRAFT":
      return action(
        "editor",
        "Buka editor",
        STATUS_DETAILS.DRAFT.reason,
        DASHBOARD_ROUTES.editor,
        "primary",
      );
    case "READY":
      return action(
        "review",
        "Periksa undangan",
        STATUS_DETAILS.READY.reason,
        DASHBOARD_ROUTES.editor,
        "primary",
      );
    case "PUBLISHED":
      return aggregate.invitation.status === "ok" &&
        aggregate.invitation.data.publicUrl !== null
        ? action(
            "view-invitation",
            "Lihat undangan",
            STATUS_DETAILS.PUBLISHED.reason,
            aggregate.invitation.data.publicUrl,
            "primary",
          )
        : action(
            "editor",
            "Buka editor",
            "Buka editor untuk memeriksa undangan Anda.",
            DASHBOARD_ROUTES.editor,
            "primary",
          );
    case "PAUSED":
      return action(
        "republish",
        "Terbitkan kembali",
        STATUS_DETAILS.PAUSED.reason,
        DASHBOARD_ROUTES.editor,
        "primary",
      );
    case "EXPIRING": {
      const remaining = activePeriodRemaining(
        aggregate.workspace.weddingDate,
        today,
      );
      const description =
        remaining === null
          ? STATUS_DETAILS.EXPIRING.reason
          : `Masa aktif berakhir dalam ${remaining} hari. Unduh data tamu dan buku tamu sebelum batas ini.`;
      return action(
        "download-data",
        "Unduh data tamu",
        description,
        DASHBOARD_ROUTES.guests,
        "primary",
      );
    }
    case "EXPIRED":
      return action(
        "orders",
        "Lihat pesanan",
        "Masa aktif undangan telah berakhir. Periksa riwayat pesanan Anda.",
        DASHBOARD_ROUTES.orders,
        "primary",
      );
    case "PAYMENT_PENDING":
      return aggregate.role === "OWNER"
        ? action(
            "payment",
            "Lihat pesanan",
            STATUS_DETAILS.PAYMENT_PENDING.reason,
            DASHBOARD_ROUTES.orders,
            "primary",
          )
        : null;
  }
}

export function nextActions(
  aggregate: DashboardAggregate,
  today = todayYmd(aggregate.workspace.timezone ?? "Asia/Jakarta"),
): ReadonlyArray<DashboardAction> {
  const state = deriveDashboardState(aggregate, today);
  const actions: DashboardAction[] = [];
  const add = (candidate: DashboardAction | null) => {
    if (candidate === null || actions.some((item) => item.id === candidate.id))
      return;
    actions.push({
      ...candidate,
      variant: actions.length === 0 ? "primary" : "secondary",
    });
  };

  if (state === "PAYMENT_PENDING")
    add(lifecycleAction(state, aggregate, today));
  if (state === "EXPIRING") add(lifecycleAction(state, aggregate, today));
  if (state === "EXPIRED") {
    add(lifecycleAction(state, aggregate, today));
    add(
      action(
        "templates",
        "Lihat koleksi desain",
        "Pilih desain lain untuk memulai undangan baru.",
        DASHBOARD_ROUTES.templates,
      ),
    );
  }
  if (
    state !== "PAYMENT_PENDING" &&
    state !== "EXPIRING" &&
    state !== "EXPIRED"
  ) {
    add(lifecycleAction(state, aggregate, today));
  }

  if (state === "PUBLISHED" || state === "EXPIRING") {
    if (
      aggregate.guests.status === "ok" &&
      aggregate.guests.data.guestCount === 0
    ) {
      add(
        action(
          "guests",
          "Tambah tamu",
          "Tambahkan daftar tamu agar Anda dapat mengelola undangan.",
          DASHBOARD_ROUTES.guests,
        ),
      );
    }
    if (aggregate.rsvp.status === "ok" && aggregate.rsvp.data.pending > 0) {
      add(
        action(
          "rsvp",
          "Lihat RSVP",
          "Periksa tamu yang belum menjawab konfirmasi kehadiran.",
          DASHBOARD_ROUTES.rsvp,
        ),
      );
    }
  }

  return actions.slice(0, 3);
}

export function completionItems(
  aggregate: DashboardAggregate,
): ReadonlyArray<CompletionItem> {
  const basicDataDone =
    aggregate.workspace.coupleNames !== null &&
    aggregate.workspace.weddingDate !== null;
  const invitation =
    aggregate.invitation.status === "ok" ? aggregate.invitation.data : null;
  const guests =
    aggregate.guests.status === "ok" ? aggregate.guests.data : null;
  const designDone = invitation !== null && invitation.templateName !== null;
  const contentDone = invitation?.contentComplete === true;
  const guestsDone = guests !== null && guests.guestCount > 0;
  const published =
    invitation !== null && isPublishedLifecycle(invitation.status);
  const item = (value: CompletionItem, href?: string): CompletionItem =>
    href === undefined ? value : { ...value, href };

  return [
    item(
      { id: "basics", label: "Data dasar", done: basicDataDone },
      basicDataDone ? undefined : DASHBOARD_ROUTES.onboarding,
    ),
    item(
      { id: "design", label: "Desain dipilih", done: designDone },
      designDone ? undefined : DASHBOARD_ROUTES.templates,
    ),
    item(
      { id: "content", label: "Konten undangan selesai", done: contentDone },
      contentDone ? undefined : DASHBOARD_ROUTES.editor,
    ),
    item(
      { id: "guests", label: "Data tamu diisi", done: guestsDone },
      guestsDone ? undefined : DASHBOARD_ROUTES.guests,
    ),
    { id: "published", label: "Undangan diterbitkan", done: published },
  ];
}

export function completionCount(items: ReadonlyArray<CompletionItem>): {
  done: number;
  total: number;
} {
  return {
    done: items.filter((item) => item.done).length,
    total: items.length,
  };
}

export function formatActivePeriod(
  eventDate: string | null,
  today = todayYmd("Asia/Jakarta"),
): string | null {
  const activeUntil = activeUntilDate(eventDate);
  if (activeUntil === null) return null;
  const remaining = dayDifference(today, activeUntil);
  if (remaining === null) return null;
  if (remaining < 0)
    return `Masa aktif berakhir pada ${formatIdDate(activeUntil)}.`;
  if (remaining === 0)
    return `Masa aktif berakhir hari ini, ${formatIdDate(activeUntil)}.`;
  return `Masa aktif hingga ${formatIdDate(activeUntil)} · sisa ${remaining} hari.`;
}

export function formatInvitationDate(value: string | null): string | null {
  return value === null ? null : formatIdDate(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function sectionIsAvailable<T>(
  section: DashboardSection<T>,
): section is AvailableSection<T> {
  return section.status === "ok";
}

export function stateRequiresExpiryWarning(
  state: DerivedDashboardState,
): boolean {
  return state === "EXPIRING" || state === "EXPIRED";
}

export function expiryWarningText(
  state: DerivedDashboardState,
  eventDate: string | null,
  today = todayYmd("Asia/Jakarta"),
): string | null {
  if (!stateRequiresExpiryWarning(state)) return null;
  const activeUntil = expiryDateText(eventDate);
  if (activeUntil === null) return null;
  if (state === "EXPIRED")
    return `Masa aktif undangan telah berakhir pada ${activeUntil}.`;
  const remaining = activePeriodRemaining(eventDate, today);
  return remaining === null
    ? `Masa aktif undangan akan segera berakhir pada ${activeUntil}.`
    : `Masa aktif undangan berakhir dalam ${remaining} hari, pada ${activeUntil}. Unduh data tamu dan buku tamu sebelum batas ini.`;
}

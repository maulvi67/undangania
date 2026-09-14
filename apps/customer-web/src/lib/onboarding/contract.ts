import { z } from "zod";

/**
 * Onboarding transport contract (MVP-UI-006).
 *
 * This module is the handoff artifact to the wedding-domain owner: it defines
 * the step schemas, error semantics, and flow-state machine the real
 * `/weddings` API must implement (tenant-provisioned, authorized per step).
 * The UI currently talks to a deterministic simulation (stub-transport.ts)
 * plus a client-side localStorage draft that owns resume.
 *
 * Rules encoded here (see design plan §5–§8):
 * - The server action is the single validator; clients render `noValidate`.
 * - Callers normalize (trim) values BEFORE parsing (repo convention; no
 *   chained transforms in Zod v4).
 * - Dates are future-only, today allowed; "today" is Asia/Jakarta server-side.
 * - The wedding date is optional and carries an explicit "undecided" flag
 *   rather than a silent empty string.
 * - Times are wall-clock strings in the chosen IANA timezone; formatting is
 *   UTC-anchored so no zone shift rewrites the weekday.
 * - Cross-field rules (event ordering, "end after start") belong to the
 *   wedding domain, not this form (plan §5).
 */

/* ---------- Opsi dan batas isian ---------- */

export const EVENT_TYPES = ["Akad Nikah", "Resepsi", "Unduh Mantu", "Lainnya"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

export const TIMEZONE_IDS = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"] as const;
export type TimezoneId = (typeof TIMEZONE_IDS)[number];

export function isTimezoneId(value: string): value is TimezoneId {
  return (TIMEZONE_IDS as readonly string[]).includes(value);
}

/** Short labels shown next to times (WIB/WITA/WIT). */
export const TZ_LABELS: Record<TimezoneId, string> = {
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

export const TIMEZONE_OPTIONS: ReadonlyArray<{ value: TimezoneId; label: string }> = [
  { value: "Asia/Jakarta", label: "WIB — Jakarta" },
  { value: "Asia/Makassar", label: "WITA — Makassar" },
  { value: "Asia/Jayapura", label: "WIT — Jayapura" },
];

export const LOCALE_OPTIONS: ReadonlyArray<{ value: "id" | "en"; label: string }> = [
  { value: "id", label: "Bahasa Indonesia" },
  { value: "en", label: "English" },
];

export const NAME_MAX_LENGTH = 100;
export const CITY_MAX_LENGTH = 100;
export const VENUE_MAX_LENGTH = 150;
export const ADDRESS_MAX_LENGTH = 500;

/* ---------- Bentuk isian ---------- */

export const ONBOARDING_FIELDS = [
  "partner1Name",
  "partner2Name",
  "weddingDate",
  "weddingDateUndecided",
  "eventType",
  "eventDate",
  "eventTime",
  "city",
  "timezone",
  "venueName",
  "venueAddress",
  "locale",
] as const;

export type OnboardingField = (typeof ONBOARDING_FIELDS)[number];

export function isOnboardingField(value: unknown): value is OnboardingField {
  return (ONBOARDING_FIELDS as readonly unknown[]).includes(value);
}

export type StepId = 1 | 2 | 3;

export const ONBOARDING_STEPS: ReadonlyArray<{ id: StepId; title: string }> = [
  { id: 1, title: "Mempelai" },
  { id: 2, title: "Acara pertama" },
  { id: 3, title: "Preferensi" },
];

export type OnboardingData = {
  partner1Name: string;
  partner2Name: string;
  /** "" atau "YYYY-MM-DD". */
  weddingDate: string;
  /** Checkbox "belum ditentukan" — isian eksplisit, bukan kosong diam-diam. */
  weddingDateUndecided: boolean;
  eventType: EventType;
  /** "" atau "YYYY-MM-DD". */
  eventDate: string;
  /** "HH:mm" (waktu dinding, tanpa konversi zona). */
  eventTime: string;
  city: string;
  timezone: TimezoneId;
  venueName: string;
  venueAddress: string;
  locale: "id" | "en";
};

export function createInitialData(): OnboardingData {
  return {
    partner1Name: "",
    partner2Name: "",
    weddingDate: "",
    weddingDateUndecided: false,
    eventType: "Akad Nikah",
    eventDate: "",
    eventTime: "",
    city: "",
    timezone: "Asia/Jakarta",
    venueName: "",
    venueAddress: "",
    locale: "id",
  };
}

/**
 * True when the user has entered or chosen anything beyond the defaults.
 * Gates draft persistence and the resume banner — visiting `/mulai` alone
 * must never create a draft to resume.
 */
export function hasAnyInput(data: OnboardingData): boolean {
  const initial = createInitialData();
  for (const field of ONBOARDING_FIELDS) {
    const value = data[field];
    if (typeof value === "boolean") {
      if (value !== initial[field]) return true;
      continue;
    }
    if (value.trim() !== "" && value !== initial[field]) return true;
  }
  return false;
}

/* ---------- Validasi tanggal dan waktu (murni, dapat diuji) ---------- */

const YMD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Parse YMD menjadi angka; null bila bentuknya tidak bisa diandalkan. */
function ymdNumbers(value: string): { year: number; month: number; day: number } | null {
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  return { year, month, day };
}

/** Bagian tanggal + cek kalender nyata; null bila tidak sah. */
function validYmdParts(value: string): { year: number; month: number; day: number } | null {
  if (!YMD_PATTERN.test(value)) return null;
  const parts = ymdNumbers(value);
  if (parts === null) return null;
  const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  return parts.day <= lastDay ? parts : null;
}

/** Real-calendar check: 2026-02-30 dan 2023-02-29 ditolak, bukan sekadar format. */
export function isValidYmd(value: string): boolean {
  return validYmdParts(value) !== null;
}

/**
 * "Hari ini" di zona waktu yang diberikan sebagai "YYYY-MM-DD"
 * (en-CA menghasilkan urutan ISO). Onboarding memakai Asia/Jakarta
 * sebagai referensi sisi server.
 */
export function todayYmd(timezone: string = "Asia/Jakarta"): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/** Perbandingan leksikografis — aman karena formatnya tetap lebar. */
export function isPastDay(ymd: string, todayYmdValue: string): boolean {
  return isValidYmd(ymd) && ymd < todayYmdValue;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/* ---------- Skema langkah (aksi server = validator tunggal) ---------- */

/**
 * Pesan galat per isian (Bahasa Indonesia, rencana §5). Skema memasang pesan
 * ini lewat issue `custom`; peta REQUIRED/MAX di bawah dipakai translateField
 * untuk pertahanan bila isu datang dari pemeriksaan non-custom.
 */
export const REQUIRED_MESSAGES: Partial<Record<OnboardingField, string>> = {
  partner1Name: "Masukkan nama mempelai pertama.",
  partner2Name: "Masukkan nama mempelai kedua.",
  eventType: "Pilih jenis acara.",
  eventDate: "Masukkan tanggal acara.",
  eventTime: "Masukkan waktu acara.",
  city: "Masukkan kota acara.",
  timezone: "Pilih zona waktu.",
  venueName: "Masukkan nama venue.",
  locale: "Pilih bahasa undangan.",
};

export const MAX_LENGTH_MESSAGES: Partial<Record<OnboardingField, string>> = {
  partner1Name: "Nama maksimal 100 karakter.",
  partner2Name: "Nama maksimal 100 karakter.",
  city: "Kota maksimal 100 karakter.",
  venueName: "Nama venue maksimal 150 karakter.",
  venueAddress: "Alamat maksimal 500 karakter.",
};

export const FORM_LEVEL_ERROR = "Periksa kembali isian Anda.";

type AddIssue = (issue: { code: "custom"; path: [OnboardingField]; message: string }) => void;

function nameChecks(
  ctx: { addIssue: AddIssue },
  field: "partner1Name" | "partner2Name",
  value: string,
  requiredMessage: string,
): void {
  // Pertahanan: nilai yang belum dipangkas pun harus aman (spasi ≠ nama).
  if (value.trim() === "") {
    ctx.addIssue({ code: "custom", path: [field], message: requiredMessage });
  } else if (value.length > NAME_MAX_LENGTH) {
    ctx.addIssue({ code: "custom", path: [field], message: MAX_LENGTH_MESSAGES[field] ?? "Nama maksimal 100 karakter." });
  }
}

export const coupleStepSchema = z
  .object({
    partner1Name: z.string(),
    partner2Name: z.string(),
    weddingDate: z.string(),
    weddingDateUndecided: z.boolean(),
  })
  .superRefine((value, ctx) => {
    nameChecks(ctx, "partner1Name", value.partner1Name, REQUIRED_MESSAGES.partner1Name ?? "");
    nameChecks(ctx, "partner2Name", value.partner2Name, REQUIRED_MESSAGES.partner2Name ?? "");
    // Skipped entirely when undecided — the flag IS the answer (plan §5).
    if (value.weddingDateUndecided) return;
    if (value.weddingDate === "") return;
    if (!isValidYmd(value.weddingDate)) {
      ctx.addIssue({ code: "custom", path: ["weddingDate"], message: "Masukkan tanggal yang valid." });
      return;
    }
    if (isPastDay(value.weddingDate, todayYmd())) {
      ctx.addIssue({
        code: "custom",
        path: ["weddingDate"],
        message: "Tanggal pernikahan tidak boleh di masa lalu.",
      });
    }
  });

export const eventStepSchema = z
  .object({
    // Enum divalidasi di basis agar hasil parse bertipe sempit; isian UI
    // selalu valid (default + select terkontrol) sehingga galat paralel
    // langkah ini tetap utuh untuk semua kondisi yang bisa dicapai pengguna.
    eventType: z.enum(EVENT_TYPES),
    eventDate: z.string(),
    eventTime: z.string(),
    city: z.string(),
    timezone: z.enum(TIMEZONE_IDS),
    venueName: z.string(),
    venueAddress: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.eventDate === "") {
      ctx.addIssue({ code: "custom", path: ["eventDate"], message: REQUIRED_MESSAGES.eventDate ?? "" });
    } else if (!isValidYmd(value.eventDate)) {
      ctx.addIssue({ code: "custom", path: ["eventDate"], message: "Masukkan tanggal yang valid." });
    } else if (isPastDay(value.eventDate, todayYmd())) {
      ctx.addIssue({
        code: "custom",
        path: ["eventDate"],
        message: "Tanggal acara tidak boleh di masa lalu.",
      });
    }
    if (!isValidTime(value.eventTime)) {
      ctx.addIssue({ code: "custom", path: ["eventTime"], message: REQUIRED_MESSAGES.eventTime ?? "" });
    }
    if (value.city.trim() === "") {
      ctx.addIssue({ code: "custom", path: ["city"], message: REQUIRED_MESSAGES.city ?? "" });
    } else if (value.city.length > CITY_MAX_LENGTH) {
      ctx.addIssue({ code: "custom", path: ["city"], message: MAX_LENGTH_MESSAGES.city ?? "" });
    }
    if (value.venueName.trim() === "") {
      ctx.addIssue({ code: "custom", path: ["venueName"], message: REQUIRED_MESSAGES.venueName ?? "" });
    } else if (value.venueName.length > VENUE_MAX_LENGTH) {
      ctx.addIssue({ code: "custom", path: ["venueName"], message: MAX_LENGTH_MESSAGES.venueName ?? "" });
    }
    if (value.venueAddress.length > ADDRESS_MAX_LENGTH) {
      ctx.addIssue({ code: "custom", path: ["venueAddress"], message: MAX_LENGTH_MESSAGES.venueAddress ?? "" });
    }
  });

export const preferencesStepSchema = z.object({
  locale: z.enum(["id", "en"]),
});

/* ---------- Galat isian ---------- */

export type FieldErrors = Partial<Record<OnboardingField, string>>;

/**
 * Struktur minimal isu Zod (menghindari ketergantungan tipe internal versi).
 * ZodIssue (uni literal code + path mungkin absen) tetap dapat ditetapkan.
 */
export type FieldIssue = {
  code: string;
  message: string;
  path?: readonly PropertyKey[];
};

/**
 * Peta isu skema → galat per isian. Isu `custom` membawa pesannya sendiri;
 * `too_big` dipetakan ke pesan panjang maksimum; sisanya jatuh ke pesan
 * wajib-isi per isian (pertahanan untuk API asli).
 */
export function translateFieldErrors(issues: ReadonlyArray<FieldIssue>): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = issue.path?.[0];
    if (!isOnboardingField(field)) continue;
    if (errors[field] !== undefined) continue; // pesan pertama menang
    if (issue.code === "custom") {
      errors[field] = issue.message;
      continue;
    }
    errors[field] =
      issue.code === "too_big"
        ? MAX_LENGTH_MESSAGES[field] ?? REQUIRED_MESSAGES[field] ?? FORM_LEVEL_ERROR
        : REQUIRED_MESSAGES[field] ?? FORM_LEVEL_ERROR;
  }
  return errors;
}

/* ---------- Hasil transport dan status alur ---------- */

export const ONBOARDING_ERROR_CODES = [
  "VALIDATION",
  "STALE_VERSION",
  "SAVE_FAILED",
  "UNAVAILABLE",
] as const;

export type OnboardingErrorCode = (typeof ONBOARDING_ERROR_CODES)[number];

/** Patch per langkah — isian langkah itu saja, digabung server. */
export type StepPatch = Partial<OnboardingData>;

export type SaveStepOk = { ok: true; version: number };

export type StaleVersionError = {
  ok: false;
  code: "STALE_VERSION";
  serverVersion: number;
  serverData: OnboardingData;
};

export type RetryableError = { ok: false; code: "SAVE_FAILED" | "UNAVAILABLE" };

export type TransportError = StaleVersionError | RetryableError;

export type SaveStepResult = SaveStepOk | TransportError;

export type CompleteOk = { ok: true; version: number; data: OnboardingData };

export type CompleteResult = CompleteOk | TransportError;

/**
 * Status alur sisi klien. Berbeda dari auth (useActionState), onboarding
 * mengelola status manual: konflik versi dan muat-ulang draf butuh `setState`
 * yang tidak disediakan useActionState.
 */
export type FlowState =
  | { kind: "idle" }
  | { kind: "error"; fieldErrors: FieldErrors }
  | { kind: "conflict"; serverVersion: number; serverData: OnboardingData }
  | { kind: "retryable"; code: "SAVE_FAILED" | "UNAVAILABLE" }
  | { kind: "saved"; version: number; step: StepId }
  | { kind: "completed"; version: number; data: OnboardingData };

export const IDLE_FLOW_STATE: FlowState = { kind: "idle" };

/* ---------- Format tampilan (waktu dinding, jangkar UTC) ---------- */

/**
 * "Akad Nikah — Sabtu, 21 Maret 2026 pukul 08.00 WIB".
 * Nilai yang dimasukkan ADALAH waktu dinding di zona terpilih — tidak ada
 * konversi zona; jangkar UTC mencegah offset zona menggeser nama hari.
 */
export function formatEventLine(
  data: Pick<OnboardingData, "eventType" | "eventDate" | "eventTime" | "timezone">,
  locale: "id" | "en" = "id",
): string {
  const parts = validYmdParts(data.eventDate);
  if (parts === null || !isValidTime(data.eventTime)) {
    // Pertahanan untuk data setengah jadi; ringkasan nyata selalu tampil setelah validasi.
    return data.eventType;
  }
  const timeText = locale === "en" ? data.eventTime : data.eventTime.replace(":", ".");
  const anchor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  // en-GB (bukan en-US) agar urutan hari-bulan sama dengan versi Indonesia.
  const dateText = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(anchor);
  const at = locale === "en" ? "at" : "pukul";
  return `${data.eventType} — ${dateText} ${at} ${timeText} ${TZ_LABELS[data.timezone]}`;
}

/** Tampilan tanggal pernikahan untuk ringkasan; kosong ≠ eksplisit belum ditentukan, tapi keduanya tampil sama. */
export function formatWeddingDate(
  data: Pick<OnboardingData, "weddingDate" | "weddingDateUndecided">,
  locale: "id" | "en" = "id",
): string {
  if (data.weddingDateUndecided || data.weddingDate === "") {
    return locale === "en" ? "Not decided yet" : "Belum ditentukan";
  }
  const parts = validYmdParts(data.weddingDate);
  if (parts === null) {
    return locale === "en" ? "Not decided yet" : "Belum ditentukan";
  }
  const anchor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(anchor);
}

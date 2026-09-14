/**
 * Client-side onboarding draft (MVP-UI-006).
 *
 * Single localStorage key holds the whole draft (fields + step + version) and
 * owns RESUME; the server (stub) store owns validation + version conflict.
 * Pure helpers (parse/create/clear) take an injectable storage object so
 * they run and test in any environment; autosave writes are debounced by the
 * flow and never crash on blocked/private-mode storage.
 */

import {
  isEventType,
  isTimezoneId,
  isValidTime,
  isValidYmd,
  type OnboardingData,
  type StepId,
} from "./contract";

export const DRAFT_STORAGE_KEY = "onboarding-draft-v1";
export const AUTOSAVE_DEBOUNCE_MS = 800;

export type StoredDraft = {
  draftId: string;
  step: StepId;
  /** Versi simpanan server terakhir yang berhasil — dasar deteksi konflik. */
  version: number;
  updatedAt: number;
  /** Penanda selesai: panel "Persiapan sudah selesai" saat kembali. */
  completed?: boolean;
  data: OnboardingData;
};

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * window.localStorage bila tersedia dan dapat ditulis (mode privat dapat
 * melempar); null di SSR dan lingkungan tanpa storage.
 */
export function browserStorage(): DraftStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const probe = "__wedding-storage-probe__";
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** ID draf baru; crypto.randomUUID bila ada, cadangan deterministik-cukup jika tidak. */
export function createDraftId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Validasi bentuk penuh + normalisasi defensif: kunci hilang/tipe salah →
 * null (draf dibuang); nilai enum/tanggal rusak tapi bertipe benar →
 * dipulihkan ke default agar kontrol terkontrol tidak pernah kosong.
 */
export function parseStoredDraft(raw: string | null): StoredDraft | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;

  if (typeof record.draftId !== "string" || record.draftId === "") return null;
  if (record.step !== 1 && record.step !== 2 && record.step !== 3) return null;
  if (typeof record.version !== "number" || !Number.isInteger(record.version) || record.version < 0) {
    return null;
  }
  if (typeof record.updatedAt !== "number" || !Number.isFinite(record.updatedAt)) return null;
  if (record.completed !== undefined && typeof record.completed !== "boolean") return null;
  if (typeof record.data !== "object" || record.data === null) return null;

  const stored = record.data as Record<string, unknown>;
  // Validasi tipe primitif per isian — kunci hilang/tipe salah membuang draf
  // (bukan dipulihkan setengah jadi).
  if (typeof stored.partner1Name !== "string") return null;
  if (typeof stored.partner2Name !== "string") return null;
  if (typeof stored.weddingDate !== "string") return null;
  if (typeof stored.weddingDateUndecided !== "boolean") return null;
  if (typeof stored.eventType !== "string") return null;
  if (typeof stored.eventDate !== "string") return null;
  if (typeof stored.eventTime !== "string") return null;
  if (typeof stored.city !== "string") return null;
  if (typeof stored.timezone !== "string") return null;
  if (typeof stored.venueName !== "string") return null;
  if (typeof stored.venueAddress !== "string") return null;
  if (typeof stored.locale !== "string") return null;

  // Nilai enum/tanggal rusak tapi bertipe benar dipulihkan ke default agar
  // kontrol terkontrol tidak pernah kehabisan opsi yang sah.
  const data: OnboardingData = {
    partner1Name: stored.partner1Name,
    partner2Name: stored.partner2Name,
    weddingDate: isValidYmd(stored.weddingDate) ? stored.weddingDate : "",
    weddingDateUndecided: stored.weddingDateUndecided,
    eventType: isEventType(stored.eventType) ? stored.eventType : "Akad Nikah",
    eventDate: isValidYmd(stored.eventDate) ? stored.eventDate : "",
    eventTime: isValidTime(stored.eventTime) ? stored.eventTime : "",
    city: stored.city,
    timezone: isTimezoneId(stored.timezone) ? stored.timezone : "Asia/Jakarta",
    venueName: stored.venueName,
    venueAddress: stored.venueAddress,
    locale: stored.locale === "en" ? "en" : "id",
  };

  return {
    draftId: record.draftId,
    step: record.step,
    version: record.version,
    updatedAt: record.updatedAt,
    ...(record.completed === true ? { completed: true } : {}),
    data,
  };
}

export function loadStoredDraft(
  storage: DraftStorage | null = browserStorage(),
): StoredDraft | null {
  if (!storage) return null;
  try {
    return parseStoredDraft(storage.getItem(DRAFT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveStoredDraft(
  draft: StoredDraft,
  storage: DraftStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Kuota penuh / mode privat: autosave tidak boleh menghentikan alur.
  }
}

export function clearStoredDraft(storage: DraftStorage | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Diabaikan dengan sengaja.
  }
}

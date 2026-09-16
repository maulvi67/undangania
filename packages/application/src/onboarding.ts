import type { TenantContext } from "@wedding/domain";
import {
  InvalidInputError,
  NotFoundError,
  StaleVersionError,
  UnavailableError,
  assertAnyRole,
  isCalendarDate,
  isNonEmptyText,
  OWNER_ROLES,
  requireTenantContext,
} from "./use-case-support";

/**
 * Onboarding use-cases.
 *
 * Onboarding writes to `Wedding` and `WeddingEvent`, and is the only place that
 * sets `Wedding.onboardingCompletedAt`. Two rules are enforced here rather than
 * in storage:
 *
 *   1. A couple must be named, and at least one event must exist with a date.
 *      Both are checked before the completion flag is set, so "completed" means
 *      the data is actually usable by the invitation template.
 *   2. Completion is version-guarded, like every other draft write, so a second
 *      tab cannot complete onboarding on top of newer input.
 *
 * Ports are structural; this package does not depend on `@wedding/database`.
 */

export type OnboardingScope = Readonly<{
  tenantId: string;
  weddingId: string;
  actorId: string;
}>;

export type OnboardingData = Readonly<{
  partner1Name: string;
  partner2Name: string;
  weddingDate: string | null;
  weddingDateUndecided: boolean;
  eventType: string;
  eventDate: string | null;
  eventTime: string | null;
  city: string;
  timezone: string;
  venueName: string;
  venueAddress: string;
  locale: "id" | "en";
}>;

export type OnboardingDraft = Readonly<{
  weddingId: string;
  version: number;
  completed: boolean;
  data: OnboardingData;
  firstEventId: string | null;
}>;

export type OnboardingPort = Readonly<{
  loadDraft(scope: OnboardingScope): Promise<OnboardingDraft | null>;
  saveStep(
    scope: OnboardingScope,
    input: Readonly<{
      step: 1 | 2 | 3;
      data: Partial<OnboardingData>;
      baseVersion: number;
    }>,
  ): Promise<
    | Readonly<{ ok: true; version: number }>
    | Readonly<{ ok: false; reason: "NOT_FOUND" }>
    | Readonly<{ ok: false; reason: "STALE"; currentVersion: number }>
  >;
  complete(
    scope: OnboardingScope,
    input: Readonly<{ data: OnboardingData; baseVersion: number }>,
  ): Promise<
    | Readonly<{ ok: true; version: number; data: OnboardingData }>
    | Readonly<{ ok: false; reason: "NOT_FOUND" }>
    | Readonly<{ ok: false; reason: "STALE"; currentVersion: number }>
  >;
}>;

export type OnboardingPorts = Readonly<{ onboarding: OnboardingPort }>;

const MAX_NAME_LENGTH = 100;
const MAX_CITY_LENGTH = 100;
const MAX_VENUE_LENGTH = 150;

/**
 * Checks that the draft is complete enough to publish an invitation from. Kept
 * as a pure function so the console can show the same list of missing fields
 * that completion enforces.
 */
export function onboardingIssues(
  data: OnboardingData,
): readonly Readonly<{ field: string; message: string }>[] {
  const issues: { field: string; message: string }[] = [];

  if (!isNonEmptyText(data.partner1Name, MAX_NAME_LENGTH)) {
    issues.push({
      field: "partner1Name",
      message: "Nama mempelai pertama wajib diisi.",
    });
  }
  if (!isNonEmptyText(data.partner2Name, MAX_NAME_LENGTH)) {
    issues.push({
      field: "partner2Name",
      message: "Nama mempelai kedua wajib diisi.",
    });
  }
  if (!data.weddingDateUndecided) {
    if (data.weddingDate === null || !isCalendarDate(data.weddingDate)) {
      issues.push({
        field: "weddingDate",
        message:
          "Tanggal pernikahan wajib diisi, atau tandai belum ditentukan.",
      });
    }
  }
  if (!isNonEmptyText(data.eventType, MAX_NAME_LENGTH)) {
    issues.push({ field: "eventType", message: "Jenis acara wajib diisi." });
  }
  if (data.eventDate === null || !isCalendarDate(data.eventDate)) {
    issues.push({ field: "eventDate", message: "Tanggal acara wajib diisi." });
  }
  if (!isNonEmptyText(data.city, MAX_CITY_LENGTH)) {
    issues.push({ field: "city", message: "Kota wajib diisi." });
  }
  if (!isNonEmptyText(data.venueName, MAX_VENUE_LENGTH)) {
    issues.push({ field: "venueName", message: "Nama lokasi wajib diisi." });
  }

  return issues;
}

export async function loadOnboarding(
  context: TenantContext | null | undefined,
  input: Readonly<{ weddingId: string }>,
  ports: OnboardingPorts,
): Promise<OnboardingDraft> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, OWNER_ROLES);
  if (input.weddingId.trim().length === 0) {
    throw new InvalidInputError("Data pernikahan tidak dikenali.");
  }

  const draft = await ports.onboarding.loadDraft({
    tenantId: tenant.tenantId,
    weddingId: input.weddingId,
    actorId: tenant.actorId,
  });
  if (draft === null)
    throw new NotFoundError("Data pernikahan tidak ditemukan.");

  return draft;
}

/**
 * Saves one onboarding step. Steps are saved independently so a long form does
 * not lose earlier answers when a later step fails validation.
 */
export async function saveOnboardingStep(
  context: TenantContext | null | undefined,
  input: Readonly<{
    weddingId: string;
    step: 1 | 2 | 3;
    data: Partial<OnboardingData>;
    baseVersion: number;
  }>,
  ports: OnboardingPorts,
): Promise<number> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, OWNER_ROLES);
  if (input.weddingId.trim().length === 0) {
    throw new InvalidInputError("Data pernikahan tidak dikenali.");
  }
  if (![1, 2, 3].includes(input.step)) {
    throw new InvalidInputError("Langkah onboarding tidak dikenali.");
  }
  if (!Number.isInteger(input.baseVersion) || input.baseVersion < 0) {
    throw new InvalidInputError("Versi data tidak valid.");
  }
  if (input.data.weddingDate !== undefined && input.data.weddingDate !== null) {
    if (!isCalendarDate(input.data.weddingDate)) {
      throw new InvalidInputError("Format tanggal pernikahan tidak valid.");
    }
  }
  if (input.data.eventDate !== undefined && input.data.eventDate !== null) {
    if (!isCalendarDate(input.data.eventDate)) {
      throw new InvalidInputError("Format tanggal acara tidak valid.");
    }
  }

  const result = await ports.onboarding.saveStep(
    {
      tenantId: tenant.tenantId,
      weddingId: input.weddingId,
      actorId: tenant.actorId,
    },
    { step: input.step, data: input.data, baseVersion: input.baseVersion },
  );

  if (!result.ok) {
    if (result.reason === "NOT_FOUND") {
      throw new NotFoundError("Data pernikahan tidak ditemukan.");
    }
    throw new StaleVersionError(
      "Data sudah diperbarui di tempat lain. Muat ulang lalu coba lagi.",
    );
  }

  return result.version;
}

/**
 * Completes onboarding.
 *
 * Validation happens before the write, and the port re-checks nothing: the
 * caller here is the only path that sets the completion flag, so this is the one
 * place the rule needs to live.
 */
export async function completeOnboarding(
  context: TenantContext | null | undefined,
  input: Readonly<{
    weddingId: string;
    data: OnboardingData;
    baseVersion: number;
  }>,
  ports: OnboardingPorts,
): Promise<OnboardingDraft> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, OWNER_ROLES);
  if (input.weddingId.trim().length === 0) {
    throw new InvalidInputError("Data pernikahan tidak dikenali.");
  }

  const issues = onboardingIssues(input.data);
  if (issues.length > 0) {
    // The first message is what the form shows; the whole list is available to
    // the caller if it wants to highlight every field.
    throw new InvalidInputError(
      issues[0]?.message ?? "Data onboarding belum lengkap.",
    );
  }

  const result = await ports.onboarding.complete(
    {
      tenantId: tenant.tenantId,
      weddingId: input.weddingId,
      actorId: tenant.actorId,
    },
    { data: input.data, baseVersion: input.baseVersion },
  );

  if (!result.ok) {
    if (result.reason === "NOT_FOUND") {
      throw new NotFoundError("Data pernikahan tidak ditemukan.");
    }
    throw new StaleVersionError(
      "Data berubah sebelum disimpan. Muat ulang lalu coba lagi.",
    );
  }

  const saved = await ports.onboarding.loadDraft({
    tenantId: tenant.tenantId,
    weddingId: input.weddingId,
    actorId: tenant.actorId,
  });
  if (saved === null) {
    throw new UnavailableError("Data onboarding tidak dapat dibaca kembali.");
  }

  return saved;
}

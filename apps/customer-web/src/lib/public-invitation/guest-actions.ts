"use server";

import {
  PrismaGuestbookSubmissionTransaction,
  PrismaRsvpSubmissionTransaction,
  PrismaSubmissionRateLimiter,
  type RsvpSubmitResult,
} from "@wedding/database";
import {
  GUESTBOOK_MAX_LENGTH,
  validateGuestbookMessage,
} from "../guestbook/contract";
import type { GuestbookSubmissionResult } from "../guestbook/contract";
import type { RsvpResponse, RsvpSubmissionResult } from "../rsvp/contract";

/**
 * Guest-facing submission actions.
 *
 * These are the only writes reachable without a session, so the request body is
 * treated as untrusted in full: the household is resolved from the personalized
 * link's token server-side, and nothing else in the payload is believed. The
 * optional `token` is the one value the client may supply, and it is only ever used
 * to look the household up — never to name a tenant or an existing answer.
 */

const MAX_UPDATES = 20;

function isResponse(value: unknown): value is RsvpResponse {
  return value === "ATTENDING" || value === "DECLINED" || value === "TENTATIVE";
}

function isIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && value.length >= 16 && value.length <= 128;
}

function errorCodeFor(
  result: Extract<RsvpSubmitResult, { kind: "invalid" }>,
): RsvpSubmissionResult {
  // Every validation failure is a submission problem from the guest's point of
  // view; none of them is actionable beyond retrying or correcting the form.
  void result;
  return {
    kind: "error",
    code: "SUBMISSION_FAILED",
    message: "Jawaban belum dapat disimpan. Periksa kembali pilihan Anda.",
    preserveInput: true,
  };
}

/**
 * Resolves the household behind a personalized link and reports it in the same
 * shape the fixture transport used, so the client's state machine is unchanged.
 */
export async function submitRsvpAction(input: {
  token: string;
  invitationSlug: string;
  idempotencyKey: string;
  updates: readonly {
    eventId: string;
    response: string;
    pax: number;
    expectedVersion: number | null;
  }[];
}): Promise<RsvpSubmissionResult> {
  if (!isIdempotencyKey(input.idempotencyKey)) {
    return {
      kind: "error",
      code: "IDEMPOTENCY_CONFLICT",
      message: "Permintaan tidak dapat diproses. Muat ulang halaman ini.",
      preserveInput: true,
    };
  }
  if (input.updates.length === 0 || input.updates.length > MAX_UPDATES) {
    return {
      kind: "error",
      code: "SUBMISSION_FAILED",
      message: "Tidak ada jawaban yang dapat disimpan.",
      preserveInput: true,
    };
  }

  const updates: Array<{
    eventId: string;
    response: RsvpResponse;
    pax: number;
    expectedVersion: number | null;
  }> = [];
  for (const update of input.updates) {
    if (typeof update.eventId !== "string" || !isResponse(update.response)) {
      return {
        kind: "error",
        code: "SUBMISSION_FAILED",
        message: "Jawaban belum dapat dibaca. Muat ulang halaman ini.",
        preserveInput: true,
      };
    }
    if (!Number.isInteger(update.pax) || update.pax < 0) {
      return {
        kind: "error",
        code: "SUBMISSION_FAILED",
        message:
          "Jumlah tamu belum dapat dibaca. Periksa kembali pilihan Anda.",
        preserveInput: true,
      };
    }
    updates.push({
      eventId: update.eventId,
      response: update.response,
      pax: update.pax,
      expectedVersion:
        update.expectedVersion === null ||
        (Number.isInteger(update.expectedVersion) &&
          update.expectedVersion >= 0)
          ? update.expectedVersion
          : null,
    });
  }

  try {
    const household = await resolveHouseholdByToken(
      input.token,
      input.invitationSlug,
    );
    if (household === null) {
      return {
        kind: "error",
        code: "SUBMISSION_FAILED",
        message:
          "Tautan undangan ini tidak dapat digunakan. Minta tautan terbaru kepada pasangan.",
        preserveInput: true,
      };
    }

    // Checked before the write so a refused request costs nothing, and counted from
    // committed submissions so a validation error never consumes a guest's budget.
    const now = new Date();
    const limit = await new PrismaSubmissionRateLimiter().checkRsvp(
      household.householdId,
      now,
      undefined,
      input.idempotencyKey,
    );
    if (!limit.allowed) {
      return {
        kind: "error",
        code: "RATE_LIMITED",
        message: rateLimitMessage(
          "Terlalu banyak percobaan. Silakan tunggu sebentar sebelum mencoba lagi.",
          limit.retryAfterSeconds,
        ),
        preserveInput: true,
        retryAfterSeconds: limit.retryAfterSeconds,
      };
    }

    const result = await new PrismaRsvpSubmissionTransaction().submit(
      {
        householdId: household.householdId,
        updates,
        idempotencyKey: input.idempotencyKey,
      },
      now,
    );

    switch (result.kind) {
      case "success":
      case "replayed":
        return {
          kind: "success",
          answers: result.answers.map((answer) => ({
            response: answer.response,
            pax: answer.pax,
            optimisticVersion: answer.optimisticVersion,
          })),
          message: "Jawaban kehadiran berhasil disimpan.",
        };
      case "stale":
        return {
          kind: "error",
          code: "STALE_VERSION",
          message:
            "Jawaban ini berubah di perangkat lain. Periksa kembali pilihan Anda sebelum menyimpan.",
          eventId: result.eventId,
          preserveInput: true,
        };
      case "invalid":
        return errorCodeFor(result);
      case "idempotency-conflict":
        return {
          kind: "error",
          code: "IDEMPOTENCY_CONFLICT",
          message: "Permintaan berbeda menggunakan kunci pengiriman yang sama.",
          preserveInput: true,
        };
      case "paused":
        return {
          kind: "error",
          code: "PAUSED",
          message: "Konfirmasi sedang dijeda. Coba lagi nanti.",
          preserveInput: true,
        };
      case "expired":
        return {
          kind: "error",
          code: "EXPIRED",
          message:
            "Undangan ini sudah berakhir sehingga jawaban tidak dapat diubah.",
          preserveInput: true,
        };
      case "not-found":
        return {
          kind: "error",
          code: "SUBMISSION_FAILED",
          message:
            "Tautan undangan ini sudah tidak aktif. Minta tautan terbaru kepada pasangan.",
          preserveInput: true,
        };
    }
  } catch {
    return {
      kind: "error",
      code: "SUBMISSION_FAILED",
      message: "Jawaban belum tersimpan. Periksa koneksi Anda lalu coba lagi.",
      preserveInput: true,
    };
  }
}

export async function submitGuestbookAction(input: {
  token: string;
  invitationSlug: string;
  message: string;
  idempotencyKey: string;
}): Promise<GuestbookSubmissionResult> {
  if (!isIdempotencyKey(input.idempotencyKey)) {
    return {
      kind: "error",
      code: "SUBMISSION_FAILED",
      message: "Permintaan tidak dapat diproses. Muat ulang halaman ini.",
      preserveInput: true,
    };
  }

  // Validated against the same rule the form uses, so a client that bypasses the
  // form cannot store a message the UI would have rejected.
  const validation = validateGuestbookMessage(input.message);
  if (!validation.valid) {
    return {
      kind: "error",
      code: "REJECTED",
      message: validation.message,
      preserveInput: true,
    };
  }

  try {
    const household = await resolveHouseholdByToken(
      input.token,
      input.invitationSlug,
    );
    if (household === null) {
      return {
        kind: "error",
        code: "REJECTED",
        message:
          "Tautan undangan ini tidak dapat digunakan. Minta tautan terbaru kepada pasangan.",
        preserveInput: true,
      };
    }

    const now = new Date();
    const limit = await new PrismaSubmissionRateLimiter().checkGuestbook(
      household.householdId,
      now,
      undefined,
      input.idempotencyKey,
    );
    if (!limit.allowed) {
      return {
        kind: "error",
        code: "RATE_LIMITED",
        message: rateLimitMessage(
          "Terlalu banyak percobaan. Silakan tunggu sebentar sebelum mengirim lagi.",
          limit.retryAfterSeconds,
        ),
        preserveInput: true,
        retryAfterSeconds: limit.retryAfterSeconds,
      };
    }

    const result = await new PrismaGuestbookSubmissionTransaction().submit(
      {
        householdId: household.householdId,
        // `validation.value` is the normalized form the validator returned; the raw
        // input is not used again.
        message: validation.value.slice(0, GUESTBOOK_MAX_LENGTH),
        idempotencyKey: input.idempotencyKey,
        displayNameFallback: "Tamu undangan",
      },
      now,
    );

    switch (result.kind) {
      case "success":
      case "replayed":
        return {
          kind: "success",
          status: "PENDING",
          message: "Ucapan terkirim untuk ditinjau.",
        };
      case "invalid":
        return {
          kind: "error",
          code: "REJECTED",
          message:
            "Ucapan belum dapat diterima. Silakan gunakan kata-kata yang lebih sederhana.",
          preserveInput: true,
        };
      case "idempotency-conflict":
        return {
          kind: "error",
          code: "IDEMPOTENCY_CONFLICT",
          message: "Permintaan berbeda menggunakan kunci pengiriman yang sama.",
          preserveInput: true,
        };
      case "paused":
        return {
          kind: "error",
          code: "PAUSED",
          message: "Buku tamu sedang dijeda. Coba lagi nanti.",
          preserveInput: true,
        };
      case "expired":
        return {
          kind: "error",
          code: "EXPIRED",
          message:
            "Undangan ini sudah berakhir sehingga ucapan tidak dapat dikirim.",
          preserveInput: true,
        };
      case "not-found":
        return {
          kind: "error",
          code: "REJECTED",
          message:
            "Tautan undangan ini sudah tidak aktif. Minta tautan terbaru kepada pasangan.",
          preserveInput: true,
        };
    }
  } catch {
    return {
      kind: "error",
      code: "SUBMISSION_FAILED",
      message: "Ucapan belum terkirim. Periksa koneksi Anda lalu coba lagi.",
      preserveInput: true,
    };
  }
}

function rateLimitMessage(prefix: string, retryAfterSeconds: number): string {
  if (retryAfterSeconds <= 0) return prefix;
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `${prefix} Perkiraan waktu tunggu: ${minutes} menit.`;
}

/**
 * Resolves a personalized-link token to its household.
 *
 * A malformed token never reaches the database, and the repository returns the
 * same `null` for an unknown token as for a revoked one, so a guessed value cannot
 * be distinguished from an expired link.
 */
async function resolveHouseholdByToken(
  token: string,
  invitationSlug: string,
): Promise<{ householdId: string } | null> {
  const { PrismaGuestAccessRepository } = await import("@wedding/database");
  const resolved = await new PrismaGuestAccessRepository().resolveByToken(
    token,
    invitationSlug,
  );
  return resolved === null ? null : { householdId: resolved.householdId };
}

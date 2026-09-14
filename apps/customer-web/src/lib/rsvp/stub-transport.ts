import type {
  RsvpSubmitCommand,
  RsvpSubmissionResult,
  RsvpTransport,
} from "./contract";

export type RsvpSimulation =
  "success" | "submission-failed" | "stale" | "rate-limited";

function waitForFixtureTransport(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 40);
  });
}

function payloadFor(command: RsvpSubmitCommand): string {
  return JSON.stringify(command.updates);
}

function successFor(command: RsvpSubmitCommand): RsvpSubmissionResult {
  return {
    kind: "success",
    answers: command.updates.map((update) => ({
      response: update.response,
      pax: update.pax,
      optimisticVersion: (update.expectedVersion ?? 0) + 1,
    })),
    message: "Jawaban kehadiran berhasil disimpan.",
  };
}

/**
 * Fixture-only transport. It exercises the UI state machine and is not a
 * persistence or authorization boundary.
 */
export function createRsvpStubTransport(
  simulation: RsvpSimulation,
): RsvpTransport {
  let previous:
    | { idempotencyKey: string; payload: string; result: RsvpSubmissionResult }
    | undefined;

  return {
    async submit(command) {
      await waitForFixtureTransport();
      const payload = payloadFor(command);

      if (previous?.idempotencyKey === command.idempotencyKey) {
        if (previous.payload === payload) return previous.result;
        return {
          kind: "error",
          code: "IDEMPOTENCY_CONFLICT",
          message: "Permintaan berbeda menggunakan kunci pengiriman yang sama.",
          preserveInput: true,
        };
      }

      let result: RsvpSubmissionResult;
      if (simulation === "submission-failed") {
        result = {
          kind: "error",
          code: "SUBMISSION_FAILED",
          message:
            "Jawaban belum tersimpan. Periksa koneksi Anda lalu coba lagi.",
          preserveInput: true,
        };
      } else if (simulation === "stale") {
        result = {
          kind: "error",
          code: "STALE_VERSION",
          message:
            "Jawaban ini berubah di perangkat lain. Periksa kembali pilihan Anda sebelum menyimpan.",
          preserveInput: true,
        };
      } else if (simulation === "rate-limited") {
        result = {
          kind: "error",
          code: "RATE_LIMITED",
          message:
            "Terlalu banyak percobaan. Silakan tunggu sebentar sebelum mencoba lagi.",
          preserveInput: true,
        };
      } else {
        result = successFor(command);
      }

      previous = { idempotencyKey: command.idempotencyKey, payload, result };
      return result;
    },
  };
}

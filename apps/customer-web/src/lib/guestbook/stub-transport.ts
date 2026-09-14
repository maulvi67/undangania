import type { GuestbookSubmissionResult, GuestbookTransport } from "./contract";

export type GuestbookSimulation =
  "success" | "submission-failed" | "rejected" | "rate-limited";

function waitForFixtureTransport(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 40);
  });
}

/**
 * Fixture-only transport. Production moderation, authorization, and storage
 * must remain server-side when this boundary is replaced.
 */
export function createGuestbookStubTransport(
  simulation: GuestbookSimulation,
): GuestbookTransport {
  return {
    async submit(): Promise<GuestbookSubmissionResult> {
      await waitForFixtureTransport();
      if (simulation === "submission-failed") {
        return {
          kind: "error",
          code: "SUBMISSION_FAILED",
          message:
            "Ucapan belum terkirim. Periksa koneksi Anda lalu coba lagi.",
          preserveInput: true,
        };
      }
      if (simulation === "rejected") {
        return {
          kind: "error",
          code: "REJECTED",
          message:
            "Ucapan belum dapat diterima. Silakan gunakan kata-kata yang lebih sederhana.",
          preserveInput: true,
        };
      }
      if (simulation === "rate-limited") {
        return {
          kind: "error",
          code: "RATE_LIMITED",
          message:
            "Terlalu banyak percobaan. Silakan tunggu sebentar sebelum mengirim lagi.",
          preserveInput: true,
        };
      }
      return {
        kind: "success",
        status: "PENDING",
        message: "Ucapan terkirim untuk ditinjau.",
      };
    },
  };
}

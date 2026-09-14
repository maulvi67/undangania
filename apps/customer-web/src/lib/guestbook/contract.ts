export const GUESTBOOK_MAX_LENGTH = 500;

export type GuestbookAvailability = Readonly<{
  enabled: boolean;
  status: "available" | "unavailable";
}>;

export type GuestbookSubmitCommand = Readonly<{
  message: string;
  idempotencyKey: string;
}>;

export type GuestbookSubmissionSuccess = Readonly<{
  kind: "success";
  status: "PENDING";
  message: string;
}>;

export type GuestbookSubmissionErrorCode =
  "SUBMISSION_FAILED" | "REJECTED" | "RATE_LIMITED";

export type GuestbookSubmissionError = Readonly<{
  kind: "error";
  code: GuestbookSubmissionErrorCode;
  message: string;
  preserveInput: true;
}>;

export type GuestbookSubmissionResult =
  GuestbookSubmissionSuccess | GuestbookSubmissionError;

export type GuestbookTransport = Readonly<{
  submit(command: GuestbookSubmitCommand): Promise<GuestbookSubmissionResult>;
}>;

export function validateGuestbookMessage(
  message: string,
): { valid: true; value: string } | { valid: false; message: string } {
  const normalized = message.replace(/\r\n?/g, "\n");
  if (normalized.trim().length === 0) {
    return { valid: false, message: "Tulis ucapan Anda terlebih dahulu." };
  }
  if (normalized.length > GUESTBOOK_MAX_LENGTH) {
    return {
      valid: false,
      message: `Ucapan maksimal ${GUESTBOOK_MAX_LENGTH} karakter.`,
    };
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)) {
    return {
      valid: false,
      message: "Ucapan tidak dapat memuat karakter kontrol.",
    };
  }
  return { valid: true, value: normalized };
}

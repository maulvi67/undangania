import { z } from "zod";

/**
 * Auth transport contract (MVP-UI-005).
 *
 * This module is the handoff artifact to the identity owner: it defines the
 * request/response shapes and error semantics the real `/auth` backend must
 * implement. The UI currently talks to a deterministic simulation
 * (stub-transport.ts) that satisfies this contract without storing
 * credentials or creating sessions.
 *
 * Backend requirements encoded here (see design plan §9):
 * - R1 identical response shape/timing for unknown email vs wrong password.
 * - R2 password policy is server-owned; the UI hint mirrors MIN_PASSWORD_LENGTH.
 * - R3 forgot-password always reports "email sent" semantics.
 * - R4 register with a duplicate email responds exactly like a fresh
 *   registration (differentiation happens in email content, never the UI).
 * - R5 token TTLs: verification 24h, reset 1h (placeholders pending PM).
 * - R6 redirects and session creation happen server-side only.
 * - R7 never log credentials, tokens, or auth error codes with PII.
 */

export const MIN_PASSWORD_LENGTH = 8;

export const AUTH_ERROR_CODES = [
  "INVALID_CREDENTIALS",
  "VERIFICATION_REQUIRED",
  "SUSPENDED",
  "RATE_LIMITED",
  "PROVIDER_UNAVAILABLE",
  "TOKEN_EXPIRED",
  "TOKEN_INVALID",
  "VALIDATION",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/**
 * Generic, actionable, safe copy per code. INVALID_CREDENTIALS deliberately
 * covers both unknown email and wrong password (anti-enumeration R1) and the
 * string is asserted byte-identical in e2e for both cases.
 */
export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  INVALID_CREDENTIALS: "Email atau kata sandi tidak cocok.",
  VERIFICATION_REQUIRED:
    "Akun belum diverifikasi. Kami mengirimkan tautan verifikasi ke email Anda — silakan periksa kotak masuk Anda.",
  SUSPENDED:
    "Akun Anda sedang ditangguhkan. Silakan hubungi dukungan untuk membuka kembali akun.",
  RATE_LIMITED:
    "Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.",
  PROVIDER_UNAVAILABLE:
    "Layanan masuk sedang tidak tersedia. Silakan coba beberapa saat lagi.",
  TOKEN_EXPIRED: "", // handled by dedicated panels with flow-specific copy
  TOKEN_INVALID: "", // handled by dedicated panels with flow-specific copy
  VALIDATION: "Periksa kembali isian Anda.",
};

// Inputs are normalized (lowercase email, collapsed whitespace) BEFORE parse;
// Zod v4 chained transforms are avoided by convention in this repo.

export const signInInputSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

export const registerInputSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
});

export const emailOnlyInputSchema = z.object({
  email: z.string().email().max(254),
});

export const verifyEmailInputSchema = z.object({
  token: z.string().min(16).max(256),
});

export const resetPasswordInputSchema = z.object({
  token: z.string().min(16).max(256),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
});

export type SignInInput = z.infer<typeof signInInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type EmailOnlyInput = z.infer<typeof emailOnlyInputSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;

/**
 * Transport results. `ok: true` carries at most a redirect target — never a
 * session token; sessions are created by the backend (R6) and are not part
 * of this contract's UI surface.
 */
export type AuthTransportOk = { ok: true; redirectTo?: string };

export type AuthTransportErr = { ok: false; code: AuthErrorCode };

export type AuthTransportResult = AuthTransportOk | AuthTransportErr;

/** Client form state machine shared by every auth form (useActionState). */
export type AuthFormState = {
  status: "idle" | "error" | "done";
  /** Field-scoped Indonesian messages, keyed by input name. */
  fieldErrors: Partial<Record<"email" | "password", string>>;
  /** Machine code for the form-level message (never PII). */
  code?: AuthErrorCode;
  /** Set by register/forgot flows after success to render the interstitial. */
  emailSentTo?: string;
};

export const INITIAL_AUTH_FORM_STATE: AuthFormState = {
  status: "idle",
  fieldErrors: {},
};

/** Form-level copy for the current state; field errors carry the specifics. */
export function formLevelMessage(state: AuthFormState): string {
  if (state.status !== "error" || !state.code) return "";
  return AUTH_ERROR_MESSAGES[state.code];
}

export function normalizeEmail(value: string): string {
  // Domain rule: unique NORMALIZED email — trim, strip all internal
  // whitespace (an email address cannot contain spaces), lowercase.
  return value.trim().replaceAll(/\s+/g, "").toLowerCase();
}

export function isAdequatePassword(value: string): boolean {
  return value.trim().length >= MIN_PASSWORD_LENGTH;
}

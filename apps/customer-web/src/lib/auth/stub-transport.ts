/**
 * ⚠️ SIMULATION ONLY — MVP-UI-005 stub transport. ⚠️
 *
 * This module implements the auth transport contract with DETERMINISTIC
 * FIXTURES so the auth UI can be built, demoed, and tested before the real
 * `/auth` backend exists. It:
 *
 *   - stores NOTHING (no credentials, no tokens, no sessions, no emails),
 *   - authenticates NOBODY (success never grants any real access),
 *   - exists solely to map fixture inputs onto every required UI state.
 *
 * Replacing it with the real provider client is a Security-reviewed,
 * human-approved change (AGENTS.md high-risk list). Until then, no route
 * served by this transport may be described as secure or production-auth.
 *
 * Fixture surface (all @example.com; documented for tests):
 *   terdaftar@example.com + SandiBenar123          → success
 *   belum-verifikasi@example.com + SandiBenar123   → VERIFICATION_REQUIRED
 *   ditangguhkan@example.com + SandiBenar123       → SUSPENDED
 *   terbatas@example.com + any password            → RATE_LIMITED
 *   gangguan@example.com + any password            → PROVIDER_UNAVAILABLE
 *   any other account + wrong/unknown              → INVALID_CREDENTIALS
 *   tokens: verifikasi-valid / verifikasi-kedaluwarsa / reset-valid /
 *           reset-kedaluwarsa; any other ≥16-char token → TOKEN_INVALID
 */

import type {
  AuthErrorCode,
  AuthTransportResult,
  EmailOnlyInput,
  RegisterInput,
  ResetPasswordInput,
  SignInInput,
  VerifyEmailInput,
} from "./contract";

/** Artificial latency so pending/disabled states are real and testable. */
const SIMULATED_DELAY_MS = 400;

const FIXTURE_PASSWORD = "SandiBenar123";

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));
}

function err(code: AuthErrorCode): AuthTransportResult {
  return { ok: false, code };
}

export async function stubSignIn(
  input: SignInInput,
): Promise<AuthTransportResult> {
  await delay();
  // Rate limiting and provider outages precede credential checks in the
  // real world (and must in the stub: fixtures for those states use any password).
  if (input.email === "terbatas@example.com") return err("RATE_LIMITED");
  if (input.email === "gangguan@example.com")
    return err("PROVIDER_UNAVAILABLE");
  if (input.password !== FIXTURE_PASSWORD) return err("INVALID_CREDENTIALS");
  if (input.email === "belum-verifikasi@example.com")
    return err("VERIFICATION_REQUIRED");
  if (input.email === "ditangguhkan@example.com") return err("SUSPENDED");
  if (input.email === "terdaftar@example.com") return { ok: true };
  return err("INVALID_CREDENTIALS");
}

export async function stubRegister(
  _input: RegisterInput,
): Promise<AuthTransportResult> {
  await delay();
  // Always "succeeds" (R4): duplicate vs fresh email is indistinguishable here;
  // differentiation would happen in email content on the real backend.
  void _input;
  return { ok: true };
}

export async function stubResendVerification(
  _input: EmailOnlyInput,
): Promise<AuthTransportResult> {
  await delay();
  void _input;
  return { ok: true }; // always (anti-enumeration R3/R4)
}

export async function stubRequestPasswordReset(
  _input: EmailOnlyInput,
): Promise<AuthTransportResult> {
  await delay();
  void _input;
  return { ok: true }; // always (anti-enumeration R3)
}

export async function stubVerifyEmail(
  input: VerifyEmailInput,
): Promise<AuthTransportResult> {
  await delay();
  if (input.token === "verifikasi-valid-verifikasi-valid") return { ok: true };
  if (input.token === "verifikasi-kedaluwarsa-x") return err("TOKEN_EXPIRED");
  return err("TOKEN_INVALID");
}

export async function stubResetPassword(
  input: ResetPasswordInput,
): Promise<AuthTransportResult> {
  await delay();
  if (input.token === "reset-valid-reset-valid") return { ok: true };
  if (input.token === "reset-kedaluwarsa-xxxx") return err("TOKEN_EXPIRED");
  return err("TOKEN_INVALID");
}

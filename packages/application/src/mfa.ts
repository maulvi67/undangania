import type { TenantContext } from "@wedding/domain";
import {
  ConflictError,
  ForbiddenError,
  InvalidInputError,
  NotFoundError,
  assertAnyRole,
  ADMIN_ROLES,
  requireTenantContext,
} from "./use-case-support";

/**
 * MFA enrolment and step-up use-cases.
 *
 * This is the highest-risk surface in the system: it decides whether a second
 * factor is required and whether one has been satisfied. The rules encoded here:
 *
 *   1. Step-up is checked against the *role*, not the request. An admin request
 *      without a satisfied second factor is refused even if the session is valid,
 *      so a stolen session cookie is not sufficient to reach the console.
 *   2. A wrong code is reported as a failure, never as "not enrolled". Telling a
 *      caller that MFA is unconfigured when it is configured would hand them a
 *      way to probe which accounts have it.
 *   3. Enrolment is not enabled until a code has been confirmed. `enrol` returns
 *      a secret; `confirm` is what turns the factor on. A half-finished
 *      enrolment must never lock anyone out.
 *   4. A code cannot be reused inside its own time step. The port reports
 *      `replayed` for that, and it is treated as a failure, not a success.
 *
 * Ports are structural; this package does not depend on `@wedding/database`, and
 * the secret is only ever handled as an opaque sealed value here.
 */

export type MfaStatus = Readonly<{
  enabled: boolean;
  enrolmentPending: boolean;
  remainingRecoveryCodes: number;
}>;

export type MfaEnrolmentStart = Readonly<{
  /** Shown once as a QR code. Never persisted in plaintext by any layer. */
  secret: string;
  uri: string;
}>;

export type MfaEnrolmentConfirmResult =
  | Readonly<{ kind: "confirmed"; recoveryCodes: readonly string[] }>
  | Readonly<{ kind: "no-enrolment" }>
  | Readonly<{ kind: "invalid-code" }>;

export type MfaVerificationResult =
  | Readonly<{ kind: "verified" }>
  | Readonly<{ kind: "not-enrolled" }>
  | Readonly<{ kind: "revoked" }>
  | Readonly<{ kind: "invalid-code" }>
  | Readonly<{ kind: "replayed" }>;

export type MfaRecoveryResult =
  | Readonly<{ kind: "redeemed"; remainingCodes: number }>
  | Readonly<{ kind: "invalid-code" }>;

export interface MfaPort {
  status(userId: string): Promise<MfaStatus>;
  beginEnrolment(input: {
    userId: string;
    accountName: string;
    issuer: string;
  }): Promise<MfaEnrolmentStart>;
  confirmEnrolment(input: {
    userId: string;
    code: string;
    at: Date;
  }): Promise<MfaEnrolmentConfirmResult>;
  verify(input: {
    userId: string;
    code: string;
    at: Date;
  }): Promise<MfaVerificationResult>;
  redeemRecoveryCode(input: {
    userId: string;
    code: string;
    at: Date;
  }): Promise<MfaRecoveryResult>;
  revoke(userId: string): Promise<boolean>;
}

export type MfaPorts = Readonly<{ mfa: MfaPort }>;

const ISSUER = "Wedding System";
const TOTP_CODE_PATTERN = /^\d{6}$/;
const RECOVERY_CODE_PATTERN = /^[0-9A-F]{20}$/;

/**
 * Normalizes a submitted TOTP code. Spaces are stripped because people type them
 * when copying from an authenticator, and the comparison is fixed-width anyway.
 */
export function normalizeTotpCode(code: string): string {
  return code.replaceAll(/\s+/g, "");
}

/**
 * Normalizes a recovery code to the form the hash is computed over: separators
 * removed, upper-cased.
 */
export function normalizeRecoveryCode(code: string): string {
  return code
    .trim()
    .replaceAll(/[\s-]+/g, "")
    .toUpperCase();
}

export function isRecoveryCodeFormat(code: string): boolean {
  return RECOVERY_CODE_PATTERN.test(normalizeRecoveryCode(code));
}

/**
 * Enrolment is offered to any admin. It is deliberately *not* restricted to a
 * narrower role: requiring an existing second factor to add a second factor
 * would leave the first admin permanently unable to enable one.
 */
export async function beginMfaEnrolment(
  context: TenantContext | null | undefined,
  input: Readonly<{ accountName: string }>,
  ports: MfaPorts,
): Promise<MfaEnrolmentStart> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, ADMIN_ROLES);
  if (input.accountName.trim().length === 0) {
    throw new InvalidInputError("Nama akun tidak valid.");
  }

  return ports.mfa.beginEnrolment({
    userId: tenant.actorId,
    accountName: input.accountName.trim(),
    issuer: ISSUER,
  });
}

/**
 * Confirms enrolment. This is the only path that enables the factor, and it
 * requires a working code — a secret that was never proven cannot become a
 * requirement for signing in.
 */
export async function confirmMfaEnrolment(
  context: TenantContext | null | undefined,
  input: Readonly<{ code: string }>,
  ports: MfaPorts,
  now: Date,
): Promise<readonly string[]> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, ADMIN_ROLES);

  const code = normalizeTotpCode(input.code);
  if (!TOTP_CODE_PATTERN.test(code)) {
    throw new InvalidInputError("Kode verifikasi harus 6 angka.");
  }

  const result = await ports.mfa.confirmEnrolment({
    userId: tenant.actorId,
    code,
    at: now,
  });

  switch (result.kind) {
    case "confirmed":
      return result.recoveryCodes;
    case "no-enrolment":
      throw new NotFoundError("Belum ada pendaftaran MFA yang menunggu.");
    case "invalid-code":
      throw new InvalidInputError("Kode verifikasi tidak cocok.");
    default:
      throw new ConflictError("MFA tidak dapat diaktifkan.");
  }
}

/**
 * Satisfies a step-up challenge.
 *
 * Both a TOTP code and a recovery code are accepted, because a lost phone must
 * not permanently lock an admin out of their own console. A recovery code is
 * single-use; the port enforces that.
 */
export async function verifyMfaStepUp(
  context: TenantContext | null | undefined,
  input: Readonly<{ code: string }>,
  ports: MfaPorts,
  now: Date,
): Promise<Readonly<{ remainingRecoveryCodes: number | null }>> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, ADMIN_ROLES);

  const raw = input.code.trim();
  if (raw.length === 0) {
    throw new InvalidInputError("Masukkan kode verifikasi.");
  }

  // A six-digit numeric value is a TOTP code; anything else with the right shape
  // is treated as a recovery code. Trying both silently would make a typo in one
  // flow consume an attempt in the other.
  if (TOTP_CODE_PATTERN.test(normalizeTotpCode(raw))) {
    const result = await ports.mfa.verify({
      userId: tenant.actorId,
      code: normalizeTotpCode(raw),
      at: now,
    });

    switch (result.kind) {
      case "verified":
        return { remainingRecoveryCodes: null };
      case "replayed":
        // Distinguished from a plain mismatch because it is the signature of a
        // code being replayed rather than mistyped.
        throw new ForbiddenError();
      case "revoked":
        throw new ForbiddenError();
      case "not-enrolled":
        throw new NotFoundError("MFA belum diaktifkan untuk akun ini.");
      case "invalid-code":
        throw new ForbiddenError();
      default:
        throw new ForbiddenError();
    }
  }

  if (!isRecoveryCodeFormat(raw)) {
    throw new InvalidInputError(
      "Kode verifikasi harus 6 angka atau kode pemulihan yang valid.",
    );
  }

  const result = await ports.mfa.redeemRecoveryCode({
    userId: tenant.actorId,
    code: normalizeRecoveryCode(raw),
    at: now,
  });
  if (result.kind === "invalid-code") {
    // A bad recovery code is reported exactly like a bad TOTP code so the
    // response does not reveal which factor was tried.
    throw new ForbiddenError();
  }

  return { remainingRecoveryCodes: result.remainingCodes };
}

/**
 * Reads the current factor state so the console can prompt at the right time.
 * Reading a status must not require a satisfied factor.
 */
export async function readMfaStatus(
  context: TenantContext | null | undefined,
  ports: MfaPorts,
): Promise<MfaStatus> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, ADMIN_ROLES);
  return ports.mfa.status(tenant.actorId);
}

/**
 * Turns MFA off. Requires a satisfied challenge first, so a stolen session
 * cannot be used to remove the factor that would have stopped it.
 */
export async function revokeMfa(
  context: TenantContext | null | undefined,
  input: Readonly<{ code: string }>,
  ports: MfaPorts,
  now: Date,
): Promise<void> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, ADMIN_ROLES);

  // Re-verify before disabling. Without this, a session that passed step-up an
  // hour ago could strip the factor without proving anything now.
  await verifyMfaStepUp(context, input, ports, now);
  await ports.mfa.revoke(tenant.actorId);
}

/**
 * Whether the account has a live second factor at all.
 *
 * This deliberately checks *enrolment*, not a satisfied challenge: whether a
 * challenge has been passed for the current session is session state, which is
 * not visible to this package. Callers use this to refuse console access to an
 * admin who has no second factor configured, and separately track whether the
 * current session has completed `verifyMfaStepUp`.
 *
 * An admin without a second factor cannot reach the console at all. Treating
 * "not enrolled" as satisfied would make MFA opt-in in practice.
 */
export async function assertMfaEnrolled(
  context: TenantContext | null | undefined,
  ports: MfaPorts,
): Promise<MfaStatus> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, ADMIN_ROLES);

  const status = await ports.mfa.status(tenant.actorId);
  if (!status.enabled) {
    throw new ForbiddenError();
  }
  return status;
}

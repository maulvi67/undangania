import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { hashToken } from "./tokens";

/**
 * MFA cryptographic primitives: TOTP (RFC 6238) and authenticated encryption of
 * the shared secret at rest.
 *
 * Two properties matter more than anything else here:
 *
 *   1. The TOTP secret is never stored, returned, or logged in plaintext. It is
 *      sealed with AES-256-GCM under a key derived from `AUTH_SECRET`, so a
 *      database dump alone does not let anyone mint valid second factors.
 *      GCM is authenticated, so a tampered ciphertext fails to decrypt rather
 *      than yielding a plausible wrong secret.
 *   2. Verification is constant-time and windowed. `timingSafeEqual` is used for
 *      the digest comparison, and a small accepted-skew window is bounded by the
 *      caller so a replay cannot be widened indefinitely.
 *
 * Clock is always supplied by the caller. Nothing in this module reads the wall
 * clock, which is what makes the replay window and step boundaries testable.
 */

const TOTP_SECRET_BYTES = 20;
const TOTP_DIGITS = 6;
const TOTP_STEP_SECONDS = 30;
const TOTP_ALGORITHM = "sha1";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY_BYTES = 32;
const ENCRYPTION_IV_BYTES = 12;
const ENCRYPTION_TAG_BYTES = 16;
const ENCRYPTION_KEY_SALT = "wedding-system:mfa:v1";
const ENCRYPTION_KEY_COST = 16_384;
const ENCRYPTION_KEY_BLOCK_SIZE = 8;
const ENCRYPTION_KEY_PARALLELIZATION = 1;
const ENCRYPTION_KEY_MAX_MEMORY = 32 * 1024 * 1024;

/**
 * `MfaCredential.secretEncrypted` is VarChar(512). A 20-byte secret encodes to
 * 40 bytes of ciphertext; base64url plus the version prefix stays far below the
 * limit, and the explicit bound turns a future format change into a clear throw
 * instead of a truncated secret.
 */
const MAX_SEALED_SECRET_LENGTH = 512;

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_BYTES = 10;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Derives the AES key from `AUTH_SECRET`. The salt is fixed and public: it only
 * separates this key from other uses of the same secret, and the secret itself
 * is what provides the entropy.
 */
function deriveEncryptionKey(authSecret: string): Buffer {
  if (authSecret.length === 0) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return scryptSync(authSecret, ENCRYPTION_KEY_SALT, ENCRYPTION_KEY_BYTES, {
    N: ENCRYPTION_KEY_COST,
    r: ENCRYPTION_KEY_BLOCK_SIZE,
    p: ENCRYPTION_KEY_PARALLELIZATION,
    maxmem: ENCRYPTION_KEY_MAX_MEMORY,
  });
}

export function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function decodeBase32(encoded: string): Buffer | null {
  const normalized = encoded
    .toUpperCase()
    .replaceAll("=", "")
    .replaceAll(" ", "");
  if (normalized.length === 0) return null;

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates a TOTP secret. Returns the base32 form (what an authenticator app
 * needs) and never the raw bytes, so a caller cannot accidentally persist the
 * unencoded value.
 */
export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(TOTP_SECRET_BYTES));
}

/**
 * Builds the `otpauth://` URI an authenticator app scans. The label includes the
 * account so two enrolments for the same issuer stay distinguishable.
 */
export function buildTotpUri(input: {
  secret: string;
  accountName: string;
  issuer: string;
}): string {
  // The label is `issuer:accountName` with each part encoded independently and
  // the separator left as a literal colon. Encoding the joined string would turn
  // the colon into `%3A`, which some authenticator apps fail to split on.
  // `@` is restored to its literal form to match the canonical otpauth example
  // (`Example:alice@google.com`); `%40` is technically equivalent but is not
  // what the reference format documents.
  const label = `${encodeUriPart(input.issuer)}:${encodeUriPart(input.accountName)}`;
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: TOTP_ALGORITHM.toUpperCase(),
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function encodeUriPart(value: string): string {
  return encodeURIComponent(value).replaceAll("%40", "@");
}

/**
 * Computes the TOTP for a specific step. `step` is supplied rather than derived
 * from the clock so the generator and the verifier share one definition of a
 * time step.
 */
export function totpForStep(secret: string, step: number): string | null {
  const key = decodeBase32(secret);
  if (key === null || key.length === 0) return null;
  if (!Number.isSafeInteger(step) || step < 0) return null;

  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac(TOTP_ALGORITHM, key).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    ((digest[offset + 1] ?? 0) << 16) |
    ((digest[offset + 2] ?? 0) << 8) |
    (digest[offset + 3] ?? 0);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function totpStepAt(at: Date): number {
  return Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS);
}

/**
 * Verifies a submitted code against a window of time steps.
 *
 * `skewSteps` widens the window symmetrically. One step either side is the
 * customary allowance for clock drift; larger values make replay practical, so
 * the caller is expected to keep it small. Returns the step that matched so the
 * caller can refuse to accept the same step twice.
 */
export function verifyTotp(input: {
  secret: string;
  code: string;
  at: Date;
  skewSteps: number;
}): number | null {
  const submitted = input.code.replaceAll(/\s+/g, "");
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(submitted)) return null;

  const currentStep = totpStepAt(input.at);
  const submittedBytes = Buffer.from(submitted, "utf8");

  for (let offset = -input.skewSteps; offset <= input.skewSteps; offset += 1) {
    const step = currentStep + offset;
    if (step < 0) continue;

    const expected = totpForStep(input.secret, step);
    if (expected === null) return null;

    const expectedBytes = Buffer.from(expected, "utf8");
    // Lengths are equal by construction; the guard keeps timingSafeEqual from
    // throwing if that ever stops being true.
    if (expectedBytes.length !== submittedBytes.length) continue;
    if (timingSafeEqual(expectedBytes, submittedBytes)) return step;
  }

  return null;
}

/**
 * Seals a TOTP secret for storage. Format is
 * `v1.<iv>.<ciphertext>.<authTag>`, all base64url. The version prefix lets a
 * future key or cipher change be detected rather than misread.
 */
export function sealTotpSecret(secret: string, authSecret: string): string {
  const key = deriveEncryptionKey(authSecret);
  const iv = randomBytes(ENCRYPTION_IV_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const sealed = [
    "v1",
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");

  if (sealed.length > MAX_SEALED_SECRET_LENGTH) {
    throw new Error("Sealed MFA secret exceeds the database storage limit");
  }

  return sealed;
}

/**
 * Opens a sealed secret. Returns `null` for any malformed, tampered, or
 * foreign-key value rather than throwing, so a corrupt row is treated as
 * "this factor cannot be used" instead of taking the request down.
 */
export function openTotpSecret(
  sealed: string,
  authSecret: string,
): string | null {
  const parts = sealed.split(".");
  if (parts.length !== 4) return null;

  const [version, encodedIv, encodedCiphertext, encodedTag] = parts;
  if (
    version !== "v1" ||
    encodedIv === undefined ||
    encodedCiphertext === undefined ||
    encodedTag === undefined
  ) {
    return null;
  }

  try {
    const key = deriveEncryptionKey(authSecret);
    const iv = Buffer.from(encodedIv, "base64url");
    const ciphertext = Buffer.from(encodedCiphertext, "base64url");
    const authTag = Buffer.from(encodedTag, "base64url");
    if (
      iv.length !== ENCRYPTION_IV_BYTES ||
      authTag.length !== ENCRYPTION_TAG_BYTES ||
      ciphertext.length === 0
    ) {
      return null;
    }

    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    // GCM verification failed, the key is wrong, or the value is not ciphertext.
    return null;
  }
}

export type GeneratedRecoveryCodes = Readonly<{
  /** Plaintext, shown to the user once and never persisted. */
  codes: readonly string[];
  /** SHA-256 of each code, in the same order. */
  hashes: readonly string[];
}>;

/**
 * Recovery codes are stored hashed with the same SHA-256 helper used for
 * sessions and auth tokens. They are high-entropy random values, not
 * user-chosen passwords, so a fast hash is appropriate and avoids a per-code
 * KDF cost on the sign-in path.
 */
export function generateRecoveryCodes(
  count: number = RECOVERY_CODE_COUNT,
): GeneratedRecoveryCodes {
  const codes: string[] = [];
  const hashes: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const raw = randomBytes(RECOVERY_CODE_BYTES).toString("hex").toUpperCase();
    // Grouped for legibility when a person reads one off a printed sheet.
    const code = `${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}`;
    codes.push(code);
    hashes.push(hashToken(normalizeRecoveryCode(code)));
  }

  return { codes, hashes };
}

/**
 * Recovery codes are compared case- and separator-insensitively, because the
 * person typing one is reading it from paper.
 */
export function normalizeRecoveryCode(code: string): string {
  return code
    .trim()
    .replaceAll(/[\s-]+/g, "")
    .toUpperCase();
}

export function hashRecoveryCode(code: string): string {
  return hashToken(normalizeRecoveryCode(code));
}

export const MFA_TOTP_CONFIG = {
  digits: TOTP_DIGITS,
  stepSeconds: TOTP_STEP_SECONDS,
  algorithm: TOTP_ALGORITHM.toUpperCase(),
  secretBytes: TOTP_SECRET_BYTES,
} as const;

export const MFA_RECOVERY_CODE_COUNT = RECOVERY_CODE_COUNT;

import { describe, expect, it } from "vitest";
import {
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  MIN_PASSWORD_LENGTH,
  emailOnlyInputSchema,
  isAdequatePassword,
  normalizeEmail,
  registerInputSchema,
  resetPasswordInputSchema,
  signInInputSchema,
} from "./contract";
import {
  stubRegister,
  stubRequestPasswordReset,
  stubResetPassword,
  stubResendVerification,
  stubSignIn,
  stubVerifyEmail,
} from "./stub-transport";

const VALID_PASSWORD = "SandiBenar123";

describe("contract schemas", () => {
  it("accepts well-formed sign-in input", () => {
    expect(
      signInInputSchema.parse({ email: "user@example.com", password: "x".repeat(8) }),
    ).toBeTruthy();
  });

  it("rejects malformed emails", () => {
    expect(() => emailOnlyInputSchema.parse({ email: "bukan-email" })).toThrow();
    expect(() => emailOnlyInputSchema.parse({ email: "" })).toThrow();
  });

  it("enforces the minimum password length on register and reset", () => {
    expect(() =>
      registerInputSchema.parse({ email: "a@example.com", password: "pendek" }),
    ).toThrow();
    expect(() =>
      resetPasswordInputSchema.parse({ token: "t".repeat(16), password: "pendek" }),
    ).toThrow();
    expect(
      registerInputSchema.parse({ email: "a@example.com", password: "x".repeat(MIN_PASSWORD_LENGTH) }),
    ).toBeTruthy();
  });

  it("requires 16+ character tokens", () => {
    expect(() => signInInputSchema.parse({ email: "a@example.com", password: "x".repeat(8) })).toBeTruthy();
    expect(() => resetPasswordInputSchema.parse({ token: "short", password: "x".repeat(8) })).toThrow();
  });

  it("normalizes emails (trim, collapse, lowercase) before callers parse", () => {
    expect(normalizeEmail("  Nama.Lastname@ Example.COM ")).toBe("nama.lastname@example.com");
  });

  it("exposes safe generic copy for every error code", () => {
    for (const code of AUTH_ERROR_CODES) {
      expect(typeof AUTH_ERROR_MESSAGES[code]).toBe("string");
    }
    // The anti-enumeration string must never name which field was wrong.
    expect(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS).toBe("Email atau kata sandi tidak cocok.");
    expect(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS).not.toMatch(/tidak ditemukan|belum terdaftar/i);
  });

  it("password adequacy helper mirrors the policy", () => {
    expect(isAdequatePassword("abc12345")).toBe(true);
    expect(isAdequatePassword("abc1234")).toBe(false);
  });
});

describe("stub transport determinism", () => {
  it("signs in the success fixture and nothing else with a wrong password", async () => {
    expect((await stubSignIn({ email: "terdaftar@example.com", password: VALID_PASSWORD })).ok).toBe(
      true,
    );
    expect(await stubSignIn({ email: "terdaftar@example.com", password: "salah" })).toEqual({
      ok: false,
      code: "INVALID_CREDENTIALS",
    });
  });

  it("maps state fixtures deterministically", async () => {
    expect(await stubSignIn({ email: "belum-verifikasi@example.com", password: VALID_PASSWORD })).toEqual({
      ok: false,
      code: "VERIFICATION_REQUIRED",
    });
    expect(await stubSignIn({ email: "ditangguhkan@example.com", password: VALID_PASSWORD })).toEqual({
      ok: false,
      code: "SUSPENDED",
    });
    expect(await stubSignIn({ email: "terbatas@example.com", password: "apa-pun" })).toEqual({
      ok: false,
      code: "RATE_LIMITED",
    });
    expect(await stubSignIn({ email: "gangguan@example.com", password: "apa-pun" })).toEqual({
      ok: false,
      code: "PROVIDER_UNAVAILABLE",
    });
    // Unknown account and wrong password are indistinguishable (R1).
    const unknown = await stubSignIn({ email: "tidak-ada@example.com", password: VALID_PASSWORD });
    const wrong = await stubSignIn({ email: "terdaftar@example.com", password: "salah" });
    expect(unknown).toEqual(wrong);
  });

  it("register always succeeds (duplicate indistinguishable, R4)", async () => {
    expect((await stubRegister({ email: "siapa@example.com", password: "x".repeat(8) })).ok).toBe(true);
    expect((await stubRegister({ email: "terdaftar@example.com", password: "x".repeat(8) })).ok).toBe(true);
  });

  it("resend/reset-request always succeed (R3)", async () => {
    expect((await stubResendVerification({ email: "tidak-ada@example.com" })).ok).toBe(true);
    expect((await stubRequestPasswordReset({ email: "tidak-ada@example.com" })).ok).toBe(true);
  });

  it("maps verification and reset tokens to all three landing states", async () => {
    expect(await stubVerifyEmail({ token: "verifikasi-valid-verifikasi-valid" })).toEqual({ ok: true });
    expect(await stubVerifyEmail({ token: "verifikasi-kedaluwarsa-x" })).toEqual({
      ok: false,
      code: "TOKEN_EXPIRED",
    });
    expect(await stubVerifyEmail({ token: "t".repeat(20) })).toEqual({
      ok: false,
      code: "TOKEN_INVALID",
    });
    expect(await stubResetPassword({ token: "reset-valid-reset-valid", password: "x".repeat(8) })).toEqual({
      ok: true,
    });
    expect(await stubResetPassword({ token: "reset-kedaluwarsa-xxxx", password: "x".repeat(8) })).toEqual({
      ok: false,
      code: "TOKEN_EXPIRED",
    });
    expect(await stubResetPassword({ token: "t".repeat(20), password: "x".repeat(8) })).toEqual({
      ok: false,
      code: "TOKEN_INVALID",
    });
  });
});

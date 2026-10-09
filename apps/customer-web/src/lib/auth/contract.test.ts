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

describe("contract schemas", () => {
  it("accepts well-formed sign-in input", () => {
    expect(
      signInInputSchema.parse({
        email: "user@example.com",
        password: "x".repeat(8),
      }),
    ).toBeTruthy();
  });

  it("rejects malformed emails", () => {
    expect(() =>
      emailOnlyInputSchema.parse({ email: "bukan-email" }),
    ).toThrow();
    expect(() => emailOnlyInputSchema.parse({ email: "" })).toThrow();
  });

  it("enforces the minimum password length on register and reset", () => {
    expect(() =>
      registerInputSchema.parse({ email: "a@example.com", password: "pendek" }),
    ).toThrow();
    expect(() =>
      resetPasswordInputSchema.parse({
        token: "t".repeat(16),
        password: "pendek",
      }),
    ).toThrow();
    expect(
      registerInputSchema.parse({
        email: "a@example.com",
        password: "x".repeat(MIN_PASSWORD_LENGTH),
      }),
    ).toBeTruthy();
  });

  it("requires 16+ character tokens", () => {
    expect(() =>
      signInInputSchema.parse({
        email: "a@example.com",
        password: "x".repeat(8),
      }),
    ).toBeTruthy();
    expect(() =>
      resetPasswordInputSchema.parse({
        token: "short",
        password: "x".repeat(8),
      }),
    ).toThrow();
  });

  it("normalizes emails (trim, collapse, lowercase) before callers parse", () => {
    expect(normalizeEmail("  Nama.Lastname@ Example.COM ")).toBe(
      "nama.lastname@example.com",
    );
  });

  it("exposes safe generic copy for every error code", () => {
    for (const code of AUTH_ERROR_CODES) {
      expect(typeof AUTH_ERROR_MESSAGES[code]).toBe("string");
    }
    // The anti-enumeration string must never name which field was wrong.
    expect(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS).toBe(
      "Email atau kata sandi tidak cocok.",
    );
    expect(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS).not.toMatch(
      /tidak ditemukan|belum terdaftar/i,
    );
  });

  it("password adequacy helper mirrors the policy", () => {
    expect(isAdequatePassword("abc12345")).toBe(true);
    expect(isAdequatePassword("abc1234")).toBe(false);
  });
});


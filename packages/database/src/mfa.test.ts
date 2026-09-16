import { describe, expect, it } from "vitest";
import {
  buildTotpUri,
  decodeBase32,
  encodeBase32,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  MFA_TOTP_CONFIG,
  normalizeRecoveryCode,
  openTotpSecret,
  sealTotpSecret,
  totpForStep,
  totpStepAt,
  verifyTotp,
} from "./mfa";

const AUTH_SECRET = "local-test-secret-that-is-long-enough-to-derive-a-key";

/**
 * RFC 6238 Appendix B test vector for SHA-1, truncated to 6 digits.
 * The reference secret is ASCII "12345678901234567890", which is 20 bytes —
 * exactly the size `generateTotpSecret` produces.
 */
const RFC_SECRET = encodeBase32(Buffer.from("12345678901234567890", "ascii"));

describe("base32", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = Buffer.from([0x00, 0xff, 0x10, 0x7f, 0xa5]);
    const encoded = encodeBase32(bytes);
    expect(decodeBase32(encoded)).toEqual(bytes);
  });

  it("encodes the RFC 6238 reference secret as GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("ignores padding and spacing when decoding", () => {
    expect(decodeBase32("GEZD GNBV")).toEqual(decodeBase32("GEZDGNBV"));
    expect(decodeBase32("GEZDGNBV====")).toEqual(decodeBase32("GEZDGNBV"));
  });

  it("refuses characters outside the alphabet", () => {
    expect(decodeBase32("0189")).toBeNull();
    expect(decodeBase32("")).toBeNull();
  });
});

describe("generateTotpSecret", () => {
  it("returns a base32 secret of the configured size", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(decodeBase32(secret)?.length).toBe(MFA_TOTP_CONFIG.secretBytes);
  });

  it("does not repeat between calls", () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe("totpForStep", () => {
  it("reproduces the RFC 6238 SHA-1 test vector at T=59", () => {
    // 59 seconds / 30 = step 1; the RFC value truncated to 6 digits is 287082.
    expect(totpForStep(RFC_SECRET, 1)).toBe("287082");
  });

  it("reproduces the RFC 6238 SHA-1 test vector at T=1111111109", () => {
    const step = Math.floor(1_111_111_109 / 30);
    expect(totpForStep(RFC_SECRET, step)).toBe("081804");
  });

  it("returns null for a secret that is not base32", () => {
    expect(totpForStep("not-base32!", 1)).toBeNull();
  });

  it("returns null for a negative or non-integer step", () => {
    expect(totpForStep(RFC_SECRET, -1)).toBeNull();
    expect(totpForStep(RFC_SECRET, 1.5)).toBeNull();
  });

  it("always produces the configured number of digits", () => {
    for (let step = 0; step < 25; step += 1) {
      expect(totpForStep(RFC_SECRET, step)).toMatch(/^\d{6}$/);
    }
  });
});

describe("totpStepAt", () => {
  it("advances one step every 30 seconds", () => {
    const base = new Date("2026-09-15T00:00:00.000Z");
    const later = new Date(base.getTime() + 30_000);
    expect(totpStepAt(later) - totpStepAt(base)).toBe(1);
  });

  it("stays on the same step within a window", () => {
    const base = new Date("2026-09-15T00:00:00.000Z");
    const inside = new Date(base.getTime() + 29_000);
    expect(totpStepAt(inside)).toBe(totpStepAt(base));
  });
});

describe("verifyTotp", () => {
  const at = new Date("2026-09-15T00:00:00.000Z");

  it("accepts the code for the current step", () => {
    const code = totpForStep(RFC_SECRET, totpStepAt(at));
    expect(code).not.toBeNull();
    expect(
      verifyTotp({ secret: RFC_SECRET, code: code ?? "", at, skewSteps: 1 }),
    ).toBe(totpStepAt(at));
  });

  it("returns the matched step so a replay of that step can be refused", () => {
    const previous = totpStepAt(at) - 1;
    const code = totpForStep(RFC_SECRET, previous);
    expect(
      verifyTotp({ secret: RFC_SECRET, code: code ?? "", at, skewSteps: 1 }),
    ).toBe(previous);
  });

  it("accepts a code one step ahead for clock drift", () => {
    const next = totpStepAt(at) + 1;
    const code = totpForStep(RFC_SECRET, next);
    expect(
      verifyTotp({ secret: RFC_SECRET, code: code ?? "", at, skewSteps: 1 }),
    ).toBe(next);
  });

  it("rejects a code outside the allowed skew", () => {
    const far = totpStepAt(at) + 5;
    const code = totpForStep(RFC_SECRET, far);
    expect(
      verifyTotp({ secret: RFC_SECRET, code: code ?? "", at, skewSteps: 1 }),
    ).toBeNull();
  });

  it("accepts nothing when the window is closed", () => {
    const code = totpForStep(RFC_SECRET, totpStepAt(at));
    expect(
      verifyTotp({ secret: RFC_SECRET, code: code ?? "", at, skewSteps: -1 }),
    ).toBeNull();
  });

  it("tolerates spaces a person may type into the field", () => {
    const code = totpForStep(RFC_SECRET, totpStepAt(at)) ?? "";
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(
      verifyTotp({ secret: RFC_SECRET, code: spaced, at, skewSteps: 1 }),
    ).toBe(totpStepAt(at));
  });

  it("rejects a wrong-length code without comparing", () => {
    expect(
      verifyTotp({ secret: RFC_SECRET, code: "12345", at, skewSteps: 1 }),
    ).toBeNull();
    expect(
      verifyTotp({ secret: RFC_SECRET, code: "1234567", at, skewSteps: 1 }),
    ).toBeNull();
  });

  it("rejects a non-numeric code", () => {
    expect(
      verifyTotp({ secret: RFC_SECRET, code: "abcdef", at, skewSteps: 1 }),
    ).toBeNull();
  });
});

describe("sealTotpSecret / openTotpSecret", () => {
  it("round-trips a secret", () => {
    const secret = generateTotpSecret();
    const sealed = sealTotpSecret(secret, AUTH_SECRET);
    expect(openTotpSecret(sealed, AUTH_SECRET)).toBe(secret);
  });

  it("does not contain the plaintext secret", () => {
    const secret = generateTotpSecret();
    const sealed = sealTotpSecret(secret, AUTH_SECRET);
    expect(sealed).not.toContain(secret);
    expect(sealed.startsWith("v1.")).toBe(true);
  });

  it("fits the VarChar(512) column", () => {
    expect(
      sealTotpSecret(generateTotpSecret(), AUTH_SECRET).length,
    ).toBeLessThan(512);
  });

  it("produces a different ciphertext each time the same secret is sealed", () => {
    const secret = generateTotpSecret();
    expect(sealTotpSecret(secret, AUTH_SECRET)).not.toBe(
      sealTotpSecret(secret, AUTH_SECRET),
    );
  });

  it("refuses to open with the wrong key", () => {
    const sealed = sealTotpSecret(generateTotpSecret(), AUTH_SECRET);
    expect(
      openTotpSecret(sealed, "a-completely-different-secret-value"),
    ).toBeNull();
  });

  it("detects a tampered ciphertext instead of returning a wrong secret", () => {
    const sealed = sealTotpSecret(generateTotpSecret(), AUTH_SECRET);
    const parts = sealed.split(".");
    const ciphertext = parts[2] ?? "";
    // Flip a character in the ciphertext; GCM authentication must catch it.
    const flipped = ciphertext.startsWith("A")
      ? `B${ciphertext.slice(1)}`
      : `A${ciphertext.slice(1)}`;
    const tampered = [parts[0], parts[1], flipped, parts[3]].join(".");
    expect(openTotpSecret(tampered, AUTH_SECRET)).toBeNull();
  });

  it("detects a tampered auth tag", () => {
    const sealed = sealTotpSecret(generateTotpSecret(), AUTH_SECRET);
    const parts = sealed.split(".");
    const tampered = [
      parts[0],
      parts[1],
      parts[2],
      "AAAAAAAAAAAAAAAAAAAAAA",
    ].join(".");
    expect(openTotpSecret(tampered, AUTH_SECRET)).toBeNull();
  });

  it("returns null for malformed or foreign values instead of throwing", () => {
    expect(openTotpSecret("", AUTH_SECRET)).toBeNull();
    expect(openTotpSecret("v1.only.two", AUTH_SECRET)).toBeNull();
    expect(openTotpSecret("v2.a.b.c", AUTH_SECRET)).toBeNull();
    expect(openTotpSecret("plain-text-secret", AUTH_SECRET)).toBeNull();
  });

  it("refuses to seal when AUTH_SECRET is missing", () => {
    expect(() => sealTotpSecret(generateTotpSecret(), "")).toThrow(
      "AUTH_SECRET is not configured",
    );
  });
});

describe("buildTotpUri", () => {
  it("builds a scannable otpauth URI with the configured parameters", () => {
    const uri = buildTotpUri({
      secret: RFC_SECRET,
      accountName: "rani@contoh.id",
      issuer: "Wedding System",
    });
    const parsed = new URL(uri);

    expect(parsed.protocol).toBe("otpauth:");
    expect(parsed.host).toBe("totp");
    expect(parsed.pathname).toBe("/Wedding%20System:rani@contoh.id");
    expect(parsed.searchParams.get("secret")).toBe(RFC_SECRET);
    expect(parsed.searchParams.get("issuer")).toBe("Wedding System");
    expect(parsed.searchParams.get("digits")).toBe("6");
    expect(parsed.searchParams.get("period")).toBe("30");
  });
});

describe("recovery codes", () => {
  it("generates the configured number of distinct codes", () => {
    const { codes, hashes } = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(hashes).toHaveLength(10);
  });

  it("returns a hash per code and never the code itself as the hash", () => {
    const { codes, hashes } = generateRecoveryCodes(3);
    codes.forEach((code, index) => {
      expect(hashes[index]).not.toBe(code);
      expect(hashes[index]).toBe(hashRecoveryCode(code));
    });
  });

  it("formats codes in readable groups", () => {
    const { codes } = generateRecoveryCodes(1);
    expect(codes[0]).toMatch(
      /^[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}$/,
    );
  });

  it("normalizes separators and case so a typed code still matches", () => {
    const { codes, hashes } = generateRecoveryCodes(1);
    const code = codes[0] ?? "";
    const typed = code.toLowerCase().replaceAll("-", " ");
    expect(hashRecoveryCode(typed)).toBe(hashes[0]);
  });

  it("distinguishes different codes", () => {
    expect(normalizeRecoveryCode("ABCDE-FGHIJ")).not.toBe(
      normalizeRecoveryCode("ABCDE-FGHIK"),
    );
  });
});

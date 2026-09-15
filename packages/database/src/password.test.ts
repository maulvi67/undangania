import { describe, expect, it } from "vitest";
import {
  hashPassword,
  isPasswordHash,
  PASSWORD_HASH_FORMAT,
  verifyPassword,
} from "./password";

describe("password hashing", () => {
  it("creates a versioned scrypt hash within the User column limit", async () => {
    const encodedHash = await hashPassword("correct horse battery staple");

    expect(encodedHash).toMatch(/^\$scrypt\$v=1\$N=16384,r=8,p=1\$/);
    expect(encodedHash).toHaveLength(94);
    expect(encodedHash.length).toBeLessThanOrEqual(255);
    expect(encodedHash).not.toContain("correct horse battery staple");
    expect(encodedHash).not.toBe(PASSWORD_HASH_FORMAT);
    expect(isPasswordHash(encodedHash)).toBe(true);
  });

  it("uses a new salt and verifies only the matching password", async () => {
    const firstHash = await hashPassword("sandi-rahasia");
    const secondHash = await hashPassword("sandi-rahasia");

    expect(firstHash).not.toBe(secondHash);
    await expect(verifyPassword("sandi-rahasia", firstHash)).resolves.toBe(
      true,
    );
    await expect(verifyPassword("sandi-salah", firstHash)).resolves.toBe(false);
  });

  it("rejects malformed, unsupported, and tampered hashes safely", async () => {
    const encodedHash = await hashPassword("sandi-rahasia");

    await expect(
      verifyPassword("sandi-rahasia", "not-a-password-hash"),
    ).resolves.toBe(false);
    await expect(
      verifyPassword("sandi-rahasia", encodedHash.replace("v=1", "v=2")),
    ).resolves.toBe(false);
    await expect(
      verifyPassword("sandi-rahasia", `${encodedHash}tampered`),
    ).resolves.toBe(false);
    expect(isPasswordHash(encodedHash.replace("v=1", "v=2"))).toBe(false);
  });
});

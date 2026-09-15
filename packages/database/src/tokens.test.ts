import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  hashSessionToken,
  verifySessionToken,
} from "./tokens";

describe("session token primitives", () => {
  it("generates a high-entropy token and stores only its digest", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(first.value).not.toBe(second.value);
    expect(first.value).toHaveLength(43);
    expect(first.hash).toHaveLength(64);
    expect(first.hash).toBe(hashSessionToken(first.value));
    expect(first.hash).not.toContain(first.value);
  });

  it("verifies only the exact token", () => {
    const generated = generateSessionToken();

    expect(verifySessionToken(generated.value, generated.hash)).toBe(true);
    expect(verifySessionToken(`${generated.value}x`, generated.hash)).toBe(
      false,
    );
    expect(
      verifySessionToken(generated.value, generated.hash.slice(0, -2)),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { GUESTBOOK_MAX_LENGTH, validateGuestbookMessage } from "./contract";
import { createGuestbookStubTransport } from "./stub-transport";

describe("guestbook contract", () => {
  it("accepts Indonesian text and normalizes line endings", () => {
    expect(
      validateGuestbookMessage("Semoga bahagia!\r\nSalam hangat."),
    ).toEqual({
      valid: true,
      value: "Semoga bahagia!\nSalam hangat.",
    });
  });

  it("keeps script-like input as plain text while rejecting unsafe controls", () => {
    expect(validateGuestbookMessage("<script>alert(1)</script>")).toEqual({
      valid: true,
      value: "<script>alert(1)</script>",
    });
    expect(validateGuestbookMessage("   ")).toMatchObject({ valid: false });
    expect(
      validateGuestbookMessage("x".repeat(GUESTBOOK_MAX_LENGTH + 1)),
    ).toMatchObject({ valid: false });
    expect(validateGuestbookMessage("A\u0000B")).toMatchObject({
      valid: false,
    });
  });

  it("returns moderation-pending success without exposing message content", async () => {
    const result = await createGuestbookStubTransport("success").submit({
      message: "Semoga menjadi keluarga yang bahagia.",
      idempotencyKey: "fixture-guestbook-key-001",
    });
    expect(result).toEqual({
      kind: "success",
      status: "PENDING",
      message: "Ucapan terkirim untuk ditinjau.",
    });
  });
});

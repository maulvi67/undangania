import { describe, expect, it } from "vitest";
import {
  GUESTBOOK_MAX_LENGTH,
  validateGuestbookMessage,
} from "../guestbook/contract";
import { normalizePax, validateRsvpUpdates } from "@wedding/database";

/**
 * The Server Actions themselves cannot be unit-tested here: they resolve a session
 * and reach the database, and the repository-level rules they delegate to are
 * already covered by `@wedding/database`'s own suites. What this pins down is the
 * validation contract the actions share with those rules, so a change to one that
 * silently diverges from the other fails here.
 */

describe("rsvp action input bounds", () => {
  it("accepts the payload sizes the form produces", () => {
    const events = new Set(["e-1", "e-2", "e-3"]);
    const result = validateRsvpUpdates(
      [
        {
          eventId: "e-1",
          response: "ATTENDING",
          pax: 2,
          expectedVersion: null,
        },
        { eventId: "e-2", response: "DECLINED", pax: 0, expectedVersion: 1 },
      ],
      4,
      events,
    );
    expect(result.ok).toBe(true);
  });

  it("normalizes a declined answer to zero pax", () => {
    // The dashboard sums `pax` for attendance, so a declined row carrying a stale
    // head-count would inflate the figures.
    expect(normalizePax("DECLINED", 3, 4)).toBe(0);
    expect(normalizePax("TENTATIVE", 3, 4)).toBe(0);
  });

  it("refuses a pax above the household allowance", () => {
    const result = validateRsvpUpdates(
      [
        {
          eventId: "e-1",
          response: "ATTENDING",
          pax: 5,
          expectedVersion: null,
        },
      ],
      4,
      new Set(["e-1"]),
    );
    expect(result).toEqual({ ok: false, reason: "PAX_OUT_OF_RANGE" });
  });
});

describe("guestbook action input bounds", () => {
  it("accepts a normal greeting and normalizes line endings", () => {
    expect(validateGuestbookMessage("Halo\r\nSelamat")).toEqual({
      valid: true,
      value: "Halo\nSelamat",
    });
  });

  it("refuses an empty greeting", () => {
    expect(validateGuestbookMessage("   ")).toEqual({
      valid: false,
      message: "Tulis ucapan Anda terlebih dahulu.",
    });
  });

  it("refuses a greeting longer than the stored limit", () => {
    const result = validateGuestbookMessage(
      "a".repeat(GUESTBOOK_MAX_LENGTH + 1),
    );
    expect(result.valid).toBe(false);
  });

  it("refuses control characters", () => {
    // Rejected rather than stripped: storing a rewritten greeting would publish
    // words the guest never wrote.
    expect(validateGuestbookMessage("halo\u0000dunia").valid).toBe(false);
  });
});

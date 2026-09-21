import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GUESTBOOK_MAX_LENGTH,
  validateGuestbookMessage,
} from "../guestbook/contract";
import { normalizePax, validateRsvpUpdates } from "@wedding/database";
import { submitGuestbookAction, submitRsvpAction } from "./guest-actions";

const guestAccessMock = vi.hoisted(() => ({
  resolveByToken:
    vi.fn<(token: string, invitationSlug: string) => Promise<null>>(),
}));

vi.mock("@wedding/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@wedding/database")>();
  return {
    ...actual,
    PrismaGuestAccessRepository: class {
      public resolveByToken(token: string, invitationSlug: string) {
        return guestAccessMock.resolveByToken(token, invitationSlug);
      }
    },
  };
});

/**
 * The action tests keep the database rule in its own repository suite and focus
 * here on the server-action boundary: the current invitation slug must be passed
 * alongside the bearer token before either guest write can proceed.
 */

beforeEach(() => {
  guestAccessMock.resolveByToken.mockReset().mockResolvedValue(null);
});

describe("guest action invitation binding", () => {
  it("passes the current invitation slug when resolving an RSVP token", async () => {
    const result = await submitRsvpAction({
      token: "token-from-a",
      invitationSlug: "invitation-b",
      idempotencyKey: "key-abcdefghijklmnop",
      updates: [
        {
          eventId: "event-b",
          response: "ATTENDING",
          pax: 1,
          expectedVersion: null,
        },
      ],
    });

    expect(result.kind).toBe("error");
    expect(guestAccessMock.resolveByToken).toHaveBeenCalledWith(
      "token-from-a",
      "invitation-b",
    );
  });

  it("passes the current invitation slug when resolving a guestbook token", async () => {
    const result = await submitGuestbookAction({
      token: "token-from-a",
      invitationSlug: "invitation-b",
      message: "Selamat menempuh hidup baru.",
      idempotencyKey: "key-abcdefghijklmnop",
    });

    expect(result.kind).toBe("error");
    expect(guestAccessMock.resolveByToken).toHaveBeenCalledWith(
      "token-from-a",
      "invitation-b",
    );
  });
});

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

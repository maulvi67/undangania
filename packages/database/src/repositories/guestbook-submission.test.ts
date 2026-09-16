import { describe, expect, it, vi } from "vitest";
import {
  applyGuestbookSubmission,
  guestbookMessageId,
  GUESTBOOK_MESSAGE_MAX_LENGTH,
  validateGuestbookSubmission,
  type GuestbookSubmissionClient,
  type GuestbookSubmitInput,
} from "./guestbook-submission";

const NOW = new Date("2026-09-16T10:00:00.000Z");
const HOUSEHOLD = {
  id: "hh-1",
  tenantId: "t-1",
  weddingId: "w-1",
  displayName: "Keluarga Rahman",
  status: "ACTIVE",
};

function client(
  overrides: Record<string, unknown> = {},
): GuestbookSubmissionClient {
  return {
    guestHousehold: {
      findFirst: vi.fn().mockResolvedValue(HOUSEHOLD),
      ...((overrides.guestHousehold as object) ?? {}),
    },
    guestbookMessage: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: "m-1",
        submittedAt: NOW,
      }),
      ...((overrides.guestbookMessage as object) ?? {}),
    },
    auditEvent: {
      create: vi.fn().mockResolvedValue({ id: "a-1" }),
      ...((overrides.auditEvent as object) ?? {}),
    },
  };
}

/**
 * The fake delegates are `vi.fn()`s, but their declared type is the port's own
 * signature. This reads recorded calls without weakening that type.
 */
function calls<T>(fn: unknown): readonly (readonly [T])[] {
  return (fn as { mock: { calls: readonly (readonly [T])[] } }).mock.calls;
}

const SUBMIT: GuestbookSubmitInput = {
  householdId: "hh-1",
  message: "Selamat menempuh hidup baru.",
  idempotencyKey: "key-abcdefghijklmnop",
  displayNameFallback: "Tamu undangan",
};

/** The function the transaction class calls with an already-open client. */
const submit = (c: GuestbookSubmissionClient, input: GuestbookSubmitInput) =>
  applyGuestbookSubmission(c, input, NOW, input.idempotencyKey);

describe("validateGuestbookSubmission", () => {
  it("accepts a normal message and normalizes line endings", () => {
    expect(validateGuestbookSubmission("Baris satu\r\nBaris dua")).toEqual({
      ok: true,
      value: "Baris satu\nBaris dua",
    });
  });

  it("rejects an empty or whitespace-only message", () => {
    expect(validateGuestbookSubmission("")).toEqual({
      ok: false,
      reason: "EMPTY_MESSAGE",
    });
    expect(validateGuestbookSubmission("   \n  ")).toEqual({
      ok: false,
      reason: "EMPTY_MESSAGE",
    });
  });

  it("rejects a message over the limit", () => {
    expect(
      validateGuestbookSubmission("a".repeat(GUESTBOOK_MESSAGE_MAX_LENGTH + 1)),
    ).toEqual({ ok: false, reason: "TOO_LONG" });
    expect(
      validateGuestbookSubmission("a".repeat(GUESTBOOK_MESSAGE_MAX_LENGTH)),
    ).toEqual({ ok: true, value: "a".repeat(GUESTBOOK_MESSAGE_MAX_LENGTH) });
  });

  it("refuses control characters rather than stripping them", () => {
    expect(validateGuestbookSubmission("halo\u0000dunia")).toEqual({
      ok: false,
      reason: "CONTROL_CHARACTERS",
    });
    // A newline is a line break, not a control character to reject.
    expect(validateGuestbookSubmission("halo\ndunia")).toEqual({
      ok: true,
      value: "halo\ndunia",
    });
  });
});

describe("guestbookMessageId", () => {
  it("is deterministic for the same household and key", () => {
    expect(guestbookMessageId("hh-1", "key-1")).toBe(
      guestbookMessageId("hh-1", "key-1"),
    );
  });

  it("differs across households and keys", () => {
    expect(guestbookMessageId("hh-1", "key-1")).not.toBe(
      guestbookMessageId("hh-2", "key-1"),
    );
    expect(guestbookMessageId("hh-1", "key-1")).not.toBe(
      guestbookMessageId("hh-1", "key-2"),
    );
  });

  it("is shaped as a UUID without exposing the caller's key", () => {
    const id = guestbookMessageId("hh-1", "secret-key-value");
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(id).not.toContain("secret-key-value");
  });
});

describe("guestbook submission", () => {
  it("stores a pending message and appends an audit row", async () => {
    const c = client();
    const result = await submit(c, SUBMIT);

    expect(result).toEqual({
      kind: "success",
      messageId: "m-1",
      submittedAt: NOW,
    });

    expect(c.guestbookMessage.create).toHaveBeenCalledWith({
      data: {
        id: guestbookMessageId("hh-1", SUBMIT.idempotencyKey),
        tenantId: "t-1",
        weddingId: "w-1",
        householdId: "hh-1",
        displayName: "Keluarga Rahman",
        message: "Selamat menempuh hidup baru.",
        moderationStatus: "PENDING",
        submittedAt: NOW,
      },
      select: expect.anything(),
    });
    expect(c.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it("never publishes directly — every new message starts pending", async () => {
    const c = client();
    await submit(c, SUBMIT);

    const args = calls<{ data: { moderationStatus: string } }>(
      c.guestbookMessage.create,
    )[0]?.[0];
    expect(args?.data.moderationStatus).toBe("PENDING");
  });

  it("treats a replayed key as a no-op", async () => {
    const c = client({
      guestbookMessage: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "m-existing", submittedAt: NOW }),
      },
    });

    await expect(submit(c, SUBMIT)).resolves.toEqual({
      kind: "replayed",
      messageId: "m-existing",
      submittedAt: NOW,
    });
    expect(c.guestbookMessage.create).not.toHaveBeenCalled();
    expect(c.auditEvent.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid message before reading the household", async () => {
    const c = client();
    await expect(submit(c, { ...SUBMIT, message: "  " })).resolves.toEqual({
      kind: "invalid",
      reason: "EMPTY_MESSAGE",
    });
    expect(c.guestHousehold.findFirst).not.toHaveBeenCalled();
  });

  it("refuses a household whose link is no longer active", async () => {
    const c = client({
      guestHousehold: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ ...HOUSEHOLD, status: "DISABLED" }),
      },
    });

    await expect(submit(c, SUBMIT)).resolves.toEqual({ kind: "not-found" });
    expect(c.guestbookMessage.create).not.toHaveBeenCalled();
  });

  it("reports an unknown household as not found", async () => {
    const c = client({
      guestHousehold: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    await expect(submit(c, SUBMIT)).resolves.toEqual({ kind: "not-found" });
  });

  it("falls back to a generic name when the household has none", async () => {
    const c = client({
      guestHousehold: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ ...HOUSEHOLD, displayName: "  " }),
      },
    });

    await submit(c, SUBMIT);
    const args = calls<{ data: { displayName: string } }>(
      c.guestbookMessage.create,
    )[0]?.[0];
    expect(args?.data.displayName).toBe("Tamu undangan");
  });

  it("records length rather than content in the audit row", async () => {
    const c = client();
    await submit(c, SUBMIT);

    const args = calls<{ data: Record<string, unknown> }>(
      c.auditEvent.create,
    )[0]?.[0];
    expect(args?.data.action).toBe("GUESTBOOK_SUBMITTED");
    expect(args?.data.metadata).toEqual({
      messageLength: SUBMIT.message.length,
      moderationStatus: "PENDING",
    });
    // The greeting itself must not be copied into a long-retention audit row.
    expect(JSON.stringify(args?.data)).not.toContain("Selamat menempuh");
  });
});

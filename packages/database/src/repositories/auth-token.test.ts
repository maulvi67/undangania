import { describe, expect, it, vi } from "vitest";
import { hashToken } from "../tokens";
import {
  classifyAuthToken,
  isAuthTokenType,
  isWellFormedAuthToken,
  PrismaAuthTokenRepository,
  type AuthTokenTransactionClient,
} from "./auth-token";

const NOW = new Date("2026-09-15T03:00:00.000Z");
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

/**
 * A token long enough to satisfy the format guard. The repository hashes
 * whatever it is given, so the exact value only needs to be realistic.
 */
const TOKEN = "kR7mQ2xVb9Ln4Ts8YzA1cD6eF3gH5jK0pWqRtUvXyBm";

function createClient(overrides: {
  authToken?: Partial<AuthTokenTransactionClient["authToken"]>;
  user?: Partial<AuthTokenTransactionClient["user"]>;
}): AuthTokenTransactionClient {
  return {
    authToken: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      ...overrides.authToken,
    },
    user: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      ...overrides.user,
    },
  };
}

describe("isAuthTokenType", () => {
  it("accepts the two flows the contract defines", () => {
    expect(isAuthTokenType("EMAIL_VERIFICATION")).toBe(true);
    expect(isAuthTokenType("PASSWORD_RESET")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isAuthTokenType("MAGIC_LINK")).toBe(false);
    expect(isAuthTokenType("email_verification")).toBe(false);
  });
});

describe("isWellFormedAuthToken", () => {
  it("accepts a base64url token", () => {
    expect(isWellFormedAuthToken(TOKEN)).toBe(true);
  });

  it("rejects a value short enough to brute force", () => {
    expect(isWellFormedAuthToken("short")).toBe(false);
    expect(isWellFormedAuthToken("")).toBe(false);
  });

  it("rejects characters that cannot appear in an issued token", () => {
    expect(isWellFormedAuthToken("kR7mQ2xVb9Ln4Ts8YzA1cD6e 3gH5jK0p")).toBe(
      false,
    );
    expect(isWellFormedAuthToken("kR7mQ2xVb9Ln4Ts8YzA1cD6e%3gH5jK0p")).toBe(
      false,
    );
  });
});

describe("classifyAuthToken", () => {
  const future = new Date(NOW.getTime() + 1000);
  const past = new Date(NOW.getTime() - 1000);

  it("treats an unused, unexpired token as redeemable", () => {
    expect(classifyAuthToken({ expiresAt: future, usedAt: null }, NOW)).toBe(
      "redeemable",
    );
  });

  it("treats a token expiring exactly now as expired", () => {
    expect(classifyAuthToken({ expiresAt: NOW, usedAt: null }, NOW)).toBe(
      "expired",
    );
  });

  it("treats an unused but past token as expired", () => {
    expect(classifyAuthToken({ expiresAt: past, usedAt: null }, NOW)).toBe(
      "expired",
    );
  });

  it("reports a consumed token as already used even after it expired", () => {
    // Distinguishing "you already clicked this" from "this link is old" is what
    // lets support give a specific answer instead of a generic one.
    expect(classifyAuthToken({ expiresAt: past, usedAt: NOW }, NOW)).toBe(
      "already-used",
    );
    expect(classifyAuthToken({ expiresAt: future, usedAt: NOW }, NOW)).toBe(
      "already-used",
    );
  });
});

describe("PrismaAuthTokenRepository.issue", () => {
  it("retires outstanding tokens of the same type before issuing a new one", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const create = vi.fn().mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(NOW.getTime() + VERIFY_TTL_MS),
      usedAt: null,
    });
    const repository = new PrismaAuthTokenRepository(
      createClient({ authToken: { updateMany, create } }),
    );

    const issued = await repository.issue({
      userId: "user-1",
      type: "EMAIL_VERIFICATION",
      ttlMs: VERIFY_TTL_MS,
      now: NOW,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", type: "EMAIL_VERIFICATION", usedAt: null },
      data: { usedAt: NOW },
    });
    expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      create.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    expect(issued.expiresAt).toEqual(new Date(NOW.getTime() + VERIFY_TTL_MS));
  });

  it("persists only the hash of the token it hands back", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      type: "PASSWORD_RESET",
      expiresAt: new Date(NOW.getTime() + RESET_TTL_MS),
      usedAt: null,
    });
    const repository = new PrismaAuthTokenRepository(
      createClient({
        authToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create,
        },
      }),
    );

    const issued = await repository.issue({
      userId: "user-1",
      type: "PASSWORD_RESET",
      ttlMs: RESET_TTL_MS,
      now: NOW,
    });

    const stored = create.mock.calls[0]?.[0] as {
      data: { tokenHash: string };
    };
    expect(stored.data.tokenHash).toBe(hashToken(issued.token));
    expect(stored.data.tokenHash).not.toBe(issued.token);
    // A database read must never yield something a person could sign in with.
    expect(stored.data).not.toHaveProperty("token");
  });

  it("applies the caller's TTL rather than a baked-in one", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      type: "PASSWORD_RESET",
      expiresAt: NOW,
      usedAt: null,
    });
    const repository = new PrismaAuthTokenRepository(
      createClient({
        authToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create,
        },
      }),
    );

    // R5: the contract owns the TTLs, so a changed policy must not need a code
    // change here.
    await repository.issue({
      userId: "user-1",
      type: "PASSWORD_RESET",
      ttlMs: 90 * 60 * 1000,
      now: NOW,
    });

    const stored = create.mock.calls[0]?.[0] as {
      data: { expiresAt: Date };
    };
    expect(stored.data.expiresAt).toEqual(
      new Date(NOW.getTime() + 90 * 60 * 1000),
    );
  });

  it("refuses a non-positive TTL instead of issuing a dead token", async () => {
    const create = vi.fn();
    const repository = new PrismaAuthTokenRepository(
      createClient({ authToken: { create } }),
    );

    await expect(
      repository.issue({
        userId: "user-1",
        type: "EMAIL_VERIFICATION",
        ttlMs: 0,
        now: NOW,
      }),
    ).rejects.toThrow("Auth token TTL must be a positive duration");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("PrismaAuthTokenRepository.redeemEmailVerification", () => {
  it("marks the email verified only after the token is consumed", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findFirst = vi.fn().mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(NOW.getTime() + VERIFY_TTL_MS),
      usedAt: NOW,
    });
    const userUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new PrismaAuthTokenRepository(
      createClient({
        authToken: { updateMany, findFirst },
        user: { updateMany: userUpdateMany },
      }),
    );

    const result = await repository.redeemEmailVerification({
      token: TOKEN,
      now: NOW,
    });

    // Single-use is enforced in the `where` clause, not by reading first.
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashToken(TOKEN),
        type: "EMAIL_VERIFICATION",
        usedAt: null,
      },
      data: { usedAt: NOW },
    });
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: "user-1", emailVerifiedAt: null },
      data: { emailVerifiedAt: NOW },
    });
    expect(result).toEqual({ kind: "redeemed", userId: "user-1" });
  });

  it("does not verify the email when the token was already used", async () => {
    const userUpdateMany = vi.fn();
    const repository = new PrismaAuthTokenRepository(
      createClient({
        authToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn().mockResolvedValue({
            id: "token-1",
            userId: "user-1",
            type: "EMAIL_VERIFICATION",
            expiresAt: new Date(NOW.getTime() + VERIFY_TTL_MS),
            usedAt: new Date(NOW.getTime() - 60_000),
          }),
        },
        user: { updateMany: userUpdateMany },
      }),
    );

    await expect(
      repository.redeemEmailVerification({ token: TOKEN, now: NOW }),
    ).resolves.toEqual({ kind: "already-used" });
    expect(userUpdateMany).not.toHaveBeenCalled();
  });

  it("reports an expired token", async () => {
    const repository = new PrismaAuthTokenRepository(
      createClient({
        authToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn().mockResolvedValue({
            id: "token-1",
            userId: "user-1",
            type: "EMAIL_VERIFICATION",
            expiresAt: new Date(NOW.getTime() - 1000),
            usedAt: null,
          }),
        },
      }),
    );

    await expect(
      repository.redeemEmailVerification({ token: TOKEN, now: NOW }),
    ).resolves.toEqual({ kind: "expired" });
  });

  it("rejects a malformed token without touching the database", async () => {
    const updateMany = vi.fn();
    const findFirst = vi.fn();
    const repository = new PrismaAuthTokenRepository(
      createClient({ authToken: { updateMany, findFirst } }),
    );

    await expect(
      repository.redeemEmailVerification({ token: "short", now: NOW }),
    ).resolves.toEqual({ kind: "invalid" });
    expect(updateMany).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("reports an unknown token as invalid without confirming any account exists", async () => {
    const repository = new PrismaAuthTokenRepository(
      createClient({
        authToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      }),
    );

    await expect(
      repository.redeemEmailVerification({ token: TOKEN, now: NOW }),
    ).resolves.toEqual({ kind: "invalid" });
  });
});

describe("PrismaAuthTokenRepository.redeemPasswordReset", () => {
  it("consumes a reset token without touching the password", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const userUpdateMany = vi.fn();
    const repository = new PrismaAuthTokenRepository(
      createClient({
        authToken: {
          updateMany,
          findFirst: vi.fn().mockResolvedValue({
            id: "token-2",
            userId: "user-9",
            type: "PASSWORD_RESET",
            expiresAt: new Date(NOW.getTime() + RESET_TTL_MS),
            usedAt: NOW,
          }),
        },
        user: { updateMany: userUpdateMany },
      }),
    );

    const result = await repository.redeemPasswordReset({
      token: TOKEN,
      now: NOW,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashToken(TOKEN),
        type: "PASSWORD_RESET",
        usedAt: null,
      },
      data: { usedAt: NOW },
    });
    expect(result).toEqual({ kind: "redeemed", userId: "user-9" });
    // The caller applies the password only after the policy check passes, so a
    // weak password must not burn the token.
    expect(userUpdateMany).not.toHaveBeenCalled();
  });

  it("will not consume a verification token through the reset flow", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const repository = new PrismaAuthTokenRepository(
      createClient({
        authToken: {
          updateMany,
          // A live verification token exists, but it is the wrong type.
          findFirst: vi.fn().mockResolvedValue({
            id: "token-1",
            userId: "user-1",
            type: "EMAIL_VERIFICATION",
            expiresAt: new Date(NOW.getTime() + VERIFY_TTL_MS),
            usedAt: null,
          }),
        },
      }),
    );

    await expect(
      repository.redeemPasswordReset({ token: TOKEN, now: NOW }),
    ).resolves.toEqual({ kind: "invalid" });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashToken(TOKEN),
        type: "PASSWORD_RESET",
        usedAt: null,
      },
      data: { usedAt: NOW },
    });
  });

  it("reports an expired reset token", async () => {
    const repository = new PrismaAuthTokenRepository(
      createClient({
        authToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn().mockResolvedValue({
            id: "token-2",
            userId: "user-9",
            type: "PASSWORD_RESET",
            expiresAt: new Date(NOW.getTime() - 1),
            usedAt: null,
          }),
        },
      }),
    );

    await expect(
      repository.redeemPasswordReset({ token: TOKEN, now: NOW }),
    ).resolves.toEqual({ kind: "expired" });
  });
});

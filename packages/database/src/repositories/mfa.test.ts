import { describe, expect, it, vi } from "vitest";
import { totpForStep, totpStepAt } from "../mfa";
import {
  isReplayedStep,
  lastUsedStep,
  PrismaMfaRepository,
  type MfaTransactionClient,
} from "./mfa";

const AUTH_SECRET = "local-test-secret-that-is-long-enough-to-derive-a-key";
const USER_ID = "user-1";

/**
 * A fixed clock, deliberately placed 15 seconds *into* a time step rather than
 * on a boundary. `isReplayedStep` compares whole steps, so a boundary timestamp
 * makes "5 seconds earlier" land in the previous step and gives the test a
 * different meaning than it appears to have.
 */
const STEP = 1_700_000_000;
const STEP_SECONDS = 30;
const AT = new Date((STEP * STEP_SECONDS + 15) * 1000);

function createClient(overrides: {
  mfaCredential?: Partial<MfaTransactionClient["mfaCredential"]>;
  mfaRecoveryCode?: Partial<MfaTransactionClient["mfaRecoveryCode"]>;
  user?: Partial<MfaTransactionClient["user"]>;
}): MfaTransactionClient {
  return {
    mfaCredential: {
      findFirst: vi.fn(),
      findFirstWithSecret: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      ...overrides.mfaCredential,
    },
    mfaRecoveryCode: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      ...overrides.mfaRecoveryCode,
    },
    user: { updateMany: vi.fn(), ...overrides.user },
  };
}

const credentialRow = {
  id: "credential-1",
  userId: USER_ID,
  type: "TOTP",
  confirmedAt: AT,
  lastUsedAt: null,
  revokedAt: null,
};

describe("lastUsedStep / isReplayedStep", () => {
  it("reports no previous step for a credential that has never been used", () => {
    expect(lastUsedStep(null)).toBeNull();
    expect(isReplayedStep(STEP, null)).toBe(false);
  });

  it("treats the same step as a replay", () => {
    // The whole point of comparing steps: any later submission inside a step
    // that already succeeded is a replay, no matter how many seconds elapsed.
    const occurredAt = new Date(AT.getTime() - 5_000);
    expect(totpStepAt(occurredAt)).toBe(STEP);
    expect(isReplayedStep(STEP, occurredAt)).toBe(true);
  });

  it("treats an earlier step as a replay", () => {
    const occurredAt = new Date(AT.getTime() + 60_000);
    expect(isReplayedStep(STEP, occurredAt)).toBe(true);
  });

  it("allows a later step", () => {
    const occurredAt = new Date(AT.getTime() - 60_000);
    expect(isReplayedStep(STEP, occurredAt)).toBe(false);
  });

  it("treats a code used on the boundary of its own step as the same step", () => {
    // Step boundaries are where an off-by-one would hide: a code consumed at
    // the very start of step N still covers all of step N.
    const stepStart = new Date(STEP * STEP_SECONDS * 1000);
    expect(isReplayedStep(STEP, stepStart)).toBe(true);
  });
});

describe("PrismaMfaRepository.status", () => {
  it("reports enabled when a confirmed credential exists", async () => {
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: { findFirst: vi.fn().mockResolvedValue(credentialRow) },
        mfaRecoveryCode: {
          findMany: vi.fn().mockResolvedValue([{ id: "r1", usedAt: null }]),
        },
      }),
    );

    await expect(repository.status(USER_ID)).resolves.toEqual({
      enabled: true,
      enrolmentPending: false,
      remainingRecoveryCodes: 1,
    });
  });

  it("reports a pending enrolment that has not been confirmed", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...credentialRow, confirmedAt: null });
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: { findFirst },
        mfaRecoveryCode: { findMany: vi.fn().mockResolvedValue([]) },
      }),
    );

    const status = await repository.status(USER_ID);

    expect(status.enabled).toBe(false);
    expect(status.enrolmentPending).toBe(true);
    // A pending credential exists but has never been confirmed, so it must not
    // be treated as a live second factor.
    expect(findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ confirmedAt: null, revokedAt: null }),
      }),
    );
  });

  it("scopes every credential read to the user", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: { findFirst },
        mfaRecoveryCode: { findMany: vi.fn().mockResolvedValue([]) },
      }),
    );

    await repository.status(USER_ID);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID }),
      }),
    );
  });
});

describe("PrismaMfaRepository.beginEnrolment", () => {
  it("returns a scannable secret without persisting it in plaintext", async () => {
    const create = vi.fn().mockResolvedValue(credentialRow);
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create,
        },
      }),
    );

    const enrolment = await repository.beginEnrolment({
      userId: USER_ID,
      accountName: "rani@contoh.id",
      issuer: "Undangania",
    });

    expect(enrolment.secret).toMatch(/^[A-Z2-7]+$/);
    expect(enrolment.uri).toContain("otpauth://totp/");
    expect(enrolment.uri).toContain(`secret=${enrolment.secret}`);

    const stored = create.mock.calls[0]?.[0] as {
      data: { secretEncrypted: string; userId: string };
    };
    expect(stored.data.userId).toBe(USER_ID);
    // A database dump alone must not let anyone mint a valid second factor.
    expect(stored.data.secretEncrypted).not.toContain(enrolment.secret);
    expect(stored.data.secretEncrypted.startsWith("v1.")).toBe(true);
  });

  it("retires an abandoned enrolment so an old QR code cannot be confirmed", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue(credentialRow);
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: { updateMany, create },
      }),
    );

    await repository.beginEnrolment({
      userId: USER_ID,
      accountName: "rani@contoh.id",
      issuer: "Undangania",
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        type: "TOTP",
        confirmedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      create.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
  });
});

describe("PrismaMfaRepository.confirmEnrolment", () => {
  async function sealedFixture() {
    const created = vi.fn().mockResolvedValue(credentialRow);
    const seeder = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: created,
        },
      }),
    );
    const enrolment = await seeder.beginEnrolment({
      userId: USER_ID,
      accountName: "rani@contoh.id",
      issuer: "Undangania",
    });
    const stored = created.mock.calls[0]?.[0] as {
      data: { secretEncrypted: string };
    };
    return { secret: enrolment.secret, sealed: stored.data.secretEncrypted };
  }

  it("confirms a pending enrolment with a valid code and issues recovery codes", async () => {
    const { secret, sealed } = await sealedFixture();
    const code = totpForStep(secret, STEP) ?? "";

    const credentialUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const userUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const createMany = vi.fn().mockResolvedValue({ count: 10 });
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ ...credentialRow, confirmedAt: null }),
          findFirstWithSecret: vi.fn().mockResolvedValue({
            ...credentialRow,
            confirmedAt: null,
            secretEncrypted: sealed,
          }),
          updateMany: credentialUpdateMany,
        },
        mfaRecoveryCode: { createMany },
        user: { updateMany: userUpdateMany },
      }),
    );

    const result = await repository.confirmEnrolment({
      userId: USER_ID,
      code,
      at: AT,
    });

    expect(result.kind).toBe("confirmed");
    expect(result.kind === "confirmed" && result.recoveryCodes).toHaveLength(
      10,
    );
    // `mfaEnabled` only flips after a working code has been presented.
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { mfaEnabled: true },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          userId: USER_ID,
          codeHash: expect.any(String),
        }),
      ]),
    });
  });

  it("never persists a recovery code in plaintext", async () => {
    const { secret, sealed } = await sealedFixture();
    const code = totpForStep(secret, STEP) ?? "";
    const createMany = vi.fn().mockResolvedValue({ count: 10 });
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ ...credentialRow, confirmedAt: null }),
          findFirstWithSecret: vi.fn().mockResolvedValue({
            ...credentialRow,
            confirmedAt: null,
            secretEncrypted: sealed,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        mfaRecoveryCode: { createMany },
        user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      }),
    );

    const result = await repository.confirmEnrolment({
      userId: USER_ID,
      code,
      at: AT,
    });
    const issued = result.kind === "confirmed" ? result.recoveryCodes : [];

    const stored = createMany.mock.calls[0]?.[0] as {
      data: { codeHash: string }[];
    };
    const storedHashes = stored.data.map((row) => row.codeHash);
    for (const plaintext of issued) {
      expect(storedHashes).not.toContain(plaintext);
    }
  });

  it("refuses a wrong code and leaves mfaEnabled alone", async () => {
    const { sealed } = await sealedFixture();
    const userUpdateMany = vi.fn();
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ ...credentialRow, confirmedAt: null }),
          findFirstWithSecret: vi.fn().mockResolvedValue({
            ...credentialRow,
            confirmedAt: null,
            secretEncrypted: sealed,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        user: { updateMany: userUpdateMany },
      }),
    );

    await expect(
      repository.confirmEnrolment({ userId: USER_ID, code: "000000", at: AT }),
    ).resolves.toEqual({ kind: "invalid-code" });
    expect(userUpdateMany).not.toHaveBeenCalled();
  });

  it("reports no-enrolment when there is no pending credential", async () => {
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );

    await expect(
      repository.confirmEnrolment({ userId: USER_ID, code: "123456", at: AT }),
    ).resolves.toEqual({ kind: "no-enrolment" });
  });

  it("fails closed when the sealed secret cannot be opened", async () => {
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ ...credentialRow, confirmedAt: null }),
          findFirstWithSecret: vi.fn().mockResolvedValue({
            ...credentialRow,
            confirmedAt: null,
            // Sealed under a different key: GCM authentication must fail.
            secretEncrypted: "v1.AAAAAAAAAAAAAAAA.Zm9v.Zm9v",
          }),
        },
      }),
    );

    await expect(
      repository.confirmEnrolment({ userId: USER_ID, code: "123456", at: AT }),
    ).resolves.toEqual({ kind: "no-enrolment" });
  });

  it("does not flip mfaEnabled when a concurrent confirm already won", async () => {
    const { secret, sealed } = await sealedFixture();
    const code = totpForStep(secret, STEP) ?? "";
    const userUpdateMany = vi.fn();
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ ...credentialRow, confirmedAt: null }),
          findFirstWithSecret: vi.fn().mockResolvedValue({
            ...credentialRow,
            confirmedAt: null,
            secretEncrypted: sealed,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        user: { updateMany: userUpdateMany },
      }),
    );

    await expect(
      repository.confirmEnrolment({ userId: USER_ID, code, at: AT }),
    ).resolves.toEqual({ kind: "invalid-code" });
    expect(userUpdateMany).not.toHaveBeenCalled();
  });
});

describe("PrismaMfaRepository.verify", () => {
  async function verifyClient(options: {
    lastUsedAt?: Date | null;
    consumedCount?: number;
    confirmedAt?: Date | null;
  }) {
    const created = vi.fn().mockResolvedValue(credentialRow);
    const seeder = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: created,
        },
      }),
    );
    const enrolment = await seeder.beginEnrolment({
      userId: USER_ID,
      accountName: "rani@contoh.id",
      issuer: "Undangania",
    });
    const stored = created.mock.calls[0]?.[0] as {
      data: { secretEncrypted: string };
    };

    const updateMany = vi
      .fn()
      .mockResolvedValue({ count: options.consumedCount ?? 1 });
    return {
      secret: enrolment.secret,
      updateMany,
      repository: new PrismaMfaRepository(
        AUTH_SECRET,
        createClient({
          mfaCredential: {
            findFirstWithSecret: vi.fn().mockResolvedValue({
              ...credentialRow,
              confirmedAt:
                options.confirmedAt === undefined ? AT : options.confirmedAt,
              lastUsedAt: options.lastUsedAt ?? null,
              secretEncrypted: stored.data.secretEncrypted,
            }),
            updateMany,
          },
        }),
      ),
    };
  }

  it("verifies a valid code and records the step", async () => {
    const { secret, repository, updateMany } = await verifyClient({});
    const code = totpForStep(secret, STEP) ?? "";

    await expect(
      repository.verify({ userId: USER_ID, code, at: AT }),
    ).resolves.toEqual({ kind: "verified" });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "credential-1", revokedAt: null, lastUsedAt: null },
      data: { lastUsedAt: AT },
    });
  });

  it("refuses to accept the same step twice", async () => {
    const { secret, repository, updateMany } = await verifyClient({
      // A code consumed 2 seconds ago is inside the same 30-second step.
      lastUsedAt: new Date(AT.getTime() - 2_000),
    });
    const code = totpForStep(secret, STEP) ?? "";

    await expect(
      repository.verify({ userId: USER_ID, code, at: AT }),
    ).resolves.toEqual({ kind: "replayed" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("accepts a code from a step that has not been used yet", async () => {
    const { secret, repository } = await verifyClient({
      lastUsedAt: new Date(AT.getTime() - 60_000),
    });
    const code = totpForStep(secret, STEP) ?? "";

    await expect(
      repository.verify({ userId: USER_ID, code, at: AT }),
    ).resolves.toEqual({ kind: "verified" });
  });

  it("reports a replay when another request consumed the code first", async () => {
    const { secret, repository } = await verifyClient({ consumedCount: 0 });
    const code = totpForStep(secret, STEP) ?? "";

    // The compare-and-swap matched nothing, so a concurrent request already won.
    await expect(
      repository.verify({ userId: USER_ID, code, at: AT }),
    ).resolves.toEqual({ kind: "replayed" });
  });

  it("rejects a wrong code", async () => {
    const { repository, updateMany } = await verifyClient({});

    await expect(
      repository.verify({ userId: USER_ID, code: "000000", at: AT }),
    ).resolves.toEqual({ kind: "invalid-code" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("reports not-enrolled for an unconfirmed credential", async () => {
    const { secret, repository } = await verifyClient({ confirmedAt: null });
    const code = totpForStep(secret, STEP) ?? "";

    // An enrolment in progress must never satisfy a step-up challenge.
    await expect(
      repository.verify({ userId: USER_ID, code, at: AT }),
    ).resolves.toEqual({ kind: "not-enrolled" });
  });

  it("reports not-enrolled when the user has no credential", async () => {
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: { findFirstWithSecret: vi.fn().mockResolvedValue(null) },
      }),
    );

    await expect(
      repository.verify({ userId: USER_ID, code: "123456", at: AT }),
    ).resolves.toEqual({ kind: "not-enrolled" });
  });
});

describe("PrismaMfaRepository.redeemRecoveryCode", () => {
  it("consumes a recovery code and reports how many remain", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaRecoveryCode: {
          updateMany,
          findMany: vi.fn().mockResolvedValue([{ id: "r2", usedAt: null }]),
        },
      }),
    );

    const result = await repository.redeemRecoveryCode({
      userId: USER_ID,
      code: "ABCDE-FGHIJ-KLMNO-PQRST",
      at: AT,
    });

    expect(result).toEqual({ kind: "redeemed", remainingCodes: 1 });
    // Redemption is a compare-and-swap on `usedAt`, so two concurrent
    // submissions of the same code cannot both succeed.
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        codeHash: expect.any(String),
        usedAt: null,
      },
      data: { usedAt: AT },
    });
  });

  it("looks the code up by hash, never by plaintext", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaRecoveryCode: { updateMany },
      }),
    );

    await repository.redeemRecoveryCode({
      userId: USER_ID,
      code: "ABCDE-FGHIJ-KLMNO-PQRST",
      at: AT,
    });

    const call = updateMany.mock.calls[0]?.[0] as {
      where: { codeHash: string };
    };
    expect(call.where.codeHash).not.toBe("ABCDE-FGHIJ-KLMNO-PQRST");
    expect(call.where.codeHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects an unknown or already-used code", async () => {
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaRecoveryCode: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }),
    );

    await expect(
      repository.redeemRecoveryCode({
        userId: USER_ID,
        code: "WRONG-WRONG-WRONG-WRONG",
        at: AT,
      }),
    ).resolves.toEqual({ kind: "invalid-code" });
  });
});

describe("PrismaMfaRepository.revoke", () => {
  it("revokes the credential and clears the fast-read flag", async () => {
    const userUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        user: { updateMany: userUpdateMany },
      }),
    );

    await expect(repository.revoke(USER_ID)).resolves.toBe(true);
    // Leaving `mfaEnabled` set would lock the user out behind a factor they can
    // no longer produce.
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { mfaEnabled: false },
    });
  });

  it("reports false when there was nothing to revoke", async () => {
    const repository = new PrismaMfaRepository(
      AUTH_SECRET,
      createClient({
        mfaCredential: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        user: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      }),
    );

    await expect(repository.revoke(USER_ID)).resolves.toBe(false);
  });
});

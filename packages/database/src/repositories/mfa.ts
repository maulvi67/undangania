import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";
import {
  buildTotpUri,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  openTotpSecret,
  sealTotpSecret,
  totpStepAt,
  verifyTotp,
} from "../mfa";

/**
 * MFA enrolment and step-up verification.
 *
 * `User.mfaEnabled` is the fast boolean that request authorization reads, but it
 * is only ever set true after a credential has been confirmed with a working
 * code. A pending enrolment therefore cannot lock anyone out of their own
 * account, and cannot be treated as a live second factor.
 *
 * Three guarantees this layer is responsible for:
 *
 *   1. The TOTP secret never leaves sealed. It is returned to the caller exactly
 *      once, at enrolment, so it can be shown as a QR code; every later read
 *      opens it only in memory to verify a code.
 *   2. A confirmed code cannot be replayed within its time step. The matched step
 *      is compared against `lastUsedAt`, so the same 30-second window cannot be
 *      reused — a stolen code is useful only until the next step.
 *   3. Recovery codes are single-use and stored hashed. Redemption is a
 *      compare-and-swap on `usedAt`, so two concurrent submissions cannot both
 *      succeed.
 *
 * The clock is always supplied by the caller; nothing here reads the wall clock.
 */

const MFA_TYPE_TOTP = "TOTP";

/**
 * One step either side of now. That is the customary allowance for clock drift
 * between a phone and the server; a wider window makes replay practical.
 */
const ALLOWED_SKEW_STEPS = 1;

const mfaCredentialSelect = {
  id: true,
  userId: true,
  type: true,
  confirmedAt: true,
  lastUsedAt: true,
  revokedAt: true,
} as const satisfies Prisma.MfaCredentialSelect;

type MfaCredentialRow = Prisma.MfaCredentialGetPayload<{
  select: typeof mfaCredentialSelect;
}>;

/**
 * The sealed secret is read only where it is actually needed, so the default
 * select cannot leak it into a DTO by accident.
 */
const mfaCredentialSecretSelect = {
  ...mfaCredentialSelect,
  secretEncrypted: true,
} as const satisfies Prisma.MfaCredentialSelect;

type MfaCredentialSecretRow = Prisma.MfaCredentialGetPayload<{
  select: typeof mfaCredentialSecretSelect;
}>;

const mfaRecoveryCodeSelect = {
  id: true,
  usedAt: true,
} as const satisfies Prisma.MfaRecoveryCodeSelect;

type MfaRecoveryCodeRow = Prisma.MfaRecoveryCodeGetPayload<{
  select: typeof mfaRecoveryCodeSelect;
}>;

/**
 * Structural delegates, deliberately narrow so tests can inject plain objects.
 * The real client is adapted by `adaptMfaClient` rather than cast into place:
 * Prisma's delegates are generic over `SelectSubset`, so comparing them against
 * a concrete signature is not sound.
 */
type MfaCredentialClient = Readonly<{
  mfaCredential: {
    findFirst(args: {
      where: Prisma.MfaCredentialWhereInput;
      orderBy?: Prisma.MfaCredentialOrderByWithRelationInput;
      select: typeof mfaCredentialSelect;
    }): Promise<MfaCredentialRow | null>;
    findFirstWithSecret(args: {
      where: Prisma.MfaCredentialWhereInput;
      orderBy?: Prisma.MfaCredentialOrderByWithRelationInput;
      select: typeof mfaCredentialSecretSelect;
    }): Promise<MfaCredentialSecretRow | null>;
    create(args: {
      data: Prisma.MfaCredentialUncheckedCreateInput;
      select: typeof mfaCredentialSelect;
    }): Promise<MfaCredentialRow>;
    updateMany(args: {
      where: Prisma.MfaCredentialWhereInput;
      data: Prisma.MfaCredentialUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
}>;

type MfaRecoveryCodeClient = Readonly<{
  mfaRecoveryCode: {
    findFirst(args: {
      where: Prisma.MfaRecoveryCodeWhereInput;
      select: typeof mfaRecoveryCodeSelect;
    }): Promise<MfaRecoveryCodeRow | null>;
    findMany(args: {
      where: Prisma.MfaRecoveryCodeWhereInput;
      select: typeof mfaRecoveryCodeSelect;
    }): Promise<MfaRecoveryCodeRow[]>;
    createMany(args: {
      data: Prisma.MfaRecoveryCodeCreateManyInput[];
    }): Promise<{ count: number }>;
    updateMany(args: {
      where: Prisma.MfaRecoveryCodeWhereInput;
      data: Prisma.MfaRecoveryCodeUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
}>;

type MfaUserClient = Readonly<{
  user: {
    updateMany(args: {
      where: Prisma.UserWhereInput;
      data: Prisma.UserUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
}>;

export type MfaTransactionClient = MfaCredentialClient &
  MfaRecoveryCodeClient &
  MfaUserClient;

export function adaptMfaClient(
  client: Pick<PrismaClient, "mfaCredential" | "mfaRecoveryCode" | "user">,
): MfaTransactionClient {
  return {
    mfaCredential: {
      findFirst: (args) => client.mfaCredential.findFirst(args),
      findFirstWithSecret: (args) => client.mfaCredential.findFirst(args),
      create: (args) => client.mfaCredential.create(args),
      updateMany: (args) => client.mfaCredential.updateMany(args),
    },
    mfaRecoveryCode: {
      findFirst: (args) => client.mfaRecoveryCode.findFirst(args),
      findMany: (args) => client.mfaRecoveryCode.findMany(args),
      createMany: (args) => client.mfaRecoveryCode.createMany(args),
      updateMany: (args) => client.mfaRecoveryCode.updateMany(args),
    },
    user: {
      updateMany: (args) => client.user.updateMany(args),
    },
  };
}

export type MfaStatus = Readonly<{
  enabled: boolean;
  /** A credential exists but has not been confirmed with a working code. */
  enrolmentPending: boolean;
  remainingRecoveryCodes: number;
}>;

export type MfaEnrolmentStart = Readonly<{
  /** Shown once as a QR code or typed into an authenticator app. */
  secret: string;
  /** Scannable form of the same secret. */
  uri: string;
}>;

export type MfaEnrolmentConfirmResult =
  | Readonly<{ kind: "confirmed"; recoveryCodes: readonly string[] }>
  | Readonly<{ kind: "no-enrolment" }>
  | Readonly<{ kind: "invalid-code" }>;

export type MfaVerificationResult =
  | Readonly<{ kind: "verified" }>
  | Readonly<{ kind: "not-enrolled" }>
  | Readonly<{ kind: "revoked" }>
  | Readonly<{ kind: "invalid-code" }>
  | Readonly<{ kind: "replayed" }>;

export type MfaRecoveryResult =
  | Readonly<{ kind: "redeemed"; remainingCodes: number }>
  | Readonly<{ kind: "invalid-code" }>;

export interface MfaRepository {
  status(userId: string): Promise<MfaStatus>;
  beginEnrolment(input: {
    userId: string;
    accountName: string;
    issuer: string;
  }): Promise<MfaEnrolmentStart>;
  confirmEnrolment(input: {
    userId: string;
    code: string;
    at: Date;
  }): Promise<MfaEnrolmentConfirmResult>;
  verify(input: {
    userId: string;
    code: string;
    at: Date;
  }): Promise<MfaVerificationResult>;
  redeemRecoveryCode(input: {
    userId: string;
    code: string;
    at: Date;
  }): Promise<MfaRecoveryResult>;
  revoke(userId: string): Promise<boolean>;
}

export type MfaRepositories = Readonly<{ mfa: MfaRepository }>;

export type MfaTransactionPort = Readonly<{
  transaction<T>(
    work: (repositories: MfaRepositories) => Promise<T>,
  ): Promise<T>;
}>;

/**
 * The step recorded in `lastUsedAt`. Comparing the *step* rather than the exact
 * timestamp is what makes the replay guard correct: any submission inside the
 * step that already succeeded is a replay, no matter how many seconds later.
 */
export function lastUsedStep(lastUsedAt: Date | null): number | null {
  return lastUsedAt === null ? null : totpStepAt(lastUsedAt);
}

export function isReplayedStep(
  matchedStep: number,
  lastUsedAt: Date | null,
): boolean {
  const previous = lastUsedStep(lastUsedAt);
  return previous !== null && matchedStep <= previous;
}

export class PrismaMfaRepository implements MfaRepository {
  public constructor(
    private readonly authSecret: string,
    private readonly client: MfaTransactionClient = adaptMfaClient(prisma),
  ) {}

  private activeCredential(
    userId: string,
    confirmed: boolean,
  ): Promise<MfaCredentialRow | null> {
    return this.client.mfaCredential.findFirst({
      where: {
        userId,
        type: MFA_TYPE_TOTP,
        revokedAt: null,
        ...(confirmed ? { confirmedAt: { not: null } } : { confirmedAt: null }),
      },
      orderBy: { createdAt: "desc" },
      select: mfaCredentialSelect,
    });
  }

  public async status(userId: string): Promise<MfaStatus> {
    const confirmed = await this.activeCredential(userId, true);
    const pending =
      confirmed === null ? await this.activeCredential(userId, false) : null;
    const unused = await this.client.mfaRecoveryCode.findMany({
      where: { userId, usedAt: null },
      select: mfaRecoveryCodeSelect,
    });

    return {
      enabled: confirmed !== null,
      enrolmentPending: pending !== null,
      remainingRecoveryCodes: unused.length,
    };
  }

  public async beginEnrolment(input: {
    userId: string;
    accountName: string;
    issuer: string;
  }): Promise<MfaEnrolmentStart> {
    const secret = generateTotpSecret();

    // Only one pending enrolment can be live. Retiring older unconfirmed
    // credentials stops an abandoned QR code from being confirmed later.
    await this.client.mfaCredential.updateMany({
      where: {
        userId: input.userId,
        type: MFA_TYPE_TOTP,
        confirmedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await this.client.mfaCredential.create({
      data: {
        userId: input.userId,
        type: MFA_TYPE_TOTP,
        secretEncrypted: sealTotpSecret(secret, this.authSecret),
      },
      select: mfaCredentialSelect,
    });

    return {
      secret,
      uri: buildTotpUri({
        secret,
        accountName: input.accountName,
        issuer: input.issuer,
      }),
    };
  }

  public async confirmEnrolment(input: {
    userId: string;
    code: string;
    at: Date;
  }): Promise<MfaEnrolmentConfirmResult> {
    const pending = await this.activeCredential(input.userId, false);
    if (pending === null) return { kind: "no-enrolment" };

    const code = input.code;
    const credential = await this.client.mfaCredential.findFirstWithSecret({
      where: { id: pending.id, revokedAt: null },
      select: mfaCredentialSecretSelect,
    });
    if (credential === null) return { kind: "no-enrolment" };

    const secret = openTotpSecret(credential.secretEncrypted, this.authSecret);
    // A secret that cannot be opened means the row is corrupt or was written
    // under a different key; refusing is the only safe outcome.
    if (secret === null) return { kind: "no-enrolment" };

    const matchedStep = verifyTotp({
      secret,
      code,
      at: input.at,
      skewSteps: ALLOWED_SKEW_STEPS,
    });
    if (matchedStep === null) return { kind: "invalid-code" };

    // Confirming is the only place `mfaEnabled` becomes true. The conditional
    // `confirmedAt: null` makes a concurrent double-confirm harmless.
    const confirmed = await this.client.mfaCredential.updateMany({
      where: { id: credential.id, confirmedAt: null, revokedAt: null },
      data: { confirmedAt: input.at, lastUsedAt: input.at },
    });
    if (confirmed.count !== 1) return { kind: "invalid-code" };

    await this.client.user.updateMany({
      where: { id: input.userId },
      data: { mfaEnabled: true },
    });

    const recovery = generateRecoveryCodes();
    await this.client.mfaRecoveryCode.createMany({
      data: recovery.hashes.map((codeHash) => ({
        userId: input.userId,
        codeHash,
      })),
    });

    return { kind: "confirmed", recoveryCodes: recovery.codes };
  }

  public async verify(input: {
    userId: string;
    code: string;
    at: Date;
  }): Promise<MfaVerificationResult> {
    const credential = await this.client.mfaCredential.findFirstWithSecret({
      where: { userId: input.userId, type: MFA_TYPE_TOTP, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: mfaCredentialSecretSelect,
    });
    if (credential === null) return { kind: "not-enrolled" };
    if (credential.revokedAt !== null) return { kind: "revoked" };
    if (credential.confirmedAt === null) return { kind: "not-enrolled" };

    const secret = openTotpSecret(credential.secretEncrypted, this.authSecret);
    if (secret === null) return { kind: "revoked" };

    const matchedStep = verifyTotp({
      secret,
      code: input.code,
      at: input.at,
      skewSteps: ALLOWED_SKEW_STEPS,
    });
    if (matchedStep === null) return { kind: "invalid-code" };

    // Replay guard: the same time step can only be consumed once.
    if (isReplayedStep(matchedStep, credential.lastUsedAt)) {
      return { kind: "replayed" };
    }

    // Compare-and-swap on the timestamp we read. If another request consumed a
    // code in the meantime, this update matches nothing and the submission is
    // reported as a replay rather than silently succeeding.
    const previous = credential.lastUsedAt;
    const consumed = await this.client.mfaCredential.updateMany({
      where: {
        id: credential.id,
        revokedAt: null,
        ...(previous === null
          ? { lastUsedAt: null }
          : { lastUsedAt: previous }),
      },
      data: { lastUsedAt: input.at },
    });
    if (consumed.count !== 1) return { kind: "replayed" };

    return { kind: "verified" };
  }

  public async redeemRecoveryCode(input: {
    userId: string;
    code: string;
    at: Date;
  }): Promise<MfaRecoveryResult> {
    // Recovery codes are stored hashed, so a database read yields nothing usable.
    const consumed = await this.client.mfaRecoveryCode.updateMany({
      where: {
        userId: input.userId,
        codeHash: hashRecoveryCode(input.code),
        usedAt: null,
      },
      data: { usedAt: input.at },
    });
    if (consumed.count !== 1) return { kind: "invalid-code" };

    const remaining = await this.client.mfaRecoveryCode.findMany({
      where: { userId: input.userId, usedAt: null },
      select: mfaRecoveryCodeSelect,
    });

    return { kind: "redeemed", remainingCodes: remaining.length };
  }

  public async revoke(userId: string): Promise<boolean> {
    const revoked = await this.client.mfaCredential.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // `mfaEnabled` is turned off unconditionally: if any credential was revoked,
    // no live second factor remains, so leaving the flag set would lock the user
    // out behind a factor they can no longer produce.
    await this.client.user.updateMany({
      where: { id: userId },
      data: { mfaEnabled: false },
    });

    return revoked.count > 0;
  }
}

function createRepositories(
  authSecret: string,
  client: MfaTransactionClient,
): MfaRepositories {
  return { mfa: new PrismaMfaRepository(authSecret, client) };
}

export class PrismaMfaTransaction implements MfaTransactionPort {
  public constructor(
    private readonly authSecret: string,
    private readonly client: Pick<PrismaClient, "$transaction"> = prisma,
  ) {}

  public async transaction<T>(
    work: (repositories: MfaRepositories) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(async (transactionClient) =>
      work(
        createRepositories(this.authSecret, adaptMfaClient(transactionClient)),
      ),
    );
  }
}

/**
 * Reads `AUTH_SECRET` from the environment. Returns `null` when it is absent so
 * callers can fail closed: without a key there is no way to seal a secret, and a
 * generated fallback key would silently invalidate every existing enrolment on
 * the next deploy.
 */
export function createMfaRepositoryFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PrismaMfaRepository | null {
  const authSecret = env.AUTH_SECRET;
  if (authSecret === undefined || authSecret.length === 0) return null;
  return new PrismaMfaRepository(authSecret);
}

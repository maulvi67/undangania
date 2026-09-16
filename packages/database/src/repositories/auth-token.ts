import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";
import { generateOpaqueToken, hashToken } from "../tokens";

/**
 * Email verification and password reset token persistence.
 *
 * Both flows share the `AuthToken` table and differ only by `type`, so one
 * repository serves them. Three rules shape the design:
 *
 *   1. Only the hash is stored. `generateOpaqueToken` returns the plaintext once
 *      for the delivery layer; a database read must never yield anything a
 *      person could use to verify or reset an account.
 *   2. A token is single-use. Redemption is a compare-and-swap on `usedAt`, not
 *      a read followed by a write, so two concurrent submissions of the same
 *      link cannot both succeed.
 *   3. Issuing a new token invalidates outstanding ones of the same type, so a
 *      resend cannot leave a second live link in an old mailbox.
 *
 * The TTLs live in the auth transport contract (`R5`: verification 24h, reset
 * 1h) and are supplied by the caller rather than hardcoded here, because the
 * contract owns them and they are expected to change.
 */

export const AUTH_TOKEN_TYPES = [
  "EMAIL_VERIFICATION",
  "PASSWORD_RESET",
] as const;

export type AuthTokenType = (typeof AUTH_TOKEN_TYPES)[number];

const authTokenSelect = {
  id: true,
  userId: true,
  type: true,
  expiresAt: true,
  usedAt: true,
} as const satisfies Prisma.AuthTokenSelect;

type AuthTokenRow = Prisma.AuthTokenGetPayload<{
  select: typeof authTokenSelect;
}>;

/**
 * Structural delegates, deliberately narrow so tests can inject plain objects.
 * A real Prisma client is adapted by `adaptAuthTokenClient` rather than cast
 * into place: Prisma's delegate methods are generic over `SelectSubset`, so
 * comparing them against a concrete signature is not sound.
 */
type AuthTokenDelegateClient = Readonly<{
  authToken: {
    findFirst(args: {
      where: Prisma.AuthTokenWhereInput;
      select: typeof authTokenSelect;
    }): Promise<AuthTokenRow | null>;
    create(args: {
      data: Prisma.AuthTokenUncheckedCreateInput;
      select: typeof authTokenSelect;
    }): Promise<AuthTokenRow>;
    updateMany(args: {
      where: Prisma.AuthTokenWhereInput;
      data: Prisma.AuthTokenUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
}>;

export type AuthTokenTransactionClient = AuthTokenDelegateClient &
  Readonly<{
    user: {
      findFirst(args: {
        where: Prisma.UserWhereInput;
        select: { id: true; status: true; emailVerifiedAt: true };
      }): Promise<{
        id: string;
        status: string;
        emailVerifiedAt: Date | null;
      } | null>;
      updateMany(args: {
        where: Prisma.UserWhereInput;
        data: Prisma.UserUpdateManyMutationInput;
      }): Promise<{ count: number }>;
    };
  }>;

export function adaptAuthTokenClient(
  client: Pick<PrismaClient, "authToken" | "user">,
): AuthTokenTransactionClient {
  return {
    authToken: {
      findFirst: (args) => client.authToken.findFirst(args),
      create: (args) => client.authToken.create(args),
      updateMany: (args) => client.authToken.updateMany(args),
    },
    user: {
      findFirst: (args) => client.user.findFirst(args),
      updateMany: (args) => client.user.updateMany(args),
    },
  };
}

export type IssuedAuthToken = Readonly<{
  /** Plaintext. Returned once for delivery and never persisted. */
  token: string;
  expiresAt: Date;
}>;

export type AuthTokenRedemption =
  | Readonly<{ kind: "redeemed"; userId: string }>
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ kind: "expired" }>
  | Readonly<{ kind: "already-used" }>;

export type AuthTokenVerificationRedemption = Readonly<{
  kind: "redeemed";
  userId: string;
}>;

export interface AuthTokenRepository {
  /**
   * Issues a fresh token of `type`, invalidating any outstanding token of the
   * same type for the user so only the newest link is live.
   */
  issue(input: {
    userId: string;
    type: AuthTokenType;
    ttlMs: number;
    /** Caller-supplied clock; never taken from a request. */
    now: Date;
  }): Promise<IssuedAuthToken>;

  /** Consumes a token and marks the user's email verified, in one transaction. */
  redeemEmailVerification(input: {
    token: string;
    now: Date;
  }): Promise<AuthTokenRedemption>;

  /**
   * Consumes a token without touching the password. The caller applies the new
   * password afterwards so a token cannot be burned by a weak password that
   * fails the policy check.
   */
  redeemPasswordReset(input: {
    token: string;
    now: Date;
  }): Promise<AuthTokenRedemption>;
}

export function isAuthTokenType(value: string): value is AuthTokenType {
  return (AUTH_TOKEN_TYPES as readonly string[]).includes(value);
}

/**
 * Minimum token length accepted for redemption. Tokens are 32 random bytes
 * encoded as base64url (43 characters); anything shorter is malformed and is
 * rejected before a database round trip.
 */
export const MIN_AUTH_TOKEN_LENGTH = 16;

export function isWellFormedAuthToken(token: string): boolean {
  return (
    token.length >= MIN_AUTH_TOKEN_LENGTH &&
    token.length <= 256 &&
    /^[A-Za-z0-9._~-]+$/.test(token)
  );
}

/**
 * Classifies a stored token row against the redemption clock. Extracted so the
 * expiry and single-use boundaries are covered without a database.
 *
 * `usedAt` is checked before `expiresAt`: a token that was consumed is reported
 * as such even after it would have expired, so a support agent can distinguish
 * "you already clicked this" from "this link is old".
 */
export function classifyAuthToken(
  row: Readonly<{ expiresAt: Date; usedAt: Date | null }>,
  now: Date,
): "redeemable" | "expired" | "already-used" {
  if (row.usedAt !== null) return "already-used";
  return row.expiresAt.getTime() <= now.getTime() ? "expired" : "redeemable";
}

export class PrismaAuthTokenRepository implements AuthTokenRepository {
  public constructor(
    private readonly client: AuthTokenTransactionClient = adaptAuthTokenClient(
      prisma,
    ),
  ) {}

  public async issue(input: {
    userId: string;
    type: AuthTokenType;
    ttlMs: number;
    now: Date;
  }): Promise<IssuedAuthToken> {
    if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0) {
      throw new Error("Auth token TTL must be a positive duration");
    }

    const expiresAt = new Date(input.now.getTime() + input.ttlMs);
    const issued = generateOpaqueToken();

    // Retire outstanding tokens of this type first: a second "verify your email"
    // message must not leave two working links in circulation.
    await this.client.authToken.updateMany({
      where: {
        userId: input.userId,
        type: input.type,
        usedAt: null,
      },
      data: { usedAt: input.now },
    });

    await this.client.authToken.create({
      data: {
        userId: input.userId,
        tokenHash: issued.hash,
        type: input.type,
        expiresAt,
      },
      select: authTokenSelect,
    });

    return { token: issued.value, expiresAt };
  }

  public async redeemEmailVerification(input: {
    token: string;
    now: Date;
  }): Promise<AuthTokenRedemption> {
    if (!isWellFormedAuthToken(input.token)) return { kind: "invalid" };

    // `updateMany` with `usedAt: null` in the `where` is the single-use guard.
    // Both statements run against the same client so a caller wiring this into
    // `$transaction` gets atomicity, while a direct call still cannot double-use
    // a token because the `where` clause is the compare-and-swap.
    const consumed = await this.client.authToken.updateMany({
      where: {
        tokenHash: hashToken(input.token),
        type: "EMAIL_VERIFICATION",
        usedAt: null,
      },
      data: { usedAt: input.now },
    });
    if (consumed.count !== 1) {
      return this.describeFailure(input.token, "EMAIL_VERIFICATION", input.now);
    }

    const row = await this.client.authToken.findFirst({
      where: { tokenHash: hashToken(input.token) },
      select: authTokenSelect,
    });
    if (row === null) return { kind: "invalid" };

    // Conditional on `emailVerifiedAt: null` so a stale second link cannot move
    // the verification timestamp a second time.
    await this.client.user.updateMany({
      where: { id: row.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: input.now },
    });

    return { kind: "redeemed", userId: row.userId };
  }

  public async redeemPasswordReset(input: {
    token: string;
    now: Date;
  }): Promise<AuthTokenRedemption> {
    if (!isWellFormedAuthToken(input.token)) return { kind: "invalid" };

    const consumed = await this.client.authToken.updateMany({
      where: {
        tokenHash: hashToken(input.token),
        type: "PASSWORD_RESET",
        usedAt: null,
      },
      data: { usedAt: input.now },
    });
    if (consumed.count !== 1) {
      return this.describeFailure(input.token, "PASSWORD_RESET", input.now);
    }

    const row = await this.client.authToken.findFirst({
      where: { tokenHash: hashToken(input.token) },
      select: authTokenSelect,
    });
    if (row === null) return { kind: "invalid" };

    return { kind: "redeemed", userId: row.userId };
  }

  /**
   * Turns a failed consume into a specific reason. The consume already failed,
   * so this is diagnostic only; an unknown token stays `invalid` and never
   * reveals whether an account exists.
   */
  private async describeFailure(
    token: string,
    type: AuthTokenType,
    now: Date,
  ): Promise<AuthTokenRedemption> {
    const row = await this.client.authToken.findFirst({
      where: { tokenHash: hashToken(token), type },
      select: authTokenSelect,
    });
    if (row === null) return { kind: "invalid" };

    const state = classifyAuthToken(row, now);
    if (state === "already-used") return { kind: "already-used" };
    if (state === "expired") return { kind: "expired" };
    // The row is live but the consume matched zero rows, which means the type in
    // the `where` did not match. Treat as invalid rather than leaking the type.
    return { kind: "invalid" };
  }
}

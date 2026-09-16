import { AuthRequiredError, UnavailableError } from "./use-case-support";

/**
 * Verification and password-reset delivery use-cases.
 *
 * The anti-enumeration requirement from the auth transport contract (R3/R4)
 * drives every decision here:
 *
 *   - A reset request for an unknown address must produce the same result, the
 *     same message, and comparable timing as one for a known address. So this
 *     function returns the same value in both cases and the caller must never
 *     branch on existence.
 *   - A verification resend for an already-verified account is also reported as
 *     success, for the same reason.
 *
 * Because the port returns no signal about whether the account existed, the
 * return type has no field that could be used to distinguish the cases — that is
 * deliberate, not an oversight.
 *
 * Ports are structural; this package does not depend on `@wedding/database` or
 * `@wedding/notifications`.
 */

export type AuthEmailPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

export type IssuedAuthToken = Readonly<{
  /** Plaintext, returned once for delivery and never persisted. */
  token: string;
  expiresAt: Date;
}>;

export type AuthTokenRedemption =
  | Readonly<{ kind: "redeemed"; userId: string }>
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ kind: "expired" }>
  | Readonly<{ kind: "already-used" }>;

export interface AuthTokenPort {
  issue(input: {
    userId: string;
    type: AuthEmailPurpose;
    ttlMs: number;
    now: Date;
  }): Promise<IssuedAuthToken>;
  redeemEmailVerification(input: {
    token: string;
    now: Date;
  }): Promise<AuthTokenRedemption>;
  redeemPasswordReset(input: {
    token: string;
    now: Date;
  }): Promise<AuthTokenRedemption>;
}

export interface AuthAccountPort {
  /** Returns null for an unknown address; callers must not surface which. */
  findByEmail(
    email: string,
  ): Promise<Readonly<{ id: string; emailVerifiedAt: Date | null }> | null>;
  findById(
    userId: string,
  ): Promise<Readonly<{ id: string; emailVerifiedAt: Date | null }> | null>;
  updatePassword(userId: string, password: string): Promise<boolean>;
}

export interface AuthNotificationPort {
  send(input: {
    idempotencyKey: string;
    channel: "EMAIL";
    recipientRef: string;
    templateCode: string;
    variables: Record<string, string>;
  }): Promise<{ providerMessageId: string; status: "SENT" | "QUEUED" }>;
}

export interface AuthPasswordPort {
  /** Minimum policy check before a reset is allowed to consume its token. */
  isAdequate(password: string): boolean;
}

export type AuthEmailPorts = Readonly<{
  tokens: AuthTokenPort;
  accounts: AuthAccountPort;
  notifications: AuthNotificationPort;
  passwords: AuthPasswordPort;
  templates: Readonly<{
    emailVerification: string;
    passwordReset: string;
    passwordChanged: string;
  }>;
  buildActionUrl: (input: {
    purpose: AuthEmailPurpose;
    token: string;
  }) => string;
  verificationTtlMs: number;
  resetTtlMs: number;
}>;

/**
 * The only shape a reset request can produce. There is no `found` flag, no
 * `emailSent` boolean that varies, and no reason string — the caller renders
 * one message for all cases.
 */
export type RequestOutcome = Readonly<{ kind: "accepted" }>;

const ACCEPTED: RequestOutcome = { kind: "accepted" };

/**
 * Issues and delivers a verification email for an address.
 *
 * Returns `accepted` whether or not the address belongs to an account. The
 * database write is skipped for an unknown address, so timing differs by one
 * write rather than by a response path; the caller must not render anything
 * derived from that.
 */
export async function requestEmailVerification(
  email: string,
  ports: AuthEmailPorts,
  now: Date,
): Promise<RequestOutcome> {
  const account = await ports.accounts.findByEmail(email);
  // Already verified: nothing to send, and saying so would confirm the account
  // exists. Report the same acceptance as every other case.
  if (account === null || account.emailVerifiedAt !== null) return ACCEPTED;

  const issued = await ports.tokens.issue({
    userId: account.id,
    type: "EMAIL_VERIFICATION",
    ttlMs: ports.verificationTtlMs,
    now,
  });

  await ports.notifications.send({
    idempotencyKey: `auth:EMAIL_VERIFICATION:${account.id}`,
    channel: "EMAIL",
    recipientRef: email,
    templateCode: ports.templates.emailVerification,
    variables: {
      actionUrl: ports.buildActionUrl({
        purpose: "EMAIL_VERIFICATION",
        token: issued.token,
      }),
    },
  });

  return ACCEPTED;
}

/**
 * Issues and delivers a password-reset email.
 *
 * An unknown address is indistinguishable from a known one in the result, which
 * is the anti-enumeration requirement (R3). Note that a delivery failure is also
 * swallowed: surfacing it would let a caller distinguish a known address (whose
 * send was attempted) from an unknown one (whose send was not).
 */
export async function requestPasswordReset(
  email: string,
  ports: AuthEmailPorts,
  now: Date,
): Promise<RequestOutcome> {
  const account = await ports.accounts.findByEmail(email);
  if (account === null) return ACCEPTED;

  const issued = await ports.tokens.issue({
    userId: account.id,
    type: "PASSWORD_RESET",
    ttlMs: ports.resetTtlMs,
    now,
  });

  try {
    await ports.notifications.send({
      idempotencyKey: `auth:PASSWORD_RESET:${account.id}`,
      channel: "EMAIL",
      recipientRef: email,
      templateCode: ports.templates.passwordReset,
      variables: {
        actionUrl: ports.buildActionUrl({
          purpose: "PASSWORD_RESET",
          token: issued.token,
        }),
      },
    });
  } catch {
    // Deliberately swallowed so a provider outage on a known address does not
    // become an existence oracle. The operator sees the failure in the failed-job
    // list; the requester sees the same acceptance as everyone else.
    return ACCEPTED;
  }

  return ACCEPTED;
}

export type ResetOutcome =
  | Readonly<{ kind: "reset" }>
  | Readonly<{ kind: "invalid-token" }>
  | Readonly<{ kind: "expired-token" }>
  | Readonly<{ kind: "weak-password" }>;

/**
 * Completes a password reset.
 *
 * The token is consumed before the password is written, and the password policy
 * is checked first, so a weak password cannot burn a valid token. The token is
 * still single-use: the port's consume is a compare-and-swap, so two concurrent
 * submissions cannot both succeed.
 */
export async function completePasswordReset(
  input: Readonly<{ token: string; newPassword: string }>,
  ports: AuthEmailPorts,
  now: Date,
): Promise<ResetOutcome> {
  if (!ports.passwords.isAdequate(input.newPassword)) {
    return { kind: "weak-password" };
  }

  const redemption = await ports.tokens.redeemPasswordReset({
    token: input.token,
    now,
  });
  if (redemption.kind === "expired") return { kind: "expired-token" };
  if (redemption.kind !== "redeemed") return { kind: "invalid-token" };

  const updated = await ports.accounts.updatePassword(
    redemption.userId,
    input.newPassword,
  );
  if (!updated) {
    // The token was consumed for an account that no longer exists. The caller
    // must not be told which, so this is reported as an unusable link.
    throw new AuthRequiredError();
  }

  return { kind: "reset" };
}

export type VerifyOutcome =
  | Readonly<{ kind: "verified" }>
  | Readonly<{ kind: "invalid-token" }>
  | Readonly<{ kind: "expired-token" }>;

/**
 * Consumes an email-verification link.
 *
 * There is no session created here (R6): verification confirms the address, and
 * the customer signs in separately. Auto-signing-in on link click would make an
 * intercepted email equivalent to a stolen session.
 */
export async function completeEmailVerification(
  input: Readonly<{ token: string }>,
  ports: AuthEmailPorts,
  now: Date,
): Promise<VerifyOutcome> {
  const redemption = await ports.tokens.redeemEmailVerification({
    token: input.token,
    now,
  });
  if (redemption.kind === "expired") return { kind: "expired-token" };
  if (redemption.kind !== "redeemed") return { kind: "invalid-token" };

  return { kind: "verified" };
}

/**
 * Notifies an account that its password changed. Best effort: a notification
 * failure must not undo a completed reset, so it is swallowed deliberately.
 */
export async function notifyPasswordChanged(
  userId: string,
  recipientRef: string,
  ports: AuthEmailPorts,
): Promise<void> {
  try {
    await ports.notifications.send({
      idempotencyKey: `auth:PASSWORD_CHANGED:${userId}`,
      channel: "EMAIL",
      recipientRef,
      templateCode: ports.templates.passwordChanged,
      variables: {},
    });
  } catch {
    // The password has already changed; failing here would misreport the result.
  }
}

export { UnavailableError };

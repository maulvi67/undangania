import {
  PrismaAuthTokenRepository,
  PrismaUserAuthRepository,
} from "@wedding/database";
import type {
  AuthAccountPort,
  AuthEmailPorts,
  AuthNotificationPort,
  AuthPasswordPort,
  AuthTokenPort,
} from "@wedding/application";
import {
  EMAIL_VERIFICATION_TTL_MS,
  NOTIFICATION_TEMPLATES,
  PASSWORD_RESET_TTL_MS,
  NotificationUnavailableError,
  buildAuthActionUrl,
  createNotificationPortFromEnv,
} from "@wedding/notifications";
import { isAdequatePassword } from "./contract";
import { resolveAuthAppUrl } from "./app-url";

/**
 * Composition root for the verification and password-reset use-cases.
 *
 * The use-cases in `@wedding/application` declare their dependencies as
 * structural ports and deliberately do not import `@wedding/database` or
 * `@wedding/notifications`. This module is the one place that binds those ports
 * to their real implementations, which keeps the dependency arrows pointing
 * inward and — more usefully — keeps the wiring visible in one file instead of
 * scattered across the route handlers that call it.
 */

/** Resolves the public base URL that action links are built from. */
function appUrl(): string {
  return resolveAuthAppUrl();
}

/**
 * Binds the auth-token repository. Tokens are stored hashed and redeemed by
 * compare-and-swap, so this adapter carries no secret handling of its own.
 */
function authTokenPort(): AuthTokenPort {
  const tokens = new PrismaAuthTokenRepository();
  return {
    issue: (input) => tokens.issue(input),
    redeemEmailVerification: (input) => tokens.redeemEmailVerification(input),
    redeemPasswordReset: (input) => tokens.redeemPasswordReset(input),
  };
}

/**
 * Binds the account lookups the use-cases need. `updatePassword` re-hashes inside
 * the repository, so the plaintext passes through this adapter untouched and is
 * never stored here.
 */
function authAccountPort(): AuthAccountPort {
  const users = new PrismaUserAuthRepository();
  return {
    findByEmail: async (email) => {
      const user = await users.findByEmail(email);
      if (user === null) return null;
      return { id: user.id, emailVerifiedAt: user.emailVerifiedAt };
    },
    findById: async (userId) => {
      const user = await users.findById(userId);
      if (user === null) return null;
      return { id: user.id, emailVerifiedAt: user.emailVerifiedAt };
    },
    updatePassword: (userId, password) =>
      users.updatePassword(userId, password),
  };
}

/**
 * The password policy lives in the app's auth contract because the same constant
 * drives the form hint. Re-checking server-side is what makes the hint advisory
 * rather than authoritative.
 */
const passwordPort: AuthPasswordPort = {
  isAdequate: (password) => isAdequatePassword(password),
};

/**
 * Delivery port that fails loudly when the relay is not configured.
 *
 * The port set is deliberately still returned in that case: completing a
 * verification or reset only touches the token repository, so a mail outage must
 * not break links that were already delivered. Only the request/resend paths
 * need delivery, and they translate this throw into `PROVIDER_UNAVAILABLE`.
 */
function notificationPort(): AuthNotificationPort {
  const provider = createNotificationPortFromEnv();
  if (provider === null) {
    const unconfigured: AuthNotificationPort = {
      send: () => {
        throw new NotificationUnavailableError(
          "PROVIDER_UNAVAILABLE",
          "Email delivery is not configured.",
        );
      },
    };
    return unconfigured;
  }
  return { send: (input) => provider.send(input) };
}

/**
 * Builds the full port set.
 *
 * The TTLs come from `@wedding/notifications` rather than being repeated here:
 * they are the values the email copy promises, so the message and the stored
 * expiry cannot drift apart.
 */
export function getAuthEmailPorts(): AuthEmailPorts {
  const base = appUrl();
  return {
    tokens: authTokenPort(),
    accounts: authAccountPort(),
    notifications: notificationPort(),
    passwords: passwordPort,
    templates: {
      emailVerification: NOTIFICATION_TEMPLATES.EMAIL_VERIFICATION,
      passwordReset: NOTIFICATION_TEMPLATES.PASSWORD_RESET,
      passwordChanged: NOTIFICATION_TEMPLATES.PASSWORD_CHANGED,
    },
    buildActionUrl: ({ purpose, token }) =>
      buildAuthActionUrl({
        appUrl: base,
        path: purpose === "EMAIL_VERIFICATION" ? "/verifikasi" : "/reset-sandi",
        token,
      }),
    verificationTtlMs: EMAIL_VERIFICATION_TTL_MS,
    resetTtlMs: PASSWORD_RESET_TTL_MS,
  };
}

/** True when email delivery has a configured provider. */
export function isEmailDeliveryConfigured(): boolean {
  return createNotificationPortFromEnv() !== null;
}

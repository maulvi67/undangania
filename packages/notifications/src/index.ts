export interface NotificationPort {
  send(input: {
    idempotencyKey: string;
    channel: "EMAIL" | "WHATSAPP";
    recipientRef: string;
    templateCode: string;
    variables: Record<string, string>;
  }): Promise<{ providerMessageId: string; status: "SENT" | "QUEUED" }>;
}

/**
 * Transactional notification templates owned by this package.
 *
 * `templateCode` is the contract with the provider: the provider holds the
 * rendered body, so these codes and their variable names must not be renamed
 * without a coordinated provider change. Each code is therefore a stable
 * identifier rather than a description.
 */
export const NOTIFICATION_TEMPLATES = {
  EMAIL_VERIFICATION: "auth.email-verification",
  PASSWORD_RESET: "auth.password-reset",
  PASSWORD_CHANGED: "auth.password-changed",
} as const;

export type NotificationTemplateCode =
  (typeof NOTIFICATION_TEMPLATES)[keyof typeof NOTIFICATION_TEMPLATES];

/**
 * Provider implementations are re-exported here so a caller needs one import.
 * `providers.ts` imports only the `NotificationPort` type, so this is a
 * type-only cycle that is erased at runtime.
 */
export {
  ConsoleNotificationPort,
  createNotificationPortFromEnv,
  HttpNotificationPort,
  maskRecipientRef,
  NotificationUnavailableError,
  parseNotificationResponse,
  summarizeNotification,
  type HttpNotificationPortOptions,
  type NotificationLogSink,
  type RedactedNotificationSummary,
} from "./providers";

/**
 * Builds the link that a verification or reset email sends the recipient to.
 *
 * The token is placed in the path rather than a query string so it does not end
 * up in referrer headers or analytics, and it is URL-encoded because issued
 * tokens are base64url but must not be assumed to stay that way.
 */
export function buildAuthActionUrl(input: {
  appUrl: string;
  path: "/verifikasi" | "/atur-ulang-sandi";
  token: string;
}): string {
  const base = input.appUrl.endsWith("/")
    ? input.appUrl.slice(0, -1)
    : input.appUrl;
  return `${base}${input.path}/${encodeURIComponent(input.token)}`;
}

/**
 * Auth-token TTLs per the transport contract (R5): verification 24h, reset 1h.
 * They live here — next to the delivery call that promises them — so the email
 * copy and the database expiry cannot drift apart.
 */
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/**
 * Idempotency keys for auth mail. Derived from the user and purpose rather than
 * randomised, so a retried request collapses onto the same provider message
 * instead of delivering a second email.
 *
 * The key contains no secret material — deliberately not the token itself —
 * because idempotency keys are stored and logged by providers.
 */
export function authNotificationIdempotencyKey(input: {
  purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "PASSWORD_CHANGED";
  userId: string;
}): string {
  return `auth:${input.purpose}:${input.userId}`;
}

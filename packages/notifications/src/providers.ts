import type { NotificationPort } from "./index";

/**
 * Notification provider implementations.
 *
 * `NotificationPort` deliberately has one method, so the difference between
 * providers is entirely in transport. Two are provided:
 *
 *   - `ConsoleNotificationPort` logs a redacted summary. It exists so local and
 *     CI runs exercise the same call path as production without sending mail,
 *     and it never prints message variables, which contain action links with
 *     live single-use tokens.
 *   - `HttpNotificationPort` POSTs to a self-hosted relay. The relay holds the
 *     rendered bodies, so this payload carries only the template code and the
 *     variables — no HTML is built here.
 *
 * Failure handling differs by caller intent: `send` throws
 * `NotificationUnavailableError` so the caller decides whether a failed
 * verification email is worth retrying or should surface as
 * `PROVIDER_UNAVAILABLE`. Silently succeeding would leave a customer waiting for
 * an email that was never sent.
 */

export class NotificationUnavailableError extends Error {
  public constructor(
    public readonly code:
      | "PROVIDER_UNAVAILABLE"
      | "PROVIDER_REJECTED"
      | "PROVIDER_INVALID_RESPONSE",
    message: string,
  ) {
    super(message);
    this.name = "NotificationUnavailableError";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Variables that must never be written to a log. Action links embed a
 * single-use token, so logging one would leak a credential into log storage.
 */
const REDACTED_VARIABLES = new Set([
  "actionUrl",
  "verificationUrl",
  "resetUrl",
  "token",
]);

export type RedactedNotificationSummary = Readonly<{
  channel: "EMAIL" | "WHATSAPP";
  templateCode: string;
  /** Recipient reference with the local part masked. */
  recipientRef: string;
  /** Variable names only — never their values. */
  variableNames: readonly string[];
}>;

/**
 * Redacts a recipient reference for logging. Keeps enough of the domain to make
 * a stuck delivery diagnosable while removing anything identifying the person.
 */
export function maskRecipientRef(recipientRef: string): string {
  const at = recipientRef.indexOf("@");
  if (at <= 0) {
    return recipientRef.length <= 2 ? "**" : `${recipientRef.slice(0, 1)}***`;
  }
  const local = recipientRef.slice(0, at);
  const domain = recipientRef.slice(at);
  const maskedLocal = local.length <= 1 ? "*" : `${local.slice(0, 1)}***`;
  return `${maskedLocal}${domain}`;
}

export function summarizeNotification(
  input: Parameters<NotificationPort["send"]>[0],
): RedactedNotificationSummary {
  return {
    channel: input.channel,
    templateCode: input.templateCode,
    recipientRef: maskRecipientRef(input.recipientRef),
    variableNames: Object.keys(input.variables).sort(),
  };
}

export type NotificationLogSink = Readonly<{
  info(message: string, context: RedactedNotificationSummary): void;
  error(message: string, context: RedactedNotificationSummary): void;
}>;

const defaultSink: NotificationLogSink = {
  info: (message, context) => {
    console.info(message, context);
  },
  error: (message, context) => {
    console.error(message, context);
  },
};

/**
 * Development and CI transport. Records that a message *would* have been sent so
 * a missing-email bug is visible locally, without depending on a provider.
 */
export class ConsoleNotificationPort implements NotificationPort {
  public constructor(
    private readonly sink: NotificationLogSink = defaultSink,
  ) {}

  public async send(
    input: Parameters<NotificationPort["send"]>[0],
  ): Promise<{ providerMessageId: string; status: "SENT" | "QUEUED" }> {
    const summary = summarizeNotification(input);
    this.sink.info("notification.queued", summary);

    // Deterministic id: the same idempotency key must not look like a new
    // message on a retry, which is exactly what the provider would report.
    return {
      providerMessageId: `console:${input.idempotencyKey}`,
      status: "QUEUED",
    };
  }
}

export type HttpNotificationPortOptions = Readonly<{
  /** Relay base URL, e.g. `https://notify.internal`. */
  baseUrl: string;
  /** Bearer token for the relay. Never logged. */
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  sink?: NotificationLogSink;
}>;

/**
 * HTTP transport for a self-hosted relay.
 *
 * The response contract is minimal on purpose: the relay must return a JSON
 * object with a `messageId` string and a `status` of `SENT` or `QUEUED`.
 * Anything else is treated as an invalid response rather than guessed at,
 * because a wrong guess here means telling a customer their verification email
 * was sent when it was not.
 */
export class HttpNotificationPort implements NotificationPort {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly sink: NotificationLogSink;

  public constructor(options: HttpNotificationPortOptions) {
    if (options.baseUrl.trim().length === 0) {
      throw new NotificationUnavailableError(
        "PROVIDER_UNAVAILABLE",
        "Notification relay URL is not configured",
      );
    }
    if (options.apiKey.trim().length === 0) {
      throw new NotificationUnavailableError(
        "PROVIDER_UNAVAILABLE",
        "Notification relay API key is not configured",
      );
    }
    if (options.timeoutMs !== undefined && options.timeoutMs <= 0) {
      throw new NotificationUnavailableError(
        "PROVIDER_UNAVAILABLE",
        "Notification timeout must be a positive duration",
      );
    }

    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.sink = options.sink ?? defaultSink;
  }

  public async send(
    input: Parameters<NotificationPort["send"]>[0],
  ): Promise<{ providerMessageId: string; status: "SENT" | "QUEUED" }> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
          "idempotency-key": input.idempotencyKey,
        },
        body: JSON.stringify({
          channel: input.channel,
          recipientRef: input.recipientRef,
          templateCode: input.templateCode,
          variables: input.variables,
        }),
        signal: controller.signal,
      });

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new NotificationUnavailableError(
          "PROVIDER_INVALID_RESPONSE",
          "Notification relay returned a non-JSON response",
        );
      }

      if (!response.ok) {
        throw new NotificationUnavailableError(
          "PROVIDER_REJECTED",
          "Notification relay rejected the message",
        );
      }

      const parsed = parseNotificationResponse(body);
      if (parsed === null) {
        throw new NotificationUnavailableError(
          "PROVIDER_INVALID_RESPONSE",
          "Notification relay returned an unusable body",
        );
      }

      return parsed;
    } catch (error) {
      const summary = summarizeNotification(input);
      if (error instanceof NotificationUnavailableError) {
        // Never log the variables: they carry the action link and its token.
        this.sink.error("notification.failed", summary);
        throw error;
      }
      this.sink.error("notification.failed", summary);
      throw new NotificationUnavailableError(
        "PROVIDER_UNAVAILABLE",
        "Notification relay could not be reached",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export function parseNotificationResponse(
  body: unknown,
): { providerMessageId: string; status: "SENT" | "QUEUED" } | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const messageId = record.messageId;
  const status = record.status;
  if (typeof messageId !== "string" || messageId.length === 0) return null;
  if (status !== "SENT" && status !== "QUEUED") return null;

  return { providerMessageId: messageId, status };
}

/**
 * Resolves the configured provider. Returns `null` when the relay is not
 * configured so callers can fail closed with `PROVIDER_UNAVAILABLE` rather than
 * silently falling back to a console transport that sends nothing. The console
 * transport is a local development default only; production must explicitly
 * configure a relay.
 *
 * `EMAIL_PROVIDER=console` is accepted outside production. Production requires
 * a non-console provider plus `NOTIFICATION_RELAY_URL` and
 * `NOTIFICATION_RELAY_API_KEY`.
 */
export function createNotificationPortFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
  sink?: NotificationLogSink,
): NotificationPort | null {
  const provider = env.EMAIL_PROVIDER?.trim().toLowerCase();
  const isProduction = env.NODE_ENV === "production";
  if (provider === undefined || provider === "" || provider === "console") {
    if (isProduction) return null;
    return sink === undefined
      ? new ConsoleNotificationPort()
      : new ConsoleNotificationPort(sink);
  }

  const baseUrl = env.NOTIFICATION_RELAY_URL;
  const apiKey = env.NOTIFICATION_RELAY_API_KEY;
  if (
    baseUrl === undefined ||
    baseUrl.trim().length === 0 ||
    apiKey === undefined ||
    apiKey.trim().length === 0
  ) {
    return null;
  }

  return new HttpNotificationPort({
    baseUrl,
    apiKey,
    ...(sink === undefined ? {} : { sink }),
  });
}

export { REDACTED_VARIABLES };

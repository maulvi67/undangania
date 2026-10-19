import { createHash } from "node:crypto";
import nodemailer from "nodemailer";

/**
 * SMTP transport for the relay.
 *
 * Configuration is validated before the HTTP server starts so a missing sender
 * address or half-configured credentials fail the deploy instead of surfacing as
 * a 502 on the first verification email.
 */

export class RelayConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RelayConfigError";
  }
}

export type SmtpConfig =
  | Readonly<{ kind: "url"; url: string; from: string }>
  | Readonly<{
      kind: "host";
      host: string;
      port: number;
      secure: boolean;
      user?: string;
      pass?: string;
      from: string;
    }>;

export type EmailSender = Readonly<{
  send(input: {
    to: string;
    subject: string;
    text: string;
    html: string;
    idempotencyKey: string;
  }): Promise<{ messageId: string }>;
}>;

export type RelayConfig = Readonly<{
  apiKey: string;
  port: number;
  hostname: string;
  smtp: SmtpConfig;
}>;

const RELAY_API_KEY_MIN_LENGTH = 32;

export function relayConfigFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): RelayConfig {
  const apiKey = env.NOTIFICATION_RELAY_API_KEY ?? "";
  if (apiKey.length < RELAY_API_KEY_MIN_LENGTH) {
    throw new RelayConfigError(
      `NOTIFICATION_RELAY_API_KEY must be at least ${RELAY_API_KEY_MIN_LENGTH} characters`,
    );
  }

  const from = env.EMAIL_FROM?.trim() ?? "";
  if (from.length === 0) {
    throw new RelayConfigError("EMAIL_FROM is required");
  }
  if (/[\r\n]/.test(from)) {
    throw new RelayConfigError("EMAIL_FROM must be a single line");
  }

  const port = parsePort(env.PORT ?? "4100");
  const hostname = env.HOSTNAME?.trim() ?? "0.0.0.0";

  const smtpUrl = env.SMTP_URL?.trim();
  if (smtpUrl !== undefined && smtpUrl.length > 0) {
    return {
      apiKey,
      port,
      hostname,
      smtp: { kind: "url", url: smtpUrl, from },
    };
  }

  const host = env.SMTP_HOST?.trim();
  if (host === undefined || host.length === 0) {
    throw new RelayConfigError("SMTP_URL or SMTP_HOST is required");
  }

  const smtpPort = parsePort(env.SMTP_PORT ?? "587");
  const secure = parseBoolean(env.SMTP_SECURE, smtpPort === 465);
  const user = env.SMTP_USER?.trim();
  const normalizedUser =
    user !== undefined && user.length > 0 ? user : undefined;
  const rawPass = env.SMTP_PASS;
  const normalizedPass =
    rawPass !== undefined && rawPass.length > 0 ? rawPass : undefined;
  if ((normalizedUser === undefined) !== (normalizedPass === undefined)) {
    throw new RelayConfigError(
      "SMTP_USER and SMTP_PASS must be configured together",
    );
  }

  return {
    apiKey,
    port,
    hostname,
    smtp: {
      kind: "host",
      host,
      port: smtpPort,
      secure,
      from,
      ...(normalizedUser === undefined ? {} : { user: normalizedUser }),
      ...(normalizedPass === undefined ? {} : { pass: normalizedPass }),
    },
  };
}

export function createSmtpEmailSender(config: SmtpConfig): EmailSender {
  const transport =
    config.kind === "url"
      ? nodemailer.createTransport(config.url)
      : nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          ...(config.user === undefined
            ? {}
            : { auth: { user: config.user, pass: config.pass ?? "" } }),
        });

  return {
    async send(input) {
      const info = await transport.sendMail({
        from: config.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });

      const messageId =
        typeof info.messageId === "string" && info.messageId.length > 0
          ? info.messageId
          : fallbackMessageId(input.idempotencyKey);
      return { messageId };
    },
  };
}

function fallbackMessageId(idempotencyKey: string): string {
  const digest = createHash("sha256").update(idempotencyKey).digest("hex");
  return `relay-${digest.slice(0, 32)}`;
}

function parsePort(value: string): number {
  const port = Number(value.trim());
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new RelayConfigError("Port must be an integer between 1 and 65535");
  }
  return port;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new RelayConfigError("Boolean configuration must be true or false");
}

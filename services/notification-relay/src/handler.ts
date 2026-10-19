import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { EmailSender } from "./email-sender";
import {
  renderTemplate,
  TemplateVariablesError,
  UnknownTemplateError,
} from "./templates";

/**
 * HTTP surface expected by `HttpNotificationPort`.
 *
 * The relay is deliberately small: authenticate, validate, render, hand to SMTP,
 * and answer with the provider-shaped body the sender contract expects. It never
 * echoes or logs message variables, because the auth templates carry single-use
 * action links.
 */

export const MAX_RELAY_BODY_BYTES = 1024 * 1024;
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_IDEMPOTENCY_ENTRIES = 5_000;
const MAX_VARIABLES = 32;

type Channel = "EMAIL" | "WHATSAPP";

type RelayMessage = Readonly<{
  channel: Channel;
  recipientRef: string;
  templateCode: string;
  variables: Record<string, string>;
}>;

export type RelayHandlerOptions = Readonly<{
  apiKey: string;
  sender: EmailSender;
  now?: () => number;
  idempotencyTtlMs?: number;
  maxBodyBytes?: number;
}>;

export type RelayHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;

class HttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = "HttpError";
  }
}

class BodyTooLargeError extends Error {
  public constructor() {
    super("Request body is too large");
    this.name = "BodyTooLargeError";
  }
}

class DeliveryError extends Error {
  public constructor(cause: unknown) {
    super("SMTP delivery failed", { cause });
    this.name = "DeliveryError";
  }
}

export function createRelayHandler(options: RelayHandlerOptions): RelayHandler {
  const now = options.now ?? Date.now;
  const idempotencyTtlMs = options.idempotencyTtlMs ?? IDEMPOTENCY_TTL_MS;
  const maxBodyBytes = options.maxBodyBytes ?? MAX_RELAY_BODY_BYTES;
  const completed = new Map<
    string,
    Readonly<{ messageId: string; expiresAt: number }>
  >();
  const inflight = new Map<string, Promise<string>>();

  async function deliver(key: string, message: RelayMessage): Promise<string> {
    const cached = completed.get(key);
    if (cached !== undefined && cached.expiresAt > now()) {
      return cached.messageId;
    }
    if (cached !== undefined) completed.delete(key);

    const pending = inflight.get(key);
    if (pending !== undefined) return pending;

    const promise = (async (): Promise<string> => {
      const rendered = renderTemplate(message.templateCode, message.variables);
      let messageId: string;
      try {
        const sent = await options.sender.send({
          to: message.recipientRef,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          idempotencyKey: key,
        });
        messageId = sent.messageId.trim();
      } catch (error) {
        throw new DeliveryError(error);
      }
      if (messageId.length === 0) {
        throw new DeliveryError(
          new Error("SMTP provider returned no message id"),
        );
      }

      completed.set(key, { messageId, expiresAt: now() + idempotencyTtlMs });
      sweepExpired();
      return messageId;
    })();

    inflight.set(key, promise);
    // The stored promise is returned to every caller, so its rejection is always
    // observed. These callbacks only release the in-flight slot.
    promise.then(
      () => inflight.delete(key),
      () => inflight.delete(key),
    );
    return promise;
  }

  function sweepExpired(): void {
    if (completed.size <= MAX_IDEMPOTENCY_ENTRIES) return;
    const current = now();
    for (const [key, value] of completed) {
      if (value.expiresAt <= current) completed.delete(key);
    }
    // Still over the bound: drop the oldest insertions. Idempotency degrades to
    // "might deliver twice" rather than growing without limit.
    while (completed.size > MAX_IDEMPOTENCY_ENTRIES) {
      const oldest = completed.keys().next();
      if (oldest.done === true) break;
      completed.delete(oldest.value);
    }
  }

  return async (request, response) => {
    const url = new URL(request.url ?? "/", "http://relay.local");

    try {
      if (url.pathname === "/health") {
        if (request.method !== "GET") {
          methodNotAllowed(response, "GET");
          return;
        }
        sendJson(response, 200, { status: "ok" });
        return;
      }

      if (url.pathname !== "/v1/messages") {
        sendJson(response, 404, { error: "NOT_FOUND" });
        return;
      }

      if (request.method !== "POST") {
        methodNotAllowed(response, "POST");
        return;
      }

      if (
        !isAuthorized(
          headerValue(request.headers.authorization),
          options.apiKey,
        )
      ) {
        response.setHeader(
          "www-authenticate",
          'Bearer realm="notification-relay"',
        );
        sendJson(response, 401, { error: "UNAUTHORIZED" });
        return;
      }

      const contentType = headerValue(request.headers["content-type"]) ?? "";
      if (!contentType.toLowerCase().startsWith("application/json")) {
        sendJson(response, 415, { error: "UNSUPPORTED_MEDIA_TYPE" });
        return;
      }

      const idempotencyKey = parseIdempotencyKey(
        headerValue(request.headers["idempotency-key"]),
      );
      const body = await readJsonBody(request, maxBodyBytes);
      const message = parseRelayMessage(body);

      if (message.channel !== "EMAIL") {
        sendJson(response, 422, { error: "UNSUPPORTED_CHANNEL" });
        return;
      }

      let messageId: string;
      try {
        messageId = await deliver(idempotencyKey, message);
      } catch (error) {
        if (
          error instanceof UnknownTemplateError ||
          error instanceof TemplateVariablesError
        ) {
          console.error("relay.message.invalid_template", {
            templateCode: message.templateCode,
            error: error.name,
          });
          sendJson(response, 422, {
            error:
              error instanceof UnknownTemplateError
                ? "UNKNOWN_TEMPLATE"
                : "INVALID_TEMPLATE_VARIABLES",
          });
          return;
        }
        throw error;
      }

      console.info("relay.message.sent", {
        templateCode: message.templateCode,
        messageId,
      });
      sendJson(response, 200, { messageId, status: "SENT" });
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        response.setHeader("connection", "close");
        sendJson(response, 413, { error: "BODY_TOO_LARGE" });
        return;
      }
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.code });
        return;
      }
      if (error instanceof DeliveryError) {
        console.error("relay.message.failed", {
          error: "DELIVERY_FAILED",
        });
        sendJson(response, 502, { error: "DELIVERY_FAILED" });
        return;
      }
      console.error("relay.message.failed", { error: "INTERNAL_ERROR" });
      sendJson(response, 500, { error: "INTERNAL_ERROR" });
    }
  };
}

function isAuthorized(header: string | undefined, apiKey: string): boolean {
  const provided =
    header !== undefined && header.startsWith("Bearer ") ? header.slice(7) : "";
  // Hash both sides so the comparison is constant-time regardless of length.
  const given = createHash("sha256").update(provided).digest();
  const expected = createHash("sha256").update(apiKey).digest();
  return timingSafeEqual(given, expected);
}

function headerValue(
  value: string | readonly string[] | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : value[0];
}

function parseIdempotencyKey(value: string | undefined): string {
  const key = value?.trim() ?? "";
  if (key.length < 16 || key.length > 128) {
    throw new HttpError(400, "INVALID_IDEMPOTENCY_KEY");
  }
  return key;
}

async function readJsonBody(
  request: IncomingMessage,
  limit: number,
): Promise<unknown> {
  const declared = headerValue(request.headers["content-length"]);
  if (declared !== undefined) {
    const length = Number(declared);
    if (!Number.isSafeInteger(length) || length < 0) {
      throw new HttpError(400, "INVALID_CONTENT_LENGTH");
    }
    if (length > limit) throw new BodyTooLargeError();
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as Uint8Array);
    total += buffer.length;
    if (total > limit) throw new BodyTooLargeError();
    chunks.push(buffer);
  }

  if (total === 0) throw new HttpError(400, "INVALID_BODY");

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "INVALID_JSON");
  }
  return parsed;
}

function parseRelayMessage(body: unknown): RelayMessage {
  if (!isRecord(body)) throw new HttpError(422, "INVALID_BODY");

  const channel = body.channel;
  if (channel !== "EMAIL" && channel !== "WHATSAPP") {
    throw new HttpError(422, "INVALID_CHANNEL");
  }

  const recipientRef = body.recipientRef;
  if (
    typeof recipientRef !== "string" ||
    recipientRef.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientRef) ||
    /[\r\n]/.test(recipientRef)
  ) {
    throw new HttpError(422, "INVALID_RECIPIENT");
  }

  const templateCode = body.templateCode;
  if (
    typeof templateCode !== "string" ||
    templateCode.length > 100 ||
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(templateCode)
  ) {
    throw new HttpError(422, "INVALID_TEMPLATE_CODE");
  }

  const variables = parseVariables(body.variables);

  return {
    channel,
    recipientRef,
    templateCode,
    variables,
  };
}

function parseVariables(value: unknown): Record<string, string> {
  if (!isRecord(value)) throw new HttpError(422, "INVALID_VARIABLES");
  const entries = Object.entries(value);
  if (entries.length > MAX_VARIABLES) {
    throw new HttpError(422, "INVALID_VARIABLES");
  }

  const variables: Record<string, string> = {};
  for (const [key, entry] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(key)) {
      throw new HttpError(422, "INVALID_VARIABLES");
    }
    if (typeof entry !== "string" || entry.length > 4_096) {
      throw new HttpError(422, "INVALID_VARIABLES");
    }
    variables[key] = entry;
  }
  return variables;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function methodNotAllowed(response: ServerResponse, allow: string): void {
  response.setHeader("allow", allow);
  sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("content-length", Buffer.byteLength(payload));
  response.end(payload);
}

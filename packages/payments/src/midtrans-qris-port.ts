import { z } from "zod";

import type { PaymentPort, PaymentStatus } from "./index";
import {
  createMidtransNotificationEventId,
  createQrisChargeRequest,
  mapMidtransStatus,
  parseAndVerifyMidtransNotification,
  parseIdrAmountMinor,
  qrisActionUrl,
  type MidtransQrisChargeResponse,
} from "./midtrans-qris";

/**
 * HTTP implementation of `PaymentPort` for Midtrans QRIS.
 *
 * Scope note: only `create`, `verifyWebhook`, and `getStatus` are enabled.
 * `refund` is deliberately fail-closed — moving money back to a customer is a
 * provider payout/refund action that requires a separate, reviewed approval
 * (`AGENTS.md` high-risk list). The method exists so the port contract is
 * satisfied and callers get a typed, testable refusal instead of a runtime
 * surprise.
 */

const SANDBOX_BASE_URL = "https://api.sandbox.midtrans.com";
const PRODUCTION_BASE_URL = "https://api.midtrans.com";

const ALLOWED_BASE_URLS = new Set([SANDBOX_BASE_URL, PRODUCTION_BASE_URL]);

const DEFAULT_TIMEOUT_MS = 10_000;

export type MidtransQrisEnvironment = "sandbox" | "production";

export type QrisProviderErrorCode =
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_REJECTED"
  | "PROVIDER_INVALID_RESPONSE"
  | "REFUND_NOT_ENABLED";

export class QrisProviderError extends Error {
  public constructor(
    public readonly code: QrisProviderErrorCode,
    message: string,
    public readonly providerStatusCode: string | null = null,
  ) {
    super(message);
    this.name = "QrisProviderError";
  }
}

/** Midtrans charge responses carry more fields than we consume. */
const chargeResponseSchema = z.object({
  status_code: z.string().regex(/^\d{3}$/),
  status_message: z.string().optional(),
  transaction_id: z.string().min(1).optional(),
  order_id: z.string().min(1).optional(),
  transaction_status: z.string().min(1).optional(),
  payment_type: z.string().optional(),
  gross_amount: z.string().optional(),
  currency: z.string().optional(),
  actions: z
    .array(
      z.object({
        name: z.string().optional(),
        method: z.string().optional(),
        url: z.string().optional(),
      }),
    )
    .optional(),
});

const statusResponseSchema = z.object({
  status_code: z.string().regex(/^\d{3}$/),
  transaction_status: z.string().min(1).optional(),
  transaction_id: z.string().min(1).optional(),
});

function baseUrlFor(environment: MidtransQrisEnvironment): string {
  return environment === "production" ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
}

function isAccepted(statusCode: string): boolean {
  return statusCode.startsWith("2");
}

function toChargeResponse(
  parsed: z.infer<typeof chargeResponseSchema>,
): MidtransQrisChargeResponse {
  return {
    status_code: parsed.status_code,
    ...(parsed.status_message === undefined
      ? {}
      : { status_message: parsed.status_message }),
    ...(parsed.transaction_id === undefined
      ? {}
      : { transaction_id: parsed.transaction_id }),
    ...(parsed.order_id === undefined ? {} : { order_id: parsed.order_id }),
    ...(parsed.transaction_status === undefined
      ? {}
      : { transaction_status: parsed.transaction_status }),
    ...(parsed.payment_type === undefined
      ? {}
      : { payment_type: parsed.payment_type }),
    ...(parsed.gross_amount === undefined
      ? {}
      : { gross_amount: parsed.gross_amount }),
    ...(parsed.currency === undefined ? {} : { currency: parsed.currency }),
    ...(parsed.actions === undefined
      ? {}
      : {
          actions: parsed.actions.map((action) => ({
            ...(action.name === undefined ? {} : { name: action.name }),
            ...(action.method === undefined ? {} : { method: action.method }),
            ...(action.url === undefined ? {} : { url: action.url }),
          })),
        }),
  };
}

export type MidtransQrisPaymentPortOptions = Readonly<{
  serverKey: string;
  environment: MidtransQrisEnvironment;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Test seam; production callers should use the default derived base URL. */
  baseUrl?: string;
}>;

export function resolveQrisEnvironment(
  value: string | undefined,
): MidtransQrisEnvironment {
  return value?.trim().toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

export class MidtransQrisPaymentPort implements PaymentPort {
  private readonly serverKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  public constructor(options: MidtransQrisPaymentPortOptions) {
    if (options.serverKey.trim().length === 0) {
      throw new QrisProviderError(
        "PROVIDER_UNAVAILABLE",
        "Midtrans server key is not configured",
      );
    }
    if (options.timeoutMs !== undefined && options.timeoutMs <= 0) {
      throw new QrisProviderError(
        "PROVIDER_UNAVAILABLE",
        "Midtrans timeout must be positive",
      );
    }

    const baseUrl = options.baseUrl ?? baseUrlFor(options.environment);
    if (!ALLOWED_BASE_URLS.has(baseUrl)) {
      throw new QrisProviderError(
        "PROVIDER_UNAVAILABLE",
        "Midtrans base URL is not allowlisted",
      );
    }

    this.serverKey = options.serverKey;
    this.baseUrl = baseUrl;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private authorizationHeader(): string {
    const encoded = Buffer.from(`${this.serverKey}:`, "utf8").toString(
      "base64",
    );
    return `Basic ${encoded}`;
  }

  private async requestJson(
    path: string,
    init: Readonly<{ method: "GET" | "POST"; body?: unknown }>,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: init.method,
        headers: {
          accept: "application/json",
          authorization: this.authorizationHeader(),
          "content-type": "application/json",
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        signal: controller.signal,
      });

      let parsedBody: unknown;
      try {
        parsedBody = await response.json();
      } catch {
        // A non-JSON body never comes from a healthy Midtrans endpoint, and a
        // gateway error page may contain credentials-adjacent markup we must
        // not surface to callers or logs.
        throw new QrisProviderError(
          "PROVIDER_INVALID_RESPONSE",
          "Midtrans returned a non-JSON response",
        );
      }

      if (!response.ok) {
        throw new QrisProviderError(
          "PROVIDER_REJECTED",
          "Midtrans rejected the request",
          String(response.status),
        );
      }

      return parsedBody;
    } catch (error) {
      if (error instanceof QrisProviderError) throw error;
      throw new QrisProviderError(
        "PROVIDER_UNAVAILABLE",
        "Midtrans could not be reached",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  public async create(input: {
    orderId: string;
    amountMinor: bigint;
    currency: "IDR";
  }): Promise<{ providerTransactionId: string; redirectUrl: string }> {
    const request = createQrisChargeRequest({
      orderId: input.orderId,
      amountMinor: input.amountMinor,
    });

    const raw = await this.requestJson("/v2/charge", {
      method: "POST",
      body: request,
    });

    const parsed = chargeResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new QrisProviderError(
        "PROVIDER_INVALID_RESPONSE",
        "Midtrans charge response did not match the expected contract",
      );
    }

    const response = toChargeResponse(parsed.data);
    if (!isAccepted(response.status_code)) {
      throw new QrisProviderError(
        "PROVIDER_REJECTED",
        "Midtrans did not accept the QRIS charge",
        response.status_code,
      );
    }
    if (response.transaction_id === undefined) {
      throw new QrisProviderError(
        "PROVIDER_INVALID_RESPONSE",
        "Midtrans charge response omitted the transaction id",
      );
    }

    // The QR image URL is the customer-visible half of the charge. It is
    // host-allowlisted by `qrisActionUrl`, so an unexpected host fails closed
    // rather than being handed to the customer.
    const redirectUrl = qrisActionUrl(response);
    if (redirectUrl === undefined) {
      throw new QrisProviderError(
        "PROVIDER_INVALID_RESPONSE",
        "Midtrans charge response had no usable QRIS action URL",
      );
    }

    return { providerTransactionId: response.transaction_id, redirectUrl };
  }

  public async verifyWebhook(input: {
    headers: Record<string, string>;
    rawBody: string;
  }): Promise<{
    eventId: string;
    transactionId: string;
    status: PaymentStatus;
    amountMinor: bigint;
  }> {
    // Midtrans authenticates the notification with a SHA-512 signature over
    // the body, not with a header, so the header map is intentionally unused.
    const notification = parseAndVerifyMidtransNotification({
      rawBody: input.rawBody,
      serverKey: this.serverKey,
    });

    return {
      eventId: createMidtransNotificationEventId(notification),
      transactionId: notification.transaction_id,
      status: mapMidtransStatus(notification.transaction_status),
      amountMinor: parseIdrAmountMinor(notification.gross_amount),
    };
  }

  public async getStatus(transactionId: string): Promise<PaymentStatus> {
    if (transactionId.trim().length === 0) {
      throw new QrisProviderError(
        "PROVIDER_REJECTED",
        "A transaction id is required",
      );
    }

    const raw = await this.requestJson(
      `/v2/${encodeURIComponent(transactionId)}/status`,
      { method: "GET" },
    );

    const parsed = statusResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new QrisProviderError(
        "PROVIDER_INVALID_RESPONSE",
        "Midtrans status response did not match the expected contract",
      );
    }
    if (!isAccepted(parsed.data.status_code)) {
      throw new QrisProviderError(
        "PROVIDER_REJECTED",
        "Midtrans did not return a status for the transaction",
        parsed.data.status_code,
      );
    }
    if (parsed.data.transaction_status === undefined) {
      throw new QrisProviderError(
        "PROVIDER_INVALID_RESPONSE",
        "Midtrans status response omitted the transaction status",
      );
    }

    try {
      return mapMidtransStatus(parsed.data.transaction_status);
    } catch {
      throw new QrisProviderError(
        "PROVIDER_INVALID_RESPONSE",
        "Midtrans reported an unrecognized transaction status",
      );
    }
  }

  public refund(transactionId: string, amountMinor: bigint): Promise<void> {
    void transactionId;
    void amountMinor;
    return Promise.reject(
      new QrisProviderError(
        "REFUND_NOT_ENABLED",
        "Refunds are disabled pending payment-owner approval",
      ),
    );
  }
}

/**
 * Resolves the Midtrans server key from the environment.
 *
 * `MIDTRANS_SERVER_KEY` is the canonical name. `PAYMENT_SERVER_KEY` is accepted as
 * a fallback because it is the name the tracked `.env.example` shipped, so a
 * deployment set up from that template would otherwise start with payments
 * silently disabled — the port returns `null` and the webhook answers 503, which
 * looks like a provider outage rather than a configuration mistake.
 *
 * Returns `null` when neither is set so callers stay fail-closed.
 */
export function resolveMidtransServerKey(
  env: Readonly<Record<string, string | undefined>>,
): string | null {
  for (const name of ["MIDTRANS_SERVER_KEY", "PAYMENT_SERVER_KEY"] as const) {
    const value = env[name];
    if (value !== undefined && value.trim().length > 0) return value;
  }
  return null;
}

/**
 * Builds the port from environment variables, or returns `null` when the
 * deployment is not configured for QRIS. Callers must treat `null` as
 * fail-closed rather than falling back to a simulated charge.
 */
export function createMidtransQrisPaymentPortFromEnv(
  env: Readonly<Record<string, string | undefined>>,
  options: Readonly<{
    environment?: MidtransQrisEnvironment;
    fetchImpl?: typeof fetch;
  }> = {},
): MidtransQrisPaymentPort | null {
  const serverKey = resolveMidtransServerKey(env);
  if (serverKey === null) return null;

  return new MidtransQrisPaymentPort({
    serverKey,
    environment:
      options.environment ??
      resolveQrisEnvironment(env.MIDTRANS_ENVIRONMENT ?? env.PAYMENT_ENV),
    ...(options.fetchImpl === undefined
      ? {}
      : { fetchImpl: options.fetchImpl }),
  });
}

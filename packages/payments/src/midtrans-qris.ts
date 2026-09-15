import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import type { PaymentStatus } from "./index";

const QRIS_ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const QRIS_AMOUNT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

const MIDTRANS_TRANSACTION_STATUSES = [
  "pending",
  "settlement",
  "expire",
  "deny",
  "cancel",
  "failure",
  "refund",
] as const;

/**
 * Midtrans's notification contract is deliberately strict. Known optional
 * provider fields are accepted, but an unexpected field is rejected at the
 * server boundary instead of being silently ignored.
 */
export const midtransNotificationSchema = z
  .object({
    signature_key: z.string().regex(/^[a-f0-9]{128}$/i),
    order_id: z.string().regex(QRIS_ORDER_ID_PATTERN),
    status_code: z.string().regex(/^\d{3}$/),
    gross_amount: z.string().regex(QRIS_AMOUNT_PATTERN),
    transaction_status: z.enum(MIDTRANS_TRANSACTION_STATUSES),
    payment_type: z.string().min(1).max(40),
    transaction_id: z.string().min(1).max(100),
    currency: z.string().regex(/^[A-Z]{3}$/),
    transaction_time: z.string().min(1).max(64).optional(),
    status_message: z.string().min(1).max(256).optional(),
    merchant_id: z.string().min(1).max(100).optional(),
    fraud_status: z.string().min(1).max(40).optional(),
    settlement_time: z.string().min(1).max(64).optional(),
    expiry_time: z.string().min(1).max(64).optional(),
    issuer: z.string().min(1).max(100).optional(),
    acquirer: z.string().min(1).max(100).optional(),
    channel_response_code: z.string().min(1).max(40).optional(),
    channel_response_message: z.string().min(1).max(256).optional(),
  })
  .strict();

export type MidtransNotification = z.infer<typeof midtransNotificationSchema>;

export class MidtransNotificationPayloadError extends Error {
  public readonly code = "INVALID_PAYLOAD" as const;

  public constructor() {
    super("Invalid Midtrans notification payload");
    this.name = "MidtransNotificationPayloadError";
  }
}

export class MidtransNotificationSignatureError extends Error {
  public readonly code = "INVALID_SIGNATURE" as const;

  public constructor() {
    super("Invalid Midtrans notification signature");
    this.name = "MidtransNotificationSignatureError";
  }
}

export type MidtransQrisChargeRequest = {
  payment_type: "qris";
  transaction_details: {
    order_id: string;
    gross_amount: number;
  };
  qris?: { acquirer: "gopay" | "airpay" };
};

export type MidtransQrisChargeResponse = {
  status_code: string;
  status_message?: string;
  transaction_id?: string;
  order_id?: string;
  transaction_status?: string;
  payment_type?: string;
  gross_amount?: string;
  currency?: string;
  actions?: ReadonlyArray<{
    name?: string;
    method?: string;
    url?: string;
  }>;
};

export function assertValidQrisOrderId(orderId: string): void {
  if (!QRIS_ORDER_ID_PATTERN.test(orderId)) {
    throw new Error("Invalid order id");
  }
}

export function createQrisChargeRequest(input: {
  orderId: string;
  amountMinor: bigint;
  acquirer?: "gopay" | "airpay";
}): MidtransQrisChargeRequest {
  assertValidQrisOrderId(input.orderId);
  if (
    input.amountMinor <= 0n ||
    input.amountMinor > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error("QRIS amount must be a positive safe integer");
  }

  const request: MidtransQrisChargeRequest = {
    payment_type: "qris",
    transaction_details: {
      order_id: input.orderId,
      gross_amount: Number(input.amountMinor),
    },
  };

  if (input.acquirer) request.qris = { acquirer: input.acquirer };
  return request;
}

export function mapMidtransStatus(status: string): PaymentStatus {
  switch (status.trim().toLowerCase()) {
    case "pending":
      return "PENDING";
    case "settlement":
      return "PAID";
    case "expire":
      return "EXPIRED";
    case "deny":
    case "cancel":
    case "failure":
      return "FAILED";
    case "refund":
      return "REFUNDED";
    default:
      throw new Error("Unknown Midtrans transaction status");
  }
}

export function createMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
): string {
  if (!orderId || !statusCode || !grossAmount || !serverKey) {
    throw new Error("Signature inputs are required");
  }
  return createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`, "utf8")
    .digest("hex");
}

export function verifyMidtransSignature(input: {
  signatureKey: string;
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
}): boolean {
  const expected = createMidtransSignature(
    input.orderId,
    input.statusCode,
    input.grossAmount,
    input.serverKey,
  );
  const provided = input.signatureKey.trim().toLowerCase();
  if (!/^[a-f0-9]{128}$/.test(provided)) return false;

  const expectedBytes = Buffer.from(expected, "hex");
  const providedBytes = Buffer.from(provided, "hex");
  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
}

export function parseMidtransNotification(
  rawBody: string,
): MidtransNotification {
  if (typeof rawBody !== "string") {
    throw new MidtransNotificationPayloadError();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    throw new MidtransNotificationPayloadError();
  }

  const result = midtransNotificationSchema.safeParse(parsed);
  if (!result.success) {
    throw new MidtransNotificationPayloadError();
  }
  return result.data;
}

/**
 * The handler must receive the untouched request body. Midtrans signs fields
 * in the notification, so parsing happens once here and verification is
 * performed before any repository lookup or state mutation.
 */
export function parseAndVerifyMidtransNotification(input: {
  rawBody: string;
  serverKey: string;
}): MidtransNotification {
  const notification = parseMidtransNotification(input.rawBody);
  let isValid = false;
  try {
    isValid = verifyMidtransSignature({
      signatureKey: notification.signature_key,
      orderId: notification.order_id,
      statusCode: notification.status_code,
      grossAmount: notification.gross_amount,
      serverKey: input.serverKey,
    });
  } catch {
    throw new MidtransNotificationSignatureError();
  }
  if (!isValid) {
    throw new MidtransNotificationSignatureError();
  }
  return notification;
}

export function createMidtransNotificationEventId(
  notification: Pick<
    MidtransNotification,
    | "order_id"
    | "transaction_id"
    | "status_code"
    | "gross_amount"
    | "transaction_status"
    | "currency"
  >,
): string {
  const fingerprint = [
    notification.order_id,
    notification.transaction_id,
    notification.status_code,
    notification.gross_amount,
    notification.transaction_status,
    notification.currency,
  ].join("\u001f");
  return `midtrans:${createHash("sha256")
    .update(fingerprint, "utf8")
    .digest("hex")}`;
}

export type QrisNotificationValidationCode =
  | "ORDER_MISMATCH"
  | "METHOD_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "INVALID_AMOUNT"
  | "AMOUNT_MISMATCH";

export class QrisNotificationValidationError extends Error {
  public constructor(
    public readonly code: QrisNotificationValidationCode,
    message: string,
  ) {
    super(message);
    this.name = "QrisNotificationValidationError";
  }
}

export function parseIdrAmountMinor(grossAmount: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(grossAmount);
  const wholeAmount = match?.[1];
  const fractionalAmount = match?.[2];
  if (
    !wholeAmount ||
    (fractionalAmount !== undefined && !/^0+$/.test(fractionalAmount))
  ) {
    throw new QrisNotificationValidationError(
      "INVALID_AMOUNT",
      "Invalid payment amount",
    );
  }

  let amountMinor: bigint;
  try {
    amountMinor = BigInt(wholeAmount);
  } catch {
    throw new QrisNotificationValidationError(
      "INVALID_AMOUNT",
      "Invalid payment amount",
    );
  }
  if (
    amountMinor <= 0n ||
    amountMinor > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new QrisNotificationValidationError(
      "INVALID_AMOUNT",
      "Invalid payment amount",
    );
  }
  return amountMinor;
}

export function assertQrisNotification(input: {
  notification: MidtransNotification;
  expectedOrderId: string;
  expectedAmountMinor: bigint;
}): void {
  const { notification } = input;
  assertValidQrisOrderId(input.expectedOrderId);
  if (notification.order_id !== input.expectedOrderId) {
    throw new QrisNotificationValidationError(
      "ORDER_MISMATCH",
      "Payment order mismatch",
    );
  }
  if (notification.payment_type !== "qris") {
    throw new QrisNotificationValidationError(
      "METHOD_MISMATCH",
      "Payment method mismatch",
    );
  }
  if (notification.currency !== "IDR") {
    throw new QrisNotificationValidationError(
      "CURRENCY_MISMATCH",
      "Payment currency mismatch",
    );
  }

  const amountMinor = parseIdrAmountMinor(notification.gross_amount);
  if (amountMinor !== input.expectedAmountMinor) {
    throw new QrisNotificationValidationError(
      "AMOUNT_MISMATCH",
      "Payment amount mismatch",
    );
  }
}

const MIDTRANS_API_HOSTS = new Set([
  "api.sandbox.midtrans.com",
  "api.midtrans.com",
]);

export function qrisActionUrl(
  response: MidtransQrisChargeResponse,
): string | undefined {
  const action = response.actions?.find(
    (candidate) =>
      candidate.name === "generate-qr-code" && candidate.method === "GET",
  );
  if (!action?.url) return undefined;
  try {
    const parsed = new URL(action.url);
    if (
      parsed.protocol !== "https:" ||
      !MIDTRANS_API_HOSTS.has(parsed.hostname)
    ) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function isVerifiedPaidStatus(status: PaymentStatus): boolean {
  return status === "PAID";
}

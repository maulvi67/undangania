import { createHash, timingSafeEqual } from "node:crypto";

import type { PaymentStatus } from "./index";

/**
 * Midtrans QRIS adapter primitives (sandbox boundary, MVP-UI-012).
 *
 * This module intentionally contains no HTTP client and no credentials. A
 * server-side adapter can use these pure helpers when it calls Midtrans. Raw
 * provider payloads must remain server-side and must not cross into the
 * customer-web bundle.
 */

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

export type MidtransNotification = {
  signature_key: string;
  order_id: string;
  status_code: string;
  gross_amount: string;
  transaction_status: string;
  payment_type: string;
  transaction_id: string;
  currency: string;
};

export function createQrisChargeRequest(input: {
  orderId: string;
  amountMinor: bigint;
  acquirer?: "gopay" | "airpay";
}): MidtransQrisChargeRequest {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(input.orderId)) {
    throw new Error("Invalid order id");
  }
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

export function assertQrisNotification(input: {
  notification: MidtransNotification;
  expectedOrderId: string;
  expectedAmountMinor: bigint;
}): void {
  const { notification } = input;
  if (notification.order_id !== input.expectedOrderId) {
    throw new Error("Payment order mismatch");
  }
  if (notification.payment_type !== "qris") {
    throw new Error("Payment method mismatch");
  }
  if (notification.currency !== "IDR") {
    throw new Error("Payment currency mismatch");
  }
  const amountParts = notification.gross_amount.split(".");
  const wholeAmount = amountParts[0];
  const fractionalAmount = amountParts[1];
  if (
    !wholeAmount ||
    !/^\d+$/.test(wholeAmount) ||
    (fractionalAmount !== undefined && !/^0+$/.test(fractionalAmount))
  ) {
    throw new Error("Invalid payment amount");
  }
  if (BigInt(wholeAmount) !== input.expectedAmountMinor) {
    throw new Error("Payment amount mismatch");
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

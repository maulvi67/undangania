export type PaymentStatus =
  "CREATED" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";

export interface PaymentPort {
  create(input: {
    orderId: string;
    amountMinor: bigint;
    currency: "IDR";
  }): Promise<{
    providerTransactionId: string;
    redirectUrl: string;
  }>;
  verifyWebhook(input: {
    headers: Record<string, string>;
    rawBody: string;
  }): Promise<{
    eventId: string;
    transactionId: string;
    status: PaymentStatus;
    amountMinor: bigint;
  }>;
  getStatus(transactionId: string): Promise<PaymentStatus>;
  refund(transactionId: string, amountMinor: bigint): Promise<void>;
}

export * from "./midtrans-qris";

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
export {
  createMidtransQrisPaymentPortFromEnv,
  MidtransQrisPaymentPort,
  QrisProviderError,
  resolveQrisEnvironment,
  type MidtransQrisEnvironment,
  type MidtransQrisPaymentPortOptions,
  type QrisProviderErrorCode,
} from "./midtrans-qris-port";
export {
  processQrisNotification,
  QrisProcessingError,
  type ProcessQrisNotificationInput,
  type QrisAuditRepository,
  type QrisEntitlementRepository,
  type QrisNotificationProcessingResult,
  type QrisNotificationRepositories,
  type QrisNotificationTransactionPort,
  type QrisOrderRecord,
  type QrisOrderRepository,
  type QrisOrderStatus,
  type QrisOutboxRepository,
  type QrisPaymentRecord,
  type QrisPaymentRepository,
  type QrisProcessingErrorCode,
} from "./process-qris-notification";

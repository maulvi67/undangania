import type { PaymentStatus } from "./index";
import {
  assertQrisNotification,
  createMidtransNotificationEventId,
  mapMidtransStatus,
  parseAndVerifyMidtransNotification,
  type MidtransNotification,
} from "./midtrans-qris";

export type QrisOrderStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PAID"
  | "FULFILLING"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export interface QrisPaymentRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly orderId: string;
  readonly provider: string;
  readonly providerTransactionId: string;
  readonly providerEventId: string | null;
  readonly method: string | null;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly status: PaymentStatus;
}

export interface QrisOrderRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly orderNumber: string;
  readonly currency: string;
  readonly totalMinor: bigint;
  readonly status: QrisOrderStatus;
}

export interface QrisPaymentRepository {
  /**
   * The transaction adapter must lock the payment row while it is read. The
   * providerEventId uniqueness constraint remains the final concurrency guard.
   */
  findByProviderTransactionId(input: {
    provider: "midtrans";
    providerTransactionId: string;
  }): Promise<QrisPaymentRecord | null>;
  findByProviderEventId(input: {
    provider: "midtrans";
    providerEventId: string;
  }): Promise<QrisPaymentRecord | null>;
  updateStatus(input: {
    tenantId: string;
    paymentId: string;
    status: PaymentStatus;
    providerEventId: string;
    paidAt: Date | null;
  }): Promise<void>;
}

export interface QrisOrderRepository {
  findById(input: {
    tenantId: string;
    orderId: string;
  }): Promise<QrisOrderRecord | null>;
  updateStatus(input: {
    tenantId: string;
    orderId: string;
    status: "PAID";
  }): Promise<void>;
}

export interface QrisEntitlementRepository {
  /**
   * This operation must be idempotent for an order and run in the supplied
   * transaction. It creates the paid entitlements for all order items once.
   */
  grantForPaidOrder(input: {
    tenantId: string;
    orderId: string;
    startsAt: Date;
  }): Promise<void>;
}

export interface QrisOutboxRepository {
  /** The adapter must no-op when this key was already appended. */
  append(input: {
    idempotencyKey: string;
    tenantId: string;
    eventType: "PaymentConfirmed";
    aggregateType: "Payment";
    aggregateId: string;
    payload: Readonly<{
      paymentId: string;
      orderId: string;
      provider: "midtrans";
      providerTransactionId: string;
      providerEventId: string;
      status: "PAID";
      occurredAt: string;
    }>;
    payloadVersion: 1;
  }): Promise<void>;
}

export interface QrisAuditRepository {
  append(input: {
    tenantId: string;
    actorType: "PROVIDER";
    action:
      | "PAYMENT_NOTIFICATION_APPLIED"
      | "PAYMENT_NOTIFICATION_DUPLICATE"
      | "PAYMENT_NOTIFICATION_OUT_OF_ORDER";
    targetType: "Payment";
    targetId: string;
    reason: string;
    metadata: Readonly<{
      provider: "midtrans";
      providerEventId: string;
      providerTransactionId: string;
      receivedStatus: PaymentStatus;
    }>;
    correlationId: string;
  }): Promise<void>;
}

export interface QrisNotificationRepositories {
  readonly payments: QrisPaymentRepository;
  readonly orders: QrisOrderRepository;
  readonly entitlements: QrisEntitlementRepository;
  readonly outbox: QrisOutboxRepository;
  readonly audit: QrisAuditRepository;
}

export interface QrisNotificationTransactionPort {
  transaction<T>(
    work: (repositories: QrisNotificationRepositories) => Promise<T>,
  ): Promise<T>;
}

export interface ProcessQrisNotificationInput {
  readonly rawBody: string;
  readonly serverKey: string;
  readonly now?: Date;
}

export type QrisNotificationProcessingResult =
  | {
      readonly kind: "APPLIED";
      readonly eventId: string;
      readonly paymentId: string;
      readonly orderId: string;
      readonly status: PaymentStatus;
    }
  | {
      readonly kind: "DUPLICATE";
      readonly eventId: string;
      readonly paymentId: string;
      readonly orderId: string;
      readonly status: PaymentStatus;
    }
  | {
      readonly kind: "IGNORED_OUT_OF_ORDER";
      readonly eventId: string;
      readonly paymentId: string;
      readonly orderId: string;
      readonly currentStatus: PaymentStatus;
      readonly receivedStatus: PaymentStatus;
    };

export type QrisProcessingErrorCode =
  | "PAYMENT_NOT_FOUND"
  | "ORDER_NOT_FOUND"
  | "PAYMENT_PROVIDER_MISMATCH"
  | "TENANT_MISMATCH"
  | "PAYMENT_CURRENCY_MISMATCH"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "PAYMENT_METHOD_MISMATCH"
  | "ORDER_CURRENCY_MISMATCH"
  | "ORDER_AMOUNT_MISMATCH"
  | "ORDER_STATE_CONFLICT"
  | "UNSUPPORTED_STATUS";

export class QrisProcessingError extends Error {
  public constructor(
    public readonly code: QrisProcessingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "QrisProcessingError";
  }
}

function isPaidOrderStatus(status: QrisOrderStatus): boolean {
  return status === "PAID" || status === "FULFILLING" || status === "COMPLETED";
}

function canApplyStatus(
  currentStatus: PaymentStatus,
  receivedStatus: PaymentStatus,
): boolean {
  if (currentStatus === "PAID" || currentStatus === "REFUNDED") return false;
  if (receivedStatus === "REFUNDED") return false;
  if (receivedStatus === "PAID") return true;
  if (currentStatus === "CREATED" || currentStatus === "PENDING") return true;
  return currentStatus === receivedStatus;
}

function isSupportedQrisStatus(status: PaymentStatus): boolean {
  return (
    status === "PENDING" ||
    status === "PAID" ||
    status === "FAILED" ||
    status === "EXPIRED"
  );
}

function assertPaymentMatchesOrder(
  payment: QrisPaymentRecord,
  order: QrisOrderRecord,
): void {
  if (payment.provider !== "midtrans") {
    throw new QrisProcessingError(
      "PAYMENT_PROVIDER_MISMATCH",
      "Payment provider mismatch",
    );
  }
  if (payment.tenantId !== order.tenantId) {
    throw new QrisProcessingError("TENANT_MISMATCH", "Payment tenant mismatch");
  }
  if (payment.currency !== "IDR") {
    throw new QrisProcessingError(
      "PAYMENT_CURRENCY_MISMATCH",
      "Payment currency mismatch",
    );
  }
  if (order.currency !== "IDR") {
    throw new QrisProcessingError(
      "ORDER_CURRENCY_MISMATCH",
      "Order currency mismatch",
    );
  }
  if (payment.amountMinor <= 0n) {
    throw new QrisProcessingError(
      "PAYMENT_AMOUNT_MISMATCH",
      "Payment amount mismatch",
    );
  }
  if (payment.amountMinor !== order.totalMinor) {
    throw new QrisProcessingError(
      "ORDER_AMOUNT_MISMATCH",
      "Order amount mismatch",
    );
  }
  if (payment.method?.trim().toLowerCase() !== "qris") {
    throw new QrisProcessingError(
      "PAYMENT_METHOD_MISMATCH",
      "Payment method mismatch",
    );
  }
}

function assertOrderCanBePaid(order: QrisOrderRecord): void {
  if (isPaidOrderStatus(order.status)) return;
  if (order.status === "PENDING_PAYMENT") return;
  throw new QrisProcessingError(
    "ORDER_STATE_CONFLICT",
    "Order cannot transition to paid",
  );
}

function auditMetadata(input: {
  eventId: string;
  notification: MidtransNotification;
  receivedStatus: PaymentStatus;
}): {
  provider: "midtrans";
  providerEventId: string;
  providerTransactionId: string;
  receivedStatus: PaymentStatus;
} {
  return {
    provider: "midtrans",
    providerEventId: input.eventId,
    providerTransactionId: input.notification.transaction_id,
    receivedStatus: input.receivedStatus,
  };
}

async function appendAudit(
  repositories: QrisNotificationRepositories,
  input: {
    payment: QrisPaymentRecord;
    eventId: string;
    notification: MidtransNotification;
    action:
      | "PAYMENT_NOTIFICATION_APPLIED"
      | "PAYMENT_NOTIFICATION_DUPLICATE"
      | "PAYMENT_NOTIFICATION_OUT_OF_ORDER";
    reason: string;
    receivedStatus: PaymentStatus;
  },
): Promise<void> {
  await repositories.audit.append({
    tenantId: input.payment.tenantId,
    actorType: "PROVIDER",
    action: input.action,
    targetType: "Payment",
    targetId: input.payment.id,
    reason: input.reason,
    metadata: auditMetadata({
      eventId: input.eventId,
      notification: input.notification,
      receivedStatus: input.receivedStatus,
    }),
    correlationId: input.eventId,
  });
}

export async function processQrisNotification(
  input: ProcessQrisNotificationInput,
  ports: QrisNotificationTransactionPort,
): Promise<QrisNotificationProcessingResult> {
  const notification = parseAndVerifyMidtransNotification({
    rawBody: input.rawBody,
    serverKey: input.serverKey,
  });
  const eventId = createMidtransNotificationEventId(notification);
  const receivedStatus = mapMidtransStatus(notification.transaction_status);

  if (!isSupportedQrisStatus(receivedStatus)) {
    throw new QrisProcessingError(
      "UNSUPPORTED_STATUS",
      "Midtrans status is not supported by the QRIS processing slice",
    );
  }

  const now = input.now ?? new Date();

  return ports.transaction(async (repositories) => {
    const duplicate = await repositories.payments.findByProviderEventId({
      provider: "midtrans",
      providerEventId: eventId,
    });
    if (duplicate) {
      await appendAudit(repositories, {
        payment: duplicate,
        eventId,
        notification,
        action: "PAYMENT_NOTIFICATION_DUPLICATE",
        reason: "Verified provider event was already processed",
        receivedStatus,
      });
      return {
        kind: "DUPLICATE",
        eventId,
        paymentId: duplicate.id,
        orderId: duplicate.orderId,
        status: duplicate.status,
      };
    }

    const payment = await repositories.payments.findByProviderTransactionId({
      provider: "midtrans",
      providerTransactionId: notification.transaction_id,
    });
    if (!payment) {
      throw new QrisProcessingError(
        "PAYMENT_NOT_FOUND",
        "Payment was not found",
      );
    }

    if (payment.providerEventId === eventId) {
      await appendAudit(repositories, {
        payment,
        eventId,
        notification,
        action: "PAYMENT_NOTIFICATION_DUPLICATE",
        reason: "Verified provider event was already processed",
        receivedStatus,
      });
      return {
        kind: "DUPLICATE",
        eventId,
        paymentId: payment.id,
        orderId: payment.orderId,
        status: payment.status,
      };
    }

    const order = await repositories.orders.findById({
      tenantId: payment.tenantId,
      orderId: payment.orderId,
    });
    if (!order) {
      throw new QrisProcessingError("ORDER_NOT_FOUND", "Order was not found");
    }

    assertPaymentMatchesOrder(payment, order);
    assertQrisNotification({
      notification,
      expectedOrderId: order.orderNumber,
      expectedAmountMinor: payment.amountMinor,
    });

    if (!canApplyStatus(payment.status, receivedStatus)) {
      await appendAudit(repositories, {
        payment,
        eventId,
        notification,
        action: "PAYMENT_NOTIFICATION_OUT_OF_ORDER",
        reason: `Ignored ${receivedStatus} after ${payment.status}`,
        receivedStatus,
      });
      return {
        kind: "IGNORED_OUT_OF_ORDER",
        eventId,
        paymentId: payment.id,
        orderId: payment.orderId,
        currentStatus: payment.status,
        receivedStatus,
      };
    }

    if (receivedStatus === payment.status) {
      await repositories.payments.updateStatus({
        tenantId: payment.tenantId,
        paymentId: payment.id,
        status: payment.status,
        providerEventId: eventId,
        paidAt: null,
      });
      await appendAudit(repositories, {
        payment,
        eventId,
        notification,
        action: "PAYMENT_NOTIFICATION_APPLIED",
        reason: `Verified ${receivedStatus} event recorded`,
        receivedStatus,
      });
      return {
        kind: "APPLIED",
        eventId,
        paymentId: payment.id,
        orderId: payment.orderId,
        status: payment.status,
      };
    }

    if (receivedStatus === "PAID") {
      assertOrderCanBePaid(order);
    }

    const paidAt = receivedStatus === "PAID" ? now : null;
    await repositories.payments.updateStatus({
      tenantId: payment.tenantId,
      paymentId: payment.id,
      status: receivedStatus,
      providerEventId: eventId,
      paidAt,
    });

    if (receivedStatus === "PAID") {
      if (!isPaidOrderStatus(order.status)) {
        await repositories.orders.updateStatus({
          tenantId: payment.tenantId,
          orderId: payment.orderId,
          status: "PAID",
        });
      }
      await repositories.entitlements.grantForPaidOrder({
        tenantId: payment.tenantId,
        orderId: payment.orderId,
        startsAt: now,
      });
      await repositories.outbox.append({
        idempotencyKey: eventId,
        tenantId: payment.tenantId,
        eventType: "PaymentConfirmed",
        aggregateType: "Payment",
        aggregateId: payment.id,
        payload: {
          paymentId: payment.id,
          orderId: payment.orderId,
          provider: "midtrans",
          providerTransactionId: payment.providerTransactionId,
          providerEventId: eventId,
          status: "PAID",
          occurredAt: now.toISOString(),
        },
        payloadVersion: 1,
      });
    }

    await appendAudit(repositories, {
      payment,
      eventId,
      notification,
      action: "PAYMENT_NOTIFICATION_APPLIED",
      reason: `Verified ${receivedStatus} event applied`,
      receivedStatus,
    });

    return {
      kind: "APPLIED",
      eventId,
      paymentId: payment.id,
      orderId: payment.orderId,
      status: receivedStatus,
    };
  });
}

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

/** The audit actions the payment slice may record. */
export type QrisAuditAction =
  | "PAYMENT_NOTIFICATION_APPLIED"
  | "PAYMENT_NOTIFICATION_DUPLICATE"
  | "PAYMENT_NOTIFICATION_OUT_OF_ORDER"
  | "PAYMENT_STATUS_RECONCILED";

export interface QrisAuditRepository {
  append(input: {
    tenantId: string;
    actorType: "PROVIDER";
    action: QrisAuditAction;
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
  providerTransactionId: string;
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
    providerTransactionId: input.providerTransactionId,
    receivedStatus: input.receivedStatus,
  };
}

async function appendAudit(
  repositories: QrisNotificationRepositories,
  input: {
    payment: QrisPaymentRecord;
    eventId: string;
    providerTransactionId: string;
    action: QrisAuditAction;
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
      providerTransactionId: input.providerTransactionId,
      receivedStatus: input.receivedStatus,
    }),
    correlationId: input.eventId,
  });
}

/** Which server-to-server path observed the verified status. */
export type QrisVerifiedStatusSource = "WEBHOOK" | "RECONCILIATION";

export interface ApplyVerifiedPaymentStatusInput {
  readonly providerTransactionId: string;
  readonly receivedStatus: PaymentStatus;
  readonly eventId: string;
  readonly now: Date;
  readonly source: QrisVerifiedStatusSource;
  /**
   * Present only on the webhook path. When supplied, the signed notification is
   * re-checked against the stored order and amount inside the transaction.
   */
  readonly notification?: MidtransNotification;
}

function auditActionFor(
  source: QrisVerifiedStatusSource,
  outcome: "APPLIED" | "DUPLICATE" | "OUT_OF_ORDER",
): QrisAuditAction {
  if (source === "RECONCILIATION") return "PAYMENT_STATUS_RECONCILED";
  switch (outcome) {
    case "DUPLICATE":
      return "PAYMENT_NOTIFICATION_DUPLICATE";
    case "OUT_OF_ORDER":
      return "PAYMENT_NOTIFICATION_OUT_OF_ORDER";
    case "APPLIED":
      return "PAYMENT_NOTIFICATION_APPLIED";
  }
}

/**
 * Applies a provider-verified status to the payment, order, entitlement, outbox,
 * and audit records inside one transaction.
 *
 * Both the signed webhook and the provider status reconciliation call this, so a
 * status is applied at most once whichever server-to-server path observed it
 * first. The `source` only changes which audit action is recorded; the
 * money-moving behaviour is identical. The row lock taken by the payment lookup
 * and the `providerEventId` uniqueness constraint keep concurrent writers from
 * double-applying.
 */
export async function applyVerifiedPaymentStatus(
  repositories: QrisNotificationRepositories,
  input: ApplyVerifiedPaymentStatusInput,
): Promise<QrisNotificationProcessingResult> {
  const { eventId, providerTransactionId, receivedStatus, now, source } = input;

  const duplicate = await repositories.payments.findByProviderEventId({
    provider: "midtrans",
    providerEventId: eventId,
  });
  if (duplicate) {
    await appendAudit(repositories, {
      payment: duplicate,
      eventId,
      providerTransactionId,
      action: auditActionFor(source, "DUPLICATE"),
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
    providerTransactionId,
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
      providerTransactionId,
      action: auditActionFor(source, "DUPLICATE"),
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
  if (input.notification !== undefined) {
    assertQrisNotification({
      notification: input.notification,
      expectedOrderId: order.orderNumber,
      expectedAmountMinor: payment.amountMinor,
    });
  }

  if (!canApplyStatus(payment.status, receivedStatus)) {
    await appendAudit(repositories, {
      payment,
      eventId,
      providerTransactionId,
      action: auditActionFor(source, "OUT_OF_ORDER"),
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
      providerTransactionId,
      action: auditActionFor(source, "APPLIED"),
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
    providerTransactionId,
    action: auditActionFor(source, "APPLIED"),
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
}

/**
 * Applies a signed Midtrans notification.
 *
 * The body is verified against the server key before anything is read or
 * written, so an unauthenticated caller cannot move a payment. The verified
 * fields are then applied through {@link applyVerifiedPaymentStatus}.
 */
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

  return ports.transaction((repositories) =>
    applyVerifiedPaymentStatus(repositories, {
      providerTransactionId: notification.transaction_id,
      receivedStatus,
      eventId,
      now,
      source: "WEBHOOK",
      notification,
    }),
  );
}

/** The subset of the provider port that reconciliation needs. */
export interface QrisProviderStatusPort {
  getStatus(transactionId: string): Promise<PaymentStatus>;
}

export interface ReconcileQrisPaymentInput {
  readonly providerTransactionId: string;
  readonly now?: Date;
}

/**
 * Deterministic id for a reconciled status.
 *
 * Reconciliation has no signed notification, so the event id is derived from the
 * transaction and the observed status. Repeating the same reconciliation yields
 * the same id, which the duplicate guard and the outbox key both treat as a no-op.
 */
function reconciliationEventId(
  providerTransactionId: string,
  status: PaymentStatus,
): string {
  return `reconcile:${providerTransactionId}:${status}`;
}

/**
 * Reconciles a payment against the provider's status API.
 *
 * Used for delayed or missed notifications: the provider is asked for the
 * authoritative status of a transaction the application already recorded, and the
 * answer is applied through the same guarded path as a webhook. A payment that is
 * already terminal is left untouched by the duplicate/out-of-order guards, so a
 * repeat call cannot grant entitlements twice.
 */
export async function reconcileQrisPayment(
  input: ReconcileQrisPaymentInput,
  ports: {
    readonly notifications: QrisNotificationTransactionPort;
    readonly provider: QrisProviderStatusPort;
  },
): Promise<QrisNotificationProcessingResult> {
  const providerTransactionId = input.providerTransactionId.trim();
  if (providerTransactionId.length === 0) {
    throw new QrisProcessingError(
      "PAYMENT_NOT_FOUND",
      "A provider transaction id is required",
    );
  }

  const receivedStatus = await ports.provider.getStatus(providerTransactionId);
  if (!isSupportedQrisStatus(receivedStatus)) {
    throw new QrisProcessingError(
      "UNSUPPORTED_STATUS",
      "Provider status is not supported by the QRIS processing slice",
    );
  }

  const now = input.now ?? new Date();

  return ports.notifications.transaction((repositories) =>
    applyVerifiedPaymentStatus(repositories, {
      providerTransactionId,
      receivedStatus,
      eventId: reconciliationEventId(providerTransactionId, receivedStatus),
      now,
      source: "RECONCILIATION",
    }),
  );
}

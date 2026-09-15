import { Prisma, PrismaClient } from "@prisma/client";
import type {
  PaymentStatus,
  QrisAuditRepository,
  QrisEntitlementRepository,
  QrisNotificationRepositories,
  QrisNotificationTransactionPort,
  QrisOrderRecord,
  QrisOrderRepository,
  QrisOrderStatus,
  QrisOutboxRepository,
  QrisPaymentRecord,
  QrisPaymentRepository,
} from "@wedding/payments";
import { QrisProcessingError } from "@wedding/payments";
import { prisma } from "../client";

const paymentSelect = {
  id: true,
  tenantId: true,
  orderId: true,
  provider: true,
  providerTransactionId: true,
  providerEventId: true,
  method: true,
  amountMinor: true,
  currency: true,
  status: true,
} as const satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;

const orderSelect = {
  id: true,
  tenantId: true,
  orderNumber: true,
  currency: true,
  totalMinor: true,
  status: true,
} as const satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

const orderItemSelect = {
  id: true,
  productCode: true,
} as const satisfies Prisma.OrderItemSelect;

type QrisDatabaseClient = Pick<
  PrismaClient,
  | "$queryRaw"
  | "payment"
  | "order"
  | "orderItem"
  | "entitlement"
  | "outboxEvent"
  | "auditEvent"
>;

export class DatabaseRepositoryUnavailableError extends Error {
  public constructor() {
    super("The database repository is unavailable");
    this.name = "DatabaseRepositoryUnavailableError";
  }
}

class DatabaseRepositoryConsistencyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DatabaseRepositoryConsistencyError";
  }
}

function isQrisProcessingError(error: unknown): error is QrisProcessingError {
  return error instanceof QrisProcessingError;
}

async function databaseOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new DatabaseRepositoryUnavailableError();
  }
}

function toPaymentStatus(status: string): PaymentStatus {
  switch (status) {
    case "CREATED":
    case "PENDING":
    case "PAID":
    case "FAILED":
    case "EXPIRED":
      return status;
    case "REFUND_PENDING":
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "REFUNDED";
    default:
      throw new DatabaseRepositoryConsistencyError(
        "Unsupported payment status in database",
      );
  }
}

function toOrderStatus(status: string): QrisOrderStatus {
  switch (status) {
    case "DRAFT":
    case "PENDING_PAYMENT":
    case "PAID":
    case "FULFILLING":
    case "COMPLETED":
    case "CANCELLED":
    case "REFUNDED":
      return status;
    default:
      throw new DatabaseRepositoryConsistencyError(
        "Unsupported order status in database",
      );
  }
}

function toPaymentRecord(row: PaymentRow): QrisPaymentRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orderId: row.orderId,
    provider: row.provider,
    providerTransactionId: row.providerTransactionId,
    providerEventId: row.providerEventId,
    method: row.method,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: toPaymentStatus(row.status),
  };
}

function toOrderRecord(row: OrderRow): QrisOrderRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orderNumber: row.orderNumber,
    currency: row.currency,
    totalMinor: row.totalMinor,
    status: toOrderStatus(row.status),
  };
}

/**
 * The payment lookup is performed with a row lock. The lock serializes two
 * notifications for the same provider transaction before the event id is
 * written, while the provider event uniqueness constraint remains the final
 * idempotency guard.
 */
class PrismaQrisPaymentRepository implements QrisPaymentRepository {
  public constructor(private readonly client: QrisDatabaseClient) {}

  public async findByProviderTransactionId(input: {
    provider: "midtrans";
    providerTransactionId: string;
  }): Promise<QrisPaymentRecord | null> {
    const rows = await databaseOperation(() =>
      this.client.$queryRaw<PaymentRow[]>(Prisma.sql`
        SELECT
          "id",
          "tenantId",
          "orderId",
          "provider",
          "providerTransactionId",
          "providerEventId",
          "method",
          "amountMinor",
          "currency",
          "status"
        FROM "Payment"
        WHERE "provider" = ${input.provider}
          AND "providerTransactionId" = ${input.providerTransactionId}
        FOR UPDATE
      `),
    );

    const row = rows[0];
    return row === undefined ? null : toPaymentRecord(row);
  }

  public async findByProviderEventId(input: {
    provider: "midtrans";
    providerEventId: string;
  }): Promise<QrisPaymentRecord | null> {
    const row = await databaseOperation(() =>
      this.client.payment.findFirst({
        where: {
          provider: input.provider,
          providerEventId: input.providerEventId,
        },
        select: paymentSelect,
      }),
    );
    return row === null ? null : toPaymentRecord(row);
  }

  public async updateStatus(input: {
    tenantId: string;
    paymentId: string;
    status: PaymentStatus;
    providerEventId: string;
    paidAt: Date | null;
  }): Promise<void> {
    const result = await databaseOperation(() =>
      this.client.payment.updateMany({
        where: {
          id: input.paymentId,
          tenantId: input.tenantId,
          provider: "midtrans",
        },
        data: {
          status: input.status,
          providerEventId: input.providerEventId,
          paidAt: input.paidAt,
        },
      }),
    );
    if (result.count !== 1) {
      throw new DatabaseRepositoryConsistencyError(
        "Payment update did not affect exactly one row",
      );
    }
  }
}

class PrismaQrisOrderRepository implements QrisOrderRepository {
  public constructor(private readonly client: QrisDatabaseClient) {}

  public async findById(input: {
    tenantId: string;
    orderId: string;
  }): Promise<QrisOrderRecord | null> {
    const row = await databaseOperation(() =>
      this.client.order.findFirst({
        where: {
          id: input.orderId,
          tenantId: input.tenantId,
        },
        select: orderSelect,
      }),
    );
    return row === null ? null : toOrderRecord(row);
  }

  public async updateStatus(input: {
    tenantId: string;
    orderId: string;
    status: "PAID";
  }): Promise<void> {
    const result = await databaseOperation(() =>
      this.client.order.updateMany({
        where: { id: input.orderId, tenantId: input.tenantId },
        data: { status: input.status },
      }),
    );
    if (result.count !== 1) {
      throw new DatabaseRepositoryConsistencyError(
        "Order update did not affect exactly one row",
      );
    }
  }
}

class PrismaQrisEntitlementRepository implements QrisEntitlementRepository {
  public constructor(private readonly client: QrisDatabaseClient) {}

  public async grantForPaidOrder(input: {
    tenantId: string;
    orderId: string;
    startsAt: Date;
  }): Promise<void> {
    const items = await databaseOperation(() =>
      this.client.orderItem.findMany({
        where: { tenantId: input.tenantId, orderId: input.orderId },
        select: orderItemSelect,
      }),
    );

    for (const item of items) {
      const existing = await databaseOperation(() =>
        this.client.entitlement.findFirst({
          where: { tenantId: input.tenantId, orderItemId: item.id },
          select: { id: true },
        }),
      );
      if (existing !== null) continue;

      await databaseOperation(() =>
        this.client.entitlement.create({
          data: {
            tenantId: input.tenantId,
            orderItemId: item.id,
            productCode: item.productCode,
            status: "ACTIVE",
            startsAt: input.startsAt,
            limits: {},
          },
        }),
      );
    }
  }
}

class PrismaQrisOutboxRepository implements QrisOutboxRepository {
  public constructor(private readonly client: QrisDatabaseClient) {}

  public async append(input: {
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
  }): Promise<void> {
    const existing = await databaseOperation(() =>
      this.client.outboxEvent.findUnique({
        where: { id: input.idempotencyKey },
        select: { id: true },
      }),
    );
    if (existing !== null) return;

    await databaseOperation(() =>
      this.client.outboxEvent.create({
        data: {
          id: input.idempotencyKey,
          tenantId: input.tenantId,
          eventType: input.eventType,
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          payload: input.payload,
          payloadVersion: input.payloadVersion,
        },
      }),
    );
  }
}

class PrismaQrisAuditRepository implements QrisAuditRepository {
  public constructor(private readonly client: QrisDatabaseClient) {}

  public async append(input: {
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
  }): Promise<void> {
    await databaseOperation(() =>
      this.client.auditEvent.create({
        data: {
          tenantId: input.tenantId,
          actorType: input.actorType,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          reason: input.reason,
          metadata: input.metadata,
          correlationId: input.correlationId,
        },
      }),
    );
  }
}

function createRepositories(
  client: QrisDatabaseClient,
): QrisNotificationRepositories {
  return {
    payments: new PrismaQrisPaymentRepository(client),
    orders: new PrismaQrisOrderRepository(client),
    entitlements: new PrismaQrisEntitlementRepository(client),
    outbox: new PrismaQrisOutboxRepository(client),
    audit: new PrismaQrisAuditRepository(client),
  };
}

export class PrismaQrisNotificationTransaction implements QrisNotificationTransactionPort {
  public constructor(private readonly client: PrismaClient = prisma) {}

  public async transaction<T>(
    work: (repositories: QrisNotificationRepositories) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.client.$transaction(async (transactionClient) =>
        work(createRepositories(transactionClient)),
      );
    } catch (error) {
      if (
        error instanceof DatabaseRepositoryUnavailableError ||
        error instanceof DatabaseRepositoryConsistencyError ||
        isQrisProcessingError(error)
      ) {
        throw error;
      }
      throw new DatabaseRepositoryUnavailableError();
    }
  }
}

import { Prisma, type OrderStatus, type PaymentStatus } from "@prisma/client";
import { prisma } from "../client";

const orderPaymentSelect = {
  id: true,
  tenantId: true,
  userId: true,
  orderNumber: true,
  currency: true,
  subtotalMinor: true,
  discountMinor: true,
  taxMinor: true,
  totalMinor: true,
  status: true,
  items: {
    select: {
      productCode: true,
      descriptionSnapshot: true,
    },
    orderBy: { id: "asc" },
  },
  payments: {
    select: {
      provider: true,
      providerTransactionId: true,
      amountMinor: true,
      currency: true,
      method: true,
      status: true,
      paidAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  },
} as const satisfies Prisma.OrderSelect;

type OrderPaymentRow = Prisma.OrderGetPayload<{
  select: typeof orderPaymentSelect;
}>;

type OrderPaymentRepositoryClient = {
  order: {
    findFirst(args: {
      where: Prisma.OrderWhereInput;
      select: typeof orderPaymentSelect;
    }): Promise<OrderPaymentRow | null>;
  };
};

export type OrderPaymentScope = Readonly<{
  tenantId: string;
  userId: string;
  orderNumber: string;
}>;

export type OrderPaymentDto = Readonly<{
  id: string;
  tenantId: string;
  userId: string;
  orderNumber: string;
  currency: string;
  subtotalMinor: bigint;
  discountMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  status: OrderStatus;
  items: readonly Readonly<{
    productCode: string;
    descriptionSnapshot: string;
  }>[];
  payments: readonly Readonly<{
    provider: string;
    providerTransactionId: string;
    amountMinor: bigint;
    currency: string;
    method: string | null;
    status: PaymentStatus;
    paidAt: Date | null;
    updatedAt: Date;
  }>[];
}>;

export interface OrderPaymentRepository {
  findOwned(scope: OrderPaymentScope): Promise<OrderPaymentDto | null>;
}

function toDto(row: OrderPaymentRow): OrderPaymentDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    orderNumber: row.orderNumber,
    currency: row.currency,
    subtotalMinor: row.subtotalMinor,
    discountMinor: row.discountMinor,
    taxMinor: row.taxMinor,
    totalMinor: row.totalMinor,
    status: row.status,
    items: row.items.map((item) => ({
      productCode: item.productCode,
      descriptionSnapshot: item.descriptionSnapshot,
    })),
    payments: row.payments.map((payment) => ({
      provider: payment.provider,
      providerTransactionId: payment.providerTransactionId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      paidAt: payment.paidAt,
      updatedAt: payment.updatedAt,
    })),
  };
}

export class PrismaOrderPaymentRepository implements OrderPaymentRepository {
  public constructor(
    private readonly client: OrderPaymentRepositoryClient = prisma,
  ) {}

  public async findOwned(
    scope: OrderPaymentScope,
  ): Promise<OrderPaymentDto | null> {
    const row = await this.client.order.findFirst({
      where: {
        tenantId: scope.tenantId,
        userId: scope.userId,
        orderNumber: scope.orderNumber,
      },
      select: orderPaymentSelect,
    });
    return row === null ? null : toDto(row);
  }
}

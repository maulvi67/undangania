import { Prisma, type PrismaClient } from "@prisma/client";
import type { PaymentPort, PaymentStatus } from "@wedding/payments";
import { prisma } from "../client";

const paymentLookupSelect = {
  id: true,
  tenantId: true,
  provider: true,
  providerTransactionId: true,
} as const satisfies Prisma.PaymentSelect;

type PaymentLookupRow = Prisma.PaymentGetPayload<{
  select: typeof paymentLookupSelect;
}>;

type AdminPaymentLookupClient = Readonly<{
  payment: {
    findFirst(args: {
      where: Prisma.PaymentWhereInput;
      select: typeof paymentLookupSelect;
    }): Promise<PaymentLookupRow | null>;
  };
}>;

export function adaptAdminPaymentLookupClient(
  client: Pick<PrismaClient, "payment">,
): AdminPaymentLookupClient {
  return {
    payment: {
      findFirst: (args) => client.payment.findFirst(args),
    },
  };
}

export class AdminPaymentReconciliationUnavailableError extends Error {
  public constructor() {
    super("Payment reconciliation is unavailable");
    this.name = "AdminPaymentReconciliationUnavailableError";
  }
}

/**
 * Requests a provider-side status read without changing local payment state.
 * Verified webhooks remain the only authority that can transition Payment.
 */
export class PrismaAdminPaymentReconciliationRepository {
  public constructor(
    private readonly provider: Pick<PaymentPort, "getStatus">,
    private readonly client: AdminPaymentLookupClient = adaptAdminPaymentLookupClient(
      prisma,
    ),
  ) {}

  public async request(input: {
    tenantId: string;
    paymentId: string;
    correlationId: string;
    idempotencyKey: string;
  }): Promise<Readonly<{ requestId: string; providerStatus: PaymentStatus }>> {
    const payment = await this.client.payment.findFirst({
      where: { id: input.paymentId, tenantId: input.tenantId },
      select: paymentLookupSelect,
    });
    if (payment === null || payment.provider !== "midtrans") {
      throw new AdminPaymentReconciliationUnavailableError();
    }

    const providerStatus = await this.provider.getStatus(
      payment.providerTransactionId,
    );
    return {
      requestId: `midtrans-status:${payment.id}:${input.correlationId}`,
      providerStatus,
    };
  }
}

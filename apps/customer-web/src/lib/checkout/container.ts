import {
  CheckoutValidationError,
  PrismaCheckoutOrderRepository,
  PrismaCheckoutPaymentRepository,
  PrismaCheckoutPricingRepository,
  PrismaCheckoutPromotionRepository,
  adaptCheckoutClient,
  generateOrderNumber,
  parsePromotionRule,
  prisma,
  type CheckoutOrderDto,
  type CheckoutPaymentDto,
} from "@wedding/database";
import {
  ConflictError,
  InvalidInputError,
  NotFoundError,
  ProviderUnavailableError,
  UnavailableError,
  createCheckout,
  type CheckoutOrder,
  type CheckoutPayment,
  type CheckoutPorts,
} from "@wedding/application";
import {
  createMidtransQrisPaymentPortFromEnv,
  type MidtransQrisPaymentPort,
} from "@wedding/payments";
import { resolveSessionWorkspaceOrNull } from "../workspace/session-workspace";

/**
 * Composition root for checkout creation.
 *
 * This binds `createCheckout` in `@wedding/application` to the Prisma repositories
 * and the Midtrans QRIS port. The use-case owns the ordering rule that matters —
 * order first, provider charge second, payment row only once the provider has
 * returned a real transaction id — because the QRIS notification consumer matches a
 * payment by that id. A locally invented id could never be matched by any later
 * notification, so the order would be permanently unconfirmable.
 *
 * The returned `redirectUrl` is the provider's QR image. It is **not** payment
 * truth: the status page reads the payment row, which only a verified
 * server-to-server notification updates.
 */

/**
 * The application's `CheckoutPromotionPort` returns a promotion, not a
 * `CheckoutPromotionRepository` DTO, and the application contract forbids importing
 * the database's types. The adapter lives here so neither side adopts the other's
 * shape.
 */
function checkoutPorts(provider: CheckoutProviderPortLike): CheckoutPorts {
  // One adapted client, so the repositories share the delegate shape they were
  // built against rather than each reaching for the raw Prisma client.
  const client = adaptCheckoutClient(prisma);
  const pricing = new PrismaCheckoutPricingRepository(client);
  const promotions = new PrismaCheckoutPromotionRepository(client);
  const orders = new PrismaCheckoutOrderRepository(client);
  const payments = new PrismaCheckoutPaymentRepository(client);

  return {
    transactions: {
      createOrder: async (input) => {
        let created: CheckoutOrderDto;
        try {
          created = await orders.createOrder({
            scope: input.scope,
            orderNumber: input.orderNumber,
            currency: input.currency,
            subtotalMinor: input.subtotalMinor,
            discountMinor: input.discountMinor,
            taxMinor: input.taxMinor,
            totalMinor: input.totalMinor,
            ...(input.idempotencyKey === undefined
              ? {}
              : { idempotencyKey: input.idempotencyKey }),
            item: {
              productType: input.item.productType,
              productCode: input.item.productCode,
              descriptionSnapshot: input.item.descriptionSnapshot,
              unitPriceMinor: input.item.unitPriceMinor,
              quantity: input.item.quantity,
              totalMinor: input.item.totalMinor,
              // The application hands this over as `unknown`; storage needs a JSON
              // value, and the use-case already narrowed it to a plain object.
              configurationSnapshot: input.item.configurationSnapshot as never,
            },
          });
        } catch (error) {
          // The unique `[tenantId, checkoutIdempotencyKey]` index is what stops
          // two concurrent retries from charging twice. The loser of the race
          // reports "in progress" instead of minting another order.
          if (isUniqueConstraintError(error)) {
            throw new ConflictError(
              "Pembayaran sedang diproses. Periksa status pesanan sebelum mencoba lagi.",
            );
          }
          throw error;
        }
        return toCheckoutOrder(created);
      },
      attachPayment: async (input) => {
        const payment = await payments.attachPayment({
          scope: input.scope,
          orderId: input.orderId,
          provider: input.provider,
          providerTransactionId: input.providerTransactionId,
          method: input.method,
          amountMinor: input.amountMinor,
          currency: input.currency,
          ...(input.expiresAt === undefined
            ? {}
            : { expiresAt: input.expiresAt }),
          ...(input.promotionId === undefined
            ? {}
            : { promotionId: input.promotionId }),
          ...(input.redirectUrl === undefined
            ? {}
            : { redirectUrl: input.redirectUrl }),
        });
        return payment === null ? null : toCheckoutPayment(payment);
      },
      findByOrderId: async (scope, orderId) => {
        const payment = await payments.findByOrderId(scope, orderId);
        return payment === null ? null : toCheckoutPayment(payment);
      },
      findByIdempotencyKey: async (scope, idempotencyKey) => {
        const order = await orders.findByIdempotencyKey(scope, idempotencyKey);
        if (order === null) return null;
        const payment = await payments.findByOrderId(scope, order.id);
        return {
          order: toCheckoutOrder(order),
          payment: payment === null ? null : toCheckoutPayment(payment),
        };
      },
    },
    pricing: {
      findPackagePrice: (input) => pricing.findPackagePrice(input),
    },
    promotions: {
      findRedeemable: async (input) => {
        const promotion = await promotions.findRedeemable(input);
        if (promotion === null) return null;
        return {
          id: promotion.id,
          code: promotion.code,
          rule: {
            percentBasisPoints: promotion.rule.percentBasisPoints,
            flatAmountMinor: promotion.rule.flatAmountMinor,
            maxDiscountMinor: promotion.rule.maxDiscountMinor,
          },
        };
      },
    },
    provider,
    nextOrderNumber: generateOrderNumber,
  };
}

/** The subset of `CheckoutProviderPort` this module actually needs. */
type CheckoutProviderPortLike = CheckoutPorts["provider"];

function toCheckoutOrder(order: CheckoutOrderDto): CheckoutOrder {
  return {
    id: order.id,
    tenantId: order.tenantId,
    userId: order.userId,
    orderNumber: order.orderNumber,
    currency: order.currency,
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    taxMinor: order.taxMinor,
    totalMinor: order.totalMinor,
    status: order.status,
    items: order.items.map((item) => ({
      id: item.id,
      productCode: item.productCode,
      descriptionSnapshot: item.descriptionSnapshot,
      unitPriceMinor: item.unitPriceMinor,
      quantity: item.quantity,
      totalMinor: item.totalMinor,
      promotionCode: item.promotionCode,
    })),
  };
}

function toCheckoutPayment(payment: CheckoutPaymentDto): CheckoutPayment {
  return {
    id: payment.id,
    tenantId: payment.tenantId,
    orderId: payment.orderId,
    provider: payment.provider,
    providerTransactionId: payment.providerTransactionId,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    method: payment.method ?? "QRIS",
    status: payment.status,
    expiresAt: payment.expiresAt,
    redirectUrl: payment.redirectUrl,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as Readonly<{ code?: unknown }>).code === "P2002"
  );
}

export type CheckoutCreationOutcome =
  | Readonly<{
      kind: "created";
      orderNumber: string;
      redirectUrl: string;
      totalMinor: string;
    }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "invalid"; message: string }>
  | Readonly<{ kind: "provider-unavailable"; orderNumber: string | null }>
  | Readonly<{ kind: "duplicate" }>
  | Readonly<{ kind: "unavailable" }>;

/** Resolves the QRIS port, or null when this deployment is not configured for it. */
export function checkoutProvider(): MidtransQrisPaymentPort | null {
  return createMidtransQrisPaymentPortFromEnv(process.env);
}

export async function createCheckoutForSession(input: {
  productCode: string;
  quantity: number;
  promotionCode?: string;
  idempotencyKey: string;
}): Promise<CheckoutCreationOutcome> {
  const workspace = await resolveSessionWorkspaceOrNull();
  if (workspace === null) return { kind: "unauthenticated" };

  const provider = checkoutProvider();
  if (provider === null) {
    // No server key means no charge can be created. Failing closed here is what
    // keeps a misconfigured deployment from looking like a provider outage.
    return { kind: "provider-unavailable", orderNumber: null };
  }

  try {
    const result = await createCheckout(
      workspace.context,
      {
        productCode: input.productCode,
        quantity: input.quantity,
        currency: "IDR",
        idempotencyKey: input.idempotencyKey,
        ...(input.promotionCode === undefined
          ? {}
          : { promotionCode: input.promotionCode }),
      },
      checkoutPorts(provider),
      new Date(),
    );

    return {
      kind: "created",
      orderNumber: result.order.orderNumber,
      redirectUrl: result.redirectUrl,
      totalMinor: result.payment.amountMinor.toString(),
    };
  } catch (error) {
    if (error instanceof NotFoundError) return { kind: "not-found" };
    if (error instanceof InvalidInputError) {
      return { kind: "invalid", message: error.message };
    }
    if (error instanceof ProviderUnavailableError) {
      // The order exists but has no payment row, which is recoverable: the couple
      // can retry and reconciliation can find the provider's record.
      return { kind: "provider-unavailable", orderNumber: null };
    }
    if (error instanceof UnavailableError) return { kind: "unavailable" };
    if (error instanceof ConflictError) return { kind: "duplicate" };
    if (error instanceof CheckoutValidationError) {
      return { kind: "not-found" };
    }
    return { kind: "unavailable" };
  }
}

/** Re-exported so callers can validate a promotion code against the same parser. */
export { parsePromotionRule };

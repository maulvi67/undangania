import type { TenantContext } from "@wedding/domain";
import {
  ConflictError,
  EntitlementLimitReachedError,
  InvalidInputError,
  NotFoundError,
  ProviderUnavailableError,
  UnavailableError,
  assertAnyRole,
  FINANCE_ROLES,
  requireTenantContext,
} from "./use-case-support";

/**
 * Checkout creation use-case.
 *
 * The order is created before the provider is charged, and the payment is
 * recorded only after the provider returns a real transaction id. That ordering
 * is the whole design: the QRIS notification consumer resolves a payment by the
 * provider's `transaction_id`, so a `Payment` row carrying a locally invented id
 * could never be matched by any later notification and the order would be
 * permanently unconfirmable.
 *
 * A charge that succeeds but is never persisted is recoverable by reconciling
 * against the provider. A fabricated transaction id is not.
 *
 * All ports are declared structurally; this package does not depend on
 * `@wedding/database`.
 */

export type CheckoutScope = Readonly<{
  tenantId: string;
  userId: string;
  weddingId?: string | null;
}>;

export type CheckoutOrder = Readonly<{
  id: string;
  tenantId: string;
  userId: string;
  orderNumber: string;
  currency: string;
  subtotalMinor: bigint;
  discountMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  status: string;
  items: readonly Readonly<{
    id: string;
    productCode: string;
    descriptionSnapshot: string;
    unitPriceMinor: bigint;
    quantity: number;
    totalMinor: bigint;
    /** Promotion snapshot used to prove a replay matches the original request. */
    promotionCode: string | null;
  }>[];
}>;

export type CheckoutPayment = Readonly<{
  id: string;
  tenantId: string;
  orderId: string;
  provider: string;
  providerTransactionId: string;
  amountMinor: bigint;
  currency: string;
  method: string;
  status: string;
  expiresAt: Date | null;
  /** Provider-hosted page, present once the charge succeeded. */
  redirectUrl: string | null;
}>;

export type CheckoutPromotionRule = Readonly<{
  percentBasisPoints: number | null;
  flatAmountMinor: bigint | null;
  maxDiscountMinor: bigint | null;
}>;

export type CheckoutPromotion = Readonly<{
  id: string;
  code: string;
  rule: CheckoutPromotionRule;
}>;

/** Port: order and payment persistence. */
export interface CheckoutTransactionPort {
  createOrder(input: {
    scope: CheckoutScope;
    orderNumber: string;
    currency: string;
    subtotalMinor: bigint;
    discountMinor: bigint;
    taxMinor: bigint;
    totalMinor: bigint;
    /** Present when the caller supplied an attempt token for deduplication. */
    idempotencyKey?: string;
    item: Readonly<{
      productType: string;
      productCode: string;
      descriptionSnapshot: string;
      unitPriceMinor: bigint;
      quantity: number;
      totalMinor: bigint;
      configurationSnapshot: unknown;
    }>;
  }): Promise<CheckoutOrder>;
  attachPayment(input: {
    scope: CheckoutScope;
    orderId: string;
    provider: string;
    providerTransactionId: string;
    method: string;
    amountMinor: bigint;
    currency: string;
    expiresAt?: Date | null;
    promotionId?: string;
    redirectUrl?: string | null;
  }): Promise<CheckoutPayment | null>;
  findByOrderId(
    scope: CheckoutScope,
    orderId: string,
  ): Promise<CheckoutPayment | null>;
  /**
   * Finds the order already created for a checkout attempt token. Returns the
   * payment when the earlier attempt reached the provider, so a retry can answer
   * with the same order instead of charging again.
   */
  findByIdempotencyKey(
    scope: CheckoutScope,
    idempotencyKey: string,
  ): Promise<Readonly<{
    order: CheckoutOrder;
    payment: CheckoutPayment | null;
  }> | null>;
}

/** Port: catalog pricing. */
export interface CheckoutPricingPort {
  findPackagePrice(input: {
    productCode: string;
    currency: string;
    at: Date;
  }): Promise<bigint | null>;
}

/** Port: promotion validation. */
export interface CheckoutPromotionPort {
  findRedeemable(input: {
    code: string;
    tenantId: string;
    at: Date;
  }): Promise<CheckoutPromotion | null>;
}

/** Port: the payment provider charge. */
export interface CheckoutProviderPort {
  create(input: {
    orderId: string;
    amountMinor: bigint;
    currency: "IDR";
  }): Promise<{ providerTransactionId: string; redirectUrl: string }>;
}

export type CheckoutPorts = Readonly<{
  transactions: CheckoutTransactionPort;
  pricing: CheckoutPricingPort;
  promotions: CheckoutPromotionPort;
  provider: CheckoutProviderPort;
  /** Generates a globally unique order number. Injected so it stays testable. */
  nextOrderNumber: () => string;
  /** Tax policy. Returns minor units; the default is zero-rated. */
  computeTaxMinor?: (input: {
    subtotalMinor: bigint;
    discountMinor: bigint;
  }) => bigint;
}>;

export type CreateCheckoutInput = Readonly<{
  productCode: string;
  quantity: number;
  currency: string;
  promotionCode?: string;
  locale?: "id" | "en";
  /**
   * Client attempt token. Required in practice for the customer-web checkout:
   * it makes a retried or concurrent request land on the same order instead of
   * creating a second one and charging twice.
   */
  idempotencyKey?: string;
}>;

export type CreateCheckoutResult = Readonly<{
  order: CheckoutOrder;
  payment: CheckoutPayment;
  redirectUrl: string;
}>;

const MAX_QUANTITY = 100;
const DEFAULT_CURRENCY = "IDR";
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

/**
 * Applies a promotion rule to a subtotal. Clamped so a malformed rule can never
 * produce a negative total, and never discounts below zero.
 */
export function applyPromotionRule(
  rule: CheckoutPromotionRule,
  subtotalMinor: bigint,
): bigint {
  if (subtotalMinor <= 0n) return 0n;

  const raw =
    rule.flatAmountMinor !== null
      ? rule.flatAmountMinor
      : BigInt(
          Math.floor(
            (Number(subtotalMinor) * (rule.percentBasisPoints ?? 0)) / 10_000,
          ),
        );

  const capped =
    rule.maxDiscountMinor !== null && raw > rule.maxDiscountMinor
      ? rule.maxDiscountMinor
      : raw;

  if (capped <= 0n) return 0n;
  return capped > subtotalMinor ? subtotalMinor : capped;
}

/**
 * Creates an order, charges the provider, then records the provider's
 * transaction id.
 *
 * Ordering note: if the charge succeeds and the subsequent write fails, the
 * customer may have been charged for an order with no payment row. That is
 * deliberately preferred over the reverse, because the provider's record is
 * authoritative and reconciliation can recover it — whereas a locally generated
 * transaction id could never be matched to a notification at all.
 */
export async function createCheckout(
  context: TenantContext | null | undefined,
  input: CreateCheckoutInput,
  ports: CheckoutPorts,
  now: Date,
): Promise<CreateCheckoutResult> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, FINANCE_ROLES);

  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new InvalidInputError("Kuantitas harus minimal 1.");
  }
  if (input.quantity > MAX_QUANTITY) {
    throw new InvalidInputError(
      `Kuantitas tidak boleh lebih dari ${MAX_QUANTITY}.`,
    );
  }
  if (input.productCode.trim().length === 0) {
    throw new InvalidInputError("Paket tidak dikenali.");
  }

  const currency = input.currency.trim().toUpperCase() || DEFAULT_CURRENCY;
  const scope: CheckoutScope = {
    tenantId: tenant.tenantId,
    userId: tenant.actorId,
  };

  const rawIdempotencyKey = input.idempotencyKey?.trim();
  const idempotencyKey =
    rawIdempotencyKey === undefined || rawIdempotencyKey === ""
      ? undefined
      : rawIdempotencyKey;
  if (
    idempotencyKey !== undefined &&
    !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
  ) {
    throw new InvalidInputError("Token pembayaran tidak valid.");
  }

  if (idempotencyKey !== undefined) {
    const replay = await ports.transactions.findByIdempotencyKey(
      scope,
      idempotencyKey,
    );
    if (replay !== null) {
      const item = replay.order.items[0];
      const requestedPromotion =
        input.promotionCode === undefined || input.promotionCode.trim() === ""
          ? null
          : input.promotionCode.trim().toUpperCase();
      if (
        item === undefined ||
        item.productCode !== input.productCode ||
        item.quantity !== input.quantity ||
        item.promotionCode !== requestedPromotion ||
        replay.order.currency !== currency
      ) {
        throw new ConflictError(
          "Permintaan pembayaran berbeda dari pesanan sebelumnya.",
        );
      }
      if (replay.payment === null || replay.payment.redirectUrl === null) {
        // The first attempt created the order but never captured a charge. Do not
        // mint a second order under the same token; the caller may start a fresh
        // attempt with a new token.
        throw new UnavailableError(
          "Pembayaran sebelumnya belum selesai. Silakan periksa status pesanan.",
        );
      }
      return {
        order: replay.order,
        payment: replay.payment,
        redirectUrl: replay.payment.redirectUrl,
      };
    }
  }

  const unitPriceMinor = await ports.pricing.findPackagePrice({
    productCode: input.productCode,
    currency,
    at: now,
  });
  if (unitPriceMinor === null) {
    // Either the package does not exist, is not sellable, or has no active
    // price. All three are the same answer to the caller.
    throw new NotFoundError("Paket tidak tersedia untuk dibeli.");
  }

  const subtotalMinor = unitPriceMinor * BigInt(input.quantity);

  let promotion: CheckoutPromotion | null = null;
  if (input.promotionCode !== undefined && input.promotionCode.trim() !== "") {
    promotion = await ports.promotions.findRedeemable({
      code: input.promotionCode.trim().toUpperCase(),
      tenantId: tenant.tenantId,
      at: now,
    });
    if (promotion === null) {
      throw new InvalidInputError("Kode promo tidak berlaku.");
    }
  }

  const discountMinor =
    promotion === null ? 0n : applyPromotionRule(promotion.rule, subtotalMinor);
  const taxMinor =
    ports.computeTaxMinor === undefined
      ? 0n
      : ports.computeTaxMinor({ subtotalMinor, discountMinor });
  const totalMinor = subtotalMinor - discountMinor + taxMinor;
  if (totalMinor <= 0n) {
    throw new ConflictError("Total pembayaran tidak valid.");
  }

  const order = await ports.transactions.createOrder({
    scope,
    orderNumber: ports.nextOrderNumber(),
    currency,
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor,
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    item: {
      productType: "PACKAGE",
      productCode: input.productCode,
      descriptionSnapshot: `Paket ${input.productCode} x${input.quantity}`,
      unitPriceMinor,
      quantity: input.quantity,
      totalMinor: subtotalMinor,
      configurationSnapshot: {
        productCode: input.productCode,
        quantity: input.quantity,
        ...(promotion === null ? {} : { promotionCode: promotion.code }),
      },
    },
  });

  let charge: { providerTransactionId: string; redirectUrl: string };
  try {
    charge = await ports.provider.create({
      orderId: order.id,
      amountMinor: totalMinor,
      currency: "IDR",
    });
  } catch {
    // The order stays PENDING_PAYMENT with no payment row. That is an accurate
    // description of reality and is recoverable; inventing a transaction id to
    // "complete" the checkout would not be.
    throw new ProviderUnavailableError(
      "Pembayaran tidak dapat dimulai. Silakan coba lagi.",
    );
  }

  const payment = await ports.transactions.attachPayment({
    scope,
    orderId: order.id,
    provider: "midtrans",
    providerTransactionId: charge.providerTransactionId,
    method: "QRIS",
    amountMinor: totalMinor,
    currency,
    redirectUrl: charge.redirectUrl,
    ...(promotion === null ? {} : { promotionId: promotion.id }),
  });
  if (payment === null) {
    // The order vanished between creation and payment, which should not be
    // reachable; surface it instead of returning a checkout that cannot be paid.
    throw new UnavailableError("Pesanan tidak dapat dilanjutkan.");
  }

  return { order, payment, redirectUrl: charge.redirectUrl };
}

/**
 * Reads the existing payment for an order, so a retry cannot charge twice. The
 * caller checks this before calling `createCheckout` again.
 */
export async function findCheckoutPayment(
  context: TenantContext | null | undefined,
  orderId: string,
  ports: Pick<CheckoutPorts, "transactions">,
): Promise<CheckoutPayment | null> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, FINANCE_ROLES);
  if (orderId.trim().length === 0)
    throw new InvalidInputError("Pesanan tidak dikenali.");

  return ports.transactions.findByOrderId(
    { tenantId: tenant.tenantId, userId: tenant.actorId },
    orderId,
  );
}

export { EntitlementLimitReachedError };

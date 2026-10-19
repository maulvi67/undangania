import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";
import { generateOpaqueToken } from "../tokens";

/**
 * Checkout creation persistence.
 *
 * Ordering matters. The QRIS notification consumer resolves a payment by the
 * provider's `transaction_id` and refuses to continue when no row matches, so
 * the `Payment` row must carry the *real* provider transaction id — never a
 * local placeholder that no later webhook could ever match. Creation is
 * therefore two phases:
 *
 *   1. `createOrder` persists the order and its line items so the intent is
 *      durable before any money is asked for.
 *   2. The caller charges the provider.
 *   3. `attachPayment` records the provider's transaction id.
 *
 * A charge that succeeds but is never persisted is recoverable through
 * reconciliation; a fabricated transaction id would not be.
 *
 * Single-row lookups use `findFirst` rather than `findUnique` because the
 * uniqueness of `Package.code` / `Promotion.code` is a schema concern while the
 * `where` clause is what carries tenant scope. It also matches the delegate
 * shape used by the other repositories in this package.
 */

const SELLABLE_PACKAGE_STATUS = "ACTIVE";
const REDEEMABLE_PROMOTION_STATUS = "ACTIVE";

const ORDER_NUMBER_PREFIX = "WS-";
const ORDER_NUMBER_RANDOM_LENGTH = 10;

export const ORDER_NUMBER_PATTERN = /^WS-[A-Z0-9]{8,32}$/;

const createdOrderSelect = {
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
      id: true,
      productCode: true,
      descriptionSnapshot: true,
      unitPriceMinor: true,
      quantity: true,
      totalMinor: true,
      configurationSnapshot: true,
    },
    orderBy: { id: "asc" },
  },
} as const satisfies Prisma.OrderSelect;

type CreatedOrderRow = Prisma.OrderGetPayload<{
  select: typeof createdOrderSelect;
}>;

const packagePriceSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  prices: {
    select: {
      currency: true,
      amountMinor: true,
      activeFrom: true,
      activeUntil: true,
    },
    orderBy: { activeFrom: "desc" },
  },
} as const satisfies Prisma.PackageSelect;

type PackagePriceRow = Prisma.PackageGetPayload<{
  select: typeof packagePriceSelect;
}>;

const promotionSelect = {
  id: true,
  code: true,
  status: true,
  startsAt: true,
  endsAt: true,
  usageLimit: true,
  configuration: true,
  _count: { select: { redemptions: true } },
} as const satisfies Prisma.PromotionSelect;

type PromotionRow = Prisma.PromotionGetPayload<{
  select: typeof promotionSelect;
}>;

const paymentSelect = {
  id: true,
  tenantId: true,
  orderId: true,
  provider: true,
  providerTransactionId: true,
  amountMinor: true,
  currency: true,
  method: true,
  status: true,
  expiresAt: true,
  redirectUrl: true,
} as const satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;

/**
 * Structural delegates, deliberately narrow so tests can inject plain objects.
 * A real Prisma client is adapted to this shape by `adaptCheckoutClient` rather
 * than forced in with a cast: Prisma's delegate methods are generic over
 * `SelectSubset`, so comparing them to a concrete signature is not sound.
 */
type CheckoutPackageClient = Readonly<{
  package: {
    findFirst(args: {
      where: Prisma.PackageWhereInput;
      select: typeof packagePriceSelect;
    }): Promise<PackagePriceRow | null>;
  };
}>;

type CheckoutPromotionClient = Readonly<{
  promotion: {
    findFirst(args: {
      where: Prisma.PromotionWhereInput;
      select: typeof promotionSelect;
    }): Promise<PromotionRow | null>;
  };
}>;

type CheckoutOrderClient = Readonly<{
  order: {
    create(args: {
      data: Prisma.OrderUncheckedCreateInput;
      select: typeof createdOrderSelect;
    }): Promise<CreatedOrderRow>;
    findFirst(args: {
      where: Prisma.OrderWhereInput;
      select: typeof createdOrderSelect;
    }): Promise<CreatedOrderRow | null>;
  };
  orderItem: {
    create(args: {
      data: Prisma.OrderItemUncheckedCreateInput;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
}>;

/**
 * `Payment` carries `tenantId` but no tenant relation, so ownership is always
 * proven through the order. Payment writes therefore need the order lookup
 * only — requiring the full order delegate here would force every payment
 * caller (and test fake) to also supply `order.create`/`orderItem.create`.
 */
type CheckoutOrderOwnershipClient = Readonly<{
  order: {
    findFirst(args: {
      where: Prisma.OrderWhereInput;
      select: typeof createdOrderSelect;
    }): Promise<CreatedOrderRow | null>;
  };
}>;

type CheckoutPaymentWriteClient = Readonly<{
  order: CheckoutOrderOwnershipClient["order"];
  payment: {
    create(args: {
      data: Prisma.PaymentUncheckedCreateInput;
      select: typeof paymentSelect;
    }): Promise<PaymentRow>;
    findFirst(args: {
      where: Prisma.PaymentWhereInput;
      select: typeof paymentSelect;
    }): Promise<PaymentRow | null>;
  };
  promotionRedemption: {
    create(args: {
      data: Prisma.PromotionRedemptionUncheckedCreateInput;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
}>;

type CheckoutTransactionClient = CheckoutPackageClient &
  CheckoutPromotionClient &
  CheckoutOrderClient &
  CheckoutPaymentWriteClient;

/**
 * Adapts a real Prisma client (or transaction client) to the narrow structural
 * shape above. Each method is passed through in a lambda so the generic
 * delegate signature is checked against concrete arguments instead of being
 * compared structurally, which is what makes the narrow shape usable at all.
 */
export function adaptCheckoutClient(
  client: Pick<
    PrismaClient,
    | "package"
    | "promotion"
    | "order"
    | "orderItem"
    | "payment"
    | "promotionRedemption"
  >,
): CheckoutTransactionClient {
  return {
    package: { findFirst: (args) => client.package.findFirst(args) },
    promotion: { findFirst: (args) => client.promotion.findFirst(args) },
    order: {
      create: (args) => client.order.create(args),
      findFirst: (args) => client.order.findFirst(args),
    },
    orderItem: { create: (args) => client.orderItem.create(args) },
    payment: {
      create: (args) => client.payment.create(args),
      findFirst: (args) => client.payment.findFirst(args),
    },
    promotionRedemption: {
      create: (args) => client.promotionRedemption.create(args),
    },
  };
}

export type CheckoutScope = Readonly<{
  tenantId: string;
  userId: string;
  weddingId?: string | null;
}>;

export type CheckoutPromotionRule = Readonly<{
  /** Percentage in basis points (100 = 1%), or null for a flat discount. */
  percentBasisPoints: number | null;
  flatAmountMinor: bigint | null;
  maxDiscountMinor: bigint | null;
}>;

export type CheckoutPromotionDto = Readonly<{
  id: string;
  code: string;
  rule: CheckoutPromotionRule;
}>;

export type CheckoutOrderItemDto = Readonly<{
  id: string;
  productCode: string;
  descriptionSnapshot: string;
  unitPriceMinor: bigint;
  quantity: number;
  totalMinor: bigint;
  promotionCode: string | null;
}>;

export type CheckoutOrderDto = Readonly<{
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
  items: readonly CheckoutOrderItemDto[];
}>;

export type CheckoutPaymentDto = Readonly<{
  id: string;
  tenantId: string;
  orderId: string;
  provider: string;
  providerTransactionId: string;
  amountMinor: bigint;
  currency: string;
  method: string | null;
  status: string;
  expiresAt: Date | null;
  redirectUrl: string | null;
}>;

export type CheckoutValidationCode =
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_UNAVAILABLE"
  | "PRICE_NOT_FOUND"
  | "PROMOTION_NOT_FOUND";

export class CheckoutValidationError extends Error {
  public constructor(
    public readonly code: CheckoutValidationCode,
    message: string,
  ) {
    super(message);
    this.name = "CheckoutValidationError";
  }
}

export interface CheckoutPricingRepository {
  findPackagePrice(input: {
    productCode: string;
    currency: string;
    /** Caller-supplied clock; never taken from the request body. */
    at: Date;
  }): Promise<bigint | null>;
}

export interface CheckoutPromotionRepository {
  /**
   * Returns the promotion only when it is currently redeemable. An expired,
   * not-yet-started, disabled, or exhausted code is indistinguishable from an
   * unknown one, so callers cannot probe code state.
   */
  findRedeemable(input: {
    code: string;
    at: Date;
  }): Promise<CheckoutPromotionDto | null>;
}

export interface CheckoutOrderRepository {
  /** Reserves a unique order number; `orderNumber` is globally unique. */
  nextOrderNumber(): string;
  createOrder(input: {
    scope: CheckoutScope;
    orderNumber: string;
    currency: string;
    subtotalMinor: bigint;
    discountMinor: bigint;
    taxMinor: bigint;
    totalMinor: bigint;
    idempotencyKey?: string;
    item: Readonly<{
      productType: string;
      productCode: string;
      descriptionSnapshot: string;
      unitPriceMinor: bigint;
      quantity: number;
      totalMinor: bigint;
      configurationSnapshot: Prisma.InputJsonValue;
    }>;
  }): Promise<CheckoutOrderDto>;
  findOrder(
    scope: CheckoutScope,
    orderId: string,
  ): Promise<CheckoutOrderDto | null>;
  /** Finds the order minted for a checkout attempt token, scoped to its owner. */
  findByIdempotencyKey(
    scope: CheckoutScope,
    idempotencyKey: string,
  ): Promise<CheckoutOrderDto | null>;
}

export interface CheckoutPaymentRepository {
  /**
   * Persists the provider's transaction id against the order. Returns `null`
   * when the order is not owned by the scope, so a cross-tenant write becomes a
   * not-found rather than a silent success.
   */
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
  }): Promise<CheckoutPaymentDto | null>;
  /** Existing payment for an order, so a retry cannot charge twice. */
  findByOrderId(
    scope: CheckoutScope,
    orderId: string,
  ): Promise<CheckoutPaymentDto | null>;
}

export type CheckoutRepositories = Readonly<{
  orders: CheckoutOrderRepository;
  payments: CheckoutPaymentRepository;
  promotions: CheckoutPromotionRepository;
  pricing: CheckoutPricingRepository;
}>;

export type CheckoutTransactionPort = Readonly<{
  transaction<T>(
    work: (repositories: CheckoutRepositories) => Promise<T>,
  ): Promise<T>;
}>;

/**
 * Random suffix keeps order numbers unguessable. `Order.orderNumber` is
 * globally unique, so a collision surfaces as a unique-constraint failure the
 * caller may retry rather than as a customer-visible error.
 */
export function generateOrderNumber(): string {
  const random = generateOpaqueToken()
    .value.replaceAll(/[^A-Za-z0-9]/g, "")
    .slice(0, ORDER_NUMBER_RANDOM_LENGTH)
    .toUpperCase();
  return `${ORDER_NUMBER_PREFIX}${random}`;
}

export function isOrderNumber(value: string): boolean {
  return ORDER_NUMBER_PATTERN.test(value);
}

/**
 * Active-window check for a dated price. Extracted so the boundary rules are
 * covered without a database: a price becomes sellable at `activeFrom` and
 * stops being sellable at `activeUntil`.
 */
export function isPriceActive(
  price: Readonly<{ activeFrom: Date; activeUntil: Date | null }>,
  at: Date,
): boolean {
  if (price.activeFrom.getTime() > at.getTime()) return false;
  return (
    price.activeUntil === null || price.activeUntil.getTime() > at.getTime()
  );
}

export function selectActivePrice(
  prices: readonly Readonly<{
    currency: string;
    amountMinor: bigint;
    activeFrom: Date;
    activeUntil: Date | null;
  }>[],
  input: Readonly<{ currency: string; at: Date }>,
): bigint | null {
  const price = prices.find(
    (candidate) =>
      candidate.currency === input.currency &&
      isPriceActive(candidate, input.at),
  );
  return price?.amountMinor ?? null;
}

function toCheckoutOrderDto(row: CreatedOrderRow): CheckoutOrderDto {
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
      id: item.id,
      productCode: item.productCode,
      descriptionSnapshot: item.descriptionSnapshot,
      unitPriceMinor: item.unitPriceMinor,
      quantity: item.quantity,
      totalMinor: item.totalMinor,
      promotionCode: promotionCodeFromSnapshot(item.configurationSnapshot),
    })),
  };
}

function promotionCodeFromSnapshot(snapshot: unknown): string | null {
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot)
  ) {
    return null;
  }
  const code = (snapshot as Record<string, unknown>).promotionCode;
  return typeof code === "string" && code.length > 0 ? code : null;
}

function toCheckoutPaymentDto(row: PaymentRow): CheckoutPaymentDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orderId: row.orderId,
    provider: row.provider,
    providerTransactionId: row.providerTransactionId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    method: row.method,
    status: row.status,
    expiresAt: row.expiresAt,
    redirectUrl: row.redirectUrl,
  };
}

function readBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Promotion `configuration` is opaque JSON owned by the pricing domain. This
 * reads only the two supported discount shapes and returns `null` for anything
 * it does not understand, so an unparseable rule can never silently discount.
 */
export function parsePromotionRule(
  configuration: Prisma.JsonValue,
): CheckoutPromotionRule | null {
  if (
    configuration === null ||
    typeof configuration !== "object" ||
    Array.isArray(configuration)
  ) {
    return null;
  }

  const record = configuration as Record<string, unknown>;
  const flatAmountMinor = readBigInt(
    record.flatAmountMinor ?? record.discountMinor,
  );
  const percentBasisPoints =
    flatAmountMinor === null
      ? readNumber(record.percentBasisPoints ?? record.percent)
      : null;
  const maxDiscountMinor = readBigInt(record.maxDiscountMinor);

  if (flatAmountMinor === null && percentBasisPoints === null) return null;
  if (flatAmountMinor !== null && flatAmountMinor < 0n) return null;
  if (
    percentBasisPoints !== null &&
    (percentBasisPoints <= 0 || percentBasisPoints > 10_000)
  ) {
    return null;
  }
  if (maxDiscountMinor !== null && maxDiscountMinor < 0n) return null;

  return { percentBasisPoints, flatAmountMinor, maxDiscountMinor };
}

/**
 * Applies a parsed promotion rule to a subtotal. Discounts are clamped to the
 * subtotal so a bad rule can never produce a negative total.
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

export class PrismaCheckoutPricingRepository implements CheckoutPricingRepository {
  private readonly client: CheckoutPackageClient;

  public constructor(client?: CheckoutPackageClient) {
    this.client = client ?? adaptCheckoutClient(prisma);
  }

  public async findPackagePrice(input: {
    productCode: string;
    currency: string;
    at: Date;
  }): Promise<bigint | null> {
    const row = await this.client.package.findFirst({
      where: { code: input.productCode },
      select: packagePriceSelect,
    });
    if (row === null) return null;
    if (row.status !== SELLABLE_PACKAGE_STATUS) return null;

    return selectActivePrice(row.prices, {
      currency: input.currency,
      at: input.at,
    });
  }
}

export class PrismaCheckoutPromotionRepository implements CheckoutPromotionRepository {
  private readonly client: CheckoutPromotionClient;

  public constructor(client?: CheckoutPromotionClient) {
    this.client = client ?? adaptCheckoutClient(prisma);
  }

  public async findRedeemable(input: {
    code: string;
    at: Date;
  }): Promise<CheckoutPromotionDto | null> {
    const row = await this.client.promotion.findFirst({
      where: { code: input.code },
      select: promotionSelect,
    });
    if (row === null) return null;
    if (row.status !== REDEEMABLE_PROMOTION_STATUS) return null;
    if (row.startsAt.getTime() > input.at.getTime()) return null;
    if (row.endsAt.getTime() <= input.at.getTime()) return null;
    if (row.usageLimit !== null && row._count.redemptions >= row.usageLimit) {
      return null;
    }

    const rule = parsePromotionRule(row.configuration);
    if (rule === null) return null;

    return { id: row.id, code: row.code, rule };
  }
}

export class PrismaCheckoutOrderRepository implements CheckoutOrderRepository {
  public constructor(private readonly client: CheckoutOrderClient) {}

  public nextOrderNumber(): string {
    return generateOrderNumber();
  }

  public async createOrder(input: {
    scope: CheckoutScope;
    orderNumber: string;
    currency: string;
    subtotalMinor: bigint;
    discountMinor: bigint;
    taxMinor: bigint;
    totalMinor: bigint;
    idempotencyKey?: string;
    item: Readonly<{
      productType: string;
      productCode: string;
      descriptionSnapshot: string;
      unitPriceMinor: bigint;
      quantity: number;
      totalMinor: bigint;
      configurationSnapshot: Prisma.InputJsonValue;
    }>;
  }): Promise<CheckoutOrderDto> {
    const order = await this.client.order.create({
      data: {
        tenantId: input.scope.tenantId,
        userId: input.scope.userId,
        ...(input.scope.weddingId === undefined ||
        input.scope.weddingId === null
          ? {}
          : { weddingId: input.scope.weddingId }),
        orderNumber: input.orderNumber,
        currency: input.currency,
        subtotalMinor: input.subtotalMinor,
        discountMinor: input.discountMinor,
        taxMinor: input.taxMinor,
        totalMinor: input.totalMinor,
        status: "PENDING_PAYMENT",
        ...(input.idempotencyKey === undefined
          ? {}
          : { checkoutIdempotencyKey: input.idempotencyKey }),
      },
      select: createdOrderSelect,
    });

    await this.client.orderItem.create({
      data: {
        tenantId: input.scope.tenantId,
        orderId: order.id,
        productType: input.item.productType,
        productCode: input.item.productCode,
        descriptionSnapshot: input.item.descriptionSnapshot,
        unitPriceMinor: input.item.unitPriceMinor,
        quantity: input.item.quantity,
        totalMinor: input.item.totalMinor,
        configurationSnapshot: input.item.configurationSnapshot,
      },
      select: { id: true },
    });

    return toCheckoutOrderDto(order);
  }

  public async findOrder(
    scope: CheckoutScope,
    orderId: string,
  ): Promise<CheckoutOrderDto | null> {
    const row = await this.client.order.findFirst({
      where: {
        id: orderId,
        tenantId: scope.tenantId,
        userId: scope.userId,
      },
      select: createdOrderSelect,
    });

    return row === null ? null : toCheckoutOrderDto(row);
  }

  public async findByIdempotencyKey(
    scope: CheckoutScope,
    idempotencyKey: string,
  ): Promise<CheckoutOrderDto | null> {
    const row = await this.client.order.findFirst({
      where: {
        tenantId: scope.tenantId,
        userId: scope.userId,
        checkoutIdempotencyKey: idempotencyKey,
      },
      select: createdOrderSelect,
    });

    return row === null ? null : toCheckoutOrderDto(row);
  }
}

export class PrismaCheckoutPaymentRepository implements CheckoutPaymentRepository {
  public constructor(private readonly client: CheckoutPaymentWriteClient) {}

  public async attachPayment(input: {
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
  }): Promise<CheckoutPaymentDto | null> {
    // Parent-ownership pre-check. `Payment` carries `tenantId` but has no
    // tenant relation of its own, so ownership is proven through the order.
    const order = await this.client.order.findFirst({
      where: {
        id: input.orderId,
        tenantId: input.scope.tenantId,
        userId: input.scope.userId,
      },
      select: createdOrderSelect,
    });
    if (order === null) return null;

    const payment = await this.client.payment.create({
      data: {
        tenantId: input.scope.tenantId,
        orderId: order.id,
        provider: input.provider,
        providerTransactionId: input.providerTransactionId,
        method: input.method,
        amountMinor: input.amountMinor,
        currency: input.currency,
        status: "PENDING",
        ...(input.expiresAt === undefined || input.expiresAt === null
          ? {}
          : { expiresAt: input.expiresAt }),
        ...(input.redirectUrl === undefined || input.redirectUrl === null
          ? {}
          : { redirectUrl: input.redirectUrl }),
      },
      select: paymentSelect,
    });

    if (input.promotionId !== undefined) {
      await this.client.promotionRedemption.create({
        data: {
          tenantId: input.scope.tenantId,
          promotionId: input.promotionId,
          orderId: order.id,
        },
        select: { id: true },
      });
    }

    return toCheckoutPaymentDto(payment);
  }

  public async findByOrderId(
    scope: CheckoutScope,
    orderId: string,
  ): Promise<CheckoutPaymentDto | null> {
    const row = await this.client.payment.findFirst({
      where: {
        orderId,
        tenantId: scope.tenantId,
        order: { tenantId: scope.tenantId, userId: scope.userId },
      },
      select: paymentSelect,
    });

    return row === null ? null : toCheckoutPaymentDto(row);
  }
}

function createRepositories(
  client: CheckoutTransactionClient,
): CheckoutRepositories {
  return {
    orders: new PrismaCheckoutOrderRepository(client),
    payments: new PrismaCheckoutPaymentRepository(client),
    promotions: new PrismaCheckoutPromotionRepository(client),
    pricing: new PrismaCheckoutPricingRepository(client),
  };
}

export class PrismaCheckoutTransaction implements CheckoutTransactionPort {
  public constructor(
    private readonly client: Pick<PrismaClient, "$transaction"> = prisma,
  ) {}

  public async transaction<T>(
    work: (repositories: CheckoutRepositories) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(async (transactionClient) =>
      work(createRepositories(adaptCheckoutClient(transactionClient))),
    );
  }
}

import { describe, expect, it, vi } from "vitest";

import {
  applyPromotionRule,
  generateOrderNumber,
  isOrderNumber,
  isPriceActive,
  parsePromotionRule,
  PrismaCheckoutOrderRepository,
  PrismaCheckoutPaymentRepository,
  PrismaCheckoutPricingRepository,
  PrismaCheckoutPromotionRepository,
  selectActivePrice,
} from "./checkout";

const AT = new Date("2026-09-15T03:00:00.000Z");
const SCOPE = { tenantId: "tenant-1", userId: "user-1" } as const;

const orderRow = {
  id: "order-1",
  tenantId: "tenant-1",
  userId: "user-1",
  orderNumber: "WS-AB12CD34EF",
  currency: "IDR",
  subtotalMinor: 250000n,
  discountMinor: 0n,
  taxMinor: 0n,
  totalMinor: 250000n,
  status: "PENDING_PAYMENT",
  items: [
    {
      id: "item-1",
      productCode: "PAKET-PREMIUM",
      descriptionSnapshot: "Paket Premium",
      unitPriceMinor: 250000n,
      quantity: 1,
      totalMinor: 250000n,
      configurationSnapshot: {},
    },
  ],
};

const paymentRow = {
  id: "payment-1",
  tenantId: "tenant-1",
  orderId: "order-1",
  provider: "midtrans",
  providerTransactionId: "b1e9d0f2",
  amountMinor: 250000n,
  currency: "IDR",
  method: "QRIS",
  status: "PENDING",
  expiresAt: null,
  redirectUrl: null,
};

describe("generateOrderNumber", () => {
  it("produces an order number that satisfies the shared pattern", () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const orderNumber = generateOrderNumber();
      expect(orderNumber).toMatch(/^WS-[A-Z0-9]{10}$/);
      expect(isOrderNumber(orderNumber)).toBe(true);
    }
  });

  it("does not repeat across calls", () => {
    const generated = new Set(
      Array.from({ length: 200 }, () => generateOrderNumber()),
    );
    expect(generated.size).toBe(200);
  });

  it("rejects malformed order numbers", () => {
    expect(isOrderNumber("WS-")).toBe(false);
    expect(isOrderNumber("ws-ab12cd34ef")).toBe(false);
    expect(isOrderNumber("WS-AB12CD34EF!")).toBe(false);
  });
});

describe("isPriceActive", () => {
  it("treats the start as inclusive and the end as exclusive", () => {
    const price = {
      activeFrom: new Date("2026-09-01T00:00:00.000Z"),
      activeUntil: new Date("2026-10-01T00:00:00.000Z"),
    };

    expect(isPriceActive(price, new Date("2026-09-01T00:00:00.000Z"))).toBe(
      true,
    );
    expect(isPriceActive(price, new Date("2026-09-30T23:59:59.000Z"))).toBe(
      true,
    );
    expect(isPriceActive(price, new Date("2026-10-01T00:00:00.000Z"))).toBe(
      false,
    );
    expect(isPriceActive(price, new Date("2026-08-31T23:59:59.000Z"))).toBe(
      false,
    );
  });

  it("treats an open-ended price as active indefinitely", () => {
    expect(
      isPriceActive(
        { activeFrom: new Date("2020-01-01T00:00:00.000Z"), activeUntil: null },
        AT,
      ),
    ).toBe(true);
  });
});

describe("selectActivePrice", () => {
  it("selects the in-window price for the requested currency", () => {
    const amount = selectActivePrice(
      [
        {
          currency: "IDR",
          amountMinor: 100000n,
          activeFrom: new Date("2025-01-01T00:00:00.000Z"),
          activeUntil: new Date("2025-12-31T00:00:00.000Z"),
        },
        {
          currency: "IDR",
          amountMinor: 250000n,
          activeFrom: new Date("2026-01-01T00:00:00.000Z"),
          activeUntil: null,
        },
      ],
      { currency: "IDR", at: AT },
    );

    expect(amount).toBe(250000n);
  });

  it("returns null when no price is in window", () => {
    expect(
      selectActivePrice(
        [
          {
            currency: "IDR",
            amountMinor: 100000n,
            activeFrom: new Date("2025-01-01T00:00:00.000Z"),
            activeUntil: new Date("2025-12-31T00:00:00.000Z"),
          },
        ],
        { currency: "IDR", at: AT },
      ),
    ).toBeNull();
  });

  it("never falls back to another currency", () => {
    expect(
      selectActivePrice(
        [
          {
            currency: "USD",
            amountMinor: 1999n,
            activeFrom: new Date("2020-01-01T00:00:00.000Z"),
            activeUntil: null,
          },
        ],
        { currency: "IDR", at: AT },
      ),
    ).toBeNull();
  });
});

describe("parsePromotionRule", () => {
  it("reads a flat discount", () => {
    expect(parsePromotionRule({ flatAmountMinor: "25000" })).toEqual({
      percentBasisPoints: null,
      flatAmountMinor: 25000n,
      maxDiscountMinor: null,
    });
  });

  it("reads a percentage discount in basis points", () => {
    expect(
      parsePromotionRule({ percentBasisPoints: 1500, maxDiscountMinor: 50000 }),
    ).toEqual({
      percentBasisPoints: 1500,
      flatAmountMinor: null,
      maxDiscountMinor: 50000n,
    });
  });

  it("prefers a flat amount when both shapes are present", () => {
    const rule = parsePromotionRule({
      flatAmountMinor: 10000,
      percentBasisPoints: 5000,
    });

    expect(rule?.flatAmountMinor).toBe(10000n);
    expect(rule?.percentBasisPoints).toBeNull();
  });

  it("returns null for shapes it does not understand, so nothing discounts silently", () => {
    expect(parsePromotionRule(null)).toBeNull();
    expect(parsePromotionRule("ACTIVE")).toBeNull();
    expect(parsePromotionRule([])).toBeNull();
    expect(parsePromotionRule({})).toBeNull();
    expect(parsePromotionRule({ percentBasisPoints: 0 })).toBeNull();
    expect(parsePromotionRule({ percentBasisPoints: 10_001 })).toBeNull();
    expect(parsePromotionRule({ flatAmountMinor: -5 })).toBeNull();
  });

  it("ignores a non-integer percentage rather than rounding it", () => {
    expect(parsePromotionRule({ percent: 12.5 })).toBeNull();
  });
});

describe("applyPromotionRule", () => {
  it("applies a flat discount", () => {
    expect(
      applyPromotionRule(
        {
          percentBasisPoints: null,
          flatAmountMinor: 25000n,
          maxDiscountMinor: null,
        },
        250000n,
      ),
    ).toBe(25000n);
  });

  it("applies a percentage discount", () => {
    expect(
      applyPromotionRule(
        {
          percentBasisPoints: 1500,
          flatAmountMinor: null,
          maxDiscountMinor: null,
        },
        200000n,
      ),
    ).toBe(30000n);
  });

  it("clamps a percentage discount at its cap", () => {
    expect(
      applyPromotionRule(
        {
          percentBasisPoints: 5000,
          flatAmountMinor: null,
          maxDiscountMinor: 25000n,
        },
        200000n,
      ),
    ).toBe(25000n);
  });

  it("never discounts below zero or above the subtotal", () => {
    const huge = {
      percentBasisPoints: null,
      flatAmountMinor: 999999n,
      maxDiscountMinor: null,
    };

    expect(applyPromotionRule(huge, 250000n)).toBe(250000n);
    expect(applyPromotionRule(huge, 0n)).toBe(0n);
  });
});

describe("PrismaCheckoutPricingRepository", () => {
  it("scopes the package lookup by code and returns the active amount", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "package-1",
      code: "PAKET-PREMIUM",
      name: "Paket Premium",
      status: "ACTIVE",
      prices: [
        {
          currency: "IDR",
          amountMinor: 250000n,
          activeFrom: new Date("2026-01-01T00:00:00.000Z"),
          activeUntil: null,
        },
      ],
    });
    const repository = new PrismaCheckoutPricingRepository({
      package: { findFirst },
    });

    await expect(
      repository.findPackagePrice({
        productCode: "PAKET-PREMIUM",
        currency: "IDR",
        at: AT,
      }),
    ).resolves.toBe(250000n);

    expect(findFirst).toHaveBeenCalledWith({
      where: { code: "PAKET-PREMIUM" },
      select: expect.objectContaining({
        id: true,
        code: true,
        status: true,
      }),
    });
  });

  it("returns null for an unknown or non-sellable package", async () => {
    const missing = new PrismaCheckoutPricingRepository({
      package: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    const draft = new PrismaCheckoutPricingRepository({
      package: {
        findFirst: vi.fn().mockResolvedValue({
          id: "package-1",
          code: "PAKET-DRAFT",
          name: "Draft",
          status: "DRAFT",
          prices: [
            {
              currency: "IDR",
              amountMinor: 250000n,
              activeFrom: new Date("2020-01-01T00:00:00.000Z"),
              activeUntil: null,
            },
          ],
        }),
      },
    });

    await expect(
      missing.findPackagePrice({
        productCode: "NOPE",
        currency: "IDR",
        at: AT,
      }),
    ).resolves.toBeNull();
    await expect(
      draft.findPackagePrice({
        productCode: "PAKET-DRAFT",
        currency: "IDR",
        at: AT,
      }),
    ).resolves.toBeNull();
  });
});

describe("PrismaCheckoutPromotionRepository", () => {
  function promotionClient(row: unknown) {
    return { promotion: { findFirst: vi.fn().mockResolvedValue(row) } };
  }

  const basePromotion = {
    id: "promo-1",
    code: "PROMO-NIKAH",
    status: "ACTIVE",
    startsAt: new Date("2026-09-01T00:00:00.000Z"),
    endsAt: new Date("2026-10-01T00:00:00.000Z"),
    usageLimit: 100,
    configuration: { flatAmountMinor: 25000 },
    _count: { redemptions: 3 },
  };

  it("returns a redeemable promotion with its parsed rule", async () => {
    const repository = new PrismaCheckoutPromotionRepository(
      promotionClient(basePromotion),
    );

    await expect(
      repository.findRedeemable({ code: "PROMO-NIKAH", at: AT }),
    ).resolves.toEqual({
      id: "promo-1",
      code: "PROMO-NIKAH",
      rule: {
        percentBasisPoints: null,
        flatAmountMinor: 25000n,
        maxDiscountMinor: null,
      },
    });
  });

  it("treats unknown, inactive, out-of-window, and exhausted codes identically", async () => {
    const cases: readonly unknown[] = [
      null,
      { ...basePromotion, status: "PAUSED" },
      {
        ...basePromotion,
        startsAt: new Date("2026-10-01T00:00:00.000Z"),
      },
      { ...basePromotion, endsAt: new Date("2026-09-01T00:00:00.000Z") },
      { ...basePromotion, _count: { redemptions: 100 } },
      { ...basePromotion, configuration: { unknown: true } },
    ];

    for (const row of cases) {
      const repository = new PrismaCheckoutPromotionRepository(
        promotionClient(row),
      );
      await expect(
        repository.findRedeemable({ code: "PROMO-NIKAH", at: AT }),
      ).resolves.toBeNull();
    }
  });
});

describe("PrismaCheckoutOrderRepository", () => {
  it("creates the order with tenant and user scope and the item in the same pass", async () => {
    const create = vi.fn().mockResolvedValue(orderRow);
    const orderItemCreate = vi.fn().mockResolvedValue({ id: "item-1" });
    const repository = new PrismaCheckoutOrderRepository({
      order: { create, findFirst: vi.fn() },
      orderItem: { create: orderItemCreate },
    });

    const order = await repository.createOrder({
      scope: SCOPE,
      orderNumber: "WS-AB12CD34EF",
      currency: "IDR",
      subtotalMinor: 250000n,
      discountMinor: 0n,
      taxMinor: 0n,
      totalMinor: 250000n,
      item: {
        productType: "INVITATION_PACKAGE",
        productCode: "PAKET-PREMIUM",
        descriptionSnapshot: "Paket Premium",
        unitPriceMinor: 250000n,
        quantity: 1,
        totalMinor: 250000n,
        configurationSnapshot: {},
      },
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        orderNumber: "WS-AB12CD34EF",
        status: "PENDING_PAYMENT",
      }),
      select: expect.anything(),
    });
    expect(orderItemCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        orderId: "order-1",
        productCode: "PAKET-PREMIUM",
      }),
      select: { id: true },
    });
    expect(order.orderNumber).toBe("WS-AB12CD34EF");
    expect(order.items).toHaveLength(1);
  });

  it("omits weddingId when the checkout is not tied to a wedding", async () => {
    const create = vi.fn().mockResolvedValue(orderRow);
    const repository = new PrismaCheckoutOrderRepository({
      order: { create, findFirst: vi.fn() },
      orderItem: { create: vi.fn().mockResolvedValue({ id: "item-1" }) },
    });

    await repository.createOrder({
      scope: SCOPE,
      orderNumber: "WS-AB12CD34EF",
      currency: "IDR",
      subtotalMinor: 250000n,
      discountMinor: 0n,
      taxMinor: 0n,
      totalMinor: 250000n,
      item: {
        productType: "INVITATION_PACKAGE",
        productCode: "PAKET-PREMIUM",
        descriptionSnapshot: "Paket Premium",
        unitPriceMinor: 250000n,
        quantity: 1,
        totalMinor: 250000n,
        configurationSnapshot: {},
      },
    });

    const data = create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data).not.toHaveProperty("weddingId");
  });

  it("persists the checkout attempt token", async () => {
    const create = vi.fn().mockResolvedValue(orderRow);
    const repository = new PrismaCheckoutOrderRepository({
      order: { create, findFirst: vi.fn() },
      orderItem: { create: vi.fn().mockResolvedValue({ id: "item-1" }) },
    });

    await repository.createOrder({
      scope: SCOPE,
      orderNumber: "WS-AB12CD34EF",
      currency: "IDR",
      subtotalMinor: 250000n,
      discountMinor: 0n,
      taxMinor: 0n,
      totalMinor: 250000n,
      idempotencyKey: "attempt-token-00000001",
      item: {
        productType: "INVITATION_PACKAGE",
        productCode: "PAKET-PREMIUM",
        descriptionSnapshot: "Paket Premium",
        unitPriceMinor: 250000n,
        quantity: 1,
        totalMinor: 250000n,
        configurationSnapshot: {},
      },
    });

    const data = create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.checkoutIdempotencyKey).toBe("attempt-token-00000001");
  });

  it("finds a replayed order by tenant, user, and attempt token", async () => {
    const findFirst = vi.fn().mockResolvedValue(orderRow);
    const repository = new PrismaCheckoutOrderRepository({
      order: { create: vi.fn(), findFirst },
      orderItem: { create: vi.fn() },
    });

    const order = await repository.findByIdempotencyKey(
      SCOPE,
      "attempt-token-00000001",
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        userId: "user-1",
        checkoutIdempotencyKey: "attempt-token-00000001",
      },
      select: expect.anything(),
    });
    expect(order?.id).toBe("order-1");
  });

  it("requires tenant and user scope when reading an order back", async () => {
    const findFirst = vi.fn().mockResolvedValue(orderRow);
    const repository = new PrismaCheckoutOrderRepository({
      order: { create: vi.fn(), findFirst },
      orderItem: { create: vi.fn() },
    });

    await repository.findOrder(SCOPE, "order-1");

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        tenantId: "tenant-1",
        userId: "user-1",
      },
      select: expect.anything(),
    });
  });
});

describe("PrismaCheckoutPaymentRepository", () => {
  it("proves order ownership before writing the provider transaction id", async () => {
    const orderFindFirst = vi.fn().mockResolvedValue(orderRow);
    const create = vi.fn().mockResolvedValue(paymentRow);
    const repository = new PrismaCheckoutPaymentRepository({
      order: { findFirst: orderFindFirst },
      payment: { create, findFirst: vi.fn() },
      promotionRedemption: { create: vi.fn() },
    });

    const payment = await repository.attachPayment({
      scope: SCOPE,
      orderId: "order-1",
      provider: "midtrans",
      providerTransactionId: "b1e9d0f2",
      method: "QRIS",
      amountMinor: 250000n,
      currency: "IDR",
      redirectUrl: "https://app.midtrans.com/qris/b1e9d0f2",
    });

    expect(orderFindFirst).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        tenantId: "tenant-1",
        userId: "user-1",
      },
      select: expect.anything(),
    });
    // The real provider id is what the webhook resolves against, so it must be
    // persisted verbatim rather than a locally generated placeholder.
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        orderId: "order-1",
        provider: "midtrans",
        providerTransactionId: "b1e9d0f2",
        status: "PENDING",
        redirectUrl: "https://app.midtrans.com/qris/b1e9d0f2",
      }),
      select: expect.anything(),
    });
    expect(payment?.providerTransactionId).toBe("b1e9d0f2");
  });

  it("returns null instead of writing when the order is not owned by the scope", async () => {
    const create = vi.fn();
    const repository = new PrismaCheckoutPaymentRepository({
      order: { findFirst: vi.fn().mockResolvedValue(null) },
      payment: { create, findFirst: vi.fn() },
      promotionRedemption: { create: vi.fn() },
    });

    await expect(
      repository.attachPayment({
        scope: { tenantId: "tenant-2", userId: "user-2" },
        orderId: "order-1",
        provider: "midtrans",
        providerTransactionId: "b1e9d0f2",
        method: "QRIS",
        amountMinor: 250000n,
        currency: "IDR",
      }),
    ).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("records a promotion redemption only when a promotion is attached", async () => {
    const redemptionCreate = vi.fn().mockResolvedValue({ id: "redemption-1" });
    const repository = new PrismaCheckoutPaymentRepository({
      order: { findFirst: vi.fn().mockResolvedValue(orderRow) },
      payment: {
        create: vi.fn().mockResolvedValue(paymentRow),
        findFirst: vi.fn(),
      },
      promotionRedemption: { create: redemptionCreate },
    });

    await repository.attachPayment({
      scope: SCOPE,
      orderId: "order-1",
      provider: "midtrans",
      providerTransactionId: "b1e9d0f2",
      method: "QRIS",
      amountMinor: 250000n,
      currency: "IDR",
    });
    expect(redemptionCreate).not.toHaveBeenCalled();

    await repository.attachPayment({
      scope: SCOPE,
      orderId: "order-1",
      provider: "midtrans",
      providerTransactionId: "b1e9d0f2",
      method: "QRIS",
      amountMinor: 250000n,
      currency: "IDR",
      promotionId: "promo-1",
    });
    expect(redemptionCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        promotionId: "promo-1",
        orderId: "order-1",
      },
      select: { id: true },
    });
  });

  it("scopes an existing-payment lookup by tenant and user through the order", async () => {
    const findFirst = vi.fn().mockResolvedValue(paymentRow);
    const repository = new PrismaCheckoutPaymentRepository({
      order: { findFirst: vi.fn() },
      payment: { create: vi.fn(), findFirst },
      promotionRedemption: { create: vi.fn() },
    });

    await repository.findByOrderId(SCOPE, "order-1");

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        orderId: "order-1",
        tenantId: "tenant-1",
        order: { tenantId: "tenant-1", userId: "user-1" },
      },
      select: expect.anything(),
    });
  });
});

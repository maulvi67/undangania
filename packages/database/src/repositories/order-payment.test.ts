import { describe, expect, it, vi } from "vitest";
import { PrismaOrderPaymentRepository } from "./order-payment";

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "o-1",
    tenantId: "t-1",
    userId: "u-1",
    orderNumber: "WS-ABCD123456",
    currency: "IDR",
    subtotalMinor: 349_000n * 100n,
    discountMinor: 0n,
    taxMinor: 0n,
    totalMinor: 349_000n * 100n,
    status: "PENDING_PAYMENT",
    items: [
      { productCode: "seruni-klasik", descriptionSnapshot: "Paket Seruni" },
    ],
    payments: [],
    ...overrides,
  };
}

function client(overrides: Record<string, unknown> = {}) {
  return {
    order: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      ...((overrides.order as object) ?? {}),
    },
  };
}

describe("PrismaOrderPaymentRepository.findOwned", () => {
  it("proves ownership through both tenant and user", async () => {
    const c = client({
      order: { findFirst: vi.fn().mockResolvedValue(orderRow()) },
    });
    const repository = new PrismaOrderPaymentRepository(c);

    await expect(
      repository.findOwned({
        tenantId: "t-1",
        userId: "u-1",
        orderNumber: "WS-ABCD123456",
      }),
    ).resolves.toMatchObject({
      id: "o-1",
      orderNumber: "WS-ABCD123456",
      status: "PENDING_PAYMENT",
    });

    expect(c.order.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "t-1", userId: "u-1", orderNumber: "WS-ABCD123456" },
      select: expect.anything(),
    });
  });

  it("reports an order owned by someone else as null", async () => {
    const repository = new PrismaOrderPaymentRepository(client());
    await expect(
      repository.findOwned({
        tenantId: "t-1",
        userId: "u-2",
        orderNumber: "WS-ABCD123456",
      }),
    ).resolves.toBe(null);
  });
});

describe("PrismaOrderPaymentRepository.listForTenant", () => {
  it("scopes by tenant only, so a co-organizer can see the workspace's orders", async () => {
    const c = client({
      order: { findMany: vi.fn().mockResolvedValue([orderRow()]) },
    });

    const rows = await new PrismaOrderPaymentRepository(c).listForTenant({
      tenantId: "t-1",
    });

    expect(rows).toHaveLength(1);
    // Deliberately no `userId` predicate: an order belongs to the workspace, and a
    // co-organizer who did not press the button still needs to see it.
    expect(c.order.findMany).toHaveBeenCalledWith({
      where: { tenantId: "t-1" },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: expect.anything(),
    });
  });

  it("fails loudly when the client cannot list rather than returning nothing", async () => {
    // An empty array would render as "no orders", which is a different claim from
    // "this client cannot answer the question".
    const repository = new PrismaOrderPaymentRepository({
      order: { findFirst: vi.fn() },
    });
    await expect(repository.listForTenant({ tenantId: "t-1" })).rejects.toThrow(
      "Order list client is unavailable",
    );
  });
});

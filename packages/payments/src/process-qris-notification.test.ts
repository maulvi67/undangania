import { describe, expect, it } from "vitest";

import {
  createMidtransNotificationEventId,
  createMidtransSignature,
  type MidtransNotification,
  MidtransNotificationPayloadError,
  MidtransNotificationSignatureError,
} from "./midtrans-qris";
import {
  processQrisNotification,
  type QrisAuditRepository,
  type QrisNotificationRepositories,
  type QrisNotificationTransactionPort,
  type QrisOrderRecord,
  type QrisOutboxRepository,
  type QrisPaymentRecord,
  type QrisPaymentRepository,
  type QrisOrderRepository,
  type QrisEntitlementRepository,
} from "./process-qris-notification";
import type { PaymentStatus } from "./index";

const SERVER_KEY = "sandbox-secret";
const ORDER_NUMBER = "WS-20260911-001";
const AMOUNT_MINOR = 149000n;

type NotificationFields = Omit<MidtransNotification, "signature_key">;
type AuditInput = Parameters<QrisAuditRepository["append"]>[0];
type OutboxInput = Parameters<QrisOutboxRepository["append"]>[0];

type FakeState = {
  payment: QrisPaymentRecord;
  order: QrisOrderRecord;
  transactionCalls: number;
  paymentUpdates: Parameters<QrisPaymentRepository["updateStatus"]>[0][];
  orderUpdates: Parameters<QrisOrderRepository["updateStatus"]>[0][];
  entitlementGrants: Parameters<
    QrisEntitlementRepository["grantForPaidOrder"]
  >[0][];
  outboxEvents: OutboxInput[];
  auditEvents: AuditInput[];
  paidAt: Date | null;
};

const BASE_NOTIFICATION: NotificationFields = {
  order_id: ORDER_NUMBER,
  status_code: "200",
  gross_amount: "149000.00",
  transaction_status: "settlement",
  payment_type: "qris",
  transaction_id: "midtrans-transaction-1",
  currency: "IDR",
};

function rawNotification(
  overrides: Partial<NotificationFields> = {},
  signingKey = SERVER_KEY,
): string {
  const notification: NotificationFields = {
    ...BASE_NOTIFICATION,
    ...overrides,
  };
  const signatureKey = createMidtransSignature(
    notification.order_id,
    notification.status_code,
    notification.gross_amount,
    signingKey,
  );
  return JSON.stringify({ ...notification, signature_key: signatureKey });
}

function createFakePorts(
  input: {
    paymentStatus?: PaymentStatus;
    orderStatus?: QrisOrderRecord["status"];
  } = {},
): { ports: QrisNotificationTransactionPort; state: FakeState } {
  const state: FakeState = {
    payment: {
      id: "payment-1",
      tenantId: "tenant-1",
      orderId: "order-1",
      provider: "midtrans",
      providerTransactionId: "midtrans-transaction-1",
      providerEventId: null,
      method: "qris",
      amountMinor: AMOUNT_MINOR,
      currency: "IDR",
      status: input.paymentStatus ?? "PENDING",
    },
    order: {
      id: "order-1",
      tenantId: "tenant-1",
      orderNumber: ORDER_NUMBER,
      currency: "IDR",
      totalMinor: AMOUNT_MINOR,
      status: input.orderStatus ?? "PENDING_PAYMENT",
    },
    transactionCalls: 0,
    paymentUpdates: [],
    orderUpdates: [],
    entitlementGrants: [],
    outboxEvents: [],
    auditEvents: [],
    paidAt: null,
  };

  const repositories: QrisNotificationRepositories = {
    payments: {
      findByProviderTransactionId: async ({ providerTransactionId }) =>
        providerTransactionId === state.payment.providerTransactionId
          ? state.payment
          : null,
      findByProviderEventId: async ({ providerEventId }) =>
        providerEventId === state.payment.providerEventId
          ? state.payment
          : null,
      updateStatus: async (update) => {
        state.paymentUpdates.push(update);
        state.payment = {
          ...state.payment,
          providerEventId: update.providerEventId,
          status: update.status,
        };
        state.paidAt = update.paidAt;
      },
    },
    orders: {
      findById: async ({ tenantId, orderId }) =>
        tenantId === state.order.tenantId && orderId === state.order.id
          ? state.order
          : null,
      updateStatus: async (update) => {
        state.orderUpdates.push(update);
        state.order = { ...state.order, status: update.status };
      },
    },
    entitlements: {
      grantForPaidOrder: async (grant) => {
        state.entitlementGrants.push(grant);
      },
    },
    outbox: {
      append: async (event) => {
        state.outboxEvents.push(event);
      },
    },
    audit: {
      append: async (event) => {
        state.auditEvents.push(event);
      },
    },
  };

  const ports: QrisNotificationTransactionPort = {
    transaction: async <T>(
      work: (repositories: QrisNotificationRepositories) => Promise<T>,
    ): Promise<T> => {
      state.transactionCalls += 1;
      return work(repositories);
    },
  };

  return { ports, state };
}

describe("verified Midtrans QRIS notification processing", () => {
  it("rejects an invalid signature before opening a transaction", async () => {
    const { ports, state } = createFakePorts();

    await expect(
      processQrisNotification(
        { rawBody: rawNotification(), serverKey: "wrong-secret" },
        ports,
      ),
    ).rejects.toBeInstanceOf(MidtransNotificationSignatureError);
    expect(state.transactionCalls).toBe(0);
  });

  it("rejects malformed secret configuration as an invalid signature", async () => {
    const { ports, state } = createFakePorts();

    await expect(
      processQrisNotification(
        { rawBody: rawNotification(), serverKey: "" },
        ports,
      ),
    ).rejects.toBeInstanceOf(MidtransNotificationSignatureError);
    expect(state.transactionCalls).toBe(0);
  });

  it("rejects an invalid strict payload before signature verification or mutation", async () => {
    const { ports, state } = createFakePorts();
    const rawBody = JSON.stringify({
      ...BASE_NOTIFICATION,
      signature_key: "not-a-sha512-signature",
      unexpected_field: "reject me",
    });

    await expect(
      processQrisNotification({ rawBody, serverKey: SERVER_KEY }, ports),
    ).rejects.toBeInstanceOf(MidtransNotificationPayloadError);
    expect(state.transactionCalls).toBe(0);
  });

  it.each([
    {
      name: "order",
      override: { order_id: "WS-20260911-002" },
      code: "ORDER_MISMATCH",
    },
    {
      name: "amount",
      override: { gross_amount: "149001.00" },
      code: "AMOUNT_MISMATCH",
    },
    {
      name: "currency",
      override: { currency: "USD" },
      code: "CURRENCY_MISMATCH",
    },
    {
      name: "method",
      override: { payment_type: "credit_card" },
      code: "METHOD_MISMATCH",
    },
  ] as const)("rejects a $name mismatch", async ({ override, code }) => {
    const { ports } = createFakePorts();

    await expect(
      processQrisNotification(
        { rawBody: rawNotification(override), serverKey: SERVER_KEY },
        ports,
      ),
    ).rejects.toMatchObject({ code });
  });

  it("applies a verified paid transition atomically through injected ports", async () => {
    const { ports, state } = createFakePorts();
    const now = new Date("2026-09-14T10:20:30.000Z");

    const result = await processQrisNotification(
      { rawBody: rawNotification(), serverKey: SERVER_KEY, now },
      ports,
    );

    expect(result).toMatchObject({
      kind: "APPLIED",
      paymentId: "payment-1",
      orderId: "order-1",
      status: "PAID",
    });
    expect(state.payment.status).toBe("PAID");
    expect(state.payment.providerEventId).toMatch(/^midtrans:[a-f0-9]{64}$/);
    expect(state.paidAt).toEqual(now);
    expect(state.order.status).toBe("PAID");
    expect(state.paymentUpdates).toHaveLength(1);
    expect(state.orderUpdates).toEqual([
      { tenantId: "tenant-1", orderId: "order-1", status: "PAID" },
    ]);
    expect(state.entitlementGrants).toEqual([
      { tenantId: "tenant-1", orderId: "order-1", startsAt: now },
    ]);
    expect(state.outboxEvents).toHaveLength(1);
    expect(state.outboxEvents[0]).toMatchObject({
      idempotencyKey: expect.stringMatching(/^midtrans:[a-f0-9]{64}$/),
      tenantId: "tenant-1",
      eventType: "PaymentConfirmed",
      aggregateType: "Payment",
      aggregateId: "payment-1",
      payload: {
        paymentId: "payment-1",
        orderId: "order-1",
        provider: "midtrans",
        providerTransactionId: "midtrans-transaction-1",
        status: "PAID",
        occurredAt: now.toISOString(),
      },
      payloadVersion: 1,
    });
    expect(state.auditEvents).toHaveLength(1);
    expect(state.auditEvents[0]?.action).toBe("PAYMENT_NOTIFICATION_APPLIED");
  });

  it("makes a duplicate paid event a no-op for payment, order, entitlement, and outbox", async () => {
    const { ports, state } = createFakePorts();
    const input = { rawBody: rawNotification(), serverKey: SERVER_KEY };

    const first = await processQrisNotification(input, ports);
    const second = await processQrisNotification(input, ports);

    expect(first.kind).toBe("APPLIED");
    expect(second).toMatchObject({
      kind: "DUPLICATE",
      paymentId: "payment-1",
      orderId: "order-1",
      status: "PAID",
    });
    expect(state.paymentUpdates).toHaveLength(1);
    expect(state.orderUpdates).toHaveLength(1);
    expect(state.entitlementGrants).toHaveLength(1);
    expect(state.outboxEvents).toHaveLength(1);
    expect(state.auditEvents.map((event) => event.action)).toEqual([
      "PAYMENT_NOTIFICATION_APPLIED",
      "PAYMENT_NOTIFICATION_DUPLICATE",
    ]);
  });

  it("ignores an out-of-order pending event after paid without regressing state", async () => {
    const { ports, state } = createFakePorts({
      paymentStatus: "PAID",
      orderStatus: "PAID",
    });
    state.payment = {
      ...state.payment,
      providerEventId: createMidtransNotificationEventId({
        ...BASE_NOTIFICATION,
        transaction_status: "settlement",
      }),
    };

    const result = await processQrisNotification(
      {
        rawBody: rawNotification({ transaction_status: "pending" }),
        serverKey: SERVER_KEY,
      },
      ports,
    );

    expect(result).toMatchObject({
      kind: "IGNORED_OUT_OF_ORDER",
      paymentId: "payment-1",
      orderId: "order-1",
      currentStatus: "PAID",
      receivedStatus: "PENDING",
    });
    expect(state.payment.status).toBe("PAID");
    expect(state.order.status).toBe("PAID");
    expect(state.paymentUpdates).toHaveLength(0);
    expect(state.orderUpdates).toHaveLength(0);
    expect(state.entitlementGrants).toHaveLength(0);
    expect(state.outboxEvents).toHaveLength(0);
    expect(state.auditEvents[0]?.action).toBe(
      "PAYMENT_NOTIFICATION_OUT_OF_ORDER",
    );
  });
});

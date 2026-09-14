import { describe, expect, it } from "vitest";
import {
  assertQrisNotification,
  createMidtransSignature,
  createQrisChargeRequest,
  isVerifiedPaidStatus,
  mapMidtransStatus,
  qrisActionUrl,
  verifyMidtransSignature,
} from "./midtrans-qris";

describe("Midtrans QRIS helpers", () => {
  it("creates a QRIS request with an integer IDR amount", () => {
    expect(
      createQrisChargeRequest({
        orderId: "WS-20260911-001",
        amountMinor: 149000n,
      }),
    ).toEqual({
      payment_type: "qris",
      transaction_details: {
        order_id: "WS-20260911-001",
        gross_amount: 149000,
      },
    });
  });

  it("rejects unsafe order ids and amounts", () => {
    expect(() =>
      createQrisChargeRequest({ orderId: "bad id", amountMinor: 1000n }),
    ).toThrow("Invalid order id");
    expect(() =>
      createQrisChargeRequest({ orderId: "order", amountMinor: 0n }),
    ).toThrow("QRIS amount");
  });

  it("maps provider statuses to canonical payment statuses", () => {
    expect(mapMidtransStatus("pending")).toBe("PENDING");
    expect(mapMidtransStatus("settlement")).toBe("PAID");
    expect(mapMidtransStatus("expire")).toBe("EXPIRED");
    expect(mapMidtransStatus("deny")).toBe("FAILED");
    expect(() => mapMidtransStatus("unknown")).toThrow("Unknown Midtrans");
  });

  it("creates and verifies the documented notification signature", () => {
    const signature = createMidtransSignature(
      "WS-20260911-001",
      "200",
      "149000.00",
      "sandbox-secret",
    );
    expect(
      verifyMidtransSignature({
        signatureKey: signature,
        orderId: "WS-20260911-001",
        statusCode: "200",
        grossAmount: "149000.00",
        serverKey: "sandbox-secret",
      }),
    ).toBe(true);
    expect(
      verifyMidtransSignature({
        signatureKey: signature,
        orderId: "WS-20260911-001",
        statusCode: "201",
        grossAmount: "149000.00",
        serverKey: "sandbox-secret",
      }),
    ).toBe(false);
  });

  it("requires a QRIS notification to match order, amount, method, and currency", () => {
    const notification = {
      signature_key: "redacted",
      order_id: "WS-20260911-001",
      status_code: "200",
      gross_amount: "149000.00",
      transaction_status: "settlement",
      payment_type: "qris",
      transaction_id: "provider-server-only",
      currency: "IDR",
    } as const;

    expect(() =>
      assertQrisNotification({
        notification,
        expectedOrderId: "WS-20260911-001",
        expectedAmountMinor: 149000n,
      }),
    ).not.toThrow();
    expect(() =>
      assertQrisNotification({
        notification: { ...notification, gross_amount: "149001.00" },
        expectedOrderId: "WS-20260911-001",
        expectedAmountMinor: 149000n,
      }),
    ).toThrow("amount mismatch");
    expect(() =>
      assertQrisNotification({
        notification: { ...notification, payment_type: "credit_card" },
        expectedOrderId: "WS-20260911-001",
        expectedAmountMinor: 149000n,
      }),
    ).toThrow("method mismatch");
    expect(() =>
      assertQrisNotification({
        notification: { ...notification, gross_amount: "149000.50" },
        expectedOrderId: "WS-20260911-001",
        expectedAmountMinor: 149000n,
      }),
    ).toThrow("Invalid payment amount");
    expect(() =>
      assertQrisNotification({
        notification: { ...notification, currency: "USD" },
        expectedOrderId: "WS-20260911-001",
        expectedAmountMinor: 149000n,
      }),
    ).toThrow("currency mismatch");
  });

  it("accepts only an HTTPS QR action URL", () => {
    expect(
      qrisActionUrl({
        status_code: "201",
        actions: [
          {
            name: "generate-qr-code",
            method: "GET",
            url: "https://api.sandbox.midtrans.com/qr/1",
          },
        ],
      }),
    ).toBe("https://api.sandbox.midtrans.com/qr/1");
    expect(
      qrisActionUrl({
        status_code: "201",
        actions: [
          {
            name: "generate-qr-code",
            method: "GET",
            url: "http://unsafe.example/qr",
          },
        ],
      }),
    ).toBeUndefined();
    expect(
      qrisActionUrl({
        status_code: "201",
        actions: [
          {
            name: "generate-qr-code",
            method: "GET",
            url: "https://untrusted.example/qr",
          },
        ],
      }),
    ).toBeUndefined();
  });

  it("does not treat pending status as paid", () => {
    expect(isVerifiedPaidStatus(mapMidtransStatus("pending"))).toBe(false);
    expect(isVerifiedPaidStatus(mapMidtransStatus("settlement"))).toBe(true);
  });
});

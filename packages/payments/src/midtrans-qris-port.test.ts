import { describe, expect, it, vi } from "vitest";

import {
  createMidtransQrisPaymentPortFromEnv,
  MidtransQrisPaymentPort,
  QrisProviderError,
  resolveQrisEnvironment,
} from "./midtrans-qris-port";
import { createMidtransSignature } from "./midtrans-qris";

const SERVER_KEY = "sandbox-server-key";

const CHARGE_RESPONSE = {
  status_code: "201",
  status_message: "Success, QRIS transaction is created",
  transaction_id: "b1e9d0f2-1c2a-4a51-9a3f-2f3b6c5d7e8f",
  order_id: "WS-01J8ZQ4T7K",
  gross_amount: "250000.00",
  currency: "IDR",
  payment_type: "qris",
  transaction_status: "pending",
  actions: [
    {
      name: "generate-qr-code",
      method: "GET",
      url: "https://api.sandbox.midtrans.com/v2/qris/b1e9d0f2/qr-code",
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createPort(fetchImpl: typeof fetch) {
  return new MidtransQrisPaymentPort({
    serverKey: SERVER_KEY,
    environment: "sandbox",
    fetchImpl,
    timeoutMs: 5_000,
  });
}

function notificationBody(overrides: Partial<Record<string, string>> = {}) {
  const orderId = overrides.order_id ?? "WS-01J8ZQ4T7K";
  const statusCode = overrides.status_code ?? "200";
  const grossAmount = overrides.gross_amount ?? "250000.00";
  const body = {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    transaction_id: "b1e9d0f2-1c2a-4a51-9a3f-2f3b6c5d7e8f",
    transaction_status: "settlement",
    payment_type: "qris",
    currency: "IDR",
    ...overrides,
  };
  return JSON.stringify({
    ...body,
    signature_key: createMidtransSignature(
      orderId,
      statusCode,
      grossAmount,
      SERVER_KEY,
    ),
  });
}

describe("MidtransQrisPaymentPort.create", () => {
  it("creates a QRIS charge and returns the transaction id with the QR action URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(CHARGE_RESPONSE));

    const result = await createPort(fetchImpl).create({
      orderId: "WS-01J8ZQ4T7K",
      amountMinor: 250000n,
      currency: "IDR",
    });

    expect(result).toEqual({
      providerTransactionId: "b1e9d0f2-1c2a-4a51-9a3f-2f3b6c5d7e8f",
      redirectUrl: "https://api.sandbox.midtrans.com/v2/qris/b1e9d0f2/qr-code",
    });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://api.sandbox.midtrans.com/v2/charge");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe(
      `Basic ${Buffer.from(`${SERVER_KEY}:`, "utf8").toString("base64")}`,
    );
    // Amount is sent as a positive integer in minor units, never a float.
    expect(JSON.parse(init.body)).toEqual({
      payment_type: "qris",
      transaction_details: {
        order_id: "WS-01J8ZQ4T7K",
        gross_amount: 250000,
      },
    });
  });

  it("fails closed when the QR action URL is not on an allowlisted host", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        ...CHARGE_RESPONSE,
        actions: [
          {
            name: "generate-qr-code",
            method: "GET",
            url: "https://evil.example.com/qr-code",
          },
        ],
      }),
    );

    await expect(
      createPort(fetchImpl).create({
        orderId: "WS-01J8ZQ4T7K",
        amountMinor: 250000n,
        currency: "IDR",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
  });

  it("fails closed when no QR action URL is present", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ...CHARGE_RESPONSE, actions: [] }));

    await expect(
      createPort(fetchImpl).create({
        orderId: "WS-01J8ZQ4T7K",
        amountMinor: 250000n,
        currency: "IDR",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
  });

  it("rejects a non-2xx provider status without leaking the response body", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status_code: "401" }, 401));

    const error = await createPort(fetchImpl)
      .create({
        orderId: "WS-01J8ZQ4T7K",
        amountMinor: 250000n,
        currency: "IDR",
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(QrisProviderError);
    expect(error).toMatchObject({
      code: "PROVIDER_REJECTED",
      providerStatusCode: "401",
    });
    expect(String(error)).not.toContain(SERVER_KEY);
  });

  it("collapses a network failure to PROVIDER_UNAVAILABLE", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("socket hang up"));

    await expect(
      createPort(fetchImpl).create({
        orderId: "WS-01J8ZQ4T7K",
        amountMinor: 250000n,
        currency: "IDR",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  it("rejects a non-JSON gateway response as invalid rather than throwing raw", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("<html>g<br>ateway error</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    await expect(
      createPort(fetchImpl).create({
        orderId: "WS-01J8ZQ4T7K",
        amountMinor: 250000n,
        currency: "IDR",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
  });

  it("refuses a non-positive or unsafe amount before calling the provider", async () => {
    const fetchImpl = vi.fn();

    await expect(
      createPort(fetchImpl).create({
        orderId: "WS-01J8ZQ4T7K",
        amountMinor: 0n,
        currency: "IDR",
      }),
    ).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("MidtransQrisPaymentPort.verifyWebhook", () => {
  it("verifies a signed notification and derives the event id, status, and amount", async () => {
    const port = createPort(vi.fn());

    const result = await port.verifyWebhook({
      headers: {},
      rawBody: notificationBody(),
    });

    expect(result.transactionId).toBe("b1e9d0f2-1c2a-4a51-9a3f-2f3b6c5d7e8f");
    expect(result.status).toBe("PAID");
    expect(result.amountMinor).toBe(250000n);
    expect(result.eventId).toMatch(/^midtrans:[a-f0-9]{64}$/);
  });

  it("rejects a tampered signature", async () => {
    const port = createPort(vi.fn());
    const tampered = JSON.parse(notificationBody()) as Record<string, unknown>;
    tampered.signature_key = "a".repeat(128);

    await expect(
      port.verifyWebhook({ headers: {}, rawBody: JSON.stringify(tampered) }),
    ).rejects.toThrow();
  });

  it("rejects a signature computed for a different amount", async () => {
    const port = createPort(vi.fn());
    const body = JSON.parse(notificationBody()) as Record<string, unknown>;
    body.gross_amount = "1.00";

    await expect(
      port.verifyWebhook({ headers: {}, rawBody: JSON.stringify(body) }),
    ).rejects.toThrow();
  });
});

describe("MidtransQrisPaymentPort.getStatus", () => {
  it("maps a provider status to the canonical value", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        status_code: "200",
        transaction_status: "expire",
        transaction_id: "b1e9d0f2-1c2a-4a51-9a3f-2f3b6c5d7e8f",
      }),
    );

    await expect(
      createPort(fetchImpl).getStatus("b1e9d0f2-1c2a-4a51-9a3f-2f3b6c5d7e8f"),
    ).resolves.toBe("EXPIRED");
  });

  it("fails closed on an unrecognized provider status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        status_code: "200",
        transaction_status: "something-new",
      }),
    );

    await expect(
      createPort(fetchImpl).getStatus("b1e9d0f2"),
    ).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
  });

  it("requires a transaction id", async () => {
    const fetchImpl = vi.fn();

    await expect(createPort(fetchImpl).getStatus("   ")).rejects.toMatchObject({
      code: "PROVIDER_REJECTED",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("MidtransQrisPaymentPort.refund", () => {
  it("is fail-closed pending payment-owner approval", async () => {
    const port = createPort(vi.fn());

    await expect(port.refund("b1e9d0f2", 250000n)).rejects.toMatchObject({
      code: "REFUND_NOT_ENABLED",
    });
  });
});

describe("MidtransQrisPaymentPort construction", () => {
  it("rejects an empty server key", () => {
    expect(
      () =>
        new MidtransQrisPaymentPort({
          serverKey: "   ",
          environment: "sandbox",
        }),
    ).toThrow(QrisProviderError);
  });

  it("rejects a base URL that is not allowlisted", () => {
    expect(
      () =>
        new MidtransQrisPaymentPort({
          serverKey: SERVER_KEY,
          environment: "sandbox",
          baseUrl: "https://evil.example.com",
        }),
    ).toThrow(QrisProviderError);
  });

  it("uses the production host only for the production environment", () => {
    const production = new MidtransQrisPaymentPort({
      serverKey: SERVER_KEY,
      environment: "production",
      fetchImpl: vi.fn(),
    });

    expect(resolveQrisEnvironment("production")).toBe("production");
    expect(resolveQrisEnvironment(undefined)).toBe("sandbox");
    expect(resolveQrisEnvironment("PRODUCTION")).toBe("production");
    expect(production).toBeInstanceOf(MidtransQrisPaymentPort);
  });
});

describe("createMidtransQrisPaymentPortFromEnv", () => {
  it("returns null when the server key is absent so callers stay fail-closed", () => {
    expect(createMidtransQrisPaymentPortFromEnv({})).toBeNull();
    expect(
      createMidtransQrisPaymentPortFromEnv({ MIDTRANS_SERVER_KEY: "  " }),
    ).toBeNull();
  });

  it("builds a sandbox port by default and a production port when configured", () => {
    const sandbox = createMidtransQrisPaymentPortFromEnv({
      MIDTRANS_SERVER_KEY: SERVER_KEY,
    });
    const production = createMidtransQrisPaymentPortFromEnv({
      MIDTRANS_SERVER_KEY: SERVER_KEY,
      MIDTRANS_ENVIRONMENT: "production",
    });

    expect(sandbox).toBeInstanceOf(MidtransQrisPaymentPort);
    expect(production).toBeInstanceOf(MidtransQrisPaymentPort);
  });
});

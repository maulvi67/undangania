import { once } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createServer } from "./server";
import type {
  GuestHouseholdDto,
  GuestHouseholdRepository,
  SessionDto,
  SessionRepository,
  TenantMembershipDto,
  TenantMembershipRepository,
} from "@wedding/database";
import {
  createMidtransSignature,
  processQrisNotification,
  type QrisNotificationRepositories,
  type QrisNotificationTransactionPort,
} from "@wedding/payments";

const SESSION_TOKEN = "session-token";
const BASE_NOTIFICATION = {
  order_id: "WS-20260911-001",
  status_code: "200",
  gross_amount: "149000.00",
  transaction_status: "settlement",
  payment_type: "qris",
  transaction_id: "midtrans-transaction-1",
  currency: "IDR",
} as const;

function session(): SessionDto {
  return {
    id: "session-1",
    userId: "user-1",
    expiresAt: new Date("2026-09-15T00:00:00.000Z"),
    revokedAt: null,
    createdAt: new Date("2026-09-14T00:00:00.000Z"),
    lastSeenAt: null,
  };
}

function membership(
  role: TenantMembershipDto["role"] = "OWNER",
): TenantMembershipDto {
  return {
    id: "membership-1",
    tenantId: "tenant-1",
    userId: "user-1",
    role,
    status: "ACTIVE",
  };
}

function household(): GuestHouseholdDto {
  return {
    id: "household-1",
    tenantId: "tenant-1",
    weddingId: "wedding-1",
    displayName: "Keluarga A",
    maximumPax: 3,
    tokenVersion: 1,
    status: "ACTIVE",
    createdAt: new Date("2026-09-14T00:00:00.000Z"),
    updatedAt: new Date("2026-09-14T00:00:00.000Z"),
  };
}

function repositories(
  input: {
    role?: TenantMembershipDto["role"];
    household?: GuestHouseholdDto | null;
    list?: readonly GuestHouseholdDto[];
  } = {},
): {
  sessionRepository: SessionRepository;
  membershipRepository: TenantMembershipRepository;
  guestHouseholdRepository: GuestHouseholdRepository;
} {
  return {
    sessionRepository: {
      create: async () => ({ token: SESSION_TOKEN, session: session() }),
      findActiveByToken: async (token) =>
        token === SESSION_TOKEN ? session() : null,
      touch: async () => true,
      revokeById: async () => true,
      revokeAllForUser: async () => 1,
    },
    membershipRepository: {
      resolveForUser: async () => [membership(input.role)],
      resolveForUserAndWedding: async () => membership(input.role),
    },
    guestHouseholdRepository: {
      findById: async () =>
        input.household === undefined ? household() : input.household,
      list: async () => input.list ?? [household()],
    },
  };
}

function unavailableTransaction(): QrisNotificationTransactionPort {
  return {
    transaction: async <T>(
      work: (repositories: QrisNotificationRepositories) => Promise<T>,
    ): Promise<T> => {
      void work;
      throw new Error("transaction should not be called in this test");
    },
  };
}

function webhookBody(serverKey = "sandbox-secret"): string {
  return JSON.stringify({
    ...BASE_NOTIFICATION,
    signature_key: createMidtransSignature(
      BASE_NOTIFICATION.order_id,
      BASE_NOTIFICATION.status_code,
      BASE_NOTIFICATION.gross_amount,
      serverKey,
    ),
  });
}

async function withServer(
  handlerOptions: Parameters<typeof createServer>[0] = {},
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer(handlerOptions);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Test server did not expose an address");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.close();
      await once(server, "close");
    },
  };
}

describe("backend HTTP boundary", () => {
  it("serves health with JSON and a correlation id", async () => {
    const server = await withServer();
    try {
      const response = await fetch(`${server.baseUrl}/health`, {
        headers: { "x-correlation-id": "test-correlation" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("x-correlation-id")).toBe("test-correlation");
      await expect(response.json()).resolves.toEqual({ status: "ok" });
    } finally {
      await server.close();
    }
  });

  it("rejects a webhook body over the strict byte limit before processing", async () => {
    const processor = vi.fn<typeof processQrisNotification>();
    const server = await withServer({
      qrisTransaction: unavailableTransaction(),
      qrisNotificationProcessor: processor,
      maxWebhookBodyBytes: 16,
    });
    try {
      const response = await fetch(
        `${server.baseUrl}/v1/webhooks/midtrans-qris`,
        {
          method: "POST",
          body: "x".repeat(17),
        },
      );
      expect(response.status).toBe(413);
      expect(processor).not.toHaveBeenCalled();
      expect(await response.json()).toEqual({
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "The request body is too large.",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("passes the untouched body to the injected payment processor", async () => {
    const processor = vi
      .fn<typeof processQrisNotification>()
      .mockResolvedValue({
        kind: "APPLIED",
        eventId: "event-1",
        paymentId: "payment-1",
        orderId: "order-1",
        status: "PAID",
      });
    const rawBody = webhookBody();
    const originalKey = process.env.MIDTRANS_SERVER_KEY;
    process.env.MIDTRANS_SERVER_KEY = "sandbox-secret";
    const server = await withServer({
      qrisTransaction: unavailableTransaction(),
      qrisNotificationProcessor: processor,
    });
    try {
      const response = await fetch(
        `${server.baseUrl}/v1/webhooks/midtrans-qris`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: rawBody,
        },
      );
      expect(response.status).toBe(200);
      expect(processor).toHaveBeenCalledTimes(1);
      expect(processor.mock.calls[0]?.[0].rawBody).toBe(rawBody);
      expect(processor.mock.calls[0]?.[0].serverKey).toBe("sandbox-secret");
      expect(await response.json()).toEqual({ status: "acknowledged" });
    } finally {
      if (originalKey === undefined) delete process.env.MIDTRANS_SERVER_KEY;
      else process.env.MIDTRANS_SERVER_KEY = originalKey;
      await server.close();
    }
  });

  it("maps invalid webhook signatures to 401 without exposing provider details", async () => {
    const originalKey = process.env.MIDTRANS_SERVER_KEY;
    process.env.MIDTRANS_SERVER_KEY = "sandbox-secret";
    const server = await withServer({
      qrisTransaction: unavailableTransaction(),
    });
    try {
      const body = JSON.stringify({
        ...BASE_NOTIFICATION,
        signature_key: "0".repeat(128),
      });
      const response = await fetch(
        `${server.baseUrl}/v1/webhooks/midtrans-qris`,
        {
          method: "POST",
          body,
        },
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: {
          code: "PAYMENT_VERIFICATION_FAILED",
          message: "The payment notification could not be verified.",
        },
      });
    } finally {
      if (originalKey === undefined) delete process.env.MIDTRANS_SERVER_KEY;
      else process.env.MIDTRANS_SERVER_KEY = originalKey;
      await server.close();
    }
  });

  it("returns 401 for missing sessions and never invokes a household repository", async () => {
    const householdList = vi.fn<GuestHouseholdRepository["list"]>();
    const configured = repositories();
    configured.guestHouseholdRepository = {
      ...configured.guestHouseholdRepository,
      list: householdList,
    };
    const server = await withServer(configured);
    try {
      const response = await fetch(
        `${server.baseUrl}/v1/guest-households?weddingId=wedding-1`,
      );
      expect(response.status).toBe(401);
      expect(householdList).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("derives tenant scope from the wedding membership and returns a safe DTO", async () => {
    const findById = vi.fn<GuestHouseholdRepository["findById"]>();
    findById.mockResolvedValue(household());
    const configured = repositories();
    configured.guestHouseholdRepository = {
      ...configured.guestHouseholdRepository,
      findById,
    };
    const server = await withServer(configured);
    try {
      const response = await fetch(
        `${server.baseUrl}/v1/guest-households/household-1?weddingId=wedding-1&tenantId=attacker-tenant`,
        { headers: { cookie: `ws_session=${SESSION_TOKEN}` } },
      );
      expect(response.status).toBe(200);
      expect(findById).toHaveBeenCalledWith(
        { tenantId: "tenant-1", weddingId: "wedding-1" },
        "household-1",
      );
      expect(await response.json()).toEqual({
        data: {
          id: "household-1",
          weddingId: "wedding-1",
          displayName: "Keluarga A",
          maximumPax: 3,
          tokenVersion: 1,
          status: "ACTIVE",
          createdAt: "2026-09-14T00:00:00.000Z",
          updatedAt: "2026-09-14T00:00:00.000Z",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("requires weddingId for list and maps missing households to 404", async () => {
    const configured = repositories({ household: null });
    const server = await withServer(configured);
    try {
      const missingWedding = await fetch(
        `${server.baseUrl}/v1/guest-households`,
        { headers: { cookie: `ws_session=${SESSION_TOKEN}` } },
      );
      expect(missingWedding.status).toBe(400);

      const missingHousehold = await fetch(
        `${server.baseUrl}/v1/guest-households/unknown?weddingId=wedding-1`,
        { headers: { cookie: `ws_session=${SESSION_TOKEN}` } },
      );
      expect(missingHousehold.status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("rejects roles outside the guest-management role set", async () => {
    const server = await withServer(repositories({ role: "FINANCE" }));
    try {
      const response = await fetch(
        `${server.baseUrl}/v1/guest-households?weddingId=wedding-1`,
        { headers: { cookie: `ws_session=${SESSION_TOKEN}` } },
      );
      expect(response.status).toBe(403);
    } finally {
      await server.close();
    }
  });

  it("returns 503 when the database-backed auth boundary is unavailable", async () => {
    const server = await withServer({
      sessionRepository: {
        ...repositories().sessionRepository,
        findActiveByToken: async () => {
          throw new Error("connection refused");
        },
      },
      membershipRepository: repositories().membershipRepository,
      guestHouseholdRepository: repositories().guestHouseholdRepository,
    });
    try {
      const response = await fetch(
        `${server.baseUrl}/v1/guest-households?weddingId=wedding-1`,
        { headers: { cookie: `ws_session=${SESSION_TOKEN}` } },
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: {
          code: "PROVIDER_UNAVAILABLE",
          message: "The service is temporarily unavailable.",
        },
      });
    } finally {
      await server.close();
    }
  });
});

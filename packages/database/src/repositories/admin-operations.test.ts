import { describe, expect, it, vi } from "vitest";
import {
  decimalString,
  escalationStateForStuck,
  failureStageFor,
  formatAge,
  formatDuration,
  isPrintingStuck,
  maskIdentifier,
  maskRecipientRef,
  MAX_DELIVERY_ATTEMPTS,
  PrismaAdminOperationsRepository,
  queueFor,
  reconciliationState,
  retryStateFor,
  severityForPayment,
  shippingStatusFor,
  type AdminOperationsClient,
  type AdminOperationsScope,
} from "./admin-operations";

const NOW = new Date("2026-09-15T06:00:00.000Z");
const EARLIER = new Date("2026-09-15T03:00:00.000Z");

const SCOPE: AdminOperationsScope = {
  tenantId: "tenant-1",
  limit: 10,
  now: NOW,
};

function createClient(overrides: {
  payment?: Partial<AdminOperationsClient["payment"]>;
  notification?: Partial<AdminOperationsClient["notification"]>;
  outboxEvent?: Partial<AdminOperationsClient["outboxEvent"]>;
  invitationPublication?: Partial<
    AdminOperationsClient["invitationPublication"]
  >;
  printingOrder?: Partial<AdminOperationsClient["printingOrder"]>;
  supportCase?: Partial<AdminOperationsClient["supportCase"]>;
  template?: Partial<AdminOperationsClient["template"]>;
  auditEvent?: Partial<AdminOperationsClient["auditEvent"]>;
  invitation?: Partial<AdminOperationsClient["invitation"]>;
}): AdminOperationsClient {
  return {
    payment: { findMany: vi.fn().mockResolvedValue([]), ...overrides.payment },
    notification: {
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides.notification,
    },
    outboxEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides.outboxEvent,
    },
    invitationPublication: {
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides.invitationPublication,
    },
    printingOrder: {
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides.printingOrder,
    },
    supportCase: {
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides.supportCase,
    },
    template: {
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides.template,
    },
    auditEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides.auditEvent,
    },
    invitation: {
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides.invitation,
    },
  };
}

const paymentRow = {
  id: "payment-1",
  tenantId: "tenant-1",
  orderId: "order-1",
  provider: "midtrans",
  providerTransactionId: "b1e9d0f2-4a7c",
  method: "QRIS",
  status: "PAID",
  amountMinor: 250_000n,
  currency: "IDR",
  paidAt: EARLIER,
  updatedAt: EARLIER,
  order: {
    orderNumber: "WS-9F2K7QZ4AB",
    status: "PAID",
    userId: "user-9a3f",
    createdAt: EARLIER,
  },
};

describe("formatDuration", () => {
  it("reports a sub-minute gap as just now", () => {
    expect(formatDuration(EARLIER, new Date(EARLIER.getTime() + 30_000))).toBe(
      "baru saja",
    );
  });

  it("uses minutes, hours, then days", () => {
    expect(
      formatDuration(EARLIER, new Date(EARLIER.getTime() + 5 * 60_000)),
    ).toBe("5 menit");
    expect(
      formatDuration(EARLIER, new Date(EARLIER.getTime() + 3 * 3_600_000)),
    ).toBe("3 jam");
    expect(
      formatDuration(EARLIER, new Date(EARLIER.getTime() + 4 * 86_400_000)),
    ).toBe("4 hari");
  });

  it("never reports a negative age for a clock skew", () => {
    // A row timestamped slightly in the future must not render as a negative
    // duration on the console.
    expect(formatDuration(NOW, EARLIER)).toBe("baru saja");
  });

  it("is the same function the age column uses", () => {
    expect(formatAge(EARLIER, NOW)).toBe("3 jam");
  });
});

describe("maskIdentifier", () => {
  it("keeps a short prefix for correlation", () => {
    expect(maskIdentifier("user-9a3f4c2b")).toBe("us***");
  });

  it("never returns the original value", () => {
    const value = "tenant-secret-identifier";
    expect(maskIdentifier(value)).not.toBe(value);
  });

  it("handles very short and empty values", () => {
    expect(maskIdentifier("a")).toBe("a***");
    expect(maskIdentifier("")).toBe("***");
  });
});

describe("maskRecipientRef", () => {
  it("indicates presence without revealing the ciphertext", () => {
    expect(maskRecipientRef(true)).toBe("***");
    expect(maskRecipientRef(false)).toBe("(tidak ada)");
  });
});

describe("decimalString", () => {
  it("converts BigInt to a decimal string matching the contract pattern", () => {
    const value = decimalString(1_250_000n);
    expect(value).toBe("1250000");
    expect(value).toMatch(/^\d+$/);
  });
});

describe("severityForPayment", () => {
  it("ranks a failed payment critical", () => {
    expect(
      severityForPayment({
        paymentStatus: "FAILED",
        orderStatus: "PENDING_PAYMENT",
      }),
    ).toBe("critical");
  });

  it("ranks an expired payment as a warning", () => {
    expect(
      severityForPayment({
        paymentStatus: "EXPIRED",
        orderStatus: "PENDING_PAYMENT",
      }),
    ).toBe("warning");
  });

  it("ranks a paid payment healthy", () => {
    expect(
      severityForPayment({ paymentStatus: "PAID", orderStatus: "PAID" }),
    ).toBe("healthy");
  });

  it("treats an in-progress payment as informational", () => {
    expect(
      severityForPayment({
        paymentStatus: "PENDING",
        orderStatus: "PENDING_PAYMENT",
      }),
    ).toBe("info");
  });
});

describe("reconciliationState", () => {
  it("flags a payment marked paid with no paidAt as needing review", () => {
    // The notification flow writes `paidAt`; a PAID row without one means the
    // internal state and the provider record disagree.
    expect(reconciliationState({ paymentStatus: "PAID", paidAt: null })).toBe(
      "perlu ditinjau",
    );
  });

  it("reports a consistent payment", () => {
    expect(
      reconciliationState({ paymentStatus: "PAID", paidAt: EARLIER }),
    ).toBe("sesuai");
  });

  it("reports an unsettled payment as waiting", () => {
    expect(
      reconciliationState({ paymentStatus: "PENDING", paidAt: null }),
    ).toBe("menunggu");
  });
});

describe("retryStateFor", () => {
  it("distinguishes untried, retrying, and exhausted", () => {
    expect(retryStateFor(0)).toBe("belum dicoba");
    expect(retryStateFor(1)).toBe("dicoba ulang");
    expect(retryStateFor(MAX_DELIVERY_ATTEMPTS - 1)).toBe("dicoba ulang");
    expect(retryStateFor(MAX_DELIVERY_ATTEMPTS)).toBe("berhenti");
    expect(retryStateFor(99)).toBe("berhenti");
  });
});

describe("failureStageFor", () => {
  it("derives the stage from how far delivery got", () => {
    expect(
      failureStageFor({ attemptCount: 0, sentAt: null, deliveredAt: null }),
    ).toBe("antrean");
    expect(
      failureStageFor({ attemptCount: 2, sentAt: null, deliveredAt: null }),
    ).toBe("pengiriman");
    expect(
      failureStageFor({ attemptCount: 2, sentAt: EARLIER, deliveredAt: null }),
    ).toBe("penyedia");
    expect(
      failureStageFor({
        attemptCount: 2,
        sentAt: EARLIER,
        deliveredAt: EARLIER,
      }),
    ).toBe("terkirim");
  });
});

describe("queueFor", () => {
  it("names the model that drains the row", () => {
    expect(queueFor("notification")).toBe("notifikasi");
    expect(queueFor("outbox")).toBe("peristiwa");
  });
});

describe("isPrintingStuck", () => {
  it("flags a job with no provider update for more than three days", () => {
    expect(
      isPrintingStuck({
        status: "PRODUCTION",
        updatedAt: new Date(NOW.getTime() - 4 * 86_400_000),
        now: NOW,
      }),
    ).toBe(true);
  });

  it("does not flag a job that is moving", () => {
    expect(
      isPrintingStuck({ status: "PRODUCTION", updatedAt: EARLIER, now: NOW }),
    ).toBe(false);
  });

  it("never flags a terminal job", () => {
    const old = new Date(NOW.getTime() - 30 * 86_400_000);
    expect(
      isPrintingStuck({ status: "COMPLETED", updatedAt: old, now: NOW }),
    ).toBe(false);
    expect(
      isPrintingStuck({ status: "CANCELLED", updatedAt: old, now: NOW }),
    ).toBe(false);
  });
});

describe("escalationStateForStuck", () => {
  it("escalates a stuck job and leaves a moving one alone", () => {
    expect(escalationStateForStuck(true)).toBe("perlu dieskalasi");
    expect(escalationStateForStuck(false)).toBe("normal");
  });
});

describe("shippingStatusFor", () => {
  it("reports not-shipped when there is no shipment", () => {
    // Reporting the printing order's own status would claim progress that has
    // not happened.
    expect(shippingStatusFor([])).toBe("belum dikirim");
  });

  it("reports the most recent shipment", () => {
    expect(
      shippingStatusFor([{ status: "IN_TRANSIT" }, { status: "PENDING" }]),
    ).toBe("IN_TRANSIT");
  });
});

describe("PrismaAdminOperationsRepository.loadPayments", () => {
  it("scopes the query to the tenant and formats bigint and dates", async () => {
    const findMany = vi.fn().mockResolvedValue([paymentRow]);
    const repository = new PrismaAdminOperationsRepository(
      createClient({ payment: { findMany } }),
    );

    const rows = await repository.loadPayments(SCOPE);

    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: expect.anything(),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amountMinor).toBe("250000");
    expect(rows[0]?.currency).toBe("IDR");
    expect(rows[0]?.updatedAt).toBe(EARLIER.toISOString());
    expect(rows[0]?.age).toBe("3 jam");
  });

  it("masks the customer and never exposes the raw tenant or user id", async () => {
    const repository = new PrismaAdminOperationsRepository(
      createClient({
        payment: { findMany: vi.fn().mockResolvedValue([paymentRow]) },
      }),
    );

    const rows = await repository.loadPayments(SCOPE);
    const serialized = JSON.stringify(rows);

    expect(rows[0]?.maskedCustomer).toBe("te***");
    expect(serialized).not.toContain("tenant-1");
    expect(serialized).not.toContain("user-9a3f");
  });

  it("reports the provider status honestly rather than echoing the internal one", async () => {
    const repository = new PrismaAdminOperationsRepository(
      createClient({
        payment: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { ...paymentRow, status: "PAID", paidAt: null },
            ]),
        },
      }),
    );

    const rows = await repository.loadPayments(SCOPE);

    expect(rows[0]?.providerStatus).toBe("menunggu");
    expect(rows[0]?.reconciliation).toBe("perlu ditinjau");
  });

  it("reads across tenants only when the scope asks for it", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaAdminOperationsRepository(
      createClient({ payment: { findMany } }),
    );

    await repository.loadPayments({ ...SCOPE, tenantId: null });

    // A null tenant is a deliberate platform-wide read, spelled out as an empty
    // filter rather than a silently dropped check.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});

describe("PrismaAdminOperationsRepository.loadFailedJobs", () => {
  it("merges notifications and outbox events, most urgent first", async () => {
    const repository = new PrismaAdminOperationsRepository(
      createClient({
        notification: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "notif-1",
              tenantId: "tenant-1",
              channel: "EMAIL",
              templateCode: "auth.email-verification",
              status: "QUEUED",
              attemptCount: 1,
              lastError: null,
              sentAt: null,
              deliveredAt: null,
              createdAt: EARLIER,
              updatedAt: EARLIER,
            },
          ]),
        },
        outboxEvent: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "outbox-1",
              tenantId: "tenant-1",
              eventType: "order.paid",
              aggregateType: "Order",
              aggregateId: "order-1",
              status: "FAILED",
              attemptCount: 5,
              lastError: "provider rejected",
              lastAttemptAt: EARLIER,
              createdAt: EARLIER,
            },
          ]),
        },
      }),
    );

    const rows = await repository.loadFailedJobs(SCOPE);

    expect(rows).toHaveLength(2);
    // The failed outbox event outranks the merely queued notification.
    expect(rows[0]?.severity).toBe("critical");
    expect(rows[0]?.jobType).toBe("order.paid");
    expect(rows[0]?.retryState).toBe("berhenti");
    expect(rows[1]?.queue).toBe("notifikasi");
    expect(rows[1]?.retryState).toBe("dicoba ulang");
  });

  it("states plainly when no error was recorded", async () => {
    const repository = new PrismaAdminOperationsRepository(
      createClient({
        notification: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "notif-1",
              tenantId: "tenant-1",
              channel: "EMAIL",
              templateCode: "auth.password-reset",
              status: "FAILED",
              attemptCount: 3,
              lastError: null,
              sentAt: null,
              deliveredAt: null,
              createdAt: EARLIER,
              updatedAt: EARLIER,
            },
          ]),
        },
      }),
    );

    const rows = await repository.loadFailedJobs(SCOPE);

    expect(rows[0]?.failureReason).toBe("tidak ada kesalahan tercatat");
  });

  it("includes the tenant in both where clauses", async () => {
    const notificationFindMany = vi.fn().mockResolvedValue([]);
    const outboxFindMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaAdminOperationsRepository(
      createClient({
        notification: { findMany: notificationFindMany },
        outboxEvent: { findMany: outboxFindMany },
      }),
    );

    await repository.loadFailedJobs(SCOPE);

    expect(notificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-1" }),
      }),
    );
    expect(outboxFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-1" }),
      }),
    );
  });

  it("never selects the encrypted recipient reference", async () => {
    const notificationFindMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaAdminOperationsRepository(
      createClient({ notification: { findMany: notificationFindMany } }),
    );

    await repository.loadFailedJobs(SCOPE);

    const args = notificationFindMany.mock.calls[0]?.[0] as {
      select: Record<string, boolean>;
    };
    expect(args.select).toEqual(
      expect.not.objectContaining({ recipientRefEncrypted: true }),
    );
  });
});

describe("PrismaAdminOperationsRepository.loadPublicationFailures", () => {
  it("reads only inactive publications inside the tenant", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "publication-1",
        tenantId: "tenant-1",
        invitationId: "invitation-1",
        publicationVersion: 4,
        active: false,
        publishedAt: EARLIER,
        publishedBy: "user-9a3f",
        invitation: { slug: "rani-bima", status: "READY" },
      },
    ]);
    const repository = new PrismaAdminOperationsRepository(
      createClient({ invitationPublication: { findMany } }),
    );

    const rows = await repository.loadPublicationFailures(SCOPE);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", active: false },
      }),
    );
    expect(rows[0]?.invitationReference).toBe("rani-bima");
    expect(rows[0]?.attemptedVersion).toBe(4);
    // The live version is not readable from this row, and guessing it would
    // misreport which snapshot is serving traffic.
    expect(rows[0]?.currentPublishedVersion).toBeNull();
    expect(rows[0]?.owner).toBe("us***");
  });
});

describe("PrismaAdminOperationsRepository.loadPrinting", () => {
  const stuckRow = {
    id: "printing-1",
    tenantId: "tenant-1",
    weddingId: "wedding-1",
    orderId: "WS-9F2K7QZ4AB",
    status: "PRODUCTION",
    quantity: 100,
    createdAt: EARLIER,
    updatedAt: new Date(NOW.getTime() - 5 * 86_400_000),
    vendor: { businessName: "Percetakan Contoh" },
    shipments: [],
  };

  it("flags a stuck job and derives the shipping status", async () => {
    const repository = new PrismaAdminOperationsRepository(
      createClient({
        printingOrder: { findMany: vi.fn().mockResolvedValue([stuckRow]) },
      }),
    );

    const rows = await repository.loadPrinting(SCOPE);

    expect(rows[0]?.escalationState).toBe("perlu dieskalasi");
    expect(rows[0]?.shippingStatus).toBe("belum dikirim");
    expect(rows[0]?.stuckFor).toBe("5 hari");
    expect(rows[0]?.severity).toBe("high");
  });

  it("excludes terminal statuses and scopes to the tenant", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaAdminOperationsRepository(
      createClient({ printingOrder: { findMany } }),
    );

    await repository.loadPrinting(SCOPE);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      }),
    );
  });

  it("masks the workspace", async () => {
    const repository = new PrismaAdminOperationsRepository(
      createClient({
        printingOrder: { findMany: vi.fn().mockResolvedValue([stuckRow]) },
      }),
    );

    const rows = await repository.loadPrinting(SCOPE);
    expect(rows[0]?.maskedWorkspace).toBe("te***");
    expect(JSON.stringify(rows)).not.toContain("tenant-1");
  });
});

describe("PrismaAdminOperationsRepository.loadSupport", () => {
  it("excludes closed cases and reports an unassigned owner plainly", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "case-1",
        tenantId: "tenant-1",
        reference: "SUP-2026-0041",
        category: "pembayaran",
        severity: "high",
        status: "OPEN",
        owner: null,
        escalationState: "NONE",
        lastResponseAt: null,
        lastResponseBy: null,
        openedAt: EARLIER,
        updatedAt: EARLIER,
      },
    ]);
    const repository = new PrismaAdminOperationsRepository(
      createClient({ supportCase: { findMany } }),
    );

    const rows = await repository.loadSupport(SCOPE);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", status: { not: "CLOSED" } },
      }),
    );
    expect(rows[0]?.owner).toBe("belum ditugaskan");
    expect(rows[0]?.lastResponse).toBe("belum ada balasan");
    expect(rows[0]?.severity).toBe("high");
  });

  it("reports the last response as an age rather than inventing a responder", async () => {
    const repository = new PrismaAdminOperationsRepository(
      createClient({
        supportCase: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "case-2",
              tenantId: "tenant-1",
              reference: "SUP-2026-0042",
              category: "undangan",
              severity: "info",
              status: "IN_PROGRESS",
              owner: "Nadia",
              escalationState: "NONE",
              lastResponseAt: EARLIER,
              lastResponseBy: null,
              openedAt: EARLIER,
              updatedAt: EARLIER,
            },
          ]),
        },
      }),
    );

    const rows = await repository.loadSupport(SCOPE);
    expect(rows[0]?.lastResponse).toBe("3 jam");
    expect(rows[0]?.owner).toBe("Nadia");
  });
});

describe("PrismaAdminOperationsRepository.loadTemplates", () => {
  it("reads the shared catalog without a tenant filter", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "seruni-klasik",
        version: "1",
        name: "Seruni Klasik",
        category: "Klasik",
        tier: "STANDARD",
        status: "ACTIVE",
        licenseStatus: "VERIFIED",
        createdAt: EARLIER,
      },
    ]);
    const repository = new PrismaAdminOperationsRepository(
      createClient({ template: { findMany } }),
    );

    const rows = await repository.loadTemplates({ ...SCOPE, tenantId: null });

    // The catalog is shared across tenants, so this is deliberately unfiltered.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    expect(rows[0]?.templateId).toBe("seruni-klasik");
    expect(rows[0]?.readiness).toBe("VERIFIED");
    expect(rows[0]?.reason).toBe("siap");
  });

  it("reports an unmapped package link rather than guessing one", async () => {
    const repository = new PrismaAdminOperationsRepository(
      createClient({
        template: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "seruni-klasik",
              version: "1",
              name: "Seruni Klasik",
              category: "Klasik",
              tier: "STANDARD",
              status: "DRAFT",
              licenseStatus: "UNVERIFIED",
              createdAt: EARLIER,
            },
          ]),
        },
      }),
    );

    const rows = await repository.loadTemplates(SCOPE);
    expect(rows[0]?.packageLink).toBe("belum dipetakan");
    expect(rows[0]?.reason).toBe("menunggu verifikasi");
  });
});

describe("PrismaAdminOperationsRepository.loadAudit", () => {
  it("masks the actor and target and always reports masked", async () => {
    const repository = new PrismaAdminOperationsRepository(
      createClient({
        auditEvent: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "audit-1",
              tenantId: "tenant-1",
              userId: "user-9a3f",
              actorType: "ADMIN",
              action: "payment.refund",
              targetType: "Payment",
              targetId: "payment-1",
              reason: "permintaan pelanggan",
              correlationId: "corr-8831",
              createdAt: EARLIER,
            },
          ]),
        },
      }),
    );

    const rows = await repository.loadAudit(SCOPE);
    const serialized = JSON.stringify(rows);

    expect(rows[0]?.actor).toBe("us***");
    expect(rows[0]?.masked).toBe(true);
    expect(rows[0]?.target).toBe("Payment:pa***");
    expect(serialized).not.toContain("user-9a3f");
    expect(serialized).not.toContain("payment-1");
  });

  it("falls back to the actor type for a system-generated event", async () => {
    const repository = new PrismaAdminOperationsRepository(
      createClient({
        auditEvent: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "audit-2",
              tenantId: null,
              userId: null,
              actorType: "SYSTEM",
              action: "outbox.dispatched",
              targetType: "OutboxEvent",
              targetId: "outbox-1",
              reason: null,
              correlationId: "corr-1",
              createdAt: EARLIER,
            },
          ]),
        },
      }),
    );

    const rows = await repository.loadAudit(SCOPE);
    expect(rows[0]?.actor).toBe("SY***");
    expect(rows[0]?.reason).toBe("tidak dicatat");
  });

  it("scopes the query to the tenant when one is given", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaAdminOperationsRepository(
      createClient({ auditEvent: { findMany } }),
    );

    await repository.loadAudit(SCOPE);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-1" } }),
    );
  });
});

describe("PrismaAdminOperationsRepository.loadLifecycle", () => {
  it("surfaces a ready-but-unpublished invitation with an actionable suggestion", async () => {
    const repository = new PrismaAdminOperationsRepository(
      createClient({
        invitation: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "invitation-1",
              tenantId: "tenant-1",
              status: "READY",
              slug: "rani-bima",
              updatedAt: EARLIER,
            },
          ]),
        },
      }),
    );

    const rows = await repository.loadLifecycle(SCOPE);

    expect(rows[0]?.currentState).toBe("READY");
    expect(rows[0]?.expectedState).toBe("PUBLISHED");
    expect(rows[0]?.suggestedAction).toBe("minta pemilik menerbitkan undangan");
    expect(rows[0]?.severity).toBe("warning");
  });

  it("scopes to the tenant and to the READY state", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaAdminOperationsRepository(
      createClient({ invitation: { findMany } }),
    );

    await repository.loadLifecycle(SCOPE);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", status: "READY" },
      }),
    );
  });
});

describe("PrismaAdminOperationsRepository limit handling", () => {
  it("bounds an oversized limit so a caller cannot request the whole table", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaAdminOperationsRepository(
      createClient({ payment: { findMany } }),
    );

    await repository.loadPayments({ ...SCOPE, limit: 100_000 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
  });

  it("falls back to a sane page size for an invalid limit", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaAdminOperationsRepository(
      createClient({ payment: { findMany } }),
    );

    await repository.loadPayments({ ...SCOPE, limit: 0 });
    await repository.loadPayments({ ...SCOPE, limit: -5 });

    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ take: 50 }),
    );
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ take: 50 }),
    );
  });
});

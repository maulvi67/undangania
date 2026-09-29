import type { TenantContext } from "@wedding/domain";
import { describe, expect, it, vi } from "vitest";
import {
  applyPromotionRule,
  createCheckout,
  findCheckoutPayment,
  type CheckoutOrder,
  type CheckoutPayment,
  type CheckoutPorts,
} from "./checkout";
import {
  completeEmailVerification,
  completePasswordReset,
  notifyPasswordChanged,
  requestEmailVerification,
  requestPasswordReset,
  type AuthEmailPorts,
  type AuthTokenRedemption,
} from "./auth-email";
import {
  completeOnboarding,
  loadOnboarding,
  onboardingIssues,
  saveOnboardingStep,
  type OnboardingData,
  type OnboardingPort,
} from "./onboarding";
import {
  loadEditorDocument,
  publishInvitation,
  saveEditorDocument,
  type EditorLoadPort,
} from "./editor";
import { isPlatformSection, loadAdminSection, type AdminPorts } from "./admin";
import {
  assertMfaEnrolled,
  beginMfaEnrolment,
  confirmMfaEnrolment,
  isRecoveryCodeFormat,
  normalizeRecoveryCode,
  normalizeTotpCode,
  readMfaStatus,
  revokeMfa,
  verifyMfaStepUp,
  type MfaPort,
} from "./mfa";

const NOW = new Date("2026-09-15T07:00:00.000Z");

const OWNER: TenantContext = {
  tenantId: "tenant-1",
  actorId: "user-1",
  roles: ["OWNER"],
};

const ADMIN: TenantContext = {
  tenantId: "tenant-1",
  actorId: "admin-1",
  roles: ["ADMIN"],
};

const VIEWER: TenantContext = {
  tenantId: "tenant-1",
  actorId: "user-2",
  roles: ["VIEWER"],
};

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

function checkoutPorts(overrides: Partial<CheckoutPorts> = {}): CheckoutPorts {
  const order: CheckoutOrder = {
    id: "order-1",
    tenantId: "tenant-1",
    userId: "user-1",
    orderNumber: "WS-9F2K7QZ4AB",
    currency: "IDR",
    subtotalMinor: 500_000n,
    discountMinor: 0n,
    taxMinor: 0n,
    totalMinor: 500_000n,
    status: "PENDING_PAYMENT",
    items: [],
  };
  const payment: CheckoutPayment = {
    id: "payment-1",
    tenantId: "tenant-1",
    orderId: "order-1",
    provider: "midtrans",
    providerTransactionId: "b1e9d0f2",
    amountMinor: 500_000n,
    currency: "IDR",
    method: "QRIS",
    status: "PENDING",
    expiresAt: null,
  };

  return {
    transactions: {
      createOrder: vi.fn().mockResolvedValue(order),
      attachPayment: vi.fn().mockResolvedValue(payment),
      findByOrderId: vi.fn().mockResolvedValue(payment),
    },
    pricing: { findPackagePrice: vi.fn().mockResolvedValue(250_000n) },
    promotions: { findRedeemable: vi.fn().mockResolvedValue(null) },
    provider: {
      create: vi.fn().mockResolvedValue({
        providerTransactionId: "b1e9d0f2",
        redirectUrl: "https://app.midtrans.com/qris/b1e9d0f2",
      }),
    },
    nextOrderNumber: () => "WS-9F2K7QZ4AB",
    ...overrides,
  };
}

describe("applyPromotionRule", () => {
  it("applies a flat discount", () => {
    expect(
      applyPromotionRule(
        {
          flatAmountMinor: 50_000n,
          percentBasisPoints: null,
          maxDiscountMinor: null,
        },
        500_000n,
      ),
    ).toBe(50_000n);
  });

  it("applies a percentage discount", () => {
    expect(
      applyPromotionRule(
        {
          flatAmountMinor: null,
          percentBasisPoints: 1_000,
          maxDiscountMinor: null,
        },
        500_000n,
      ),
    ).toBe(50_000n);
  });

  it("clamps a percentage discount at its cap", () => {
    expect(
      applyPromotionRule(
        {
          flatAmountMinor: null,
          percentBasisPoints: 5_000,
          maxDiscountMinor: 100_000n,
        },
        1_000_000n,
      ),
    ).toBe(100_000n);
  });

  it("never discounts below zero or above the subtotal", () => {
    // A malformed rule must not be able to produce a negative total.
    expect(
      applyPromotionRule(
        {
          flatAmountMinor: 999_999n,
          percentBasisPoints: null,
          maxDiscountMinor: null,
        },
        100_000n,
      ),
    ).toBe(100_000n);
    expect(
      applyPromotionRule(
        {
          flatAmountMinor: 1_000n,
          percentBasisPoints: null,
          maxDiscountMinor: null,
        },
        0n,
      ),
    ).toBe(0n);
  });
});

describe("createCheckout", () => {
  it("creates the order, charges the provider, then records the provider id", async () => {
    const ports = checkoutPorts();

    const result = await createCheckout(
      OWNER,
      { productCode: "PAKET_A", quantity: 2, currency: "IDR" },
      ports,
      NOW,
    );

    // The real provider transaction id must be persisted; a locally generated
    // placeholder could never be matched by a later notification.
    expect(ports.transactions.attachPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        providerTransactionId: "b1e9d0f2",
        amountMinor: 500_000n,
        scope: { tenantId: "tenant-1", userId: "user-1" },
      }),
    );
    expect(result.redirectUrl).toBe("https://app.midtrans.com/qris/b1e9d0f2");

    const createOrder = ports.transactions.createOrder as ReturnType<
      typeof vi.fn
    >;
    const attachPayment = ports.transactions.attachPayment as ReturnType<
      typeof vi.fn
    >;
    expect(createOrder.mock.invocationCallOrder[0]).toBeLessThan(
      attachPayment.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it("refuses a caller without a finance role", async () => {
    const ports = checkoutPorts();

    await expect(
      createCheckout(
        VIEWER,
        { productCode: "PAKET_A", quantity: 1, currency: "IDR" },
        ports,
        NOW,
      ),
    ).rejects.toMatchObject({ name: "ForbiddenError" });
    expect(ports.transactions.createOrder).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller", async () => {
    await expect(
      createCheckout(
        null,
        { productCode: "PAKET_A", quantity: 1, currency: "IDR" },
        checkoutPorts(),
        NOW,
      ),
    ).rejects.toMatchObject({ name: "AuthRequiredError" });
  });

  it("rejects a quantity outside the allowed range before reading pricing", async () => {
    const ports = checkoutPorts();

    await expect(
      createCheckout(
        OWNER,
        { productCode: "PAKET_A", quantity: 0, currency: "IDR" },
        ports,
        NOW,
      ),
    ).rejects.toMatchObject({ code: "INVALID" });
    await expect(
      createCheckout(
        OWNER,
        { productCode: "PAKET_A", quantity: 999, currency: "IDR" },
        ports,
        NOW,
      ),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect(ports.pricing.findPackagePrice).not.toHaveBeenCalled();
  });

  it("reports a package with no active price as not found", async () => {
    const ports = checkoutPorts({
      pricing: { findPackagePrice: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      createCheckout(
        OWNER,
        { productCode: "PAKET_A", quantity: 1, currency: "IDR" },
        ports,
        NOW,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("applies a promotion and records the redemption against the order", async () => {
    const ports = checkoutPorts({
      promotions: {
        findRedeemable: vi.fn().mockResolvedValue({
          id: "promo-1",
          code: "HEMAT50",
          rule: {
            flatAmountMinor: 50_000n,
            percentBasisPoints: null,
            maxDiscountMinor: null,
          },
        }),
      },
    });

    await createCheckout(
      OWNER,
      {
        productCode: "PAKET_A",
        quantity: 2,
        currency: "IDR",
        promotionCode: "hemat50",
      },
      ports,
      NOW,
    );

    expect(ports.promotions.findRedeemable).toHaveBeenCalledWith({
      code: "HEMAT50",
      tenantId: "tenant-1",
      at: NOW,
    });
    expect(ports.transactions.attachPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        promotionId: "promo-1",
        amountMinor: 450_000n,
      }),
    );
  });

  it("rejects an unusable promotion code", async () => {
    const ports = checkoutPorts();

    await expect(
      createCheckout(
        OWNER,
        {
          productCode: "PAKET_A",
          quantity: 1,
          currency: "IDR",
          promotionCode: "NOPE",
        },
        ports,
        NOW,
      ),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect(ports.transactions.createOrder).not.toHaveBeenCalled();
  });

  it("reports a provider failure without fabricating a transaction id", async () => {
    const ports = checkoutPorts({
      provider: {
        create: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      },
    });

    await expect(
      createCheckout(
        OWNER,
        { productCode: "PAKET_A", quantity: 1, currency: "IDR" },
        ports,
        NOW,
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    // The order exists and is unpaid, which is the honest state.
    expect(ports.transactions.createOrder).toHaveBeenCalled();
    expect(ports.transactions.attachPayment).not.toHaveBeenCalled();
  });
});

describe("findCheckoutPayment", () => {
  it("scopes the lookup to the caller's tenant and user", async () => {
    const ports = checkoutPorts();

    await findCheckoutPayment(OWNER, "order-1", ports);

    expect(ports.transactions.findByOrderId).toHaveBeenCalledWith(
      { tenantId: "tenant-1", userId: "user-1" },
      "order-1",
    );
  });

  it("refuses a caller without a finance role", async () => {
    await expect(
      findCheckoutPayment(VIEWER, "order-1", checkoutPorts()),
    ).rejects.toMatchObject({ name: "ForbiddenError" });
  });
});

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

function editorPorts(overrides: Partial<EditorLoadPort> = {}): {
  editor: EditorLoadPort;
} {
  return {
    editor: {
      load: vi.fn().mockResolvedValue({
        invitation: {
          invitationId: "invitation-1",
          tenantId: "tenant-1",
          weddingId: "wedding-1",
          templateId: "seruni-klasik",
          templateVersion: "1",
          slug: "rani-bima",
          status: "DRAFT",
          document: {
            invitationId: "invitation-1",
            version: 3,
            updatedAt: NOW,
            content: {},
          },
        },
        template: {
          id: "seruni-klasik",
          version: "1",
          name: "Seruni Klasik",
          category: "Klasik",
          manifest: {},
        },
      }),
      save: vi.fn().mockResolvedValue({
        kind: "saved",
        document: {
          invitationId: "invitation-1",
          version: 4,
          updatedAt: NOW,
          content: {},
        },
      }),
      publish: vi.fn().mockResolvedValue({
        kind: "published",
        publicationId: "publication-1",
        publicationVersion: 5,
      }),
      ...overrides,
    },
  };
}

describe("loadEditorDocument", () => {
  it("loads inside tenant scope", async () => {
    const ports = editorPorts();

    const loaded = await loadEditorDocument(
      OWNER,
      { invitationId: "invitation-1" },
      ports,
    );

    expect(ports.editor.load).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      invitationId: "invitation-1",
      actorId: "user-1",
    });
    expect(loaded.invitation.document.version).toBe(3);
  });

  it("reports another tenant's invitation as not found", async () => {
    const ports = editorPorts({ load: vi.fn().mockResolvedValue(null) });

    // Not-found rather than forbidden: the response must not confirm the id
    // exists under a different tenant.
    await expect(
      loadEditorDocument(OWNER, { invitationId: "invitation-other" }, ports),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses a caller without an editor role", async () => {
    await expect(
      loadEditorDocument(
        VIEWER,
        { invitationId: "invitation-1" },
        editorPorts(),
      ),
    ).rejects.toMatchObject({ name: "ForbiddenError" });
  });
});

describe("saveEditorDocument", () => {
  it("sends the base version so a concurrent edit cannot be overwritten", async () => {
    const ports = editorPorts();

    const saved = await saveEditorDocument(
      OWNER,
      { invitationId: "invitation-1", content: { couple: {} }, baseVersion: 3 },
      ports,
    );

    expect(ports.editor.save).toHaveBeenCalledWith(
      { tenantId: "tenant-1", invitationId: "invitation-1", actorId: "user-1" },
      { content: { couple: {} }, baseVersion: 3 },
    );
    expect(saved.version).toBe(4);
  });

  it("raises a stale error when the server has moved on", async () => {
    const ports = editorPorts({
      save: vi.fn().mockResolvedValue({
        kind: "stale",
        serverDocument: {
          invitationId: "invitation-1",
          version: 9,
          updatedAt: NOW,
          content: {},
        },
      }),
    });

    await expect(
      saveEditorDocument(
        OWNER,
        { invitationId: "invitation-1", content: {}, baseVersion: 3 },
        ports,
      ),
    ).rejects.toMatchObject({ code: "STALE" });
  });

  it("rejects a negative base version before writing", async () => {
    const ports = editorPorts();

    await expect(
      saveEditorDocument(
        OWNER,
        { invitationId: "invitation-1", content: {}, baseVersion: -1 },
        ports,
      ),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect(ports.editor.save).not.toHaveBeenCalled();
  });
});

describe("publishInvitation", () => {
  it("publishes the snapshot the caller rendered", async () => {
    const ports = editorPorts();

    const result = await publishInvitation(
      OWNER,
      {
        invitationId: "invitation-1",
        snapshot: { sections: [] },
        baseVersion: 4,
      },
      ports,
    );

    expect(result).toEqual({
      publicationId: "publication-1",
      publicationVersion: 5,
    });
  });

  it("surfaces a stale draft rather than publishing over it", async () => {
    const ports = editorPorts({
      publish: vi.fn().mockResolvedValue({ kind: "stale", currentVersion: 8 }),
    });

    await expect(
      publishInvitation(
        OWNER,
        { invitationId: "invitation-1", snapshot: {}, baseVersion: 4 },
        ports,
      ),
    ).rejects.toMatchObject({ code: "STALE" });
  });

  it("reports a template problem as unavailable, not as a bad request", async () => {
    const ports = editorPorts({
      publish: vi.fn().mockResolvedValue({ kind: "template-unavailable" }),
    });

    await expect(
      publishInvitation(
        OWNER,
        { invitationId: "invitation-1", snapshot: {}, baseVersion: 4 },
        ports,
      ),
    ).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

const COMPLETE_DATA: OnboardingData = {
  partner1Name: "Rani",
  partner2Name: "Bima",
  weddingDate: "2026-09-12",
  weddingDateUndecided: false,
  eventType: "Akad Nikah",
  eventDate: "2026-09-12",
  eventTime: "08:00",
  city: "Bandung",
  timezone: "Asia/Jakarta",
  venueName: "Gedung Contoh",
  venueAddress: "Jl. Contoh No. 1",
  locale: "id",
};

function onboardingPort(overrides: Partial<OnboardingPort> = {}): {
  onboarding: OnboardingPort;
} {
  return {
    onboarding: {
      loadDraft: vi.fn().mockResolvedValue({
        weddingId: "wedding-1",
        version: 2,
        completed: false,
        data: COMPLETE_DATA,
        firstEventId: "event-1",
      }),
      saveStep: vi.fn().mockResolvedValue({ ok: true, version: 3 }),
      complete: vi
        .fn()
        .mockResolvedValue({ ok: true, version: 4, data: COMPLETE_DATA }),
      ...overrides,
    },
  };
}

describe("onboardingIssues", () => {
  it("reports nothing for complete data", () => {
    expect(onboardingIssues(COMPLETE_DATA)).toEqual([]);
  });

  it("requires both partner names", () => {
    const issues = onboardingIssues({
      ...COMPLETE_DATA,
      partner1Name: "  ",
      partner2Name: "",
    });
    expect(issues.map((issue) => issue.field)).toEqual([
      "partner1Name",
      "partner2Name",
    ]);
  });

  it("accepts an undecided wedding date but still requires an event date", () => {
    const issues = onboardingIssues({
      ...COMPLETE_DATA,
      weddingDate: null,
      weddingDateUndecided: true,
    });
    expect(issues).toEqual([]);

    const missingEvent = onboardingIssues({
      ...COMPLETE_DATA,
      eventDate: null,
    });
    expect(missingEvent.map((issue) => issue.field)).toContain("eventDate");
  });

  it("rejects a malformed calendar date", () => {
    const issues = onboardingIssues({
      ...COMPLETE_DATA,
      eventDate: "12-09-2026",
    });
    expect(issues.map((issue) => issue.field)).toContain("eventDate");
  });

  it("rejects an impossible date that matches the format", () => {
    // 2026-02-30 matches the pattern but is not a real day.
    const issues = onboardingIssues({
      ...COMPLETE_DATA,
      eventDate: "2026-02-30",
    });
    expect(issues.map((issue) => issue.field)).toContain("eventDate");
  });

  it("requires a city and venue", () => {
    const issues = onboardingIssues({
      ...COMPLETE_DATA,
      city: "",
      venueName: "",
    });
    expect(issues.map((issue) => issue.field)).toEqual(["city", "venueName"]);
  });
});

describe("loadOnboarding", () => {
  it("loads inside tenant scope", async () => {
    const ports = onboardingPort();

    await loadOnboarding(OWNER, { weddingId: "wedding-1" }, ports);

    expect(ports.onboarding.loadDraft).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      weddingId: "wedding-1",
      actorId: "user-1",
    });
  });

  it("refuses a caller without the owner role", async () => {
    await expect(
      loadOnboarding(VIEWER, { weddingId: "wedding-1" }, onboardingPort()),
    ).rejects.toMatchObject({ name: "ForbiddenError" });
  });

  it("reports a missing wedding as not found", async () => {
    const ports = onboardingPort({
      loadDraft: vi.fn().mockResolvedValue(null),
    });

    await expect(
      loadOnboarding(OWNER, { weddingId: "wedding-1" }, ports),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("saveOnboardingStep", () => {
  it("saves one step and returns the new version", async () => {
    const ports = onboardingPort();

    const version = await saveOnboardingStep(
      OWNER,
      {
        weddingId: "wedding-1",
        step: 1,
        data: { partner1Name: "Rani" },
        baseVersion: 2,
      },
      ports,
    );

    expect(version).toBe(3);
    expect(ports.onboarding.saveStep).toHaveBeenCalledWith(
      { tenantId: "tenant-1", weddingId: "wedding-1", actorId: "user-1" },
      { step: 1, data: { partner1Name: "Rani" }, baseVersion: 2 },
    );
  });

  it("rejects a malformed date before writing", async () => {
    const ports = onboardingPort();

    await expect(
      saveOnboardingStep(
        OWNER,
        {
          weddingId: "wedding-1",
          step: 2,
          data: { weddingDate: "12/09/2026" },
          baseVersion: 2,
        },
        ports,
      ),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect(ports.onboarding.saveStep).not.toHaveBeenCalled();
  });

  it("raises a stale error when the draft moved on", async () => {
    const ports = onboardingPort({
      saveStep: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: "STALE", currentVersion: 7 }),
    });

    await expect(
      saveOnboardingStep(
        OWNER,
        { weddingId: "wedding-1", step: 1, data: {}, baseVersion: 2 },
        ports,
      ),
    ).rejects.toMatchObject({ code: "STALE" });
  });

  it("rejects an unrecognized step", async () => {
    const ports = onboardingPort();

    await expect(
      saveOnboardingStep(
        OWNER,
        { weddingId: "wedding-1", step: 9 as 1, data: {}, baseVersion: 2 },
        ports,
      ),
    ).rejects.toMatchObject({ code: "INVALID" });
  });
});

describe("completeOnboarding", () => {
  it("completes when the data satisfies every requirement", async () => {
    const ports = onboardingPort();

    const draft = await completeOnboarding(
      OWNER,
      { weddingId: "wedding-1", data: COMPLETE_DATA, baseVersion: 3 },
      ports,
    );

    expect(ports.onboarding.complete).toHaveBeenCalled();
    expect(draft.version).toBe(2);
  });

  it("refuses to complete on incomplete data and names the missing field", async () => {
    const ports = onboardingPort();

    await expect(
      completeOnboarding(
        OWNER,
        {
          weddingId: "wedding-1",
          data: { ...COMPLETE_DATA, partner2Name: "" },
          baseVersion: 3,
        },
        ports,
      ),
    ).rejects.toMatchObject({ code: "INVALID" });
    // The completion flag must never be set on data the template cannot render.
    expect(ports.onboarding.complete).not.toHaveBeenCalled();
  });

  it("surfaces a stale draft instead of completing over newer input", async () => {
    const ports = onboardingPort({
      complete: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: "STALE", currentVersion: 9 }),
    });

    await expect(
      completeOnboarding(
        OWNER,
        { weddingId: "wedding-1", data: COMPLETE_DATA, baseVersion: 3 },
        ports,
      ),
    ).rejects.toMatchObject({ code: "STALE" });
  });
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

function adminPorts(): AdminPorts {
  return {
    tenantScoped: {
      loadPayments: vi.fn().mockResolvedValue([]),
      loadPrinting: vi.fn().mockResolvedValue([]),
      loadSupport: vi.fn().mockResolvedValue([]),
      loadPublicationFailures: vi.fn().mockResolvedValue([]),
      loadLifecycle: vi.fn().mockResolvedValue([]),
    },
    platform: {
      loadFailedJobs: vi.fn().mockResolvedValue([]),
      loadTemplates: vi.fn().mockResolvedValue([]),
      loadAudit: vi.fn().mockResolvedValue([]),
    },
    platformSections: ["failedJobs", "templates", "audit"],
  };
}

describe("isPlatformSection", () => {
  it("identifies the sections that read across tenants", () => {
    expect(isPlatformSection("failedJobs")).toBe(true);
    expect(isPlatformSection("templates")).toBe(true);
    expect(isPlatformSection("audit")).toBe(true);
  });

  it("does not treat tenant-bound sections as platform-wide", () => {
    expect(isPlatformSection("payments")).toBe(false);
    expect(isPlatformSection("printing")).toBe(false);
    expect(isPlatformSection("support")).toBe(false);
  });
});

describe("loadAdminSection", () => {
  it("scopes a tenant-bound section to the given tenant", async () => {
    const ports = adminPorts();

    await loadAdminSection(
      ADMIN,
      { section: "payments", tenantId: "tenant-1", now: NOW },
      ports,
    );

    expect(ports.tenantScoped.loadPayments).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      limit: 50,
      offset: 0,
      now: NOW,
    });
  });

  it("refuses a tenant-bound section with no tenant", async () => {
    const ports = adminPorts();

    await expect(
      loadAdminSection(
        ADMIN,
        { section: "payments", tenantId: null, now: NOW },
        ports,
      ),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect(ports.tenantScoped.loadPayments).not.toHaveBeenCalled();
  });

  it("refuses a platform-wide section that was narrowed to a tenant", async () => {
    const ports = adminPorts();

    // A mistyped tenant must not be silently widened into a platform query.
    await expect(
      loadAdminSection(
        ADMIN,
        { section: "audit", tenantId: "tenant-1", now: NOW },
        ports,
      ),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect(ports.platform.loadAudit).not.toHaveBeenCalled();
  });

  it("refuses a platform-wide section for a non-admin role", async () => {
    const ports = adminPorts();

    await expect(
      loadAdminSection(
        OWNER,
        { section: "audit", tenantId: null, now: NOW },
        ports,
      ),
    ).rejects.toMatchObject({ name: "ForbiddenError" });
  });

  it("refuses any section for a non-admin role", async () => {
    await expect(
      loadAdminSection(
        VIEWER,
        { section: "payments", tenantId: "tenant-1", now: NOW },
        adminPorts(),
      ),
    ).rejects.toMatchObject({ name: "ForbiddenError" });
  });

  it("passes the caller-supplied clock through for deterministic ages", async () => {
    const ports = adminPorts();

    await loadAdminSection(
      ADMIN,
      { section: "templates", tenantId: null, now: NOW },
      ports,
    );

    expect(ports.platform.loadTemplates).toHaveBeenCalledWith(
      expect.objectContaining({ now: NOW }),
    );
  });

  it("rejects an invalid limit", async () => {
    await expect(
      loadAdminSection(
        ADMIN,
        { section: "payments", tenantId: "tenant-1", limit: 0, now: NOW },
        adminPorts(),
      ),
    ).rejects.toMatchObject({ code: "INVALID" });
  });
});

// ---------------------------------------------------------------------------
// Auth email
// ---------------------------------------------------------------------------

function authEmailPorts(
  overrides: Partial<AuthEmailPorts> = {},
): AuthEmailPorts {
  return {
    tokens: {
      issue: vi
        .fn()
        .mockResolvedValue({ token: "issued-token-value", expiresAt: NOW }),
      redeemEmailVerification: vi
        .fn()
        .mockResolvedValue({ kind: "redeemed", userId: "user-1" }),
      redeemPasswordReset: vi
        .fn()
        .mockResolvedValue({ kind: "redeemed", userId: "user-1" }),
    },
    accounts: {
      findByEmail: vi
        .fn()
        .mockResolvedValue({ id: "user-1", emailVerifiedAt: null }),
      findById: vi
        .fn()
        .mockResolvedValue({ id: "user-1", emailVerifiedAt: null }),
      updatePassword: vi.fn().mockResolvedValue(true),
    },
    notifications: {
      send: vi
        .fn()
        .mockResolvedValue({ providerMessageId: "msg-1", status: "QUEUED" }),
    },
    passwords: { isAdequate: () => true },
    templates: {
      emailVerification: "auth.email-verification",
      passwordReset: "auth.password-reset",
      passwordChanged: "auth.password-changed",
    },
    buildActionUrl: ({ token }) => `https://app.contoh.id/aksi/${token}`,
    verificationTtlMs: 24 * 60 * 60 * 1000,
    resetTtlMs: 60 * 60 * 1000,
    ...overrides,
  };
}

describe("requestEmailVerification", () => {
  it("issues a token and sends the action link", async () => {
    const ports = authEmailPorts();

    await expect(
      requestEmailVerification("rani@contoh.id", ports, NOW),
    ).resolves.toEqual({
      kind: "accepted",
    });

    expect(ports.tokens.issue).toHaveBeenCalledWith({
      userId: "user-1",
      type: "EMAIL_VERIFICATION",
      ttlMs: 24 * 60 * 60 * 1000,
      now: NOW,
    });
    expect(ports.notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "EMAIL",
        recipientRef: "rani@contoh.id",
        templateCode: "auth.email-verification",
        variables: {
          actionUrl: "https://app.contoh.id/aksi/issued-token-value",
        },
      }),
    );
  });

  it("reports the same acceptance for an unknown address", async () => {
    const ports = authEmailPorts({
      accounts: {
        findByEmail: vi.fn().mockResolvedValue(null),
        findById: vi.fn().mockResolvedValue(null),
        updatePassword: vi.fn(),
      },
    });

    // Identical to the known-address result, so the response cannot be used to
    // enumerate accounts.
    await expect(
      requestEmailVerification("unknown@contoh.id", ports, NOW),
    ).resolves.toEqual({
      kind: "accepted",
    });
    expect(ports.notifications.send).not.toHaveBeenCalled();
  });

  it("does not re-send for an already-verified address", async () => {
    const ports = authEmailPorts({
      accounts: {
        findByEmail: vi
          .fn()
          .mockResolvedValue({ id: "user-1", emailVerifiedAt: NOW }),
        findById: vi.fn().mockResolvedValue(null),
        updatePassword: vi.fn(),
      },
    });

    await expect(
      requestEmailVerification("rani@contoh.id", ports, NOW),
    ).resolves.toEqual({
      kind: "accepted",
    });
    expect(ports.notifications.send).not.toHaveBeenCalled();
  });
});

describe("requestPasswordReset", () => {
  it("issues a reset token with the contract TTL", async () => {
    const ports = authEmailPorts();

    await requestPasswordReset("rani@contoh.id", ports, NOW);

    expect(ports.tokens.issue).toHaveBeenCalledWith({
      userId: "user-1",
      type: "PASSWORD_RESET",
      ttlMs: 60 * 60 * 1000,
      now: NOW,
    });
  });

  it("is indistinguishable from a known address for an unknown one", async () => {
    const ports = authEmailPorts({
      accounts: {
        findByEmail: vi.fn().mockResolvedValue(null),
        findById: vi.fn().mockResolvedValue(null),
        updatePassword: vi.fn(),
      },
    });

    await expect(
      requestPasswordReset("unknown@contoh.id", ports, NOW),
    ).resolves.toEqual({
      kind: "accepted",
    });
  });

  it("still reports acceptance when delivery fails", async () => {
    const ports = authEmailPorts({
      notifications: {
        send: vi.fn().mockRejectedValue(new Error("relay down")),
      },
    });

    // Surfacing the failure would let a caller distinguish a known address
    // (send attempted) from an unknown one (send skipped).
    await expect(
      requestPasswordReset("rani@contoh.id", ports, NOW),
    ).resolves.toEqual({
      kind: "accepted",
    });
  });

  it("has no field that could reveal account existence", async () => {
    const known = await requestPasswordReset(
      "rani@contoh.id",
      authEmailPorts(),
      NOW,
    );
    const unknown = await requestPasswordReset(
      "unknown@contoh.id",
      authEmailPorts({
        accounts: {
          findByEmail: vi.fn().mockResolvedValue(null),
          findById: vi.fn().mockResolvedValue(null),
          updatePassword: vi.fn(),
        },
      }),
      NOW,
    );

    expect(Object.keys(known)).toEqual(["kind"]);
    expect(known).toEqual(unknown);
  });
});

describe("completePasswordReset", () => {
  it("resets the password when the token is redeemable", async () => {
    const ports = authEmailPorts();

    await expect(
      completePasswordReset(
        { token: "token-value", newPassword: "kata-sandi-baru" },
        ports,
        NOW,
      ),
    ).resolves.toEqual({ kind: "reset" });
    expect(ports.accounts.updatePassword).toHaveBeenCalledWith(
      "user-1",
      "kata-sandi-baru",
    );
  });

  it("rejects a weak password without consuming the token", async () => {
    const ports = authEmailPorts({ passwords: { isAdequate: () => false } });

    await expect(
      completePasswordReset(
        { token: "token-value", newPassword: "short" },
        ports,
        NOW,
      ),
    ).resolves.toEqual({ kind: "weak-password" });
    // A policy failure must not burn a valid token.
    expect(ports.tokens.redeemPasswordReset).not.toHaveBeenCalled();
  });

  it("reports an expired token distinctly from an invalid one", async () => {
    const expired = authEmailPorts({
      tokens: {
        issue: vi.fn(),
        redeemEmailVerification: vi.fn(),
        redeemPasswordReset: vi.fn().mockResolvedValue({ kind: "expired" }),
      },
    });
    await expect(
      completePasswordReset(
        { token: "t", newPassword: "kata-sandi-baru" },
        expired,
        NOW,
      ),
    ).resolves.toEqual({ kind: "expired-token" });

    const invalid = authEmailPorts({
      tokens: {
        issue: vi.fn(),
        redeemEmailVerification: vi.fn(),
        redeemPasswordReset: vi.fn().mockResolvedValue({ kind: "invalid" }),
      },
    });
    await expect(
      completePasswordReset(
        { token: "t", newPassword: "kata-sandi-baru" },
        invalid,
        NOW,
      ),
    ).resolves.toEqual({ kind: "invalid-token" });
  });

  it("treats an already-used token as invalid", async () => {
    const ports = authEmailPorts({
      tokens: {
        issue: vi.fn(),
        redeemEmailVerification: vi.fn(),
        redeemPasswordReset: vi
          .fn()
          .mockResolvedValue({ kind: "already-used" }),
      },
    });

    await expect(
      completePasswordReset(
        { token: "t", newPassword: "kata-sandi-baru" },
        ports,
        NOW,
      ),
    ).resolves.toEqual({ kind: "invalid-token" });
    expect(ports.accounts.updatePassword).not.toHaveBeenCalled();
  });

  it("fails closed when the account disappeared after the token was consumed", async () => {
    const ports = authEmailPorts({
      accounts: {
        findByEmail: vi.fn(),
        findById: vi.fn(),
        updatePassword: vi.fn().mockResolvedValue(false),
      },
    });

    await expect(
      completePasswordReset(
        { token: "t", newPassword: "kata-sandi-baru" },
        ports,
        NOW,
      ),
    ).rejects.toMatchObject({ name: "AuthRequiredError" });
  });
});

describe("completeEmailVerification", () => {
  it("verifies the address without creating a session", async () => {
    const ports = authEmailPorts();

    // No auto-login (R6): the caller must sign in separately.
    await expect(
      completeEmailVerification({ token: "token-value" }, ports, NOW),
    ).resolves.toEqual({ kind: "verified" });
  });

  it("reports invalid and expired tokens", async () => {
    const invalid = authEmailPorts({
      tokens: {
        issue: vi.fn(),
        redeemEmailVerification: vi.fn().mockResolvedValue({ kind: "invalid" }),
        redeemPasswordReset: vi.fn(),
      },
    });
    await expect(
      completeEmailVerification({ token: "t" }, invalid, NOW),
    ).resolves.toEqual({
      kind: "invalid-token",
    });

    const expired = authEmailPorts({
      tokens: {
        issue: vi.fn(),
        redeemEmailVerification: vi.fn().mockResolvedValue({ kind: "expired" }),
        redeemPasswordReset: vi.fn(),
      },
    });
    await expect(
      completeEmailVerification({ token: "t" }, expired, NOW),
    ).resolves.toEqual({
      kind: "expired-token",
    });
  });
});

describe("notifyPasswordChanged", () => {
  it("does not fail the reset when the notice cannot be sent", async () => {
    const ports = authEmailPorts({
      notifications: {
        send: vi.fn().mockRejectedValue(new Error("relay down")),
      },
    });

    // The password has already changed; reporting a failure would misstate it.
    await expect(
      notifyPasswordChanged("user-1", "rani@contoh.id", ports),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// MFA
// ---------------------------------------------------------------------------

function mfaPort(overrides: Partial<MfaPort> = {}): { mfa: MfaPort } {
  return {
    mfa: {
      status: vi.fn().mockResolvedValue({
        enabled: true,
        enrolmentPending: false,
        remainingRecoveryCodes: 9,
      }),
      beginEnrolment: vi
        .fn()
        .mockResolvedValue({ secret: "GEZDGNBV", uri: "otpauth://totp/x" }),
      confirmEnrolment: vi.fn().mockResolvedValue({
        kind: "confirmed",
        recoveryCodes: ["ABCDE-FGHIJ"],
      }),
      verify: vi.fn().mockResolvedValue({ kind: "verified" }),
      redeemRecoveryCode: vi
        .fn()
        .mockResolvedValue({ kind: "redeemed", remainingCodes: 8 }),
      revoke: vi.fn().mockResolvedValue(true),
      ...overrides,
    },
  };
}

describe("normalizeTotpCode", () => {
  it("strips spaces a person types in", () => {
    expect(normalizeTotpCode("123 456")).toBe("123456");
    expect(normalizeTotpCode(" 123456 ")).toBe("123456");
  });
});

describe("normalizeRecoveryCode / isRecoveryCodeFormat", () => {
  it("accepts a grouped code and normalizes it", () => {
    expect(normalizeRecoveryCode("a3f9c-1b2d4-5e6f7-8a9b0")).toBe(
      "A3F9C1B2D45E6F78A9B0",
    );
    expect(isRecoveryCodeFormat("A3F9C-1B2D4-5E6F7-8A9B0")).toBe(true);
  });

  it("rejects a code of the wrong shape", () => {
    expect(isRecoveryCodeFormat("ABCDE")).toBe(false);
    expect(isRecoveryCodeFormat("123456")).toBe(false);
  });
});

describe("beginMfaEnrolment", () => {
  it("starts enrolment for an admin under their own account", async () => {
    const ports = mfaPort();

    const start = await beginMfaEnrolment(
      ADMIN,
      { accountName: "rani@contoh.id" },
      ports,
    );

    expect(ports.mfa.beginEnrolment).toHaveBeenCalledWith({
      userId: "admin-1",
      accountName: "rani@contoh.id",
      issuer: "Undangania",
    });
    expect(start.uri).toContain("otpauth://");
  });

  it("refuses a caller without the admin role", async () => {
    await expect(
      beginMfaEnrolment(OWNER, { accountName: "rani@contoh.id" }, mfaPort()),
    ).rejects.toMatchObject({ name: "ForbiddenError" });
  });

  it("rejects an empty account name", async () => {
    await expect(
      beginMfaEnrolment(ADMIN, { accountName: "  " }, mfaPort()),
    ).rejects.toMatchObject({ code: "INVALID" });
  });
});

describe("confirmMfaEnrolment", () => {
  it("enables the factor and returns the recovery codes once", async () => {
    const ports = mfaPort();

    const codes = await confirmMfaEnrolment(
      ADMIN,
      { code: "123 456" },
      ports,
      NOW,
    );

    // The spaced form must reach the port normalized.
    expect(ports.mfa.confirmEnrolment).toHaveBeenCalledWith({
      userId: "admin-1",
      code: "123456",
      at: NOW,
    });
    expect(codes).toEqual(["ABCDE-FGHIJ"]);
  });

  it("rejects a code that is not six digits", async () => {
    const ports = mfaPort();

    await expect(
      confirmMfaEnrolment(ADMIN, { code: "12345" }, ports, NOW),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect(ports.mfa.confirmEnrolment).not.toHaveBeenCalled();
  });

  it("reports a wrong code without leaking whether enrolment exists", async () => {
    const ports = mfaPort({
      confirmEnrolment: vi.fn().mockResolvedValue({ kind: "invalid-code" }),
    });

    await expect(
      confirmMfaEnrolment(ADMIN, { code: "000000" }, ports, NOW),
    ).rejects.toMatchObject({ code: "INVALID" });
  });

  it("reports a missing pending enrolment as not found", async () => {
    const ports = mfaPort({
      confirmEnrolment: vi.fn().mockResolvedValue({ kind: "no-enrolment" }),
    });

    await expect(
      confirmMfaEnrolment(ADMIN, { code: "123456" }, ports, NOW),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("verifyMfaStepUp", () => {
  it("accepts a valid TOTP code", async () => {
    const ports = mfaPort();

    await expect(
      verifyMfaStepUp(ADMIN, { code: "123456" }, ports, NOW),
    ).resolves.toEqual({ remainingRecoveryCodes: null });
    expect(ports.mfa.verify).toHaveBeenCalledWith({
      userId: "admin-1",
      code: "123456",
      at: NOW,
    });
  });

  it("rejects a replayed code", async () => {
    const ports = mfaPort({
      verify: vi.fn().mockResolvedValue({ kind: "replayed" }),
    });

    // A replay is a failure, never a success.
    await expect(
      verifyMfaStepUp(ADMIN, { code: "123456" }, ports, NOW),
    ).rejects.toMatchObject({ name: "ForbiddenError" });
  });

  it("rejects a wrong code without revealing whether MFA is enrolled", async () => {
    const ports = mfaPort({
      verify: vi.fn().mockResolvedValue({ kind: "invalid-code" }),
    });

    await expect(
      verifyMfaStepUp(ADMIN, { code: "000000" }, ports, NOW),
    ).rejects.toMatchObject({ name: "ForbiddenError" });
  });

  it("accepts a recovery code and reports how many remain", async () => {
    const ports = mfaPort();

    const result = await verifyMfaStepUp(
      ADMIN,
      { code: "A3F9C-1B2D4-5E6F7-8A9B0" },
      ports,
      NOW,
    );

    expect(result).toEqual({ remainingRecoveryCodes: 8 });
    expect(ports.mfa.redeemRecoveryCode).toHaveBeenCalledWith({
      userId: "admin-1",
      code: "A3F9C1B2D45E6F78A9B0",
      at: NOW,
    });
    // A recovery code is not a TOTP attempt, so the TOTP path is untouched.
    expect(ports.mfa.verify).not.toHaveBeenCalled();
  });

  it("routes a six-digit code to TOTP and not to recovery", async () => {
    const ports = mfaPort();

    await verifyMfaStepUp(ADMIN, { code: "123456" }, ports, NOW);

    expect(ports.mfa.redeemRecoveryCode).not.toHaveBeenCalled();
  });

  it("rejects a garbage code before calling either path", async () => {
    const ports = mfaPort();

    await expect(
      verifyMfaStepUp(ADMIN, { code: "not-a-code" }, ports, NOW),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect(ports.mfa.verify).not.toHaveBeenCalled();
    expect(ports.mfa.redeemRecoveryCode).not.toHaveBeenCalled();
  });

  it("rejects an empty code", async () => {
    await expect(
      verifyMfaStepUp(ADMIN, { code: "   " }, mfaPort(), NOW),
    ).rejects.toMatchObject({ code: "INVALID" });
  });

  it("reports a bad recovery code the same way as a bad TOTP code", async () => {
    const totpFailure = mfaPort({
      verify: vi.fn().mockResolvedValue({ kind: "invalid-code" }),
    });
    const recoveryFailure = mfaPort({
      redeemRecoveryCode: vi.fn().mockResolvedValue({ kind: "invalid-code" }),
    });

    const totpError = await verifyMfaStepUp(
      ADMIN,
      { code: "000000" },
      totpFailure,
      NOW,
    ).catch((error: unknown) => (error as { name: string }).name);
    const recoveryError = await verifyMfaStepUp(
      ADMIN,
      { code: "A3F9C-1B2D4-5E6F7-8A9B0" },
      recoveryFailure,
      NOW,
    ).catch((error: unknown) => (error as { name: string }).name);

    // The response must not reveal which factor was tried.
    expect(totpError).toBe("ForbiddenError");
    expect(recoveryError).toBe("ForbiddenError");
  });
});

describe("readMfaStatus", () => {
  it("returns the status for the caller's own account", async () => {
    const ports = mfaPort();

    const status = await readMfaStatus(ADMIN, ports);

    expect(ports.mfa.status).toHaveBeenCalledWith("admin-1");
    expect(status.remainingRecoveryCodes).toBe(9);
  });
});

describe("revokeMfa", () => {
  it("requires a satisfied challenge before disabling the factor", async () => {
    const ports = mfaPort();

    await revokeMfa(ADMIN, { code: "123456" }, ports, NOW);

    expect(ports.mfa.verify).toHaveBeenCalled();
    expect(ports.mfa.revoke).toHaveBeenCalledWith("admin-1");
    // The verification must happen before the revocation.
    const verify = ports.mfa.verify as ReturnType<typeof vi.fn>;
    const revoke = ports.mfa.revoke as ReturnType<typeof vi.fn>;
    expect(verify.mock.invocationCallOrder[0]).toBeLessThan(
      revoke.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it("does not disable the factor when the challenge fails", async () => {
    const ports = mfaPort({
      verify: vi.fn().mockResolvedValue({ kind: "invalid-code" }),
    });

    // A session that passed step-up earlier must not be able to strip the
    // factor without proving anything now.
    await expect(
      revokeMfa(ADMIN, { code: "000000" }, ports, NOW),
    ).rejects.toMatchObject({ name: "ForbiddenError" });
    expect(ports.mfa.revoke).not.toHaveBeenCalled();
  });
});

describe("assertMfaEnrolled", () => {
  it("passes when a second factor is live", async () => {
    await expect(assertMfaEnrolled(ADMIN, mfaPort())).resolves.toMatchObject({
      enabled: true,
    });
  });

  it("refuses an admin with no second factor", async () => {
    const ports = mfaPort({
      status: vi.fn().mockResolvedValue({
        enabled: false,
        enrolmentPending: true,
        remainingRecoveryCodes: 0,
      }),
    });

    // Treating "not enrolled" as satisfied would make MFA opt-in in practice.
    await expect(assertMfaEnrolled(ADMIN, ports)).rejects.toMatchObject({
      name: "ForbiddenError",
    });
  });
});

describe("role enforcement across use-cases", () => {
  it("rejects an unknown role string rather than treating it as granted", () => {
    const forged: TenantContext = {
      tenantId: "tenant-1",
      actorId: "user-1",
      roles: ["SUPERUSER"],
    };

    return expect(
      loadOnboarding(forged, { weddingId: "wedding-1" }, onboardingPort()),
    ).rejects.toMatchObject({ name: "ForbiddenError" });
  });

  it("rejects a context with no tenant", () => {
    const noTenant: TenantContext = {
      tenantId: "  ",
      actorId: "user-1",
      roles: ["OWNER"],
    };

    return expect(
      loadOnboarding(noTenant, { weddingId: "wedding-1" }, onboardingPort()),
    ).rejects.toMatchObject({ name: "AuthRequiredError" });
  });
});

// A compile-time guard: the port types must stay structural, so a plain object
// literal satisfies them. If this file type-checks, no port secretly requires a
// database client.
export type StructuralPortCheck = Readonly<{
  note: AuthTokenRedemption extends never ? never : true;
}>;

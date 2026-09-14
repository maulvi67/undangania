import { describe, expect, it } from "vitest";
import {
  loadCheckoutFixture,
  safeOrderReference,
  statusCopy,
  validateCoupon,
} from "./stub-transport";

describe("checkout fixture transport", () => {
  it("returns an immutable-looking order snapshot for active templates", () => {
    const result = loadCheckoutFixture("nara-modern");
    expect(result?.order.templateId).toBe("nara-modern");
    expect(result?.order.currency).toBe("IDR");
    expect(result?.order.paymentMethod).toBe("QRIS");
    expect(result?.order.coreFeatures.length).toBeGreaterThan(3);
    expect(loadCheckoutFixture("cempaka-lama")).toBeNull();
  });

  it("validates only the documented fixture coupon", async () => {
    await expect(validateCoupon("RAPIH10")).resolves.toMatchObject({
      status: "VALID",
      discountMinor: "10000",
    });
    await expect(validateCoupon("salah")).resolves.toMatchObject({
      status: "INVALID",
    });
  });

  it("keeps delayed confirmation distinct from paid", () => {
    expect(statusCopy("DELAYED").title).toBe("Konfirmasi pembayaran tertunda");
    expect(statusCopy("PAID").title).toBe("Pembayaran terkonfirmasi");
  });

  it("only displays safe support references", () => {
    expect(safeOrderReference("WS-20260911-001")).toBe("WS-20260911-001");
    expect(safeOrderReference("provider-secret")).toBe("WS-—");
  });
});

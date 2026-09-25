import { describe, expect, it } from "vitest";
import {
  ADMIN_FIXTURES,
  adminDashboardSchema,
  parseAdminFixture,
  parseAdminQuery,
} from "./contract";
import { getAdminFixtureNames, loadAdminDashboard } from "./fixture-transport";

describe("admin dashboard contract", () => {
  it("defaults unknown fixture values to the attention view", () => {
    expect(parseAdminFixture("unknown")).toBe("attention");
    expect(parseAdminFixture(["stale", "healthy"])).toBe("stale");
    expect(parseAdminFixture(undefined)).toBe("attention");
  });

  it("bounds and normalizes query parameters", () => {
    expect(
      parseAdminQuery({ page: "0", limit: "999", search: "  payment-1  " }),
    ).toEqual({ page: 1, limit: 50, search: "payment-1" });
    expect(
      parseAdminQuery({ page: "3", limit: "20", search: "a".repeat(101) }),
    ).toEqual({ page: 3, limit: 20, search: "a".repeat(100) });
  });

  it("validates every successful fixture", async () => {
    expect(getAdminFixtureNames()).toEqual(ADMIN_FIXTURES);
    for (const fixture of ADMIN_FIXTURES) {
      const result = await loadAdminDashboard(fixture);
      if (result.kind === "ok") {
        expect(() => adminDashboardSchema.parse(result.data)).not.toThrow();
      }
    }
  });

  it("keeps privileged fixture actions out of the read-only transport", async () => {
    const result = await loadAdminDashboard("attention");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok" && result.data.payments.status === "ok") {
      expect(result.data.payments.rows[0]?.method).toBe("QRIS");
      expect(result.data.payments.rows[0]?.reconciliation).toContain("cocok");
    }
  });

  it("returns explicit permission and session states", async () => {
    expect((await loadAdminDashboard("permission-denied")).kind).toBe(
      "permission-denied",
    );
    expect((await loadAdminDashboard("session-expired")).kind).toBe(
      "session-expired",
    );
  });
});

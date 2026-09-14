import { describe, expect, it } from "vitest";
import {
  ADMIN_FIXTURES,
  adminDashboardSchema,
  parseAdminFixture,
} from "./contract";
import { getAdminFixtureNames, loadAdminDashboard } from "./fixture-transport";

describe("admin dashboard contract", () => {
  it("defaults unknown fixture values to the attention view", () => {
    expect(parseAdminFixture("unknown")).toBe("attention");
    expect(parseAdminFixture(["stale", "healthy"])).toBe("stale");
    expect(parseAdminFixture(undefined)).toBe("attention");
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

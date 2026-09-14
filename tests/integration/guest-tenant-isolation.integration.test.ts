import { describe, expect, it } from "vitest";
import {
  assertHouseholdBelongsToWorkspace,
  tenantScopedGuestResourceKey,
} from "../../apps/customer-web/src/lib/guests/stub-transport";

/**
 * This contract test protects the planned tenant-scoped transport boundary.
 * The fixture transport is not a live repository and cannot prove database
 * isolation; the production repository test remains a release blocker.
 */
describe("guest tenant isolation boundary", () => {
  it("includes tenant and wedding scope in guest resource keys", () => {
    expect(tenantScopedGuestResourceKey("tenant-a", "wedding-a", "household-a")).toBe(
      "guest:tenant-a:wedding-a:household-a",
    );
    expect(tenantScopedGuestResourceKey("tenant-b", "wedding-a", "household-a")).not.toBe(
      tenantScopedGuestResourceKey("tenant-a", "wedding-a", "household-a"),
    );
  });

  it("rejects a household outside the authorized workspace set", () => {
    expect(() => assertHouseholdBelongsToWorkspace("household-b", ["household-a"])).toThrow(
      "HOUSEHOLD_NOT_IN_WORKSPACE",
    );
    expect(() => assertHouseholdBelongsToWorkspace("household-a", ["household-a"])).not.toThrow();
  });

  it.todo("prove Tenant A/B list, detail, mutation, import, and export isolation against live repositories");
});

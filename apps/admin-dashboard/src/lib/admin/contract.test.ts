import { describe, expect, it } from "vitest";
import { parseAdminQuery } from "./contract";

describe("admin dashboard contract", () => {
  it("bounds and normalizes query parameters", () => {
    expect(
      parseAdminQuery({ page: "0", limit: "999", search: "  payment-1  " }),
    ).toEqual({ page: 1, limit: 50, search: "payment-1" });
    expect(
      parseAdminQuery({ page: "3", limit: "20", search: "a".repeat(101) }),
    ).toEqual({ page: 3, limit: 20, search: "a".repeat(100) });
  });
});

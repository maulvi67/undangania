import { describe, expect, it } from "vitest";
import {
  addMinorUnits,
  formatIdrMinor,
  parseCheckoutState,
  parsePaymentStatusState,
  subtractMinorUnits,
} from "./contract";

describe("checkout contract", () => {
  it("normalizes known and unknown UI states safely", () => {
    expect(parseCheckoutState("payment-creating")).toBe("PAYMENT_CREATING");
    expect(parseCheckoutState("not-a-state")).toBe("READY");
    expect(parsePaymentStatusState("paid")).toBe("PAID");
    expect(parsePaymentStatusState(undefined)).toBe("VERIFYING");
  });

  it("formats and calculates IDR minor units without floating point", () => {
    expect(formatIdrMinor("349000")).toMatch(/^Rp[\s\u00A0]?349\.000$/);
    expect(addMinorUnits("149000", "10000")).toBe("159000");
    expect(subtractMinorUnits("149000", "10000")).toBe("139000");
  });

  it("rejects malformed or negative money calculations", () => {
    expect(() => formatIdrMinor("149000.00")).not.toThrow();
    expect(formatIdrMinor("not-money")).toBe("Rp —");
    expect(() => addMinorUnits("149000.00", "10000")).toThrow(
      "Invalid monetary value",
    );
    expect(() => subtractMinorUnits("1000", "1001")).toThrow(
      "cannot be negative",
    );
  });
});

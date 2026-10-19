import { describe, expect, it } from "vitest";
import { AuthAppUrlError, resolveAuthAppUrl } from "./app-url";

describe("resolveAuthAppUrl", () => {
  it("prefers APP_URL", () => {
    expect(
      resolveAuthAppUrl({
        APP_URL: "https://undangania.test",
        NEXT_PUBLIC_SITE_URL: "https://other.test",
      }),
    ).toBe("https://undangania.test");
  });

  it("falls back to NEXT_PUBLIC_SITE_URL", () => {
    expect(
      resolveAuthAppUrl({ NEXT_PUBLIC_SITE_URL: "https://undangania.test" }),
    ).toBe("https://undangania.test");
  });

  it("uses localhost outside production", () => {
    expect(resolveAuthAppUrl({ NODE_ENV: "development" })).toBe(
      "http://localhost:3000",
    );
  });

  it("fails closed in production when no public origin is configured", () => {
    expect(() => resolveAuthAppUrl({ NODE_ENV: "production" })).toThrow(
      AuthAppUrlError,
    );
  });

  it("does not accept a blank production origin", () => {
    expect(() =>
      resolveAuthAppUrl({ NODE_ENV: "production", APP_URL: "   " }),
    ).toThrow(AuthAppUrlError);
  });
});

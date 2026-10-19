import { describe, expect, it } from "vitest";
import {
  createMediaProvidersFromEnv,
  MediaRunnerUnavailableError,
} from "./media-runner";

describe("media providers from env", () => {
  it("uses the stand-ins outside production", () => {
    const providers = createMediaProvidersFromEnv({ NODE_ENV: "development" });
    expect(providers.scanner).toBeDefined();
    expect(providers.derivatives).toBeDefined();
  });

  it("refuses an unscanned production pipeline without an explicit override", () => {
    expect(() =>
      createMediaProvidersFromEnv({
        NODE_ENV: "production",
        MEDIA_DERIVATIVE_WRITER: "none",
        MEDIA_ALLOW_MISSING_DERIVATIVES: "true",
      }),
    ).toThrow(MediaRunnerUnavailableError);
  });

  it("refuses missing derivatives in production without an explicit override", () => {
    expect(() =>
      createMediaProvidersFromEnv({
        NODE_ENV: "production",
        MEDIA_ALLOW_UNSCANNED_UPLOADS: "true",
      }),
    ).toThrow(/MEDIA_DERIVATIVE_WRITER=none/);
  });

  it("accepts both stand-ins in production when the overrides are explicit", () => {
    const providers = createMediaProvidersFromEnv({
      NODE_ENV: "production",
      MEDIA_ALLOW_UNSCANNED_UPLOADS: "true",
      MEDIA_ALLOW_MISSING_DERIVATIVES: "true",
    });
    expect(providers.scanner).toBeDefined();
    expect(providers.derivatives).toBeDefined();
  });

  it("does not treat a non-true override value as consent", () => {
    expect(() =>
      createMediaProvidersFromEnv({
        NODE_ENV: "production",
        MEDIA_ALLOW_UNSCANNED_UPLOADS: "1",
        MEDIA_ALLOW_MISSING_DERIVATIVES: "yes",
      }),
    ).toThrow(MediaRunnerUnavailableError);
  });

  it("fails closed on an unsupported scanner provider", () => {
    expect(() =>
      createMediaProvidersFromEnv({ MEDIA_MALWARE_SCANNER: "clamav" }),
    ).toThrow(/Unsupported media malware scanner provider/);
  });

  it("fails closed on an unsupported derivative provider", () => {
    expect(() =>
      createMediaProvidersFromEnv({ MEDIA_DERIVATIVE_WRITER: "sharp" }),
    ).toThrow(/Unsupported media derivative writer provider/);
  });
});

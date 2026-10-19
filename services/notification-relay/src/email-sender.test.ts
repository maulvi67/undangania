import { describe, expect, it } from "vitest";
import { RelayConfigError, relayConfigFromEnv } from "./email-sender";

const BASE = {
  NOTIFICATION_RELAY_API_KEY: "relay-secret-key-that-is-long-enough-0001",
  EMAIL_FROM: "Undangania <no-reply@undangania.test>",
  SMTP_HOST: "smtp.example.test",
} as const;

describe("relay configuration", () => {
  it("builds a host transport from split SMTP settings", () => {
    const config = relayConfigFromEnv({
      ...BASE,
      SMTP_PORT: "587",
      SMTP_USER: "relay",
      SMTP_PASS: "secret",
    });
    expect(config.port).toBe(4100);
    expect(config.hostname).toBe("0.0.0.0");
    expect(config.smtp).toEqual({
      kind: "host",
      host: "smtp.example.test",
      port: 587,
      secure: false,
      from: "Undangania <no-reply@undangania.test>",
      user: "relay",
      pass: "secret",
    });
  });

  it("defaults to implicit TLS on port 465", () => {
    const config = relayConfigFromEnv({ ...BASE, SMTP_PORT: "465" });
    expect(config.smtp).toMatchObject({ kind: "host", secure: true });
  });

  it("prefers SMTP_URL when present", () => {
    const config = relayConfigFromEnv({
      ...BASE,
      SMTP_URL: "smtps://user:pass@smtp.example.test:465",
    });
    expect(config.smtp).toEqual({
      kind: "url",
      url: "smtps://user:pass@smtp.example.test:465",
      from: "Undangania <no-reply@undangania.test>",
    });
  });

  it("rejects a short relay API key", () => {
    expect(() =>
      relayConfigFromEnv({ ...BASE, NOTIFICATION_RELAY_API_KEY: "short" }),
    ).toThrow(/NOTIFICATION_RELAY_API_KEY/);
  });

  it("requires EMAIL_FROM", () => {
    expect(() => relayConfigFromEnv({ ...BASE, EMAIL_FROM: "" })).toThrow(
      /EMAIL_FROM/,
    );
  });

  it("rejects a multi-line sender address", () => {
    expect(() =>
      relayConfigFromEnv({
        ...BASE,
        EMAIL_FROM: "no-reply@undangania.test\r\nBcc: attacker@example.com",
      }),
    ).toThrow(RelayConfigError);
  });

  it("requires either SMTP_URL or SMTP_HOST", () => {
    expect(() => relayConfigFromEnv({ ...BASE, SMTP_HOST: undefined })).toThrow(
      /SMTP_URL or SMTP_HOST/,
    );
  });

  it("requires user and password together", () => {
    expect(() => relayConfigFromEnv({ ...BASE, SMTP_USER: "relay" })).toThrow(
      /configured together/,
    );
  });

  it("rejects an out-of-range port", () => {
    expect(() => relayConfigFromEnv({ ...BASE, PORT: "70000" })).toThrow(
      /Port must be/,
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  buildAuthActionUrl,
  authNotificationIdempotencyKey,
  EMAIL_VERIFICATION_TTL_MS,
  NOTIFICATION_TEMPLATES,
  PASSWORD_RESET_TTL_MS,
  type NotificationPort,
  ConsoleNotificationPort,
  createNotificationPortFromEnv,
  HttpNotificationPort,
  maskRecipientRef,
  NotificationUnavailableError,
  parseNotificationResponse,
  summarizeNotification,
  type NotificationLogSink,
  type RedactedNotificationSummary,
} from "./index";

const TOKEN = "kR7mQ2xVb9Ln4Ts8YzA1cD6eF3gH5jK0pWqRtUvXyBm";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function recordingSink(): Readonly<{
  sink: NotificationLogSink;
  info: RedactedNotificationSummary[];
  error: RedactedNotificationSummary[];
  messages: string[];
}> {
  const info: RedactedNotificationSummary[] = [];
  const error: RedactedNotificationSummary[] = [];
  const messages: string[] = [];
  return {
    info,
    error,
    messages,
    sink: {
      info: (message, context) => {
        messages.push(message);
        info.push(context);
      },
      error: (message, context) => {
        messages.push(message);
        error.push(context);
      },
    },
  };
}

describe("NOTIFICATION_TEMPLATES", () => {
  it("exposes stable provider-facing codes", () => {
    expect(NOTIFICATION_TEMPLATES.EMAIL_VERIFICATION).toBe(
      "auth.email-verification",
    );
    expect(NOTIFICATION_TEMPLATES.PASSWORD_RESET).toBe("auth.password-reset");
  });
});

describe("buildAuthActionUrl", () => {
  it("places the token in the path and encodes it", () => {
    expect(
      buildAuthActionUrl({
        appUrl: "https://app.contoh.id",
        path: "/verifikasi",
        token: TOKEN,
      }),
    ).toBe(`https://app.contoh.id/verifikasi?token=${TOKEN}`);
  });

  it("tolerates a trailing slash on the app URL", () => {
    expect(
      buildAuthActionUrl({
        appUrl: "https://app.contoh.id/",
        path: "/verifikasi",
        token: TOKEN,
      }),
    ).toBe(`https://app.contoh.id/verifikasi?token=${TOKEN}`);
  });

  it("escapes characters that would break out of the query value", () => {
    // A token that ever contained a reserved character must not be able to alter
    // the link's structure or inject a second parameter.
    const url = buildAuthActionUrl({
      appUrl: "https://app.contoh.id",
      path: "/reset-sandi",
      token: "a/b?c#d",
    });
    expect(url).toBe("https://app.contoh.id/reset-sandi?token=a%2Fb%3Fc%23d");
    expect(url.match(/token=/g)).toHaveLength(1);
  });
});

describe("authNotificationIdempotencyKey", () => {
  it("is stable for the same user and purpose so a retry does not double-send", () => {
    const first = authNotificationIdempotencyKey({
      purpose: "EMAIL_VERIFICATION",
      userId: "user-1",
    });
    const second = authNotificationIdempotencyKey({
      purpose: "EMAIL_VERIFICATION",
      userId: "user-1",
    });
    expect(first).toBe(second);
  });

  it("separates purposes and users", () => {
    expect(
      authNotificationIdempotencyKey({
        purpose: "EMAIL_VERIFICATION",
        userId: "user-1",
      }),
    ).not.toBe(
      authNotificationIdempotencyKey({
        purpose: "PASSWORD_RESET",
        userId: "user-1",
      }),
    );
    expect(
      authNotificationIdempotencyKey({
        purpose: "EMAIL_VERIFICATION",
        userId: "user-1",
      }),
    ).not.toBe(
      authNotificationIdempotencyKey({
        purpose: "EMAIL_VERIFICATION",
        userId: "user-2",
      }),
    );
  });

  it("carries no secret material", () => {
    const key = authNotificationIdempotencyKey({
      purpose: "PASSWORD_RESET",
      userId: "user-1",
    });
    expect(key).not.toContain(TOKEN);
  });
});

describe("TTL constants", () => {
  it("matches the transport contract R5 (verification 24h, reset 1h)", () => {
    expect(EMAIL_VERIFICATION_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(PASSWORD_RESET_TTL_MS).toBe(60 * 60 * 1000);
  });
});

describe("maskRecipientRef", () => {
  it("keeps the domain but masks the local part", () => {
    expect(maskRecipientRef("rani@contoh.id")).toBe("r***@contoh.id");
  });

  it("masks a single-character local part entirely", () => {
    expect(maskRecipientRef("a@contoh.id")).toBe("*@contoh.id");
  });

  it("masks a phone-like reference that has no domain", () => {
    expect(maskRecipientRef("+628123456789")).toBe("+***");
  });

  it("masks a very short reference", () => {
    expect(maskRecipientRef("ab")).toBe("**");
  });
});

describe("summarizeNotification", () => {
  it("records variable names but never their values", () => {
    const summary = summarizeNotification({
      idempotencyKey: "auth:EMAIL_VERIFICATION:user-1",
      channel: "EMAIL",
      recipientRef: "rani@contoh.id",
      templateCode: "auth.email-verification",
      variables: { actionUrl: `https://app/verifikasi/${TOKEN}`, name: "Rani" },
    });

    expect(summary.variableNames).toEqual(["actionUrl", "name"]);
    // The action URL contains a live single-use token, so nothing in the summary
    // may carry it.
    expect(JSON.stringify(summary)).not.toContain(TOKEN);
    expect(summary.recipientRef).toBe("r***@contoh.id");
  });
});

describe("ConsoleNotificationPort", () => {
  it("reports queued and never prints the token", async () => {
    const recorder = recordingSink();
    const port = new ConsoleNotificationPort(recorder.sink);

    const result = await port.send({
      idempotencyKey: "auth:PASSWORD_RESET:user-1",
      channel: "EMAIL",
      recipientRef: "rani@contoh.id",
      templateCode: NOTIFICATION_TEMPLATES.PASSWORD_RESET,
      variables: { actionUrl: `https://app/reset-sandi?token=${TOKEN}` },
    });

    expect(result.status).toBe("QUEUED");
    expect(result.providerMessageId).toBe("console:auth:PASSWORD_RESET:user-1");
    expect(recorder.messages).toEqual(["notification.queued"]);
    expect(JSON.stringify(recorder.info)).not.toContain(TOKEN);
  });
});

describe("parseNotificationResponse", () => {
  it("reads a well-formed relay response", () => {
    expect(
      parseNotificationResponse({ messageId: "msg-1", status: "SENT" }),
    ).toEqual({ providerMessageId: "msg-1", status: "SENT" });
  });

  it("accepts a queued status", () => {
    expect(
      parseNotificationResponse({ messageId: "msg-2", status: "QUEUED" }),
    ).toEqual({ providerMessageId: "msg-2", status: "QUEUED" });
  });

  it("refuses anything it cannot trust", () => {
    expect(parseNotificationResponse(null)).toBeNull();
    expect(parseNotificationResponse([])).toBeNull();
    expect(parseNotificationResponse({})).toBeNull();
    expect(parseNotificationResponse({ messageId: "" })).toBeNull();
    expect(
      parseNotificationResponse({ messageId: "msg-1", status: "MAYBE" }),
    ).toBeNull();
  });
});

describe("HttpNotificationPort", () => {
  const options = {
    baseUrl: "https://relay.internal",
    apiKey: "relay-secret",
  };

  it("posts the template code and variables with an idempotency key", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ messageId: "msg-9", status: "SENT" }));
    const port = new HttpNotificationPort({ ...options, fetchImpl });

    const result = await port.send({
      idempotencyKey: "auth:EMAIL_VERIFICATION:user-1",
      channel: "EMAIL",
      recipientRef: "rani@contoh.id",
      templateCode: NOTIFICATION_TEMPLATES.EMAIL_VERIFICATION,
      variables: { actionUrl: `https://app/verifikasi/${TOKEN}` },
    });

    expect(result).toEqual({ providerMessageId: "msg-9", status: "SENT" });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://relay.internal/v1/messages");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["idempotency-key"]).toBe("auth:EMAIL_VERIFICATION:user-1");
    expect(headers.authorization).toBe("Bearer relay-secret");
  });

  it("strips trailing slashes so the path is not doubled", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ messageId: "msg-1", status: "SENT" }));
    const port = new HttpNotificationPort({
      baseUrl: "https://relay.internal///",
      apiKey: "relay-secret",
      fetchImpl,
    });

    await port.send({
      idempotencyKey: "k",
      channel: "EMAIL",
      recipientRef: "rani@contoh.id",
      templateCode: NOTIFICATION_TEMPLATES.EMAIL_VERIFICATION,
      variables: {},
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "https://relay.internal/v1/messages",
    );
  });

  it("surfaces a provider rejection without logging the token", async () => {
    const recorder = recordingSink();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: "nope" }, 422));
    const port = new HttpNotificationPort({
      ...options,
      fetchImpl,
      sink: recorder.sink,
    });

    await expect(
      port.send({
        idempotencyKey: "k",
        channel: "EMAIL",
        recipientRef: "rani@contoh.id",
        templateCode: NOTIFICATION_TEMPLATES.PASSWORD_RESET,
        variables: { actionUrl: `https://app/${TOKEN}` },
      }),
    ).rejects.toThrow(NotificationUnavailableError);

    expect(recorder.messages).toEqual(["notification.failed"]);
    expect(JSON.stringify(recorder.error)).not.toContain(TOKEN);
  });

  it("fails closed when the relay returns a non-JSON body", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("<html>gateway</html>", { status: 200 }));
    const port = new HttpNotificationPort({ ...options, fetchImpl });

    await expect(
      port.send({
        idempotencyKey: "k",
        channel: "EMAIL",
        recipientRef: "rani@contoh.id",
        templateCode: NOTIFICATION_TEMPLATES.EMAIL_VERIFICATION,
        variables: {},
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
  });

  it("refuses a 200 response whose body cannot be trusted", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const port = new HttpNotificationPort({ ...options, fetchImpl });

    // A relay that returns 200 without a message id would otherwise be reported
    // to the customer as "email sent".
    await expect(
      port.send({
        idempotencyKey: "k",
        channel: "EMAIL",
        recipientRef: "rani@contoh.id",
        templateCode: NOTIFICATION_TEMPLATES.EMAIL_VERIFICATION,
        variables: {},
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_INVALID_RESPONSE" });
  });

  it("reports an unreachable relay as unavailable", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const port = new HttpNotificationPort({ ...options, fetchImpl });

    await expect(
      port.send({
        idempotencyKey: "k",
        channel: "EMAIL",
        recipientRef: "rani@contoh.id",
        templateCode: NOTIFICATION_TEMPLATES.EMAIL_VERIFICATION,
        variables: {},
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  it("refuses to construct without a URL or key", () => {
    expect(
      () => new HttpNotificationPort({ baseUrl: "", apiKey: "k" }),
    ).toThrow(NotificationUnavailableError);
    expect(
      () => new HttpNotificationPort({ baseUrl: "https://x", apiKey: "" }),
    ).toThrow(NotificationUnavailableError);
  });

  it("satisfies the NotificationPort contract", () => {
    const port: NotificationPort = new HttpNotificationPort({
      ...options,
      fetchImpl: vi.fn(),
    });
    expect(typeof port.send).toBe("function");
  });
});

describe("createNotificationPortFromEnv", () => {
  it("defaults to the console transport locally", () => {
    expect(createNotificationPortFromEnv({})).toBeInstanceOf(
      ConsoleNotificationPort,
    );
    expect(
      createNotificationPortFromEnv({ EMAIL_PROVIDER: "console" }),
    ).toBeInstanceOf(ConsoleNotificationPort);
  });

  it("builds the HTTP transport when the relay is configured", () => {
    expect(
      createNotificationPortFromEnv({
        EMAIL_PROVIDER: "relay",
        NOTIFICATION_RELAY_URL: "https://relay.internal",
        NOTIFICATION_RELAY_API_KEY: "secret",
      }),
    ).toBeInstanceOf(HttpNotificationPort);
  });

  it("fails closed when a non-console provider has no relay credentials", () => {
    // Silently falling back to console would mean auth email is never delivered
    // while the UI reports success.
    expect(
      createNotificationPortFromEnv({ EMAIL_PROVIDER: "relay" }),
    ).toBeNull();
    expect(
      createNotificationPortFromEnv({
        EMAIL_PROVIDER: "relay",
        NOTIFICATION_RELAY_URL: "https://relay.internal",
      }),
    ).toBeNull();
    expect(
      createNotificationPortFromEnv({
        EMAIL_PROVIDER: "relay",
        NOTIFICATION_RELAY_API_KEY: "secret",
      }),
    ).toBeNull();
  });
});

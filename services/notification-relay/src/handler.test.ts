import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EmailSender } from "./email-sender";
import { createRelayHandler, MAX_RELAY_BODY_BYTES } from "./handler";

const API_KEY = "relay-secret-key-that-is-long-enough-0001";
const IDEMPOTENCY_KEY = "idem-key-1234567890";

const MESSAGE = {
  channel: "EMAIL",
  recipientRef: "tamu@example.com",
  templateCode: "auth.email-verification",
  variables: { actionUrl: "https://app.undangania.test/verifikasi?token=abc" },
} as const;

type RunningServer = Readonly<{ server: Server; baseUrl: string }>;

const running: Server[] = [];

afterEach(async () => {
  await Promise.all(
    running.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

async function start(
  send: EmailSender["send"],
  options: Readonly<{ maxBodyBytes?: number }> = {},
): Promise<RunningServer> {
  const handler = createRelayHandler({
    apiKey: API_KEY,
    sender: { send },
    ...options,
  });
  const server = createServer((request, response) => {
    void handler(request, response);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  running.push(server);

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Test server has no TCP address");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function post(
  baseUrl: string,
  body: unknown,
  input: Readonly<{
    authorization?: string | null;
    idempotencyKey?: string | null;
    contentType?: string;
  }> = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": input.contentType ?? "application/json",
  };
  if (input.authorization !== null) {
    headers.authorization = input.authorization ?? `Bearer ${API_KEY}`;
  }
  if (input.idempotencyKey !== null) {
    headers["idempotency-key"] = input.idempotencyKey ?? IDEMPOTENCY_KEY;
  }
  return fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("notification relay handler", () => {
  it("answers the health check without authentication", async () => {
    const { baseUrl } = await start(async () => ({ messageId: "unused" }));
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("rejects a missing bearer token", async () => {
    const send = vi.fn(async () => ({ messageId: "msg-1" }));
    const { baseUrl } = await start(send);
    const response = await post(baseUrl, MESSAGE, { authorization: null });
    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer token", async () => {
    const send = vi.fn(async () => ({ messageId: "msg-1" }));
    const { baseUrl } = await start(send);
    const response = await post(baseUrl, MESSAGE, {
      authorization: `Bearer ${"x".repeat(40)}`,
    });
    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it("renders and sends a valid message", async () => {
    const capture: {
      value: Parameters<EmailSender["send"]>[0] | null;
    } = { value: null };
    const send = vi.fn(async (input: Parameters<EmailSender["send"]>[0]) => {
      capture.value = input;
      return { messageId: "<msg-1@relay>" };
    });
    const { baseUrl } = await start(send);

    const response = await post(baseUrl, MESSAGE);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      messageId: "<msg-1@relay>",
      status: "SENT",
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "tamu@example.com",
        idempotencyKey: IDEMPOTENCY_KEY,
        subject: "Verifikasi email Undangania",
      }),
    );
    expect(capture.value?.text).toContain(
      "https://app.undangania.test/verifikasi?token=abc",
    );
  });

  it("replays a duplicate idempotency key without sending twice", async () => {
    const send = vi.fn(async () => ({ messageId: "<msg-1@relay>" }));
    const { baseUrl } = await start(send);

    const first = await post(baseUrl, MESSAGE);
    const second = await post(baseUrl, MESSAGE);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({
      messageId: "<msg-1@relay>",
      status: "SENT",
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("collapses concurrent duplicates into one delivery", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const send = vi.fn(async () => {
      await gate;
      return { messageId: "<msg-1@relay>" };
    });
    const { baseUrl } = await start(send);

    const first = post(baseUrl, MESSAGE);
    const second = post(baseUrl, MESSAGE);
    await new Promise((resolve) => setTimeout(resolve, 50));
    release?.();

    const responses = await Promise.all([first, second]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed delivery, so a retry can succeed", async () => {
    const send = vi
      .fn<EmailSender["send"]>()
      .mockRejectedValueOnce(new Error("smtp down"))
      .mockResolvedValueOnce({ messageId: "<msg-2@relay>" });
    const { baseUrl } = await start(send);

    const failed = await post(baseUrl, MESSAGE);
    expect(failed.status).toBe(502);
    await expect(failed.json()).resolves.toEqual({ error: "DELIVERY_FAILED" });

    const retried = await post(baseUrl, MESSAGE);
    expect(retried.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("rejects a malformed recipient", async () => {
    const send = vi.fn(async () => ({ messageId: "msg-1" }));
    const { baseUrl } = await start(send);
    const response = await post(baseUrl, {
      ...MESSAGE,
      recipientRef: "not-an-email",
    });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_RECIPIENT",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects an unsupported channel", async () => {
    const send = vi.fn(async () => ({ messageId: "msg-1" }));
    const { baseUrl } = await start(send);
    const response = await post(baseUrl, { ...MESSAGE, channel: "WHATSAPP" });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "UNSUPPORTED_CHANNEL",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects an unknown template code", async () => {
    const send = vi.fn(async () => ({ messageId: "msg-1" }));
    const { baseUrl } = await start(send);
    const response = await post(baseUrl, {
      ...MESSAGE,
      templateCode: "auth.unknown-template",
    });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "UNKNOWN_TEMPLATE",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects missing template variables", async () => {
    const send = vi.fn(async () => ({ messageId: "msg-1" }));
    const { baseUrl } = await start(send);
    const response = await post(baseUrl, { ...MESSAGE, variables: {} });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_TEMPLATE_VARIABLES",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("requires an idempotency key", async () => {
    const send = vi.fn(async () => ({ messageId: "msg-1" }));
    const { baseUrl } = await start(send);
    const response = await post(baseUrl, MESSAGE, { idempotencyKey: null });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_IDEMPOTENCY_KEY",
    });
  });

  it("rejects a non-JSON content type", async () => {
    const send = vi.fn(async () => ({ messageId: "msg-1" }));
    const { baseUrl } = await start(send);
    const response = await post(baseUrl, MESSAGE, {
      contentType: "text/plain",
    });
    expect(response.status).toBe(415);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON", async () => {
    const send = vi.fn(async () => ({ messageId: "msg-1" }));
    const { baseUrl } = await start(send);
    const response = await post(baseUrl, "{not-json");
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_JSON" });
  });

  it("rejects a body over the configured limit", async () => {
    const send = vi.fn(async () => ({ messageId: "msg-1" }));
    const { baseUrl } = await start(send, { maxBodyBytes: 64 });
    const response = await post(baseUrl, MESSAGE);
    expect(response.status).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects an oversized body even without a declared length", async () => {
    const send = vi.fn(async () => ({ messageId: "msg-1" }));
    const { baseUrl } = await start(send, { maxBodyBytes: 64 });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(128)));
        controller.close();
      },
    });
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${API_KEY}`,
        "idempotency-key": IDEMPOTENCY_KEY,
      },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(response.status).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects unknown routes and methods", async () => {
    const { baseUrl } = await start(async () => ({ messageId: "unused" }));
    const notFound = await fetch(`${baseUrl}/v1/other`);
    expect(notFound.status).toBe(404);

    const wrongMethod = await fetch(`${baseUrl}/v1/messages`, {
      method: "GET",
    });
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("allow")).toBe("POST");
  });

  it("exports a one-megabyte body budget", () => {
    expect(MAX_RELAY_BODY_BYTES).toBe(1024 * 1024);
  });
});

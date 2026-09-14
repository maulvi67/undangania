import { describe, expect, it } from "vitest";
import { responseLabel } from "./contract";
import { createRsvpStubTransport } from "./stub-transport";

describe("RSVP contract", () => {
  it("uses the approved Indonesian response labels", () => {
    expect(responseLabel("ATTENDING")).toBe("Hadir");
    expect(responseLabel("TENTATIVE")).toBe("Masih tentatif");
    expect(responseLabel("DECLINED")).toBe("Tidak dapat hadir");
  });

  it("returns the same result for an identical idempotent replay", async () => {
    const transport = createRsvpStubTransport("success");
    const command = {
      idempotencyKey: "fixture-idempotency-key-001",
      updates: [
        {
          eventId: "11111111-1111-4111-8111-111111111111",
          response: "ATTENDING" as const,
          pax: 2,
          expectedVersion: null,
        },
      ],
    };
    const first = await transport.submit(command);
    const replay = await transport.submit(command);
    expect(replay).toEqual(first);
  });

  it("rejects the same idempotency key with a different payload", async () => {
    const transport = createRsvpStubTransport("success");
    const base = {
      idempotencyKey: "fixture-idempotency-key-002",
      updates: [
        {
          eventId: "11111111-1111-4111-8111-111111111111",
          response: "ATTENDING" as const,
          pax: 1,
          expectedVersion: null,
        },
      ],
    };
    await transport.submit(base);
    const conflict = await transport.submit({
      idempotencyKey: base.idempotencyKey,
      updates: [
        {
          eventId: "11111111-1111-4111-8111-111111111111",
          response: "ATTENDING",
          pax: 2,
          expectedVersion: null,
        },
      ],
    });
    expect(conflict).toMatchObject({
      kind: "error",
      code: "IDEMPOTENCY_CONFLICT",
      preserveInput: true,
    });
  });
});

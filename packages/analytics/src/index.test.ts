import { describe, expect, it } from "vitest";
import {
  analyticsEventId,
  hashActorId,
  hashTenantId,
  ingestAnalyticsEvent,
  parseAnalyticsEventPayload,
  parseAnalyticsReportRange,
  reportAnalyticsEvents,
  serializeAnalyticsEventPayload,
  validateAnalyticsEvent,
  type AnalyticsEventRecord,
  type AnalyticsEventRepository,
} from "./index";

const SECRET = "a".repeat(32);
const NOW = new Date("2026-09-17T10:00:00.000Z");
const TENANT_ID = "tenant-1";
const ACTOR_ID = "user-1";

const EVENT = {
  name: "invitation_viewed",
  schemaVersion: 1,
  consent: true,
  idempotencyKey: "event-key-abcdefghijkl",
  properties: {
    source: "shared",
    device: "mobile",
  },
} as const;

function repository(): AnalyticsEventRepository & {
  events: Map<string, AnalyticsEventRecord>;
} {
  const events = new Map<string, AnalyticsEventRecord>();
  return {
    events,
    append: async (_scope, event) => {
      const existing = events.get(event.id);
      if (existing !== undefined) return { kind: "existing", event: existing };
      events.set(event.id, event);
      return { kind: "created", event };
    },
    listAccepted: async (_scope, range) =>
      [...events.values()].filter(
        (event) =>
          event.acceptedAt >= range.from && event.acceptedAt < range.to,
      ),
  };
}

describe("analytics event validation", () => {
  it("accepts only an allowlisted event and scalar properties", () => {
    expect(validateAnalyticsEvent(EVENT)).toEqual({ ok: true, data: EVENT });
  });

  it("accepts every documented event-specific allowlist", () => {
    const events = [
      EVENT,
      {
        name: "invitation_published",
        schemaVersion: 1,
        consent: true,
        idempotencyKey: "published-key-000001",
        properties: { status: "PUBLISHED" },
      },
      {
        name: "rsvp_submitted",
        schemaVersion: 1,
        consent: true,
        idempotencyKey: "rsvp-key-000000001",
        properties: { response: "ATTENDING" },
      },
      {
        name: "guestbook_submitted",
        schemaVersion: 1,
        consent: true,
        idempotencyKey: "guestbook-key-0001",
        properties: { moderationStatus: "PENDING" },
      },
      {
        name: "checkout_started",
        schemaVersion: 1,
        consent: true,
        idempotencyKey: "checkout-started-01",
        properties: { currency: "IDR" },
      },
      {
        name: "checkout_completed",
        schemaVersion: 1,
        consent: true,
        idempotencyKey: "checkout-completed-1",
        properties: { currency: "IDR" },
      },
    ] as const;

    for (const event of events) {
      expect(validateAnalyticsEvent(event)).toEqual({ ok: true, data: event });
    }
  });

  it("rejects PII property names before schema parsing", () => {
    expect(
      validateAnalyticsEvent({
        ...EVENT,
        properties: { ...EVENT.properties, email: "guest@example.test" },
      }),
    ).toEqual({ ok: false, reason: "PROHIBITED_PROPERTY" });
  });

  it("rejects unknown properties and missing consent", () => {
    expect(
      validateAnalyticsEvent({
        ...EVENT,
        properties: { ...EVENT.properties, arbitrary: "value" },
      }),
    ).toEqual({ ok: false, reason: "INVALID_EVENT" });
    expect(validateAnalyticsEvent({ ...EVENT, consent: false })).toEqual({
      ok: false,
      reason: "INVALID_EVENT",
    });
  });
});

describe("analytics privacy and idempotency", () => {
  it("hashes tenant and actor identifiers without persisting raw values", async () => {
    const store = repository();
    const result = await ingestAnalyticsEvent(
      store,
      { tenantId: TENANT_ID, actorId: ACTOR_ID, hashSecret: SECRET },
      EVENT,
      NOW,
    );

    expect(result).toEqual({
      kind: "accepted",
      eventId: analyticsEventId(TENANT_ID, EVENT.idempotencyKey),
    });
    const stored = [...store.events.values()][0];
    expect(stored).toBeDefined();
    expect(stored?.tenantIdHash).toBe(hashTenantId(TENANT_ID, SECRET));
    expect(stored?.actorHash).toBe(hashActorId(ACTOR_ID, SECRET));
    expect(JSON.stringify(stored)).not.toContain(TENANT_ID);
    expect(JSON.stringify(stored)).not.toContain(ACTOR_ID);
  });

  it("returns replay for the same key and conflict for changed content", async () => {
    const store = repository();
    await expect(
      ingestAnalyticsEvent(
        store,
        { tenantId: TENANT_ID, actorId: ACTOR_ID, hashSecret: SECRET },
        EVENT,
        NOW,
      ),
    ).resolves.toMatchObject({ kind: "accepted" });
    await expect(
      ingestAnalyticsEvent(
        store,
        { tenantId: TENANT_ID, actorId: ACTOR_ID, hashSecret: SECRET },
        EVENT,
        new Date("2026-09-17T10:00:02.000Z"),
      ),
    ).resolves.toMatchObject({ kind: "replayed" });
    await expect(
      ingestAnalyticsEvent(
        store,
        { tenantId: TENANT_ID, actorId: ACTOR_ID, hashSecret: SECRET },
        {
          ...EVENT,
          name: "invitation_viewed",
          properties: { source: "direct", device: "mobile" },
        },
        NOW,
      ),
    ).resolves.toMatchObject({ kind: "idempotency-conflict" });
  });

  it("rejects an unsafe hash secret", () => {
    expect(() => hashTenantId(TENANT_ID, "short-secret")).toThrow();
  });
});

describe("analytics reporting", () => {
  it("counts accepted events without exposing properties or identifiers", async () => {
    const store = repository();
    await ingestAnalyticsEvent(
      store,
      { tenantId: TENANT_ID, actorId: ACTOR_ID, hashSecret: SECRET },
      EVENT,
      NOW,
    );
    const range = parseAnalyticsReportRange({
      from: "2026-09-17T00:00:00.000Z",
      to: "2026-09-18T00:00:00.000Z",
    });
    if (!range.ok) throw new Error("test range should be valid");

    await expect(
      reportAnalyticsEvents(store, { tenantId: TENANT_ID }, range.value),
    ).resolves.toEqual({
      from: "2026-09-17T00:00:00.000Z",
      to: "2026-09-18T00:00:00.000Z",
      total: 1,
      counts: {
        invitation_viewed: 1,
        invitation_published: 0,
        rsvp_submitted: 0,
        guestbook_submitted: 0,
        checkout_started: 0,
        checkout_completed: 0,
      },
    });
  });

  it("rejects ranges longer than the bounded report window", () => {
    expect(
      parseAnalyticsReportRange({
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-10-03T00:00:00.000Z",
      }),
    ).toEqual({ ok: false, reason: "INVALID_RANGE" });
  });
});

describe("stored analytics payload", () => {
  it("round-trips an allowlisted payload and rejects PII fields", async () => {
    const store = repository();
    await ingestAnalyticsEvent(
      store,
      { tenantId: TENANT_ID, actorId: ACTOR_ID, hashSecret: SECRET },
      EVENT,
      NOW,
    );
    const stored = [...store.events.values()][0];
    if (stored === undefined) throw new Error("event was not stored");
    expect(
      parseAnalyticsEventPayload(serializeAnalyticsEventPayload(stored)),
    ).toEqual(serializeAnalyticsEventPayload(stored));
    expect(
      parseAnalyticsEventPayload({
        ...serializeAnalyticsEventPayload(stored),
        properties: { email: "guest@example.test" },
      }),
    ).toBeNull();
  });
});

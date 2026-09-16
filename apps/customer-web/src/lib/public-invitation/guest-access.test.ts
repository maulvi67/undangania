import { describe, expect, it } from "vitest";
import type { GuestAccessDto } from "@wedding/database";
import {
  invalidGuestContext,
  rateLimitedGuestContext,
  toGuestContext,
  unavailableGuestContext,
} from "./guest-access";

function access(overrides: Partial<GuestAccessDto> = {}): GuestAccessDto {
  return {
    householdId: "hh-1",
    tenantId: "t-1",
    weddingId: "w-1",
    displayName: "Keluarga Rahman",
    maximumPax: 4,
    status: "ACTIVE",
    timezone: "Asia/Jakarta",
    slug: "rani-bima-1a2b3c4d",
    published: true,
    events: [
      {
        id: "e-1",
        title: "Akad Nikah",
        startsAt: new Date("2026-11-01T01:00:00.000Z"),
        timezone: "Asia/Jakarta",
        venueName: "Masjid Al-Azhar",
        address: "Jl. Sisingamangaraja",
        mapUrl: "https://maps.example.com/akad",
      },
    ],
    rsvps: [],
    ...overrides,
  };
}

describe("toGuestContext", () => {
  it("maps a live household into an interactive context", () => {
    const context = toGuestContext(access());

    expect(context.state).toBe("ready");
    expect(context.maxPax).toBe(4);
    expect(context.greetingName).toBe("Keluarga Rahman");
    expect(context.householdLabel).toBe("Undangan untuk Keluarga Rahman");
    expect(context.guestbook).toEqual({ enabled: true, status: "available" });
    expect(context.events).toHaveLength(1);
    expect(context.events[0]).toMatchObject({
      id: "e-1",
      title: "Akad Nikah",
      venueName: "Masjid Al-Azhar",
      address: "Jl. Sisingamangaraja",
      mapUrl: "https://maps.example.com/akad",
      timezoneLabel: "WIB",
    });
  });

  it("carries an existing answer so the form opens on the saved choice", () => {
    const context = toGuestContext(
      access({
        rsvps: [
          {
            eventId: "e-1",
            response: "ATTENDING",
            pax: 2,
            optimisticVersion: 3,
          },
        ],
      }),
    );

    expect(context.events[0]?.existingResponse).toEqual({
      response: "ATTENDING",
      pax: 2,
      optimisticVersion: 3,
    });
  });

  it("reports a disabled household as paused, not as a broken link", () => {
    // Paused tells the guest to wait; invalid-token would send them looking for a
    // new link that does not exist.
    const context = toGuestContext(access({ status: "DISABLED" }));
    expect(context.state).toBe("paused");
    expect(context.guestbook.enabled).toBe(false);
  });

  it("reports a deleted household as an unusable link", () => {
    expect(toGuestContext(access({ status: "DELETED" })).state).toBe(
      "invalid-token",
    );
  });

  it("reports an unpublished invitation as paused", () => {
    const context = toGuestContext(access({ published: false }));
    expect(context.state).toBe("paused");
    expect(context.events).toHaveLength(0);
  });

  it("does not offer RSVP when the wedding has no events", () => {
    const context = toGuestContext(access({ events: [] }));
    expect(context.state).toBe("provider-unavailable");
    expect(context.guestbook.enabled).toBe(false);
  });

  it("never carries the raw token, the token hash, or the tenant into the UI", () => {
    // The context crosses into a client component; a tenant id there would be an
    // identifier the browser could try to use elsewhere.
    const serialized = JSON.stringify(toGuestContext(access()));
    expect(serialized).not.toContain("t-1");
    expect(serialized).not.toContain("tokenHash");
    expect(serialized).not.toContain("phoneEncrypted");
    expect(serialized).not.toContain("emailEncrypted");
  });

  it("ignores an unrecognized stored response value", () => {
    const context = toGuestContext(
      access({
        rsvps: [
          {
            eventId: "e-1",
            response: "SOMETHING_ELSE" as never,
            pax: 1,
            optimisticVersion: 1,
          },
        ],
      }),
    );
    expect(context.events[0]?.existingResponse).toBeUndefined();
  });
});

describe("unusable-link contexts", () => {
  it("offers no events, no pax, and no guestbook", () => {
    for (const context of [
      invalidGuestContext(),
      unavailableGuestContext(),
      rateLimitedGuestContext(),
    ]) {
      expect(context.events).toHaveLength(0);
      expect(context.maxPax).toBe(0);
      expect(context.guestbook.enabled).toBe(false);
    }
  });

  it("names the state the guest sees", () => {
    expect(invalidGuestContext().state).toBe("invalid-token");
    expect(unavailableGuestContext().state).toBe("provider-unavailable");
    expect(rateLimitedGuestContext().state).toBe("rate-limited");
  });
});

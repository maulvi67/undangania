import { describe, expect, it } from "vitest";
import { getGuestExperienceFixture } from "./guest-context-fixtures";

describe("guest RSVP and guestbook fixtures", () => {
  it("contains only the private fields needed by the guest experience", () => {
    const { context } = getGuestExperienceFixture("normal", "normal");
    expect(context).not.toHaveProperty("tenantId");
    expect(context).not.toHaveProperty("token");
    expect(context).not.toHaveProperty("tokenHash");
    expect(context.events).toHaveLength(2);
    expect(context.events[0]).not.toHaveProperty("contact");
  });

  it("covers deadline, lock, and non-enumerating unavailable states", () => {
    expect(
      getGuestExperienceFixture("normal", "deadline-approaching").context.state,
    ).toBe("deadline-approaching");
    expect(getGuestExperienceFixture("normal", "locked").context.state).toBe(
      "locked",
    );
    expect(
      getGuestExperienceFixture("normal", "invalid-token").context.events,
    ).toEqual([]);
    expect(
      getGuestExperienceFixture("normal", "expired").context.events,
    ).toEqual([]);
  });

  it("keeps per-event responses and declined pax semantics in fixtures", () => {
    const { context } = getGuestExperienceFixture("normal", "mixed-responses");
    expect(context.events[0]?.existingResponse?.response).toBe("ATTENDING");
    expect(context.events[1]?.existingResponse?.response).toBe("TENTATIVE");
    const declined = getGuestExperienceFixture("normal", "already-responded")
      .context.events[1]?.existingResponse;
    expect(declined).toMatchObject({ response: "DECLINED", pax: 0 });
  });
});

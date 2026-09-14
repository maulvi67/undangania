import { describe, expect, it } from "vitest";
import { scrubGuestForDiagnostics } from "./pii";
import type { GuestHouseholdDetail } from "./contract";

describe("guest diagnostic privacy boundary", () => {
  it("omits names, contacts, token versions, and personalized links", () => {
    const detail: GuestHouseholdDetail = {
      id: "household-a",
      displayName: "Keluarga Rahasia",
      memberCount: 2,
      maximumPax: 2,
      eventNames: ["Resepsi"],
      tags: ["VIP"],
      linkStatus: "ACTIVE",
      updatedAt: "2026-09-11T08:00:00.000Z",
      members: [{ id: "guest-a", displayName: "Nama Rahasia", category: "ADULT" }],
      eventIds: ["resepsi"],
      phoneMasked: "+62 •••• 1234",
      emailMasked: "r•••@contoh.id",
      tokenVersion: 3,
      personalizedLink: "https://demo.wedding-system.test/i/household-a/v3",
    };

    const safe = scrubGuestForDiagnostics(detail);
    expect(safe).toEqual({ householdId: "household-a", memberCount: 2, linkStatus: "ACTIVE" });
    expect(JSON.stringify(safe)).not.toContain("Rahasia");
    expect(JSON.stringify(safe)).not.toContain("1234");
    expect(JSON.stringify(safe)).not.toContain("demo.wedding-system.test");
  });
});

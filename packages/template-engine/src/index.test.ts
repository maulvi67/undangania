import { describe, expect, it } from "vitest";
import { invitationViewModelSchema, templateManifestSchema } from "./index";

describe("canonical invitation view model", () => {
  it("accepts structured couple and event data", () => {
    const model = invitationViewModelSchema.parse({
      schemaVersion: 1,
      locale: "id-ID",
      timezone: "Asia/Jakarta",
      couple: {
        displayNames: "Rani & Bima",
        partner1Name: "Rani",
        partner2Name: "Bima",
      },
      events: [
        {
          id: "akad",
          title: "Akad Nikah",
          eventType: "Akad Nikah",
          startsAt: "2026-09-12T08:00:00",
          timezone: "Asia/Jakarta",
          venueName: "Masjid Contoh",
        },
      ],
      sections: [
        {
          id: "couple",
          type: "couple",
          visible: true,
          payload: { title: "Mempelai" },
        },
      ],
    });

    expect(model.couple.partner1Name).toBe("Rani");
    expect(model.events[0]?.eventType).toBe("Akad Nikah");
  });

  it("rejects an unsupported section type", () => {
    expect(() =>
      invitationViewModelSchema.parse({
        schemaVersion: 1,
        locale: "id-ID",
        timezone: "Asia/Jakarta",
        couple: { displayNames: "Rani & Bima" },
        events: [],
        sections: [{ id: "x", type: "free-form", visible: true, payload: {} }],
      }),
    ).toThrow();
  });
});

describe("template manifest", () => {
  it("accepts a manifest with constrained ordering", () => {
    const manifest = templateManifestSchema.parse({
      id: "seruni",
      version: "1",
      contractVersion: 1,
      name: "Seruni",
      category: "Klasik",
      supportedSections: ["hero", "couple", "events"],
      requiredSections: ["couple", "events"],
      reorderableSections: ["events"],
      sectionOrder: ["hero", "couple", "events"],
    });

    expect(manifest.requiredSections).toEqual(["couple", "events"]);
  });
});

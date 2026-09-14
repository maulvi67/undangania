import { describe, expect, it } from "vitest";
import {
  publicationReadiness,
  sectionStatus,
  toInvitationViewModel,
} from "./contract";
import { createEditorDocument } from "./stub-transport";

const template = {
  id: "seruni-klasik",
  version: "1",
  contractVersion: 1,
  name: "Seruni",
  category: "Klasik",
  supportedSections: [
    "hero",
    "couple",
    "events",
    "venue",
    "cover",
    "story",
    "gallery",
    "music",
    "gift",
    "faq",
  ],
  requiredSections: ["couple", "events"],
  reorderableSections: ["story", "gallery", "music", "gift", "faq"],
  sectionOrder: [
    "hero",
    "couple",
    "events",
    "venue",
    "cover",
    "story",
    "gallery",
    "music",
    "gift",
    "faq",
  ],
} as const;

describe("editor contract", () => {
  it("creates a renderer-safe view model without database fields", () => {
    const document = createEditorDocument("invitation-test");
    const model = toInvitationViewModel(document.content);
    expect(model.couple.displayNames).toContain("&");
    expect(model.events[0]?.venueName).toBe("Gedung Contoh");
    expect("tenantId" in model).toBe(false);
  });

  it("reports missing publication data while allowing incomplete drafts", () => {
    const document = createEditorDocument("invitation-test");
    const empty = {
      ...document.content,
      couple: { partner1Name: "", partner2Name: "", intro: "" },
      events: [],
      settings: { ...document.content.settings, slug: "" },
    };
    const readiness = publicationReadiness(empty, template);
    expect(readiness.ready).toBe(false);
    expect(readiness.issues.map((issue) => issue.code)).toContain(
      "COUPLE_REQUIRED",
    );
  });

  it("reports a complete couple section", () => {
    const document = createEditorDocument("invitation-test");
    expect(sectionStatus(document.content, "couple", template)).toBe(
      "complete",
    );
  });

  it("keeps incomplete event drafts renderable in preview", () => {
    const document = createEditorDocument("incomplete-event");
    const firstEvent = document.content.events[0];
    if (!firstEvent)
      throw new Error("Expected the editor fixture to include an event");
    const content = {
      ...document.content,
      events: [
        {
          ...firstEvent,
          startsAt: "",
        },
      ],
    };
    const model = toInvitationViewModel(content);
    expect(model.events).toHaveLength(0);
  });

  it("keeps overlong venue drafts renderable while reporting the issue", () => {
    const document = createEditorDocument("long-venue");
    const firstEvent = document.content.events[0];
    if (!firstEvent)
      throw new Error("Expected the editor fixture to include an event");
    const content = {
      ...document.content,
      events: [
        {
          ...firstEvent,
          venueName: "Tempat ".repeat(60),
          address: "Alamat ".repeat(200),
        },
      ],
    };
    const model = toInvitationViewModel(content);
    const readiness = publicationReadiness(content, template);
    expect(model.events[0]?.venueName.length).toBe(250);
    expect(model.events[0]?.address?.length).toBe(1000);
    expect(readiness.issues.map((issue) => issue.code)).toContain(
      "EVENT_FIELD_TOO_LONG",
    );
  });
});

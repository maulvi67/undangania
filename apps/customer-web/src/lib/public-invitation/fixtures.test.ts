import { describe, expect, it } from "vitest";
import { invitationViewModelSchema } from "@wedding/template-engine";
import {
  getPublicInvitationFixture,
  getPublicInvitationSnapshot,
} from "./fixtures";

function section(
  model: ReturnType<typeof getPublicInvitationFixture>,
  type: string,
) {
  return model.sections.find((item) => item.type === type);
}

describe("public invitation fixtures", () => {
  it("validates the normal Indonesian publication model", () => {
    const model = getPublicInvitationFixture("normal");
    expect(invitationViewModelSchema.parse(model).locale).toBe("id-ID");
    expect(model.events).toHaveLength(2);
    expect(model.couple.displayNames).toBe("Rani & Bima");
  });

  it("covers long names and venue content without exceeding the model contract", () => {
    const model = getPublicInvitationFixture("long-content");
    expect(model.couple.displayNames.length).toBeGreaterThan(80);
    expect(model.events[0]?.venueName.length).toBeGreaterThan(80);
    expect(invitationViewModelSchema.parse(model)).toEqual(model);
  });

  it("covers three events and a thirty-image gallery", () => {
    const events = getPublicInvitationFixture("three-events");
    const gallery = getPublicInvitationFixture("large-gallery");
    expect(events.events).toHaveLength(3);
    expect(section(gallery, "gallery")?.payload.assetIds).toHaveLength(30);
  });

  it("omits optional sections rather than inventing content", () => {
    const model = getPublicInvitationFixture("missing-optional");
    expect(section(model, "story")?.visible).toBe(false);
    expect(section(model, "gallery")?.visible).toBe(false);
    expect(section(model, "gift")?.visible).toBe(false);
    expect(section(model, "events")?.visible).toBe(true);
  });

  it("provides a separate Nara publication snapshot", () => {
    const snapshot = getPublicInvitationSnapshot("rani-bima-nara");
    expect(snapshot?.templateId).toBe("nara-modern");
    expect(snapshot?.templateVersion).toBe("1");
    expect(
      snapshot?.model.sections.find((item) => item.type === "story")?.visible,
    ).toBe(true);
    expect(
      snapshot?.model.sections.find((item) => item.type === "faq")?.visible,
    ).toBe(true);
  });

  it("keeps the canonical public slug while selecting development fixtures", () => {
    expect(getPublicInvitationSnapshot("rani-bima")?.templateId).toBe(
      "seruni-klasik",
    );
    expect(
      getPublicInvitationSnapshot("rani-bima", "large-gallery")?.slug,
    ).toBe("rani-bima");
    expect(
      getPublicInvitationSnapshot("rani-bima-large-gallery", "large-gallery")
        ?.slug,
    ).toBe("rani-bima-large-gallery");
  });
});

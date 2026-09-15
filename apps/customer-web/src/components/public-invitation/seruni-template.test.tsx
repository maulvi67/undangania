import { describe, expect, it } from "vitest";
import { invitationViewModelSchema } from "@wedding/template-engine";
import { getPublicInvitationFixture } from "../../lib/public-invitation/fixtures";
import {
  SERUNI_MANIFEST,
  SeruniInvitation,
  seruniRenderer,
} from "./seruni-template";
import {
  getRegisteredTemplateIds,
  renderPublicationSnapshot,
} from "./registry";

describe("Seruni golden template", () => {
  it("exposes the required publication manifest and section order", () => {
    expect(SERUNI_MANIFEST.id).toBe("seruni-klasik");
    expect(SERUNI_MANIFEST.version).toBe("1");
    expect(SERUNI_MANIFEST.requiredSections).toEqual([
      "hero",
      "couple",
      "events",
      "closing",
    ]);
    expect(SERUNI_MANIFEST.supportedSections).toContain("guestbook");
    expect(SERUNI_MANIFEST.sectionOrder).toContain("rsvp");
  });

  it("renders from a validated canonical model without private fields", () => {
    const model = getPublicInvitationFixture("normal");
    const parsed = invitationViewModelSchema.parse(model);
    const output = seruniRenderer.render(parsed);
    expect(output).toBeTruthy();
    expect("tenantId" in parsed).toBe(false);
  });

  it("selects the registered immutable template version", () => {
    const model = getPublicInvitationFixture("normal");
    const output = renderPublicationSnapshot({
      templateId: "seruni-klasik",
      templateVersion: "1",
      contractVersion: 1,
      model,
    });
    expect(output).toBeTruthy();
    expect(getRegisteredTemplateIds()).toEqual(["seruni-klasik"]);
  });

  it("rejects a contract version the renderer does not understand", () => {
    expect(() =>
      renderPublicationSnapshot({
        templateId: "seruni-klasik",
        templateVersion: "1",
        contractVersion: 2,
        model: getPublicInvitationFixture("normal"),
      }),
    ).toThrow("Unsupported invitation contract version");
  });

  it("keeps the renderer as a pure React boundary", () => {
    const output = SeruniInvitation({
      model: getPublicInvitationFixture("missing-optional"),
    });
    expect(output).toBeTruthy();
  });
});

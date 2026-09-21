import { describe, expect, it } from "vitest";
import {
  editorContentSchema,
  publicationReadiness,
  sectionStatus,
  toInvitationViewModel,
  type EditorContent,
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

  it("preserves a persisted gallery order and appends new ready images", () => {
    const document = createEditorDocument("gallery-order");
    const media = [
      {
        id: "asset-a",
        filename: "a.jpg",
        mediaType: "IMAGE" as const,
        mimeType: "image/jpeg",
        state: "READY" as const,
        sizeBytes: 1,
        width: null,
        height: null,
        altText: null,
        rejectionReason: null,
      },
      {
        id: "asset-b",
        filename: "b.jpg",
        mediaType: "IMAGE" as const,
        mimeType: "image/jpeg",
        state: "READY" as const,
        sizeBytes: 1,
        width: null,
        height: null,
        altText: null,
        rejectionReason: null,
      },
    ];
    const model = toInvitationViewModel({
      ...document.content,
      media,
      galleryAssetIds: ["asset-b", "missing"],
    });
    const gallery = model.sections.find(
      (section) => section.type === "gallery",
    );
    expect(gallery?.payload.assetIds).toEqual(["asset-b", "asset-a"]);
  });

  it("accepts legacy drafts without a gallery order", () => {
    const document = createEditorDocument("legacy-gallery");
    const { galleryAssetIds: _galleryAssetIds, ...legacyContent } =
      document.content;
    const parsed = editorContentSchema.safeParse(legacyContent);
    expect(parsed.success).toBe(true);
  });

  it("rejects an unsafe visible music URL at publication readiness", () => {
    const document = createEditorDocument("music-validation");
    const readiness = publicationReadiness(
      {
        ...document.content,
        music: { enabled: true, visible: true, url: "javascript:alert(1)" },
      },
      template,
    );
    expect(readiness.issues.map((issue) => issue.code)).toContain(
      "MUSIC_URL_INVALID",
    );
  });

  it("blocks publication until images are ready and preserves safe alt text", () => {
    const document = createEditorDocument("media-readiness");
    const media: EditorContent["media"][number] = {
      id: "asset-1",
      filename: "photo.jpg",
      mediaType: "IMAGE",
      mimeType: "image/jpeg",
      state: "UPLOADED",
      sizeBytes: 1200,
      width: null,
      height: null,
      altText: "Pasangan di taman",
      rejectionReason: null,
    };
    const waiting = { ...document.content, media: [media] };
    const readiness = publicationReadiness(waiting, template);
    expect(readiness.ready).toBe(false);
    expect(readiness.issues.map((issue) => issue.code)).toContain(
      "MEDIA_NOT_READY",
    );

    const readyMedia: EditorContent["media"][number] = {
      ...media,
      state: "READY",
    };
    const model = toInvitationViewModel({
      ...document.content,
      media: [readyMedia],
    });
    const gallery = model.sections.find(
      (section) => section.type === "gallery",
    );
    expect(gallery?.payload.assetIds).toEqual(["asset-1"]);
    expect(gallery?.payload.assetAltTexts).toEqual({
      "asset-1": "Pasangan di taman",
    });
    expect(JSON.stringify(model)).not.toContain("signed");
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

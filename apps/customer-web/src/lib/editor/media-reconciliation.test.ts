import { describe, expect, it } from "vitest";
import { createEditorDocument } from "./test-document";
import {
  hasPendingMedia,
  mediaStateForContent,
  reconcileMediaAssets,
} from "./media-reconciliation";
import type { EditorContent } from "./contract";

function contentWithMedia(
  state: EditorContent["media"][number]["state"],
): EditorContent {
  const document = createEditorDocument("media-reconciliation");
  return {
    ...document.content,
    media: [
      {
        id: "asset-1",
        filename: "photo.jpg",
        mediaType: "IMAGE",
        mimeType: "image/jpeg",
        state,
        sizeBytes: 1200,
        width: null,
        height: null,
        altText: "Pasangan di taman",
        rejectionReason: null,
      },
    ],
  };
}

describe("editor media reconciliation", () => {
  it("updates asynchronous state and dimensions from the scoped list outcome", () => {
    const content = contentWithMedia("UPLOADED");
    const result = reconcileMediaAssets(content, {
      kind: "ok",
      assets: [
        {
          id: "asset-1",
          filename: "photo.jpg",
          mediaType: "IMAGE",
          mimeType: "image/jpeg",
          state: "READY",
          sizeBytes: 1200,
          width: 1600,
          height: 1067,
          altText: "Pasangan di taman",
          rejectionReason: null,
        },
      ],
    });

    expect(result.changed).toBe(true);
    expect(result.content.media[0]).toMatchObject({
      state: "READY",
      width: 1600,
      height: 1067,
    });
    expect(mediaStateForContent(result.content)).toBe("READY");
    expect(hasPendingMedia(result.content)).toBe(false);
  });

  it("does not reconcile an asset after the user marked it deleted", () => {
    const content = contentWithMedia("DELETED");
    const result = reconcileMediaAssets(content, {
      kind: "ok",
      assets: [
        {
          id: "asset-1",
          filename: "photo.jpg",
          mediaType: "IMAGE",
          mimeType: "image/jpeg",
          state: "READY",
          sizeBytes: 1200,
          width: 1600,
          height: 1067,
          altText: null,
          rejectionReason: null,
        },
      ],
    });

    expect(result.changed).toBe(false);
    expect(result.content.media[0]?.state).toBe("DELETED");
  });

  it("keeps polling eligible while processing and fails closed on unavailable reads", () => {
    const content = contentWithMedia("PROCESSING");
    const unavailable = reconcileMediaAssets(content, { kind: "unavailable" });

    expect(hasPendingMedia(content)).toBe(true);
    expect(mediaStateForContent(content)).toBe("PROCESSING");
    expect(unavailable).toEqual({ content, changed: false });
  });

  it("prioritizes rejection over processing for the editor status", () => {
    const content = contentWithMedia("PROCESSING");
    const firstAsset = content.media[0];
    if (firstAsset === undefined) throw new Error("Expected a media asset");
    const withRejected: EditorContent = {
      ...content,
      media: [
        ...content.media,
        {
          ...firstAsset,
          id: "asset-2",
          state: "REJECTED",
          rejectionReason: "File tidak dapat digunakan.",
        },
      ],
    };

    expect(mediaStateForContent(withRejected)).toBe("REJECTED");
  });
});

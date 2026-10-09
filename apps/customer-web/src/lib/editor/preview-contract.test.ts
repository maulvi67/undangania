import { describe, expect, it } from "vitest";
import { createEditorDocument } from "./test-document";
import {
  createPreviewRequestId,
  isSameOrigin,
  parsePreviewMessage,
} from "./preview-contract";
import { toInvitationViewModel } from "./contract";

describe("preview communication contract", () => {
  it("validates a typed preview update", () => {
    const message = {
      type: "EDITOR_PREVIEW_UPDATE",
      protocolVersion: 1,
      requestId: createPreviewRequestId(),
      templateId: "seruni-klasik",
      templateVersion: "1",
      changedSections: ["couple"],
      model: toInvitationViewModel(
        createEditorDocument("preview-test").content,
      ),
    };
    expect(parsePreviewMessage(message)?.type).toBe("EDITOR_PREVIEW_UPDATE");
  });

  it("rejects malformed messages and foreign origins", () => {
    expect(parsePreviewMessage({ type: "EDITOR_PREVIEW_UPDATE" })).toBeNull();
    expect(isSameOrigin("https://example.test", "https://example.test")).toBe(
      true,
    );
    expect(isSameOrigin("https://example.test", "https://other.test")).toBe(
      false,
    );
  });
});

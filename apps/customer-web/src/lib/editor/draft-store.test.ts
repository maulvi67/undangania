import { describe, expect, it } from "vitest";
import { createEditorDocument } from "./test-document";
import {
  loadStoredEditorDraft,
  parseStoredEditorDraft,
  saveStoredEditorDraft,
} from "./draft-store";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("editor recovery draft", () => {
  it("round-trips a validated document", () => {
    const target = storage();
    const document = createEditorDocument("draft-store-test");
    saveStoredEditorDraft(
      "draft-store-test",
      { document, baseVersion: 1, savedAt: Date.now() },
      target,
    );
    expect(
      loadStoredEditorDraft("draft-store-test", target)?.document.invitationId,
    ).toBe("draft-store-test");
  });

  it("ignores malformed stored data", () => {
    expect(parseStoredEditorDraft('{"document":{}}')).toBeNull();
  });
});

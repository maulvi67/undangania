import { describe, expect, it } from "vitest";
import { createEditorDocument } from "./stub-transport";
import { keepLocalContent, mergeStaleDocument } from "./stale-merge";

describe("stale editor merge", () => {
  it("keeps non-overlapping local changes and reports conflicts", () => {
    const base = createEditorDocument("merge-test");
    const local = {
      ...base,
      content: {
        ...base.content,
        story: { ...base.content.story, body: "Kisah kami" },
      },
    };
    const server = {
      ...base,
      version: 2,
      content: {
        ...base.content,
        settings: { ...base.content.settings, invitationTitle: "Rani & Bima" },
      },
    };
    const result = mergeStaleDocument(local, server, base);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged.content.story.body).toBe("Kisah kami");
    expect(result.merged.content.settings.invitationTitle).toBe("Rani & Bima");
  });

  it("reports simultaneous edits to the same section", () => {
    const base = createEditorDocument("merge-test");
    const local = {
      ...base,
      content: {
        ...base.content,
        story: { ...base.content.story, body: "Versi saya" },
      },
    };
    const server = {
      ...base,
      version: 2,
      content: {
        ...base.content,
        story: { ...base.content.story, body: "Versi tersimpan" },
      },
    };
    const result = mergeStaleDocument(local, server, base);
    expect(result.conflicts.map((conflict) => conflict.key)).toContain("story");
    expect(
      keepLocalContent(result.merged, local, "story").content.story.body,
    ).toBe("Versi saya");
  });
});

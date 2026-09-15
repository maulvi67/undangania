import { describe, expect, it } from "vitest";
import { canReorderSection, reorderSection, validateDraft } from "./index";

const model = {
  schemaVersion: 1 as const,
  locale: "id-ID",
  timezone: "Asia/Jakarta",
  couple: { displayNames: "Rani & Bima" },
  events: [],
  sections: [
    { id: "hero", type: "hero" as const, visible: true, payload: {} },
    { id: "couple", type: "couple" as const, visible: true, payload: {} },
    { id: "events", type: "events" as const, visible: true, payload: {} },
  ],
};

describe("template editor operations", () => {
  it("validates drafts against the canonical model", () => {
    expect(validateDraft(model).sections).toHaveLength(3);
  });

  it("rejects a move outside the constrained reorderable set", () => {
    const policy = {
      allowedOrder: ["hero", "couple", "events"],
      reorderableSections: ["events"],
    } as const;
    expect(canReorderSection(model, 2, 1, policy)).toBe(false);
    expect(reorderSection(model, 2, 1, policy)).toBe(model);
  });

  it("keeps the original operation available without a manifest policy", () => {
    const moved = reorderSection(model, 1, 2);
    expect(moved.sections.map((section) => section.type)).toEqual([
      "hero",
      "events",
      "couple",
    ]);
  });
});

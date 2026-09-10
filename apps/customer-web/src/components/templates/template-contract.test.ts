import { describe, expect, it } from "vitest";
import {
  SECTION_LABELS,
  TEMPLATE_SECTION_IDS,
  formatIdr,
  templateRecordSchema,
} from "./template-contract";
import { DEFAULT_TEMPLATE_ID, TEMPLATES, getActiveTemplates, getTemplate } from "./template-data";

describe("template contract", () => {
  it("labels exist for every section id", () => {
    for (const id of TEMPLATE_SECTION_IDS) {
      expect(SECTION_LABELS[id].length).toBeGreaterThan(0);
    }
  });

  it("rejects raw CSS/color values in theme tokens", () => {
    expect(() =>
      templateRecordSchema.parse({
        ...TEMPLATES[0],
        theme: { palette: "red; background:url(x)", accent: "olive", typeMood: "serif", ornament: "none" },
      }),
    ).toThrow();
  });

  it("rejects negative or fractional prices", () => {
    expect(() => templateRecordSchema.parse({ ...TEMPLATES[0], priceIdr: -1 })).toThrow();
    expect(() => templateRecordSchema.parse({ ...TEMPLATES[0], priceIdr: 1000.5 })).toThrow();
  });

  it("allows a null price (payment package unavailable)", () => {
    expect(templateRecordSchema.parse({ ...TEMPLATES[0], priceIdr: null }).priceIdr).toBeNull();
  });

  it("rejects unknown design tiers", () => {
    expect(() => templateRecordSchema.parse({ ...TEMPLATES[0], tier: "premium" })).toThrow();
  });

  it("rejects unknown section ids", () => {
    expect(() => templateRecordSchema.parse({ ...TEMPLATES[0], sections: ["countdown"] })).toThrow();
  });

  it("formats IDR with dot thousands separators and no decimals", () => {
    // Node emits a non-breaking space after "Rp" for id-ID currency.
    expect(formatIdr(349000)).toMatch(/^Rp[\s\u00A0]?349\.000$/);
  });
});

describe("template data", () => {
  it("returns undefined for unknown ids", () => {
    expect(getTemplate("tidak-ada")).toBeUndefined();
  });

  it("finds templates by id", () => {
    expect(getTemplate(DEFAULT_TEMPLATE_ID)?.name).toBe("Seruni");
  });

  it("never lists non-ACTIVE templates as active", () => {
    const active = getActiveTemplates();
    expect(active.every((t) => t.status === "ACTIVE")).toBe(true);
    expect(active.some((t) => t.id === "cempaka-lama")).toBe(false);
  });

  it("has at least one ACTIVE template with a demo", () => {
    expect(getActiveTemplates().some((t) => t.demo.available)).toBe(true);
  });
});

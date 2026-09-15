import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUERY,
  activeFilterTokens,
  applyCatalogQuery,
  catalogHref,
  filterCount,
  hasActiveFilters,
  matchesQuery,
  parseCatalogQuery,
  uniqueCategories,
} from "./catalog-query";
import { TEMPLATES, getActiveTemplates } from "../templates/template-data";
import { templateRecordSchema } from "../templates/template-contract";

describe("parseCatalogQuery", () => {
  it("returns defaults for an empty search params object", () => {
    expect(parseCatalogQuery({})).toEqual(DEFAULT_QUERY);
  });

  it("falls back to defaults for unknown enum values", () => {
    expect(
      parseCatalogQuery({
        urutkan: "murah",
        harga: "premium",
        kategori: "<script>",
      }),
    ).toEqual({
      ...DEFAULT_QUERY,
      kategori: "<script>",
    });
  });

  it("trims and collapses whitespace, keeping only the first value of arrays", () => {
    expect(parseCatalogQuery({ q: ["  desain \n klasik ", "nara"] }).q).toBe(
      "desain klasik",
    );
  });

  it("parses a fully specified valid query", () => {
    expect(
      parseCatalogQuery({
        q: "nara",
        kategori: "Modern",
        harga: "sederhana",
        urutkan: "harga-terendah",
      }),
    ).toEqual({
      q: "nara",
      kategori: "Modern",
      harga: "sederhana",
      urutkan: "harga-terendah",
    });
  });
});

describe("applyCatalogQuery", () => {
  it("never includes RETIRED templates", () => {
    const results = applyCatalogQuery(TEMPLATES, DEFAULT_QUERY);
    expect(results.every((template) => template.status === "ACTIVE")).toBe(
      true,
    );
    expect(results).toHaveLength(getActiveTemplates().length);
  });

  it("terbaru keeps fixture (newest-first) order", () => {
    expect(
      applyCatalogQuery(TEMPLATES, DEFAULT_QUERY).map(
        (template) => template.id,
      ),
    ).toEqual(["seruni-klasik", "nara-modern", "kenanga-tradisi"]);
  });

  it("filters by category case-insensitively", () => {
    const results = applyCatalogQuery(TEMPLATES, {
      ...DEFAULT_QUERY,
      kategori: "klasik",
    });
    expect(results.map((template) => template.id)).toEqual(["seruni-klasik"]);
  });

  it("filters by design tier", () => {
    const results = applyCatalogQuery(TEMPLATES, {
      ...DEFAULT_QUERY,
      harga: "sederhana",
    });
    expect(results.map((template) => template.id)).toEqual(["nara-modern"]);
  });

  it("matches q against name, category, and design character", () => {
    expect(matchesQuery(TEMPLATES[0]!, "seruni")).toBe(true);
    expect(matchesQuery(TEMPLATES[0]!, "TIPOGRAFI")).toBe(true);
    const byCategory = applyCatalogQuery(TEMPLATES, {
      ...DEFAULT_QUERY,
      q: "modern",
    });
    expect(byCategory.map((template) => template.id)).toEqual(["nara-modern"]);
  });

  it("combines filters and search conjunctively", () => {
    const results = applyCatalogQuery(TEMPLATES, {
      ...DEFAULT_QUERY,
      q: "seruni",
      kategori: "Modern",
    });
    expect(results).toEqual([]);
  });

  it("sorts by price ascending", () => {
    const prices = applyCatalogQuery(TEMPLATES, {
      ...DEFAULT_QUERY,
      urutkan: "harga-terendah",
    }).map((template) => template.priceIdr);
    expect(prices).toEqual([149000, 249000, 349000]);
  });

  it("sorts by price descending", () => {
    const prices = applyCatalogQuery(TEMPLATES, {
      ...DEFAULT_QUERY,
      urutkan: "harga-tertinggi",
    }).map((template) => template.priceIdr);
    expect(prices).toEqual([349000, 249000, 149000]);
  });

  it("sorts null prices last regardless of direction", () => {
    const unpriced = templateRecordSchema.parse({
      ...TEMPLATES[0]!,
      id: "uji-tanpa-harga",
      priceIdr: null,
    });
    const ascending = applyCatalogQuery([unpriced, ...TEMPLATES], {
      ...DEFAULT_QUERY,
      urutkan: "harga-terendah",
    });
    const descending = applyCatalogQuery([unpriced, ...TEMPLATES], {
      ...DEFAULT_QUERY,
      urutkan: "harga-tertinggi",
    });
    expect(ascending.at(-1)?.id).toBe("uji-tanpa-harga");
    expect(descending.at(-1)?.id).toBe("uji-tanpa-harga");
  });
});

describe("catalogHref", () => {
  it("omits default and empty values", () => {
    expect(catalogHref(DEFAULT_QUERY)).toBe("/templates");
    expect(catalogHref({ ...DEFAULT_QUERY, urutkan: "terbaru", q: "" })).toBe(
      "/templates",
    );
  });

  it("includes non-default values in a stable order", () => {
    expect(
      catalogHref({ ...DEFAULT_QUERY, q: "nara", urutkan: "harga-terendah" }),
    ).toBe("/templates?q=nara&urutkan=harga-terendah");
  });
});

describe("activeFilterTokens", () => {
  it("returns nothing for the default query", () => {
    expect(activeFilterTokens(DEFAULT_QUERY)).toEqual([]);
    expect(filterCount(DEFAULT_QUERY)).toBe(0);
    expect(hasActiveFilters(DEFAULT_QUERY)).toBe(false);
  });

  it("returns a removable token per active param with the param cleared from its href", () => {
    const query = parseCatalogQuery({
      q: "nara",
      kategori: "Modern",
      urutkan: "harga-terendah",
    });
    const tokens = activeFilterTokens(query);
    expect(tokens.map((token) => token.key)).toEqual([
      "q",
      "kategori",
      "urutkan",
    ]);
    expect(tokens[0]!.href).toBe(
      "/templates?kategori=Modern&urutkan=harga-terendah",
    );
    expect(tokens[2]!.href).toBe("/templates?q=nara&kategori=Modern");
    expect(filterCount(query)).toBe(3);
    expect(hasActiveFilters(query)).toBe(true);
  });

  it("labels tier tokens with the Indonesian tier label", () => {
    const tokens = activeFilterTokens({ ...DEFAULT_QUERY, harga: "eksklusif" });
    expect(tokens[0]!.label).toBe("Level harga: Eksklusif");
  });
});

describe("uniqueCategories", () => {
  it("lists active categories in fixture order, skipping RETIRED duplicates", () => {
    expect(uniqueCategories(TEMPLATES)).toEqual([
      "Klasik",
      "Modern",
      "Tradisi",
    ]);
  });
});

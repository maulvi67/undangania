import {
  TEMPLATE_TIERS,
  TIER_LABELS,
  type TemplateRecord,
  type TemplateTier,
} from "../templates/template-contract";

/**
 * Catalog query model (MVP-UI-003). The URL is the single source of truth:
 * every interaction is one full-page GET, so parsing must be total — unknown
 * or malformed values fall back to safe defaults instead of throwing on
 * user-controlled input.
 */

export const CATALOG_SORTS = ["terbaru", "harga-terendah", "harga-tertinggi"] as const;

export type CatalogSort = (typeof CATALOG_SORTS)[number];

export const SORT_OPTIONS: ReadonlyArray<{ value: CatalogSort; label: string }> = [
  { value: "terbaru", label: "Terbaru" },
  { value: "harga-terendah", label: "Harga terendah" },
  { value: "harga-tertinggi", label: "Harga tertinggi" },
];

/**
 * Fixture order is newest-first by convention (documented in template-data);
 * "terbaru" keeps that order, so it doubles as the identity sort.
 */
export const DEFAULT_SORT: CatalogSort = "terbaru";

export type CatalogQuery = {
  /** Free-text search over name, category, and design character. */
  q: string;
  /** Exact category match (case-insensitive); empty string means all. */
  kategori: string;
  /** Design tier; empty string means all tiers. */
  harga: TemplateTier | "";
  urutkan: CatalogSort;
};

export const DEFAULT_QUERY: CatalogQuery = {
  q: "",
  kategori: "",
  harga: "",
  urutkan: DEFAULT_SORT,
};

/** Shape Next.js passes as `searchParams` (values may be repeated). */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Collapse whitespace manually (avoids Zod v4 chained-transform pitfalls). */
function normalize(value: string): string {
  return value.trim().replaceAll(/\s+/g, " ");
}

function parseTier(value: string): TemplateTier | "" {
  return (TEMPLATE_TIERS as readonly string[]).includes(value) ? (value as TemplateTier) : "";
}

function parseSort(value: string): CatalogSort {
  return (CATALOG_SORTS as readonly string[]).includes(value) ? (value as CatalogSort) : DEFAULT_SORT;
}

export function parseCatalogQuery(raw: RawSearchParams): CatalogQuery {
  return {
    q: normalize(firstValue(raw.q) ?? "").slice(0, 100),
    kategori: normalize(firstValue(raw.kategori) ?? "").slice(0, 40),
    harga: parseTier(normalize(firstValue(raw.harga) ?? "")),
    urutkan: parseSort(normalize(firstValue(raw.urutkan) ?? "")),
  };
}

export function matchesQuery(template: TemplateRecord, q: string): boolean {
  const needle = q.toLowerCase();
  return (
    template.name.toLowerCase().includes(needle) ||
    template.category.toLowerCase().includes(needle) ||
    template.designCharacter.toLowerCase().includes(needle)
  );
}

function compareByPrice(direction: 1 | -1) {
  return (a: TemplateRecord, b: TemplateRecord): number => {
    // Null price (unavailable) always sorts last regardless of direction.
    if (a.priceIdr === null && b.priceIdr === null) return 0;
    if (a.priceIdr === null) return 1;
    if (b.priceIdr === null) return -1;
    return (a.priceIdr - b.priceIdr) * direction;
  };
}

export function applyCatalogQuery(
  templates: readonly TemplateRecord[],
  query: CatalogQuery,
): TemplateRecord[] {
  const results = templates.filter((template) => {
    if (template.status !== "ACTIVE") return false;
    if (query.kategori !== "" && template.category.toLowerCase() !== query.kategori.toLowerCase()) {
      return false;
    }
    if (query.harga !== "" && template.tier !== query.harga) return false;
    if (query.q !== "" && !matchesQuery(template, query.q)) return false;
    return true;
  });

  if (query.urutkan === "harga-terendah") results.sort(compareByPrice(1));
  else if (query.urutkan === "harga-tertinggi") results.sort(compareByPrice(-1));
  return results;
}

export function catalogHref(query: CatalogQuery): string {
  const params = new URLSearchParams();
  if (query.q !== "") params.set("q", query.q);
  if (query.kategori !== "") params.set("kategori", query.kategori);
  if (query.harga !== "") params.set("harga", query.harga);
  if (query.urutkan !== DEFAULT_SORT) params.set("urutkan", query.urutkan);
  const search = params.toString();
  return search === "" ? "/templates" : `/templates?${search}`;
}

export type CatalogFilterToken = {
  key: "q" | "kategori" | "harga" | "urutkan";
  label: string;
  href: string;
};

export function activeFilterTokens(query: CatalogQuery): CatalogFilterToken[] {
  const tokens: CatalogFilterToken[] = [];
  if (query.q !== "") {
    tokens.push({ key: "q", label: `Pencarian: "${query.q}"`, href: catalogHref({ ...query, q: "" }) });
  }
  if (query.kategori !== "") {
    tokens.push({
      key: "kategori",
      label: `Kategori: ${query.kategori}`,
      href: catalogHref({ ...query, kategori: "" }),
    });
  }
  if (query.harga !== "") {
    tokens.push({
      key: "harga",
      label: `Level harga: ${TIER_LABELS[query.harga]}`,
      href: catalogHref({ ...query, harga: "" }),
    });
  }
  if (query.urutkan !== DEFAULT_SORT) {
    const option = SORT_OPTIONS.find((candidate) => candidate.value === query.urutkan);
    tokens.push({
      key: "urutkan",
      label: `Urutan: ${option?.label ?? query.urutkan}`,
      href: catalogHref({ ...query, urutkan: DEFAULT_SORT }),
    });
  }
  return tokens;
}

export function filterCount(query: CatalogQuery): number {
  return activeFilterTokens(query).length;
}

export function hasActiveFilters(query: CatalogQuery): boolean {
  return filterCount(query) > 0;
}

/** Unique categories of ACTIVE templates, in fixture (newest-first) order. */
export function uniqueCategories(templates: readonly TemplateRecord[]): string[] {
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const template of templates) {
    if (template.status !== "ACTIVE") continue;
    const key = template.category.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      categories.push(template.category);
    }
  }
  return categories;
}

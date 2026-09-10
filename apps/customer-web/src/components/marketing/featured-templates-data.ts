export type FeaturedPreview = "klasik" | "minimalis" | "tradisional";

export type FeaturedTemplate = {
  id: string;
  name: string;
  character: string;
  preview: FeaturedPreview;
};

/**
 * Static curated content for the landing page. Illustrative design
 * directions only — the real collection lives in the catalog route.
 */
export const FEATURED_TEMPLATES: readonly FeaturedTemplate[] = [
  {
    id: "elegan-klasik",
    name: "Elegan klasik",
    character: "Tipografi serif dan ornamen garis halus untuk kesan resmi dan berkesan.",
    preview: "klasik",
  },
  {
    id: "minimalis-modern",
    name: "Minimalis modern",
    character: "Ruang kosong yang lapang dan tipografi ramping untuk kesan kontemporer.",
    preview: "minimalis",
  },
  {
    id: "nuansa-tradisional",
    name: "Bernuansa tradisional",
    character: "Palet hangat dan aksen khas tradisi pernikahan Indonesia.",
    preview: "tradisional",
  },
];

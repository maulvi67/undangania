import { templateRecordSchema, type TemplateRecord } from "./template-contract";

/**
 * Fixture dataset (MVP-UI-004/003). Every record is validated against the
 * contract at module load — a malformed fixture fails loudly, not silently.
 * Array order is newest-first by convention; the catalog's "Terbaru" sort
 * preserves it, so new fixtures must be prepended, not appended.
 *
 * All designs are original CSS compositions created in-repo (no external
 * template sources or third-party assets), so source/license origin is
 * clean by construction. Prices are placeholder values pending product
 * confirmation (TODO(product)).
 */
const FIXTURES = [
  {
    id: "seruni-klasik",
    name: "Seruni",
    category: "Klasik",
    designCharacter:
      "Tipografi serif dan ornamen garis halus untuk kesan resmi.",
    designStory:
      "Seruni menghadirkan kesan resmi dengan tipografi serif yang tegas dan ornamen garis halus. Susunan konten yang seimbang memberi ruang bagi nama dan tanggal acara Anda untuk tampil tenang dan berwibawa — cocok untuk perayaan dengan nuansa klasik.",
    priceIdr: 349000,
    tier: "eksklusif",
    status: "ACTIVE",
    sections: [
      "hero",
      "couple",
      "events",
      "gallery",
      "gift",
      "guestbook",
      "rsvp",
      "closing",
    ],
    theme: {
      palette: "ivory",
      accent: "olive",
      typeMood: "serif",
      ornament: "hairline",
    },
    demo: { available: true },
  },
  {
    id: "nara-modern",
    name: "Nara",
    category: "Modern",
    designCharacter:
      "Ruang kosong lapang dan tipografi ramping untuk kesan kontemporer.",
    designStory:
      "Nara memanfaatkan ruang kosong yang lapang dan tipografi ramping untuk kesan kontemporer yang tenang. Setiap bagian undangan tampil sederhana dan mudah dibaca — pilihan tepat bila Anda menginginkan kesan ringkas dan mutakhir.",
    priceIdr: 149000,
    tier: "sederhana",
    status: "ACTIVE",
    sections: [
      "hero",
      "couple",
      "events",
      "gallery",
      "gift",
      "guestbook",
      "rsvp",
      "closing",
    ],
    theme: {
      palette: "paper",
      accent: "olive",
      typeMood: "sans",
      ornament: "none",
    },
    demo: { available: true },
  },
  {
    id: "kenanga-tradisi",
    name: "Kenanga",
    category: "Tradisi",
    designCharacter:
      "Palet hangat dan aksen khas tradisi pernikahan Indonesia.",
    designStory:
      "Kenanga menghadirkan palet hangat dengan aksen yang mengikuti tradisi pernikahan Indonesia. Nuansa ramah dan bersahaja cocok untuk perayaan yang ingin terasa dekat dengan keluarga dan tamu.",
    priceIdr: 249000,
    tier: "klasik-detail",
    status: "ACTIVE",
    sections: [
      "hero",
      "couple",
      "events",
      "gallery",
      "gift",
      "guestbook",
      "rsvp",
      "closing",
    ],
    theme: {
      palette: "blush",
      accent: "clay",
      typeMood: "serif",
      ornament: "frame",
    },
    demo: { available: true },
  },
  {
    id: "cempaka-lama",
    name: "Cempaka",
    category: "Klasik",
    designCharacter: "Desain klasik yang telah dipensiunkan dari koleksi.",
    designStory:
      "Cempaka adalah desain yang telah dipensiunkan dari koleksi aktif.",
    priceIdr: 199000,
    tier: "klasik-detail",
    status: "RETIRED",
    sections: ["hero", "couple", "events", "rsvp", "closing"],
    theme: {
      palette: "ivory",
      accent: "gold",
      typeMood: "serif",
      ornament: "frame",
    },
    demo: { available: false },
  },
] as const;

export const TEMPLATES: readonly TemplateRecord[] = FIXTURES.map((fixture) =>
  templateRecordSchema.parse(fixture),
);

/** The template the landing page's `/demo` link presents. */
export const DEFAULT_TEMPLATE_ID = "seruni-klasik";

export function getTemplate(id: string): TemplateRecord | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

/** Only ACTIVE templates are ever listed publicly. */
export function getActiveTemplates(): readonly TemplateRecord[] {
  return TEMPLATES.filter((template) => template.status === "ACTIVE");
}

import { z } from "zod";

/**
 * Catalog-facing template record contract (MVP-UI-004).
 *
 * Fixture-backed for now; the shape mirrors the template domain
 * (docs/domains/invitation-template.md) so a real API can replace the
 * fixture without route changes. Theme values are allowlisted token
 * names (never raw CSS/color strings) per the template-customization
 * domain rule "validated tokens only".
 */

export const TEMPLATE_SECTION_IDS = [
  "hero",
  "couple",
  "events",
  "gallery",
  "gift",
  "guestbook",
  "rsvp",
  "closing",
] as const;

export type TemplateSectionId = (typeof TEMPLATE_SECTION_IDS)[number];

/** Manifest is the source of truth for capability labels. */
export const SECTION_LABELS: Record<TemplateSectionId, string> = {
  hero: "Halaman pembuka",
  couple: "Profil mempelai",
  events: "Rangkaian acara (akad & resepsi)",
  gallery: "Galeri foto",
  gift: "Informasi kado",
  guestbook: "Buku tamu",
  rsvp: "RSVP / konfirmasi kehadiran",
  closing: "Penutup & terima kasih",
};

export const templateThemeSchema = z.object({
  palette: z.enum(["ivory", "paper", "blush"]),
  accent: z.enum(["olive", "clay", "gold"]),
  typeMood: z.enum(["serif", "sans"]),
  ornament: z.enum(["hairline", "frame", "none"]),
});

export type TemplateTheme = z.infer<typeof templateThemeSchema>;

/**
 * Price tiers describe design/asset complexity only — never functionality.
 * Every tier includes the same Digital Invitation Core.
 */
export const TEMPLATE_TIERS = [
  "sederhana",
  "klasik-detail",
  "eksklusif",
] as const;

export type TemplateTier = (typeof TEMPLATE_TIERS)[number];

export const TIER_LABELS: Record<TemplateTier, string> = {
  sederhana: "Sederhana",
  "klasik-detail": "Klasik detail",
  eksklusif: "Eksklusif",
};

export const templateRecordSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(80),
  category: z.string().min(1).max(40),
  /** One-line character summary (card-level). */
  designCharacter: z.string().min(1).max(160),
  /** Longer character description (detail-level). */
  designStory: z.string().min(1).max(600),
  /** Final price in IDR; null means the payment package is unavailable. */
  priceIdr: z.number().int().positive().nullable(),
  /** Design-complexity tier; labels are craft language, never functional. */
  tier: z.enum(TEMPLATE_TIERS),
  /** Domain status; only ACTIVE templates may be shown publicly. */
  status: z.enum(["ACTIVE", "RETIRED"]),
  sections: z.array(z.enum(TEMPLATE_SECTION_IDS)).min(1),
  theme: templateThemeSchema,
  demo: z.object({ available: z.boolean() }),
});

export type TemplateRecord = z.infer<typeof templateRecordSchema>;

export function formatIdr(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

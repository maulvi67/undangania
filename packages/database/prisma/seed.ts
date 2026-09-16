import { PrismaClient } from "@prisma/client";
import {
  PrismaTemplateCatalogueRepository,
  PrismaPackageCatalogueRepository,
} from "../src/index";

/**
 * Seed script.
 *
 * Only catalogue content is seeded: the designs the catalog sells and the prices
 * checkout charges. Both are product content that follows a release, so the seed is
 * the same operation the running app performs on first use — `ensureTemplatePersisted`
 * and `ensurePackagePricePersisted` call the very same repository methods. Running it
 * is therefore idempotent and never contradicts the application.
 *
 * Synthetic tenants, weddings, guests, and orders are NOT created here. Those are
 * customer data, and a seed that invents them is how test fixtures end up in a
 * production database. Use a dedicated test database and its own fixtures for that.
 */

const TEMPLATE_VERSION = "1";

const CURRENCY = "IDR";

/**
 * Mirrors `apps/customer-web/src/components/templates/template-data.ts`.
 *
 * The fixture list is the source of truth for the catalog UI, but this script runs
 * inside the database package and cannot import from an app. Only the fields the
 * foreign key and the price need are repeated here, and the app re-syncs its own
 * values from the fixtures on first request — so a drift is corrected rather than
 * persisted.
 */
const TEMPLATES = [
  {
    id: "seruni-klasik",
    name: "Seruni",
    category: "Klasik",
    tier: "eksklusif",
    status: "ACTIVE",
    priceIdr: 349_000,
    supportedSections: [
      "hero",
      "couple",
      "events",
      "gallery",
      "gift",
      "guestbook",
      "rsvp",
      "closing",
    ],
  },
  {
    id: "nara-modern",
    name: "Nara",
    category: "Modern",
    tier: "sederhana",
    status: "ACTIVE",
    priceIdr: 149_000,
    supportedSections: [
      "hero",
      "couple",
      "events",
      "gallery",
      "gift",
      "guestbook",
      "rsvp",
      "closing",
    ],
  },
  {
    id: "kenanga-tradisi",
    name: "Kenanga",
    category: "Tradisional",
    tier: "klasik-detail",
    status: "ACTIVE",
    priceIdr: 249_000,
    supportedSections: [
      "hero",
      "couple",
      "events",
      "gallery",
      "gift",
      "guestbook",
      "rsvp",
      "closing",
    ],
  },
  {
    id: "cempaka-lama",
    name: "Cempaka",
    category: "Klasik",
    tier: "klasik-detail",
    status: "RETIRED",
    priceIdr: 199_000,
    supportedSections: [
      "hero",
      "couple",
      "events",
      "gallery",
      "gift",
      "guestbook",
      "rsvp",
      "closing",
    ],
  },
] as const;

/**
 * `contractVersion` describes the view-model shape a template renders, not the design
 * revision. It must be a positive integer or the template is unpublishable, which is
 * why it is written explicitly rather than left to the app.
 */
const TEMPLATE_CONTRACT_VERSION = 1;

const RENDERED_SECTIONS = [
  "hero",
  "couple",
  "events",
  "venue",
  "cover",
  "story",
  "gallery",
  "music",
  "gift",
  "faq",
] as const;

/**
 * The catalogue's effective-from date. A fixed value keeps the price sync idempotent:
 * a moving date would make every run look like a price change.
 */
const ACTIVE_FROM = new Date("2020-01-01T00:00:00.000Z");

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const templates = new PrismaTemplateCatalogueRepository();
  const packages = new PrismaPackageCatalogueRepository();

  try {
    for (const template of TEMPLATES) {
      await templates.sync({
        id: template.id,
        version: TEMPLATE_VERSION,
        name: template.name,
        category: template.category,
        tier: template.tier,
        status: template.status,
        manifest: {
          id: template.id,
          version: TEMPLATE_VERSION,
          contractVersion: TEMPLATE_CONTRACT_VERSION,
          name: template.name,
          category: template.category,
          supportedSections: [
            ...new Set([...template.supportedSections, ...RENDERED_SECTIONS]),
          ],
          requiredSections: ["couple", "events"],
          reorderableSections: ["story", "gallery", "music", "gift", "faq"],
          sectionOrder: [...RENDERED_SECTIONS],
        },
      });

      const result = await packages.syncPrice({
        code: template.id,
        name: template.name,
        status: template.status,
        priceIdr: template.priceIdr,
        currency: CURRENCY,
        activeFrom: ACTIVE_FROM,
      });

      console.info(
        result.created
          ? `price created for ${template.id} (${template.priceIdr} ${CURRENCY})`
          : `price already current for ${template.id}`,
      );
    }

    console.info(`seeded ${TEMPLATES.length} catalogue entries`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("seed failed:", error);
  process.exitCode = 1;
});

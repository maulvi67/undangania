import { PrismaPackageCatalogueRepository } from "@wedding/database";
import type { PackageCatalogueEntry } from "@wedding/database";
import {
  getActiveTemplates,
  getTemplate,
} from "../../components/templates/template-data";
import type { TemplateRecord } from "../../components/templates/template-contract";

/**
 * Package and price persistence for the template catalogue.
 *
 * Designs are authored as in-repo fixtures and referenced by id at checkout. The
 * catalog that checkout prices against is the `Package`/`Price` pair, so this module
 * closes the gap the same way `template-catalogue.ts` does for the template rows:
 * it turns a fixture into the rows checkout reads, and is called before any purchase.
 *
 * The price comes from the same record the catalog page renders rather than being
 * duplicated, so what a customer is shown and what they are charged cannot drift.
 *
 * `activeFrom` is a fixed epoch because a fixture has no release date. Using "now"
 * would make the price look like it changed on every deploy, and the sync already
 * treats an existing matching row as current.
 */

/** The catalogue's effective-from date; a stable value keeps the sync idempotent. */
const CATALOGUE_ACTIVE_FROM = new Date("2020-01-01T00:00:00.000Z");

const CURRENCY = "IDR";

export function packageEntryFor(
  record: TemplateRecord,
): PackageCatalogueEntry | null {
  // A design with no price cannot be sold, so there is nothing to persist. Returning
  // null rather than a zero price keeps a missing figure from becoming a free order.
  if (record.priceIdr === null || record.priceIdr <= 0) return null;

  return {
    code: record.id,
    name: record.name,
    // Only ACTIVE designs are sellable; checkout re-checks this as well.
    status: record.status,
    priceIdr: record.priceIdr,
    currency: CURRENCY,
    activeFrom: CATALOGUE_ACTIVE_FROM,
  };
}

/**
 * Makes a design's package and price exist, if the id names a sellable design.
 *
 * Returns false for an unknown or unpriced id so the caller rejects it rather than
 * pricing a design the catalog cannot charge for.
 */
export async function ensurePackagePricePersisted(
  templateId: string,
): Promise<boolean> {
  const record = getTemplate(templateId);
  if (record === undefined) return false;

  const entry = packageEntryFor(record);
  if (entry === null) return false;

  await new PrismaPackageCatalogueRepository().syncPrice(entry);
  return true;
}

/** Persists every active design's price, for the seed and for release steps. */
export async function ensureActivePackagePricesPersisted(): Promise<number> {
  const repository = new PrismaPackageCatalogueRepository();
  const records = getActiveTemplates();

  let synced = 0;
  for (const record of records) {
    const entry = packageEntryFor(record);
    if (entry === null) continue;
    await repository.syncPrice(entry);
    synced += 1;
  }
  return synced;
}

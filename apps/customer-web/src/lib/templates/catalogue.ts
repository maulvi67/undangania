import { PrismaTemplateCatalogueRepository } from "@wedding/database";
import type { TemplateCatalogueEntry } from "@wedding/database";
import type { TemplateManifest } from "@wedding/template-engine";
import {
  getActiveTemplates,
  getTemplate,
} from "../../components/templates/template-data";
import type { TemplateRecord } from "../../components/templates/template-contract";

/**
 * Template catalogue persistence.
 *
 * Designs are authored as in-repo fixtures, but `Invitation` carries a composite
 * foreign key to `Template [id, version]`, so a fixture list alone cannot satisfy
 * it. This module closes that gap: it turns a fixture into the row that foreign
 * key needs, and is called before any invitation is provisioned.
 *
 * The manifest is built from the same record the catalog page renders rather than
 * duplicated in the database, so what a customer is shown and what the editor
 * enforces cannot drift apart. `contractVersion` is mandatory: publication stamps
 * it onto a snapshot, so a template without one would be publishable in name only.
 */

/** Everything the editor can render; a manifest must declare all of it. */
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
 * `contractVersion` describes the view-model shape a template renders, not the
 * design revision. It changes only when the renderer contract changes, which is
 * what keeps an old snapshot renderable.
 */
const TEMPLATE_CONTRACT_VERSION = 1;

/** The catalogue's version column; also the invitation's template binding. */
export const TEMPLATE_VERSION = "1";

export function manifestFor(record: TemplateRecord): TemplateManifest {
  // The catalog's section list and the editor's renderable set overlap but are
  // not identical: the editor can render platform sections (RSVP, guestbook,
  // closing) that a design does not advertise. The union is what a template can
  // actually be asked to render.
  const supportedSections = [
    ...new Set([...record.sections, ...RENDERED_SECTIONS]),
  ];

  return {
    id: record.id,
    version: TEMPLATE_VERSION,
    contractVersion: TEMPLATE_CONTRACT_VERSION,
    name: record.name,
    category: record.category,
    supportedSections,
    requiredSections: ["couple", "events"],
    reorderableSections: ["story", "gallery", "music", "gift", "faq"],
    sectionOrder: [...RENDERED_SECTIONS],
  };
}

export function catalogueEntry(record: TemplateRecord): TemplateCatalogueEntry {
  // `TemplateManifest` is a readonly view of JSON; the catalogue stores it as an
  // input value. Both describe the same data, so the assertion is structural
  // rather than a loosening of the type.
  const manifest = manifestFor(
    record,
  ) as unknown as TemplateCatalogueEntry["manifest"];

  return {
    id: record.id,
    version: TEMPLATE_VERSION,
    name: record.name,
    category: record.category,
    tier: record.tier,
    status: record.status,
    manifest,
  };
}

/**
 * Makes a template's row exist, if the id names a known design.
 *
 * Returns false for an unknown id so the caller can reject it rather than
 * provision an invitation against a design that cannot be rendered. Retired
 * designs are still resolvable by id — an existing invitation must keep working —
 * but `PrismaInvitationProvisioningRepository` only binds ACTIVE templates.
 */
export async function ensureTemplatePersisted(
  templateId: string,
): Promise<boolean> {
  const record = getTemplate(templateId);
  if (record === undefined) return false;

  await new PrismaTemplateCatalogueRepository().sync(catalogueEntry(record));
  return true;
}

/** Persists every active design, for operations that need the whole catalogue. */
export async function ensureActiveTemplatesPersisted(): Promise<number> {
  const repository = new PrismaTemplateCatalogueRepository();
  const records = getActiveTemplates();

  for (const record of records) {
    await repository.sync(catalogueEntry(record));
  }
  return records.length;
}

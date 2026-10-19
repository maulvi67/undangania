import {
  PrismaMediaAssetRepository,
  PrismaPublicationReaderRepository,
  type MediaAssetRepository,
  type PublicPublication,
} from "@wedding/database";
import { createStoragePortFromEnv, type StoragePort } from "@wedding/storage";
import { readPublicPublication } from "./publication-cache";
import {
  invitationViewModelSchema,
  type InvitationViewModel,
} from "@wedding/template-engine";

/**
 * Public invitation lookup.
 *
 * The public page is unauthenticated, so the URL is the only thing that scopes
 * the request. The repository returns an active publication or nothing; this
 * module turns that row into something renderable, or `null` so the page shows a
 * 404 rather than distinguishing "no such slug" from "not published yet".
 *
 * A snapshot that fails the current view-model contract is treated as absent
 * rather than rendered best-effort: a half-rendered public page would be worse
 * than a clean not-found, and it would silently publish content the contract
 * cannot describe.
 */

export type ResolvedPublicMedia = Readonly<{
  assetId: string;
  url: string;
  mimeType: string;
  altText: string | null;
}>;

export type PublicInvitationPage =
  | Readonly<{
      kind: "published";
      slug: string;
      templateId: string;
      templateVersion: string;
      contractVersion: number;
      model: unknown;
      media: readonly ResolvedPublicMedia[];
    }>
  | Readonly<{ kind: "paused" }>
  | Readonly<{ kind: "expired" }>
  | Readonly<{ kind: "missing" }>;

export async function resolvePublicInvitation(input: {
  slug: string;
}): Promise<PublicInvitationPage> {
  const publication = await findActivePublication(input.slug);
  if (publication !== null) {
    if (publication.invitationStatus === "PAUSED") return { kind: "paused" };
    if (
      publication.invitationStatus === "EXPIRED" ||
      publication.invitationStatus === "ARCHIVED"
    ) {
      return { kind: "expired" };
    }

    const parsed = invitationViewModelSchema.safeParse(publication.snapshot);
    if (!parsed.success) return { kind: "missing" };

    const media = await resolvePublishedMedia(publication, parsed.data);

    return {
      kind: "published",
      slug: publication.slug,
      templateId: publication.templateId,
      templateVersion: publication.templateVersion,
      contractVersion: publication.contractVersion,
      model: parsed.data,
      media,
    };
  }

  return { kind: "missing" };
}

export type PublicMediaPorts = Readonly<{
  media: Pick<MediaAssetRepository, "findReadyByIds">;
  storage: Pick<StoragePort, "createReadUrl">;
}>;

export async function resolvePublicMedia(
  publication: PublicPublication,
  model: InvitationViewModel,
  ports: PublicMediaPorts,
): Promise<readonly ResolvedPublicMedia[]> {
  const ids = model.sections.flatMap(
    (section) => section.payload.assetIds ?? [],
  );
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return [];

  try {
    const readyAssets = await ports.media.findReadyByIds(
      { tenantId: publication.tenantId, weddingId: publication.weddingId },
      uniqueIds,
    );
    const altTextByAssetId = new Map<string, string | null>();
    for (const section of model.sections) {
      const sectionAltTexts = section.payload.assetAltTexts;
      if (typeof sectionAltTexts !== "object" || sectionAltTexts === null) {
        continue;
      }
      for (const [assetId, value] of Object.entries(sectionAltTexts)) {
        if (typeof value === "string" || value === null) {
          altTextByAssetId.set(assetId, value);
        }
      }
    }

    const readyById = new Map(readyAssets.map((asset) => [asset.id, asset]));
    const resolved: ResolvedPublicMedia[] = [];
    for (const assetId of uniqueIds) {
      const asset = readyById.get(assetId);
      if (asset === undefined) continue;
      try {
        const url = await ports.storage.createReadUrl(asset.objectKey, 5 * 60);
        resolved.push({
          assetId: asset.id,
          url,
          mimeType: asset.mimeType,
          altText: altTextByAssetId.has(asset.id)
            ? (altTextByAssetId.get(asset.id) ?? null)
            : asset.altText,
        });
      } catch {
        // One unavailable object must not break the entire public invitation.
      }
    }
    return resolved;
  } catch {
    return [];
  }
}

async function resolvePublishedMedia(
  publication: PublicPublication,
  model: InvitationViewModel,
): Promise<readonly ResolvedPublicMedia[]> {
  const storage = createStoragePortFromEnv(process.env);
  if (storage === null) return [];
  return resolvePublicMedia(publication, model, {
    media: new PrismaMediaAssetRepository(),
    storage,
  });
}

async function findActivePublication(
  slug: string,
): Promise<PublicPublication | null> {
  try {
    return await readPublicPublication({
      slug,
      load: () =>
        new PrismaPublicationReaderRepository().findActiveBySlug(slug),
    });
  } catch {
    // A database outage must not surface as a 500 on a public page; the caller
    // renders the same not-found it would for an unpublished slug.
    return null;
  }
}

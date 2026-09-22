import { randomUUID } from "node:crypto";
import type { TenantContext } from "@wedding/domain";
import {
  ConflictError,
  InvalidInputError,
  NotFoundError,
  ProviderUnavailableError,
  assertAnyRole,
  EDITOR_ROLES,
  requireTenantContext,
} from "./use-case-support";

export const MEDIA_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const MEDIA_AUDIO_MAX_BYTES = 20 * 1024 * 1024;

export const MEDIA_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const MEDIA_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
] as const;

export type MediaType = "IMAGE" | "AUDIO";
export type MediaState =
  | "PENDING_UPLOAD"
  | "UPLOADED"
  | "SCANNING"
  | "PROCESSING"
  | "READY"
  | "REJECTED"
  | "DELETED";

export type MediaAsset = Readonly<{
  id: string;
  tenantId: string;
  weddingId: string;
  objectKey: string;
  mediaType: string;
  state: MediaState;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type MediaScope = Readonly<{
  tenantId: string;
  weddingId: string;
  actorId: string;
  actorType?: "USER" | "SYSTEM";
}>;

export type MediaReadScope = Readonly<{
  tenantId: string;
  weddingId: string;
}>;

export type MediaAssetMutation =
  | Readonly<{ kind: "ok"; asset: MediaAsset }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "invalid-state"; state: MediaState }>
  | Readonly<{ kind: "rejected"; asset: MediaAsset; reason: string }>;

export type MediaAssetRepository = Readonly<{
  createPending(
    scope: MediaScope,
    input: Readonly<{
      objectKey: string;
      mediaType: string;
      mimeType: string;
      sizeBytes: number;
      checksum?: string;
      width?: number | null;
      height?: number | null;
      altText?: string | null;
    }>,
    correlationId: string,
  ): Promise<MediaAsset>;
  completeUpload(
    scope: MediaScope,
    input: Readonly<{
      id: string;
      contentLength: number;
      contentType: string;
      checksum: string;
    }>,
    correlationId: string,
  ): Promise<MediaAssetMutation>;
  markScanning(
    scope: MediaScope,
    id: string,
    correlationId: string,
  ): Promise<MediaAssetMutation>;
  markProcessing(
    scope: MediaScope,
    id: string,
    dimensions: Readonly<{ width: number | null; height: number | null }>,
    correlationId: string,
  ): Promise<MediaAssetMutation>;
  markReady(
    scope: MediaScope,
    id: string,
    correlationId: string,
  ): Promise<MediaAssetMutation>;
  reject(
    scope: MediaScope,
    id: string,
    reason: string,
    correlationId: string,
  ): Promise<MediaAssetMutation>;
  softDelete(
    scope: MediaScope,
    id: string,
    correlationId: string,
  ): Promise<MediaAssetMutation>;
  findById(scope: MediaReadScope, id: string): Promise<MediaAsset | null>;
  listForWedding(scope: MediaReadScope): Promise<readonly MediaAsset[]>;
}>;

export type MediaStoragePort = Readonly<{
  createUpload(input: {
    tenantId: string;
    objectKey: string;
    contentType: string;
    maxBytes: number;
    contentLength?: number;
  }): Promise<{ url: string; expiresAt: string }>;
  headObject(objectKey: string): Promise<
    Readonly<{
      contentLength: number | null;
      contentType: string | null;
      etag: string | null;
    }>
  >;
  delete(objectKey: string): Promise<void>;
}>;

export type MediaPorts = Readonly<{
  media: MediaAssetRepository;
  storage: MediaStoragePort;
}>;

export type BeginMediaUploadInput = Readonly<{
  filename: string;
  mediaType: MediaType;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  altText?: string | null;
}>;

export type BeginMediaUploadResult = Readonly<{
  asset: MediaAsset;
  uploadUrl: string;
  expiresAt: string;
}>;

export type CompleteMediaUploadResult = Readonly<{
  asset: MediaAsset;
  state: MediaState;
}>;

export type RemoveMediaAssetResult = Readonly<{
  asset: MediaAsset;
}>;

const extensionByMimeType: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

function acceptedMediaType(mimeType: string): MediaType | null {
  if ((MEDIA_IMAGE_TYPES as readonly string[]).includes(mimeType))
    return "IMAGE";
  if ((MEDIA_AUDIO_TYPES as readonly string[]).includes(mimeType))
    return "AUDIO";
  return null;
}

function maxBytesFor(mediaType: MediaType): number {
  return mediaType === "IMAGE" ? MEDIA_IMAGE_MAX_BYTES : MEDIA_AUDIO_MAX_BYTES;
}

function requireText(
  value: string,
  message: string,
  maxLength: number,
): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new InvalidInputError(message);
  }
  return normalized;
}

function validateBeginInput(
  input: BeginMediaUploadInput,
): BeginMediaUploadInput {
  const filename = requireText(input.filename, "Nama file tidak valid.", 255);
  const mimeType = requireText(
    input.mimeType.toLowerCase(),
    "Format file tidak valid.",
    100,
  );
  const mediaType = acceptedMediaType(mimeType);
  if (mediaType === null || mediaType !== input.mediaType) {
    throw new InvalidInputError("Format file ini belum didukung.");
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new InvalidInputError("Ukuran file tidak valid.");
  }
  if (input.sizeBytes > maxBytesFor(mediaType)) {
    throw new InvalidInputError(
      mediaType === "IMAGE"
        ? "Ukuran gambar maksimal 10 MB."
        : "Ukuran audio maksimal 20 MB.",
    );
  }
  if (
    input.checksum !== undefined &&
    (input.checksum.trim().length === 0 || input.checksum.trim().length > 200)
  ) {
    throw new InvalidInputError("Checksum file tidak valid.");
  }
  if (
    input.altText !== undefined &&
    input.altText !== null &&
    input.altText.length > 300
  ) {
    throw new InvalidInputError("Teks alternatif terlalu panjang.");
  }

  return {
    filename,
    mediaType,
    mimeType,
    sizeBytes: input.sizeBytes,
    ...(input.checksum === undefined || input.checksum.trim() === ""
      ? {}
      : { checksum: input.checksum.trim() }),
    ...(input.altText === undefined
      ? {}
      : {
          altText: input.altText === null ? null : input.altText.trim() || null,
        }),
  };
}

function correlationId(): string {
  return randomUUID();
}

function scopeFor(context: TenantContext, weddingId: string): MediaScope {
  return { tenantId: context.tenantId, weddingId, actorId: context.actorId };
}

function assertAssetId(assetId: string): string {
  const normalized = assetId.trim();
  if (normalized.length === 0 || normalized.length > 200) {
    throw new InvalidInputError("Media tidak dikenali.");
  }
  return normalized;
}

function mapMutation(mutation: MediaAssetMutation): MediaAsset {
  if (mutation.kind === "ok") return mutation.asset;
  if (mutation.kind === "not-found") {
    throw new NotFoundError("Media tidak ditemukan.");
  }
  if (mutation.kind === "invalid-state") {
    throw new ConflictError("Media sudah berubah dan perlu dimuat ulang.");
  }
  throw new InvalidInputError(mutation.reason);
}

/** Starts a private, tenant-scoped direct-to-object-storage upload. */
export async function beginMediaUpload(
  context: TenantContext | null | undefined,
  weddingId: string,
  input: BeginMediaUploadInput,
  ports: MediaPorts,
): Promise<BeginMediaUploadResult> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, EDITOR_ROLES);
  const wedding = requireText(weddingId, "Workspace tidak dikenali.", 200);
  const validated = validateBeginInput(input);
  const extension = extensionByMimeType[validated.mimeType];
  if (extension === undefined) {
    throw new InvalidInputError("Format file ini belum didukung.");
  }

  const objectKey = `${tenant.tenantId}/${wedding}/media/${randomUUID()}.${extension}`;
  const scope = scopeFor(tenant, wedding);
  const id = correlationId();
  const asset = await ports.media.createPending(
    scope,
    {
      objectKey,
      mediaType: validated.mediaType,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
      ...(validated.checksum === undefined
        ? {}
        : { checksum: validated.checksum }),
      ...(validated.altText === undefined
        ? {}
        : { altText: validated.altText }),
    },
    id,
  );

  try {
    const upload = await ports.storage.createUpload({
      tenantId: tenant.tenantId,
      objectKey: asset.objectKey,
      contentType: validated.mimeType,
      maxBytes: maxBytesFor(validated.mediaType),
      contentLength: validated.sizeBytes,
    });
    return { asset, uploadUrl: upload.url, expiresAt: upload.expiresAt };
  } catch {
    // A pending row without a URL should not remain usable. The cleanup is best
    // effort because the provider failure is the actionable error for the caller.
    try {
      await ports.media.softDelete(scope, asset.id, correlationId());
    } catch {
      // The orphan sweeper can reconcile a pending row later.
    }
    throw new ProviderUnavailableError(
      "Penyimpanan media tidak tersedia. Silakan coba lagi.",
    );
  }
}

/** Verifies provider-observed metadata before making an asset publicly usable. */
export async function completeMediaUpload(
  context: TenantContext | null | undefined,
  weddingId: string,
  assetId: string,
  ports: MediaPorts,
): Promise<CompleteMediaUploadResult> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, EDITOR_ROLES);
  const wedding = requireText(weddingId, "Workspace tidak dikenali.", 200);
  const id = assertAssetId(assetId);
  const scope = scopeFor(tenant, wedding);
  const asset = await ports.media.findById(scope, id);
  if (asset === null) throw new NotFoundError("Media tidak ditemukan.");
  if (asset.state !== "PENDING_UPLOAD") {
    throw new ConflictError(
      "Media sudah diproses atau tidak lagi dapat diunggah.",
    );
  }

  let observed: Awaited<ReturnType<MediaStoragePort["headObject"]>>;
  try {
    observed = await ports.storage.headObject(asset.objectKey);
  } catch {
    throw new ProviderUnavailableError(
      "Unggahan belum dapat diperiksa. Silakan coba lagi.",
    );
  }

  if (observed.contentLength === null || observed.contentType === null) {
    const rejected = await ports.media.reject(
      scope,
      asset.id,
      "Metadata objek media tidak lengkap.",
      correlationId(),
    );
    if (rejected.kind === "ok") {
      throw new InvalidInputError("Media tidak dapat diverifikasi.");
    }
    throw new InvalidInputError("Media tidak dapat diverifikasi.");
  }

  const completed = await ports.media.completeUpload(
    scope,
    {
      id: asset.id,
      contentLength: observed.contentLength,
      contentType: observed.contentType,
      checksum: observed.etag ?? asset.checksum,
    },
    correlationId(),
  );
  if (completed.kind === "rejected") {
    throw new InvalidInputError(completed.reason);
  }
  const uploaded = mapMutation(completed);
  return { asset: uploaded, state: uploaded.state };
}

/** Removes an asset from the invitation and then deletes its private object. */
export async function removeMediaAsset(
  context: TenantContext | null | undefined,
  weddingId: string,
  assetId: string,
  ports: MediaPorts,
): Promise<RemoveMediaAssetResult> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, EDITOR_ROLES);
  const wedding = requireText(weddingId, "Workspace tidak dikenali.", 200);
  const id = assertAssetId(assetId);
  const scope = scopeFor(tenant, wedding);
  const existing = await ports.media.findById(scope, id);
  if (existing === null) throw new NotFoundError("Media tidak ditemukan.");

  // R2 deletion is idempotent. If a previous attempt already revoked the row
  // but failed while deleting the object, a retry must still be able to finish
  // provider cleanup instead of being blocked by the terminal DB state.
  if (existing.state === "DELETED") {
    try {
      await ports.storage.delete(existing.objectKey);
    } catch {
      throw new ProviderUnavailableError(
        "Media sudah dihapus dari undangan, tetapi penyimpanan belum dapat dibersihkan.",
      );
    }
    return { asset: existing };
  }

  const deleted = mapMutation(
    await ports.media.softDelete(scope, existing.id, correlationId()),
  );
  try {
    await ports.storage.delete(existing.objectKey);
  } catch {
    throw new ProviderUnavailableError(
      "Media dihapus dari undangan, tetapi penyimpanan belum dapat dibersihkan.",
    );
  }
  return { asset: deleted };
}

export async function listMediaAssets(
  context: TenantContext | null | undefined,
  weddingId: string,
  ports: Pick<MediaPorts, "media">,
): Promise<readonly MediaAsset[]> {
  const tenant = requireTenantContext(context);
  assertAnyRole(tenant, EDITOR_ROLES);
  const wedding = requireText(weddingId, "Workspace tidak dikenali.", 200);
  return ports.media.listForWedding({
    tenantId: tenant.tenantId,
    weddingId: wedding,
  });
}

import {
  beginMediaUpload,
  completeMediaUpload,
  ConflictError,
  InvalidInputError,
  listMediaAssets,
  NotFoundError,
  ProviderUnavailableError,
  removeMediaAsset,
  type BeginMediaUploadInput,
} from "@wedding/application";
import {
  getMediaPorts,
  mediaBeginPorts,
  mediaCompletePorts,
  mediaRemovePorts,
} from "./container";
import type { MediaActionOutcome, MediaListOutcome } from "./outcomes";
import { resolveSessionWorkspaceOrNull } from "../workspace/session-workspace";

function providerUnavailable(message: string): MediaActionOutcome {
  return { kind: "provider-unavailable", message };
}

function storageConfigured(): boolean {
  return getMediaPorts().storage !== null;
}

export async function beginMediaUploadForSession(
  input: BeginMediaUploadInput,
): Promise<MediaActionOutcome> {
  const workspace = await resolveSessionWorkspaceOrNull();
  if (workspace === null) return { kind: "forbidden" };
  if (!storageConfigured()) {
    return providerUnavailable(
      "Penyimpanan media belum tersedia. Silakan coba lagi nanti.",
    );
  }

  try {
    const result = await beginMediaUpload(
      workspace.context,
      workspace.weddingId,
      input,
      mediaBeginPorts(),
    );
    return {
      kind: "ok",
      assetId: result.asset.id,
      state: result.asset.state,
      uploadUrl: result.uploadUrl,
      expiresAt: result.expiresAt,
    };
  } catch (error) {
    if (error instanceof InvalidInputError)
      return { kind: "invalid", message: error.message };
    if (error instanceof ProviderUnavailableError)
      return providerUnavailable(error.message);
    return providerUnavailable(
      "Unggahan media tidak dapat dimulai. Silakan coba lagi.",
    );
  }
}

export async function completeMediaUploadForSession(
  assetId: string,
): Promise<MediaActionOutcome> {
  const workspace = await resolveSessionWorkspaceOrNull();
  if (workspace === null) return { kind: "forbidden" };
  if (!storageConfigured()) {
    return providerUnavailable(
      "Penyimpanan media belum tersedia. Silakan coba lagi nanti.",
    );
  }

  try {
    const result = await completeMediaUpload(
      workspace.context,
      workspace.weddingId,
      assetId,
      mediaCompletePorts(),
    );
    return { kind: "ok", assetId: result.asset.id, state: result.state };
  } catch (error) {
    if (error instanceof ConflictError)
      return { kind: "invalid", message: error.message };
    if (error instanceof InvalidInputError)
      return { kind: "rejected", message: error.message };
    if (error instanceof NotFoundError) return { kind: "not-found" };
    if (error instanceof ProviderUnavailableError)
      return providerUnavailable(error.message);
    return providerUnavailable(
      "Unggahan media belum dapat diverifikasi. Silakan coba lagi.",
    );
  }
}

export async function removeMediaAssetForSession(
  assetId: string,
): Promise<MediaActionOutcome> {
  const workspace = await resolveSessionWorkspaceOrNull();
  if (workspace === null) return { kind: "forbidden" };
  if (!storageConfigured()) {
    return providerUnavailable(
      "Penyimpanan media belum tersedia. Silakan coba lagi nanti.",
    );
  }

  try {
    const result = await removeMediaAsset(
      workspace.context,
      workspace.weddingId,
      assetId,
      mediaRemovePorts(),
    );
    return { kind: "ok", assetId: result.asset.id, state: result.asset.state };
  } catch (error) {
    if (error instanceof InvalidInputError)
      return { kind: "invalid", message: error.message };
    if (error instanceof NotFoundError) return { kind: "not-found" };
    if (error instanceof ProviderUnavailableError)
      return providerUnavailable(error.message);
    return providerUnavailable(
      "Media tidak dapat dihapus sepenuhnya. Silakan coba lagi.",
    );
  }
}

export async function listMediaAssetsForSession(): Promise<MediaListOutcome> {
  const workspace = await resolveSessionWorkspaceOrNull();
  if (workspace === null) return { kind: "forbidden" };

  try {
    const assets = await listMediaAssets(
      workspace.context,
      workspace.weddingId,
      { media: getMediaPorts().media },
    );
    return {
      kind: "ok",
      assets: assets.map((asset) => ({
        id: asset.id,
        filename: asset.objectKey.split("/").at(-1) ?? "Media",
        mediaType: asset.mediaType === "AUDIO" ? "AUDIO" : "IMAGE",
        mimeType: asset.mimeType,
        state: asset.state,
        sizeBytes: asset.sizeBytes,
        width: asset.width,
        height: asset.height,
        altText: asset.altText,
        rejectionReason: asset.rejectionReason,
      })),
    };
  } catch {
    return { kind: "unavailable" };
  }
}

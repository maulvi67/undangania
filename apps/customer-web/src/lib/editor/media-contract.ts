import {
  editorMediaAssetSchema,
  type EditorMediaAsset,
  type EditorMediaState,
} from "./contract";

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const AUDIO_MAX_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
] as const;

export type UploadFileLike = {
  name: string;
  type: string;
  size: number;
};

export type UploadPreflight =
  { ok: true; mediaType: "IMAGE" | "AUDIO" } | { ok: false; reason: string };

export function preflightUpload(file: UploadFileLike): UploadPreflight {
  const isImage = (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(
    file.type,
  );
  const isAudio = (ACCEPTED_AUDIO_TYPES as readonly string[]).includes(
    file.type,
  );
  if (!isImage && !isAudio) {
    return { ok: false, reason: "Format file ini belum didukung." };
  }
  const limit = isImage ? IMAGE_MAX_BYTES : AUDIO_MAX_BYTES;
  if (file.size <= 0 || file.size > limit) {
    return {
      ok: false,
      reason: isImage
        ? "Ukuran gambar maksimal 10 MB."
        : "Ukuran audio maksimal 20 MB.",
    };
  }
  return { ok: true, mediaType: isImage ? "IMAGE" : "AUDIO" };
}

export function nextMediaState(
  state: EditorMediaState,
  event: "uploaded" | "scan" | "process" | "ready" | "reject" | "delete",
): EditorMediaState {
  if (
    event === "uploaded" &&
    (state === "PENDING_UPLOAD" || state === "UPLOADED")
  )
    return "UPLOADED";
  if (event === "scan" && state === "UPLOADED") return "SCANNING";
  if (event === "process" && state === "SCANNING") return "PROCESSING";
  if (event === "ready" && (state === "PROCESSING" || state === "UPLOADED"))
    return "READY";
  if (
    event === "reject" &&
    ["UPLOADED", "SCANNING", "PROCESSING"].includes(state)
  )
    return "REJECTED";
  if (event === "delete" && state !== "DELETED") return "DELETED";
  return state;
}

export function validateMediaAsset(input: unknown): EditorMediaAsset {
  return editorMediaAssetSchema.parse(input);
}

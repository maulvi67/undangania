"use server";

import { z } from "zod";
import {
  beginMediaUploadForSession,
  completeMediaUploadForSession,
  listMediaAssetsForSession,
  removeMediaAssetForSession,
} from "./server";
import type { MediaActionOutcome, MediaListOutcome } from "./outcomes";

const beginMediaUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mediaType: z.enum(["IMAGE", "AUDIO"]),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(20 * 1024 * 1024),
  checksum: z.string().trim().max(200).optional(),
  altText: z.string().max(300).nullable().optional(),
});

const assetIdSchema = z.object({
  assetId: z.string().trim().min(1).max(200),
});

export async function beginMediaUploadAction(
  input: unknown,
): Promise<MediaActionOutcome> {
  const parsed = beginMediaUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "invalid", message: "Rincian file tidak valid." };
  }
  return beginMediaUploadForSession({
    filename: parsed.data.filename,
    mediaType: parsed.data.mediaType,
    mimeType: parsed.data.mimeType,
    sizeBytes: parsed.data.sizeBytes,
    ...(parsed.data.checksum === undefined
      ? {}
      : { checksum: parsed.data.checksum }),
    ...(parsed.data.altText === undefined
      ? {}
      : { altText: parsed.data.altText }),
  });
}

export async function completeMediaUploadAction(
  input: unknown,
): Promise<MediaActionOutcome> {
  const parsed = assetIdSchema.safeParse(input);
  if (!parsed.success)
    return { kind: "invalid", message: "Media tidak dikenali." };
  return completeMediaUploadForSession(parsed.data.assetId);
}

export async function removeMediaAssetAction(
  input: unknown,
): Promise<MediaActionOutcome> {
  const parsed = assetIdSchema.safeParse(input);
  if (!parsed.success)
    return { kind: "invalid", message: "Media tidak dikenali." };
  return removeMediaAssetForSession(parsed.data.assetId);
}

export async function listMediaAssetsAction(): Promise<MediaListOutcome> {
  return listMediaAssetsForSession();
}

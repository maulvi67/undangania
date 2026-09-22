import {
  PrismaMediaAssetRepository,
  type MediaAssetRepository,
} from "@wedding/database";
import {
  beginMediaUpload,
  completeMediaUpload,
  listMediaAssets,
  removeMediaAsset,
  type MediaPorts,
  type MediaStoragePort,
} from "@wedding/application";
import { createStoragePortFromEnv } from "@wedding/storage";

export type CustomerMediaPorts = Readonly<{
  media: MediaAssetRepository;
  storage: MediaStoragePort | null;
}>;

export function getMediaPorts(): CustomerMediaPorts {
  return {
    media: new PrismaMediaAssetRepository(),
    storage: createStoragePortFromEnv(process.env),
  };
}

function requireStorage(ports: CustomerMediaPorts): MediaPorts {
  if (ports.storage === null) {
    throw new Error("Media storage is not configured");
  }
  return { media: ports.media, storage: ports.storage };
}

export function mediaBeginPorts(
  ports: CustomerMediaPorts = getMediaPorts(),
): MediaPorts {
  return requireStorage(ports);
}

export function mediaCompletePorts(
  ports: CustomerMediaPorts = getMediaPorts(),
): MediaPorts {
  return requireStorage(ports);
}

export function mediaRemovePorts(
  ports: CustomerMediaPorts = getMediaPorts(),
): MediaPorts {
  return requireStorage(ports);
}

export function mediaListPort(
  ports: CustomerMediaPorts = getMediaPorts(),
): Pick<MediaPorts, "media"> {
  return { media: ports.media };
}

export {
  beginMediaUpload,
  completeMediaUpload,
  listMediaAssets,
  removeMediaAsset,
};

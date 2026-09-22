import { ConflictError, InvalidInputError } from "./use-case-support";
import type {
  MediaAsset,
  MediaAssetMutation,
  MediaAssetRepository,
  MediaReadScope,
  MediaScope,
} from "./media";

export const MEDIA_REJECTION_CODES = {
  unsupportedSignature: "UNSUPPORTED_SIGNATURE",
  invalidDimensions: "INVALID_DIMENSIONS",
  malwareDetected: "MALWARE_DETECTED",
  derivativeFailed: "DERIVATIVE_FAILED",
} as const;

export type MediaRejectionCode =
  (typeof MEDIA_REJECTION_CODES)[keyof typeof MEDIA_REJECTION_CODES];

export type MediaProcessingJob = Readonly<{
  idempotencyKey: string;
  assetId: string;
  tenantId: string;
  weddingId: string;
}>;

export type MediaInspection = Readonly<{
  /** The first bytes of the private object, never persisted or logged. */
  prefix: Uint8Array;
  width: number | null;
  height: number | null;
}>;

export type MediaObjectPrefixReader = Readonly<{
  readPrefix(
    input: Readonly<{
      tenantId: string;
      objectKey: string;
      maxBytes: number;
    }>,
  ): Promise<Uint8Array>;
}>;

export type MediaContentInspector = Readonly<{
  inspect(
    input: Readonly<{
      tenantId: string;
      objectKey: string;
      mediaType: string;
      mimeType: string;
      sizeBytes: number;
    }>,
  ): Promise<MediaInspection>;
}>;

export const MEDIA_INSPECTION_MAX_PREFIX_BYTES = 64 * 1024;

function readUint16BE(prefix: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > prefix.length) return null;
  return (prefix[offset] ?? 0) * 256 + (prefix[offset + 1] ?? 0);
}

function readUint24LE(prefix: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 3 > prefix.length) return null;
  return (
    (prefix[offset] ?? 0) +
    ((prefix[offset + 1] ?? 0) << 8) +
    ((prefix[offset + 2] ?? 0) << 16)
  );
}

function readUint32BE(prefix: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > prefix.length) return null;
  const value =
    ((prefix[offset] ?? 0) << 24) |
    ((prefix[offset + 1] ?? 0) << 16) |
    ((prefix[offset + 2] ?? 0) << 8) |
    (prefix[offset + 3] ?? 0);
  return value >>> 0;
}

function readUint16LE(prefix: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > prefix.length) return null;
  return (prefix[offset] ?? 0) + ((prefix[offset + 1] ?? 0) << 8);
}

function validDimensionPair(
  width: number | null,
  height: number | null,
): Readonly<{ width: number; height: number }> | null {
  if (
    width === null ||
    height === null ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return { width, height };
}

function jpegDimensions(
  prefix: Uint8Array,
): Readonly<{ width: number; height: number }> | null {
  if (!sameBytes(prefix, [0xff, 0xd8, 0xff])) return null;

  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);
  let offset = 2;
  while (offset + 3 <= prefix.length) {
    if (prefix[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < prefix.length && prefix[offset] === 0xff) offset += 1;
    if (offset >= prefix.length) return null;
    const marker = prefix[offset] ?? 0;
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker >= 0xd0 && marker <= 0xd8) continue;

    const segmentLength = readUint16BE(prefix, offset);
    if (segmentLength === null || segmentLength < 2) return null;
    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7 || offset + segmentLength > prefix.length) {
        return null;
      }
      return validDimensionPair(
        readUint16BE(prefix, offset + 5),
        readUint16BE(prefix, offset + 3),
      );
    }
    offset += segmentLength;
  }
  return null;
}

function pngDimensions(
  prefix: Uint8Array,
): Readonly<{ width: number; height: number }> | null {
  if (!sameBytes(prefix, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return null;
  }
  return validDimensionPair(readUint32BE(prefix, 16), readUint32BE(prefix, 20));
}

function webpDimensions(
  prefix: Uint8Array,
): Readonly<{ width: number; height: number }> | null {
  if (
    !sameBytes(prefix, [0x52, 0x49, 0x46, 0x46]) ||
    ascii(prefix, 8, 4) !== "WEBP"
  ) {
    return null;
  }

  const chunk = ascii(prefix, 12, 4);
  if (chunk === "VP8X" && prefix.length >= 30) {
    return validDimensionPair(
      (readUint24LE(prefix, 24) ?? 0) + 1,
      (readUint24LE(prefix, 27) ?? 0) + 1,
    );
  }
  if (chunk === "VP8L" && prefix.length >= 25 && prefix[20] === 0x2f) {
    const byte21 = prefix[21] ?? 0;
    const byte22 = prefix[22] ?? 0;
    const byte23 = prefix[23] ?? 0;
    const byte24 = prefix[24] ?? 0;
    return validDimensionPair(
      1 + (byte21 | ((byte22 & 0x3f) << 8)),
      1 + ((byte22 >> 6) | (byte23 << 2) | ((byte24 & 0x0f) << 10)),
    );
  }
  if (
    chunk === "VP8 " &&
    prefix.length >= 30 &&
    prefix[23] === 0x9d &&
    prefix[24] === 0x01 &&
    prefix[25] === 0x2a
  ) {
    return validDimensionPair(
      readUint16LE(prefix, 26),
      readUint16LE(prefix, 28),
    );
  }
  return null;
}

function dimensionsForSignature(
  mediaType: string,
  signature: string | null,
  prefix: Uint8Array,
): Readonly<{ width: number | null; height: number | null }> {
  if (mediaType === "AUDIO") return { width: null, height: null };
  const dimensions =
    signature === "JPEG"
      ? jpegDimensions(prefix)
      : signature === "PNG"
        ? pngDimensions(prefix)
        : signature === "WEBP"
          ? webpDimensions(prefix)
          : null;
  return dimensions ?? { width: null, height: null };
}

export function createMediaContentInspector(
  reader: MediaObjectPrefixReader,
): MediaContentInspector {
  return {
    async inspect(input) {
      if (
        input.tenantId.trim().length === 0 ||
        input.objectKey.trim().length === 0 ||
        !Number.isSafeInteger(input.sizeBytes) ||
        input.sizeBytes <= 0
      ) {
        throw new InvalidInputError("Media inspection input is invalid.");
      }
      const prefix = await reader.readPrefix({
        tenantId: input.tenantId,
        objectKey: input.objectKey,
        maxBytes: MEDIA_INSPECTION_MAX_PREFIX_BYTES,
      });
      if (
        !(prefix instanceof Uint8Array) ||
        prefix.byteLength === 0 ||
        prefix.byteLength > MEDIA_INSPECTION_MAX_PREFIX_BYTES
      ) {
        throw new Error("Media inspection prefix is invalid.");
      }
      const signature = detectMediaSignature(input.mimeType, prefix);
      const dimensions = dimensionsForSignature(
        input.mediaType,
        signature,
        prefix,
      );
      return { prefix, ...dimensions };
    },
  };
}

export type MediaMalwareScanner = Readonly<{
  scan(
    input: Readonly<{
      objectKey: string;
      checksum: string;
      idempotencyKey: string;
    }>,
  ): Promise<Readonly<{ verdict: "clean" | "malware" }>>;
}>;

export type MediaDerivativeProcessor = Readonly<{
  generate(
    input: Readonly<{
      asset: MediaAsset;
      idempotencyKey: string;
    }>,
  ): Promise<void>;
}>;

export type MediaProcessingPorts = Readonly<{
  media: MediaAssetRepository;
  inspector: MediaContentInspector;
  scanner: MediaMalwareScanner;
  derivatives: MediaDerivativeProcessor;
}>;

export type MediaProcessingResult = Readonly<{
  kind: "ready" | "rejected" | "skipped";
  asset: MediaAsset;
  rejectionCode?: MediaRejectionCode;
}>;

export class MediaProcessingRetryableError extends Error {
  public constructor(message = "Media processing can be retried") {
    super(message);
    this.name = "MediaProcessingRetryableError";
  }
}

function sameBytes(
  prefix: Uint8Array,
  expected: readonly number[],
  offset = 0,
): boolean {
  return expected.every((byte, index) => prefix[offset + index] === byte);
}

function ascii(prefix: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...prefix.slice(offset, offset + length));
}

export function detectMediaSignature(
  mimeType: string,
  prefix: Uint8Array,
): string | null {
  if (mimeType === "image/jpeg" && sameBytes(prefix, [0xff, 0xd8, 0xff])) {
    return "JPEG";
  }
  if (
    mimeType === "image/png" &&
    sameBytes(prefix, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "PNG";
  }
  if (
    mimeType === "image/webp" &&
    sameBytes(prefix, [0x52, 0x49, 0x46, 0x46]) &&
    ascii(prefix, 8, 4) === "WEBP"
  ) {
    return "WEBP";
  }
  if (
    mimeType === "audio/mpeg" &&
    (sameBytes(prefix, [0x49, 0x44, 0x33]) ||
      (prefix.length >= 2 && prefix[0] === 0xff && (prefix[1] ?? 0) >= 0xe0))
  ) {
    return "MP3";
  }
  if (mimeType === "audio/ogg" && ascii(prefix, 0, 4) === "OggS") {
    return "OGG";
  }
  if (
    mimeType === "audio/wav" &&
    ascii(prefix, 0, 4) === "RIFF" &&
    ascii(prefix, 8, 4) === "WAVE"
  ) {
    return "WAV";
  }
  return null;
}

function validateDimensions(
  mediaType: string,
  width: number | null,
  height: number | null,
): boolean {
  if (mediaType === "AUDIO") return width === null && height === null;
  return (
    width !== null &&
    height !== null &&
    Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= 20_000 &&
    height <= 20_000
  );
}

function scopeFor(job: MediaProcessingJob): MediaScope {
  return {
    tenantId: job.tenantId,
    weddingId: job.weddingId,
    actorId: "background-worker",
    actorType: "SYSTEM",
  };
}

function readScopeFor(job: MediaProcessingJob): MediaReadScope {
  return { tenantId: job.tenantId, weddingId: job.weddingId };
}

function requireJob(job: MediaProcessingJob): MediaProcessingJob {
  if (
    job.idempotencyKey.trim().length < 16 ||
    job.idempotencyKey.trim().length > 128 ||
    job.assetId.trim().length === 0 ||
    job.tenantId.trim().length === 0 ||
    job.weddingId.trim().length === 0
  ) {
    throw new InvalidInputError("Media processing job is invalid.");
  }
  return {
    ...job,
    idempotencyKey: job.idempotencyKey.trim(),
    assetId: job.assetId.trim(),
    tenantId: job.tenantId.trim(),
    weddingId: job.weddingId.trim(),
  };
}

function mutationAsset(mutation: MediaAssetMutation): MediaAsset {
  if (mutation.kind === "ok" || mutation.kind === "rejected") {
    return mutation.asset;
  }
  if (mutation.kind === "not-found") {
    throw new ConflictError("Media asset changed before processing completed.");
  }
  throw new ConflictError("Media asset changed before processing completed.");
}

async function reject(
  ports: MediaProcessingPorts,
  scope: MediaScope,
  asset: MediaAsset,
  code: MediaRejectionCode,
): Promise<MediaProcessingResult> {
  const rejected = await ports.media.reject(
    scope,
    asset.id,
    code,
    `media-processing:${asset.id}`,
  );
  if (rejected.kind === "rejected" || rejected.kind === "ok") {
    return {
      kind: "rejected",
      asset: rejected.asset,
      rejectionCode: code,
    };
  }
  throw new ConflictError("Media asset changed before rejection was recorded.");
}

/**
 * Runs the provider-neutral media pipeline. The caller supplies the object
 * inspector, malware scanner, and derivative writer; no provider credentials or
 * raw media bytes cross the application boundary.
 */
export async function processMediaAsset(
  jobInput: MediaProcessingJob,
  ports: MediaProcessingPorts,
): Promise<MediaProcessingResult> {
  const job = requireJob(jobInput);
  const scope = scopeFor(job);
  const existing = await ports.media.findById(readScopeFor(job), job.assetId);
  if (existing === null) {
    throw new ConflictError("Media asset is not available in this workspace.");
  }
  if (existing.state === "READY" || existing.state === "REJECTED") {
    return { kind: "skipped", asset: existing };
  }
  if (existing.state === "DELETED" || existing.state === "PENDING_UPLOAD") {
    return { kind: "skipped", asset: existing };
  }

  let asset = existing;
  if (asset.state === "UPLOADED") {
    asset = mutationAsset(
      await ports.media.markScanning(
        scope,
        asset.id,
        `media-scanning:${job.idempotencyKey}`,
      ),
    );
  }

  if (asset.state === "SCANNING") {
    let inspection: MediaInspection;
    try {
      inspection = await ports.inspector.inspect({
        tenantId: asset.tenantId,
        objectKey: asset.objectKey,
        mediaType: asset.mediaType,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
      });
    } catch {
      throw new MediaProcessingRetryableError();
    }

    if (detectMediaSignature(asset.mimeType, inspection.prefix) === null) {
      return reject(
        ports,
        scope,
        asset,
        MEDIA_REJECTION_CODES.unsupportedSignature,
      );
    }
    if (
      !validateDimensions(asset.mediaType, inspection.width, inspection.height)
    ) {
      return reject(
        ports,
        scope,
        asset,
        MEDIA_REJECTION_CODES.invalidDimensions,
      );
    }

    let verdict: Readonly<{ verdict: "clean" | "malware" }>;
    try {
      verdict = await ports.scanner.scan({
        objectKey: asset.objectKey,
        checksum: asset.checksum,
        idempotencyKey: job.idempotencyKey,
      });
    } catch {
      throw new MediaProcessingRetryableError();
    }
    if (verdict.verdict === "malware") {
      return reject(ports, scope, asset, MEDIA_REJECTION_CODES.malwareDetected);
    }

    asset = mutationAsset(
      await ports.media.markProcessing(
        scope,
        asset.id,
        { width: inspection.width, height: inspection.height },
        `media-processing:${job.idempotencyKey}`,
      ),
    );
  }

  if (asset.state !== "PROCESSING") {
    throw new ConflictError(
      "Media asset is not ready for derivative processing.",
    );
  }

  try {
    await ports.derivatives.generate({
      asset,
      idempotencyKey: job.idempotencyKey,
    });
  } catch {
    throw new MediaProcessingRetryableError(
      "Media derivative processing can be retried",
    );
  }

  const ready = await ports.media.markReady(
    scope,
    asset.id,
    `media-ready:${job.idempotencyKey}`,
  );
  return { kind: "ready", asset: mutationAsset(ready) };
}

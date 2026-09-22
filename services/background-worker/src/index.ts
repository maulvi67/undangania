import {
  createMediaContentInspector,
  MediaProcessingRetryableError,
  processMediaAsset,
  type MediaObjectPrefixReader,
  type MediaProcessingJob,
  type MediaProcessingPorts,
} from "@wedding/application";

export const MEDIA_PROCESSING_JOB_TYPE = "media.process" as const;

export type Job = Readonly<{
  id: string;
  type: string;
  tenantId?: string;
  payloadVersion: number;
  idempotencyKey: string;
  payload?: unknown;
}>;

type MediaJobPayload = MediaProcessingJob;

type WorkerDependencies = Readonly<{
  media?: MediaProcessingPorts;
}>;

export type MediaProcessingAdapterDependencies = Readonly<{
  media: MediaProcessingPorts["media"];
  objectPrefixReader: MediaObjectPrefixReader;
  scanner: MediaProcessingPorts["scanner"];
  derivatives: MediaProcessingPorts["derivatives"];
}>;

/**
 * Composes the storage-backed content inspector without binding the worker to a
 * storage SDK. Scanner and derivative providers remain explicit dependencies and
 * are never activated by this helper.
 */
export function createMediaProcessingPorts(
  input: MediaProcessingAdapterDependencies,
): MediaProcessingPorts {
  return {
    media: input.media,
    inspector: createMediaContentInspector(input.objectPrefixReader),
    scanner: input.scanner,
    derivatives: input.derivatives,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mediaJobPayload(value: unknown): MediaJobPayload {
  if (
    !isRecord(value) ||
    typeof value.assetId !== "string" ||
    typeof value.tenantId !== "string" ||
    typeof value.weddingId !== "string" ||
    typeof value.idempotencyKey !== "string"
  ) {
    throw new Error("Invalid media processing payload");
  }
  return {
    assetId: value.assetId,
    tenantId: value.tenantId,
    weddingId: value.weddingId,
    idempotencyKey: value.idempotencyKey,
  };
}

function validateJob(job: Job): void {
  if (
    job.id.trim().length === 0 ||
    job.type.trim().length === 0 ||
    !Number.isSafeInteger(job.payloadVersion) ||
    job.payloadVersion < 1 ||
    job.idempotencyKey.trim().length < 16 ||
    job.idempotencyKey.trim().length > 128
  ) {
    throw new Error("Invalid worker job");
  }
}

/**
 * Dispatches durable jobs through application ports. The worker owns no Prisma
 * access and receives provider implementations through dependency injection.
 */
export async function processJob(
  job: Job,
  dependencies: WorkerDependencies = {},
): Promise<void> {
  validateJob(job);

  if (job.type !== MEDIA_PROCESSING_JOB_TYPE) {
    console.info("job.accepted", { type: job.type });
    return;
  }

  const media = dependencies.media;
  if (media === undefined) {
    throw new Error("Media processing is not configured");
  }

  const payload = mediaJobPayload(job.payload);
  if (
    job.tenantId === undefined ||
    job.tenantId !== payload.tenantId ||
    job.idempotencyKey !== payload.idempotencyKey
  ) {
    throw new Error("Invalid media processing job scope");
  }

  try {
    await processMediaAsset(payload, media);
  } catch (error) {
    if (error instanceof MediaProcessingRetryableError) throw error;
    throw error;
  }
}

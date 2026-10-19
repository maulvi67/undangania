import {
  PrismaMediaAssetRepository,
  type MediaAssetDto,
} from "@wedding/database";
import {
  ConflictError,
  MediaProcessingRetryableError,
  processMediaAsset,
  type MediaDerivativeProcessor,
  type MediaMalwareScanner,
  type MediaObjectPrefixReader,
  type MediaProcessingJob,
  type MediaProcessingPorts,
} from "@wedding/application";
import { createStoragePortFromEnv, type StoragePort } from "@wedding/storage";
import { createMediaProcessingPorts } from "./index";

/**
 * Media-processing runner.
 *
 * `completeMediaUploadAction` records `UPLOADED` and stops there: only the worker
 * pipeline may advance an asset to `READY`, and nothing drained those rows, so
 * every uploaded photo stalled at `UPLOADED` and the public gallery — which
 * resolves only `READY` assets — stayed empty. This runner closes that loop. It
 * claims the oldest in-flight assets, runs the provider-neutral pipeline through
 * application ports, and lets the compare-and-swap transitions decide which
 * worker owns each asset.
 *
 * `src/index.ts` stays free of Prisma by receiving ports through injection; this
 * file is the only place in the service that binds the Prisma-backed repository,
 * the environment-configured storage adapter, and the provider stand-ins
 * together.
 */

export const MEDIA_POLL_INTERVAL_MS = 15_000;
export const MEDIA_BATCH_SIZE = 25;

export class MediaRunnerUnavailableError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MediaRunnerUnavailableError";
  }
}

export type MediaProcessingProviders = Readonly<{
  scanner: MediaMalwareScanner;
  derivatives: MediaDerivativeProcessor;
}>;

/**
 * Provider adapters for the malware and derivative stages.
 *
 * No scanner or derivative vendor is deployed with this repository, so the
 * runner names the stand-ins it uses instead of pretending the stages ran.
 * `MEDIA_MALWARE_SCANNER` accepts `passthrough` (the default): the magic-byte
 * signature and dimension checks the pipeline already performs still run, but no
 * antivirus verdict is available. `MEDIA_DERIVATIVE_WRITER` accepts `none` (the
 * default) and generates no resized variants. Any other value fails closed, so a
 * typo cannot silently advance an unchecked asset to `READY`.
 *
 * In production the stand-ins are refused unless the deployment states the risk
 * explicitly. Without that guard a production worker with no configured provider
 * would mark every upload `READY` after signature inspection alone, which is
 * indistinguishable from a scanner that found nothing. Operators either configure
 * a real vendor or set the matching override for an approved environment.
 */
export function createMediaProvidersFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): MediaProcessingProviders {
  const isProduction =
    (env.NODE_ENV ?? "").trim().toLowerCase() === "production";

  const scanner = (env.MEDIA_MALWARE_SCANNER ?? "passthrough")
    .trim()
    .toLowerCase();
  if (scanner !== "passthrough") {
    throw new MediaRunnerUnavailableError(
      `Unsupported media malware scanner provider: ${scanner}`,
    );
  }
  if (isProduction && !isEnabled(env.MEDIA_ALLOW_UNSCANNED_UPLOADS)) {
    throw new MediaRunnerUnavailableError(
      "MEDIA_MALWARE_SCANNER=passthrough is refused in production. Configure a real scanner or set MEDIA_ALLOW_UNSCANNED_UPLOADS=true to accept uploads without an antivirus verdict.",
    );
  }

  const derivatives = (env.MEDIA_DERIVATIVE_WRITER ?? "none")
    .trim()
    .toLowerCase();
  if (derivatives !== "none") {
    throw new MediaRunnerUnavailableError(
      `Unsupported media derivative writer provider: ${derivatives}`,
    );
  }
  if (isProduction && !isEnabled(env.MEDIA_ALLOW_MISSING_DERIVATIVES)) {
    throw new MediaRunnerUnavailableError(
      "MEDIA_DERIVATIVE_WRITER=none is refused in production. Configure a real derivative writer or set MEDIA_ALLOW_MISSING_DERIVATIVES=true to serve originals only.",
    );
  }

  return {
    scanner: { scan: async () => ({ verdict: "clean" }) },
    derivatives: { generate: async () => undefined },
  };
}

/** Only an explicit `true` accepts the production risk; typos still fail closed. */
function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function objectPrefixReaderFor(storage: StoragePort): MediaObjectPrefixReader {
  return { readPrefix: (input) => storage.readPrefix(input) };
}

export type MediaRunner = Readonly<{
  ports: MediaProcessingPorts;
  pending: (limit: number) => Promise<readonly MediaAssetDto[]>;
}>;

/**
 * Fails closed when storage is not configured: without the prefix reader the
 * pipeline cannot verify a signature, and marking an asset `READY` unchecked is
 * exactly what the lifecycle forbids.
 */
export function createMediaRunner(
  env: Readonly<Record<string, string | undefined>> = process.env,
): MediaRunner {
  const storage = createStoragePortFromEnv(env);
  if (storage === null) {
    throw new MediaRunnerUnavailableError(
      "Media storage is not configured; refusing to process media assets.",
    );
  }

  const providers = createMediaProvidersFromEnv(env);
  const repository = new PrismaMediaAssetRepository();

  return {
    ports: createMediaProcessingPorts({
      media: repository,
      objectPrefixReader: objectPrefixReaderFor(storage),
      scanner: providers.scanner,
      derivatives: providers.derivatives,
    }),
    pending: (limit) => repository.listPendingProcessing(limit),
  };
}

export type MediaBatchSummary = Readonly<{
  claimed: number;
  ready: number;
  rejected: number;
  skipped: number;
  retried: number;
  failed: number;
}>;

/**
 * The idempotency key is derived from the asset and the revision the worker is
 * looking at, so the pipeline's per-stage correlation ids stay stable across a
 * retry while still changing when the row does.
 */
function jobFor(asset: MediaAssetDto): MediaProcessingJob {
  return {
    idempotencyKey: `media-process:${asset.id}:${asset.updatedAt.getTime()}`,
    assetId: asset.id,
    tenantId: asset.tenantId,
    weddingId: asset.weddingId,
  };
}

/** Processes one batch of in-flight assets. Safe to call from a cron trigger. */
export async function drainMediaOnce(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<MediaBatchSummary> {
  const runner = createMediaRunner(env);
  const assets = await runner.pending(MEDIA_BATCH_SIZE);

  let ready = 0;
  let rejected = 0;
  let skipped = 0;
  let retried = 0;
  let failed = 0;

  for (const asset of assets) {
    try {
      const result = await processMediaAsset(jobFor(asset), runner.ports);
      if (result.kind === "ready") ready += 1;
      else if (result.kind === "rejected") rejected += 1;
      else skipped += 1;
    } catch (error) {
      if (error instanceof MediaProcessingRetryableError) {
        // A transient inspector/scanner/derivative failure leaves the asset
        // mid-pipeline; the next poll resumes it from that state.
        retried += 1;
      } else if (error instanceof ConflictError) {
        // Another worker won the compare-and-swap, or the row changed mid-flight.
        skipped += 1;
      } else {
        failed += 1;
      }
    }
  }

  return { claimed: assets.length, ready, rejected, skipped, retried, failed };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted === true) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(finish, ms);
    function finish(): void {
      signal?.removeEventListener("abort", finish);
      clearTimeout(timer);
      resolve();
    }
    signal?.addEventListener("abort", finish, { once: true });
  });
}

/**
 * Polls until `signal` aborts. A failing poll is logged and retried on the next
 * tick so a transient database or storage outage cannot stop the loop.
 */
export async function startMediaLoop(
  input: Readonly<{ intervalMs?: number; signal?: AbortSignal }> = {},
): Promise<void> {
  const intervalMs = input.intervalMs ?? MEDIA_POLL_INTERVAL_MS;
  const signal = input.signal;

  while (signal === undefined || !signal.aborted) {
    try {
      const summary = await drainMediaOnce();
      if (summary.claimed > 0) {
        console.info("media.poll.drained", summary);
      }
    } catch (error) {
      console.error(
        "media.poll.failed",
        error instanceof Error ? error.message : "unknown-error",
      );
    }
    await delay(intervalMs, signal);
  }
}

export type MediaCleanupState = "PENDING_UPLOAD" | "UPLOADED";

export const MEDIA_CLEANUP_STATES: readonly MediaCleanupState[] = [
  "PENDING_UPLOAD",
  "UPLOADED",
];

export type MediaCleanupScope = Readonly<{ tenantId: string }>;

export type MediaCleanupCandidate = Readonly<{
  assetId: string;
  weddingId: string;
  objectKey: string;
  state: "PENDING_UPLOAD" | "UPLOADED";
  createdAt: Date;
}>;

export type MediaCleanupRepository = Readonly<{
  listStale(
    scope: MediaCleanupScope,
    input: Readonly<{
      before: Date;
      states: readonly MediaCleanupState[];
      limit: number;
    }>,
  ): Promise<readonly MediaCleanupCandidate[]>;
}>;

export type MediaCleanupDryRun = Readonly<{
  tenantId: string;
  before: string;
  candidates: readonly MediaCleanupCandidate[];
  total: number;
  truncated: boolean;
}>;

function assertCleanupInput(
  scope: MediaCleanupScope,
  before: Date,
  limit: number,
): void {
  if (scope.tenantId.trim().length === 0) {
    throw new Error("Media cleanup tenant scope is required");
  }
  if (!Number.isFinite(before.getTime())) {
    throw new Error("Media cleanup cutoff is invalid");
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw new Error("Media cleanup limit is invalid");
  }
}

/**
 * Lists candidates only. It intentionally has no delete port, so a scheduler
 * cannot turn a dry-run into destructive production cleanup by accident.
 */
export async function dryRunMediaCleanup(
  repository: MediaCleanupRepository,
  scope: MediaCleanupScope,
  before: Date,
  limit = 100,
): Promise<MediaCleanupDryRun> {
  assertCleanupInput(scope, before, limit);
  const candidates = await repository.listStale(scope, {
    before,
    states: MEDIA_CLEANUP_STATES,
    limit: limit + 1,
  });
  const bounded = candidates.slice(0, limit);
  return {
    tenantId: scope.tenantId,
    before: before.toISOString(),
    candidates: bounded,
    total: bounded.length,
    truncated: candidates.length > limit,
  };
}

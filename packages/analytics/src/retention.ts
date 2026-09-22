export const ANALYTICS_RETENTION_MAX_BATCH_SIZE = 1_000;

export type AnalyticsRetentionCandidate = Readonly<{
  id: string;
  tenantId: string;
  createdAt: Date;
}>;

export type AnalyticsRetentionRepository = Readonly<{
  listBefore(
    input: Readonly<{ before: Date; limit: number }>,
  ): Promise<readonly AnalyticsRetentionCandidate[]>;
}>;

export type AnalyticsRetentionDryRun = Readonly<{
  destructive: false;
  before: Date;
  candidates: readonly AnalyticsRetentionCandidate[];
}>;

function assertCutoff(before: Date): void {
  if (!Number.isFinite(before.getTime())) {
    throw new Error("Analytics retention cutoff is invalid");
  }
}

function assertBatchSize(limit: number): void {
  if (
    !Number.isSafeInteger(limit) ||
    limit <= 0 ||
    limit > ANALYTICS_RETENTION_MAX_BATCH_SIZE
  ) {
    throw new Error("Analytics retention batch size is invalid");
  }
}

function assertCandidates(
  candidates: readonly AnalyticsRetentionCandidate[],
  before: Date,
  limit: number,
): void {
  if (!Array.isArray(candidates) || candidates.length > limit) {
    throw new Error("Analytics retention repository returned an invalid batch");
  }
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (
      candidate.id.trim().length === 0 ||
      candidate.tenantId.trim().length === 0 ||
      !(candidate.createdAt instanceof Date) ||
      !Number.isFinite(candidate.createdAt.getTime()) ||
      candidate.createdAt >= before ||
      ids.has(candidate.id)
    ) {
      throw new Error("Analytics retention repository returned invalid data");
    }
    ids.add(candidate.id);
  }
}

/**
 * Returns bounded candidates only. Deletion is intentionally not part of this
 * contract until Product, Privacy, and Database owners approve a retention policy
 * and an audited scheduler.
 */
export async function dryRunAnalyticsRetention(
  input: Readonly<{
    repository: AnalyticsRetentionRepository;
    before: Date;
    limit: number;
  }>,
): Promise<AnalyticsRetentionDryRun> {
  assertCutoff(input.before);
  assertBatchSize(input.limit);
  const candidates = await input.repository.listBefore({
    before: input.before,
    limit: input.limit,
  });
  assertCandidates(candidates, input.before, input.limit);
  return {
    destructive: false,
    before: input.before,
    candidates,
  };
}

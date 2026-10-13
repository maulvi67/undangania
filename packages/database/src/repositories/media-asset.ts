import { Prisma, type MediaState, type PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../client";

const mediaAssetSelect = {
  id: true,
  tenantId: true,
  weddingId: true,
  objectKey: true,
  mediaType: true,
  state: true,
  mimeType: true,
  sizeBytes: true,
  checksum: true,
  width: true,
  height: true,
  altText: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.MediaAssetSelect;

type MediaAssetRow = Prisma.MediaAssetGetPayload<{
  select: typeof mediaAssetSelect;
}>;

export type MediaAssetState =
  | "PENDING_UPLOAD"
  | "UPLOADED"
  | "SCANNING"
  | "PROCESSING"
  | "READY"
  | "REJECTED"
  | "DELETED";

export type MediaAssetScope = Readonly<{
  tenantId: string;
  weddingId: string;
  actorId: string;
  actorType?: "USER" | "SYSTEM";
}>;

export type MediaAssetReadScope = Readonly<{
  tenantId: string;
  weddingId: string;
}>;

export type MediaAssetDto = Readonly<{
  id: string;
  tenantId: string;
  weddingId: string;
  objectKey: string;
  mediaType: string;
  state: MediaAssetState;
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

export type MediaAssetCreateInput = Readonly<{
  objectKey: string;
  mediaType: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  width?: number | null;
  height?: number | null;
  altText?: string | null;
}>;

export type MediaAssetObservedUpload = Readonly<{
  id: string;
  contentLength: number;
  contentType: string;
  checksum: string;
}>;

export type MediaAssetMutationResult =
  | Readonly<{ kind: "ok"; asset: MediaAssetDto }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "invalid-state"; state: MediaAssetState }>
  | Readonly<{ kind: "rejected"; asset: MediaAssetDto; reason: string }>;

export type MediaAssetClient = Readonly<{
  mediaAsset: {
    findFirst(args: {
      where: Prisma.MediaAssetWhereInput;
      select: typeof mediaAssetSelect;
    }): Promise<MediaAssetRow | null>;
    findMany(args: {
      where: Prisma.MediaAssetWhereInput;
      orderBy: Prisma.MediaAssetOrderByWithRelationInput;
      take?: number;
      select: typeof mediaAssetSelect;
    }): Promise<MediaAssetRow[]>;
    create(args: {
      data: Prisma.MediaAssetUncheckedCreateInput;
      select: typeof mediaAssetSelect;
    }): Promise<MediaAssetRow>;
    updateMany(args: {
      where: Prisma.MediaAssetWhereInput;
      data: Prisma.MediaAssetUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
  auditEvent: {
    create(args: { data: Prisma.AuditEventUncheckedCreateInput }): Promise<{
      id: string;
    }>;
  };
  outboxEvent: {
    create(args: { data: Prisma.OutboxEventUncheckedCreateInput }): Promise<{
      id: string;
    }>;
  };
}>;

export function adaptMediaAssetClient(
  client: Pick<PrismaClient, "mediaAsset" | "auditEvent" | "outboxEvent">,
): MediaAssetClient {
  return {
    mediaAsset: {
      findFirst: (args) => client.mediaAsset.findFirst(args),
      findMany: (args) => client.mediaAsset.findMany(args),
      create: (args) => client.mediaAsset.create(args),
      updateMany: (args) => client.mediaAsset.updateMany(args),
    },
    auditEvent: {
      create: (args) => client.auditEvent.create(args),
    },
    outboxEvent: {
      create: (args) => client.outboxEvent.create(args),
    },
  };
}

export type MediaAssetTransactionRunner = <T>(
  work: (client: MediaAssetClient) => Promise<T>,
) => Promise<T>;

function scopeWhere(scope: MediaAssetReadScope): Prisma.MediaAssetWhereInput {
  return { tenantId: scope.tenantId, weddingId: scope.weddingId };
}

function assetWhere(
  scope: MediaAssetReadScope,
  id: string,
): Prisma.MediaAssetWhereInput {
  return { ...scopeWhere(scope), id };
}

function assertScope(scope: MediaAssetReadScope): void {
  if (
    scope.tenantId.trim().length === 0 ||
    scope.weddingId.trim().length === 0
  ) {
    throw new Error("Media asset scope is incomplete");
  }
}

function assertId(id: string): void {
  if (id.trim().length === 0) throw new Error("Media asset id is required");
}

function assertCorrelationId(correlationId: string): void {
  if (correlationId.trim().length === 0) {
    throw new Error("Media correlation id is required");
  }
}

function toMediaState(state: MediaState): MediaAssetState {
  switch (state) {
    case "PENDING_UPLOAD":
    case "UPLOADED":
    case "SCANNING":
    case "PROCESSING":
    case "READY":
    case "REJECTED":
    case "DELETED":
      return state;
  }
}

function toDto(row: MediaAssetRow): MediaAssetDto {
  const sizeBytes = Number(row.sizeBytes);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
    throw new Error("Media asset size is outside the supported range");
  }

  return {
    id: row.id,
    tenantId: row.tenantId,
    weddingId: row.weddingId,
    objectKey: row.objectKey,
    mediaType: row.mediaType,
    state: toMediaState(row.state),
    mimeType: row.mimeType,
    sizeBytes,
    checksum: row.checksum,
    width: row.width,
    height: row.height,
    altText: row.altText,
    // The current schema has no rejection-reason column. Reasons are returned by
    // the completing mutation and recorded in audit metadata; a later list can
    // still safely show the rejected state without inventing stale text.
    rejectionReason: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function stateFor(row: MediaAssetRow): MediaAssetState {
  return toDto(row).state;
}

function auditData(input: {
  scope: MediaAssetScope;
  action: string;
  targetId: string;
  correlationId: string;
  metadata: Prisma.InputJsonValue;
}): Prisma.AuditEventUncheckedCreateInput {
  return {
    tenantId: input.scope.tenantId,
    ...(input.scope.actorType === "SYSTEM"
      ? {}
      : { userId: input.scope.actorId }),
    actorType: input.scope.actorType ?? "USER",
    action: input.action,
    targetType: "MediaAsset",
    targetId: input.targetId,
    metadata: input.metadata,
    correlationId: input.correlationId,
  };
}

async function appendMutationEvents(
  client: MediaAssetClient,
  input: {
    scope: MediaAssetScope;
    asset: MediaAssetDto;
    action: string;
    eventType: string;
    correlationId: string;
    metadata: Prisma.InputJsonValue;
  },
): Promise<void> {
  await client.auditEvent.create({
    data: auditData({
      scope: input.scope,
      action: input.action,
      targetId: input.asset.id,
      correlationId: input.correlationId,
      metadata: input.metadata,
    }),
  });
  await client.outboxEvent.create({
    data: {
      id: randomUUID(),
      tenantId: input.scope.tenantId,
      eventType: input.eventType,
      aggregateType: "MediaAsset",
      aggregateId: input.asset.id,
      payload: {
        mediaAssetId: input.asset.id,
        tenantId: input.asset.tenantId,
        weddingId: input.asset.weddingId,
        objectKey: input.asset.objectKey,
        state: input.asset.state,
      },
      payloadVersion: 1,
    },
  });
}

export async function createPendingMediaAsset(
  client: MediaAssetClient,
  scope: MediaAssetScope,
  input: MediaAssetCreateInput,
  correlationId: string,
): Promise<MediaAssetDto> {
  assertScope(scope);
  assertCorrelationId(correlationId);
  if (input.objectKey.trim().length === 0) {
    throw new Error("Media object key is required");
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new Error("Media size is invalid");
  }

  const row = await client.mediaAsset.create({
    data: {
      tenantId: scope.tenantId,
      weddingId: scope.weddingId,
      objectKey: input.objectKey,
      mediaType: input.mediaType,
      state: "PENDING_UPLOAD",
      mimeType: input.mimeType,
      sizeBytes: BigInt(input.sizeBytes),
      checksum: input.checksum ?? "",
      ...(input.width === undefined ? {} : { width: input.width }),
      ...(input.height === undefined ? {} : { height: input.height }),
      ...(input.altText === undefined ? {} : { altText: input.altText }),
    },
    select: mediaAssetSelect,
  });
  const asset = toDto(row);
  await appendMutationEvents(client, {
    scope,
    asset,
    action: "MEDIA_UPLOAD_STARTED",
    eventType: "MediaUploadStarted",
    correlationId,
    metadata: {
      mediaType: asset.mediaType,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
    },
  });
  return asset;
}

export async function completeMediaAssetUpload(
  client: MediaAssetClient,
  scope: MediaAssetScope,
  input: MediaAssetObservedUpload,
  correlationId: string,
): Promise<MediaAssetMutationResult> {
  assertScope(scope);
  assertId(input.id);
  assertCorrelationId(correlationId);
  if (!Number.isSafeInteger(input.contentLength) || input.contentLength <= 0) {
    throw new Error("Observed media size is invalid");
  }
  if (input.contentType.trim().length === 0) {
    throw new Error("Observed media type is required");
  }

  const current = await client.mediaAsset.findFirst({
    where: assetWhere(scope, input.id),
    select: mediaAssetSelect,
  });
  if (current === null) return { kind: "not-found" };
  if (current.state !== "PENDING_UPLOAD") {
    return { kind: "invalid-state", state: stateFor(current) };
  }

  const expectedSize = Number(current.sizeBytes);
  const valid =
    expectedSize === input.contentLength &&
    current.mimeType === input.contentType;
  if (!valid) {
    const rejected = await client.mediaAsset.updateMany({
      where: { ...assetWhere(scope, input.id), state: "PENDING_UPLOAD" },
      data: { state: "REJECTED" },
    });
    if (rejected.count !== 1) {
      const latest = await client.mediaAsset.findFirst({
        where: assetWhere(scope, input.id),
        select: mediaAssetSelect,
      });
      return latest === null
        ? { kind: "not-found" }
        : { kind: "invalid-state", state: stateFor(latest) };
    }
    const rejectedRow = await client.mediaAsset.findFirst({
      where: assetWhere(scope, input.id),
      select: mediaAssetSelect,
    });
    if (rejectedRow === null) return { kind: "not-found" };
    const asset = toDto(rejectedRow);
    const reason =
      expectedSize !== input.contentLength
        ? "Ukuran file yang diterima tidak sesuai dengan deklarasi unggahan."
        : "Tipe file yang diterima tidak sesuai dengan deklarasi unggahan.";
    await appendMutationEvents(client, {
      scope,
      asset,
      action: "MEDIA_UPLOAD_REJECTED",
      eventType: "MediaRejected",
      correlationId,
      metadata: {
        reason,
        expectedSize,
        observedSize: input.contentLength,
        expectedMimeType: current.mimeType,
        observedMimeType: input.contentType,
      },
    });
    return { kind: "rejected", asset, reason };
  }

  const updated = await client.mediaAsset.updateMany({
    where: { ...assetWhere(scope, input.id), state: "PENDING_UPLOAD" },
    data: { state: "UPLOADED", checksum: input.checksum },
  });
  if (updated.count !== 1) {
    const latest = await client.mediaAsset.findFirst({
      where: assetWhere(scope, input.id),
      select: mediaAssetSelect,
    });
    return latest === null
      ? { kind: "not-found" }
      : { kind: "invalid-state", state: stateFor(latest) };
  }

  const uploadedRow = await client.mediaAsset.findFirst({
    where: assetWhere(scope, input.id),
    select: mediaAssetSelect,
  });
  if (uploadedRow === null) return { kind: "not-found" };
  const asset = toDto(uploadedRow);
  await appendMutationEvents(client, {
    scope,
    asset,
    action: "MEDIA_UPLOADED",
    eventType: "MediaUploaded",
    correlationId,
    metadata: {
      contentLength: input.contentLength,
      contentType: input.contentType,
      checksum: input.checksum,
    },
  });
  return { kind: "ok", asset };
}

async function transitionMediaAsset(
  client: MediaAssetClient,
  scope: MediaAssetScope,
  id: string,
  from: readonly MediaAssetState[],
  to: MediaAssetState,
  action: string,
  eventType: string,
  correlationId: string,
  metadata: Prisma.InputJsonValue,
): Promise<MediaAssetMutationResult> {
  assertScope(scope);
  assertId(id);
  assertCorrelationId(correlationId);
  const current = await client.mediaAsset.findFirst({
    where: assetWhere(scope, id),
    select: mediaAssetSelect,
  });
  if (current === null) return { kind: "not-found" };
  const currentState = stateFor(current);
  if (!from.includes(currentState)) {
    return { kind: "invalid-state", state: currentState };
  }

  const updated = await client.mediaAsset.updateMany({
    where: { ...assetWhere(scope, id), state: current.state },
    data: { state: to },
  });
  if (updated.count !== 1) {
    const latest = await client.mediaAsset.findFirst({
      where: assetWhere(scope, id),
      select: mediaAssetSelect,
    });
    return latest === null
      ? { kind: "not-found" }
      : { kind: "invalid-state", state: stateFor(latest) };
  }

  const row = await client.mediaAsset.findFirst({
    where: assetWhere(scope, id),
    select: mediaAssetSelect,
  });
  if (row === null) return { kind: "not-found" };
  const asset = toDto(row);
  await appendMutationEvents(client, {
    scope,
    asset,
    action,
    eventType,
    correlationId,
    metadata,
  });
  return { kind: "ok", asset };
}

export async function markMediaAssetScanning(
  client: MediaAssetClient,
  scope: MediaAssetScope,
  id: string,
  correlationId: string,
): Promise<MediaAssetMutationResult> {
  return transitionMediaAsset(
    client,
    scope,
    id,
    ["UPLOADED"],
    "SCANNING",
    "MEDIA_SCANNING",
    "MediaScanning",
    correlationId,
    { state: "SCANNING" },
  );
}

export async function markMediaAssetProcessing(
  client: MediaAssetClient,
  scope: MediaAssetScope,
  id: string,
  dimensions: Readonly<{ width: number | null; height: number | null }>,
  correlationId: string,
): Promise<MediaAssetMutationResult> {
  if (
    dimensions.width !== null &&
    (!Number.isSafeInteger(dimensions.width) || dimensions.width <= 0)
  ) {
    throw new Error("Media width is invalid");
  }
  if (
    dimensions.height !== null &&
    (!Number.isSafeInteger(dimensions.height) || dimensions.height <= 0)
  ) {
    throw new Error("Media height is invalid");
  }

  assertScope(scope);
  assertId(id);
  assertCorrelationId(correlationId);
  const current = await client.mediaAsset.findFirst({
    where: assetWhere(scope, id),
    select: mediaAssetSelect,
  });
  if (current === null) return { kind: "not-found" };
  if (stateFor(current) !== "SCANNING") {
    return { kind: "invalid-state", state: stateFor(current) };
  }

  const updated = await client.mediaAsset.updateMany({
    where: { ...assetWhere(scope, id), state: "SCANNING" },
    data: {
      state: "PROCESSING",
      width: dimensions.width,
      height: dimensions.height,
    },
  });
  if (updated.count !== 1) {
    const latest = await client.mediaAsset.findFirst({
      where: assetWhere(scope, id),
      select: mediaAssetSelect,
    });
    return latest === null
      ? { kind: "not-found" }
      : { kind: "invalid-state", state: stateFor(latest) };
  }

  const row = await client.mediaAsset.findFirst({
    where: assetWhere(scope, id),
    select: mediaAssetSelect,
  });
  if (row === null) return { kind: "not-found" };
  const asset = toDto(row);
  await appendMutationEvents(client, {
    scope,
    asset,
    action: "MEDIA_PROCESSING",
    eventType: "MediaProcessing",
    correlationId,
    metadata: {
      state: "PROCESSING",
      width: dimensions.width,
      height: dimensions.height,
    },
  });
  return { kind: "ok", asset };
}

export async function markMediaAssetReady(
  client: MediaAssetClient,
  scope: MediaAssetScope,
  id: string,
  correlationId: string,
): Promise<MediaAssetMutationResult> {
  return transitionMediaAsset(
    client,
    scope,
    id,
    ["PROCESSING"],
    "READY",
    "MEDIA_READY",
    "MediaReady",
    correlationId,
    { state: "READY" },
  );
}

export async function rejectMediaAsset(
  client: MediaAssetClient,
  scope: MediaAssetScope,
  id: string,
  reason: string,
  correlationId: string,
): Promise<MediaAssetMutationResult> {
  if (reason.trim().length === 0)
    throw new Error("Rejection reason is required");
  return transitionMediaAsset(
    client,
    scope,
    id,
    ["PENDING_UPLOAD", "UPLOADED", "SCANNING", "PROCESSING"],
    "REJECTED",
    "MEDIA_REJECTED",
    "MediaRejected",
    correlationId,
    { reason: reason.slice(0, 500) },
  );
}

export async function softDeleteMediaAsset(
  client: MediaAssetClient,
  scope: MediaAssetScope,
  id: string,
  correlationId: string,
): Promise<MediaAssetMutationResult> {
  return transitionMediaAsset(
    client,
    scope,
    id,
    [
      "PENDING_UPLOAD",
      "UPLOADED",
      "SCANNING",
      "PROCESSING",
      "READY",
      "REJECTED",
    ],
    "DELETED",
    "MEDIA_DELETED",
    "MediaDeleted",
    correlationId,
    { state: "DELETED" },
  );
}

export interface MediaAssetRepository {
  createPending(
    scope: MediaAssetScope,
    input: MediaAssetCreateInput,
    correlationId: string,
  ): Promise<MediaAssetDto>;
  completeUpload(
    scope: MediaAssetScope,
    input: MediaAssetObservedUpload,
    correlationId: string,
  ): Promise<MediaAssetMutationResult>;
  markScanning(
    scope: MediaAssetScope,
    id: string,
    correlationId: string,
  ): Promise<MediaAssetMutationResult>;
  markProcessing(
    scope: MediaAssetScope,
    id: string,
    dimensions: Readonly<{ width: number | null; height: number | null }>,
    correlationId: string,
  ): Promise<MediaAssetMutationResult>;
  markReady(
    scope: MediaAssetScope,
    id: string,
    correlationId: string,
  ): Promise<MediaAssetMutationResult>;
  reject(
    scope: MediaAssetScope,
    id: string,
    reason: string,
    correlationId: string,
  ): Promise<MediaAssetMutationResult>;
  softDelete(
    scope: MediaAssetScope,
    id: string,
    correlationId: string,
  ): Promise<MediaAssetMutationResult>;
  findById(
    scope: MediaAssetReadScope,
    id: string,
  ): Promise<MediaAssetDto | null>;
  listForWedding(scope: MediaAssetReadScope): Promise<readonly MediaAssetDto[]>;
  findReadyByIds(
    scope: MediaAssetReadScope,
    ids: readonly string[],
  ): Promise<readonly MediaAssetDto[]>;
  listPendingProcessing(limit: number): Promise<readonly MediaAssetDto[]>;
}

export class PrismaMediaAssetRepository implements MediaAssetRepository {
  private readonly client: MediaAssetClient;
  private readonly transaction: MediaAssetTransactionRunner;

  public constructor(
    client: MediaAssetClient = adaptMediaAssetClient(prisma),
    transaction?: MediaAssetTransactionRunner,
  ) {
    this.client = client;
    this.transaction =
      transaction ??
      ((work) =>
        prisma.$transaction((transactionClient) =>
          work(adaptMediaAssetClient(transactionClient)),
        ));
  }

  public createPending(
    scope: MediaAssetScope,
    input: MediaAssetCreateInput,
    correlationId: string,
  ): Promise<MediaAssetDto> {
    return this.transaction((client) =>
      createPendingMediaAsset(client, scope, input, correlationId),
    );
  }

  public completeUpload(
    scope: MediaAssetScope,
    input: MediaAssetObservedUpload,
    correlationId: string,
  ): Promise<MediaAssetMutationResult> {
    return this.transaction((client) =>
      completeMediaAssetUpload(client, scope, input, correlationId),
    );
  }

  public markScanning(
    scope: MediaAssetScope,
    id: string,
    correlationId: string,
  ): Promise<MediaAssetMutationResult> {
    return this.transaction((client) =>
      markMediaAssetScanning(client, scope, id, correlationId),
    );
  }

  public markProcessing(
    scope: MediaAssetScope,
    id: string,
    dimensions: Readonly<{ width: number | null; height: number | null }>,
    correlationId: string,
  ): Promise<MediaAssetMutationResult> {
    return this.transaction((client) =>
      markMediaAssetProcessing(client, scope, id, dimensions, correlationId),
    );
  }

  public markReady(
    scope: MediaAssetScope,
    id: string,
    correlationId: string,
  ): Promise<MediaAssetMutationResult> {
    return this.transaction((client) =>
      markMediaAssetReady(client, scope, id, correlationId),
    );
  }

  public reject(
    scope: MediaAssetScope,
    id: string,
    reason: string,
    correlationId: string,
  ): Promise<MediaAssetMutationResult> {
    return this.transaction((client) =>
      rejectMediaAsset(client, scope, id, reason, correlationId),
    );
  }

  public softDelete(
    scope: MediaAssetScope,
    id: string,
    correlationId: string,
  ): Promise<MediaAssetMutationResult> {
    return this.transaction((client) =>
      softDeleteMediaAsset(client, scope, id, correlationId),
    );
  }

  public async findById(
    scope: MediaAssetReadScope,
    id: string,
  ): Promise<MediaAssetDto | null> {
    assertScope(scope);
    assertId(id);
    const row = await this.client.mediaAsset.findFirst({
      where: assetWhere(scope, id),
      select: mediaAssetSelect,
    });
    return row === null ? null : toDto(row);
  }

  public async listForWedding(
    scope: MediaAssetReadScope,
  ): Promise<readonly MediaAssetDto[]> {
    assertScope(scope);
    const rows = await this.client.mediaAsset.findMany({
      where: { ...scopeWhere(scope), state: { not: "DELETED" } },
      orderBy: { createdAt: "asc" },
      select: mediaAssetSelect,
    });
    return rows.map(toDto);
  }

  public async findReadyByIds(
    scope: MediaAssetReadScope,
    ids: readonly string[],
  ): Promise<readonly MediaAssetDto[]> {
    assertScope(scope);
    const uniqueIds = [...new Set(ids)].filter((id) => id.trim().length > 0);
    if (uniqueIds.length === 0) return [];
    const rows = await this.client.mediaAsset.findMany({
      where: {
        ...scopeWhere(scope),
        id: { in: uniqueIds },
        state: "READY",
      },
      orderBy: { createdAt: "asc" },
      select: mediaAssetSelect,
    });
    return rows.map(toDto);
  }

  /**
   * Oldest assets that still need the worker, across every tenant.
   *
   * This is a system read, not a request read: the worker iterates all tenants
   * the same way the outbox consumer does. `UPLOADED`, `SCANNING`, and
   * `PROCESSING` are all listed because the pipeline is resumable — a retryable
   * inspector/scanner/derivative failure leaves the asset mid-pipeline, and
   * `processMediaAsset` resumes it from the state it finds. The claim is the
   * compare-and-swap inside `markScanning`/`markProcessing`/`markReady`, so
   * listing a row two workers both see is harmless. `limit` is clamped.
   */
  public async listPendingProcessing(
    limit: number,
  ): Promise<readonly MediaAssetDto[]> {
    const take =
      Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50;
    const rows = await this.client.mediaAsset.findMany({
      where: { state: { in: ["UPLOADED", "SCANNING", "PROCESSING"] } },
      orderBy: { createdAt: "asc" },
      take,
      select: mediaAssetSelect,
    });
    return rows.map(toDto);
  }
}

export const MEDIA_ASSET_STATES: readonly MediaAssetState[] = [
  "PENDING_UPLOAD",
  "UPLOADED",
  "SCANNING",
  "PROCESSING",
  "READY",
  "REJECTED",
  "DELETED",
];

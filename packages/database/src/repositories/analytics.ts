import { Prisma, type PrismaClient } from "@prisma/client";
import {
  ANALYTICS_REPORT_MAX_EVENTS,
  parseAnalyticsEventPayload,
  serializeAnalyticsEventPayload,
  type AnalyticsAppendResult,
  type AnalyticsEventDraft,
  type AnalyticsEventRecord,
  type AnalyticsEventRepository,
  type AnalyticsReportRange,
  type AnalyticsRetentionCandidate,
  type AnalyticsRetentionRepository,
  type AnalyticsScope,
} from "@wedding/analytics";
import { prisma } from "../client";

const ANALYTICS_AGGREGATE_TYPE = "AnalyticsEvent";
const ANALYTICS_EVENT_TYPE = "AnalyticsEventAccepted";

const storedEventSelect = {
  id: true,
  tenantId: true,
  aggregateType: true,
  eventType: true,
  payload: true,
  createdAt: true,
} as const satisfies Prisma.OutboxEventSelect;

type StoredEventRow = Prisma.OutboxEventGetPayload<{
  select: typeof storedEventSelect;
}>;

export type AnalyticsRepositoryClient = Readonly<{
  outboxEvent: {
    findFirst(args: {
      where: { id: string; tenantId: string };
      select: typeof storedEventSelect;
    }): Promise<StoredEventRow | null>;
    findMany(args: {
      where: Prisma.OutboxEventWhereInput;
      orderBy: Prisma.OutboxEventOrderByWithRelationInput;
      take: number;
      select: typeof storedEventSelect;
    }): Promise<StoredEventRow[]>;
    create(args: {
      data: Prisma.OutboxEventUncheckedCreateInput;
      select: typeof storedEventSelect;
    }): Promise<StoredEventRow>;
  };
}>;

export function adaptAnalyticsRepositoryClient(
  client: Pick<PrismaClient, "outboxEvent">,
): AnalyticsRepositoryClient {
  return {
    outboxEvent: {
      findFirst: (args) => client.outboxEvent.findFirst(args),
      findMany: (args) => client.outboxEvent.findMany(args),
      create: (args) => client.outboxEvent.create(args),
    },
  };
}

export class AnalyticsRepositoryUnavailableError extends Error {
  public constructor() {
    super("The analytics repository is unavailable");
    this.name = "AnalyticsRepositoryUnavailableError";
  }
}

export class AnalyticsRepositoryConsistencyError extends Error {
  public constructor() {
    super("The analytics event payload is inconsistent");
    this.name = "AnalyticsRepositoryConsistencyError";
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function isAnalyticsEvent(row: StoredEventRow, scope: AnalyticsScope): boolean {
  return (
    row.tenantId === scope.tenantId &&
    row.aggregateType === ANALYTICS_AGGREGATE_TYPE &&
    row.eventType === ANALYTICS_EVENT_TYPE
  );
}

function toEventRecord(
  row: StoredEventRow,
  scope: AnalyticsScope,
): AnalyticsEventRecord {
  if (!isAnalyticsEvent(row, scope)) {
    throw new AnalyticsRepositoryConsistencyError();
  }
  const payload = parseAnalyticsEventPayload(row.payload);
  if (payload === null || payload.eventId !== row.id) {
    throw new AnalyticsRepositoryConsistencyError();
  }

  const occurredAt = new Date(payload.occurredAt);
  if (!Number.isFinite(occurredAt.getTime())) {
    throw new AnalyticsRepositoryConsistencyError();
  }

  return {
    id: payload.eventId,
    name: payload.eventName,
    schemaVersion: payload.schemaVersion,
    tenantIdHash: payload.tenantIdHash,
    actorHash: payload.actorHash,
    properties: payload.properties,
    occurredAt,
    acceptedAt: row.createdAt,
  };
}

async function readById(
  client: AnalyticsRepositoryClient,
  scope: AnalyticsScope,
  id: string,
): Promise<AnalyticsEventRecord | null> {
  const row = await client.outboxEvent.findFirst({
    where: { id, tenantId: scope.tenantId },
    select: storedEventSelect,
  });
  if (row === null) return null;
  return toEventRecord(row, scope);
}

/**
 * Analytics deliberately uses the pre-existing outbox table as its write model.
 * The payload contains hashes and allowlisted properties only; `tenantId` is the
 * existing relational scope column used for authorization and is not analytics
 * payload data.
 */
export class PrismaAnalyticsRepository
  implements AnalyticsEventRepository, AnalyticsRetentionRepository
{
  public constructor(
    private readonly client: AnalyticsRepositoryClient = adaptAnalyticsRepositoryClient(
      prisma,
    ),
  ) {}

  public async append(
    scope: AnalyticsScope,
    event: AnalyticsEventDraft,
  ): Promise<AnalyticsAppendResult> {
    const existing = await readById(this.client, scope, event.id);
    if (existing !== null) return { kind: "existing", event: existing };

    try {
      const created = await this.client.outboxEvent.create({
        data: {
          id: event.id,
          tenantId: scope.tenantId,
          eventType: ANALYTICS_EVENT_TYPE,
          aggregateType: ANALYTICS_AGGREGATE_TYPE,
          aggregateId: event.id,
          payload: serializeAnalyticsEventPayload(event),
          payloadVersion: event.schemaVersion,
          createdAt: event.acceptedAt,
        },
        select: storedEventSelect,
      });
      return { kind: "created", event: toEventRecord(created, scope) };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw new AnalyticsRepositoryUnavailableError();
      }
      // Another request won the deterministic insert. Re-read the committed row
      // so both requests have the same replay/conflict result.
      const replay = await readById(this.client, scope, event.id);
      if (replay === null) throw new AnalyticsRepositoryUnavailableError();
      return { kind: "existing", event: replay };
    }
  }

  public async listAccepted(
    scope: AnalyticsScope,
    range: AnalyticsReportRange,
  ): Promise<readonly AnalyticsEventRecord[]> {
    const rows = await this.client.outboxEvent.findMany({
      where: {
        tenantId: scope.tenantId,
        aggregateType: ANALYTICS_AGGREGATE_TYPE,
        eventType: ANALYTICS_EVENT_TYPE,
        createdAt: {
          gte: range.from,
          lt: range.to,
        },
      },
      orderBy: { createdAt: "asc" },
      // One extra row lets the application report an explicit bounded-report error
      // instead of silently truncating a tenant's metrics.
      take: ANALYTICS_REPORT_MAX_EVENTS + 1,
      select: storedEventSelect,
    });
    return rows.map((row) => toEventRecord(row, scope));
  }

  public async listBefore(input: {
    before: Date;
    limit: number;
  }): Promise<readonly AnalyticsRetentionCandidate[]> {
    const rows = await this.client.outboxEvent.findMany({
      where: {
        aggregateType: ANALYTICS_AGGREGATE_TYPE,
        eventType: ANALYTICS_EVENT_TYPE,
        createdAt: { lt: input.before },
      },
      orderBy: { createdAt: "asc" },
      take: input.limit,
      select: storedEventSelect,
    });
    return rows.map((row) => {
      if (row.tenantId === null) {
        throw new AnalyticsRepositoryConsistencyError();
      }
      return {
        id: row.id,
        tenantId: row.tenantId,
        createdAt: row.createdAt,
      };
    });
  }
}

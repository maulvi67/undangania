import {
  Prisma,
  type NotificationStatus,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "../client";

/**
 * Tenant-scoped notification delivery status.
 *
 * Recipient references, provider message ids, and idempotency keys are excluded:
 * the customer UI needs to know whether a message was delivered, not who it went
 * to or which provider request carried it.
 */

const notificationSelect = {
  id: true,
  channel: true,
  templateCode: true,
  status: true,
  attemptCount: true,
  createdAt: true,
  sentAt: true,
  deliveredAt: true,
  lastError: true,
} as const satisfies Prisma.NotificationSelect;

type NotificationRow = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

type NotificationStatusClient = Readonly<{
  notification: {
    findMany(args: {
      where: Prisma.NotificationWhereInput;
      orderBy: Prisma.NotificationOrderByWithRelationInput[];
      take: number;
      select: typeof notificationSelect;
    }): Promise<NotificationRow[]>;
  };
}>;

export type NotificationStatusScope = Readonly<{ tenantId: string }>;

export type NotificationStatusDto = Readonly<{
  id: string;
  channel: string;
  templateCode: string;
  status: NotificationStatus;
  attemptCount: number;
  createdAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  lastError: string | null;
}>;

export class PrismaNotificationStatusRepository {
  public constructor(
    private readonly client: NotificationStatusClient = prisma,
  ) {}

  public async listForTenant(
    scope: NotificationStatusScope,
    limit = 50,
  ): Promise<readonly NotificationStatusDto[]> {
    const boundedLimit = Number.isInteger(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 50;
    const rows = await this.client.notification.findMany({
      where: { tenantId: scope.tenantId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: boundedLimit,
      select: notificationSelect,
    });
    return rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      templateCode: row.templateCode,
      status: row.status,
      attemptCount: row.attemptCount,
      createdAt: row.createdAt,
      sentAt: row.sentAt,
      deliveredAt: row.deliveredAt,
      lastError: row.lastError,
    }));
  }
}

export function adaptNotificationStatusClient(
  client: Pick<PrismaClient, "notification">,
): NotificationStatusClient {
  return {
    notification: {
      findMany: (args) => client.notification.findMany(args),
    },
  };
}

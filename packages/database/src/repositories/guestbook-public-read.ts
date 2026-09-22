import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";

/**
 * Public guestbook reads are deliberately separate from the moderation queue.
 *
 * The public invitation can only see messages that a moderator has approved, and
 * the caller never supplies tenant or wedding scope. The active publication reader
 * establishes that scope before this repository is called.
 */

export const PUBLIC_GUESTBOOK_PAGE_SIZE = 12;
export const PUBLIC_GUESTBOOK_MAX_PAGE_SIZE = 50;

export type GuestbookCursor = Readonly<{
  submittedAt: Date;
  id: string;
}>;

const messageSelect = {
  id: true,
  displayName: true,
  message: true,
  submittedAt: true,
} as const satisfies Prisma.GuestbookMessageSelect;

type MessageRow = Prisma.GuestbookMessageGetPayload<{
  select: typeof messageSelect;
}>;

export type ApprovedGuestbookScope = Readonly<{
  tenantId: string;
  weddingId: string;
}>;

export type ApprovedGuestbookRowDto = Readonly<{
  id: string;
  displayName: string;
  message: string;
  submittedAt: Date;
}>;

export type ApprovedGuestbookPage = Readonly<{
  rows: readonly ApprovedGuestbookRowDto[];
  nextCursor: string | null;
}>;

export type ApprovedGuestbookPageOptions = Readonly<{
  cursor?: string | null;
  limit?: number;
}>;

export type GuestbookPublicReadClient = Readonly<{
  guestbookMessage: {
    findMany(args: {
      where: Prisma.GuestbookMessageWhereInput;
      orderBy: Prisma.GuestbookMessageOrderByWithRelationInput[];
      select: typeof messageSelect;
      take: number;
    }): Promise<MessageRow[]>;
  };
}>;

export function adaptGuestbookPublicReadClient(
  client: Pick<PrismaClient, "guestbookMessage">,
): GuestbookPublicReadClient {
  return {
    guestbookMessage: {
      findMany: (args) => client.guestbookMessage.findMany(args),
    },
  };
}

function pageSize(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return PUBLIC_GUESTBOOK_PAGE_SIZE;
  }
  return Math.min(
    PUBLIC_GUESTBOOK_MAX_PAGE_SIZE,
    Math.max(1, Math.floor(value)),
  );
}

/**
 * Encodes only the stable sort keys. Message text, household data, and tenant
 * identifiers never enter a public cursor.
 */
export function encodeApprovedGuestbookCursor(cursor: GuestbookCursor): string {
  return Buffer.from(
    JSON.stringify({
      submittedAt: cursor.submittedAt.toISOString(),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeApprovedGuestbookCursor(
  value: string | null | undefined,
): GuestbookCursor | null {
  if (
    value === undefined ||
    value === null ||
    value.length === 0 ||
    value.length > 256
  ) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      record.id.length === 0 ||
      record.id.length > 128
    ) {
      return null;
    }
    if (typeof record.submittedAt !== "string") return null;
    const submittedAt = new Date(record.submittedAt);
    if (Number.isNaN(submittedAt.getTime())) return null;
    return { id: record.id, submittedAt };
  } catch {
    return null;
  }
}

function toDto(row: MessageRow): ApprovedGuestbookRowDto {
  return {
    id: row.id,
    displayName: row.displayName,
    message: row.message,
    submittedAt: row.submittedAt,
  };
}

export interface ApprovedGuestbookRepository {
  loadApproved(
    scope: ApprovedGuestbookScope,
    options?: ApprovedGuestbookPageOptions,
  ): Promise<ApprovedGuestbookPage>;
}

export class PrismaApprovedGuestbookRepository
  implements ApprovedGuestbookRepository
{
  public constructor(
    private readonly client: GuestbookPublicReadClient =
      adaptGuestbookPublicReadClient(prisma),
  ) {}

  public async loadApproved(
    scope: ApprovedGuestbookScope,
    options: ApprovedGuestbookPageOptions = {},
  ): Promise<ApprovedGuestbookPage> {
    const limit = pageSize(options.limit);
    const cursor = decodeApprovedGuestbookCursor(options.cursor);
    const rows = await this.client.guestbookMessage.findMany({
      where: {
        tenantId: scope.tenantId,
        weddingId: scope.weddingId,
        moderationStatus: "APPROVED",
        ...(cursor === null
          ? {}
          : {
              OR: [
                { submittedAt: { lt: cursor.submittedAt } },
                {
                  submittedAt: cursor.submittedAt,
                  id: { lt: cursor.id },
                },
              ],
            }),
      },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      select: messageSelect,
      take: limit + 1,
    });

    const hasNext = rows.length > limit;
    const pageRows = hasNext ? rows.slice(0, limit) : rows;
    const last = pageRows[pageRows.length - 1];
    return {
      rows: pageRows.map(toDto),
      nextCursor:
        hasNext && last !== undefined
          ? encodeApprovedGuestbookCursor(last)
          : null,
    };
  }
}

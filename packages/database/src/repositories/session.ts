import { Prisma } from "@prisma/client";
import { prisma } from "../client";
import {
  generateSessionToken,
  hashSessionToken,
  verifySessionToken,
} from "../tokens";

const sessionSelect = {
  id: true,
  tokenHash: true,
  userId: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
  lastSeenAt: true,
} as const satisfies Prisma.SessionSelect;

type SessionRow = Prisma.SessionGetPayload<{ select: typeof sessionSelect }>;

type SessionRepositoryClient = {
  session: {
    create(args: {
      data: Prisma.SessionUncheckedCreateInput;
      select: typeof sessionSelect;
    }): Promise<SessionRow>;
    findFirst(args: {
      where: Prisma.SessionWhereInput;
      select: typeof sessionSelect;
    }): Promise<SessionRow | null>;
    updateMany(args: {
      where: Prisma.SessionWhereInput;
      data: Prisma.SessionUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
};

export type SessionDto = Readonly<{
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  lastSeenAt: Date | null;
}>;

export type CreatedSession = Readonly<{
  token: string;
  session: SessionDto;
}>;

export interface SessionRepository {
  create(userId: string, expiresAt: Date): Promise<CreatedSession>;
  findActiveByToken(token: string, now?: Date): Promise<SessionDto | null>;
  touch(sessionId: string, now?: Date): Promise<boolean>;
  revokeById(sessionId: string, now?: Date): Promise<boolean>;
  revokeAllForUser(userId: string, now?: Date): Promise<number>;
}

function toSessionDto(row: SessionRow): SessionDto {
  return {
    id: row.id,
    userId: row.userId,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
  };
}

export class PrismaSessionRepository implements SessionRepository {
  public constructor(
    private readonly client: SessionRepositoryClient = prisma,
  ) {}

  public async create(
    userId: string,
    expiresAt: Date,
  ): Promise<CreatedSession> {
    const token = generateSessionToken();
    const row = await this.client.session.create({
      data: {
        userId,
        tokenHash: token.hash,
        expiresAt,
      },
      select: sessionSelect,
    });

    return { token: token.value, session: toSessionDto(row) };
  }

  public async findActiveByToken(
    token: string,
    now: Date = new Date(),
  ): Promise<SessionDto | null> {
    const tokenHash = hashSessionToken(token);
    const row = await this.client.session.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
        user: { status: "ACTIVE" },
      },
      select: sessionSelect,
    });

    if (row === null || !verifySessionToken(token, row.tokenHash)) {
      return null;
    }

    return toSessionDto(row);
  }

  public async touch(
    sessionId: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const result = await this.client.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { lastSeenAt: now },
    });

    return result.count === 1;
  }

  public async revokeById(
    sessionId: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const result = await this.client.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now },
    });

    return result.count === 1;
  }

  public async revokeAllForUser(
    userId: string,
    now: Date = new Date(),
  ): Promise<number> {
    const result = await this.client.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });

    return result.count;
  }
}

import { MemberRole, Prisma } from "@prisma/client";
import { prisma } from "../client";

const membershipSelect = {
  id: true,
  tenantId: true,
  userId: true,
  role: true,
  status: true,
} as const satisfies Prisma.TenantMembershipSelect;

type MembershipRow = Prisma.TenantMembershipGetPayload<{
  select: typeof membershipSelect;
}>;

type TenantMembershipRepositoryClient = {
  tenantMembership: {
    findMany(args: {
      where: Prisma.TenantMembershipWhereInput;
      orderBy: Prisma.TenantMembershipOrderByWithRelationInput;
      select: typeof membershipSelect;
    }): Promise<MembershipRow[]>;
    findFirst(args: {
      where: Prisma.TenantMembershipWhereInput;
      orderBy: Prisma.TenantMembershipOrderByWithRelationInput;
      select: typeof membershipSelect;
    }): Promise<MembershipRow | null>;
  };
};

export type TenantMembershipScope = Readonly<{
  tenantId?: string;
  userId: string;
}>;

export type TenantMembershipDto = Readonly<{
  id: string;
  tenantId: string;
  userId: string;
  role: MemberRole;
  status: string;
}>;

export interface TenantMembershipRepository {
  resolveForUser(
    scope: TenantMembershipScope,
  ): Promise<readonly TenantMembershipDto[]>;
  resolveForUserAndWedding(input: {
    userId: string;
    weddingId: string;
  }): Promise<TenantMembershipDto | null>;
}

function toMembershipDto(row: MembershipRow): TenantMembershipDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    role: row.role,
    status: row.status,
  };
}

export class PrismaTenantMembershipRepository implements TenantMembershipRepository {
  public constructor(
    private readonly client: TenantMembershipRepositoryClient = prisma,
  ) {}

  public async resolveForUser(
    scope: TenantMembershipScope,
  ): Promise<readonly TenantMembershipDto[]> {
    const rows = await this.client.tenantMembership.findMany({
      where: {
        ...(scope.tenantId === undefined ? {} : { tenantId: scope.tenantId }),
        userId: scope.userId,
        status: "ACTIVE",
        user: { status: "ACTIVE" },
      },
      orderBy: { role: "asc" },
      select: membershipSelect,
    });

    return rows.map(toMembershipDto);
  }

  public async resolveForUserAndWedding(input: {
    userId: string;
    weddingId: string;
  }): Promise<TenantMembershipDto | null> {
    const row = await this.client.tenantMembership.findFirst({
      where: {
        userId: input.userId,
        status: "ACTIVE",
        user: { status: "ACTIVE" },
        tenant: { weddings: { some: { id: input.weddingId } } },
      },
      orderBy: { role: "asc" },
      select: membershipSelect,
    });

    return row === null ? null : toMembershipDto(row);
  }
}

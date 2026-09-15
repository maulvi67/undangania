import { Prisma } from "@prisma/client";
import { prisma } from "../client";

const guestHouseholdSelect = {
  id: true,
  tenantId: true,
  weddingId: true,
  displayName: true,
  maximumPax: true,
  tokenVersion: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.GuestHouseholdSelect;

type GuestHouseholdRow = Prisma.GuestHouseholdGetPayload<{
  select: typeof guestHouseholdSelect;
}>;

type GuestHouseholdRepositoryClient = {
  guestHousehold: {
    findFirst(args: {
      where: Prisma.GuestHouseholdWhereInput;
      select: typeof guestHouseholdSelect;
    }): Promise<GuestHouseholdRow | null>;
    findMany(args: {
      where: Prisma.GuestHouseholdWhereInput;
      orderBy: Prisma.GuestHouseholdOrderByWithRelationInput[];
      select: typeof guestHouseholdSelect;
    }): Promise<GuestHouseholdRow[]>;
    create?(args: {
      data: Prisma.GuestHouseholdUncheckedCreateInput;
      select: typeof guestHouseholdSelect;
    }): Promise<GuestHouseholdRow>;
    updateMany?(args: {
      where: Prisma.GuestHouseholdWhereInput;
      data: Prisma.GuestHouseholdUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
  wedding?: {
    findFirst(args: {
      where: Prisma.WeddingWhereInput;
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
};

export type TenantWeddingScope = Readonly<{
  tenantId: string;
  weddingId: string;
}>;

export type GuestHouseholdDto = Readonly<{
  id: string;
  tenantId: string;
  weddingId: string;
  displayName: string;
  maximumPax: number;
  tokenVersion: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export type GuestHouseholdListOptions = Readonly<{
  status?: string;
}>;

export type GuestHouseholdCreateInput = Readonly<{
  displayName: string;
  tokenHash: string;
  phoneEncrypted?: string | null;
  phoneHash?: string | null;
  emailEncrypted?: string | null;
  emailHash?: string | null;
  maximumPax?: number;
  tokenVersion?: number;
  status?: string;
}>;

export type GuestHouseholdUpdateInput = Readonly<{
  displayName?: string;
  tokenHash?: string;
  phoneEncrypted?: string | null;
  phoneHash?: string | null;
  emailEncrypted?: string | null;
  emailHash?: string | null;
  maximumPax?: number;
  tokenVersion?: number;
  status?: string;
}>;

export interface GuestHouseholdRepository {
  findById(
    scope: TenantWeddingScope,
    householdId: string,
  ): Promise<GuestHouseholdDto | null>;
  list(
    scope: TenantWeddingScope,
    options?: GuestHouseholdListOptions,
  ): Promise<readonly GuestHouseholdDto[]>;
}

export interface GuestHouseholdMutationRepository {
  create(
    scope: TenantWeddingScope,
    input: GuestHouseholdCreateInput,
  ): Promise<GuestHouseholdDto | null>;
  update(
    scope: TenantWeddingScope,
    householdId: string,
    input: GuestHouseholdUpdateInput,
  ): Promise<GuestHouseholdDto | null>;
}

function toGuestHouseholdDto(row: GuestHouseholdRow): GuestHouseholdDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    weddingId: row.weddingId,
    displayName: row.displayName,
    maximumPax: row.maximumPax,
    tokenVersion: row.tokenVersion,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaGuestHouseholdRepository
  implements GuestHouseholdRepository, GuestHouseholdMutationRepository
{
  public constructor(
    private readonly client: GuestHouseholdRepositoryClient = prisma,
  ) {}

  public async create(
    scope: TenantWeddingScope,
    input: GuestHouseholdCreateInput,
  ): Promise<GuestHouseholdDto | null> {
    if (
      this.client.wedding === undefined ||
      this.client.guestHousehold.create === undefined
    ) {
      throw new Error("Guest household mutation client is unavailable");
    }

    const wedding = await this.client.wedding.findFirst({
      where: { id: scope.weddingId, tenantId: scope.tenantId },
      select: { id: true },
    });
    if (wedding === null) return null;

    const row = await this.client.guestHousehold.create({
      data: {
        tenantId: scope.tenantId,
        weddingId: scope.weddingId,
        displayName: input.displayName,
        tokenHash: input.tokenHash,
        ...(input.phoneEncrypted === undefined
          ? {}
          : { phoneEncrypted: input.phoneEncrypted }),
        ...(input.phoneHash === undefined
          ? {}
          : { phoneHash: input.phoneHash }),
        ...(input.emailEncrypted === undefined
          ? {}
          : { emailEncrypted: input.emailEncrypted }),
        ...(input.emailHash === undefined
          ? {}
          : { emailHash: input.emailHash }),
        ...(input.maximumPax === undefined
          ? {}
          : { maximumPax: input.maximumPax }),
        ...(input.tokenVersion === undefined
          ? {}
          : { tokenVersion: input.tokenVersion }),
        ...(input.status === undefined ? {} : { status: input.status }),
      },
      select: guestHouseholdSelect,
    });

    return toGuestHouseholdDto(row);
  }

  public async update(
    scope: TenantWeddingScope,
    householdId: string,
    input: GuestHouseholdUpdateInput,
  ): Promise<GuestHouseholdDto | null> {
    if (this.client.guestHousehold.updateMany === undefined) {
      throw new Error("Guest household mutation client is unavailable");
    }

    const result = await this.client.guestHousehold.updateMany({
      where: {
        id: householdId,
        tenantId: scope.tenantId,
        weddingId: scope.weddingId,
        wedding: { tenantId: scope.tenantId },
      },
      data: {
        ...(input.displayName === undefined
          ? {}
          : { displayName: input.displayName }),
        ...(input.tokenHash === undefined
          ? {}
          : { tokenHash: input.tokenHash }),
        ...(input.phoneEncrypted === undefined
          ? {}
          : { phoneEncrypted: input.phoneEncrypted }),
        ...(input.phoneHash === undefined
          ? {}
          : { phoneHash: input.phoneHash }),
        ...(input.emailEncrypted === undefined
          ? {}
          : { emailEncrypted: input.emailEncrypted }),
        ...(input.emailHash === undefined
          ? {}
          : { emailHash: input.emailHash }),
        ...(input.maximumPax === undefined
          ? {}
          : { maximumPax: input.maximumPax }),
        ...(input.tokenVersion === undefined
          ? {}
          : { tokenVersion: input.tokenVersion }),
        ...(input.status === undefined ? {} : { status: input.status }),
      },
    });

    if (result.count !== 1) return null;
    return this.findById(scope, householdId);
  }

  public async findById(
    scope: TenantWeddingScope,
    householdId: string,
  ): Promise<GuestHouseholdDto | null> {
    const row = await this.client.guestHousehold.findFirst({
      where: {
        id: householdId,
        tenantId: scope.tenantId,
        weddingId: scope.weddingId,
        wedding: { tenantId: scope.tenantId },
      },
      select: guestHouseholdSelect,
    });

    return row === null ? null : toGuestHouseholdDto(row);
  }

  public async list(
    scope: TenantWeddingScope,
    options: GuestHouseholdListOptions = {},
  ): Promise<readonly GuestHouseholdDto[]> {
    const row = await this.client.guestHousehold.findMany({
      where: {
        tenantId: scope.tenantId,
        weddingId: scope.weddingId,
        wedding: { tenantId: scope.tenantId },
        ...(options.status === undefined ? {} : { status: options.status }),
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      select: guestHouseholdSelect,
    });

    return row.map(toGuestHouseholdDto);
  }
}

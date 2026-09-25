import type { Prisma } from "@prisma/client";
import { prisma } from "../client";
import { isPasswordHash } from "../password";
import {
  DEFAULT_WEDDING_DISPLAY_NAME,
  UserAuthInputError,
  type UserAuthRecord,
} from "./user-auth";

const userAuthSelect = {
  id: true,
  email: true,
  passwordHash: true,
  status: true,
  emailVerifiedAt: true,
  mfaEnabled: true,
} as const satisfies Prisma.UserSelect;

const oauthAccountUserSelect = {
  user: { select: userAuthSelect },
} as const satisfies Prisma.OAuthAccountSelect;

type UserAuthRow = Prisma.UserGetPayload<{ select: typeof userAuthSelect }>;
type OAuthAccountUserRow = Prisma.OAuthAccountGetPayload<{
  select: typeof oauthAccountUserSelect;
}>;
type TenantIdRow = Prisma.TenantGetPayload<{
  select: { id: true };
}>;
type WeddingIdRow = Prisma.WeddingGetPayload<{
  select: { id: true };
}>;

type OAuthAccountTransactionClient = Readonly<{
  user: {
    create(args: {
      data: Prisma.UserCreateInput;
      select: typeof userAuthSelect;
    }): Promise<UserAuthRow>;
  };
  tenant: {
    create(args: {
      data: Prisma.TenantCreateInput;
      select: { id: true };
    }): Promise<TenantIdRow>;
  };
  tenantMembership: {
    create(args: {
      data: Prisma.TenantMembershipUncheckedCreateInput;
    }): Promise<{
      id: string;
    }>;
  };
  wedding: {
    create(args: {
      data: Prisma.WeddingUncheckedCreateInput;
      select: { id: true };
    }): Promise<WeddingIdRow>;
  };
  oAuthAccount: {
    create(args: {
      data: Prisma.OAuthAccountUncheckedCreateInput;
    }): Promise<{ id: string }>;
  };
}>;

type OAuthAccountRepositoryClient = OAuthAccountTransactionClient &
  Readonly<{
    oAuthAccount: OAuthAccountTransactionClient["oAuthAccount"] & {
      findUnique(args: {
        where: Prisma.OAuthAccountWhereUniqueInput;
        select: typeof oauthAccountUserSelect;
      }): Promise<OAuthAccountUserRow | null>;
    };
    $transaction<T>(
      work: (client: OAuthAccountTransactionClient) => Promise<T>,
    ): Promise<T>;
  }>;

export type GoogleAccountProvisionInput = Readonly<{
  providerAccountId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  verifiedAt: Date;
}>;

function toUserAuthRecord(row: UserAuthRow): UserAuthRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    status: row.status,
    emailVerifiedAt: row.emailVerifiedAt,
    mfaEnabled: row.mfaEnabled,
  };
}

function normalizeGoogleAccountInput(
  input: GoogleAccountProvisionInput,
): GoogleAccountProvisionInput {
  const email = input.email.trim().replaceAll(/\s+/g, "").toLowerCase();
  const displayName = input.displayName.trim().replaceAll(/\s+/g, " ");

  if (email.length === 0 || email.length > 254 || !email.includes("@")) {
    throw new UserAuthInputError("Email is invalid");
  }
  if (
    input.providerAccountId.length === 0 ||
    input.providerAccountId.length > 255
  ) {
    throw new UserAuthInputError("Provider account id is invalid");
  }
  if (displayName.length === 0 || displayName.length > 150) {
    throw new UserAuthInputError("Display name is invalid");
  }
  if (!isPasswordHash(input.passwordHash)) {
    throw new UserAuthInputError("Password hash is invalid");
  }
  if (Number.isNaN(input.verifiedAt.getTime())) {
    throw new UserAuthInputError("Verification time is invalid");
  }

  return { ...input, email, displayName };
}

export class PrismaOAuthAccountRepository {
  public constructor(
    private readonly client: OAuthAccountRepositoryClient = prisma,
  ) {}

  public async findGoogleUser(
    providerAccountId: string,
  ): Promise<UserAuthRecord | null> {
    const row = await this.client.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "GOOGLE",
          providerAccountId,
        },
      },
      select: oauthAccountUserSelect,
    });

    return row === null ? null : toUserAuthRecord(row.user);
  }

  public async provisionGoogleUser(
    input: GoogleAccountProvisionInput,
  ): Promise<UserAuthRecord> {
    const normalized = normalizeGoogleAccountInput(input);

    return this.client.$transaction(async (transactionClient) => {
      const user = await transactionClient.user.create({
        data: {
          email: normalized.email,
          passwordHash: normalized.passwordHash,
          displayName: normalized.displayName,
          status: "ACTIVE",
          emailVerifiedAt: normalized.verifiedAt,
          mfaEnabled: false,
        },
        select: userAuthSelect,
      });
      const tenant = await transactionClient.tenant.create({
        data: { name: "Workspace pernikahan" },
        select: { id: true },
      });
      await transactionClient.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      await transactionClient.wedding.create({
        data: {
          tenantId: tenant.id,
          displayName: DEFAULT_WEDDING_DISPLAY_NAME,
          status: "DRAFT",
        },
        select: { id: true },
      });
      await transactionClient.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: "GOOGLE",
          providerAccountId: normalized.providerAccountId,
        },
      });

      return toUserAuthRecord(user);
    });
  }
}

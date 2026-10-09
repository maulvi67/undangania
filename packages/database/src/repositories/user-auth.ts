import { Prisma, type MemberRole, type UserStatus } from "@prisma/client";
import { prisma } from "../client";
import { hashPassword } from "../password";

const userAuthSelect = {
  id: true,
  email: true,
  passwordHash: true,
  status: true,
  emailVerifiedAt: true,
  mfaEnabled: true,
} as const satisfies Prisma.UserSelect;

const tenantIdSelect = {
  id: true,
} as const satisfies Prisma.TenantSelect;

const weddingIdSelect = {
  id: true,
} as const satisfies Prisma.WeddingSelect;

type UserAuthRow = Prisma.UserGetPayload<{
  select: typeof userAuthSelect;
}>;

type TenantIdRow = Prisma.TenantGetPayload<{
  select: typeof tenantIdSelect;
}>;

type WeddingIdRow = Prisma.WeddingGetPayload<{
  select: typeof weddingIdSelect;
}>;

type UserAuthUserDelegate = {
  create(args: {
    data: Prisma.UserCreateInput;
    select: typeof userAuthSelect;
  }): Promise<UserAuthRow>;
  findUnique(args: {
    where: Prisma.UserWhereUniqueInput;
    select: typeof userAuthSelect;
  }): Promise<UserAuthRow | null>;
  updateMany(args: {
    where: Prisma.UserWhereInput;
    data: Prisma.UserUpdateManyMutationInput;
  }): Promise<{ count: number }>;
};

type UserAuthTenantDelegate = {
  create(args: {
    data: Prisma.TenantCreateInput;
    select: typeof tenantIdSelect;
  }): Promise<TenantIdRow>;
};

type UserAuthMembershipDelegate = {
  create(args: {
    data: Prisma.TenantMembershipUncheckedCreateInput;
  }): Promise<{ id: string }>;
};

type UserAuthWeddingDelegate = {
  create(args: {
    data: Prisma.WeddingUncheckedCreateInput;
    select: typeof weddingIdSelect;
  }): Promise<WeddingIdRow>;
};

type UserAuthTransactionClient = Readonly<{
  user: UserAuthUserDelegate;
  tenant: UserAuthTenantDelegate;
  tenantMembership: UserAuthMembershipDelegate;
  wedding: UserAuthWeddingDelegate;
}>;

type UserAuthRepositoryClient = UserAuthTransactionClient &
  Readonly<{
    $transaction<T>(
      work: (client: UserAuthTransactionClient) => Promise<T>,
    ): Promise<T>;
  }>;

export type UserAuthRecord = Readonly<{
  id: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  mfaEnabled: boolean;
}>;

export type RegisterUserInput = Readonly<{
  email: string;
  password: string;
  displayName: string;
  tenantName: string;
}>;

/**
 * A newly provisioned account always owns exactly one workspace: a tenant, the
 * owner membership, and the wedding workspace every later step attaches to.
 * Without the wedding row there is nothing for onboarding, the invitation, or an
 * order to reference, so it is created here rather than lazily by the first
 * caller that needs it.
 */
export type RegisteredUserAuth = Readonly<{
  user: UserAuthRecord;
  tenantId: string;
  weddingId: string;
}>;

/**
 * An admin account for the operations console: the user, a dedicated
 * operations tenant, and the ADMIN membership the console checks. No wedding
 * workspace is created — admin accounts never author invitations.
 */
export type ProvisionedAdminAuth = Readonly<{
  user: UserAuthRecord;
  tenantId: string;
}>;

/**
 * Display name for a workspace created before the couple has named anything.
 * Onboarding replaces it with real names; until then it must read as a truthful
 * placeholder rather than invented couple data.
 */
export const DEFAULT_WEDDING_DISPLAY_NAME = "Pernikahan kami";

export class UserAuthRegistrationError extends Error {
  public constructor() {
    super("Unable to register account");
    this.name = "UserAuthRegistrationError";
  }
}

export class UserAuthInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "UserAuthInputError";
  }
}

export interface UserAuthRepository {
  findByEmail(email: string): Promise<UserAuthRecord | null>;
  findById(userId: string): Promise<UserAuthRecord | null>;
  register(input: RegisterUserInput): Promise<RegisteredUserAuth>;
  provisionAdmin(input: RegisterUserInput): Promise<ProvisionedAdminAuth>;
  markEmailVerified(userId: string, verifiedAt?: Date): Promise<boolean>;
  updatePassword(userId: string, password: string): Promise<boolean>;
}

function normalizeEmail(email: string): string {
  return email.trim().replaceAll(/\s+/g, "").toLowerCase();
}

function normalizeDisplayName(displayName: string): string {
  return displayName.trim().replaceAll(/\s+/g, " ");
}

function validateRegistrationInput(input: RegisterUserInput): Readonly<{
  email: string;
  displayName: string;
  tenantName: string;
}> {
  const email = normalizeEmail(input.email);
  const displayName = normalizeDisplayName(input.displayName);
  const tenantName = normalizeDisplayName(input.tenantName);

  if (email.length === 0 || email.length > 254) {
    throw new UserAuthInputError("Email is invalid");
  }
  if (displayName.length === 0 || displayName.length > 150) {
    throw new UserAuthInputError("Display name is invalid");
  }
  if (tenantName.length === 0 || tenantName.length > 150) {
    throw new UserAuthInputError("Tenant name is invalid");
  }
  if (input.password.length === 0 || input.password.length > 200) {
    throw new UserAuthInputError("Password is invalid");
  }

  return { email, displayName, tenantName };
}

function validatePassword(password: string): void {
  if (password.length === 0 || password.length > 200) {
    throw new UserAuthInputError("Password is invalid");
  }
}

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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export class PrismaUserAuthRepository implements UserAuthRepository {
  public constructor(
    private readonly client: UserAuthRepositoryClient = prisma,
  ) {}

  public async findByEmail(email: string): Promise<UserAuthRecord | null> {
    const row = await this.client.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: userAuthSelect,
    });

    return row === null ? null : toUserAuthRecord(row);
  }

  public async findById(userId: string): Promise<UserAuthRecord | null> {
    const row = await this.client.user.findUnique({
      where: { id: userId },
      select: userAuthSelect,
    });

    return row === null ? null : toUserAuthRecord(row);
  }

  public async register(input: RegisterUserInput): Promise<RegisteredUserAuth> {
    const normalized = validateRegistrationInput(input);
    const passwordHash = await hashPassword(input.password);

    try {
      return await this.client.$transaction(async (transactionClient) => {
        const user = await transactionClient.user.create({
          data: {
            email: normalized.email,
            passwordHash,
            displayName: normalized.displayName,
            status: "ACTIVE",
            emailVerifiedAt: null,
            mfaEnabled: false,
          },
          select: userAuthSelect,
        });
        const tenant = await transactionClient.tenant.create({
          data: { name: normalized.tenantName },
          select: tenantIdSelect,
        });
        await transactionClient.tenantMembership.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            role: "OWNER" satisfies MemberRole,
            status: "ACTIVE",
          },
        });
        const wedding = await transactionClient.wedding.create({
          data: {
            tenantId: tenant.id,
            displayName: DEFAULT_WEDDING_DISPLAY_NAME,
            status: "DRAFT",
          },
          select: weddingIdSelect,
        });

        return {
          user: toUserAuthRecord(user),
          tenantId: tenant.id,
          weddingId: wedding.id,
        };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new UserAuthRegistrationError();
      }
      throw error;
    }
  }

  /**
   * Creates an ADMIN account for the operations console. Shares the register
   * input shape because the fields are identical; the difference is the role
   * and the absence of a wedding workspace. Unique-email conflicts surface as
   * `UserAuthRegistrationError`, exactly like `register`.
   */
  public async provisionAdmin(
    input: RegisterUserInput,
  ): Promise<ProvisionedAdminAuth> {
    const normalized = validateRegistrationInput(input);
    const passwordHash = await hashPassword(input.password);

    try {
      return await this.client.$transaction(async (transactionClient) => {
        const user = await transactionClient.user.create({
          data: {
            email: normalized.email,
            passwordHash,
            displayName: normalized.displayName,
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
            mfaEnabled: false,
          },
          select: userAuthSelect,
        });
        const tenant = await transactionClient.tenant.create({
          data: { name: normalized.tenantName },
          select: tenantIdSelect,
        });
        await transactionClient.tenantMembership.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            role: "ADMIN" satisfies MemberRole,
            status: "ACTIVE",
          },
        });

        return {
          user: toUserAuthRecord(user),
          tenantId: tenant.id,
        };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new UserAuthRegistrationError();
      }
      throw error;
    }
  }

  public async markEmailVerified(
    userId: string,
    verifiedAt: Date = new Date(),
  ): Promise<boolean> {
    const result = await this.client.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: verifiedAt },
    });

    return result.count === 1;
  }

  public async updatePassword(
    userId: string,
    password: string,
  ): Promise<boolean> {
    validatePassword(password);
    const passwordHash = await hashPassword(password);
    const result = await this.client.user.updateMany({
      where: { id: userId },
      data: { passwordHash },
    });

    return result.count === 1;
  }
}

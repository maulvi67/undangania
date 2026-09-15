import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { verifyPassword } from "../password";
import {
  PrismaUserAuthRepository,
  UserAuthRegistrationError,
} from "./user-auth";

const authRow = {
  id: "user-1",
  email: "rani@example.com",
  passwordHash:
    "$scrypt$v=1$N=16384,r=8,p=1$aaaaaaaaaaaaaaaaaaaaaa$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  status: "ACTIVE" as const,
  emailVerifiedAt: null,
  mfaEnabled: false,
};

const tenant = { id: "tenant-1" };

describe("PrismaUserAuthRepository", () => {
  it("finds by normalized email and returns only the safe auth record", async () => {
    const findUnique = vi.fn().mockResolvedValue(authRow);
    const repository = new PrismaUserAuthRepository({
      user: { findUnique, create: vi.fn(), updateMany: vi.fn() },
      tenant: { create: vi.fn() },
      tenantMembership: { create: vi.fn() },
      $transaction: vi.fn(),
    });

    await expect(
      repository.findByEmail("  RANI @ EXAMPLE.COM "),
    ).resolves.toEqual(authRow);
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: "rani@example.com" },
      select: expect.objectContaining({
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        emailVerifiedAt: true,
        mfaEnabled: true,
      }),
    });
  });

  it("finds by id without exposing unrelated user fields", async () => {
    const findUnique = vi.fn().mockResolvedValue(authRow);
    const repository = new PrismaUserAuthRepository({
      user: { findUnique, create: vi.fn(), updateMany: vi.fn() },
      tenant: { create: vi.fn() },
      tenantMembership: { create: vi.fn() },
      $transaction: vi.fn(),
    });

    await expect(repository.findById("user-1")).resolves.toEqual(authRow);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: expect.objectContaining({ passwordHash: true }),
    });
  });

  it("provisions user, tenant, and owner membership in one transaction", async () => {
    const userCreate = vi.fn().mockResolvedValue({
      ...authRow,
      email: "rani@example.com",
    });
    const tenantCreate = vi.fn().mockResolvedValue(tenant);
    const membershipCreate = vi.fn().mockResolvedValue({ id: "membership-1" });
    type UserAuthClient = NonNullable<
      ConstructorParameters<typeof PrismaUserAuthRepository>[0]
    >;
    type TransactionWork = Parameters<UserAuthClient["$transaction"]>[0];
    type TransactionClient = Parameters<TransactionWork>[0];
    let transactionCalls = 0;
    const transactionImplementation: UserAuthClient["$transaction"] = async <T>(
      work: (client: TransactionClient) => Promise<T>,
    ): Promise<T> => {
      transactionCalls += 1;
      return work({
        user: {
          create: userCreate,
          findUnique: vi.fn(),
          updateMany: vi.fn(),
        },
        tenant: { create: tenantCreate },
        tenantMembership: { create: membershipCreate },
      });
    };
    const repository = new PrismaUserAuthRepository({
      user: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
      tenant: { create: vi.fn() },
      tenantMembership: { create: vi.fn() },
      $transaction: transactionImplementation,
    });

    const result = await repository.register({
      email: "  RANI @ EXAMPLE.COM ",
      password: "correct horse battery staple",
      displayName: "  Rani   Pratama ",
      tenantName: "  Rani   Workspace ",
    });

    expect(result).toMatchObject({
      user: {
        id: "user-1",
        email: "rani@example.com",
      },
      tenantId: "tenant-1",
    });
    expect(transactionCalls).toBe(1);
    expect(userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "rani@example.com",
        displayName: "Rani Pratama",
        status: "ACTIVE",
        emailVerifiedAt: null,
        mfaEnabled: false,
      }),
      select: expect.anything(),
    });
    const userData = userCreate.mock.calls[0]?.[0].data as {
      passwordHash: string;
    };
    await expect(
      verifyPassword("correct horse battery staple", userData.passwordHash),
    ).resolves.toBe(true);
    expect(tenantCreate).toHaveBeenCalledWith({
      data: { name: "Rani Workspace" },
      select: expect.anything(),
    });
    expect(membershipCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        userId: "user-1",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
  });

  it("maps duplicate registration to a generic error", async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "6.0.0" },
    );
    const transaction = vi.fn().mockRejectedValue(duplicate);
    const repository = new PrismaUserAuthRepository({
      user: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
      tenant: { create: vi.fn() },
      tenantMembership: { create: vi.fn() },
      $transaction: transaction,
    });

    await expect(
      repository.register({
        email: "rani@example.com",
        password: "correct horse battery staple",
        displayName: "Rani",
        tenantName: "Rani Workspace",
      }),
    ).rejects.toBeInstanceOf(UserAuthRegistrationError);
    await expect(
      repository.register({
        email: "rani@example.com",
        password: "correct horse battery staple",
        displayName: "Rani",
        tenantName: "Rani Workspace",
      }),
    ).rejects.toThrow("Unable to register account");
  });

  it("marks verification once and hashes password updates", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new PrismaUserAuthRepository({
      user: { findUnique: vi.fn(), create: vi.fn(), updateMany },
      tenant: { create: vi.fn() },
      tenantMembership: { create: vi.fn() },
      $transaction: vi.fn(),
    });
    const verifiedAt = new Date("2026-09-14T00:00:00.000Z");

    await expect(
      repository.markEmailVerified("user-1", verifiedAt),
    ).resolves.toBe(true);
    await expect(
      repository.updatePassword("user-1", "new secure password"),
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "user-1", emailVerifiedAt: null },
      data: { emailVerifiedAt: verifiedAt },
    });
    const passwordUpdate = updateMany.mock.calls[1]?.[0].data as {
      passwordHash: string;
    };
    await expect(
      verifyPassword("new secure password", passwordUpdate.passwordHash),
    ).resolves.toBe(true);
  });
});

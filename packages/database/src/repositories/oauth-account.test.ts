import { beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "../password";
import { PrismaOAuthAccountRepository } from "./oauth-account";

const user = {
  id: "user-1",
  email: "rani@example.com",
  passwordHash:
    "$scrypt$v=1$N=16384,r=8,p=1$aaaaaaaaaaaaaaaaaaaaaa$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  status: "ACTIVE" as const,
  emailVerifiedAt: new Date("2026-09-25T00:00:00.000Z"),
  mfaEnabled: false,
};
let validPasswordHash = "";

beforeAll(async () => {
  validPasswordHash = await hashPassword("OAuth-only random credential");
});

describe("PrismaOAuthAccountRepository", () => {
  it("looks up Google identity by provider subject and selects only auth fields", async () => {
    const findUnique = vi.fn().mockResolvedValue({ user });
    const repository = new PrismaOAuthAccountRepository({
      oAuthAccount: { findUnique, create: vi.fn() },
      user: { create: vi.fn() },
      tenant: { create: vi.fn() },
      tenantMembership: { create: vi.fn() },
      wedding: { create: vi.fn() },
      $transaction: vi.fn(),
    });

    await expect(repository.findGoogleUser("google-sub-1")).resolves.toEqual(
      user,
    );
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        provider_providerAccountId: {
          provider: "GOOGLE",
          providerAccountId: "google-sub-1",
        },
      },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            passwordHash: true,
            status: true,
            emailVerifiedAt: true,
            mfaEnabled: true,
          },
        },
      },
    });
  });

  it("provisions a verified customer and Google identity in one transaction", async () => {
    const userCreate = vi.fn().mockResolvedValue(user);
    const tenantCreate = vi.fn().mockResolvedValue({ id: "tenant-1" });
    const membershipCreate = vi.fn().mockResolvedValue({ id: "membership-1" });
    const weddingCreate = vi.fn().mockResolvedValue({ id: "wedding-1" });
    const oauthCreate = vi.fn().mockResolvedValue({ id: "oauth-1" });
    type RepositoryClient = NonNullable<
      ConstructorParameters<typeof PrismaOAuthAccountRepository>[0]
    >;
    type TransactionWork = Parameters<RepositoryClient["$transaction"]>[0];
    type TransactionClient = Parameters<TransactionWork>[0];
    let transactionCalls = 0;
    const transactionImplementation: RepositoryClient["$transaction"] = async <
      T,
    >(
      work: (client: TransactionClient) => Promise<T>,
    ): Promise<T> => {
      transactionCalls += 1;
      return work({
        user: { create: userCreate },
        tenant: { create: tenantCreate },
        tenantMembership: { create: membershipCreate },
        wedding: { create: weddingCreate },
        oAuthAccount: { create: oauthCreate },
      });
    };
    const repository = new PrismaOAuthAccountRepository({
      oAuthAccount: { findUnique: vi.fn(), create: oauthCreate },
      user: { create: userCreate },
      tenant: { create: tenantCreate },
      tenantMembership: { create: membershipCreate },
      wedding: { create: weddingCreate },
      $transaction: transactionImplementation,
    });

    const result = await repository.provisionGoogleUser({
      providerAccountId: "google-sub-1",
      email: "  RANI @ EXAMPLE.COM ",
      displayName: "  Rani   Pratama ",
      passwordHash: validPasswordHash,
      verifiedAt: user.emailVerifiedAt,
    });

    expect(result).toEqual(user);
    expect(transactionCalls).toBe(1);
    expect(userCreate).toHaveBeenCalledWith({
      data: {
        email: "rani@example.com",
        passwordHash: validPasswordHash,
        displayName: "Rani Pratama",
        status: "ACTIVE",
        emailVerifiedAt: user.emailVerifiedAt,
        mfaEnabled: false,
      },
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
    expect(weddingCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        displayName: "Pernikahan kami",
        status: "DRAFT",
      },
      select: expect.anything(),
    });
    expect(oauthCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        provider: "GOOGLE",
        providerAccountId: "google-sub-1",
      },
    });
    expect(userCreate.mock.invocationCallOrder[0]).toBeLessThan(
      tenantCreate.mock.invocationCallOrder[0] ?? 0,
    );
    expect(weddingCreate.mock.invocationCallOrder[0]).toBeLessThan(
      oauthCreate.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("rejects malformed hashes before opening a transaction", async () => {
    const transaction = vi.fn();
    const repository = new PrismaOAuthAccountRepository({
      oAuthAccount: { findUnique: vi.fn(), create: vi.fn() },
      user: { create: vi.fn() },
      tenant: { create: vi.fn() },
      tenantMembership: { create: vi.fn() },
      wedding: { create: vi.fn() },
      $transaction: transaction,
    });

    await expect(
      repository.provisionGoogleUser({
        providerAccountId: "google-sub-1",
        email: "rani@example.com",
        displayName: "Rani",
        passwordHash: "not-a-password-hash",
        verifiedAt: user.emailVerifiedAt,
      }),
    ).rejects.toThrow("Password hash is invalid");
    expect(transaction).not.toHaveBeenCalled();
  });
});

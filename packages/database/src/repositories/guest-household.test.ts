import { describe, expect, it, vi } from "vitest";
import { PrismaGuestHouseholdRepository } from "./guest-household";

const row = {
  id: "household-1",
  tenantId: "tenant-1",
  weddingId: "wedding-1",
  displayName: "Keluarga A",
  maximumPax: 3,
  tokenVersion: 1,
  status: "ACTIVE",
  createdAt: new Date("2026-09-14T00:00:00.000Z"),
  updatedAt: new Date("2026-09-14T00:00:00.000Z"),
};

describe("PrismaGuestHouseholdRepository", () => {
  it("requires tenant and wedding parent scope for a household lookup", async () => {
    const findFirst = vi.fn().mockResolvedValue(row);
    const repository = new PrismaGuestHouseholdRepository({
      guestHousehold: { findFirst, findMany: vi.fn() },
    });

    await expect(
      repository.findById(
        { tenantId: "tenant-1", weddingId: "wedding-1" },
        "household-1",
      ),
    ).resolves.toEqual(row);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "household-1",
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        wedding: { tenantId: "tenant-1" },
      },
      select: expect.not.objectContaining({
        tokenHash: true,
        phoneEncrypted: true,
        emailEncrypted: true,
      }),
    });
  });

  it("lists only the requested tenant and wedding and returns safe DTOs", async () => {
    const findMany = vi.fn().mockResolvedValue([row]);
    const repository = new PrismaGuestHouseholdRepository({
      guestHousehold: { findFirst: vi.fn(), findMany },
    });

    const result = await repository.list(
      { tenantId: "tenant-1", weddingId: "wedding-1" },
      { status: "ACTIVE" },
    );

    expect(result).toEqual([row]);
    expect(result[0]).not.toHaveProperty("tokenHash");
    expect(result[0]).not.toHaveProperty("phoneHash");
    expect(result[0]).not.toHaveProperty("emailHash");
    expect(findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        wedding: { tenantId: "tenant-1" },
        status: "ACTIVE",
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      select: expect.not.objectContaining({
        tokenHash: true,
        phoneEncrypted: true,
        emailEncrypted: true,
      }),
    });
  });

  it("creates only under a wedding owned by the requested tenant", async () => {
    const weddingFindFirst = vi.fn().mockResolvedValue({ id: "wedding-1" });
    const create = vi.fn().mockResolvedValue(row);
    const repository = new PrismaGuestHouseholdRepository({
      wedding: { findFirst: weddingFindFirst },
      guestHousehold: { findFirst: vi.fn(), findMany: vi.fn(), create },
    });

    await expect(
      repository.create(
        { tenantId: "tenant-1", weddingId: "wedding-1" },
        {
          displayName: "Keluarga A",
          tokenHash: "token-hash",
          phoneHash: "phone-hash",
          emailHash: "email-hash",
        },
      ),
    ).resolves.toEqual(row);

    expect(weddingFindFirst).toHaveBeenCalledWith({
      where: { id: "wedding-1", tenantId: "tenant-1" },
      select: { id: true },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        displayName: "Keluarga A",
        tokenHash: "token-hash",
        phoneHash: "phone-hash",
        emailHash: "email-hash",
      },
      select: expect.not.objectContaining({
        tokenHash: true,
        phoneEncrypted: true,
        emailEncrypted: true,
      }),
    });
  });

  it("rejects create when the wedding belongs to another tenant", async () => {
    const weddingFindFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn();
    const repository = new PrismaGuestHouseholdRepository({
      wedding: { findFirst: weddingFindFirst },
      guestHousehold: { findFirst: vi.fn(), findMany: vi.fn(), create },
    });

    await expect(
      repository.create(
        { tenantId: "tenant-a", weddingId: "wedding-b" },
        { displayName: "Keluarga B", tokenHash: "token-hash" },
      ),
    ).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("updates only the requested tenant and wedding and returns a safe DTO", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findFirst = vi.fn().mockResolvedValue(row);
    const repository = new PrismaGuestHouseholdRepository({
      guestHousehold: { findFirst, findMany: vi.fn(), updateMany },
    });

    await expect(
      repository.update(
        { tenantId: "tenant-1", weddingId: "wedding-1" },
        "household-1",
        { displayName: "Keluarga A Updated", tokenVersion: 2 },
      ),
    ).resolves.toEqual(row);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "household-1",
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        wedding: { tenantId: "tenant-1" },
      },
      data: { displayName: "Keluarga A Updated", tokenVersion: 2 },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "household-1",
        tenantId: "tenant-1",
        weddingId: "wedding-1",
        wedding: { tenantId: "tenant-1" },
      },
      select: expect.not.objectContaining({
        tokenHash: true,
        phoneEncrypted: true,
        emailEncrypted: true,
      }),
    });
  });

  it("does not update a household outside the requested tenant scope", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findFirst = vi.fn();
    const repository = new PrismaGuestHouseholdRepository({
      guestHousehold: { findFirst, findMany: vi.fn(), updateMany },
    });

    await expect(
      repository.update(
        { tenantId: "tenant-a", weddingId: "wedding-a" },
        "household-b",
        { displayName: "Should not update" },
      ),
    ).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});

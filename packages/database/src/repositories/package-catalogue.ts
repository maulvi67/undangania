import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";

/**
 * Package and price catalogue synchronisation.
 *
 * Checkout resolves a sellable price by `Package.code`; without a row there, every
 * purchase fails as "not available". Designs are authored as in-repo fixtures and
 * reach the database through `PrismaTemplateCatalogueRepository`, so the price for a
 * design has to be persisted the same way: as product content that follows the
 * release, not as a migration.
 *
 * `checkout.ts` reads `Package.code` and requires `status === "ACTIVE"` plus a
 * non-expired `Price` in the requested currency. This module guarantees exactly
 * that, and is idempotent so it is safe to call on a request path.
 *
 * `Package.limits` and `Price.billingPeriod` are written explicitly: `limits` is a
 * required JSON column and would otherwise fail the insert, and a purchase here is
 * one-off, so a null billing period is the correct statement rather than a guess.
 */

const ONE_OFF_BILLING_PERIOD = null;

const packageRowSelect = {
  id: true,
  code: true,
  status: true,
} as const satisfies Prisma.PackageSelect;

type PackageRow = Prisma.PackageGetPayload<{ select: typeof packageRowSelect }>;

type PackageCatalogueClient = Readonly<{
  package: {
    upsert(args: {
      where: Prisma.PackageWhereUniqueInput;
      create: Prisma.PackageUncheckedCreateInput;
      update: Prisma.PackageUncheckedUpdateInput;
      select: typeof packageRowSelect;
    }): Promise<PackageRow>;
  };
  price: {
    findFirst(args: {
      where: Prisma.PriceWhereInput;
      select: { id: true; amountMinor: true };
    }): Promise<{ id: string; amountMinor: bigint } | null>;
    create(args: {
      data: Prisma.PriceUncheckedCreateInput;
      select: { id: true };
    }): Promise<{ id: string }>;
    updateMany(args: {
      where: Prisma.PriceWhereInput;
      data: Prisma.PriceUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
}>;

export function adaptPackageCatalogueClient(
  client: Pick<PrismaClient, "package" | "price">,
): PackageCatalogueClient {
  return {
    package: {
      upsert: (args) => client.package.upsert(args),
    },
    price: {
      findFirst: (args) => client.price.findFirst(args),
      create: (args) => client.price.create(args),
      updateMany: (args) => client.price.updateMany(args),
    },
  };
}

export type PackageCatalogueEntry = Readonly<{
  /** Matches `Template.id`, which is what checkout passes as `productCode`. */
  code: string;
  name: string;
  /** `"ACTIVE"` is what makes the package sellable. */
  status: string;
  /** Whole IDR rupiah, converted to minor units on write. */
  priceIdr: number;
  currency: string;
  /** Effective from, inclusive. */
  activeFrom: Date;
}>;

export type PackagePriceSyncResult = Readonly<{
  packageId: string;
  priceId: string;
  /** True when a new price row was inserted on this call. */
  created: boolean;
}>;

export class PackageCatalogueInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PackageCatalogueInputError";
  }
}

function assertSyncable(entry: PackageCatalogueEntry): void {
  if (entry.code.trim().length === 0) {
    throw new PackageCatalogueInputError("Package code is required");
  }
  if (!Number.isInteger(entry.priceIdr) || entry.priceIdr <= 0) {
    throw new PackageCatalogueInputError(
      "Package price must be a positive integer in rupiah",
    );
  }
  if (!/^[A-Z]{3}$/.test(entry.currency)) {
    throw new PackageCatalogueInputError(
      "Currency must be a three-letter uppercase code",
    );
  }
}

/** IDR has no minor unit in practice, but the column is minor units. */
export function toMinorUnits(priceIdr: number): bigint {
  return BigInt(priceIdr) * 100n;
}

export class PrismaPackageCatalogueRepository {
  public constructor(
    private readonly client: PackageCatalogueClient = adaptPackageCatalogueClient(
      prisma,
    ),
  ) {}

  public async syncPrice(
    entry: PackageCatalogueEntry,
    now: Date = new Date(),
  ): Promise<PackagePriceSyncResult> {
    assertSyncable(entry);

    const amountMinor = toMinorUnits(entry.priceIdr);
    const record = await this.client.package.upsert({
      where: { code: entry.code },
      create: {
        code: entry.code,
        name: entry.name,
        status: entry.status,
        // `limits` is a required JSON column with no default; the entitlement
        // figures live in the entitlement tables, so an empty object is the honest
        // value rather than a made-up quota.
        limits: {},
      },
      // `code` is the identity and is never rewritten.
      update: { name: entry.name, status: entry.status },
      select: packageRowSelect,
    });

    const existing = await this.client.price.findFirst({
      where: {
        packageId: record.id,
        currency: entry.currency,
        amountMinor,
        activeUntil: null,
      },
      select: { id: true, amountMinor: true },
    });
    if (existing !== null) {
      return { packageId: record.id, priceId: existing.id, created: false };
    }

    // A price change is expressed as a new row rather than an edit, so an order
    // placed against the old figure keeps describing what was actually charged.
    // The superseded rows are closed off first so only one price is live.
    await this.client.price.updateMany({
      where: {
        packageId: record.id,
        currency: entry.currency,
        activeUntil: null,
        activeFrom: { lt: entry.activeFrom },
      },
      data: { activeUntil: now },
    });

    const created = await this.client.price.create({
      data: {
        packageId: record.id,
        currency: entry.currency,
        amountMinor,
        billingPeriod: ONE_OFF_BILLING_PERIOD,
        activeFrom: entry.activeFrom,
      },
      select: { id: true },
    });

    return { packageId: record.id, priceId: created.id, created: true };
  }
}

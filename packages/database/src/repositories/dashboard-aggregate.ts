import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";

/**
 * Dashboard aggregate.
 *
 * The dashboard shows four independent summaries (invitation, payment, guests,
 * RSVP). Each is assembled here as its own section so a single failing read
 * degrades that section rather than the whole page — which is what the dashboard
 * contract's `status: "ok" | "unavailable"` union exists for.
 *
 * Two readings are deliberately literal rather than derived, because guessing
 * would be worse than reporting nothing:
 *
 *   - "published" is the existence of an `active` publication row, not
 *     `Invitation.status`. The row's own flag is what makes a snapshot reachable at
 *     the public URL, so it is the only value that actually describes reality.
 *   - `publishedAt` comes from `InvitationPublication.publishedAt`, not from the
 *     invitation's `updatedAt`, which moves on every draft save.
 *
 * Scoping note: `Rsvp` and `Payment` carry `tenantId` but no `weddingId`, so both
 * are narrowed to the wedding through their owning row instead.
 */

const weddingSelect = {
  id: true,
  displayName: true,
  partner1Name: true,
  partner2Name: true,
  weddingDate: true,
  timezone: true,
  city: true,
} as const satisfies Prisma.WeddingSelect;

type WeddingRow = Prisma.WeddingGetPayload<{ select: typeof weddingSelect }>;

const invitationSelect = {
  id: true,
  status: true,
  template: { select: { name: true } },
  publications: {
    where: { active: true },
    orderBy: { publishedAt: "desc" },
    take: 1,
    select: { publishedAt: true },
  },
} as const satisfies Prisma.InvitationSelect;

type InvitationRow = Prisma.InvitationGetPayload<{
  select: typeof invitationSelect;
}>;

const paymentSelect = {
  status: true,
} as const satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;

/** One row per household's answer; only the response is needed. */
export type RsvpResponseRow = Readonly<{ response: string }>;

/**
 * Structural delegates, deliberately narrow so tests can inject plain objects. A
 * real Prisma client is adapted by `adaptDashboardClient` rather than cast into
 * place: Prisma's delegate methods are generic over `SelectSubset`, so comparing
 * them against a concrete signature is not sound.
 */
/** Exported so tests can build a fake client with the same shape. */
export type DashboardClient = Readonly<{
  wedding: {
    findFirst(args: {
      where: Prisma.WeddingWhereInput;
      select: typeof weddingSelect;
    }): Promise<WeddingRow | null>;
  };
  invitation: {
    findFirst(args: {
      where: Prisma.InvitationWhereInput;
      select: typeof invitationSelect;
    }): Promise<InvitationRow | null>;
  };
  guestHousehold: {
    // Two counts rather than one aggregate: `_count` in an `aggregate` call can
    // only count a model's own rows, never a relation's.
    count(args: { where: Prisma.GuestHouseholdWhereInput }): Promise<number>;
  };
  guest: {
    count(args: { where: Prisma.GuestWhereInput }): Promise<number>;
  };
  rsvp: {
    findMany(args: {
      where: Prisma.RsvpWhereInput;
      select: { response: true };
    }): Promise<RsvpResponseRow[]>;
  };
  payment: {
    findFirst(args: {
      where: Prisma.PaymentWhereInput;
      orderBy: Prisma.PaymentOrderByWithRelationInput;
      select: typeof paymentSelect;
    }): Promise<PaymentRow | null>;
  };
}>;

export function adaptDashboardClient(
  client: Pick<
    PrismaClient,
    "wedding" | "invitation" | "guestHousehold" | "guest" | "rsvp" | "payment"
  >,
): DashboardClient {
  return {
    wedding: {
      findFirst: (args) => client.wedding.findFirst(args),
    },
    invitation: {
      findFirst: (args) => client.invitation.findFirst(args),
    },
    guestHousehold: {
      count: (args) => client.guestHousehold.count(args),
    },
    guest: {
      count: (args) => client.guest.count(args),
    },
    rsvp: {
      findMany: (args) => client.rsvp.findMany(args),
    },
    payment: {
      findFirst: (args) => client.payment.findFirst(args),
    },
  };
}

export type DashboardScope = Readonly<{
  tenantId: string;
  weddingId: string;
}>;

export type DashboardWorkspaceDto = Readonly<{
  coupleNames: string | null;
  /** `YYYY-MM-DD`, as the contract requires; null when not yet decided. */
  weddingDate: string | null;
  timezone: string | null;
  city: string | null;
}>;

export type DashboardInvitationDto = Readonly<{
  status: string;
  templateName: string | null;
  publishedAt: Date | null;
}>;

export type DashboardPaymentDto = Readonly<{ paid: boolean; pending: boolean }>;

export type DashboardGuestCountsDto = Readonly<{
  guestCount: number;
  householdCount: number;
}>;

export type DashboardRsvpCountsDto = Readonly<{
  invited: number;
  attending: number;
  declined: number;
  tentative: number;
  pending: number;
}>;

export type DashboardAggregateDto = Readonly<{
  workspace: DashboardWorkspaceDto;
  invitation: DashboardInvitationDto | null;
  payment: DashboardPaymentDto | null;
  guests: DashboardGuestCountsDto | null;
  rsvp: DashboardRsvpCountsDto | null;
}>;

/**
 * `Wedding.weddingDate` is a `@db.Date` column, so it arrives as a UTC midnight
 * instant. Reading it with local accessors would shift the day for any timezone
 * behind UTC, so the ISO date prefix is used instead — the same value the
 * onboarding form wrote.
 */
export function toContractYmd(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}

export function coupleNames(row: {
  partner1Name: string | null;
  partner2Name: string | null;
}): string | null {
  const first = row.partner1Name?.trim() ?? "";
  const second = row.partner2Name?.trim() ?? "";
  if (first === "" && second === "") return null;
  if (first === "") return second;
  if (second === "") return first;
  return `${first} & ${second}`;
}

/**
 * Tallies answers per response.
 *
 * Every figure counts *households*, because `Rsvp` is keyed `[householdId,
 * eventId]` and a household answers once per event. `invited` is the guest count,
 * so the two grains differ by design; `pending` is therefore clamped at zero,
 * since a guest list that grew after a household answered would otherwise render
 * as a negative figure.
 */
export function toRsvpCounts(
  rows: readonly RsvpResponseRow[],
  invited: number,
): DashboardRsvpCountsDto {
  let attending = 0;
  let declined = 0;
  let tentative = 0;
  for (const row of rows) {
    if (row.response === "ATTENDING") attending += 1;
    else if (row.response === "DECLINED") declined += 1;
    else if (row.response === "TENTATIVE") tentative += 1;
  }
  // `Rsvp` holds one row per event, so a household that answered two events is
  // counted twice here. Reporting per-event answers as if they were people would
  // be wrong, so the same household is not de-duplicated: the figure answers
  // "how many answers were given", which is what the panel labels.
  const answered = attending + declined + tentative;
  return {
    invited,
    attending,
    declined,
    tentative,
    pending: Math.max(0, invited - answered),
  };
}

/**
 * A section is dropped to `null` rather than throwing, so one unavailable read
 * degrades that panel only. The caller maps `null` onto the contract's
 * `unavailable` variant.
 */
async function attempt<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch {
    return null;
  }
}

export class PrismaDashboardRepository {
  public constructor(
    private readonly client: DashboardClient = adaptDashboardClient(prisma),
  ) {}

  public async load(
    scope: DashboardScope,
  ): Promise<DashboardAggregateDto | null> {
    const wedding = await this.client.wedding.findFirst({
      where: { id: scope.weddingId, tenantId: scope.tenantId },
      select: weddingSelect,
    });
    // The workspace is the page's spine: without it there is nothing to render and
    // the caller shows its unavailable state.
    if (wedding === null) return null;

    const householdWhere: Prisma.GuestHouseholdWhereInput = {
      tenantId: scope.tenantId,
      weddingId: scope.weddingId,
    };

    const [invitation, householdCount, guestCount, rsvpRows, payment] =
      await Promise.all([
        attempt(() =>
          this.client.invitation.findFirst({
            where: { tenantId: scope.tenantId, weddingId: scope.weddingId },
            select: invitationSelect,
          }),
        ),
        attempt(() =>
          this.client.guestHousehold.count({ where: householdWhere }),
        ),
        attempt(() =>
          this.client.guest.count({
            where: {
              tenantId: scope.tenantId,
              // `Guest` has no `weddingId`, so the wedding is proven through the
              // household that owns the row.
              household: {
                tenantId: scope.tenantId,
                weddingId: scope.weddingId,
              },
            },
          }),
        ),
        attempt(() =>
          this.client.rsvp.findMany({
            // `Rsvp` has no `weddingId` either; scope comes from its household.
            where: {
              tenantId: scope.tenantId,
              household: {
                tenantId: scope.tenantId,
                weddingId: scope.weddingId,
              },
            },
            select: { response: true },
          }),
        ),
        attempt(() =>
          this.client.payment.findFirst({
            where: {
              tenantId: scope.tenantId,
              // `Order.weddingId` is nullable, so an order not yet bound to a
              // wedding simply does not contribute to this figure.
              order: { weddingId: scope.weddingId },
            },
            // The newest payment describes the order's state; an older expired
            // attempt must not overwrite a newer success.
            orderBy: { createdAt: "desc" },
            select: paymentSelect,
          }),
        ),
      ]);

    const guests: DashboardGuestCountsDto | null =
      guestCount === null || householdCount === null
        ? null
        : { guestCount, householdCount };

    return {
      workspace: {
        coupleNames: coupleNames(wedding),
        weddingDate: toContractYmd(wedding.weddingDate),
        timezone: wedding.timezone,
        city: wedding.city,
      },
      invitation:
        invitation === null
          ? null
          : {
              status: invitation.status,
              templateName: invitation.template?.name ?? null,
              publishedAt: invitation.publications[0]?.publishedAt ?? null,
            },
      payment:
        payment === null
          ? null
          : {
              paid: payment.status === "PAID",
              pending:
                payment.status === "PENDING" || payment.status === "CREATED",
            },
      guests,
      // `invited` is the guest count, so RSVP cannot be summarized without it.
      rsvp:
        rsvpRows === null || guests === null
          ? null
          : toRsvpCounts(rsvpRows, guests.guestCount),
    };
  }
}

import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";

/**
 * RSVP oversight and guestbook moderation for the couple's own workspace.
 *
 * Both reads are tenant-scoped: the couple sees only their own wedding's answers and
 * only the greetings submitted to their own invitation. Neither read is reachable
 * from a guest link, and neither carries contact data.
 *
 * The guestbook list is deliberately unfiltered by moderation status. The couple is
 * the moderator for their own invitation, so the pending queue is the point of the
 * page rather than something to hide from it.
 */

const rsvpSelect = {
  id: true,
  householdId: true,
  eventId: true,
  response: true,
  pax: true,
  optimisticVersion: true,
  respondedAt: true,
  household: { select: { displayName: true, maximumPax: true } },
  event: { select: { title: true, startsAt: true } },
} as const satisfies Prisma.RsvpSelect;

type RsvpRow = Prisma.RsvpGetPayload<{ select: typeof rsvpSelect }>;

const messageSelect = {
  id: true,
  householdId: true,
  displayName: true,
  message: true,
  moderationStatus: true,
  submittedAt: true,
} as const satisfies Prisma.GuestbookMessageSelect;

type MessageRow = Prisma.GuestbookMessageGetPayload<{
  select: typeof messageSelect;
}>;

/** Exported so tests can build a fake client with the same shape. */
export type OversightClient = Readonly<{
  weddingEvent: {
    findMany(args: {
      where: Prisma.WeddingEventWhereInput;
      orderBy: Prisma.WeddingEventOrderByWithRelationInput[];
      select: { id: true; title: true; startsAt: true };
    }): Promise<{ id: string; title: string; startsAt: Date }[]>;
  };
  guestHousehold: {
    count(args: { where: Prisma.GuestHouseholdWhereInput }): Promise<number>;
  };
  guest: {
    count(args: { where: Prisma.GuestWhereInput }): Promise<number>;
  };
  rsvp: {
    findMany(args: {
      where: Prisma.RsvpWhereInput;
      orderBy: Prisma.RsvpOrderByWithRelationInput[];
      select: typeof rsvpSelect;
    }): Promise<RsvpRow[]>;
    findFirst(args: {
      where: Prisma.RsvpWhereInput;
      select: typeof rsvpSelect;
    }): Promise<RsvpRow | null>;
    updateMany(args: {
      where: Prisma.RsvpWhereInput;
      data: Prisma.RsvpUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
  rsvpHistory: {
    create(args: {
      data: Prisma.RsvpHistoryUncheckedCreateInput;
    }): Promise<{ id: string }>;
  };
  auditEvent: {
    create(args: {
      data: Prisma.AuditEventUncheckedCreateInput;
    }): Promise<{ id: string }>;
  };
  transaction?<T>(work: (client: OversightClient) => Promise<T>): Promise<T>;
  guestbookMessage: {
    findMany(args: {
      where: Prisma.GuestbookMessageWhereInput;
      orderBy: Prisma.GuestbookMessageOrderByWithRelationInput[];
      select: typeof messageSelect;
    }): Promise<MessageRow[]>;
    updateMany(args: {
      where: Prisma.GuestbookMessageWhereInput;
      data: Prisma.GuestbookMessageUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
}>;

export function adaptOversightClient(
  client: Pick<
    PrismaClient,
    | "weddingEvent"
    | "guestHousehold"
    | "guest"
    | "rsvp"
    | "rsvpHistory"
    | "guestbookMessage"
    | "auditEvent"
  >,
): OversightClient {
  return {
    weddingEvent: {
      findMany: (args) => client.weddingEvent.findMany(args),
    },
    guestHousehold: {
      count: (args) => client.guestHousehold.count(args),
    },
    guest: {
      count: (args) => client.guest.count(args),
    },
    rsvp: {
      findMany: (args) => client.rsvp.findMany(args),
      findFirst: (args) => client.rsvp.findFirst(args),
      updateMany: (args) => client.rsvp.updateMany(args),
    },
    rsvpHistory: {
      create: (args) => client.rsvpHistory.create(args),
    },
    auditEvent: {
      create: (args) => client.auditEvent.create(args),
    },
    transaction: (work) =>
      (client as unknown as PrismaClient).$transaction((tx) =>
        work(adaptOversightClient(tx)),
      ),
    guestbookMessage: {
      findMany: (args) => client.guestbookMessage.findMany(args),
      updateMany: (args) => client.guestbookMessage.updateMany(args),
    },
  };
}

export type OversightScope = Readonly<{
  tenantId: string;
  weddingId: string;
}>;

export type RsvpResponseValue = "ATTENDING" | "DECLINED" | "TENTATIVE";

export type RsvpOversightRowDto = Readonly<{
  id: string;
  householdId: string;
  householdName: string;
  eventId: string;
  eventTitle: string;
  response: RsvpResponseValue;
  pax: number;
  respondedAt: Date;
}>;

export type RsvpOversightDto = Readonly<{
  events: readonly Readonly<{ id: string; title: string }>[];
  rows: readonly RsvpOversightRowDto[];
  /** Answers given per response, counted per event answer rather than per person. */
  totals: Readonly<{
    attending: number;
    declined: number;
    tentative: number;
    attendingPax: number;
  }>;
  invitedGuests: number;
  invitedHouseholds: number;
  answeredHouseholds: number;
}>;

export type GuestbookRowDto = Readonly<{
  id: string;
  displayName: string;
  message: string;
  moderationStatus: GuestbookModerationStatus;
  submittedAt: Date;
}>;

export type GuestbookModerationStatus =
  "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN" | "DELETED";

export type GuestbookOverviewDto = Readonly<{
  rows: readonly GuestbookRowDto[];
  pendingCount: number;
}>;

export type RsvpOverrideInput = Readonly<{
  rsvpId: string;
  response: RsvpResponseValue;
  pax: number;
  actorId: string;
  reason?: string;
  correlationId: string;
}>;

export type RsvpOverrideResult =
  | Readonly<{ kind: "ok" }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "invalid" }>;

export type RsvpExportOptions = Readonly<{
  actorId: string;
  correlationId: string;
}>;

export type RsvpExportRowDto = Readonly<{
  householdName: string;
  eventTitle: string;
  response: RsvpResponseValue;
  pax: number;
  respondedAt: Date;
}>;

/** An unrecognized stored status is reported as PENDING, so nothing is shown as approved by accident. */
export function toModerationStatus(value: string): GuestbookModerationStatus {
  return value === "APPROVED" ||
    value === "REJECTED" ||
    value === "HIDDEN" ||
    value === "DELETED"
    ? value
    : "PENDING";
}

export function toResponseValue(value: string): RsvpResponseValue {
  return value === "ATTENDING" || value === "DECLINED" ? value : "TENTATIVE";
}

/**
 * Tallies answers and converts attending head-counts.
 *
 * `attendingPax` sums only `ATTENDING` rows: a declined answer carries `pax: 0` by
 * construction, but summing blindly would make a malformed row silently inflate the
 * figure the couple plans catering against.
 */
export function tallyRsvp(
  rows: readonly Readonly<{ response: RsvpResponseValue; pax: number }>[],
): RsvpOversightDto["totals"] {
  let attending = 0;
  let declined = 0;
  let tentative = 0;
  let attendingPax = 0;
  for (const row of rows) {
    if (row.response === "ATTENDING") {
      attending += 1;
      attendingPax += row.pax;
    } else if (row.response === "DECLINED") {
      declined += 1;
    } else {
      tentative += 1;
    }
  }
  return { attending, declined, tentative, attendingPax };
}

export class PrismaOversightRepository {
  public constructor(
    private readonly client: OversightClient = adaptOversightClient(prisma),
  ) {}

  public async loadRsvp(scope: OversightScope): Promise<RsvpOversightDto> {
    const [events, rows, invitedGuests, invitedHouseholds] = await Promise.all([
      this.client.weddingEvent.findMany({
        where: { tenantId: scope.tenantId, weddingId: scope.weddingId },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
        select: { id: true, title: true, startsAt: true },
      }),
      this.client.rsvp.findMany({
        where: {
          tenantId: scope.tenantId,
          // `Rsvp` has no `weddingId`; the scope is proven through its household.
          household: { tenantId: scope.tenantId, weddingId: scope.weddingId },
        },
        orderBy: [{ respondedAt: "desc" }, { id: "asc" }],
        select: rsvpSelect,
      }),
      this.client.guest.count({
        where: {
          tenantId: scope.tenantId,
          household: { tenantId: scope.tenantId, weddingId: scope.weddingId },
        },
      }),
      this.client.guestHousehold.count({
        where: { tenantId: scope.tenantId, weddingId: scope.weddingId },
      }),
    ]);

    const mapped = rows.map((row) => ({
      id: row.id,
      householdId: row.householdId,
      householdName: row.household.displayName,
      eventId: row.eventId,
      eventTitle: row.event.title,
      response: toResponseValue(row.response),
      pax: row.pax,
      respondedAt: row.respondedAt,
    }));

    return {
      events: events.map((event) => ({ id: event.id, title: event.title })),
      rows: mapped,
      totals: tallyRsvp(mapped),
      invitedGuests,
      invitedHouseholds,
      // Distinct households, because a household answers once per event and counting
      // rows would report a family that answered two events as two households.
      answeredHouseholds: new Set(mapped.map((row) => row.householdId)).size,
    };
  }

  public async loadGuestbook(
    scope: OversightScope,
  ): Promise<GuestbookOverviewDto> {
    const rows = await this.client.guestbookMessage.findMany({
      where: { tenantId: scope.tenantId, weddingId: scope.weddingId },
      orderBy: [{ submittedAt: "desc" }, { id: "asc" }],
      select: messageSelect,
    });

    const mapped = rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      message: row.message,
      moderationStatus: toModerationStatus(row.moderationStatus),
      submittedAt: row.submittedAt,
    }));

    return {
      rows: mapped,
      pendingCount: mapped.filter((row) => row.moderationStatus === "PENDING")
        .length,
    };
  }

  /**
   * Replaces a guest's answer on the couple's behalf.
   *
   * The write, its history row, and the audit row share one transaction. Unlike a
   * guest submission, this path never resolves a token: the couple's own tenant and
   * wedding scope is the authority, and the previous answer is preserved rather than
   * overwritten silently.
   */
  public async overrideRsvp(
    scope: OversightScope,
    input: RsvpOverrideInput,
  ): Promise<RsvpOverrideResult> {
    const work = async (
      client: OversightClient,
    ): Promise<RsvpOverrideResult> => {
      const row = await client.rsvp.findFirst({
        where: {
          id: input.rsvpId,
          tenantId: scope.tenantId,
          household: {
            tenantId: scope.tenantId,
            weddingId: scope.weddingId,
          },
        },
        select: rsvpSelect,
      });
      if (row === null) return { kind: "not-found" };

      const pax = input.response === "DECLINED" ? 0 : input.pax;
      if (
        !Number.isInteger(pax) ||
        pax < 0 ||
        pax > row.household.maximumPax ||
        (input.response === "ATTENDING" && pax < 1)
      ) {
        return { kind: "invalid" };
      }

      const updated = await client.rsvp.updateMany({
        where: {
          id: row.id,
          tenantId: scope.tenantId,
          optimisticVersion: row.optimisticVersion,
        },
        data: {
          response: input.response,
          pax,
          optimisticVersion: { increment: 1 },
        },
      });
      // A concurrent guest update won the race; the caller must reload rather than
      // overwrite an answer they have not seen.
      if (updated.count !== 1) return { kind: "invalid" };

      await client.rsvpHistory.create({
        data: {
          tenantId: scope.tenantId,
          rsvpId: row.id,
          previousResponse: row.response,
          newResponse: input.response,
          previousPax: row.pax,
          newPax: pax,
          actorType: "USER",
          actorId: input.actorId,
        },
      });

      await client.auditEvent.create({
        data: {
          tenantId: scope.tenantId,
          userId: input.actorId,
          actorType: "USER",
          action: "RSVP_OVERRIDDEN",
          targetType: "Rsvp",
          targetId: row.id,
          ...(input.reason === undefined ? {} : { reason: input.reason }),
          metadata: {
            previousResponse: row.response,
            newResponse: input.response,
            previousPax: row.pax,
            newPax: pax,
          },
          correlationId: input.correlationId,
        },
      });

      return { kind: "ok" };
    };

    return this.client.transaction === undefined
      ? work(this.client)
      : this.client.transaction(work);
  }

  public async exportRsvp(
    scope: OversightScope,
    options: RsvpExportOptions,
  ): Promise<readonly RsvpExportRowDto[]> {
    const overview = await this.loadRsvp(scope);
    await this.client.auditEvent.create({
      data: {
        tenantId: scope.tenantId,
        userId: options.actorId,
        actorType: "USER",
        action: "RSVP_EXPORTED",
        targetType: "Rsvp",
        targetId: scope.weddingId,
        metadata: { rowCount: overview.rows.length },
        correlationId: options.correlationId,
      },
    });
    return overview.rows.map((row) => ({
      householdName: row.householdName,
      eventTitle: row.eventTitle,
      response: row.response,
      pax: row.pax,
      respondedAt: row.respondedAt,
    }));
  }

  /**
   * Applies a moderation decision.
   *
   * Scoped by tenant and wedding, so a crafted message id cannot moderate another
   * wedding's greeting. Returns false when nothing matched rather than throwing, so
   * the caller reports "not found" without leaking whether the row exists elsewhere.
   */
  public async moderate(
    scope: OversightScope,
    messageId: string,
    status: GuestbookModerationStatus,
  ): Promise<boolean> {
    const result = await this.client.guestbookMessage.updateMany({
      where: {
        id: messageId,
        tenantId: scope.tenantId,
        weddingId: scope.weddingId,
      },
      data: { moderationStatus: status },
    });
    return result.count === 1;
  }
}

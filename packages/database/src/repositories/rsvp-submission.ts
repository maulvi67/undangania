import { Prisma, type PrismaClient, type RsvpResponse } from "@prisma/client";
import { prisma } from "../client";

/**
 * RSVP submission.
 *
 * This is the one guest-facing write path, so it is deliberately unlike the
 * tenant-scoped repositories in this package: the caller has no session, and the
 * only thing that establishes scope is a household id that was resolved from a
 * verified personalized-link token. There is therefore no `tenantId` parameter —
 * the tenant is read *from* the household rather than asserted alongside it, which
 * removes the possibility of a caller pairing a household with the wrong tenant.
 *
 * Three invariants are enforced here rather than in a route handler, because all
 * three need the database to answer:
 *
 *   - the event must belong to the household's own wedding, so a guessed event id
 *     from another wedding cannot be answered;
 *   - `pax` is bounded by the household's current `maximumPax`, re-read inside the
 *     transaction so a concurrent edit to the allowance is respected;
 *   - an update carrying an `expectedVersion` only commits if that version is
 *     still current, which is what makes two devices editing at once produce a
 *     visible conflict instead of a silent overwrite.
 *
 * Every accepted change appends to `RsvpHistory` and writes an `AuditEvent`, and
 * the submission as a whole records one `OutboxEvent` keyed by the caller's
 * idempotency key. That outbox row is also the replay guard: a retry with a key
 * already committed returns the stored answers instead of writing a second time.
 */

/** What a single event's answer must satisfy, per the RSVP domain rules. */
export const RSVP_MAX_PAX_CEILING = 20;

export type RsvpValidationFailure =
  "EMPTY_SUBMISSION" | "UNKNOWN_EVENT" | "PAX_OUT_OF_RANGE" | "DUPLICATE_EVENT";

export type RsvpSubmittedAnswer = Readonly<{
  eventId: string;
  response: RsvpResponse;
  pax: number;
  optimisticVersion: number;
}>;

export type RsvpSubmitInput = Readonly<{
  /** Resolved from a verified token; never accepted from a request body. */
  householdId: string;
  updates: readonly Readonly<{
    eventId: string;
    response: RsvpResponse;
    pax: number;
    expectedVersion: number | null;
  }>[];
  idempotencyKey: string;
  actorId?: string | null;
}>;

export type RsvpSubmitResult =
  | Readonly<{ kind: "success"; answers: readonly RsvpSubmittedAnswer[] }>
  | Readonly<{ kind: "replayed"; answers: readonly RsvpSubmittedAnswer[] }>
  | Readonly<{ kind: "stale"; eventId: string }>
  | Readonly<{ kind: "invalid"; reason: RsvpValidationFailure }>
  | Readonly<{ kind: "not-found" }>;

export type RsvpHouseholdDto = Readonly<{
  householdId: string;
  tenantId: string;
  weddingId: string;
  maximumPax: number;
  status: string;
}>;

const householdSelect = {
  id: true,
  tenantId: true,
  weddingId: true,
  maximumPax: true,
  status: true,
} as const satisfies Prisma.GuestHouseholdSelect;

type HouseholdRow = Prisma.GuestHouseholdGetPayload<{
  select: typeof householdSelect;
}>;

const rsvpSelect = {
  id: true,
  eventId: true,
  response: true,
  pax: true,
  optimisticVersion: true,
} as const satisfies Prisma.RsvpSelect;

type RsvpRow = Prisma.RsvpGetPayload<{ select: typeof rsvpSelect }>;

/**
 * Structural delegates, deliberately narrow so tests can inject plain objects. A
 * real Prisma client is adapted by `adaptRsvpSubmissionClient` rather than cast
 * into place: Prisma's delegate methods are generic over `SelectSubset`, so
 * comparing them against a concrete signature is not sound.
 */
export type RsvpSubmissionClient = Readonly<{
  guestHousehold: {
    findFirst(args: {
      where: Prisma.GuestHouseholdWhereInput;
      select: typeof householdSelect;
    }): Promise<HouseholdRow | null>;
  };
  weddingEvent: {
    findMany(args: {
      where: Prisma.WeddingEventWhereInput;
      select: { id: true };
    }): Promise<{ id: string }[]>;
  };
  rsvp: {
    findFirst(args: {
      where: Prisma.RsvpWhereInput;
      select: typeof rsvpSelect;
    }): Promise<RsvpRow | null>;
    findMany(args: {
      where: Prisma.RsvpWhereInput;
      select: typeof rsvpSelect;
    }): Promise<RsvpRow[]>;
    create(args: {
      data: Prisma.RsvpUncheckedCreateInput;
      select: typeof rsvpSelect;
    }): Promise<RsvpRow>;
    updateMany(args: {
      where: Prisma.RsvpWhereInput;
      data: Prisma.RsvpUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
  rsvpHistory: {
    create(args: { data: Prisma.RsvpHistoryUncheckedCreateInput }): Promise<{
      id: string;
    }>;
  };
  outboxEvent: {
    findUnique(args: {
      where: { id: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: { data: Prisma.OutboxEventUncheckedCreateInput }): Promise<{
      id: string;
    }>;
  };
  auditEvent: {
    create(args: { data: Prisma.AuditEventUncheckedCreateInput }): Promise<{
      id: string;
    }>;
  };
}>;

export function adaptRsvpSubmissionClient(
  client: Pick<
    PrismaClient,
    | "guestHousehold"
    | "weddingEvent"
    | "rsvp"
    | "rsvpHistory"
    | "outboxEvent"
    | "auditEvent"
  >,
): RsvpSubmissionClient {
  return {
    guestHousehold: {
      findFirst: (args) => client.guestHousehold.findFirst(args),
    },
    weddingEvent: {
      findMany: (args) => client.weddingEvent.findMany(args),
    },
    rsvp: {
      findFirst: (args) => client.rsvp.findFirst(args),
      findMany: (args) => client.rsvp.findMany(args),
      create: (args) => client.rsvp.create(args),
      updateMany: (args) => client.rsvp.updateMany(args),
    },
    rsvpHistory: {
      create: (args) => client.rsvpHistory.create(args),
    },
    outboxEvent: {
      findUnique: (args) => client.outboxEvent.findUnique(args),
      create: (args) => client.outboxEvent.create(args),
    },
    auditEvent: {
      create: (args) => client.auditEvent.create(args),
    },
  };
}

function toAnswer(row: RsvpRow): RsvpSubmittedAnswer {
  return {
    eventId: row.eventId,
    response: row.response,
    pax: row.pax,
    optimisticVersion: row.optimisticVersion,
  };
}

/**
 * `pax` is only meaningful for an attendance that involves people, so a declined
 * or tentative answer is normalized to zero rather than trusted. A zero here is
 * what keeps the dashboard's head-count arithmetic honest.
 */
export function normalizePax(
  response: RsvpResponse,
  pax: number,
  maximumPax: number,
): number | null {
  if (response !== "ATTENDING") return 0;
  if (!Number.isInteger(pax) || pax < 1 || pax > maximumPax) return null;
  return pax;
}

/**
 * Validates the submission against the household's own allowance and event list.
 * Returns the normalized updates so the caller cannot accidentally persist the raw
 * values it passed in.
 */
export function validateRsvpUpdates(
  updates: RsvpSubmitInput["updates"],
  maximumPax: number,
  allowedEventIds: ReadonlySet<string>,
):
  | Readonly<{
      ok: true;
      normalized: readonly Readonly<{
        eventId: string;
        response: RsvpResponse;
        pax: number;
        expectedVersion: number | null;
      }>[];
    }>
  | Readonly<{ ok: false; reason: RsvpValidationFailure }> {
  if (updates.length === 0) return { ok: false, reason: "EMPTY_SUBMISSION" };

  const seen = new Set<string>();
  const normalized: Array<
    Readonly<{
      eventId: string;
      response: RsvpResponse;
      pax: number;
      expectedVersion: number | null;
    }>
  > = [];

  for (const update of updates) {
    if (seen.has(update.eventId)) {
      return { ok: false, reason: "DUPLICATE_EVENT" };
    }
    seen.add(update.eventId);

    if (!allowedEventIds.has(update.eventId)) {
      return { ok: false, reason: "UNKNOWN_EVENT" };
    }

    const pax = normalizePax(update.response, update.pax, maximumPax);
    if (pax === null) return { ok: false, reason: "PAX_OUT_OF_RANGE" };

    normalized.push({
      eventId: update.eventId,
      response: update.response,
      pax,
      expectedVersion: update.expectedVersion,
    });
  }

  return { ok: true, normalized };
}

async function loadHousehold(
  client: RsvpSubmissionClient,
  householdId: string,
): Promise<HouseholdRow | null> {
  return client.guestHousehold.findFirst({
    where: { id: householdId },
    select: householdSelect,
  });
}

/**
 * Applies one submission against an already-open client.
 *
 * Exported so the rules can be exercised against a fake client without a
database, matching how the other repositories are tested. Production callers go
 * through {@link PrismaRsvpSubmissionTransaction}, which supplies a transaction.
 */
export async function applyRsvpSubmission(
  client: RsvpSubmissionClient,
  input: RsvpSubmitInput,
  now: Date,
  correlationId: string,
): Promise<RsvpSubmitResult> {
  const household = await loadHousehold(client, input.householdId);
  if (household === null) return { kind: "not-found" };

  // A household whose link was disabled or deleted must not be able to answer,
  // even if the caller still holds a working token.
  if (household.status !== "ACTIVE") return { kind: "not-found" };

  // Replay guard. The key is the outbox row's primary key, so a second submission
  // with the same key cannot insert a second row; returning the stored answers
  // makes the retry idempotent from the guest's point of view.
  const replay = await client.outboxEvent.findUnique({
    where: { id: input.idempotencyKey },
    select: { id: true },
  });
  if (replay !== null) {
    const stored = await client.rsvp.findMany({
      where: {
        householdId: household.id,
        eventId: { in: input.updates.map((update) => update.eventId) },
      },
      select: rsvpSelect,
    });
    return { kind: "replayed", answers: stored.map(toAnswer) };
  }

  const events = await client.weddingEvent.findMany({
    where: { tenantId: household.tenantId, weddingId: household.weddingId },
    select: { id: true },
  });
  const validation = validateRsvpUpdates(
    input.updates,
    household.maximumPax,
    new Set(events.map((event) => event.id)),
  );
  if (!validation.ok) return { kind: "invalid", reason: validation.reason };

  const answers: RsvpSubmittedAnswer[] = [];

  for (const update of validation.normalized) {
    const existing = await client.rsvp.findFirst({
      where: { householdId: household.id, eventId: update.eventId },
      select: rsvpSelect,
    });

    if (update.expectedVersion === null) {
      // The client believes no answer exists yet. If one does, another device
      // answered first and the guest must be shown the newer value.
      if (existing !== null) return { kind: "stale", eventId: update.eventId };

      const created = await client.rsvp.create({
        data: {
          tenantId: household.tenantId,
          householdId: household.id,
          eventId: update.eventId,
          response: update.response,
          pax: update.pax,
          optimisticVersion: 1,
          respondedAt: now,
        },
        select: rsvpSelect,
      });

      await client.rsvpHistory.create({
        data: {
          tenantId: household.tenantId,
          rsvpId: created.id,
          previousResponse: null,
          newResponse: update.response,
          previousPax: null,
          newPax: update.pax,
          actorType: "GUEST",
          ...(input.actorId === undefined || input.actorId === null
            ? {}
            : { actorId: input.actorId }),
          changedAt: now,
        },
      });

      answers.push(toAnswer(created));
      continue;
    }

    if (
      existing === null ||
      existing.optimisticVersion !== update.expectedVersion
    ) {
      return { kind: "stale", eventId: update.eventId };
    }

    // The version stays in the `where` clause so the guard and the write are one
    // statement: two concurrent updates cannot both commit.
    const written = await client.rsvp.updateMany({
      where: {
        id: existing.id,
        householdId: household.id,
        optimisticVersion: update.expectedVersion,
      },
      data: {
        response: update.response,
        pax: update.pax,
        optimisticVersion: update.expectedVersion + 1,
        respondedAt: now,
      },
    });
    if (written.count !== 1) return { kind: "stale", eventId: update.eventId };

    await client.rsvpHistory.create({
      data: {
        tenantId: household.tenantId,
        rsvpId: existing.id,
        previousResponse: existing.response,
        newResponse: update.response,
        previousPax: existing.pax,
        newPax: update.pax,
        actorType: "GUEST",
        ...(input.actorId === undefined || input.actorId === null
          ? {}
          : { actorId: input.actorId }),
        changedAt: now,
      },
    });

    answers.push({
      eventId: update.eventId,
      response: update.response,
      pax: update.pax,
      optimisticVersion: update.expectedVersion + 1,
    });
  }

  // One outbox row per submission, not per event: consumers care that a household
  // answered, and the payload carries the whole answer set so a notification job
  // has what it needs without re-reading the RSVP rows.
  await client.outboxEvent.create({
    data: {
      id: input.idempotencyKey,
      tenantId: household.tenantId,
      eventType: "RsvpSubmitted",
      aggregateType: "GuestHousehold",
      aggregateId: household.id,
      payload: {
        householdId: household.id,
        weddingId: household.weddingId,
        occurredAt: now.toISOString(),
        answers: answers.map((answer) => ({
          eventId: answer.eventId,
          response: answer.response,
          pax: answer.pax,
        })),
      },
      payloadVersion: 1,
    },
  });

  await client.auditEvent.create({
    data: {
      tenantId: household.tenantId,
      actorType: "GUEST",
      action: "RSVP_SUBMITTED",
      targetType: "GuestHousehold",
      targetId: household.id,
      // No contact value, token, or free text: an audit row is retained longer than
      // the request and must not become a second copy of the guest's data.
      metadata: {
        eventCount: answers.length,
        responses: answers.map((answer) => answer.response),
      },
      correlationId,
    },
  });

  return { kind: "success", answers };
}

export interface RsvpSubmissionTransactionPort {
  /** Runs the rules and the writes in one transaction, or not at all. */
  submit(input: RsvpSubmitInput, now: Date): Promise<RsvpSubmitResult>;
}

export class PrismaRsvpSubmissionTransaction implements RsvpSubmissionTransactionPort {
  public constructor(private readonly client: PrismaClient = prisma) {}

  public async submit(
    input: RsvpSubmitInput,
    now: Date,
  ): Promise<RsvpSubmitResult> {
    return this.client.$transaction((transaction) =>
      applyRsvpSubmission(
        adaptRsvpSubmissionClient(transaction),
        input,
        now,
        input.idempotencyKey,
      ),
    );
  }
}

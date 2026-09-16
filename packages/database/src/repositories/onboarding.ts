import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../client";

/**
 * Onboarding persistence (MVP-UI-006).
 *
 * The wizard contract (`apps/customer-web/src/lib/onboarding/contract.ts`)
 * carries wall-clock strings — `"YYYY-MM-DD"` and `"HH:mm"` — while the schema
 * stores `@db.Date` columns and an absolute `startsAt` instant. Every
 * conversion between the two lives in the exported helpers at the bottom of
 * this file, so the repository itself owns no timezone behaviour.
 *
 * Concurrency: reads and writes are always scoped by `tenantId`, and every
 * mutation is guarded by `where: { ..., version: baseVersion }` so a stale
 * client cannot clobber a newer draft.
 */

const onboardingWeddingSelect = {
  id: true,
  tenantId: true,
  partner1Name: true,
  partner2Name: true,
  weddingDate: true,
  weddingDateUndecided: true,
  city: true,
  timezone: true,
  locale: true,
  status: true,
  version: true,
  onboardingCompletedAt: true,
} as const satisfies Prisma.WeddingSelect;

type OnboardingWeddingRow = Prisma.WeddingGetPayload<{
  select: typeof onboardingWeddingSelect;
}>;

const onboardingEventSelect = {
  id: true,
  tenantId: true,
  weddingId: true,
  title: true,
  eventType: true,
  startsAt: true,
  timezone: true,
  venueName: true,
  addressSnapshot: true,
  displayOrder: true,
} as const satisfies Prisma.WeddingEventSelect;

type OnboardingEventRow = Prisma.WeddingEventGetPayload<{
  select: typeof onboardingEventSelect;
}>;

/**
 * The two delegates onboarding touches, with the methods narrowed to the calls
 * this repository makes. Narrowing (rather than `Pick`-ing the delegate
 * itself) is what keeps a plain object double assignable: `Pick` would keep
 * Prisma's generic overloads and reject `{ findFirst: vi.fn() }`.
 */
type OnboardingWeddingDelegate = {
  findFirst(args: {
    where: Prisma.WeddingWhereInput;
    select: typeof onboardingWeddingSelect;
  }): Promise<OnboardingWeddingRow | null>;
  updateMany(args: {
    where: Prisma.WeddingWhereInput;
    data: Prisma.WeddingUpdateManyMutationInput;
  }): Promise<{ count: number }>;
};

type OnboardingEventDelegate = {
  findFirst(args: {
    where: Prisma.WeddingEventWhereInput;
    orderBy: Prisma.WeddingEventOrderByWithRelationInput[];
    select: typeof onboardingEventSelect;
  }): Promise<OnboardingEventRow | null>;
  updateMany(args: {
    where: Prisma.WeddingEventWhereInput;
    data: Prisma.WeddingEventUncheckedUpdateManyInput;
  }): Promise<{ count: number }>;
  create(args: {
    data: Prisma.WeddingEventUncheckedCreateInput;
    select: { id: true };
  }): Promise<{ id: string }>;
};

/**
 * A complete write is one statement per row, so both rows must move or neither
 * does. A Prisma transaction client has no `$transaction` of its own, which is
 * exactly what keeps a port-driven call from nesting a second transaction.
 */
type OnboardingTransactionRunner = <T>(
  work: (client: OnboardingRepositoryClient) => Promise<T>,
) => Promise<T>;

export type OnboardingRepositoryClient = Readonly<{
  wedding: OnboardingWeddingDelegate;
  weddingEvent: OnboardingEventDelegate;
  $transaction?: OnboardingTransactionRunner;
}>;

/**
 * `OnboardingScope.actorId` is the authorized actor. Wedding onboarding rows
 * have no column for it, so the caller keeps it for its audit trail.
 */
export type OnboardingScope = Readonly<{
  tenantId: string;
  weddingId: string;
  actorId: string;
}>;

export type OnboardingStepId = 1 | 2 | 3;

export type OnboardingDataDto = Readonly<{
  partner1Name: string;
  partner2Name: string;
  /** `""` or `"YYYY-MM-DD"`. */
  weddingDate: string;
  weddingDateUndecided: boolean;
  eventType: string;
  /** `""` or `"YYYY-MM-DD"`. */
  eventDate: string;
  /** `""` or `"HH:mm"` wall-clock; no zone conversion. */
  eventTime: string;
  city: string;
  timezone: string;
  venueName: string;
  venueAddress: string;
  locale: "id" | "en";
}>;

export type OnboardingDraftDto = Readonly<{
  weddingId: string;
  version: number;
  completed: boolean;
  data: OnboardingDataDto;
  firstEventId: string | null;
}>;

export type OnboardingSaveStepInput = Readonly<{
  step: OnboardingStepId;
  /** Only the fields the step owns; absent keys are left untouched. */
  data: Partial<OnboardingDataDto>;
  baseVersion: number;
}>;

export type OnboardingCompleteInput = Readonly<{
  data: OnboardingDataDto;
  baseVersion: number;
}>;

export type OnboardingSaveStepResult =
  | { ok: true; version: number }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "STALE"; currentVersion: number };

export type OnboardingCompleteResult =
  | { ok: true; version: number; data: OnboardingDataDto }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "STALE"; currentVersion: number };

export interface OnboardingRepository {
  loadDraft(scope: OnboardingScope): Promise<OnboardingDraftDto | null>;
  saveStep(
    scope: OnboardingScope,
    input: OnboardingSaveStepInput,
  ): Promise<OnboardingSaveStepResult>;
  complete(
    scope: OnboardingScope,
    input: OnboardingCompleteInput,
  ): Promise<OnboardingCompleteResult>;
}

export type OnboardingRepositories = Readonly<{
  onboarding: OnboardingRepository;
}>;

export type OnboardingTransactionPort = Readonly<{
  transaction<T>(
    work: (repositories: OnboardingRepositories) => Promise<T>,
  ): Promise<T>;
}>;

/* ---------- Pure conversions (UI contract <-> database columns) ---------- */

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const MINUTE_MS = 60 * 1000;

/**
 * `@db.Date` has no zone, so Prisma hands back UTC midnight and the ISO prefix
 * is the calendar day the couple picked. The UTC getters are used deliberately
 * — the local ones would shift the day for a server outside UTC, which is the
 * same reason the client formats dates with `timeZone: "UTC"`.
 */
export function toYmd(date: Date | null): string {
  if (date === null || Number.isNaN(date.getTime())) return "";

  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Date-only ISO strings are parsed as UTC midnight, so `"2026-09-15"` is the
 * 15th for every reader. Shape is checked first and the result is
 * round-tripped, so an out-of-range day such as `"2026-02-30"` becomes `null`
 * instead of silently rolling forward into March.
 */
export function fromYmd(ymd: string): Date | null {
  const value = ymd.trim();
  if (!YMD_PATTERN.test(value)) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (toYmd(parsed) !== value) return null;

  return parsed;
}

/** `"en"`/`"en-US"` -> `"en"`; anything else — including unknown values — is Indonesian. */
export function toContractLocale(dbLocale: string): "id" | "en" {
  return dbLocale.toLowerCase().startsWith("en") ? "en" : "id";
}

export function toDbLocale(locale: "id" | "en"): string {
  return locale === "en" ? "en" : "id-ID";
}

/**
 * Combines the wizard's wall-clock date and time into the stored instant. A
 * blank `eventTime` means midnight, and a blank or unparseable date means the
 * event has no start at all — the caller skips the write rather than inventing
 * one. `endsAt` is left null: event ordering belongs to the wedding domain,
 * not to this form (contract §5).
 */
export function combineEventStartsAt(
  eventDate: string,
  eventTime: string,
): Date | null {
  const date = fromYmd(eventDate);
  if (date === null) return null;

  const time = eventTime.trim();
  if (time === "") return date;

  const match = HH_MM_PATTERN.exec(time);
  if (match === null) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return new Date(date.getTime() + (hours * 60 + minutes) * MINUTE_MS);
}

function toHhMm(date: Date | null): string {
  if (date === null || Number.isNaN(date.getTime())) return "";

  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Midnight is indistinguishable from "no time given" once persisted, so it
 * reads back as `"00:00"`. Nothing else can be recovered from the column.
 */
function toOnboardingData(
  wedding: OnboardingWeddingRow,
  event: OnboardingEventRow | null,
): OnboardingDataDto {
  return {
    partner1Name: wedding.partner1Name ?? "",
    partner2Name: wedding.partner2Name ?? "",
    weddingDate: toYmd(wedding.weddingDate),
    weddingDateUndecided: wedding.weddingDateUndecided,
    eventType: event?.eventType ?? "",
    eventDate: event === null ? "" : toYmd(event.startsAt),
    eventTime: event === null ? "" : toHhMm(event.startsAt),
    city: wedding.city ?? "",
    timezone: wedding.timezone,
    venueName: event?.venueName ?? "",
    venueAddress: event?.addressSnapshot ?? "",
    locale: toContractLocale(wedding.locale),
  };
}

function toOnboardingDraft(
  wedding: OnboardingWeddingRow,
  event: OnboardingEventRow | null,
): OnboardingDraftDto {
  return {
    weddingId: wedding.id,
    version: wedding.version,
    completed: wedding.onboardingCompletedAt !== null,
    data: toOnboardingData(wedding, event),
    firstEventId: event?.id ?? null,
  };
}

/** Nullable text columns store "not given" as `null`, never as an empty string. */
function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}

function coupleStepData(
  data: Partial<OnboardingDataDto>,
): Prisma.WeddingUpdateManyMutationInput {
  return {
    ...(data.partner1Name === undefined
      ? {}
      : { partner1Name: emptyToNull(data.partner1Name) }),
    ...(data.partner2Name === undefined
      ? {}
      : { partner2Name: emptyToNull(data.partner2Name) }),
    // A blank date clears the column; `weddingDateUndecided` stays the
    // explicit "not chosen yet" flag, so the two never disagree silently.
    ...(data.weddingDate === undefined
      ? {}
      : { weddingDate: fromYmd(data.weddingDate) }),
    ...(data.weddingDateUndecided === undefined
      ? {}
      : { weddingDateUndecided: data.weddingDateUndecided }),
  };
}

function cityStepData(
  data: Partial<OnboardingDataDto>,
): Prisma.WeddingUpdateManyMutationInput {
  return data.city === undefined ? {} : { city: emptyToNull(data.city) };
}

function preferencesStepData(
  data: Partial<OnboardingDataDto>,
): Prisma.WeddingUpdateManyMutationInput {
  return {
    ...(data.timezone === undefined ? {} : { timezone: data.timezone }),
    ...(data.locale === undefined ? {} : { locale: toDbLocale(data.locale) }),
  };
}

/**
 * The whole wizard in one statement, including the seal: `status` and
 * `onboardingCompletedAt` are written by the same guarded update as the data,
 * so there is no window where the draft is saved but the wedding is still open.
 */
function completeStepData(
  data: Partial<OnboardingDataDto>,
  fallbackTimeZone: string,
): Prisma.WeddingUpdateManyMutationInput {
  return {
    partner1Name: emptyToNull(data.partner1Name ?? ""),
    partner2Name: emptyToNull(data.partner2Name ?? ""),
    weddingDate: fromYmd(data.weddingDate ?? ""),
    weddingDateUndecided: data.weddingDateUndecided ?? false,
    city: emptyToNull(data.city ?? ""),
    timezone: data.timezone ?? fallbackTimeZone,
    locale: toDbLocale(data.locale ?? "id"),
    status: "READY",
    onboardingCompletedAt: new Date(),
  };
}

function eventStepData(
  data: Partial<OnboardingDataDto>,
): Prisma.WeddingEventUncheckedUpdateManyInput {
  const startsAt = combineEventStartsAt(
    data.eventDate ?? "",
    data.eventTime ?? "",
  );

  return {
    ...(startsAt === null ? {} : { startsAt }),
    ...(data.eventType === undefined ? {} : { eventType: data.eventType }),
    ...(data.timezone === undefined ? {} : { timezone: data.timezone }),
    ...(data.venueName === undefined
      ? {}
      : { venueName: emptyToNull(data.venueName) }),
    ...(data.venueAddress === undefined
      ? {}
      : { addressSnapshot: emptyToNull(data.venueAddress) }),
  };
}

/**
 * `WeddingEvent.startsAt` and `.title` are required, but the wizard contract
 * carries neither a free-form title nor a mandatory date: the title defaults to
 * the event type, and no event is created until there is both a type and a
 * parseable start to create it from.
 */
function eventCreateData(
  scope: OnboardingScope,
  data: Partial<OnboardingDataDto>,
  fallbackTimeZone: string,
): Prisma.WeddingEventUncheckedCreateInput | null {
  const eventType = data.eventType;
  const startsAt = combineEventStartsAt(
    data.eventDate ?? "",
    data.eventTime ?? "",
  );
  if (eventType === undefined || eventType === "" || startsAt === null) {
    return null;
  }

  return {
    tenantId: scope.tenantId,
    weddingId: scope.weddingId,
    title: eventType,
    eventType,
    startsAt,
    timezone: data.timezone ?? fallbackTimeZone,
    ...(data.venueName === undefined
      ? {}
      : { venueName: emptyToNull(data.venueName) }),
    ...(data.venueAddress === undefined
      ? {}
      : { addressSnapshot: emptyToNull(data.venueAddress) }),
    displayOrder: 0,
  };
}

/**
 * `narrowClient` is the compile-time proof that the real client — `prisma` and
 * a Prisma transaction client alike — satisfies the narrowed members above.
 */
function narrowClient(
  client: Pick<PrismaClient, "wedding" | "weddingEvent">,
): OnboardingRepositoryClient {
  return client;
}

export class PrismaOnboardingRepository implements OnboardingRepository {
  public constructor(
    private readonly client: OnboardingRepositoryClient = prisma,
  ) {}

  public async loadDraft(
    scope: OnboardingScope,
  ): Promise<OnboardingDraftDto | null> {
    const wedding = await this.client.wedding.findFirst({
      where: { id: scope.weddingId, tenantId: scope.tenantId },
      select: onboardingWeddingSelect,
    });
    if (wedding === null) return null;

    const event = await this.findFirstEvent(this.client, scope);
    return toOnboardingDraft(wedding, event);
  }

  public async saveStep(
    scope: OnboardingScope,
    input: OnboardingSaveStepInput,
  ): Promise<OnboardingSaveStepResult> {
    return this.persist(scope, input.step, input.data, input.baseVersion);
  }

  public async complete(
    scope: OnboardingScope,
    input: OnboardingCompleteInput,
  ): Promise<OnboardingCompleteResult> {
    const result = await this.persist(
      scope,
      null,
      input.data,
      input.baseVersion,
    );
    if (!result.ok) return result;

    return { ok: true, version: result.version, data: input.data };
  }

  /**
   * The single write path behind both `saveStep` and `complete`. `step === null`
   * means "every step at once", which is what seals the draft.
   */
  private async persist(
    scope: OnboardingScope,
    step: OnboardingStepId | null,
    data: Partial<OnboardingDataDto>,
    baseVersion: number,
  ): Promise<OnboardingSaveStepResult> {
    return this.withTransaction((client) =>
      this.persistIn(client, scope, step, data, baseVersion),
    );
  }

  private async persistIn(
    client: OnboardingRepositoryClient,
    scope: OnboardingScope,
    step: OnboardingStepId | null,
    data: Partial<OnboardingDataDto>,
    baseVersion: number,
  ): Promise<OnboardingSaveStepResult> {
    // Ownership is proven before any write, so a cross-tenant wedding is
    // indistinguishable from a missing one.
    const wedding = await client.wedding.findFirst({
      where: { id: scope.weddingId, tenantId: scope.tenantId },
      select: onboardingWeddingSelect,
    });
    if (wedding === null) return { ok: false, reason: "NOT_FOUND" };

    const updated = await client.wedding.updateMany({
      where: {
        id: scope.weddingId,
        tenantId: scope.tenantId,
        version: baseVersion,
      },
      data: {
        ...(step === 1 ? coupleStepData(data) : {}),
        ...(step === 2 ? cityStepData(data) : {}),
        ...(step === 3 ? preferencesStepData(data) : {}),
        ...(step === null ? completeStepData(data, wedding.timezone) : {}),
        version: { increment: 1 },
      },
    });

    if (updated.count !== 1) {
      // The row exists (checked above), so a miss means the version moved. The
      // re-read reports the version the client actually lost to.
      const current = await client.wedding.findFirst({
        where: { id: scope.weddingId, tenantId: scope.tenantId },
        select: onboardingWeddingSelect,
      });
      if (current === null) return { ok: false, reason: "NOT_FOUND" };

      return {
        ok: false,
        reason: "STALE",
        currentVersion: current.version,
      };
    }

    if (step === 2 || step === null) {
      await this.upsertFirstEvent(client, scope, wedding.timezone, data);
    }

    return { ok: true, version: baseVersion + 1 };
  }

  private async findFirstEvent(
    client: OnboardingRepositoryClient,
    scope: OnboardingScope,
  ): Promise<OnboardingEventRow | null> {
    return client.weddingEvent.findFirst({
      where: {
        tenantId: scope.tenantId,
        weddingId: scope.weddingId,
        wedding: { tenantId: scope.tenantId },
      },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: onboardingEventSelect,
    });
  }

  /**
   * The wizard's first event is the one at `displayOrder: 0`, which the
   * `[weddingId, displayOrder]` unique constraint keeps singular. The child is
   * scoped through its parent as well, so a wrong-vendor wedding cannot create
   * one.
   */
  private async upsertFirstEvent(
    client: OnboardingRepositoryClient,
    scope: OnboardingScope,
    fallbackTimeZone: string,
    data: Partial<OnboardingDataDto>,
  ): Promise<void> {
    const existing = await this.findFirstEvent(client, scope);

    if (existing === null) {
      const create = eventCreateData(scope, data, fallbackTimeZone);
      if (create === null) return;

      await client.weddingEvent.create({ data: create, select: { id: true } });
      return;
    }

    // The title defaults to the event type; re-derive it only while it still is
    // the type, so a title edited later in the invitation editor survives.
    const eventType = data.eventType;
    const retitle =
      eventType !== undefined &&
      eventType !== "" &&
      existing.title === existing.eventType
        ? { title: eventType }
        : {};

    const updated = await client.weddingEvent.updateMany({
      where: {
        id: existing.id,
        tenantId: scope.tenantId,
        weddingId: scope.weddingId,
        wedding: { tenantId: scope.tenantId },
      },
      data: { ...eventStepData(data), ...retitle },
    });
    if (updated.count === 1) return;

    // The row disappeared between the read and the write; the upsert creates
    // the event rather than leaving the wizard half-saved.
    const create = eventCreateData(scope, data, fallbackTimeZone);
    if (create === null) return;

    await client.weddingEvent.create({ data: create, select: { id: true } });
  }

  private async withTransaction<T>(
    work: (client: OnboardingRepositoryClient) => Promise<T>,
  ): Promise<T> {
    const client = this.client;
    if (client.$transaction === undefined) return work(client);

    return client.$transaction(work);
  }
}

export class PrismaOnboardingTransaction implements OnboardingTransactionPort {
  public constructor(private readonly client: PrismaClient = prisma) {}

  public async transaction<T>(
    work: (repositories: OnboardingRepositories) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(async (transactionClient) =>
      work({
        onboarding: new PrismaOnboardingRepository(
          narrowClient(transactionClient),
        ),
      }),
    );
  }
}

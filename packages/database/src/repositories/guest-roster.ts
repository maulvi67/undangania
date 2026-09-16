import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";
import { generateOpaqueToken } from "../tokens";

/**
 * Guest roster: households, their members, and the personalized link.
 *
 * Two shape decisions come from the schema rather than from this file.
 *
 * 1. There is no per-household event-access table. `Rsvp` carries
 *    `[householdId, eventId]` and is scoped to the household's own wedding, so the
 *    only access rule the database can enforce is "an event of this wedding".
 *    Every household is therefore reported against every event of its wedding.
 *    Inventing a narrower set here would describe a rule nothing enforces.
 *
 * 2. There is no tag table either. Tags are reported as an empty collection so the
 *    management UI degrades to "no tags" rather than to a fabricated set.
 *
 * Contact values are stored encrypted with a separate hash column. Nothing here
 * decrypts them: the roster only needs to say whether a value is on file, so it
 * reads the hash columns as a presence flag and never selects the ciphertext.
 */

const householdSelect = {
  id: true,
  displayName: true,
  maximumPax: true,
  tokenVersion: true,
  status: true,
  updatedAt: true,
  _count: { select: { guests: true } },
  guests: {
    select: { id: true, displayName: true, category: true },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
  },
} as const satisfies Prisma.GuestHouseholdSelect;

type HouseholdRow = Prisma.GuestHouseholdGetPayload<{
  select: typeof householdSelect;
}>;

/**
 * Presence-only read of the contact columns. The `*Encrypted` columns are
 * deliberately absent: selecting ciphertext into the roster would put confidential
 * data on a path that has no use for it.
 */
const contactSelect = {
  id: true,
  tokenVersion: true,
  phoneHash: true,
  emailHash: true,
} as const satisfies Prisma.GuestHouseholdSelect;

type ContactRow = Prisma.GuestHouseholdGetPayload<{
  select: typeof contactSelect;
}>;

const eventSelect = {
  id: true,
  title: true,
} as const satisfies Prisma.WeddingEventSelect;

type EventRow = Prisma.WeddingEventGetPayload<{ select: typeof eventSelect }>;

/**
 * The workspace label shown above the roster. Read here rather than derived from
 * the session, because the session carries a tenant id and the *wedding* carries
 * the names the couple typed during onboarding.
 */
const weddingSelect = {
  displayName: true,
  partner1Name: true,
  partner2Name: true,
} as const satisfies Prisma.WeddingSelect;

type WeddingRow = Prisma.WeddingGetPayload<{ select: typeof weddingSelect }>;

/**
 * Structural delegates, deliberately narrow so tests can inject plain objects. A
 * real Prisma client is adapted by `adaptGuestRosterClient` rather than cast into
 * place: Prisma's delegate methods are generic over `SelectSubset`, so comparing
 * them against a concrete signature is not sound.
 *
 * The two `guestHousehold` reads have separate names because they select different
 * columns and therefore return different row types; collapsing them into one
 * method would need a union return that every caller then has to narrow.
 */
type GuestRosterClient = Readonly<{
  wedding: {
    findFirst(args: {
      where: Prisma.WeddingWhereInput;
      select: typeof weddingSelect;
    }): Promise<WeddingRow | null>;
  };
  weddingEvent: {
    findMany(args: {
      where: Prisma.WeddingEventWhereInput;
      orderBy: Prisma.WeddingEventOrderByWithRelationInput[];
      select: typeof eventSelect;
    }): Promise<EventRow[]>;
  };
  guestHousehold: {
    findFirst(args: {
      where: Prisma.GuestHouseholdWhereInput;
      select: typeof householdSelect;
    }): Promise<HouseholdRow | null>;
    findFirstContact(args: {
      where: Prisma.GuestHouseholdWhereInput;
      select: typeof contactSelect;
    }): Promise<ContactRow | null>;
    findMany(args: {
      where: Prisma.GuestHouseholdWhereInput;
      orderBy: Prisma.GuestHouseholdOrderByWithRelationInput[];
      select: typeof householdSelect;
    }): Promise<HouseholdRow[]>;
    create(args: {
      data: Prisma.GuestHouseholdUncheckedCreateInput;
      select: typeof householdSelect;
    }): Promise<HouseholdRow>;
    updateMany(args: {
      where: Prisma.GuestHouseholdWhereInput;
      data: Prisma.GuestHouseholdUpdateManyMutationInput;
    }): Promise<{ count: number }>;
  };
  guest: {
    createMany(args: {
      data: Prisma.GuestCreateManyInput[];
    }): Promise<{ count: number }>;
    deleteMany(args: {
      where: Prisma.GuestWhereInput;
    }): Promise<{ count: number }>;
  };
}>;

export function adaptGuestRosterClient(
  client: Pick<
    PrismaClient,
    "wedding" | "weddingEvent" | "guestHousehold" | "guest"
  >,
): GuestRosterClient {
  return {
    wedding: {
      findFirst: (args) => client.wedding.findFirst(args),
    },
    weddingEvent: {
      findMany: (args) => client.weddingEvent.findMany(args),
    },
    guestHousehold: {
      findFirst: (args) => client.guestHousehold.findFirst(args),
      findFirstContact: (args) => client.guestHousehold.findFirst(args),
      findMany: (args) => client.guestHousehold.findMany(args),
      create: (args) => client.guestHousehold.create(args),
      updateMany: (args) => client.guestHousehold.updateMany(args),
    },
    guest: {
      createMany: (args) => client.guest.createMany(args),
      deleteMany: (args) => client.guest.deleteMany(args),
    },
  };
}

/** The tenant + wedding pair every roster operation is scoped by. */
export type RosterScope = Readonly<{
  tenantId: string;
  weddingId: string;
}>;

export type RosterLinkStatus = "ACTIVE" | "DISABLED";

export type RosterMemberDto = Readonly<{
  id: string;
  displayName: string;
  category: string;
}>;

export type RosterHouseholdDto = Readonly<{
  id: string;
  displayName: string;
  maximumPax: number;
  memberCount: number;
  linkStatus: RosterLinkStatus;
  updatedAt: Date;
}>;

export type RosterHouseholdDetailDto = RosterHouseholdDto &
  Readonly<{
    members: readonly RosterMemberDto[];
    hasPhone: boolean;
    hasEmail: boolean;
    tokenVersion: number;
  }>;

export type RosterEventDto = Readonly<{
  id: string;
  title: string;
}>;

export type RosterOverviewDto = Readonly<{
  events: readonly RosterEventDto[];
  households: readonly RosterHouseholdDto[];
  totalGuests: number;
}>;

export type RosterWorkspaceDto = Readonly<{
  /** The wedding's own display name, as configured during onboarding. */
  displayName: string;
  /** `"Rani & Bima"`, one name, or null when neither partner is set. */
  coupleNames: string | null;
}>;

export type RosterMemberInput = Readonly<{
  displayName: string;
  category: string;
}>;

export type RosterCreateInput = Readonly<{
  displayName: string;
  maximumPax: number;
  members: readonly RosterMemberInput[];
  /**
   * Already normalized and encrypted by the caller. `phoneHash`/`emailHash` are
   * deliberately not accepted: a caller that could set the hash without the
   * ciphertext, or the reverse, could make the pair disagree.
   */
  phoneEncrypted?: string | null;
  emailEncrypted?: string | null;
}>;

export type RosterUpdateInput = Readonly<{
  displayName?: string;
  maximumPax?: number;
  /** Present means "replace the member list"; absent means "leave it alone". */
  members?: readonly RosterMemberInput[];
}>;

export type RosterImportRow = Readonly<{
  householdName: string;
  memberNames: readonly string[];
  maximumPax: number;
}>;

export type RosterImportResult = Readonly<{
  createdHouseholds: number;
  createdGuests: number;
}>;

/** The one-time plaintext of a rotated link. Never stored, never re-readable. */
export type RotatedRosterLink = Readonly<{
  token: string;
  tokenVersion: number;
}>;

export interface GuestRosterRepository {
  /** The wedding's own names, for the page header. Null when out of scope. */
  loadWorkspace(scope: RosterScope): Promise<RosterWorkspaceDto | null>;
  loadOverview(scope: RosterScope): Promise<RosterOverviewDto>;
  findById(
    scope: RosterScope,
    householdId: string,
  ): Promise<RosterHouseholdDetailDto | null>;
  create(
    scope: RosterScope,
    input: RosterCreateInput,
  ): Promise<RosterHouseholdDetailDto | null>;
  /**
   * Creates several households in one call.
   *
   * Distinct from repeated `create` for two reasons: a CSV import is all-or-nothing
   * from the caller's point of view, and generating a token per household inside one
   * transaction is what keeps a half-imported file from leaving rows whose links
   * were never handed to anyone.
   */
  createMany(
    scope: RosterScope,
    rows: readonly RosterImportRow[],
  ): Promise<RosterImportResult | null>;
  update(
    scope: RosterScope,
    householdId: string,
    input: RosterUpdateInput,
  ): Promise<RosterHouseholdDetailDto | null>;
  /** Issues a new token, invalidating the previous one. */
  rotateLink(
    scope: RosterScope,
    householdId: string,
  ): Promise<RotatedRosterLink | null>;
  setLinkStatus(
    scope: RosterScope,
    householdId: string,
    status: RosterLinkStatus,
  ): Promise<boolean>;
}

/**
 * `"Rani & Bima"`, or whichever single name is present. Null when neither is set,
 * so the caller falls back to the wedding's display name rather than rendering an
 * empty "& ".
 */
export function coupleNamesFor(row: {
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
 * An unrecognized status is reported as DISABLED, so a value this code does not
 * understand fails closed instead of looking like a working link.
 */
function toLinkStatus(status: string): RosterLinkStatus {
  return status === "ACTIVE" ? "ACTIVE" : "DISABLED";
}

function toHouseholdDto(row: HouseholdRow): RosterHouseholdDto {
  return {
    id: row.id,
    displayName: row.displayName,
    maximumPax: row.maximumPax,
    memberCount: row._count.guests,
    linkStatus: toLinkStatus(row.status),
    updatedAt: row.updatedAt,
  };
}

function toDetailDto(
  row: HouseholdRow,
  contact: Readonly<{ hasPhone: boolean; hasEmail: boolean }>,
): RosterHouseholdDetailDto {
  return {
    ...toHouseholdDto(row),
    members: row.guests.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      category: member.category,
    })),
    hasPhone: contact.hasPhone,
    hasEmail: contact.hasEmail,
    tokenVersion: row.tokenVersion,
  };
}

/** Scope predicate shared by every read and write in this file. */
function householdScope(
  scope: RosterScope,
  householdId?: string,
): Prisma.GuestHouseholdWhereInput {
  return {
    ...(householdId === undefined ? {} : { id: householdId }),
    tenantId: scope.tenantId,
    weddingId: scope.weddingId,
    // Redundant with the two columns above, but it is what makes a stale
    // denormalized `weddingId` fail as "not found" instead of matching a row the
    // tenant does not own.
    wedding: { tenantId: scope.tenantId },
  };
}

/**
 * The member list is sent whole on every save, so row ids are not stable and the
 * collection is replaced rather than diffed. This is safe for RSVP: `Rsvp` keys on
 * `[householdId, eventId]` and has no relation to `Guest`, so replacing members
 * cannot orphan or cascade into an existing response.
 */
async function replaceMembers(
  client: GuestRosterClient,
  tenantId: string,
  householdId: string,
  members: readonly RosterMemberInput[],
): Promise<void> {
  await client.guest.deleteMany({ where: { tenantId, householdId } });
  if (members.length === 0) return;

  await client.guest.createMany({
    data: members.map((member) => ({
      tenantId,
      householdId,
      displayName: member.displayName,
      category: member.category,
      status: "ACTIVE",
    })),
  });
}

export class PrismaGuestRosterRepository implements GuestRosterRepository {
  public constructor(
    private readonly client: GuestRosterClient = adaptGuestRosterClient(prisma),
  ) {}

  public async loadWorkspace(
    scope: RosterScope,
  ): Promise<RosterWorkspaceDto | null> {
    const row = await this.client.wedding.findFirst({
      where: { id: scope.weddingId, tenantId: scope.tenantId },
      select: weddingSelect,
    });
    if (row === null) return null;

    return {
      displayName: row.displayName,
      coupleNames: coupleNamesFor(row),
    };
  }

  public async loadOverview(scope: RosterScope): Promise<RosterOverviewDto> {
    const events = await this.client.weddingEvent.findMany({
      where: { tenantId: scope.tenantId, weddingId: scope.weddingId },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: eventSelect,
    });

    const rows = await this.client.guestHousehold.findMany({
      where: householdScope(scope),
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      select: householdSelect,
    });

    const households = rows.map(toHouseholdDto);
    return {
      events: events.map((event) => ({ id: event.id, title: event.title })),
      households,
      totalGuests: households.reduce(
        (total, item) => total + item.memberCount,
        0,
      ),
    };
  }

  public async findById(
    scope: RosterScope,
    householdId: string,
  ): Promise<RosterHouseholdDetailDto | null> {
    const row = await this.client.guestHousehold.findFirst({
      where: householdScope(scope, householdId),
      select: householdSelect,
    });
    if (row === null) return null;

    // Presence is a second, narrower query so the ciphertext columns never travel
    // with the household row the UI renders.
    const contact = await this.client.guestHousehold.findFirstContact({
      where: householdScope(scope, householdId),
      select: contactSelect,
    });

    return toDetailDto(row, {
      hasPhone: (contact?.phoneHash ?? null) !== null,
      hasEmail: (contact?.emailHash ?? null) !== null,
    });
  }

  public async create(
    scope: RosterScope,
    input: RosterCreateInput,
  ): Promise<RosterHouseholdDetailDto | null> {
    // The wedding is checked to exist in this tenant before the insert so a
    // cross-tenant `weddingId` becomes "not found" rather than a foreign-key error.
    const wedding = await this.client.wedding.findFirst({
      where: { id: scope.weddingId, tenantId: scope.tenantId },
      select: weddingSelect,
    });
    if (wedding === null) return null;

    // The token is generated here rather than by the caller so a household cannot
    // be created without a usable link. The plaintext exists only in this frame and
    // is not returned: only the hash is persisted, and the link is issued through
    // `rotateLink`, which is the one place that hands a token back.
    const token = generateOpaqueToken();
    const row = await this.client.guestHousehold.create({
      data: {
        tenantId: scope.tenantId,
        weddingId: scope.weddingId,
        displayName: input.displayName,
        maximumPax: input.maximumPax,
        tokenHash: token.hash,
        tokenVersion: 1,
        status: "ACTIVE",
        ...(input.phoneEncrypted === undefined || input.phoneEncrypted === null
          ? {}
          : { phoneEncrypted: input.phoneEncrypted }),
        ...(input.emailEncrypted === undefined || input.emailEncrypted === null
          ? {}
          : { emailEncrypted: input.emailEncrypted }),
      },
      select: householdSelect,
    });

    await replaceMembers(this.client, scope.tenantId, row.id, input.members);
    return this.findById(scope, row.id);
  }

  public async createMany(
    scope: RosterScope,
    rows: readonly RosterImportRow[],
  ): Promise<RosterImportResult | null> {
    if (rows.length === 0) return { createdHouseholds: 0, createdGuests: 0 };

    const wedding = await this.client.wedding.findFirst({
      where: { id: scope.weddingId, tenantId: scope.tenantId },
      select: weddingSelect,
    });
    if (wedding === null) return null;

    // Every household gets its own token here. The plaintext is discarded: the
    // import has no way to deliver a link, and a caller that needs one rotates it
    // from the detail page.
    let createdGuests = 0;
    for (const row of rows) {
      const row_ = await this.client.guestHousehold.create({
        data: {
          tenantId: scope.tenantId,
          weddingId: scope.weddingId,
          displayName: row.householdName,
          maximumPax: row.maximumPax,
          tokenHash: generateOpaqueToken().hash,
          tokenVersion: 1,
          status: "ACTIVE",
        },
        select: householdSelect,
      });

      await replaceMembers(
        this.client,
        scope.tenantId,
        row_.id,
        row.memberNames.map((name) => ({
          displayName: name,
          category: "ADULT",
        })),
      );
      createdGuests += row.memberNames.length;
    }

    return { createdHouseholds: rows.length, createdGuests };
  }

  public async update(
    scope: RosterScope,
    householdId: string,
    input: RosterUpdateInput,
  ): Promise<RosterHouseholdDetailDto | null> {
    // Ownership is proven before anything is written, so a household id belonging
    // to another tenant cannot reach the member replacement below.
    const existing = await this.client.guestHousehold.findFirstContact({
      where: householdScope(scope, householdId),
      select: contactSelect,
    });
    if (existing === null) return null;

    if (input.displayName !== undefined || input.maximumPax !== undefined) {
      await this.client.guestHousehold.updateMany({
        where: householdScope(scope, householdId),
        data: {
          ...(input.displayName === undefined
            ? {}
            : { displayName: input.displayName }),
          ...(input.maximumPax === undefined
            ? {}
            : { maximumPax: input.maximumPax }),
        },
      });
    }

    if (input.members !== undefined) {
      await replaceMembers(
        this.client,
        scope.tenantId,
        householdId,
        input.members,
      );
    }

    return this.findById(scope, householdId);
  }

  public async rotateLink(
    scope: RosterScope,
    householdId: string,
  ): Promise<RotatedRosterLink | null> {
    const token = generateOpaqueToken();
    // `increment` rather than a read-then-write: the new version has to be derived
    // from the row's own value so two concurrent rotations cannot land on the same
    // version and leave a cached page looking current.
    const result = await this.client.guestHousehold.updateMany({
      where: householdScope(scope, householdId),
      data: {
        tokenHash: token.hash,
        tokenVersion: { increment: 1 },
        status: "ACTIVE",
      },
    });
    if (result.count !== 1) return null;

    const row = await this.client.guestHousehold.findFirstContact({
      where: householdScope(scope, householdId),
      select: contactSelect,
    });
    if (row === null) return null;

    return { token: token.value, tokenVersion: row.tokenVersion };
  }

  public async setLinkStatus(
    scope: RosterScope,
    householdId: string,
    status: RosterLinkStatus,
  ): Promise<boolean> {
    const result = await this.client.guestHousehold.updateMany({
      where: householdScope(scope, householdId),
      data: { status },
    });
    return result.count === 1;
  }
}

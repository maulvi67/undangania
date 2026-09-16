import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../client";
import { hashToken } from "../tokens";

/**
 * Personalized guest access resolution.
 *
 * A guest receives a link containing an opaque token. The token is the *only*
 * thing that scopes the request — there is no session — so the lookup is keyed
 * on its SHA-256 hash and nothing else. A token that does not resolve is
 * reported as `null`; the caller renders the same "link not recognized" state it
 * would for an expired one, so a guessed token cannot be distinguished from a
 * revoked one.
 *
 * The returned row is deliberately narrow. It carries no contact data, no token
 * hash, and no other household's rows, because the response is rendered into an
 * unauthenticated page.
 *
 * `published` reports whether the household's wedding currently has an active
 * publication. A guest link for an unpublished invitation resolves successfully
 * but must not render invitation content, so the flag is returned rather than
 * silently failing the lookup.
 */

const guestAccessSelect = {
  id: true,
  tenantId: true,
  weddingId: true,
  displayName: true,
  maximumPax: true,
  status: true,
  wedding: {
    select: {
      timezone: true,
      events: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          timezone: true,
          venueName: true,
          addressSnapshot: true,
          mapUrl: true,
        },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      },
      invitation: {
        select: {
          slug: true,
          publications: {
            where: { active: true },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  },
  rsvps: {
    select: {
      eventId: true,
      response: true,
      pax: true,
      optimisticVersion: true,
    },
  },
} as const satisfies Prisma.GuestHouseholdSelect;

type GuestAccessRow = Prisma.GuestHouseholdGetPayload<{
  select: typeof guestAccessSelect;
}>;

/**
 * Structural delegate, deliberately narrow so tests can inject a plain object. A
 * real client is adapted by `adaptGuestAccessClient` rather than cast into place:
 * Prisma's delegate methods are generic over `SelectSubset`, so comparing them
 * against a concrete signature is not sound.
 */
type GuestAccessClient = Readonly<{
  guestHousehold: {
    findFirst(args: {
      where: Prisma.GuestHouseholdWhereInput;
      select: typeof guestAccessSelect;
    }): Promise<GuestAccessRow | null>;
  };
}>;

export function adaptGuestAccessClient(
  client: Pick<PrismaClient, "guestHousehold">,
): GuestAccessClient {
  return {
    guestHousehold: {
      findFirst: (args) => client.guestHousehold.findFirst(args),
    },
  };
}

export type GuestAccessRsvpResponse = "ATTENDING" | "DECLINED" | "TENTATIVE";

export type GuestAccessEventDto = Readonly<{
  id: string;
  title: string;
  startsAt: Date;
  timezone: string;
  venueName: string | null;
  address: string | null;
  mapUrl: string | null;
}>;

export type GuestAccessRsvpDto = Readonly<{
  eventId: string;
  response: GuestAccessRsvpResponse;
  pax: number;
  optimisticVersion: number;
}>;

export type GuestAccessDto = Readonly<{
  householdId: string;
  tenantId: string;
  weddingId: string;
  displayName: string;
  maximumPax: number;
  status: string;
  timezone: string;
  /** The wedding's invitation slug, once one exists. */
  slug: string | null;
  /** True only when the invitation has an active publication. */
  published: boolean;
  events: readonly GuestAccessEventDto[];
  rsvps: readonly GuestAccessRsvpDto[];
}>;

export interface GuestAccessRepository {
  /** Resolves a raw personalized-link token. Returns null when unusable. */
  resolveByToken(rawToken: string): Promise<GuestAccessDto | null>;
}

/**
 * Personalized-link tokens are 32 random bytes rendered as base64url, so 43
 * characters. The bound is enforced before hashing so a hostile input cannot
 * become an unbounded hash or query parameter.
 */
const MIN_TOKEN_LENGTH = 32;
const MAX_TOKEN_LENGTH = 512;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export function isWellFormedGuestToken(value: string): boolean {
  return (
    value.length >= MIN_TOKEN_LENGTH &&
    value.length <= MAX_TOKEN_LENGTH &&
    TOKEN_PATTERN.test(value)
  );
}

function toDto(row: GuestAccessRow): GuestAccessDto {
  const invitation = row.wedding.invitation;
  return {
    householdId: row.id,
    tenantId: row.tenantId,
    weddingId: row.weddingId,
    displayName: row.displayName,
    maximumPax: row.maximumPax,
    status: row.status,
    timezone: row.wedding.timezone,
    slug: invitation?.slug ?? null,
    published: (invitation?.publications.length ?? 0) > 0,
    events: row.wedding.events.map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      timezone: event.timezone,
      venueName: event.venueName,
      address: event.addressSnapshot,
      mapUrl: event.mapUrl,
    })),
    rsvps: row.rsvps.map((rsvp) => ({
      eventId: rsvp.eventId,
      response: rsvp.response,
      pax: rsvp.pax,
      optimisticVersion: rsvp.optimisticVersion,
    })),
  };
}

export class PrismaGuestAccessRepository implements GuestAccessRepository {
  public constructor(
    private readonly client: GuestAccessClient = adaptGuestAccessClient(prisma),
  ) {}

  public async resolveByToken(
    rawToken: string,
  ): Promise<GuestAccessDto | null> {
    if (!isWellFormedGuestToken(rawToken)) return null;

    const row = await this.client.guestHousehold.findFirst({
      where: { tokenHash: hashToken(rawToken) },
      select: guestAccessSelect,
    });
    return row === null ? null : toDto(row);
  }
}

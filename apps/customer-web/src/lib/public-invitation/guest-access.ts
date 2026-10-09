import {
  PrismaGuestAccessRepository,
  type GuestAccessDto,
  type GuestAccessRepository,
} from "@wedding/database";
import type { RsvpAnswer, RsvpResponse } from "../rsvp/contract";
import type {
  GuestAccessState,
  GuestContext,
  GuestEvent,
} from "./guest-context";

/**
 * Resolves the private guest context for a personalized link.
 *
 * The search parameter carries the bearer credential, while the invitation slug
 * binds that credential to the current public resource. A token that does not
 * resolve within that slug produces the same `invalid-token` state as a revoked
 * one, so a guessed or cross-invitation value learns nothing.
 *
 * Everything the guest sees is derived from the household the token belongs to.
 * `tenantId` and the raw token are deliberately not carried into the returned
 * context — the client component never receives an identifier it could use to
 * address another household.
 */

/** The query parameter that carries the personalized link. */
export const GUEST_TOKEN_PARAM = "g";

const EVENT_DATE_LOCALE = "id-ID";

/**
 * Formats a stored instant in the event's own timezone.
 *
 * `Intl` is given the event's zone rather than the server's, because an event in
 * Makassar must read as WITA for every guest regardless of where the render runs.
 */
function dateLabel(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat(EVENT_DATE_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(value);
}

function timeLabel(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat(EVENT_DATE_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(value);
}

function timezoneLabel(timezone: string): string {
  if (timezone === "Asia/Jakarta") return "WIB";
  if (timezone === "Asia/Makassar") return "WITA";
  if (timezone === "Asia/Jayapura") return "WIT";
  return timezone;
}

function toAnswer(
  rsvp: GuestAccessDto["rsvps"][number],
): RsvpAnswer | undefined {
  const response = rsvp.response as RsvpResponse;
  if (
    response !== "ATTENDING" &&
    response !== "DECLINED" &&
    response !== "TENTATIVE"
  ) {
    return undefined;
  }
  return {
    response,
    pax: rsvp.pax,
    optimisticVersion: rsvp.optimisticVersion,
  };
}

/**
 * The greeting the guest sees. The household's display name is written for the
 * couple's own reference ("Keluarga Budi Santoso"), so it reads naturally here.
 */
function householdLabel(displayName: string): string | undefined {
  const trimmed = displayName.trim();
  return trimmed === "" ? undefined : `Undangan untuk ${trimmed}`;
}

function events(access: GuestAccessDto): readonly GuestEvent[] {
  const byEventId = new Map(access.rsvps.map((rsvp) => [rsvp.eventId, rsvp]));
  return access.events.map((event) => {
    const existing = byEventId.get(event.id);
    const answer = existing === undefined ? undefined : toAnswer(existing);
    return {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      dateLabel: dateLabel(event.startsAt, event.timezone),
      timeLabel: timeLabel(event.startsAt, event.timezone),
      timezoneLabel: timezoneLabel(event.timezone),
      venueName: event.venueName ?? "",
      ...(event.address === null ? {} : { address: event.address }),
      ...(event.mapUrl === null ? {} : { mapUrl: event.mapUrl }),
      ...(answer === undefined ? {} : { existingResponse: answer }),
    };
  });
}

const INACTIVE_STATE_BY_HOUSEHOLD_STATUS: Record<string, GuestAccessState> = {
  DISABLED: "paused",
  DELETED: "invalid-token",
};

const INACTIVE_STATE_BY_INVITATION_STATUS: Record<string, GuestAccessState> = {
  PAUSED: "paused",
  EXPIRED: "expired",
  ARCHIVED: "expired",
};

/**
 * Turns a resolved household into the context the client renders.
 *
 * A household whose own status is not `ACTIVE` is reported as paused rather than
 * invalid, so the guest is told the link is temporarily unavailable instead of
 * being sent looking for a new one that does not exist.
 */
export function toGuestContext(access: GuestAccessDto): GuestContext {
  const status =
    INACTIVE_STATE_BY_HOUSEHOLD_STATUS[access.status] ??
    (access.invitationStatus === null
      ? undefined
      : INACTIVE_STATE_BY_INVITATION_STATUS[access.invitationStatus]);
  if (status !== undefined) {
    return {
      state: status,
      events: [],
      maxPax: 0,
      guestbook: { enabled: false, status: "unavailable" },
      ...(householdLabel(access.displayName) === undefined
        ? {}
        : { greetingName: access.displayName }),
    };
  }

  // An unpublished invitation is a draft the couple has not sent out yet; the link
  // may well be shared before then, so it reports paused rather than broken.
  if (!access.published) {
    return {
      state: "paused",
      events: [],
      maxPax: 0,
      guestbook: { enabled: false, status: "unavailable" },
      ...(householdLabel(access.displayName) === undefined
        ? {}
        : { greetingName: access.displayName }),
    };
  }

  const guestEvents = events(access);
  const label = householdLabel(access.displayName);

  // A wedding with no events has nothing to confirm and no schedule to show, so the
  // whole guest experience is withheld rather than offering a guestbook over an
  // invitation that cannot be rendered.
  if (guestEvents.length === 0) {
    return {
      state: "provider-unavailable",
      events: [],
      maxPax: 0,
      ...(label === undefined
        ? {}
        : { greetingName: access.displayName, householdLabel: label }),
      guestbook: { enabled: false, status: "unavailable" },
    };
  }

  return {
    state: "ready",
    events: guestEvents,
    maxPax: access.maximumPax,
    ...(label === undefined
      ? {}
      : { greetingName: access.displayName, householdLabel: label }),
    guestbook: { enabled: true, status: "available" },
  };
}

export type GuestContextResolution =
  | Readonly<{ kind: "ok"; context: GuestContext }>
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ kind: "unavailable" }>;

/**
 * Resolves a personalized-link token into a guest context.
 *
 * An absent or malformed token is reported as `invalid` without touching the
 * database, and a lookup failure is `unavailable` so an outage does not read as a
 * revoked link.
 */
export async function resolveGuestContext(
  token: string | undefined,
  invitationSlug: string,
  repository?: GuestAccessRepository,
): Promise<GuestContextResolution> {
  if (token === undefined || token.trim() === "") return { kind: "invalid" };

  try {
    const access = await (
      repository ?? new PrismaGuestAccessRepository()
    ).resolveByToken(token, invitationSlug);
    if (access === null) return { kind: "invalid" };
    return { kind: "ok", context: toGuestContext(access) };
  } catch {
    return { kind: "unavailable" };
  }
}

/** The state shown when a link is present but cannot be used. */
export function invalidGuestContext(): GuestContext {
  return {
    state: "invalid-token",
    events: [],
    maxPax: 0,
    guestbook: { enabled: false, status: "unavailable" },
  };
}

export function unavailableGuestContext(): GuestContext {
  return {
    state: "provider-unavailable",
    events: [],
    maxPax: 0,
    guestbook: { enabled: false, status: "unavailable" },
  };
}

export function rateLimitedGuestContext(): GuestContext {
  return {
    state: "rate-limited",
    events: [],
    maxPax: 0,
    guestbook: { enabled: false, status: "unavailable" },
  };
}

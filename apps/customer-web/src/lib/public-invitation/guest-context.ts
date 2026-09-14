import type { GuestbookAvailability } from "../guestbook/contract";
import type { RsvpAnswer } from "../rsvp/contract";

export type GuestAccessState =
  | "ready"
  | "deadline-approaching"
  | "locked"
  | "paused"
  | "expired"
  | "invalid-token"
  | "rate-limited"
  | "provider-unavailable";

export type GuestEvent = Readonly<{
  id: string;
  title: string;
  startsAt: string;
  dateLabel: string;
  timeLabel: string;
  timezoneLabel: string;
  venueName: string;
  address?: string;
  mapUrl?: string;
  existingResponse?: RsvpAnswer;
}>;

/**
 * Private guest context for the fixture transport.
 *
 * This deliberately contains no raw token, token hash, tenant identifier,
 * contact data, or information belonging to another household. The production
 * transport must preserve this boundary when it replaces the fixture.
 */
export type GuestContext = Readonly<{
  state: GuestAccessState;
  events: readonly GuestEvent[];
  maxPax: number;
  greetingName?: string;
  householdLabel?: string;
  rsvpDeadlineLabel?: string;
  guestbook: GuestbookAvailability;
}>;

export function hasInteractiveRsvp(context: GuestContext): boolean {
  return (
    context.state === "ready" ||
    context.state === "deadline-approaching" ||
    context.state === "locked"
  );
}

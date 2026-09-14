import type { InvitationViewModel } from "@wedding/template-engine";
import type { GuestbookSimulation } from "../guestbook/stub-transport";
import type {
  GuestContext,
  GuestEvent,
  GuestAccessState,
} from "./guest-context";
import type { RsvpAnswer, RsvpResponse } from "../rsvp/contract";
import type { RsvpSimulation } from "../rsvp/stub-transport";
import {
  getPublicInvitationFixture,
  type PublicInvitationFixture,
} from "./fixtures";

export const GUEST_EXPERIENCE_FIXTURES = [
  "normal",
  "already-responded",
  "mixed-responses",
  "deadline-approaching",
  "locked",
  "paused",
  "expired",
  "invalid-token",
  "rate-limited",
  "provider-unavailable",
  "submission-failed",
  "stale",
  "guestbook-rejected",
  "guestbook-rate-limited",
  "guestbook-xss",
] as const;

export type GuestExperienceFixture = (typeof GUEST_EXPERIENCE_FIXTURES)[number];

export type GuestExperienceFixtureResult = Readonly<{
  context: GuestContext;
  rsvpSimulation: RsvpSimulation;
  guestbookSimulation: GuestbookSimulation;
}>;

const EVENT_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
] as const;

function parseLocalDateTime(
  value: string,
): [number, number, number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  if (!year || !month || !day || !hour || !minute) return null;
  return [
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
  ];
}

function dateLabel(value: string, locale: string): string {
  const parts = parseLocalDateTime(value);
  if (!parts) return value;
  const [year, month, day] = parts;
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function timeLabel(value: string, locale: string): string {
  const parts = parseLocalDateTime(value);
  if (!parts) return value;
  const [, , , hour, minute] = parts;
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

function timezoneLabel(timezone: string): string {
  if (timezone === "Asia/Jakarta") return "WIB";
  if (timezone === "Asia/Makassar") return "WITA";
  if (timezone === "Asia/Jayapura") return "WIT";
  return timezone;
}

function answer(
  response: RsvpResponse,
  pax: number,
  optimisticVersion = 1,
): RsvpAnswer {
  return { response, pax, optimisticVersion };
}

function eventContext(
  event: InvitationViewModel["events"][number],
  index: number,
  existingResponse?: RsvpAnswer,
): GuestEvent {
  const base = {
    id: EVENT_IDS[index] ?? `event-${index + 1}`,
    title: event.title,
    startsAt: event.startsAt,
    dateLabel: dateLabel(event.startsAt, "id-ID"),
    timeLabel: timeLabel(event.startsAt, "id-ID"),
    timezoneLabel: timezoneLabel(event.timezone ?? "Asia/Jakarta"),
    venueName: event.venueName,
    ...(event.address ? { address: event.address } : {}),
    ...(event.mapUrl ? { mapUrl: event.mapUrl } : {}),
  } satisfies GuestEvent;
  return existingResponse ? { ...base, existingResponse } : base;
}

function activeContext(
  model: InvitationViewModel,
  state: Extract<
    GuestAccessState,
    "ready" | "deadline-approaching" | "locked"
  > = "ready",
  responses: readonly (RsvpAnswer | undefined)[] = [],
): GuestContext {
  return {
    state,
    events: model.events.map((event, index) =>
      eventContext(event, index, responses[index]),
    ),
    maxPax: 2,
    greetingName: "Keluarga Rahman",
    householdLabel: "Undangan untuk Keluarga Rahman",
    rsvpDeadlineLabel: "11 September 2026, pukul 23.59 WIB",
    guestbook: { enabled: true, status: "available" },
  };
}

function unavailableContext(
  state: Exclude<GuestAccessState, "ready" | "deadline-approaching" | "locked">,
): GuestContext {
  return {
    state,
    events: [],
    maxPax: 0,
    guestbook: { enabled: false, status: "unavailable" },
  };
}

export function isGuestExperienceFixture(
  value: string | undefined,
): value is GuestExperienceFixture {
  return (
    value !== undefined &&
    GUEST_EXPERIENCE_FIXTURES.includes(value as GuestExperienceFixture)
  );
}

export function getGuestExperienceFixture(
  publicFixture: PublicInvitationFixture,
  fixture: GuestExperienceFixture = "normal",
): GuestExperienceFixtureResult {
  const model = getPublicInvitationFixture(publicFixture);
  const responded = [
    answer("ATTENDING", 2),
    answer("DECLINED", 0),
    answer("TENTATIVE", 0),
  ] as const;

  switch (fixture) {
    case "already-responded":
      return {
        context: activeContext(model, "ready", responded),
        rsvpSimulation: "success",
        guestbookSimulation: "success",
      };
    case "mixed-responses":
      return {
        context: activeContext(model, "ready", [responded[0], responded[2]]),
        rsvpSimulation: "success",
        guestbookSimulation: "success",
      };
    case "deadline-approaching":
      return {
        context: activeContext(model, "deadline-approaching"),
        rsvpSimulation: "success",
        guestbookSimulation: "success",
      };
    case "locked":
      return {
        context: activeContext(model, "locked", responded),
        rsvpSimulation: "success",
        guestbookSimulation: "success",
      };
    case "paused":
    case "expired":
    case "invalid-token":
    case "rate-limited":
    case "provider-unavailable":
      return {
        context: unavailableContext(fixture),
        rsvpSimulation: "success",
        guestbookSimulation: "success",
      };
    case "submission-failed":
      return {
        context: activeContext(model),
        rsvpSimulation: "submission-failed",
        guestbookSimulation: "success",
      };
    case "stale":
      return {
        context: activeContext(model, "ready", [responded[0]]),
        rsvpSimulation: "stale",
        guestbookSimulation: "success",
      };
    case "guestbook-rejected":
      return {
        context: activeContext(model),
        rsvpSimulation: "success",
        guestbookSimulation: "rejected",
      };
    case "guestbook-rate-limited":
      return {
        context: activeContext(model),
        rsvpSimulation: "success",
        guestbookSimulation: "rate-limited",
      };
    case "guestbook-xss":
      return {
        context: activeContext(model),
        rsvpSimulation: "success",
        guestbookSimulation: "success",
      };
    case "normal":
      return {
        context: activeContext(model),
        rsvpSimulation: "success",
        guestbookSimulation: "success",
      };
  }
}

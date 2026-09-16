import {
  PrismaOnboardingRepository,
  type OnboardingDataDto,
} from "@wedding/database";
import type {
  OnboardingData,
  OnboardingDraft,
  OnboardingPort,
  OnboardingPorts,
} from "@wedding/application";

/**
 * Composition root for the onboarding use-cases.
 *
 * The use-cases in `@wedding/application` declare structural ports and must not
 * import `@wedding/database`; this module is the one place that binds them, which
 * keeps the dependency arrows pointing inward.
 *
 * The two sides disagree about how "not given" is spelled, and the disagreement
 * is deliberate rather than an oversight:
 *
 *   - the application contract models an unset date as `null`, because "no date"
 *     and "an empty date" are the same absence;
 *   - the database DTO models it as `""`, because it round-trips straight into
 *     form controls that must never receive `null`.
 *
 * The translation lives here so neither side adopts the other's convention. Both
 * directions are written out field by field: a field added to either contract
 * then fails to compile here until it is mapped, instead of silently crossing
 * the boundary undefined.
 */

/** `""` (database: not given) → `null` (application: absent). */
function toNull(value: string): string | null {
  return value === "" ? null : value;
}

function toApplicationDraft(
  draft: Readonly<{
    weddingId: string;
    version: number;
    completed: boolean;
    firstEventId: string | null;
    data: OnboardingDataDto;
  }>,
): OnboardingDraft {
  return {
    weddingId: draft.weddingId,
    version: draft.version,
    completed: draft.completed,
    firstEventId: draft.firstEventId,
    data: {
      partner1Name: draft.data.partner1Name,
      partner2Name: draft.data.partner2Name,
      weddingDate: toNull(draft.data.weddingDate),
      weddingDateUndecided: draft.data.weddingDateUndecided,
      eventType: draft.data.eventType,
      eventDate: toNull(draft.data.eventDate),
      eventTime: toNull(draft.data.eventTime),
      city: draft.data.city,
      timezone: draft.data.timezone,
      venueName: draft.data.venueName,
      venueAddress: draft.data.venueAddress,
      locale: draft.data.locale,
    },
  };
}

/**
 * Full data, as required to seal onboarding. The partial variant below cannot
 * reuse this: `complete` writes every column unconditionally, so accepting a
 * partial here would persist `undefined` as a value.
 */
function toDatabaseData(data: OnboardingData): OnboardingDataDto {
  return {
    partner1Name: data.partner1Name,
    partner2Name: data.partner2Name,
    weddingDate: data.weddingDate ?? "",
    weddingDateUndecided: data.weddingDateUndecided,
    eventType: data.eventType,
    eventDate: data.eventDate ?? "",
    eventTime: data.eventTime ?? "",
    city: data.city,
    timezone: data.timezone,
    venueName: data.venueName,
    venueAddress: data.venueAddress,
    locale: data.locale,
  };
}

/**
 * Only the fields the step owns. `null` becomes `""` for the date columns, and
 * absent keys stay absent so a partial step never clears a column it does not
 * own.
 */
function toDatabasePatch(
  data: Partial<OnboardingData>,
): Partial<OnboardingDataDto> {
  return {
    ...(data.partner1Name === undefined
      ? {}
      : { partner1Name: data.partner1Name }),
    ...(data.partner2Name === undefined
      ? {}
      : { partner2Name: data.partner2Name }),
    ...(data.weddingDate === undefined
      ? {}
      : { weddingDate: data.weddingDate ?? "" }),
    ...(data.weddingDateUndecided === undefined
      ? {}
      : { weddingDateUndecided: data.weddingDateUndecided }),
    ...(data.eventType === undefined ? {} : { eventType: data.eventType }),
    ...(data.eventDate === undefined
      ? {}
      : { eventDate: data.eventDate ?? "" }),
    ...(data.eventTime === undefined
      ? {}
      : { eventTime: data.eventTime ?? "" }),
    ...(data.city === undefined ? {} : { city: data.city }),
    ...(data.timezone === undefined ? {} : { timezone: data.timezone }),
    ...(data.venueName === undefined ? {} : { venueName: data.venueName }),
    ...(data.venueAddress === undefined
      ? {}
      : { venueAddress: data.venueAddress }),
    ...(data.locale === undefined ? {} : { locale: data.locale }),
  };
}

function onboardingPort(): OnboardingPort {
  const repository = new PrismaOnboardingRepository();

  return {
    loadDraft: async (scope) => {
      const draft = await repository.loadDraft(scope);
      return draft === null ? null : toApplicationDraft(draft);
    },
    saveStep: (scope, command) =>
      repository.saveStep(scope, {
        step: command.step,
        data: toDatabasePatch(command.data),
        baseVersion: command.baseVersion,
      }),
    complete: async (scope, command) => {
      const result = await repository.complete(scope, {
        data: toDatabaseData(command.data),
        baseVersion: command.baseVersion,
      });
      if (!result.ok) return result;

      // The repository echoes the patch it was handed. Re-reading the row is
      // what proves what was actually stored — including `status` and
      // `onboardingCompletedAt`, which the wizard never sends.
      const saved = await repository.loadDraft(scope);
      if (saved === null) return { ok: false, reason: "NOT_FOUND" };

      return {
        ok: true,
        version: saved.version,
        data: toApplicationDraft(saved).data,
      };
    },
  };
}

export function getOnboardingPorts(): OnboardingPorts {
  return { onboarding: onboardingPort() };
}

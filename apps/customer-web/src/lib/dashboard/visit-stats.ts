import {
  ANALYTICS_REPORT_MAX_EVENTS,
  analyticsDayKey,
  summarizeInvitationViewsByDay,
} from "@wedding/analytics";
import { PrismaAnalyticsRepository } from "@wedding/database";
import { guestRequestScope } from "../guests/request";
import { resolveSessionWorkspaceOrNull } from "../workspace/session-workspace";
import {
  VISIT_STATS_TIME_ZONE,
  VISIT_STATS_WINDOW_DAYS,
  type VisitStatsLoad,
} from "./visit-stats-contract";

/**
 * Invitation-view statistics for the dashboard chart.
 *
 * The figures are the tenant's own accepted `invitation_viewed` analytics events,
 * counted per calendar day. The read goes through the analytics repository, which
 * applies the `tenantId` scope, so a session can only ever chart its own
 * invitation. No aggregate is stored: the window is small and bounded, and the
 * analytics domain deliberately keeps the outbox as its only write model.
 *
 * The loader degrades to `unavailable` rather than reporting a partial or
 * truncated series. An empty series is a legitimate `ok` result — it means no
 * guest has opened the invitation yet, which the panel states plainly.
 */

const DAY_MS = 24 * 60 * 60 * 1_000;

/** Calendar days, oldest first, ending on `now`'s day in the report zone. */
export function visitDayKeys(
  now: Date,
  days: number,
  timeZone: string,
): readonly string[] {
  const today = analyticsDayKey(now, timeZone);
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    keys.push(addDays(today, -offset));
  }
  return keys;
}

/**
 * UTC instants that certainly contain every event of the requested day keys.
 *
 * Day keys are calendar days in the report zone while the repository filters on
 * UTC instants, so the range is padded by a day on each side. The padding is
 * harmless: an event that falls outside the requested keys is ignored by the
 * summarizer, never folded into a neighbouring day.
 */
export function visitStatsRange(
  now: Date,
  days: number,
): Readonly<{ from: Date; to: Date }> {
  return {
    from: new Date(now.getTime() - (days + 1) * DAY_MS),
    to: new Date(now.getTime() + DAY_MS),
  };
}

function addDays(ymd: string, delta: number): string {
  const [yearText, monthText, dayText] = ymd.split("-");
  if (
    yearText === undefined ||
    monthText === undefined ||
    dayText === undefined
  ) {
    return ymd;
  }
  const date = new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText) + delta),
  );
  if (!Number.isFinite(date.getTime())) return ymd;
  return date.toISOString().slice(0, 10);
}

export async function loadVisitStatsForSession(
  now: Date = new Date(),
): Promise<VisitStatsLoad> {
  const { request } = await guestRequestScope();
  if (request === null) return { kind: "unauthenticated" };

  const workspace = await resolveSessionWorkspaceOrNull();
  if (workspace === null) return { kind: "unavailable" };

  try {
    const events = await new PrismaAnalyticsRepository().listAccepted(
      { tenantId: workspace.context.tenantId },
      visitStatsRange(now, VISIT_STATS_WINDOW_DAYS),
    );
    // The repository returns one row past the bound so an oversized window is an
    // explicit refusal instead of a silently truncated chart.
    if (events.length > ANALYTICS_REPORT_MAX_EVENTS) {
      return { kind: "unavailable" };
    }

    const report = summarizeInvitationViewsByDay(events, {
      dayKeys: visitDayKeys(
        now,
        VISIT_STATS_WINDOW_DAYS,
        VISIT_STATS_TIME_ZONE,
      ),
      timeZone: VISIT_STATS_TIME_ZONE,
    });

    return {
      kind: "ok",
      data: { total: report.total, peak: report.peak, days: report.days },
    };
  } catch {
    return { kind: "unavailable" };
  }
}

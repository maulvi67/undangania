/**
 * Visit-statistics contract shared by the server loader and the dashboard
 * component.
 *
 * This module is deliberately free of database, session, and Node imports so the
 * client component can read the window constants without pulling the loader's
 * dependency graph into the browser bundle. The server-only half lives in
 * `./visit-stats`.
 */

/** Days of history the loader reads; the UI narrows this to one period below. */
export const VISIT_STATS_WINDOW_DAYS = 30;

/** Selectable chart windows, in days. Never larger than the loaded window. */
export const VISIT_STATS_PERIODS = [7, 14, 30] as const;

export const VISIT_STATS_DEFAULT_PERIOD = 14;

/**
 * Day buckets follow the product's default event zone. The session workspace
 * resolver does not expose the wedding's IANA zone, and this is the same fallback
 * the dashboard countdown already uses for a workspace without one.
 */
export const VISIT_STATS_TIME_ZONE = "Asia/Jakarta";

export type VisitDayStat = Readonly<{
  /** Calendar day, `YYYY-MM-DD`. */
  date: string;
  views: number;
}>;

export type VisitStatsSummary = Readonly<{
  total: number;
  peak: number;
  days: readonly VisitDayStat[];
}>;

export type VisitStatsLoad =
  | Readonly<{ kind: "ok"; data: VisitStatsSummary }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{ kind: "unavailable" }>;

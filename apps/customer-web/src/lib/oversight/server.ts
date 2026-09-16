import { PrismaOversightRepository } from "@wedding/database";
import { hasAnyRole } from "@wedding/application";
import { guestRequestScope } from "../guests/request";
import { GUEST_READ_ROLES } from "../guests/outcomes";
import { resolveSessionWorkspaceOrNull } from "../workspace/session-workspace";

/**
 * Oversight reads: the couple's own RSVP answers and guestbook queue.
 *
 * Same scope rule as the roster — the tenant and wedding come from the session, never
 * from the request — so a couple can only ever see their own invitation's data.
 */

async function scopeFor(): Promise<
  | Readonly<{ kind: "ok"; tenantId: string; weddingId: string }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{ kind: "unavailable" }>
> {
  const { request } = await guestRequestScope();
  if (request === null) return { kind: "unauthenticated" };
  if (!hasAnyRole(request.context, GUEST_READ_ROLES)) {
    return { kind: "unauthenticated" };
  }

  const workspace = await resolveSessionWorkspaceOrNull();
  if (workspace === null) return { kind: "unavailable" };

  return {
    kind: "ok",
    tenantId: workspace.context.tenantId,
    weddingId: workspace.weddingId,
  };
}

export type RsvpOverview = Awaited<
  ReturnType<PrismaOversightRepository["loadRsvp"]>
>;
export type GuestbookOverview = Awaited<
  ReturnType<PrismaOversightRepository["loadGuestbook"]>
>;

export type RsvpOverviewLoad =
  | Readonly<{ kind: "ok"; data: RsvpOverview }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{ kind: "unavailable" }>;

export type GuestbookOverviewLoad =
  | Readonly<{ kind: "ok"; data: GuestbookOverview }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{ kind: "unavailable" }>;

export async function loadRsvpOverview(): Promise<RsvpOverviewLoad> {
  const scope = await scopeFor();
  if (scope.kind !== "ok") return { kind: scope.kind };

  try {
    return {
      kind: "ok",
      data: await new PrismaOversightRepository().loadRsvp({
        tenantId: scope.tenantId,
        weddingId: scope.weddingId,
      }),
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function loadGuestbookOverview(): Promise<GuestbookOverviewLoad> {
  const scope = await scopeFor();
  if (scope.kind !== "ok") return { kind: scope.kind };

  try {
    return {
      kind: "ok",
      data: await new PrismaOversightRepository().loadGuestbook({
        tenantId: scope.tenantId,
        weddingId: scope.weddingId,
      }),
    };
  } catch {
    return { kind: "unavailable" };
  }
}

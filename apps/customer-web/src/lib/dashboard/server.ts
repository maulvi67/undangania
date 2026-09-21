import {
  PrismaDashboardRepository,
  type DashboardAggregateDto,
} from "@wedding/database";
import { guestRequestScope } from "../guests/request";
import { resolveSessionWorkspaceOrNull } from "../workspace/session-workspace";
import {
  activeUntilDate,
  dashboardAggregateSchema,
  invitationLifecycleSchema,
  type DashboardAggregate,
  type DashboardLoad,
  type DashboardRole,
  type InvitationLifecycle,
} from "./contract";

/**
 * Dashboard loader.
 *
 * Replaces the development fixture transport on `/dashboard`. Scope is the
 * session's own workspace, so the page cannot be pointed at another tenant.
 *
 * The aggregate is assembled defensively at two levels. The repository reports a
 * per-section `null` when one read fails, and this module maps that onto the
 * contract's `unavailable` variant so a single failing panel degrades on its own
 * rather than blanking the page. An infrastructure failure that takes out the
 * workspace read itself is reported as `unavailable` for the whole page.
 *
 * Two contract fields are derived rather than stored, because the schema does not
 * carry them:
 *
 *   - `contentComplete` comes from the invitation's publication count. A stored
 *     draft that has never been published is, by definition, not complete enough to
 *     send — which is the same threshold the editor's readiness rules enforce.
 *   - `activeUntil` is the event date plus the active period, matching what the
 *     editor's publish flow already promises the customer.
 */

/** The dashboard's role union; a `FINANCE` member sees the owner view. */
function dashboardRole(roles: readonly string[]): DashboardRole {
  return roles.includes("OWNER") ? "OWNER" : "EDITOR";
}

function lifecycleFor(status: string): InvitationLifecycle {
  const parsed = invitationLifecycleSchema.safeParse(status);
  // `ARCHIVED` is a stored status the dashboard's lifecycle union does not carry;
  // an archived invitation is reported as expired, which is what it means to a
  // customer. Any other unrecognized value falls back to `DRAFT` rather than
  // claiming the invitation is live.
  if (parsed.success) return parsed.data;
  return status === "ARCHIVED" ? "EXPIRED" : "DRAFT";
}

function toAggregate(
  aggregate: DashboardAggregateDto,
  roles: readonly string[],
): DashboardAggregate {
  const invitation = aggregate.invitation;
  const payment = aggregate.payment;
  const guests = aggregate.guests;
  const rsvp = aggregate.rsvp;

  return {
    role: dashboardRole(roles),
    workspace: {
      coupleNames: aggregate.workspace.coupleNames,
      weddingDate: aggregate.workspace.weddingDate,
      timezone: aggregate.workspace.timezone,
      city: aggregate.workspace.city,
    },
    invitation:
      invitation === null
        ? { status: "unavailable" }
        : {
            status: "ok",
            data: {
              status: lifecycleFor(invitation.status),
              slug: invitation.slug,
              templateName: invitation.templateName,
              contentComplete: invitation.publishedAt !== null,
              publishedAt: invitation.publishedAt?.toISOString() ?? null,
              // The public address comes from the tenant-scoped invitation row;
              // only a published lifecycle may expose it as a customer action.
              publicUrl:
                invitation.publishedAt !== null &&
                (invitation.status === "PUBLISHED" ||
                  invitation.status === "PAUSED" ||
                  invitation.status === "EXPIRED")
                  ? `/invite/${invitation.slug}`
                  : null,
              activeUntil: activeUntilDate(aggregate.workspace.weddingDate),
            },
          },
    payment:
      payment === null
        ? { status: "unavailable" }
        : {
            status: "ok",
            // Any state other than a verified paid row reads as pending, because
            // only a confirmed payment is allowed to look settled.
            data: { state: payment.paid ? "OK" : "PENDING" },
          },
    guests:
      guests === null
        ? { status: "unavailable" }
        : {
            status: "ok",
            data: {
              guestCount: guests.guestCount,
              householdCount: guests.householdCount,
            },
          },
    rsvp:
      rsvp === null
        ? { status: "unavailable" }
        : {
            status: "ok",
            data: {
              invited: rsvp.invited,
              attending: rsvp.attending,
              declined: rsvp.declined,
              tentative: rsvp.tentative,
              pending: rsvp.pending,
            },
          },
  };
}

export async function loadDashboardForSession(): Promise<DashboardLoad> {
  const { request } = await guestRequestScope();
  if (request === null) return { kind: "unauthenticated" };

  try {
    const workspace = await resolveSessionWorkspaceOrNull();
    if (workspace === null) return { kind: "unavailable" };

    const aggregate = await new PrismaDashboardRepository().load({
      tenantId: workspace.context.tenantId,
      weddingId: workspace.weddingId,
    });
    if (aggregate === null) return { kind: "unavailable" };

    // Parsed before it is returned so a value the client contract cannot describe
    // fails here rather than inside a component.
    const parsed = dashboardAggregateSchema.safeParse(
      toAggregate(aggregate, request.context.roles),
    );
    if (!parsed.success) return { kind: "unavailable" };

    return { kind: "ok", data: parsed.data };
  } catch {
    return { kind: "unavailable" };
  }
}

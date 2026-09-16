import {
  PrismaGuestRosterRepository,
  type RosterOverviewDto,
  type RosterWorkspaceDto,
} from "@wedding/database";
import { hasAnyRole, type RequestAuthContext } from "@wedding/application";
import { GUEST_READ_ROLES } from "./request";
import { resolveSessionWorkspaceOrNull } from "../workspace/session-workspace";
import {
  guestListItemSchema,
  type GuestDetailLoadResult,
  type GuestHouseholdDetail,
  type GuestHouseholdListItem,
  type GuestLoadResult,
  type GuestManagementData,
  type GuestRole,
} from "./contract";
import { getGuestCapabilitySet } from "./fixtures";

/**
 * Guest-management loader.
 *
 * This replaces the development fixture transport on the `/tamu` routes. Scope is
 * resolved from the session's own workspace — the tenant and wedding never come
 * from the request — so a caller cannot address another workspace's roster.
 *
 * Two contract fields have no database backing and are reported as empty rather
 * than invented:
 *
 *   - `tags`: there is no tag table. The filter that consumes them therefore
 *     matches nothing, which is the honest result of "no tags exist".
 *   - per-household event access: there is no such table either, so every
 *     household is listed against every event of its wedding. See
 *     `PrismaGuestRosterRepository` for why that is the only defensible reading.
 */

/**
 * Roles that may read the roster, re-exported for callers that gate a page.
 * `VIEWER` reads but does not write.
 */
export { GUEST_READ_ROLES };

export type GuestRequestScope = Readonly<{
  /** The session's auth context, or null when signed out. */
  context: RequestAuthContext | null;
}>;

function guestRole(context: RequestAuthContext): GuestRole {
  if (context.roles.includes("OWNER")) return "OWNER";
  if (context.roles.includes("EDITOR")) return "EDITOR";
  return "VIEWER";
}

function toListItem(
  household: Readonly<{
    id: string;
    displayName: string;
    maximumPax: number;
    memberCount: number;
    linkStatus: "ACTIVE" | "DISABLED";
    updatedAt: Date;
  }>,
  eventNames: readonly string[],
): GuestHouseholdListItem {
  return {
    id: household.id,
    displayName: household.displayName,
    memberCount: household.memberCount,
    maximumPax: household.maximumPax,
    eventNames,
    tags: [],
    linkStatus: household.linkStatus,
    updatedAt: household.updatedAt.toISOString(),
  };
}

/**
 * The header label. The wedding's own display name is preferred, and the couple's
 * names are used when it is still the provisioning default — a workspace the
 * couple has not named yet should not be introduced by a placeholder.
 */
function headerLabels(wedding: RosterWorkspaceDto | null): {
  workspaceName: string;
  coupleNames: string;
} {
  const displayName = wedding?.displayName.trim() ?? "";
  const workspaceName =
    displayName === "" ? "Workspace pernikahan" : displayName;
  return { workspaceName, coupleNames: wedding?.coupleNames ?? workspaceName };
}

function managementData(
  overview: RosterOverviewDto,
  role: GuestRole,
  labels: Readonly<{ workspaceName: string; coupleNames: string }>,
): GuestManagementData {
  const eventNames = overview.events.map((event) => event.title);
  return {
    workspaceName: labels.workspaceName,
    coupleNames: labels.coupleNames,
    events: overview.events.map((event) => ({
      id: event.id,
      title: event.title,
    })),
    // No tag table exists, so the filter is a no-op rather than a fiction.
    tags: [],
    households: overview.households.map((household) =>
      guestListItemSchema.parse(toListItem(household, eventNames)),
    ),
    totalGuests: overview.totalGuests,
    role,
    capabilities: getGuestCapabilitySet(role),
    notice: null,
  };
}

export async function loadGuestManagement(
  scope: GuestRequestScope,
): Promise<GuestLoadResult> {
  if (scope.context === null) return { kind: "unauthenticated" };
  if (!hasAnyRole(scope.context, GUEST_READ_ROLES))
    return { kind: "forbidden" };

  try {
    const workspace = await resolveSessionWorkspaceOrNull();
    if (workspace === null) return { kind: "unauthenticated" };

    const repository = new PrismaGuestRosterRepository();
    const rosterScope = {
      tenantId: workspace.context.tenantId,
      weddingId: workspace.weddingId,
    };
    const [wedding, overview] = await Promise.all([
      repository.loadWorkspace(rosterScope),
      repository.loadOverview(rosterScope),
    ]);

    return {
      kind: "ok",
      data: managementData(
        overview,
        guestRole(scope.context),
        headerLabels(wedding),
      ),
    };
  } catch {
    // A database outage must not surface as an error boundary on a management page.
    return { kind: "unavailable" };
  }
}

export async function loadGuestHouseholdDetail(
  scope: GuestRequestScope,
  householdId: string,
): Promise<GuestDetailLoadResult> {
  if (scope.context === null) return { kind: "unauthenticated" };
  if (!hasAnyRole(scope.context, GUEST_READ_ROLES))
    return { kind: "forbidden" };

  try {
    const workspace = await resolveSessionWorkspaceOrNull();
    if (workspace === null) return { kind: "unauthenticated" };

    const repository = new PrismaGuestRosterRepository();
    const rosterScope = {
      tenantId: workspace.context.tenantId,
      weddingId: workspace.weddingId,
    };
    const [wedding, overview, household] = await Promise.all([
      repository.loadWorkspace(rosterScope),
      repository.loadOverview(rosterScope),
      repository.findById(rosterScope, householdId),
    ]);
    // A household outside the scope resolves to `null`, reported as not-found so a
    // guessed id cannot confirm the row exists under another workspace.
    if (household === null) return { kind: "not-found" };

    const role = guestRole(scope.context);
    const eventNames = overview.events.map((event) => event.title);
    const detail: GuestHouseholdDetail = {
      ...guestListItemSchema.parse(toListItem(household, eventNames)),
      members: household.members.map((member) => ({
        id: member.id,
        displayName: member.displayName,
        category:
          member.category === "CHILD"
            ? "CHILD"
            : member.category === "OTHER"
              ? "OTHER"
              : "ADULT",
      })),
      eventIds: overview.events.map((event) => event.id),
      // Contacts are stored encrypted and are never decrypted for display, so the
      // UI reports presence rather than a masked value it cannot actually derive.
      phoneMasked: household.hasPhone ? "Tersimpan" : null,
      emailMasked: household.hasEmail ? "Tersimpan" : null,
      tokenVersion: household.tokenVersion,
    };

    return {
      kind: "ok",
      data: {
        household: detail,
        management: managementData(overview, role, headerLabels(wedding)),
        // Read from the session workspace rather than the household, because the
        // link has to point at the wedding's own published address.
        invitationSlug: workspace.invitationSlug,
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}

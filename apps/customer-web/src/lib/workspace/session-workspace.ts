import { toTenantContext } from "@wedding/application";
import {
  PrismaWeddingWorkspaceRepository,
  type WeddingWorkspaceRepository,
} from "@wedding/database";
import type { TenantContext } from "@wedding/domain";
import {
  getAuthenticatedRequest,
  type AuthenticatedRequest,
} from "../auth/server";

/**
 * Trusted workspace resolution for signed-in customer pages.
 *
 * The customer routes operate on "the wedding this session owns". That
 * identifier must never come from the request body or query string: a
 * client-supplied `weddingId` would let one tenant write to another's row, since
 * the database repositories only assert the tenant scope of the value they are
 * handed. It is therefore derived here from the session's own membership, and
 * every caller receives an already-scoped {@link TenantContext}.
 *
 * A signed-out visitor and a session whose tenant has no wedding both resolve to
 * `null`; callers fail closed rather than inventing a workspace.
 */

export type SessionWorkspace = Readonly<{
  request: AuthenticatedRequest;
  context: TenantContext;
  weddingId: string;
  /** Null until the couple picks a design; not an error. */
  invitationId: string | null;
  /** The public address once an invitation exists. */
  invitationSlug: string | null;
  onboardingCompleted: boolean;
}>;

/**
 * Resolves the authenticated session's workspace.
 *
 * `repository` is injectable so the rules can be tested against a fake without a
 * database, matching how the repositories themselves are tested.
 */
export async function resolveSessionWorkspace(
  repository: WeddingWorkspaceRepository = new PrismaWeddingWorkspaceRepository(),
): Promise<SessionWorkspace | null> {
  const request = await getAuthenticatedRequest();
  if (request === null) return null;

  const { tenantId } = request.membership;
  const wedding = await repository.resolveForTenant(tenantId);
  if (wedding === null) return null;

  const invitation = await repository.resolveInvitation(tenantId);

  return {
    request,
    context: toTenantContext(request.context, tenantId),
    weddingId: wedding.weddingId,
    invitationId: invitation?.invitationId ?? null,
    invitationSlug: invitation?.slug ?? null,
    onboardingCompleted: wedding.onboardingCompletedAt !== null,
  };
}

/**
 * Same as {@link resolveSessionWorkspace} but tolerates an infrastructure
 * failure: a database outage returns `null` so the caller renders its own
 * unavailable state instead of an error boundary.
 */
export async function resolveSessionWorkspaceOrNull(
  repository?: WeddingWorkspaceRepository,
): Promise<SessionWorkspace | null> {
  try {
    return await resolveSessionWorkspace(repository);
  } catch {
    return null;
  }
}

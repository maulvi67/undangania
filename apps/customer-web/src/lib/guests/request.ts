import {
  getAuthenticatedRequest,
  type AuthenticatedRequest,
} from "../auth/server";
import type { MemberRole } from "@wedding/application";

/**
 * Roles that may read the guest roster. `VIEWER` reads but does not write.
 *
 * Declared here rather than in `server.ts` so this module has no dependency on the
 * loader it feeds.
 */
export const GUEST_READ_ROLES = [
  "OWNER",
  "EDITOR",
  "VIEWER",
] as const satisfies readonly MemberRole[];

/** Roles that may mutate the roster or the personalized link. */
export const GUEST_WRITE_ROLES = [
  "OWNER",
  "EDITOR",
] as const satisfies readonly MemberRole[];

/**
 * Reads the caller's roster scope from the session.
 *
 * The auth context is carried rather than a pre-computed boolean so every caller
 * runs the same `hasAnyRole` check against the session's own roles — a decision
 * made once and passed down is what lets a page and its action drift apart.
 *
 * A signed-out visitor resolves to a null context rather than an error, so each
 * page renders its own sign-in panel instead of being redirected generically.
 */
export async function guestRequestScope(): Promise<
  Readonly<{ request: AuthenticatedRequest | null }>
> {
  return { request: await getAuthenticatedRequest(GUEST_READ_ROLES) };
}

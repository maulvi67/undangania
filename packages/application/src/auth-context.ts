import type { TenantContext } from "@wedding/domain";
import {
  AuthRequiredError,
  ForbiddenError,
  TenantMismatchError,
} from "./errors";

export const MEMBER_ROLES = [
  "OWNER",
  "EDITOR",
  "VIEWER",
  "FINANCE",
  "SUPPORT",
  "ADMIN",
  "VENDOR_OPERATOR",
  "RESELLER",
] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

export type RequestAuthContext = Readonly<{
  actorId: string;
  sessionId: string;
  tenantId?: string;
  roles: readonly MemberRole[];
}>;

export type TenantRequestAuthContext = Readonly<{
  actorId: string;
  sessionId: string;
  tenantId: string;
  roles: readonly MemberRole[];
}>;

export type RequestAuthContextInput = Readonly<{
  actorId: string;
  sessionId: string;
  tenantId?: string;
  roles: readonly MemberRole[];
}>;

export function createRequestAuthContext(
  input: RequestAuthContextInput,
): RequestAuthContext {
  return {
    actorId: input.actorId,
    sessionId: input.sessionId,
    ...(input.tenantId === undefined ? {} : { tenantId: input.tenantId }),
    roles: [...input.roles],
  };
}

export function requireAuthenticated(
  context: RequestAuthContext | null | undefined,
): RequestAuthContext {
  if (context === null || context === undefined) {
    throw new AuthRequiredError();
  }

  return context;
}

export function requireTenant(
  context: RequestAuthContext | null | undefined,
  tenantId: string,
): TenantRequestAuthContext {
  const authenticated = requireAuthenticated(context);

  if (authenticated.tenantId !== tenantId) {
    throw new TenantMismatchError();
  }

  return {
    actorId: authenticated.actorId,
    sessionId: authenticated.sessionId,
    tenantId,
    roles: authenticated.roles,
  };
}

export function toTenantContext(
  context: RequestAuthContext | null | undefined,
  tenantId: string,
): TenantContext {
  const tenantContext = requireTenant(context, tenantId);
  return {
    tenantId: tenantContext.tenantId,
    actorId: tenantContext.actorId,
    roles: tenantContext.roles,
  };
}

export function hasRole(
  context: RequestAuthContext | null | undefined,
  role: MemberRole,
): boolean {
  return context?.roles.includes(role) ?? false;
}

export function hasAnyRole(
  context: RequestAuthContext | null | undefined,
  roles: readonly MemberRole[],
): boolean {
  return roles.some((role) => hasRole(context, role));
}

export function requireRole(
  context: RequestAuthContext | null | undefined,
  role: MemberRole,
): RequestAuthContext {
  const authenticated = requireAuthenticated(context);

  if (!hasRole(authenticated, role)) {
    throw new ForbiddenError();
  }

  return authenticated;
}

export function requireAnyRole(
  context: RequestAuthContext | null | undefined,
  roles: readonly MemberRole[],
): RequestAuthContext {
  const authenticated = requireAuthenticated(context);

  if (!hasAnyRole(authenticated, roles)) {
    throw new ForbiddenError();
  }

  return authenticated;
}

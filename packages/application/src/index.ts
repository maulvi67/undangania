import type { TenantContext } from "@wedding/domain";

export interface UnitOfWork {
  transaction<T>(work: () => Promise<T>): Promise<T>;
}

export interface AuthorizationPort {
  assert(
    context: TenantContext,
    permission: string,
    resourceId: string,
  ): Promise<void>;
}

export interface AuditPort {
  append(event: {
    tenantId?: string;
    actorId: string;
    action: string;
    targetId: string;
    reason?: string;
  }): Promise<void>;
}
export {
  ApplicationError,
  AuthRequiredError,
  ForbiddenError,
  TenantMismatchError,
  type ApplicationErrorCode,
} from "./errors";
export {
  createRequestAuthContext,
  hasAnyRole,
  hasRole,
  requireAnyRole,
  requireAuthenticated,
  requireRole,
  requireTenant,
  toTenantContext,
  MEMBER_ROLES,
  type MemberRole,
  type RequestAuthContext,
  type RequestAuthContextInput,
  type TenantRequestAuthContext,
} from "./auth-context";

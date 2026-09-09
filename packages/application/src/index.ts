import type { TenantContext } from "@wedding/domain";
export interface UnitOfWork { transaction<T>(work: () => Promise<T>): Promise<T>; }
export interface AuthorizationPort { assert(context: TenantContext, permission: string, resourceId: string): Promise<void>; }
export interface AuditPort { append(event: { tenantId?: string; actorId: string; action: string; targetId: string; reason?: string }): Promise<void>; }

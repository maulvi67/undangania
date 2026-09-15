export * from "./money";
export type TenantContext = Readonly<{
  tenantId: string;
  actorId: string;
  roles: readonly string[];
}>;
export type DomainEvent<T = unknown> = Readonly<{
  id: string;
  type: string;
  aggregateId: string;
  occurredAt: string;
  version: number;
  payload: T;
}>;

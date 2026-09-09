export type RepositoryContext={tenantId:string;actorId:string};
export interface TenantScopedRepository<T>{findById(context:RepositoryContext,id:string):Promise<T|null>}

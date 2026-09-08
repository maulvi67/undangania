export type TenantContext=Readonly<{tenantId:string;actorId:string;roles:readonly string[]}>;
export type Money=Readonly<{amountMinor:bigint;currency:"IDR"}>;

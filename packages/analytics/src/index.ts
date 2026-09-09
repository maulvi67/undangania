export interface AnalyticsPort { track(event:{name:string;anonymousActorId?:string;tenantIdHash?:string;properties:Record<string,string|number|boolean>}):Promise<void>; }
export const prohibitedPropertyNames=["name","email","phone","guestToken","accountNumber","message"] as const;

export type Job = { id: string; type: string; tenantId?: string; payloadVersion: number; idempotencyKey: string };
export async function processJob(job: Job): Promise<void> { if (!job.idempotencyKey) throw new Error("Missing idempotency key"); console.info("job.accepted", { id: job.id, type: job.type }); }

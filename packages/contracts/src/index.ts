import { z } from "zod";
export const tenantIdSchema = z.string().uuid();
export const rsvpCommandSchema = z.object({
  guestToken: z.string().min(32).max(512),
  eventId: z.string().uuid(),
  response: z.enum(["ATTENDING", "DECLINED", "TENTATIVE"]),
  pax: z.number().int().min(0).max(20),
  idempotencyKey: z.string().min(16).max(128),
});
export type RsvpCommand = z.infer<typeof rsvpCommandSchema>;
export const notificationSchema = z.object({
  tenantId: z.string().uuid(),
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  templateCode: z.string().min(1),
  recipientRef: z.string().min(1),
  variables: z.record(z.string(), z.string()),
});

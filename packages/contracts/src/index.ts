import {z} from "zod";
export const rsvpSchema=z.object({guestToken:z.string().min(32),eventId:z.string().uuid(),response:z.enum(["ATTENDING","DECLINED","TENTATIVE"]),pax:z.number().int().min(0).max(20),idempotencyKey:z.string().min(16)});

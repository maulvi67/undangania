import { z } from "zod";
export const invitationViewModelSchema = z.object({ schemaVersion: z.literal(1), locale: z.string(), timezone: z.string(), couple: z.object({ displayNames: z.string().min(1).max(250) }), events: z.array(z.object({ id: z.string(), title: z.string(), startsAt: z.string(), venueName: z.string() })), sections: z.array(z.object({ id: z.string(), type: z.string(), visible: z.boolean(), payload: z.unknown() })) });
export type InvitationViewModel = z.infer<typeof invitationViewModelSchema>;
export interface TemplateManifest { id: string; version: string; contractVersion: number; name: string; category: string; supportedSections: readonly string[]; }
export interface TemplateRenderer<TOutput> { manifest: TemplateManifest; render(model: InvitationViewModel): TOutput; }

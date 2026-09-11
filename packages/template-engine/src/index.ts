import { z } from "zod";

/**
 * Canonical, renderer-facing invitation model.
 *
 * The model intentionally contains validated presentation data rather than
 * database records. Public publication snapshots and draft previews may both
 * be rendered through this boundary without exposing tenant internals.
 */

export const invitationSectionTypeSchema = z.enum([
  "hero",
  "couple",
  "events",
  "venue",
  "cover",
  "story",
  "gallery",
  "music",
  "gift",
  "faq",
  "guestbook",
  "rsvp",
  "closing",
]);

export type InvitationSectionType = z.infer<typeof invitationSectionTypeSchema>;

export const invitationSectionPayloadSchema = z
  .object({
    title: z.string().max(250).optional(),
    body: z.string().max(10000).optional(),
    visible: z.boolean().optional(),
    assetIds: z.array(z.string().min(1).max(200)).max(100).optional(),
    items: z.array(z.record(z.string(), z.unknown())).max(100).optional(),
  })
  .passthrough();

export type InvitationSectionPayload = z.infer<
  typeof invitationSectionPayloadSchema
>;

export const invitationSectionSchema = z.object({
  id: z.string().min(1).max(100),
  type: invitationSectionTypeSchema,
  visible: z.boolean(),
  payload: invitationSectionPayloadSchema,
});

export const invitationViewModelSchema = z.object({
  schemaVersion: z.literal(1),
  locale: z.string().min(2).max(20),
  timezone: z.string().min(1).max(100),
  couple: z
    .object({
      displayNames: z.string().min(1).max(250),
      partner1Name: z.string().max(120).optional(),
      partner2Name: z.string().max(120).optional(),
    })
    .passthrough(),
  events: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        title: z.string().min(1).max(250),
        eventType: z.string().max(100).optional(),
        startsAt: z.string().min(1).max(80),
        endsAt: z.string().max(80).optional(),
        timezone: z.string().max(100).optional(),
        venueName: z.string().max(250),
        address: z.string().max(1000).optional(),
        mapUrl: z.string().max(2000).optional(),
      }),
    )
    .max(50),
  sections: z.array(invitationSectionSchema).max(30),
});

export type InvitationViewModel = z.infer<typeof invitationViewModelSchema>;

export const templateManifestSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  contractVersion: z.number().int().positive(),
  name: z.string().min(1),
  category: z.string().min(1),
  supportedSections: z.array(z.string().min(1)).min(1),
  requiredSections: z.array(z.string().min(1)).optional(),
  reorderableSections: z.array(z.string().min(1)).optional(),
  sectionOrder: z.array(z.string().min(1)).optional(),
});

export type TemplateManifest = Omit<
  z.infer<typeof templateManifestSchema>,
  | "supportedSections"
  | "requiredSections"
  | "reorderableSections"
  | "sectionOrder"
> & {
  readonly supportedSections: readonly string[];
  readonly requiredSections?: readonly string[];
  readonly reorderableSections?: readonly string[];
  readonly sectionOrder?: readonly string[];
};

export interface TemplateRenderer<TOutput> {
  manifest: TemplateManifest;
  render(model: InvitationViewModel): TOutput;
}

export { TemplateRegistry } from "./registry";

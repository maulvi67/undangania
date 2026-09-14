import { z } from "zod";
import { invitationViewModelSchema } from "@wedding/template-engine";
import type { PreviewMessage } from "./contract";

const requestIdSchema = z.string().min(1).max(120);

export const previewMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("EDITOR_PREVIEW_INIT"),
    protocolVersion: z.literal(1),
    requestId: requestIdSchema,
    templateId: z.string().min(1).max(100),
    templateVersion: z.string().min(1).max(100),
    model: invitationViewModelSchema,
  }),
  z.object({
    type: z.literal("EDITOR_PREVIEW_UPDATE"),
    protocolVersion: z.literal(1),
    requestId: requestIdSchema,
    templateId: z.string().min(1).max(100),
    templateVersion: z.string().min(1).max(100),
    changedSections: z.array(z.string().min(1).max(100)).max(30),
    model: invitationViewModelSchema,
  }),
  z.object({
    type: z.literal("EDITOR_PREVIEW_REQUEST_REFRESH"),
    protocolVersion: z.literal(1),
    requestId: requestIdSchema,
  }),
  z.object({
    type: z.literal("PREVIEW_READY"),
    protocolVersion: z.literal(1),
    requestId: requestIdSchema,
  }),
  z.object({
    type: z.literal("PREVIEW_RENDERED"),
    protocolVersion: z.literal(1),
    requestId: requestIdSchema,
  }),
  z.object({
    type: z.literal("PREVIEW_ERROR"),
    protocolVersion: z.literal(1),
    requestId: requestIdSchema,
    message: z.string().max(500),
  }),
]);

export function parsePreviewMessage(input: unknown): PreviewMessage | null {
  const parsed = previewMessageSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function createPreviewRequestId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `preview-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isSameOrigin(origin: string, expectedOrigin: string): boolean {
  return origin === expectedOrigin;
}

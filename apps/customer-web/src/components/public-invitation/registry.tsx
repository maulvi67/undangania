import type { ReactNode } from "react";
import {
  TemplateRegistry,
  invitationViewModelSchema,
  type InvitationViewModel,
} from "@wedding/template-engine";
import { seruniRenderer } from "./seruni-template";

const registry = new TemplateRegistry<ReactNode>();
registry.register(seruniRenderer);

export type PublicationSnapshotInput = Readonly<{
  templateId: string;
  templateVersion: string;
  contractVersion: number;
  model: unknown;
}>;

export function renderPublicationSnapshot(snapshot: PublicationSnapshotInput): ReactNode {
  const model: InvitationViewModel = invitationViewModelSchema.parse(snapshot.model);
  if (snapshot.contractVersion !== seruniRenderer.manifest.contractVersion) {
    throw new Error("Unsupported invitation contract version");
  }
  return registry.get(snapshot.templateId, snapshot.templateVersion).render(model);
}

export function getRegisteredTemplateIds(): readonly string[] {
  return [seruniRenderer.manifest.id];
}

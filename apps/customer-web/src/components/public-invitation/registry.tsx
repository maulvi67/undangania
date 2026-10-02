import type { ReactNode } from "react";
import {
  TemplateRegistry,
  invitationViewModelSchema,
  type InvitationMedia,
  type InvitationViewModel,
} from "@wedding/template-engine";
import {
  kenangaRenderer,
  naraRenderer,
  seruniRenderer,
} from "./seruni-template";

const renderers = [seruniRenderer, naraRenderer, kenangaRenderer] as const;
const registry = new TemplateRegistry<ReactNode>();
for (const renderer of renderers) registry.register(renderer);

export type PublicationSnapshotInput = Readonly<{
  templateId: string;
  templateVersion: string;
  contractVersion: number;
  model: unknown;
  media?: readonly InvitationMedia[];
}>;

export function renderPublicationSnapshot(
  snapshot: PublicationSnapshotInput,
): ReactNode {
  const model: InvitationViewModel = invitationViewModelSchema.parse(
    snapshot.model,
  );
  const renderer = registry.get(snapshot.templateId, snapshot.templateVersion);
  if (snapshot.contractVersion !== renderer.manifest.contractVersion) {
    throw new Error("Unsupported invitation contract version");
  }
  return renderer.render(
    model,
    snapshot.media === undefined ? {} : { media: snapshot.media },
  );
}

export function getRegisteredTemplateIds(): readonly string[] {
  return renderers.map((renderer) => renderer.manifest.id);
}

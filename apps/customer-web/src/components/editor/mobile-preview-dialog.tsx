import { Dialog } from "@wedding/ui";
import type { InvitationViewModel } from "@wedding/template-engine";
import type { EditorTemplate } from "../../lib/editor/contract";
import { EditorPreview } from "./editor-preview";

export function MobilePreviewDialog({
  model,
  template,
}: {
  model: InvitationViewModel;
  template: EditorTemplate;
}) {
  return (
    <div className="ed-mobile-preview-trigger">
      <Dialog
        triggerLabel="Lihat pratinjau"
        triggerVariant="secondary"
        title="Pratinjau undangan"
      >
        <p className="ed-preview-note">
          Pratinjau ini memakai draf tervalidasi dan hanya terlihat oleh Anda.
        </p>
        <EditorPreview model={model} template={template} mode="phone" />
      </Dialog>
    </div>
  );
}

import type { InvitationViewModel } from "@wedding/template-engine";
import type { EditorTemplate } from "../../lib/editor/contract";
import { EditorPreview } from "./editor-preview";

export function DevicePreview({
  model,
  template,
  mode,
  onModeChange,
}: {
  model: InvitationViewModel;
  template: EditorTemplate;
  mode: "phone" | "desktop";
  onModeChange: (mode: "phone" | "desktop") => void;
}) {
  return (
    <div className="ed-preview">
      <div className="ed-preview__header">
        <div>
          <p className="ed-panel__eyebrow">Pratinjau langsung</p>
          <h2>Hasil undangan</h2>
        </div>
        <span className="ed-preview__sample">Draf privat</span>
      </div>
      <p className="ed-preview-note">
        Perubahan pada formulir akan tercermin di sini setelah draf diperbarui.
      </p>
      <fieldset className="ed-device-switch">
        <legend>Ukuran pratinjau</legend>
        <label
          className={
            mode === "phone"
              ? "ed-device-switch__label ed-device-switch__label--active"
              : "ed-device-switch__label"
          }
        >
          <input
            type="radio"
            name="editor-preview-device"
            value="phone"
            checked={mode === "phone"}
            onChange={() => onModeChange("phone")}
          />
          Ponsel
        </label>
        <label
          className={
            mode === "desktop"
              ? "ed-device-switch__label ed-device-switch__label--active"
              : "ed-device-switch__label"
          }
        >
          <input
            type="radio"
            name="editor-preview-device"
            value="desktop"
            checked={mode === "desktop"}
            onChange={() => onModeChange("desktop")}
          />
          Desktop
        </label>
      </fieldset>
      <EditorPreview model={model} template={template} mode={mode} />
    </div>
  );
}

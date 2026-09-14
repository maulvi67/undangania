import { Input, Textarea } from "@wedding/ui";
import type { EditorContent } from "../../../lib/editor/contract";
import type { EditorPatch } from "../editor-form";

export function SectionCouple({
  content,
  onChange,
}: {
  content: EditorContent;
  onChange: (patch: EditorPatch) => void;
}) {
  return (
    <div className="ed-section-content">
      <div className="ed-form-grid ed-form-grid--two">
        <Input
          id="editor-partner-one"
          label="Nama mempelai pertama"
          required
          autoComplete="given-name"
          value={content.couple.partner1Name}
          onChange={(event) =>
            onChange({
              couple: {
                ...content.couple,
                partner1Name: event.currentTarget.value,
              },
            })
          }
        />
        <Input
          id="editor-partner-two"
          label="Nama mempelai kedua"
          required
          autoComplete="additional-name"
          value={content.couple.partner2Name}
          onChange={(event) =>
            onChange({
              couple: {
                ...content.couple,
                partner2Name: event.currentTarget.value,
              },
            })
          }
        />
      </div>
      <Textarea
        id="editor-couple-intro"
        label="Pengantar undangan"
        hint="Opsional. Tulis kalimat singkat untuk menyambut tamu Anda."
        value={content.couple.intro}
        onChange={(event) =>
          onChange({
            couple: { ...content.couple, intro: event.currentTarget.value },
          })
        }
      />
      <p className="ed-form-note">
        Nama kedua mempelai diperlukan sebelum undangan dapat diterbitkan. Draf
        yang belum lengkap tetap dapat disimpan.
      </p>
    </div>
  );
}

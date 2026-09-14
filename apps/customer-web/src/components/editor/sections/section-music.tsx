import { Checkbox, Input } from "@wedding/ui";
import type { EditorContent } from "../../../lib/editor/contract";
import type { EditorPatch } from "../editor-form";

export function SectionMusic({
  content,
  onChange,
}: {
  content: EditorContent;
  onChange: (patch: EditorPatch) => void;
}) {
  return (
    <div className="ed-section-content">
      <Checkbox
        id="editor-music-visible"
        label="Tampilkan bagian musik"
        hint="Tamu akan memilih sendiri kapan musik diputar; tidak ada autoplay."
        checked={content.music.visible}
        onChange={(event) =>
          onChange({
            music: { ...content.music, visible: event.currentTarget.checked },
          })
        }
      />
      <Checkbox
        id="editor-music-enabled"
        label="Aktifkan musik"
        checked={content.music.enabled}
        onChange={(event) =>
          onChange({
            music: { ...content.music, enabled: event.currentTarget.checked },
          })
        }
      />
      <Input
        id="editor-music-url"
        label="Tautan musik"
        hint="Gunakan URL yang Anda miliki hak untuk membagikannya."
        type="url"
        inputMode="url"
        value={content.music.url}
        onChange={(event) =>
          onChange({
            music: { ...content.music, url: event.currentTarget.value },
          })
        }
      />
      <p className="ed-form-note">
        MVP ini hanya menyimpan tautan musik yang tervalidasi. Integrasi
        provider dan pemeriksaan hak cipta memerlukan layanan backend terpisah.
      </p>
    </div>
  );
}

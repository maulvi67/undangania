import { Checkbox, Input, Textarea } from "@wedding/ui";
import type { EditorContent } from "../../../lib/editor/contract";
import type { EditorPatch } from "../editor-form";

export function SectionStory({
  content,
  onChange,
}: {
  content: EditorContent;
  onChange: (patch: EditorPatch) => void;
}) {
  return (
    <div className="ed-section-content">
      <Checkbox
        id="editor-story-visible"
        label="Tampilkan bagian kisah"
        hint="Bagian ini opsional dan dapat disembunyikan kapan saja."
        checked={content.story.visible}
        onChange={(event) =>
          onChange({
            story: { ...content.story, visible: event.currentTarget.checked },
          })
        }
      />
      <Input
        id="editor-story-title"
        label="Judul bagian"
        value={content.story.title}
        onChange={(event) =>
          onChange({
            story: { ...content.story, title: event.currentTarget.value },
          })
        }
      />
      <Textarea
        id="editor-story-body"
        label="Cerita singkat"
        hint="Tulis dengan kata-kata Anda sendiri."
        value={content.story.body}
        onChange={(event) =>
          onChange({
            story: { ...content.story, body: event.currentTarget.value },
          })
        }
      />
    </div>
  );
}

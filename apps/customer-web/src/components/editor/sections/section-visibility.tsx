import { Checkbox } from "@wedding/ui";
import type {
  EditorContent,
  EditorSectionConfig,
} from "../../../lib/editor/contract";
import type { EditorPatch } from "../editor-form";

const LABELS: Record<string, string> = {
  hero: "Pembuka",
  couple: "Mempelai",
  events: "Acara",
  venue: "Lokasi & peta",
  cover: "Sampul",
  story: "Kisah",
  gallery: "Galeri",
  music: "Musik",
  gift: "Hadiah",
  faq: "FAQ",
  guestbook: "Buku tamu",
  rsvp: "RSVP",
  closing: "Penutup",
};

export function SectionVisibility({
  content,
  onChange,
}: {
  content: EditorContent;
  onChange: (patch: EditorPatch) => void;
}) {
  const update = (section: EditorSectionConfig, visible: boolean) =>
    onChange({
      sections: content.sections.map((item) =>
        item.id === section.id ? { ...item, visible } : item,
      ),
    });
  return (
    <div className="ed-section-content">
      <p className="ed-form-note">
        Bagian wajib seperti mempelai dan acara harus tetap terlihat untuk dapat
        diterbitkan. Bagian lain dapat disembunyikan tanpa menghapus isinya.
      </p>
      <div className="ed-choice-list">
        {content.sections.map((section) => (
          <Checkbox
            key={section.id}
            id={`editor-visibility-${section.id}`}
            label={LABELS[section.type] ?? section.type}
            hint={
              section.visible
                ? "Tampil di undangan"
                : "Disembunyikan, data tetap tersimpan"
            }
            checked={section.visible}
            onChange={(event) => update(section, event.currentTarget.checked)}
          />
        ))}
      </div>
    </div>
  );
}

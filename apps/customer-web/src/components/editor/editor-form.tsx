import type {
  EditorContent,
  EditorSectionId,
  EditorTemplate,
} from "../../lib/editor/contract";
import { EditorSectionStatus } from "./editor-section-status";
import { SectionCouple } from "./sections/section-couple";
import { SectionEvents } from "./sections/section-events";
import { SectionVenue } from "./sections/section-venue";
import { SectionCover } from "./sections/section-cover";
import { SectionStory } from "./sections/section-story";
import { SectionGallery } from "./sections/section-gallery";
import { SectionMusic } from "./sections/section-music";
import { SectionGift } from "./sections/section-gift";
import { SectionFaq } from "./sections/section-faq";
import { SectionVisibility } from "./sections/section-visibility";
import { SectionOrder } from "./sections/section-order";
import { SectionSettings } from "./sections/section-settings";
import type { EditorMediaState } from "../../lib/editor/contract";

export type EditorPatch =
  Partial<EditorContent> | ((content: EditorContent) => Partial<EditorContent>);

const descriptions: Record<EditorSectionId, string> = {
  couple: "Nama dan pengantar menjadi dasar tampilan undangan Anda.",
  events: "Tambahkan acara yang ingin Anda tampilkan kepada tamu.",
  venue: "Sertakan lokasi, alamat, dan tautan peta bila sudah tersedia.",
  cover: "Kelola media pembuka dengan format dan ukuran yang aman.",
  story: "Bagikan cerita singkat bila Anda ingin menambah konteks untuk tamu.",
  gallery: "Pilih foto yang ingin ditampilkan di galeri undangan.",
  music: "Tambahkan tautan musik pilihan tanpa memutar audio otomatis.",
  gift: "Sediakan informasi tanda kasih bila diperlukan.",
  faq: "Jawab pertanyaan yang paling mungkin muncul dari tamu.",
  visibility: "Atur bagian mana yang tampil di undangan publik.",
  order: "Atur urutan bagian yang memang disediakan oleh desain ini.",
  settings: "Kelola judul, alamat undangan, bahasa, dan gaya dasar.",
};

export function EditorForm({
  content,
  template,
  activeSection,
  onChange,
  onUploadState,
}: {
  content: EditorContent;
  template: EditorTemplate;
  activeSection: EditorSectionId;
  onChange: (patch: EditorPatch) => void;
  onUploadState: (state: EditorMediaState | null) => void;
}) {
  return (
    <section className="ed-form" aria-labelledby="ed-form-title">
      <header className="ed-form__header">
        <div>
          <p className="ed-panel__eyebrow">{template.name}</p>
          <h2 id="ed-form-title">{descriptions[activeSection]}</h2>
        </div>
        <EditorSectionStatus
          content={content}
          section={activeSection}
          template={template}
        />
      </header>
      <div className="ed-form__body">
        {activeSection === "couple" ? (
          <SectionCouple content={content} onChange={onChange} />
        ) : null}
        {activeSection === "events" ? (
          <SectionEvents content={content} onChange={onChange} />
        ) : null}
        {activeSection === "venue" ? (
          <SectionVenue content={content} onChange={onChange} />
        ) : null}
        {activeSection === "cover" ? (
          <SectionCover
            content={content}
            onChange={onChange}
            onUploadState={onUploadState}
          />
        ) : null}
        {activeSection === "story" ? (
          <SectionStory content={content} onChange={onChange} />
        ) : null}
        {activeSection === "gallery" ? (
          <SectionGallery content={content} onChange={onChange} />
        ) : null}
        {activeSection === "music" ? (
          <SectionMusic content={content} onChange={onChange} />
        ) : null}
        {activeSection === "gift" ? (
          <SectionGift content={content} onChange={onChange} />
        ) : null}
        {activeSection === "faq" ? (
          <SectionFaq content={content} onChange={onChange} />
        ) : null}
        {activeSection === "visibility" ? (
          <SectionVisibility content={content} onChange={onChange} />
        ) : null}
        {activeSection === "order" ? (
          <SectionOrder
            content={content}
            template={template}
            onChange={onChange}
          />
        ) : null}
        {activeSection === "settings" ? (
          <SectionSettings content={content} onChange={onChange} />
        ) : null}
      </div>
    </section>
  );
}

import { Button } from "@wedding/ui";
import type {
  EditorContent,
  EditorTemplate,
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
};

export function SectionOrder({
  content,
  template,
  onChange,
}: {
  content: EditorContent;
  template: EditorTemplate;
  onChange: (patch: EditorPatch) => void;
}) {
  const allowed = template.manifest.reorderableSections ?? [];
  const move = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    const current = content.sections[index];
    const target = content.sections[targetIndex];
    if (
      !current ||
      !target ||
      !allowed.includes(current.type) ||
      !allowed.includes(target.type)
    )
      return;
    const sections = [...content.sections];
    sections[index] = target;
    sections[targetIndex] = current;
    onChange({ sections });
  };

  return (
    <div className="ed-section-content">
      <p className="ed-form-note">
        Urutan hanya dapat diubah untuk bagian yang diizinkan oleh desain.
        Tombol ini tidak mengubah isi atau fungsi inti undangan.
      </p>
      {allowed.length === 0 ? (
        <p className="ed-inline-note">
          Desain ini tidak menyediakan pengaturan urutan bagian.
        </p>
      ) : null}
      <ol className="ed-order-list">
        {content.sections.map((section, index) => {
          const reorderable = allowed.includes(section.type);
          return (
            <li
              className={`ed-order-item${reorderable ? "" : " ed-order-item--fixed"}`}
              key={section.id}
            >
              <span className="ed-order-item__number">{index + 1}</span>
              <span className="ed-order-item__label">
                {LABELS[section.type] ?? section.type}
              </span>
              <span className="ed-order-item__actions">
                {reorderable ? (
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() => move(index, -1)}
                    disabled={
                      index === 0 ||
                      !allowed.includes(content.sections[index - 1]?.type ?? "")
                    }
                  >
                    Naik
                  </Button>
                ) : null}
                {reorderable ? (
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() => move(index, 1)}
                    disabled={
                      index === content.sections.length - 1 ||
                      !allowed.includes(content.sections[index + 1]?.type ?? "")
                    }
                  >
                    Turun
                  </Button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

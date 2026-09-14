import {
  EDITOR_SECTION_LABELS,
  sectionStatus,
  type EditorContent,
  type EditorSectionId,
  type EditorTemplate,
} from "../../lib/editor/contract";

const STATUS_LABELS = {
  complete: "Lengkap",
  incomplete: "Belum lengkap",
  optional: "Opsional",
  attention: "Perlu diperiksa",
  locked: "Tidak tersedia",
} as const;

export function SectionNavigation({
  content,
  template,
  activeSection,
  onSelect,
}: {
  content: EditorContent;
  template: EditorTemplate;
  activeSection: EditorSectionId;
  onSelect: (section: EditorSectionId) => void;
}) {
  return (
    <nav className="ed-navigation" aria-label="Bagian editor undangan">
      <div className="ed-navigation__intro">
        <p className="ed-navigation__eyebrow">Isi bertahap</p>
        <h2>Bagian undangan</h2>
        <p>
          Lengkapi bagian wajib terlebih dahulu. Bagian lain dapat diisi kapan
          saja.
        </p>
      </div>
      <ol className="ed-navigation__list">
        {(Object.keys(EDITOR_SECTION_LABELS) as EditorSectionId[]).map(
          (section) => {
            const status = sectionStatus(content, section, template.manifest);
            return (
              <li key={section}>
                <button
                  type="button"
                  className={`ed-navigation__item${activeSection === section ? " ed-navigation__item--active" : ""}`}
                  aria-current={activeSection === section ? "step" : undefined}
                  onClick={() => onSelect(section)}
                >
                  <span className="ed-navigation__item-main">
                    <span className="ed-navigation__item-title">
                      {EDITOR_SECTION_LABELS[section]}
                    </span>
                    <span
                      className={`ed-navigation__status ed-navigation__status--${status}`}
                    >
                      <span
                        aria-hidden="true"
                        className="ed-navigation__status-mark"
                      />
                      {STATUS_LABELS[status]}
                    </span>
                  </span>
                  <span className="ed-navigation__number" aria-hidden="true">
                    {String(
                      (
                        Object.keys(EDITOR_SECTION_LABELS) as EditorSectionId[]
                      ).indexOf(section) + 1,
                    ).padStart(2, "0")}
                  </span>
                </button>
              </li>
            );
          },
        )}
      </ol>
    </nav>
  );
}

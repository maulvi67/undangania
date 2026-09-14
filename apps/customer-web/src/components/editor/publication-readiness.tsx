import { Alert, Button } from "@wedding/ui";
import type {
  PublicationReadiness,
  EditorSectionId,
} from "../../lib/editor/contract";

export function PublicationReadiness({
  readiness,
  onSelect,
}: {
  readiness: PublicationReadiness;
  onSelect: (section: EditorSectionId) => void;
}) {
  if (readiness.ready) {
    return (
      <section
        className="ed-readiness ed-readiness--ready"
        aria-labelledby="ed-readiness-title"
      >
        <div>
          <p className="ed-panel__eyebrow">Pemeriksaan publikasi</p>
          <h2 id="ed-readiness-title">Siap diperiksa sebelum terbit</h2>
          <p>
            Data wajib sudah tersedia. Publikasi tetap dilakukan melalui langkah
            terpisah setelah Anda memeriksa pratinjau.
          </p>
        </div>
        <span className="ed-readiness__mark" aria-hidden="true">
          ✓
        </span>
      </section>
    );
  }

  return (
    <section className="ed-readiness" aria-labelledby="ed-readiness-title">
      <div className="ed-readiness__heading">
        <div>
          <p className="ed-panel__eyebrow">Pemeriksaan publikasi</p>
          <h2 id="ed-readiness-title">Masih ada yang perlu dilengkapi</h2>
        </div>
        <span className="ed-readiness__count">
          {readiness.issues.length} hal
        </span>
      </div>
      <Alert variant="warning" title="Draf tetap aman disimpan">
        Anda dapat melanjutkan mengisi bagian lain. Daftar ini hanya menunjukkan
        data yang diperlukan saat undangan akan diterbitkan.
      </Alert>
      <ul className="ed-issue-list">
        {readiness.issues.map((issue) => (
          <li
            key={`${issue.code}-${issue.section}-${issue.field ?? "section"}`}
          >
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => onSelect(issue.section)}
            >
              {issue.message}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

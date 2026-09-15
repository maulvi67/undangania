import type { TemplateRecord } from "../templates/template-contract";
import { TemplateCard } from "./template-card";

/**
 * Result grid plus the live result count. The count is a polite status so
 * screen readers announce it after each full-page GET re-render.
 */
export function CatalogResults({
  templates,
}: {
  templates: readonly TemplateRecord[];
}) {
  return (
    <section className="ctlg-results" aria-label="Hasil pencarian desain">
      <p className="ctlg-count" role="status">
        Menampilkan {templates.length} desain
      </p>
      <ul className="ctlg-grid">
        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </ul>
    </section>
  );
}

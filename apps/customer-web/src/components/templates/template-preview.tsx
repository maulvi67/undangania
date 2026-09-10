import type { TemplateRecord } from "./template-contract";
import { themeClasses } from "./theme-classes";

/**
 * Large CSS-composed invitation "cover" screen. Decorative by design:
 * it communicates the visual character without implying a real asset.
 * Text content is aria-hidden; the page announces the design in words.
 */
export function TemplatePreview({ template }: { template: TemplateRecord }) {
  return (
    <div className={`${themeClasses(template)} tpl-preview`} aria-hidden="true">
      <span className="tpl-preview__eyebrow">
        {template.category === "Tradisi" ? "Walimatul Urs" : "Undangan Pernikahan"}
      </span>
      <span className="tpl-preview__names">
        Rai <span className="tpl-preview__amp">&amp;</span> Anisa
      </span>
      <span className="tpl-preview__rule" />
      <span className="tpl-preview__date">Sabtu, 12 September 2026</span>
      <span className="tpl-preview__open">Buka Undangan</span>
    </div>
  );
}

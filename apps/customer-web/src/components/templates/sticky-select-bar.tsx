import { LinkButton } from "../marketing/link-button";
import { formatIdr, type TemplateRecord } from "./template-contract";

/**
 * Mobile-only sticky action. Sticky (not fixed) so it occupies flow space,
 * and `scroll-padding-bottom` on <html> (templates.css) keeps focused
 * elements from scrolling underneath it.
 */
export function StickySelectBar({ template }: { template: TemplateRecord }) {
  return (
    <aside className="tpl-sticky" aria-label="Pilih desain ini">
      {template.priceIdr !== null ? (
        <p className="tpl-sticky__price">
          <span className="tpl-sticky__amount">{formatIdr(template.priceIdr)}</span>
          <span className="tpl-sticky__note">harga final</span>
        </p>
      ) : (
        <p className="tpl-sticky__note">Harga belum tersedia</p>
      )}
      {template.priceIdr !== null ? (
        <LinkButton href="/daftar" variant="primary">
          Pilih desain
        </LinkButton>
      ) : null}
    </aside>
  );
}

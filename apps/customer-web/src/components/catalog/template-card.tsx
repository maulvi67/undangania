import { LinkButton } from "../marketing/link-button";
import { TemplatePreview } from "../templates/template-preview";
import {
  TIER_LABELS,
  formatIdr,
  type TemplateRecord,
} from "../templates/template-contract";

/**
 * Catalog card. Information hierarchy per approved plan: visual character
 * first (preview), then identity (category, name, character), then decision
 * data (price + tier note), then actions. No ratings, counts, scarcity, or
 * feature badges — feature parity is explained at section level instead.
 */
export function TemplateCard({ template }: { template: TemplateRecord }) {
  return (
    <li className="ctlg-card">
      <div className="ctlg-card__preview">
        <TemplatePreview template={template} />
      </div>
      <div className="ctlg-card__body">
        <p className="ctlg-card__eyebrow">Desain {template.category}</p>
        <h3 className="ctlg-card__title">
          <a href={`/templates/${template.id}`}>{template.name}</a>
        </h3>
        <p className="ctlg-card__character">{template.designCharacter}</p>
        {template.priceIdr !== null ? (
          <p className="ctlg-card__price">
            <span className="ctlg-card__amount">
              {formatIdr(template.priceIdr)}
            </span>
            <span className="ctlg-card__tier">
              {TIER_LABELS[template.tier]}
            </span>
          </p>
        ) : (
          <p className="ctlg-card__price ctlg-card__price--unavailable">
            Harga belum tersedia
          </p>
        )}
        <div className="ctlg-card__actions">
          {template.demo.available ? (
            <LinkButton
              href={`/templates/${template.id}/demo`}
              variant="secondary"
              size="sm"
            >
              Lihat demo
            </LinkButton>
          ) : null}
          <LinkButton
            href={`/templates/${template.id}`}
            variant="primary"
            size="sm"
          >
            Pilih desain
          </LinkButton>
        </div>
      </div>
    </li>
  );
}

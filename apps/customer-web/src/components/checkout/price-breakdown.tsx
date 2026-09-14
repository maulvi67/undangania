import { formatIdrMinor } from "../../lib/checkout/contract";

export function PriceBreakdown({
  subtotalMinor,
  discountMinor,
  taxMinor,
  totalMinor,
  promotionLabel,
}: {
  subtotalMinor: string;
  discountMinor: string;
  taxMinor: string;
  totalMinor: string;
  promotionLabel?: string;
}) {
  const hasDiscount = discountMinor !== "0";
  const hasTax = taxMinor !== "0";

  return (
    <dl className="ck-price" aria-label="Rincian harga">
      <div className="ck-price__row">
        <dt>Harga desain</dt>
        <dd>{formatIdrMinor(subtotalMinor)}</dd>
      </div>
      {hasDiscount ? (
        <div className="ck-price__row ck-price__row--discount">
          <dt>{promotionLabel ?? "Diskon"}</dt>
          <dd>−{formatIdrMinor(discountMinor)}</dd>
        </div>
      ) : null}
      {hasTax ? (
        <div className="ck-price__row">
          <dt>Pajak</dt>
          <dd>{formatIdrMinor(taxMinor)}</dd>
        </div>
      ) : null}
      <div className="ck-price__row ck-price__row--total">
        <dt>Total</dt>
        <dd>{formatIdrMinor(totalMinor)}</dd>
      </div>
    </dl>
  );
}

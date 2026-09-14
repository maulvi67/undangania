import { Badge } from "@wedding/ui";
import type { CheckoutOrder } from "../../lib/checkout/contract";
import { TemplatePreview } from "../templates/template-preview";
import type { TemplateRecord } from "../templates/template-contract";

export function CheckoutOrderSummary({
  order,
  template,
}: {
  order: CheckoutOrder;
  template: TemplateRecord;
}) {
  return (
    <section className="ck-order" aria-labelledby="ck-order-title">
      <div className="ck-order__preview">
        <TemplatePreview template={template} />
      </div>
      <div className="ck-order__body">
        <div className="ck-order__eyebrow">
          <Badge tone="neutral">{order.templateCategory}</Badge>
          <span>{order.templateTierLabel}</span>
        </div>
        <h2 className="ck-order__title" id="ck-order-title">
          {order.templateName}
        </h2>
        <p className="ck-order__character">{order.templateCharacter}</p>
        <p className="ck-order__note">
          Anda memilih desain berdasarkan karakter visualnya. Semua desain tetap
          mencakup fitur inti undangan digital yang sama.
        </p>
      </div>
    </section>
  );
}

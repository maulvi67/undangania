import { Badge } from "@wedding/ui";
import type {
  DashboardAction,
  DashboardAggregate,
  DerivedStatus,
} from "../../lib/dashboard/contract";

export function NextActions({
  aggregate,
  status,
  actions,
}: {
  aggregate: DashboardAggregate;
  status: DerivedStatus;
  actions: ReadonlyArray<DashboardAction>;
}) {
  const reason =
    status.state === "PAYMENT_PENDING" && aggregate.role === "EDITOR"
      ? "Pemilik undangan perlu menyelesaikan pembayaran agar undangan bisa diterbitkan."
      : status.reason;

  return (
    <section className="dash-next" aria-labelledby="dash-next-title">
      <div className="dash-section__head">
        <div>
          <p className="dash-section__eyebrow">Prioritas workspace</p>
          <h2 className="dash-section__title" id="dash-next-title">
            Langkah berikutnya
          </h2>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="dash-next__reason">{reason}</p>
      {actions.length > 0 ? (
        <ul className="dash-actions" aria-label="Tindakan yang disarankan">
          {actions.map((item) => (
            <li className="dash-action" key={item.id}>
              <div className="dash-action__copy">
                <h3 className="dash-action__title">{item.title}</h3>
                <p className="dash-action__description">{item.description}</p>
              </div>
              <a
                className={`ui-button ui-button--${item.variant} ui-button--md dash-action__link`}
                href={item.href}
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dash-next__quiet">
          {status.state === "PAYMENT_PENDING" && aggregate.role === "EDITOR"
            ? "Pembayaran perlu diselesaikan oleh pemilik workspace."
            : "Tidak ada tindakan pembayaran yang perlu Anda lakukan saat ini."}
        </p>
      )}
    </section>
  );
}

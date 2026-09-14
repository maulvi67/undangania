import type { CheckoutLifecycle } from "../../lib/checkout/contract";

export function CheckoutLifecycle({
  lifecycle,
}: {
  lifecycle: CheckoutLifecycle;
}) {
  return (
    <section className="ck-info-block" aria-labelledby="ck-lifecycle-title">
      <h2 className="ck-info-block__title" id="ck-lifecycle-title">
        Masa aktif undangan
      </h2>
      <p>{lifecycle.explanation}</p>
      <p className="ck-info-block__muted">
        Tanggal mulai dan berakhir yang sebenarnya akan mengikuti data publikasi
        dan tanggal acara di workspace Anda.
      </p>
    </section>
  );
}

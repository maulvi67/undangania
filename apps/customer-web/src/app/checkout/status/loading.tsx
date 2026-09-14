import "../../templates.css";
import "../checkout.css";

export default function PaymentStatusLoading() {
  return (
    <main className="ck-page" aria-busy="true">
      <div className="ui-container">
        <div className="ck-loading" role="status" aria-live="polite">
          <span className="ck-loading__line ck-loading__line--wide" />
          <span className="ck-loading__line" />
          <span className="ck-loading__panel" />
          <span className="ui-visually-hidden">Memuat status pembayaran</span>
        </div>
      </div>
    </main>
  );
}

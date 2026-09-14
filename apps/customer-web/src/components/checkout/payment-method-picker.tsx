export function PaymentMethodPicker() {
  return (
    <fieldset className="ck-methods" aria-describedby="ck-method-description">
      <legend className="ck-panel__title">Metode pembayaran</legend>
      <p className="ck-methods__description" id="ck-method-description">
        Pilih QRIS untuk membayar melalui aplikasi pembayaran yang mendukung
        QRIS.
      </p>
      <label className="ck-method">
        <input type="radio" name="payment-method" value="qris" defaultChecked />
        <span className="ck-method__mark" aria-hidden="true" />
        <span>
          <strong>QRIS</strong>
          <small>
            Konfirmasi pembayaran berasal dari penyedia pembayaran, bukan dari
            halaman redirect.
          </small>
        </span>
      </label>
    </fieldset>
  );
}

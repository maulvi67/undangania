"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@wedding/ui";
import { useRouter } from "next/navigation";
import {
  addMinorUnits,
  formatIdrMinor,
  subtractMinorUnits,
  type CheckoutOrder,
  type CheckoutState,
  type CouponValidation,
} from "../../lib/checkout/contract";
import { validateCoupon } from "../../lib/checkout/stub-transport";
import type { TemplateRecord } from "../templates/template-contract";
import { LinkButton } from "../marketing/link-button";
import { CheckoutLifecycle } from "./checkout-lifecycle";
import { CheckoutOrderSummary } from "./checkout-order-summary";
import { FairUsagePanel } from "./fair-usage-panel";
import { PaymentMethodPicker } from "./payment-method-picker";
import { PriceBreakdown } from "./price-breakdown";
import { SupportLink } from "./support-link";

function stateAlert(state: CheckoutState, orderNumber: string) {
  switch (state) {
    case "ORDER_LOADING":
      return null;
    case "COUPON_VALIDATING":
      return (
        <Alert title="Memeriksa kode promo">
          Rincian harga akan diperbarui setelah pemeriksaan selesai.
        </Alert>
      );
    case "PAYMENT_CREATING":
      return (
        <Alert title="Menyiapkan pembayaran">
          Jangan menutup halaman. Kami sedang membuat sesi QRIS untuk pesanan{" "}
          {orderNumber}.
        </Alert>
      );
    case "PROVIDER_UNAVAILABLE":
      return (
        <Alert variant="error" title="Pembayaran sedang tidak tersedia">
          Pesanan Anda tetap dapat dirujuk dengan nomor {orderNumber}. Silakan
          coba lagi nanti atau hubungi bantuan.
        </Alert>
      );
    case "DUPLICATE_ACTION":
      return (
        <Alert variant="warning" title="Permintaan pembayaran sudah diterima">
          Kami sedang mencegah pembuatan pembayaran ganda. Periksa status
          pesanan sebelum mencoba lagi.
        </Alert>
      );
    case "OFFLINE":
      return (
        <Alert variant="warning" title="Anda sedang offline">
          Periksa koneksi internet Anda. Pesanan tidak akan dianggap dibayar
          hanya karena tombol ditekan.
        </Alert>
      );
    case "COUPON_INVALID":
      return null;
    case "READY":
      return null;
  }
}

function couponAlert(coupon: CouponValidation | null) {
  if (!coupon) return null;
  if (coupon.status === "VALID") {
    return (
      <p className="ck-coupon__success" role="status">
        {coupon.label} berhasil diterapkan.
      </p>
    );
  }
  return (
    <p className="ck-coupon__error" role="alert">
      {coupon.message}
    </p>
  );
}

export function CheckoutView({
  order,
  template,
  initialState,
}: {
  order: CheckoutOrder;
  template: TemplateRecord;
  initialState: CheckoutState;
}) {
  const router = useRouter();
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<CouponValidation | null>(
    initialState === "COUPON_INVALID"
      ? {
          status: "INVALID",
          message: "Kode promo tidak berlaku atau sudah tidak tersedia.",
        }
      : null,
  );
  const [isCouponPending, startCouponTransition] = useTransition();

  const appliedCouponDiscount =
    coupon?.status === "VALID" ? coupon.discountMinor : "0";
  const discountMinor = addMinorUnits(
    order.discountMinor,
    appliedCouponDiscount,
  );
  const totalMinor = subtractMinorUnits(
    order.totalMinor,
    appliedCouponDiscount,
  );
  const isLoading = initialState === "ORDER_LOADING";
  const isBlocked =
    isLoading ||
    initialState === "COUPON_VALIDATING" ||
    initialState === "PAYMENT_CREATING" ||
    initialState === "PROVIDER_UNAVAILABLE" ||
    initialState === "DUPLICATE_ACTION" ||
    initialState === "OFFLINE" ||
    isCouponPending;

  function submitCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startCouponTransition(() => {
      void validateCoupon(couponCode).then(setCoupon);
    });
  }

  function startPayment() {
    if (isBlocked) return;
    // The fixture goes to VERIFYING, never to a paid state. Production must
    // create the payment server-side and use verified provider confirmation.
    router.push(
      `/checkout/status?order=${encodeURIComponent(order.orderNumber)}&template=${encodeURIComponent(order.templateId)}&state=verifying`,
    );
  }

  if (isLoading) {
    return (
      <div className="ck-loading" role="status" aria-live="polite">
        <span className="ck-loading__line ck-loading__line--wide" />
        <span className="ck-loading__line" />
        <span className="ck-loading__panel" />
        <span className="ui-visually-hidden">Memuat rincian pesanan</span>
      </div>
    );
  }

  return (
    <div className="ck-layout">
      <div className="ck-main-column">
        <header className="ck-heading">
          <p className="ck-eyebrow">Langkah 1 dari 2 · Pesanan</p>
          <h1 className="ck-title">Periksa pesanan Anda</h1>
          <p className="ck-lede">
            Pastikan desain dan rincian pembayaran sudah sesuai sebelum
            melanjutkan ke QRIS.
          </p>
        </header>

        <div className="ck-alert-region" aria-live="polite">
          {stateAlert(initialState, order.orderNumber)}
        </div>

        <CheckoutOrderSummary order={order} template={template} />
        <CheckoutLifecycle lifecycle={order.lifecycle} />
        <FairUsagePanel items={order.fairUsage} />

        <section
          className="ck-info-block ck-parity"
          aria-labelledby="ck-parity-title"
        >
          <h2 className="ck-info-block__title" id="ck-parity-title">
            Yang selalu termasuk
          </h2>
          <p>
            Semua desain termasuk Digital Invitation Core: fitur inti untuk
            mengelola undangan, tamu, RSVP, dan buku tamu. Harga tidak
            menentukan kelengkapan fungsi.
          </p>
          <ul className="ck-checklist">
            {order.coreFeatures.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="ck-payment-column" aria-labelledby="ck-payment-title">
        <div className="ck-payment-card">
          <div className="ck-payment-card__head">
            <p className="ck-eyebrow">Pembayaran aman</p>
            <h2 className="ck-panel__title" id="ck-payment-title">
              Selesaikan pesanan
            </h2>
          </div>

          <PriceBreakdown
            subtotalMinor={order.subtotalMinor}
            discountMinor={discountMinor}
            taxMinor={order.taxMinor}
            totalMinor={totalMinor}
            {...(coupon?.status === "VALID"
              ? { promotionLabel: coupon.label }
              : order.promotionLabel
                ? { promotionLabel: order.promotionLabel }
                : {})}
          />

          <form className="ck-coupon" onSubmit={submitCoupon}>
            <label className="ck-coupon__label" htmlFor="ck-promo">
              Kode promo <span>(opsional)</span>
            </label>
            <div className="ck-coupon__control">
              <input
                id="ck-promo"
                className="ck-coupon__input"
                name="promo"
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder="Masukkan kode"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                aria-describedby="ck-promo-hint"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                loading={isCouponPending}
              >
                Terapkan
              </Button>
            </div>
            <p className="ck-coupon__hint" id="ck-promo-hint">
              Kode promo akan divalidasi sebelum harga diperbarui.
            </p>
            {couponAlert(coupon)}
          </form>

          <PaymentMethodPicker />

          <div className="ck-payment-card__total" aria-live="polite">
            <span>Total yang dibayar</span>
            <strong>{formatIdrMinor(totalMinor)}</strong>
          </div>

          <Button
            type="button"
            size="lg"
            className="ck-pay-button"
            loading={initialState === "PAYMENT_CREATING"}
            disabled={isBlocked}
            onClick={startPayment}
          >
            Lanjutkan ke pembayaran
          </Button>
          <p className="ck-payment-card__note">
            Status lunas hanya muncul setelah konfirmasi server dari penyedia
            QRIS. Kembali dari halaman penyedia pembayaran belum berarti
            pembayaran berhasil.
          </p>
          <p className="ck-payment-card__support">
            Perlu bantuan? <SupportLink />
          </p>
        </div>
        <div className="ck-back-link">
          <LinkButton
            href={`/templates/${template.id}`}
            variant="tertiary"
            size="sm"
          >
            ← Kembali ke detail desain
          </LinkButton>
        </div>
      </aside>
    </div>
  );
}

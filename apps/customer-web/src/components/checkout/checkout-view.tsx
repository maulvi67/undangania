"use client";

import { useRef, useState, useTransition } from "react";
import { Alert, Button } from "@wedding/ui";
import { useRouter } from "next/navigation";
import {
  addMinorUnits,
  formatIdrMinor,
  subtractMinorUnits,
} from "../../lib/checkout/contract";
import type {
  CheckoutOrder,
  CheckoutState,
  CouponValidation,
} from "../../lib/checkout/contract";
import { startCheckoutAction } from "../../lib/checkout/actions";
import type { CheckoutActionOutcome } from "../../lib/checkout/outcomes";
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
          Jangan menutup halaman. Kami sedang membuat sesi QRIS
          {orderNumber === "" ? "" : ` untuk pesanan ${orderNumber}`}.
        </Alert>
      );
    case "PROVIDER_UNAVAILABLE":
      return (
        <Alert variant="error" title="Pembayaran sedang tidak tersedia">
          {orderNumber === ""
            ? "Pesanan belum dibuat dan tidak ada pembayaran yang berjalan. Silakan coba lagi nanti."
            : `Pesanan Anda tetap dapat dirujuk dengan nomor ${orderNumber}. Silakan coba lagi nanti atau hubungi bantuan.`}
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

/**
 * Maps a checkout outcome onto the view's own state machine.
 *
 * `not-found` is reported as provider-unavailable rather than a coupon error: the
 * purchase button was pressed, so the useful message is "this cannot be paid right
 * now", not a complaint about a promotion field the customer may not have touched.
 */
function stateFor(outcome: CheckoutActionOutcome): CheckoutState {
  switch (outcome.kind) {
    case "created":
      return "READY";
    case "invalid":
      return "COUPON_INVALID";
    case "duplicate":
      return "DUPLICATE_ACTION";
    case "not-found":
    case "provider-unavailable":
    case "unavailable":
      return "PROVIDER_UNAVAILABLE";
    case "unauthenticated":
      return "DUPLICATE_ACTION";
  }
}

function messageFor(outcome: CheckoutActionOutcome): string | null {
  switch (outcome.kind) {
    case "created":
      return null;
    case "invalid":
      return outcome.message;
    case "not-found":
      return "Desain ini belum memiliki harga yang aktif. Hubungi bantuan bila masalah berlanjut.";
    case "unauthenticated":
      return "Masuk ke akun Undangania untuk melanjutkan pembayaran.";
    case "provider-unavailable":
      return "Pembayaran belum dapat dimulai. Tidak ada pembayaran yang berjalan.";
    case "duplicate":
      return "Permintaan pembayaran sudah diterima. Periksa status pesanan sebelum mencoba lagi.";
    case "unavailable":
      return "Layanan pesanan sedang tidak tersedia. Silakan coba lagi nanti.";
  }
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
  const [state, setState] = useState<CheckoutState>(initialState);
  const [orderNumber, setOrderNumber] = useState(order.orderNumber);
  const [message, setMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  // Stable for one checkout attempt. A retried or concurrent submit reuses the
  // same token, so the server resolves the existing order instead of charging
  // twice. It is rotated only after the provider definitively rejected a charge,
  // when no payment exists to collide with.
  const checkoutKeyRef = useRef<string | null>(null);

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
  const isLoading = state === "ORDER_LOADING";
  const isBlocked =
    isLoading ||
    state === "COUPON_VALIDATING" ||
    state === "PAYMENT_CREATING" ||
    state === "PROVIDER_UNAVAILABLE" ||
    state === "DUPLICATE_ACTION" ||
    state === "OFFLINE" ||
    isCouponPending ||
    isCreating;

  function submitCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startCouponTransition(() => {
      // The code is carried to the server with the purchase request, so the discount
      // shown here is only an estimate until the order is actually created. Nothing
      // is charged from this handler.
      setCoupon(null);
    });
  }

  function paymentAttemptKey(): string {
    if (checkoutKeyRef.current === null) {
      checkoutKeyRef.current = crypto.randomUUID();
    }
    return checkoutKeyRef.current;
  }

  async function startPayment() {
    if (isBlocked) return;
    setState("PAYMENT_CREATING");
    setMessage(null);
    setIsCreating(true);
    try {
      const outcome = await startCheckoutAction({
        templateId: order.templateId,
        quantity: 1,
        idempotencyKey: paymentAttemptKey(),
        ...(couponCode.trim() === ""
          ? {}
          : { promotionCode: couponCode.trim() }),
      });
      if (outcome.kind === "provider-unavailable") {
        // No charge reached the provider, so the next click may safely start a
        // fresh attempt with a new token.
        checkoutKeyRef.current = null;
      }
      const next = stateFor(outcome);
      setState(next);
      setMessage(messageFor(outcome));

      if (outcome.kind === "created") {
        setOrderNumber(outcome.orderNumber);
        // The provider's QR page is where the customer pays. Returning from it is
        // not evidence of payment, so the status page re-reads the payment row.
        router.push(outcome.redirectUrl);
        return;
      }
      if (outcome.kind === "unauthenticated") {
        router.push("/masuk?next=%2Fcheckout");
      }
    } catch {
      setState("PROVIDER_UNAVAILABLE");
      setMessage(
        "Pembayaran belum dapat dimulai. Tidak ada pembayaran yang berjalan.",
      );
    } finally {
      setIsCreating(false);
    }
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
          {stateAlert(state, orderNumber)}
          {message === null ? null : (
            <Alert variant="warning" title="Perlu diperhatikan">
              {message}
            </Alert>
          )}
        </div>

        <CheckoutOrderSummary
          order={{ ...order, orderNumber }}
          template={template}
        />
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
              Kode promo diperiksa saat pesanan dibuat, sehingga harga akhir
              ditentukan oleh pesanan yang tersimpan.
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
            loading={state === "PAYMENT_CREATING"}
            disabled={isBlocked}
            onClick={() => void startPayment()}
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

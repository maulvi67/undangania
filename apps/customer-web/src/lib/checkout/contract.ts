import type { TemplateRecord } from "../../components/templates/template-contract";

/**
 * Customer-web checkout contract (MVP-UI-012).
 *
 * The transport shape deliberately serializes money as decimal strings. The
 * production API must calculate these values from an immutable order snapshot;
 * the fixture transport is only for building the UI before that API exists.
 */

export const CHECKOUT_STATES = [
  "ORDER_LOADING",
  "READY",
  "COUPON_VALIDATING",
  "COUPON_INVALID",
  "PAYMENT_CREATING",
  "PROVIDER_UNAVAILABLE",
  "DUPLICATE_ACTION",
  "OFFLINE",
] as const;

export type CheckoutState = (typeof CHECKOUT_STATES)[number];

export const PAYMENT_STATUS_STATES = [
  "VERIFYING",
  "PENDING",
  "DELAYED",
  "PAID",
  "ENTITLEMENT_PENDING",
  "FAILED",
  "EXPIRED",
  "AMOUNT_MISMATCH",
  "ALREADY_PAID",
] as const;

export type PaymentStatusState = (typeof PAYMENT_STATUS_STATES)[number];

export type CheckoutLifecycle = {
  startsAt?: string;
  endsAt?: string;
  explanation: string;
};

export type CheckoutOrder = {
  orderId: string;
  orderNumber: string;
  templateId: string;
  templateName: string;
  templateCategory: string;
  templateCharacter: string;
  templateTierLabel: string;
  currency: "IDR";
  subtotalMinor: string;
  discountMinor: string;
  taxMinor: string;
  totalMinor: string;
  promotionLabel?: string;
  coreFeatures: readonly string[];
  fairUsage: readonly string[];
  lifecycle: CheckoutLifecycle;
  paymentMethod: "QRIS";
};

export type FixtureCheckoutData = {
  order: CheckoutOrder;
  template: TemplateRecord;
};

export type CouponValidation =
  | {
      status: "VALID";
      code: string;
      label: string;
      discountMinor: string;
    }
  | {
      status: "INVALID";
      message: string;
    };

export function isCheckoutState(value: string): value is CheckoutState {
  return (CHECKOUT_STATES as readonly string[]).includes(value);
}

export function parseCheckoutState(value: string | undefined): CheckoutState {
  const normalized = value?.trim().toUpperCase().replaceAll("-", "_") ?? "";
  return isCheckoutState(normalized) ? normalized : "READY";
}

export function isPaymentStatusState(
  value: string,
): value is PaymentStatusState {
  return (PAYMENT_STATUS_STATES as readonly string[]).includes(value);
}

export function parsePaymentStatusState(
  value: string | undefined,
): PaymentStatusState {
  const normalized = value?.trim().toUpperCase().replaceAll("-", "_") ?? "";
  return isPaymentStatusState(normalized) ? normalized : "VERIFYING";
}

/** Format integer IDR minor units without trusting a client-provided number. */
export function formatIdrMinor(value: string): string {
  if (!/^\d+$/.test(value)) return "Rp —";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(BigInt(value));
}

export function addMinorUnits(left: string, right: string): string {
  if (!/^\d+$/.test(left) || !/^\d+$/.test(right)) {
    throw new Error("Invalid monetary value");
  }
  return (BigInt(left) + BigInt(right)).toString();
}

export function subtractMinorUnits(left: string, right: string): string {
  if (!/^\d+$/.test(left) || !/^\d+$/.test(right)) {
    throw new Error("Invalid monetary value");
  }
  const result = BigInt(left) - BigInt(right);
  if (result < 0n) throw new Error("Monetary value cannot be negative");
  return result.toString();
}

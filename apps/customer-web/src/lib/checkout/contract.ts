/**
 * Customer-web checkout contract (MVP-UI-012).
 *
 * The transport shape deliberately serializes money as decimal strings. The
 * values are calculated server-side from an immutable order snapshot; the
 * client never supplies an amount.
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

/**
 * Renders a customer-facing order reference.
 *
 * Only the platform's own reference shape is echoed back; anything else (a
 * crafted query value, a provider id) is masked rather than displayed.
 */
export function safeOrderReference(orderNumber: string): string {
  return /^WS-[A-Z0-9-]{8,32}$/.test(orderNumber) ? orderNumber : "WS-—";
}

/** The copy each payment state renders, shared by the status page and panels. */
export function statusCopy(state: PaymentStatusState): {
  title: string;
  description: string;
  tone: "info" | "success" | "warning" | "error";
} {
  switch (state) {
    case "VERIFYING":
      return {
        title: "Memeriksa pembayaran",
        description:
          "Kami sedang memeriksa konfirmasi pembayaran dari penyedia QRIS. Kembali dari halaman pembayaran belum berarti pembayaran berhasil.",
        tone: "info",
      };
    case "PENDING":
      return {
        title: "Menunggu konfirmasi pembayaran",
        description:
          "Pembayaran Anda belum terkonfirmasi. Jangan menutup halaman jika Anda masih menyelesaikan pembayaran.",
        tone: "warning",
      };
    case "DELAYED":
      return {
        title: "Konfirmasi pembayaran tertunda",
        description:
          "Jika saldo Anda sudah terpotong, jangan membayar ulang. Simpan nomor pesanan dan periksa kembali nanti atau hubungi bantuan.",
        tone: "warning",
      };
    case "PAID":
      return {
        title: "Pembayaran terkonfirmasi",
        description:
          "Pembayaran Anda telah dikonfirmasi oleh penyedia pembayaran. Workspace dapat dilanjutkan tanpa perlu membayar lagi.",
        tone: "success",
      };
    case "ENTITLEMENT_PENDING":
      return {
        title: "Pembayaran terkonfirmasi",
        description:
          "Pembayaran sudah terverifikasi. Kami sedang menyiapkan akses desain untuk workspace Anda.",
        tone: "info",
      };
    case "FAILED":
      return {
        title: "Pembayaran belum berhasil",
        description:
          "Pembayaran belum dikonfirmasi. Anda dapat mencoba kembali dengan QRIS atau menghubungi bantuan menggunakan nomor pesanan.",
        tone: "error",
      };
    case "EXPIRED":
      return {
        title: "Sesi pembayaran berakhir",
        description:
          "Sesi QRIS ini sudah berakhir. Pesanan tidak dianggap lunas; buat sesi pembayaran baru untuk melanjutkan.",
        tone: "warning",
      };
    case "AMOUNT_MISMATCH":
      return {
        title: "Pembayaran perlu diperiksa",
        description:
          "Jumlah pembayaran tidak cocok dengan pesanan ini. Jangan mencoba membayar ulang sebelum tim bantuan memeriksa pesanan Anda.",
        tone: "error",
      };
    case "ALREADY_PAID":
      return {
        title: "Pesanan sudah dibayar",
        description:
          "Pesanan ini telah memiliki pembayaran terverifikasi. Anda tidak perlu melakukan pembayaran kedua.",
        tone: "success",
      };
  }
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

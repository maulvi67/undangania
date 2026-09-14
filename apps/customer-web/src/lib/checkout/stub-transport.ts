import { getTemplate } from "../../components/templates/template-data";
import type { TemplateRecord } from "../../components/templates/template-contract";
import {
  formatIdr,
  TIER_LABELS,
  type TemplateTier,
} from "../../components/templates/template-contract";
import type {
  CheckoutOrder,
  CouponValidation,
  FixtureCheckoutData,
  PaymentStatusState,
} from "./contract";

const CORE_FEATURES = [
  "Halaman acara dan detail lokasi",
  "RSVP per acara",
  "Buku tamu",
  "Galeri foto",
  "Informasi kado",
  "Manajemen tamu",
] as const;

const FAIR_USAGE = [
  "Satu workspace untuk satu rangkaian pernikahan",
  "Penggunaan fitur mengikuti batas wajar untuk kebutuhan undangan pribadi",
  "Batas teknis yang berlaku akan ditampilkan di workspace Anda",
] as const;

const LIFECYCLE_EXPLANATION =
  "Undangan aktif mulai saat dipublikasikan hingga 30 hari setelah tanggal acara. Sebelum masa aktif berakhir, Anda dapat mengunduh data tamu dan buku tamu.";

const FIXTURE_ORDER_NUMBER = "WS-20260911-001";

function toMinor(value: number): string {
  return String(value);
}

function orderForTemplate(template: TemplateRecord): CheckoutOrder {
  if (template.priceIdr === null) {
    throw new Error("Template price is unavailable");
  }

  return {
    orderId: "order_fixture_seruni_001",
    orderNumber: FIXTURE_ORDER_NUMBER,
    templateId: template.id,
    templateName: template.name,
    templateCategory: template.category,
    templateCharacter: template.designCharacter,
    templateTierLabel: TIER_LABELS[template.tier as TemplateTier],
    currency: "IDR",
    subtotalMinor: toMinor(template.priceIdr),
    discountMinor: "0",
    taxMinor: "0",
    totalMinor: toMinor(template.priceIdr),
    coreFeatures: CORE_FEATURES,
    fairUsage: FAIR_USAGE,
    lifecycle: { explanation: LIFECYCLE_EXPLANATION },
    paymentMethod: "QRIS",
  };
}

export function loadCheckoutFixture(
  templateId: string,
): FixtureCheckoutData | null {
  const template = getTemplate(templateId);
  if (!template || template.status !== "ACTIVE" || template.priceIdr === null)
    return null;
  return { template, order: orderForTemplate(template) };
}

export function loadDefaultCheckoutFixture(): FixtureCheckoutData | null {
  return loadCheckoutFixture("seruni-klasik");
}

export async function validateCoupon(code: string): Promise<CouponValidation> {
  const normalized = code.trim().toUpperCase();
  await Promise.resolve();
  if (normalized === "") {
    return {
      status: "INVALID",
      message: "Masukkan kode promo terlebih dahulu.",
    };
  }
  if (normalized === "RAPIH10") {
    return {
      status: "VALID",
      code: normalized,
      label: "Promo RAPIH10",
      discountMinor: "10000",
    };
  }
  return {
    status: "INVALID",
    message: "Kode promo tidak berlaku atau sudah tidak tersedia.",
  };
}

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

export function safeOrderReference(orderNumber: string): string {
  return /^WS-[A-Z0-9-]{8,32}$/.test(orderNumber) ? orderNumber : "WS-—";
}

export function displayTemplatePrice(template: TemplateRecord): string {
  return template.priceIdr === null
    ? "Harga belum tersedia"
    : formatIdr(template.priceIdr);
}

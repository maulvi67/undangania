import {
  PrismaOrderPaymentRepository,
  PrismaCheckoutPricingRepository,
  prisma,
  adaptCheckoutClient,
  type OrderPaymentDto,
} from "@wedding/database";
import type {
  CheckoutOrder,
  CheckoutLifecycle,
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

export type ProductionPaymentStatus = Readonly<{
  order: CheckoutOrder;
  state: PaymentStatusState;
  templateName: string;
}>;

function lifecycle(): CheckoutLifecycle {
  return { explanation: LIFECYCLE_EXPLANATION };
}

function stateForPayment(order: OrderPaymentDto): PaymentStatusState {
  const payment = order.payments[0];
  if (payment?.status === "PAID") return "PAID";
  if (payment?.status === "EXPIRED") return "EXPIRED";
  if (payment?.status === "FAILED") return "FAILED";
  if (payment?.status === "PENDING") return "PENDING";
  return "VERIFYING";
}

function productName(order: OrderPaymentDto): string {
  return order.items[0]?.descriptionSnapshot ?? "Desain undangan";
}

export async function loadOwnedPaymentStatus(
  tenantId: string,
  userId: string,
  orderNumber: string,
): Promise<ProductionPaymentStatus | null> {
  if (!/^WS-[A-Z0-9-]{8,32}$/.test(orderNumber)) return null;
  const order = await new PrismaOrderPaymentRepository().findOwned({
    tenantId,
    userId,
    orderNumber,
  });
  if (order === null || order.currency !== "IDR") return null;

  const name = productName(order);
  return {
    order: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      templateId: order.items[0]?.productCode ?? "",
      templateName: name,
      templateCategory: "",
      templateCharacter: "",
      templateTierLabel: "",
      currency: "IDR",
      subtotalMinor: order.subtotalMinor.toString(),
      discountMinor: order.discountMinor.toString(),
      taxMinor: order.taxMinor.toString(),
      totalMinor: order.totalMinor.toString(),
      coreFeatures: CORE_FEATURES,
      fairUsage: FAIR_USAGE,
      lifecycle: lifecycle(),
      paymentMethod: "QRIS",
    },
    state: stateForPayment(order),
    templateName: name,
  };
}

/**
 * The price a template is actually sold at.
 *
 * Read from the catalog tables rather than from the UI fixture, because this is the
 * same figure `createCheckout` will charge: showing one number and charging another
 * would make the confirmation step meaningless. A template with no active price is
 * reported as not sellable rather than priced at zero.
 */
export async function loadTemplatePriceMinor(input: {
  templateId: string;
  at: Date;
}): Promise<bigint | null> {
  try {
    return await new PrismaCheckoutPricingRepository(
      adaptCheckoutClient(prisma),
    ).findPackagePrice({
      productCode: input.templateId,
      currency: "IDR",
      at: input.at,
    });
  } catch {
    return null;
  }
}

/**
 * Builds the order preview for a template the customer is about to buy.
 *
 * The order does not exist yet: `createCheckout` mints the real row when the
 * customer confirms. `orderNumber` is therefore empty and the view renders without a
 * reference, rather than showing an identifier for something that has not happened.
 */
export function previewOrder(input: {
  templateId: string;
  templateName: string;
  templateCategory: string;
  templateCharacter: string;
  templateTierLabel: string;
  unitPriceMinor: bigint;
  quantity: number;
}): CheckoutOrder {
  const subtotalMinor = input.unitPriceMinor * BigInt(input.quantity);
  return {
    orderId: "",
    orderNumber: "",
    templateId: input.templateId,
    templateName: input.templateName,
    templateCategory: input.templateCategory,
    templateCharacter: input.templateCharacter,
    templateTierLabel: input.templateTierLabel,
    currency: "IDR",
    subtotalMinor: subtotalMinor.toString(),
    discountMinor: "0",
    taxMinor: "0",
    totalMinor: subtotalMinor.toString(),
    coreFeatures: CORE_FEATURES,
    fairUsage: FAIR_USAGE,
    lifecycle: lifecycle(),
    paymentMethod: "QRIS",
  };
}

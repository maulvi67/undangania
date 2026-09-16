import {
  PrismaOrderPaymentRepository,
  type OrderPaymentDto,
} from "@wedding/database";
import { resolveSessionWorkspaceOrNull } from "../workspace/session-workspace";
import type { PaymentStatusState } from "./contract";

/**
 * The workspace's order list.
 *
 * Scoped by tenant rather than by user: an order is paid for once and belongs to the
 * workspace, so a co-organizer who did not press the button must still be able to see
 * whether the invitation was paid for.
 *
 * Payment state is read from the stored payment row, which only a verified
 * server-to-server notification updates. Nothing here consults a redirect parameter.
 */

export type OrderListState = Readonly<{
  orderNumber: string;
  totalMinor: string;
  currency: string;
  createdAt: Date | null;
  current: PaymentStatusState;
  /** The provider's own status words, for the support conversation. */
  providerReference: string | null;
  productName: string;
}>;

export type OrderListLoad =
  | Readonly<{ kind: "ok"; orders: readonly OrderListState[] }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{ kind: "unavailable" }>;

/**
 * The newest payment describes the order's state; an older expired attempt must not
 * mask a later success.
 */
export function currentPaymentState(
  order: OrderPaymentDto,
): PaymentStatusState {
  const payment = order.payments[0];
  if (payment === undefined) {
    // The order exists but the charge never returned a transaction id, which is what
    // a provider outage mid-checkout leaves behind.
    return "VERIFYING";
  }
  if (payment.status === "PAID") return "PAID";
  if (payment.status === "EXPIRED") return "EXPIRED";
  if (payment.status === "FAILED") return "FAILED";
  if (payment.status === "PENDING" || payment.status === "CREATED") {
    return "PENDING";
  }
  // A refunded payment is not a failure of the purchase; it is money returned. The
  // status page has no dedicated state for it, so it reports the settled state the
  // order actually reached rather than inventing one.
  return payment.paidAt === null ? "FAILED" : "PAID";
}

export function toOrderListState(order: OrderPaymentDto): OrderListState {
  return {
    orderNumber: order.orderNumber,
    totalMinor: order.totalMinor.toString(),
    currency: order.currency,
    // `createdAt` is not part of the payment DTO's projection; the newest payment's
    // timestamp is the closest honest signal of when the order moved.
    createdAt: order.payments[0]?.updatedAt ?? null,
    current: currentPaymentState(order),
    providerReference: order.payments[0]?.providerTransactionId ?? null,
    productName: order.items[0]?.descriptionSnapshot ?? "Desain undangan",
  };
}

export async function loadOrderList(): Promise<OrderListLoad> {
  const workspace = await resolveSessionWorkspaceOrNull();
  if (workspace === null) return { kind: "unauthenticated" };

  try {
    const orders = await new PrismaOrderPaymentRepository().listForTenant({
      tenantId: workspace.context.tenantId,
    });
    return { kind: "ok", orders: orders.map(toOrderListState) };
  } catch {
    return { kind: "unavailable" };
  }
}

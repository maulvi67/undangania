"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PrismaQrisNotificationTransaction } from "@wedding/database";
import { reconcileQrisPayment } from "@wedding/payments";
import { resolveSessionWorkspaceOrNull } from "../workspace/session-workspace";
import { checkoutProvider, createCheckoutForSession } from "./container";
import type { CheckoutActionOutcome } from "./outcomes";
import { loadOwnedPaymentProviderTransactionId } from "./server";

/**
 * Checkout creation action.
 *
 * The body names a product and a quantity — nothing else. The tenant, the wallet, and
 * the price all come from the session and the catalog server-side, so a crafted
 * request cannot choose its own amount.
 *
 * The returned `redirectUrl` is the provider's QR image. It is a hint about where to
 * send the customer, never evidence that anything was paid: the status page reads the
 * payment row, which only a verified notification updates.
 *
 * The outcome type lives in `./outcomes` because a `"use server"` module may only
 * export async functions.
 */

const checkoutRequestSchema = z.object({
  templateId: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1).max(10).default(1),
  promotionCode: z.string().trim().max(40).optional(),
});

export async function startCheckoutAction(
  input: unknown,
): Promise<CheckoutActionOutcome> {
  const parsed = checkoutRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: "invalid",
      message: "Rincian pesanan tidak dapat dibaca.",
    };
  }

  const outcome = await createCheckoutForSession({
    productCode: parsed.data.templateId,
    quantity: parsed.data.quantity,
    ...(parsed.data.promotionCode === undefined ||
    parsed.data.promotionCode === ""
      ? {}
      : { promotionCode: parsed.data.promotionCode }),
  });

  switch (outcome.kind) {
    case "created":
      return {
        kind: "created",
        orderNumber: outcome.orderNumber,
        redirectUrl: outcome.redirectUrl,
      };
    case "unauthenticated":
      return { kind: "unauthenticated" };
    case "forbidden":
      return { kind: "unauthenticated" };
    case "not-found":
      return { kind: "not-found" };
    case "invalid":
      return { kind: "invalid", message: outcome.message };
    case "provider-unavailable":
      return { kind: "provider-unavailable" };
    case "unavailable":
      return { kind: "unavailable" };
  }
}

/**
 * Reconciles the session's own order against the provider status API.
 *
 * Delayed or missed notifications leave a payment stuck at `PENDING` even though
 * the provider has since settled it. This asks the provider for the authoritative
 * status of the transaction the application already recorded and applies it
 * through the same guarded path a webhook uses. The order number is only a lookup
 * key scoped to the session; it never decides the transaction or the outcome.
 */
export async function reconcilePaymentAction(formData: FormData): Promise<void> {
  const orderNumber = String(formData.get("order") ?? "").trim();
  const templateId = String(formData.get("template") ?? "").trim();
  const backHref = `/checkout/status?order=${encodeURIComponent(
    orderNumber,
  )}&template=${encodeURIComponent(templateId)}`;

  const workspace = await resolveSessionWorkspaceOrNull();
  if (workspace === null) redirect("/masuk");

  const provider = checkoutProvider();
  const providerTransactionId = await loadOwnedPaymentProviderTransactionId(
    workspace.request.membership.tenantId,
    workspace.request.user.id,
    orderNumber,
  );
  if (provider === null || providerTransactionId === null) redirect(backHref);

  try {
    await reconcileQrisPayment(
      { providerTransactionId },
      {
        notifications: new PrismaQrisNotificationTransaction(),
        provider,
      },
    );
  } catch {
    // A provider or database failure leaves the stored status untouched, so the
    // page simply renders the unchanged state instead of an error.
  }

  redirect(backHref);
}

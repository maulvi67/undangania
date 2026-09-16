/**
 * Checkout Server Action outcomes.
 *
 * These live outside `actions.ts` because a `"use server"` module may only export
 * async functions — a re-exported type makes the whole module fail to compile at
 * the call site.
 */

export type CheckoutActionOutcome =
  | Readonly<{
      kind: "created";
      orderNumber: string;
      redirectUrl: string;
    }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{ kind: "not-found" }>
  | Readonly<{ kind: "invalid"; message: string }>
  | Readonly<{ kind: "provider-unavailable" }>
  | Readonly<{ kind: "unavailable" }>;

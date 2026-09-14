# MVP-UI-012 Checkout and Payment Handoff

## Status

**Conditional approval for fixture-backed QRIS checkout and payment-status UI.**
Production payment activation remains blocked until the Payment, Security,
Order, Database, and human reviewers approve the server-side integration.

## Scope implemented

- QRIS-only checkout screen for Indonesian customers.
- Selected template summary with design category, character, tier, and CSS preview.
- Immutable-looking fixture order snapshot with IDR price breakdown.
- Optional promotion-code interaction (`RAPIH10` fixture only).
- Explicit explanation that every design includes the same Digital Invitation Core.
- Explicit explanation that price differences reflect visual design, asset
  complexity, and licensing rather than RSVP or guest-management capability.
- Invitation lifecycle explanation and fair-usage panel.
- QRIS payment-method selection with no other payment methods exposed.
- Checkout loading, coupon validation, invalid coupon, payment creation,
  provider unavailable, duplicate action, and offline states.
- Payment verification, pending, delayed, paid, entitlement pending, failed,
  expired, amount mismatch, and already-paid status screens.
- Safe support-facing order reference.
- Status recheck and retry actions that preserve the selected template.
- `noindex,nofollow` metadata for checkout and payment-status routes.
- Safe post-auth redirect support for `/checkout` and nested status routes.
- Pure Midtrans QRIS request/status/signature/amount/currency helpers.
- No provider credentials, live HTTP calls, webhook activation, entitlement
  grant, database migration, or raw QR payload in the browser.

## Task and requirement IDs

- `.ai/tasks/MVP-UI-012-CHECKOUT-PAYMENT.md`
- Project rules in `AGENTS.md`
- Order domain: immutable item/price snapshot and reconciled totals.
- Payment domain: only verified callback/reconciliation changes payment truth.
- Pricing/entitlement rules: UI is not the entitlement enforcement boundary.

## Provider decision

The recommended provider is **Midtrans QRIS in sandbox mode**.

Reasons:

- Indonesia-first product and QRIS support.
- Existing repository payment examples already reference Midtrans notification
  verification.
- Compatible with the existing provider-neutral `PaymentPort` boundary.
- Supports server-created QRIS charges, asynchronous status, notification
  verification, and status reconciliation.

Official references reviewed:

- `https://docs.midtrans.com/reference/qris`
- `https://docs.midtrans.com/reference/notifications-handling`
- `https://docs.midtrans.com/reference/get-transaction-status`
- `https://docs.midtrans.com/docs/api-authorization-headers.md`

Relevant provider assumptions encoded in the pure helper tests:

- QRIS charge uses `payment_type: "qris"` and integer IDR `gross_amount`.
- Sandbox charge endpoint is `POST https://api.sandbox.midtrans.com/v2/charge`.
- QRIS success maps from provider `settlement` to canonical `PAID`.
- `pending`, `expire`, and `deny` remain non-paid states.
- Notification signature is SHA-512 of:
  `order_id + status_code + gross_amount + ServerKey`.
- QRIS notification must match the immutable order ID, amount, method, and
  `IDR` currency.
- Provider notifications must be verified and processed idempotently in the
  future server adapter; browser redirect is never payment truth.

## Files changed

### New customer-web route and styles

- `apps/customer-web/src/app/checkout/page.tsx`
- `apps/customer-web/src/app/checkout/loading.tsx`
- `apps/customer-web/src/app/checkout/error.tsx`
- `apps/customer-web/src/app/checkout/checkout.css`
- `apps/customer-web/src/app/checkout/status/page.tsx`
- `apps/customer-web/src/app/checkout/status/loading.tsx`

### New checkout components

- `apps/customer-web/src/components/checkout/checkout-view.tsx`
- `apps/customer-web/src/components/checkout/checkout-order-summary.tsx`
- `apps/customer-web/src/components/checkout/price-breakdown.tsx`
- `apps/customer-web/src/components/checkout/checkout-lifecycle.tsx`
- `apps/customer-web/src/components/checkout/fair-usage-panel.tsx`
- `apps/customer-web/src/components/checkout/payment-method-picker.tsx`
- `apps/customer-web/src/components/checkout/payment-status-view.tsx`
- `apps/customer-web/src/components/checkout/order-reference.tsx`
- `apps/customer-web/src/components/checkout/support-link.tsx`

### New customer-web contracts and fixtures

- `apps/customer-web/src/lib/checkout/contract.ts`
- `apps/customer-web/src/lib/checkout/contract.test.ts`
- `apps/customer-web/src/lib/checkout/stub-transport.ts`
- `apps/customer-web/src/lib/checkout/stub-transport.test.ts`

### Updated customer-web navigation

- `apps/customer-web/src/components/templates/sticky-select-bar.tsx`
- `apps/customer-web/src/app/templates/[id]/page.tsx`
- `apps/customer-web/src/lib/auth/redirect.ts`
- `apps/customer-web/src/lib/auth/redirect.test.ts`

The auth redirect files contained unrelated pre-existing workspace changes;
this task adds the checkout destination coverage without reverting them.

### New payment adapter primitives and tests

- `packages/payments/src/midtrans-qris.ts`
- `packages/payments/src/midtrans-qris.test.ts`
- `packages/payments/src/index.ts` exports the pure Midtrans helpers while
  retaining the existing `PaymentPort` interface.

## Fixture routes

Checkout:

```text
/checkout?template=seruni-klasik
/checkout?template=nara-modern
/checkout?template=kenanga-tradisi
/checkout?template=seruni-klasik&state=order-loading
/checkout?template=seruni-klasik&state=coupon-invalid
/checkout?template=seruni-klasik&state=payment-creating
/checkout?template=seruni-klasik&state=provider-unavailable
/checkout?template=seruni-klasik&state=duplicate-action
/checkout?template=seruni-klasik&state=offline
```

Enter `RAPIH10` in the promotion field to exercise the valid-promotion fixture.

Payment status:

```text
/checkout/status?order=WS-20260911-001&template=seruni-klasik&state=verifying
/checkout/status?order=WS-20260911-001&template=seruni-klasik&state=pending
/checkout/status?order=WS-20260911-001&template=seruni-klasik&state=delayed
/checkout/status?order=WS-20260911-001&template=seruni-klasik&state=paid
/checkout/status?order=WS-20260911-001&template=seruni-klasik&state=entitlement-pending
/checkout/status?order=WS-20260911-001&template=seruni-klasik&state=failed
/checkout/status?order=WS-20260911-001&template=seruni-klasik&state=expired
/checkout/status?order=WS-20260911-001&template=seruni-klasik&state=amount-mismatch
/checkout/status?order=WS-20260911-001&template=seruni-klasik&state=already-paid
```

These query-selected states are development fixtures only. They must be
replaced by an authenticated, server-authorized order-status response before
production exposure. The `paid` fixture is presented as a server-shaped
verified state in the UI contract; it is not evidence of a real payment.

## Architecture impact

- Customer web remains server-component-first. Only the checkout interaction
  surface is a client component for coupon state and fixture navigation.
- Money crossing the customer-web transport boundary is represented as decimal
  strings; arithmetic uses `bigint` helpers rather than floating point.
- Fixture transport is isolated under `lib/checkout` and contains no database,
  session, tenant, entitlement, provider SDK, or network access.
- The payment package exposes provider mapping and verification primitives but
  does not call Midtrans.
- The existing `PaymentPort` is intentionally not silently expanded. A future
  production adapter needs a reviewed contract for idempotency keys, provider
  event identity, expiry, method, reconciliation, and raw-event persistence.

## Schema and API impact

- No Prisma schema change.
- No database migration.
- No production API route or webhook route.
- No outbox, audit, order, payment-event, or entitlement write path.
- No production promotion validation or redemption path.
- No package-lock change required by this implementation.

Production follow-up must add or confirm:

1. Authenticated order creation and tenant/user authorization.
2. Immutable server-side price, promotion, tax, currency, and lifecycle snapshot.
3. Payment-attempt idempotency and duplicate checkout protection.
4. Payment-event persistence with provider event uniqueness and out-of-order
   handling.
5. Verified Midtrans webhook endpoint over HTTPS.
6. Status reconciliation through the provider status API for delayed notices.
7. Atomic order/payment/entitlement/outbox transaction.
8. Audited amount/currency mismatch handling and support escalation.

## Security and privacy impact

Implemented controls:

- No server key or provider secret is imported by customer web.
- No raw provider notification payload is rendered, logged, or sent to
  telemetry.
- No client-submitted price, discount, currency, or payment status is treated
  as production truth by the fixture boundary.
- Notification helper verifies signature using constant-time comparison.
- Notification helper checks order ID, QRIS method, exact integer-valued IDR
  amount, and currency.
- QR action URLs are accepted only when they are HTTPS URLs from the
  allowlisted Midtrans sandbox or production API hosts.
- Payment success copy is explicitly tied to verified server-shaped state.
- Delayed confirmation warns customers not to pay twice if their balance was
  already debited.
- Order references are constrained to a safe support-display format.
- Checkout routes are marked `noindex,nofollow`.
- Auth redirect destinations remain same-origin and allowlisted.

Residual risks:

- The fixture query parameter can select any development payment state. This
  is not a production authorization mechanism and must be removed/replaced by
  the server order-status API.
- No live webhook replay protection, persistence, reconciliation job, or
  entitlement transaction exists in this phase.
- Existing fixture template prices are placeholders pending product/finance
  confirmation.
- The active-period wording remains the current proposed product default and
  must be confirmed by Product before commercial launch.

## Validation evidence

Passed sequentially:

- `npm run typecheck -w @wedding/customer-web`
- `npm run test -w @wedding/customer-web`
  - 23 test files passed.
  - 144 tests passed.
- `npm run build -w @wedding/customer-web`
  - Next.js build compiled successfully.
  - `/checkout` and `/checkout/status` routes were generated as dynamic routes.
- `npm run typecheck -w @wedding/payments`
- `npm run test -w @wedding/payments`
  - 1 test file passed.
  - 7 tests passed.
- `npm exec -- prettier --check` for all new checkout/payment files.
- `git diff --check`.
- Focused diagnostics for all new checkout components, routes, contracts, and
  Midtrans helpers returned no errors or warnings.

Targeted lint for new checkout/payment files reports only the repository's
existing Next ESLint configuration warning about the missing Pages directory;
there are no checkout/payment code errors. The broader customer-web lint also
contains unrelated pre-existing internal `<a>` violations outside this task.

## Browser and UI quality evidence

Per the current development instruction, this pass focused on code
implementation and automated package/build validation. The following were not
run here:

- Next.js DevTools runtime inspection.
- Playwright browser matrix.
- Chromium, Firefox, and WebKit screenshots.
- Manual keyboard/focus browser audit.
- Accessibility-audit skill execution against a running browser.
- Responsive-layout-audit against all required widths.
- UI-performance-audit with network/CLS/LCP measurements.

Therefore this handoff does not claim browser-level accessibility,
responsive, performance, console, network, or screenshot approval. Those are
required follow-ups before production UI approval.

## Migration and rollback

- No migration is required.
- Rollback is file-level: remove the checkout route/components/contracts and
  revert the template CTA/auth allowlist additions.
- Do not roll back or remove unrelated pre-existing workspace changes.
- Before production enablement, use feature gating or route protection rather
  than exposing the fixture query states publicly.

## Known risks and next action

- Product/Finance must confirm fixture prices, discount behavior, taxes, and
  exact active-period policy.
- Payment/Security must approve the final Midtrans adapter, server key
  handling, webhook endpoint, event persistence, replay controls, and
  reconciliation behavior.
- Order/Database must approve immutable snapshots and atomic entitlement
  provisioning.
- Frontend/Accessibility/QA should run the browser quality gates and attach
  screenshots for every status state.
- The backend placeholder must be replaced before any customer can create a
  real order or receive an entitlement.

## Final decision

**CONDITIONAL APPROVAL — fixture-backed development implementation only.**

The QRIS-only checkout and payment-status code, contracts, pure provider
helpers, tests, and production build are complete. Live payment, entitlement,
webhook, and browser-quality release approval remain blocked pending the
reviewers and evidence listed above.

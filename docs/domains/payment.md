# Domain: Payment

## Purpose
Provider-neutral payment truth.

## Actors
customer, finance, provider.

## Entities
Payment, PaymentEvent, Refund.

## Business rules
only verified callback/reconciliation changes truth.

## Status and transitions
CREATED → PENDING → PAID/FAILED/EXPIRED; PAID → REFUNDED.

## Use cases
create transaction, process webhook, reconcile, refund.

## Validation
signature, amount, currency, uniqueness.

## Edge cases
duplicate/out-of-order webhook, late payment.

## API
/payments, /webhooks/payment.

## Domain events
PaymentConfirmed, PaymentFailed, RefundCompleted.

## Dependencies
order, entitlement, notification.

## Security considerations
signature, replay, PCI scope reduction.

## Owning module
`payment` owns the invariant and write model. Other modules integrate through application ports or versioned events.

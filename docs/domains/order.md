# Domain: Order

## Purpose
Commercial purchase lifecycle.

## Actors
customer, finance, admin.

## Entities
Order, OrderItem.

## Business rules
immutable item/price snapshot; totals reconcile.

## Status and transitions
DRAFT → PENDING_PAYMENT → PAID → FULFILLING → COMPLETED/CANCELLED.

## Use cases
create checkout, cancel, fulfill.

## Validation
currency, totals, product availability.

## Edge cases
duplicate checkout, partial fulfillment.

## API
/orders, /checkout.

## Domain events
OrderCreated, OrderPaid, OrderCancelled.

## Dependencies
payment, pricing, fulfillment.

## Security considerations
authorization and audit.

## Owning module
`order` owns the invariant and write model. Other modules integrate through application ports or versioned events.

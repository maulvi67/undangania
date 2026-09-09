# Domain: Shipping

## Purpose
Shipping and tracking.

## Actors
vendor, customer, logistics provider.

## Entities
Shipment, ShipmentEvent, AddressSnapshot.

## Business rules
address snapshot immutable after dispatch.

## Status and transitions
CREATED → PICKUP → IN_TRANSIT → DELIVERED/FAILED/RETURNED.

## Use cases
create shipment, track, retry.

## Validation
address, phone, service code.

## Edge cases
lost parcel, returned, provider mismatch.

## API
/shipments, /webhooks/shipping.

## Domain events
ShipmentUpdated.

## Dependencies
printing, notification.

## Security considerations
encrypted address and verified callbacks.

## Owning module
`shipping` owns the invariant and write model. Other modules integrate through application ports or versioned events.

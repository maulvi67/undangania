# Domain: Gift Registry

## Purpose
Gift options and digital account presentation.

## Actors
couple, guest.

## Entities
GiftRegistry, GiftAccount, GiftItem.

## Business rules
customer confirms rights/accuracy; sensitive values protected.

## Status and transitions
DRAFT → ACTIVE → HIDDEN.

## Use cases
manage accounts/items, copy/view.

## Validation
provider/account format, masked display.

## Edge cases
incorrect account, expired item.

## API
/gift-registries, /gift-accounts.

## Domain events
GiftRegistryUpdated.

## Dependencies
invitation, audit.

## Security considerations
encryption and PII-safe rendering.

## Owning module
`gift` owns the invariant and write model. Other modules integrate through application ports or versioned events.

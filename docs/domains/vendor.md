# Domain: Vendor

## Purpose
Vendor identity, services and operations.

## Actors
vendor operator, admin, customer.

## Entities
Vendor, VendorMember, VendorService.

## Business rules
verification before public/fulfillment role.

## Status and transitions
DRAFT → PENDING_VERIFICATION → VERIFIED/SUSPENDED.

## Use cases
onboard, verify, publish service.

## Validation
business identity, service area.

## Edge cases
duplicate business, suspended account.

## API
/vendors, /vendor-services.

## Domain events
VendorVerified, VendorSuspended.

## Dependencies
identity, moderation.

## Security considerations
document access and fraud controls.

## Owning module
`vendor` owns the invariant and write model. Other modules integrate through application ports or versioned events.

# Domain: Pricing Package

## Purpose
Packages, entitlements and limits.

## Actors
product admin, customer.

## Entities
Package, Price, Entitlement.

## Business rules
versioned active price; server-side limits.

## Status and transitions
DRAFT → ACTIVE → RETIRED.

## Use cases
publish price, grant entitlement, check limit.

## Validation
currency, period, limit schema.

## Edge cases
retired price, grandfathering.

## API
/packages, /prices, /entitlements.

## Domain events
EntitlementGranted, LimitReached.

## Dependencies
order, subscription.

## Security considerations
prevent client-side entitlement bypass.

## Owning module
`catalog` owns the invariant and write model. Other modules integrate through application ports or versioned events.

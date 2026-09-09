# Domain: Subscription

## Purpose
Recurring package entitlement.

## Actors
customer, finance.

## Entities
Subscription, SubscriptionCycle.

## Business rules
provider-confirmed cycle; grace and cancellation policy.

## Status and transitions
TRIAL/ACTIVE → PAST_DUE → SUSPENDED/CANCELLED.

## Use cases
subscribe, upgrade, cancel, renew.

## Validation
plan compatibility, billing cycle.

## Edge cases
failed renewal, proration, duplicate event.

## API
/subscriptions.

## Domain events
SubscriptionActivated, RenewalFailed.

## Dependencies
payment, package.

## Security considerations
webhook truth and entitlement revocation.

## Owning module
`subscription` owns the invariant and write model. Other modules integrate through application ports or versioned events.

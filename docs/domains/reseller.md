# Domain: Reseller

## Purpose
Reseller attribution and commercial rules.

## Actors
reseller, customer, finance.

## Entities
Reseller, ReferralCode, Commission.

## Business rules
no self-referral abuse; commission after settlement.

## Status and transitions
PENDING → ACTIVE → SUSPENDED.

## Use cases
create link, attribute order, settle commission.

## Validation
code, attribution window, eligibility.

## Edge cases
refund clawback, duplicate attribution.

## API
/resellers, /referrals.

## Domain events
ReferralAttributed, CommissionEarned.

## Dependencies
order, payment, analytics.

## Security considerations
fraud and PII separation.

## Owning module
`reseller` owns the invariant and write model. Other modules integrate through application ports or versioned events.

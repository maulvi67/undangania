# Domain: Discount Promotion

## Purpose
Controlled promotional pricing.

## Actors
marketing admin, reseller, customer.

## Entities
Promotion, Coupon, Redemption.

## Business rules
validity, scope, quota, stacking server-side.

## Status and transitions
DRAFT → SCHEDULED → ACTIVE → EXPIRED/DISABLED.

## Use cases
validate/apply/redeem.

## Validation
code normalization, date, usage limit.

## Edge cases
race on last coupon, abuse.

## API
/promotions/validate, /coupons.

## Domain events
PromotionRedeemed.

## Dependencies
order, reseller, analytics.

## Security considerations
brute-force prevention and audit.

## Owning module
`promotion` owns the invariant and write model. Other modules integrate through application ports or versioned events.

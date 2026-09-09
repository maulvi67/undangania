# Domain: Custom Domain

## Purpose
Customer-owned domain publication.

## Actors
customer, DNS provider, support.

## Entities
CustomDomain, DomainVerification, Certificate.

## Business rules
ownership verification before activation.

## Status and transitions
PENDING_DNS → VERIFYING → ACTIVE/FAILED → DISABLED.

## Use cases
add, verify, activate, renew certificate.

## Validation
hostname normalization, uniqueness.

## Edge cases
dangling DNS, takeover, cert failure.

## API
/custom-domains, /domain-verification.

## Domain events
DomainActivated, DomainFailed.

## Dependencies
invitation, edge/CDN.

## Security considerations
domain takeover prevention.

## Owning module
`domain` owns the invariant and write model. Other modules integrate through application ports or versioned events.

# Domain: Audit Log

## Purpose
Immutable accountability trail.

## Actors
security, admin, finance.

## Entities
AuditEvent.

## Business rules
append-only; no secrets; correlation support.

## Status and transitions
APPENDED only.

## Use cases
query authorized logs, export controlled.

## Validation
actor, action, target, reason.

## Edge cases
high volume, tampering attempt.

## API
/audit-events.

## Domain events
AuditRecorded.

## Dependencies
all domains.

## Security considerations
restricted access, retention, integrity.

## Owning module
`audit` owns the invariant and write model. Other modules integrate through application ports or versioned events.

# Domain: Moderation

## Purpose
Content and account safety.

## Actors
moderator, admin.

## Entities
ModerationCase, Decision, EvidenceReference.

## Business rules
reason/evidence/audit required.

## Status and transitions
OPEN → IN_REVIEW → ACTIONED/APPEALED/CLOSED.

## Use cases
review content/vendor, suspend, appeal.

## Validation
policy code, scope, evidence.

## Edge cases
false positive, conflict of interest.

## API
/moderation/cases.

## Domain events
ModerationActioned.

## Dependencies
guestbook, vendor, media.

## Security considerations
least privilege and evidence privacy.

## Owning module
`moderation` owns the invariant and write model. Other modules integrate through application ports or versioned events.

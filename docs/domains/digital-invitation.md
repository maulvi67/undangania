# Domain: Digital Invitation

## Purpose
Invitation lifecycle and publication.

## Actors
couple, editor, guest.

## Entities
Invitation, Publication, Activation.

## Business rules
draft/public separation; one active publication.

## Status and transitions
DRAFT → READY → PUBLISHED ↔ PAUSED → EXPIRED → ARCHIVED.

## Use cases
edit, preview, publish, pause, republish.

## Validation
required content, entitlement, slug.

## Edge cases
stale draft, expired entitlement, cache invalidation.

## API
/invitations, /publish, /public/invitations.

## Domain events
InvitationPublished, InvitationPaused.

## Dependencies
template, wedding, billing.

## Security considerations
public/private cache separation.

## Owning module
`invitation` owns the invariant and write model. Other modules integrate through application ports or versioned events.

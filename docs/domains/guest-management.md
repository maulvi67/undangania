# Domain: Guest Management

## Purpose
Households and invitees.

## Actors
couple, organizer.

## Entities
GuestHousehold, Guest, GuestEventAccess, Tag.

## Business rules
one token per household in MVP; token rotatable.

## Status and transitions
ACTIVE → DISABLED → DELETED.

## Use cases
CRUD, CSV import, personalize, export.

## Validation
contact normalization, allowance, event relation.

## Edge cases
duplicates, invalid CSV, deletion after RSVP.

## API
/guests, /guest-imports, /guest-links.

## Domain events
GuestImported, GuestTokenRotated.

## Dependencies
wedding, RSVP.

## Security considerations
encrypted contacts, export audit.

## Owning module
`guest` owns the invariant and write model. Other modules integrate through application ports or versioned events.

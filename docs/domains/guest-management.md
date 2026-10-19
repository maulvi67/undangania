# Domain: Guest Management

## Purpose
Households and invitees.

## Actors
couple, organizer.

## Entities
GuestHousehold, Guest, GuestEventAccess, Tag.

## Business rules
one token per household in MVP; token rotatable. Each household stores its own
tag list and event-access set; a household only sees and answers the events
selected for it. Deleting a household is soft: the link stops working while RSVP
and guestbook history remain.

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
encrypted contacts, export audit. Event access ids are validated against the
session wedding before any write, so a crafted id cannot grant another wedding's
event. A personalized guest token is resolved only
when its invitation slug matches the public invitation being rendered; the slug
is part of the repository predicate rather than a client-only check. The raw
token is hashed before lookup and is never exposed in the guest context.

## Owning module
`guest` owns the invariant and write model. Other modules integrate through application ports or versioned events.

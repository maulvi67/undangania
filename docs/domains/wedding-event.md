# Domain: Wedding Event

## Purpose
Wedding workspace and schedule.

## Actors
couple, planner, admin.

## Entities
Wedding, CoupleProfile, Event, Venue.

## Business rules
event timezone explicit; end after start; tenant ownership.

## Status and transitions
DRAFT → ACTIVE → ARCHIVED.

## Use cases
create wedding, update profiles, manage events/venues.

## Validation
date, timezone, address, event ordering.

## Edge cases
date changes, multi-day events, deleted venue.

## API
/weddings, /events, /venues.

## Domain events
WeddingCreated, WeddingDateChanged, EventUpdated.

## Dependencies
identity, invitation, guest.

## Security considerations
tenant isolation and private addresses.

## Owning module
`wedding` owns the invariant and write model. Other modules integrate through application ports or versioned events.

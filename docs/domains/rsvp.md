# Domain: Rsvp

## Purpose
Attendance response per event.

## Actors
guest, couple, admin.

## Entities
RSVP, RSVPHistory.

## Business rules
event access and pax allowance enforced.

## Status and transitions
PENDING → ATTENDING/DECLINED/TENTATIVE → LOCKED.

## Use cases
submit/update response, override, export.

## Validation
token, deadline, pax, event membership.

## Edge cases
duplicate/concurrent submit, expired invite.

## API
/public/rsvp, /rsvps.

## Domain events
RsvpSubmitted, RsvpChanged.

## Dependencies
guest, event, notification.

## Security considerations
rate limit, idempotency, no cross-household data.

## Owning module
`rsvp` owns the invariant and write model. Other modules integrate through application ports or versioned events.

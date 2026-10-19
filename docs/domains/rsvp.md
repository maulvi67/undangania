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
submit/update response, override, export. The couple can override an answer from
the RSVP page. An override writes the previous answer to `RsvpHistory`, bumps the
optimistic version, and records `RSVP_OVERRIDDEN` in the audit log. CSV export is
permission-checked and records `RSVP_EXPORTED`.

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
rate limit, idempotency, no cross-household data. Overrides are tenant- and
wedding-scoped and preserve the guest's previous answer. Public RSVP writes resolve the
bearer token together with the current invitation slug, so a token copied from a
different invitation cannot address this wedding's household. The household,
tenant, and event scope are still derived server-side.

## Owning module
`rsvp` owns the invariant and write model. Other modules integrate through application ports or versioned events.

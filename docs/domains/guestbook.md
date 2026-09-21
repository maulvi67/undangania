# Domain: Guestbook

## Purpose
Moderated wishes.

## Actors
guest, couple, moderator.

## Entities
GuestbookMessage.

## Business rules
safe text; moderation policy.

## Status and transitions
PENDING → APPROVED/REJECTED/HIDDEN.

## Use cases
submit, approve, hide, delete.

## Validation
length, profanity/abuse, token scope.

## Edge cases
spam, XSS, moderation dispute.

## API
/public/guestbook, /moderation/messages.

## Domain events
GuestbookSubmitted, MessageModerated.

## Dependencies
guest, moderation.

## Security considerations
XSS prevention and abuse throttling. Public submissions bind the personalized
token to the invitation slug before resolving the household; a token from another
invitation is treated as unusable. Messages remain pending until moderation.

## Owning module
`guestbook` owns the invariant and write model. Other modules integrate through application ports or versioned events.

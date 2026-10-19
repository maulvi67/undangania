# Domain: Notification

## Purpose
Reliable transactional messaging.

## Actors
system, customer, guest.

## Entities
Notification, DeliveryAttempt, Preference, Template.

## Business rules
consent/category/provider rules; idempotent delivery.

## Status and transitions
QUEUED → SENT → DELIVERED/FAILED/SUPPRESSED.

## Use cases
enqueue, send, retry, suppress.

## Validation
recipient, channel, template data.

## Edge cases
provider outage, duplicate, opt-out.

## API
/notifications, /webhooks/messaging.

## Domain events
NotificationDelivered, NotificationFailed.

## Dependencies
email, WhatsApp, queue.

## Security considerations
PII minimization and opt-out. The customer `/notifikasi` page reads
tenant-scoped delivery status without recipient references, provider message ids,
idempotency keys, or raw provider errors.

## Owning module
`notification` owns the invariant and write model. Other modules integrate through application ports or versioned events.

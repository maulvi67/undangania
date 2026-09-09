# ADR 0004: Transactional outbox

Accepted. Domain change and outbox event are committed together; workers provide idempotent at-least-once processing.

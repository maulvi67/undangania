# Architecture

## Style

Modular monolith for synchronous business capabilities, separately deployed customer/admin/vendor frontends, a backend API, workers, and notification service. Shared packages contain domain logic and typed contracts. PostgreSQL is the source of truth, Redis supports ephemeral coordination, object storage holds media/templates, and the transactional outbox connects state changes to asynchronous work.

## Request path

Edge/WAF → application route → authentication → tenant resolution → authorization → schema validation → application use case → transaction → audit/outbox → cache invalidation → DTO.

## Evolution

Extract payment, notification, media rendering, public invitation delivery, analytics ingestion, or vendor integration only when independent scaling, SLO, deploy cadence, or ownership justifies it. Preserve domain events and adapter interfaces from the start.

# Domain: Analytics

## Purpose
Product and operational measurement.

## Actors
product, operations.

## Entities
AnalyticsEvent, MetricDefinition.

## Business rules
allowlisted non-PII properties; deduplicated.

## Status and transitions
RECEIVED → VALIDATED → PROCESSED/REJECTED.

## Use cases
track, aggregate, report.

## Validation
event schema/version/consent.

## Edge cases
duplicate event, bot traffic.

## API
/analytics/events, dashboards.

## Domain events
AnalyticsEventAccepted.

## Dependencies
all domains.

## Security considerations
no tokens/contact/content in analytics.

## Owning module
`analytics` owns the invariant and write model. Other modules integrate through application ports or versioned events.

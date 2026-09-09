# Business Rules

- Only verified payment grants paid entitlement.
- Order price and product configuration are immutable snapshots.
- A published invitation references one active publication snapshot.
- Draft changes do not modify public output until republished.
- Guest RSVP cannot exceed invitation/event allowance.
- Guestbook is moderated and plain text or safely sanitized.
- Gift account values are confidential and excluded from telemetry.
- Printing order cannot enter production before proof approval and vendor acceptance.
- Vendor status transitions require actor, timestamp, and audit.
- Subscription changes are effective according to provider-confirmed billing state.
- Promotions are validated server-side for active period, scope, quota, and stacking.
- Custom domain activation requires ownership verification and certificate readiness.
- AI-generated output is marked as generated draft and never treated as verified fact.

# Domain Model

Bounded contexts: Identity, Wedding, Digital Invitation, Template, Customization, Guest, RSVP, Guestbook, Gift Registry, Media, Catalog/Pricing/Promotion, Order, Payment, Subscription, Vendor, Printing, Shipping, Notification, Custom Domain, Reseller, Analytics, Moderation, and Audit.

Aggregates own invariants. Cross-context work uses application orchestration and domain events. Database models are not exposed directly to user interfaces. Full definitions live in `docs/domains/`.
